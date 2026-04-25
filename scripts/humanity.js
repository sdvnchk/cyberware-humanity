import { MODULE_ID } from "./config.js";
import { getActorHumanity, gmUserIds } from "./utils.js";

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
    [`flags.${MODULE_ID}.cyberData.installed`]:               true,
    [`flags.${MODULE_ID}.cyberData.installDate`]:             new Date().toISOString(),
    [`flags.${MODULE_ID}.cyberData.adaptationRoll`]:          adaptation.roll,
    [`flags.${MODULE_ID}.cyberData.installData.hardCostPaid`]: hardCost
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

export async function uninstallImplant(actor, implant, restoreHardCost = true) {
  const humanity  = getActorHumanity(actor);
  if (!humanity) return;

  const cyberData    = implant.flags?.[MODULE_ID]?.cyberData;
  if (!cyberData?.installed) {
    ui.notifications.warn(game.i18n.localize("CYBERWARE.NotInstalled"));
    return;
  }

  const hardCostPaid = cyberData.installData?.hardCostPaid ?? 0;

  await implant.update({
    [`flags.${MODULE_ID}.cyberData.installed`]:      false,
    [`flags.${MODULE_ID}.cyberData.installDate`]:    null,
    [`flags.${MODULE_ID}.cyberData.adaptationRoll`]: null
  });

  if (restoreHardCost && hardCostPaid > 0) {
    const newMax = Math.min(humanity.base, humanity.currentMax + hardCostPaid);
    await actor.update({
      [`flags.${MODULE_ID}.humanity.currentMax`]: newMax
    });
    ui.notifications.info(
      game.i18n.format("CYBERWARE.UninstallRestored", { name: implant.name, hard: hardCostPaid })
    );
  } else {
    ui.notifications.info(
      game.i18n.format("CYBERWARE.UninstallSuccess", { name: implant.name })
    );
  }
}
