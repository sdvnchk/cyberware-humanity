import { MODULE_ID } from "./config.js";
import { getActorHumanity, getThresholdForValue, getThresholdData, gmUserIds } from "./utils.js";

export async function notifyThresholdCrossed(actor, oldKey, newKey) {
  const data = getThresholdData(newKey);
  const gms  = gmUserIds();
  if (!gms.length) return;

  const traitsHtml = data.suggestedTraits?.length
    ? `<div class="suggested-traits">
         <h4>${game.i18n.localize("CYBERWARE.SuggestedTraits")}</h4>
         <ul>${data.suggestedTraits.map(t => `<li>${t}</li>`).join("")}</ul>
         <p><em>${game.i18n.localize("CYBERWARE.GMDecides")}</em></p>
       </div>`
    : "";

  const direction = isWorsening(oldKey, newKey) ? "⬇️" : "⬆️";

  await ChatMessage.create({
    content: `
      <div class="cyberware-notification threshold-notification" style="border-left:4px solid ${data.color}">
        <h3>${direction} ${game.i18n.localize("CYBERWARE.ThresholdCrossed")}</h3>
        <p>
          <strong>${actor.name}</strong>
          ${game.i18n.format("CYBERWARE.EnteredZone", { zone: `<span style="color:${data.color}">${data.label}</span>` })}
        </p>
        ${traitsHtml}
      </div>`,
    whisper: gms,
    speaker: { alias: game.i18n.localize("CYBERWARE.SystemSpeaker") }
  });
}

export function checkThresholdCrossing(actor, oldCurrent, newCurrent) {
  const humanity = getActorHumanity(actor);
  if (!humanity) return;

  const base    = humanity.base;
  const oldKey  = getThresholdForValue(oldCurrent, base);
  const newKey  = getThresholdForValue(newCurrent, base);

  if (oldKey !== newKey) {
    notifyThresholdCrossed(actor, oldKey, newKey);
  }
}

const ORDER = ["human", "detachment", "dissociation", "prePsychosis", "cyberpsychosis"];

function isWorsening(oldKey, newKey) {
  return ORDER.indexOf(newKey) > ORDER.indexOf(oldKey);
}
