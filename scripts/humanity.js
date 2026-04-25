import { MODULE_ID } from "./config.js";
import { getActorHumanity, getWillValue, gmUserIds } from "./utils.js";

export function calculateInstallCost(rollTotal) {
  const hard   = Math.ceil(rollTotal * 0.20);
  const stress = rollTotal - hard;
  return { total: rollTotal, hard, stress };
}

export function getAdaptationOutcome(rollResult, willValue) {
  if (rollResult <= 4 || rollResult <= willValue - 10) return "critical_success";
  if (rollResult <= willValue)                          return "success";
  if (rollResult >= 17 || rollResult >= willValue + 10) return "critical_failure";
  return "failure";
}

export async function applyInstallation(actor, implant, cost, adaptation) {
  const humanity = getActorHumanity(actor);
  if (!humanity) return;

  let actualCost = cost.total;
  if (adaptation.outcome === "critical_success") actualCost = cost.minPossible ?? cost.total;
  if (adaptation.outcome === "critical_failure")  actualCost = cost.maxPossible ?? cost.total;

  const hardCost   = Math.ceil(actualCost * 0.20);
  const newCurrent = Math.max(0, humanity.current    - actualCost);
  const newMax     = Math.max(0, humanity.currentMax - hardCost);

  await actor.update({
    [`flags.${MODULE_ID}.humanity.current`]:    newCurrent,
    [`flags.${MODULE_ID}.humanity.currentMax`]: newMax
  });

  await implant.update({
    [`flags.${MODULE_ID}.cyberData.installed`]:      true,
    [`flags.${MODULE_ID}.cyberData.installDate`]:    new Date().toISOString(),
    [`flags.${MODULE_ID}.cyberData.adaptationRoll`]: adaptation.roll
  });

  if (adaptation.outcome === "failure" || adaptation.outcome === "critical_failure") {
    const gms = gmUserIds();
    if (gms.length) {
      const isCrit = adaptation.outcome === "critical_failure";
      await ChatMessage.create({
        content: `
          <div class="cyberware-notification adaptation-failure">
            <h3>${isCrit ? "💀 Critical Failure" : "❌ Adaptation Failure"}</h3>
            <p>
              <strong>${actor.name}</strong>
              failed the adaptation check for
              <strong>${implant.name}</strong>.
            </p>
            <p>
              GM should assign a
              ${isCrit ? "<strong>permanent</strong>" : "<strong>temporary</strong> (1d6 days)"}
              negative trait.
            </p>
          </div>`,
        whisper: gms,
        speaker: { alias: game.i18n.localize("CYBERWARE.SystemSpeaker") }
      });
    }
  }

  ui.notifications.info(
    game.i18n.format("CYBERWARE.InstallSuccess", { name: implant.name })
  );
}

export function recalcBaseHumanity(actor) {
  const base = getWillValue(actor) * 5;
  return base;
}
