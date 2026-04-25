import { MODULE_ID } from "./config.js";
import { getActorHumanity, getThresholdForValue, getThresholdData, gmUserIds } from "./utils.js";

export async function notifyThresholdCrossed(actor, oldKey, newKey) {
  const data      = getThresholdData(newKey);
  const gms       = gmUserIds();
  const direction = isWorsening(oldKey, newKey) ? "⬇️" : "⬆️";

  const traitsHtml = data.suggestedTraits?.length
    ? `<div class="suggested-traits">
         <h4>${game.i18n.localize("CYBERWARE.SuggestedTraits")}</h4>
         <ul>${data.suggestedTraits.map(t => `<li>${t}</li>`).join("")}</ul>
         <p><em>${game.i18n.localize("CYBERWARE.GMDecides")}</em></p>
       </div>`
    : "";

  const msgContent = `
    <div class="cyberware-notification threshold-notification" style="border-left:4px solid ${data.color}">
      <h3>${direction} ${game.i18n.localize("CYBERWARE.ThresholdCrossed")}</h3>
      <p>
        <strong>${actor.name}</strong>
        ${game.i18n.format("CYBERWARE.EnteredZone", { zone: `<span style="color:${data.color}">${game.i18n.localize(data.label)}</span>` })}
      </p>
      ${traitsHtml}
    </div>`;

  const isPublic   = game.settings.get(MODULE_ID, "publicThresholdNotification");
  const notifyPlayer = game.settings.get(MODULE_ID, "notifyPlayerOnThreshold");

  let whisperIds = null;

  if (!isPublic) {
    whisperIds = [...gms];
    if (notifyPlayer) {
      // Add the users who own this actor (excluding GMs already included)
      const ownerIds = game.users
        .filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"))
        .map(u => u.id);
      whisperIds = [...new Set([...whisperIds, ...ownerIds])];
    }
    if (!whisperIds.length) return;
  }

  await ChatMessage.create({
    content: msgContent,
    whisper: whisperIds ?? [],
    speaker: { alias: game.i18n.localize("CYBERWARE.SystemSpeaker") }
  });
}

export function checkThresholdCrossing(actor, oldCurrent, newCurrent) {
  const humanity = getActorHumanity(actor);
  if (!humanity) return;

  const base   = humanity.base;
  const oldKey = getThresholdForValue(oldCurrent, base);
  const newKey = getThresholdForValue(newCurrent, base);

  if (oldKey !== newKey) {
    notifyThresholdCrossed(actor, oldKey, newKey).catch(err =>
      console.error(`${MODULE_ID} | threshold notification failed:`, err)
    );
  }
}

const ORDER = ["human", "detachment", "dissociation", "prePsychosis", "cyberpsychosis"];

function isWorsening(oldKey, newKey) {
  return ORDER.indexOf(newKey) > ORDER.indexOf(oldKey);
}
