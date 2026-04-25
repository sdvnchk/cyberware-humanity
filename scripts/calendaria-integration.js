import { MODULE_ID } from "./config.js";

export function registerCalendariaHooks() {
  if (!game.settings.get(MODULE_ID, "enableCalendariaIntegration")) return;

  // Calendaria
  Hooks.on("calendariaDateTimeChange", onDateTimeChange);
  // Simple Calendar (also common)
  Hooks.on("simple-calendar.dateTimeChange", onSimpleCalendarChange);
}

async function onDateTimeChange(newDate, oldDate) {
  if (!newDate?.timestamp || !oldDate?.timestamp) return;
  const daysPassed = Math.floor((newDate.timestamp - oldDate.timestamp) / (24 * 60 * 60));
  if (daysPassed <= 0) return;
  await processTemporaryTraits(daysPassed);
}

async function onSimpleCalendarChange(data) {
  // Simple Calendar fires with { date, time, ... }; compute elapsed days via seconds
  const diff = data?.diff?.seconds ?? 0;
  const daysPassed = Math.floor(diff / (24 * 60 * 60));
  if (daysPassed <= 0) return;
  await processTemporaryTraits(daysPassed);
}

async function processTemporaryTraits(daysPassed) {
  for (const actor of game.actors.filter(a => a.type === "character")) {
    const traits = actor.flags?.[MODULE_ID]?.temporaryTraits;
    if (!traits?.length) continue;

    const updated = traits.map(t => ({
      ...t,
      daysRemaining: (t.daysRemaining ?? 0) - daysPassed
    }));

    await actor.update({ [`flags.${MODULE_ID}.temporaryTraits`]: updated });

    const expired = updated.filter(t => t.daysRemaining <= 0);
    if (expired.length) {
      ui.notifications.info(
        game.i18n.format("CYBERWARE.TraitsExpired", {
          name:  actor.name,
          count: expired.length
        })
      );
    }
  }
}
