import { MODULE_ID, THRESHOLDS, WILL_DATA_PATHS } from "./config.js";

export function getActorHumanity(actor) {
  return actor.flags?.[MODULE_ID]?.humanity ?? null;
}

export function getWillValue(actor) {
  for (const path of WILL_DATA_PATHS) {
    const value = foundry.utils.getProperty(actor, path);
    if (typeof value === "number" && value > 0) return value;
  }
  return 10;
}

export function getHumanityBase(actor) {
  return getWillValue(actor) * 5;
}

export function getThresholdForValue(current, base) {
  if (base <= 0) return "cyberpsychosis";
  const pct = (current / base) * 100;

  if (pct <= 0)  return "cyberpsychosis";
  if (pct <= 25) return "prePsychosis";
  if (pct <= 40) return "dissociation";
  if (pct <= 70) return "detachment";
  return "human";
}

export function getThresholdData(key) {
  return THRESHOLDS[key] ?? THRESHOLDS.human;
}

export function getHumanityColor(current, base) {
  return getThresholdData(getThresholdForValue(current, base)).color;
}

export function gmUserIds() {
  return game.users.filter(u => u.isGM).map(u => u.id);
}

export async function ensureHumanityFlags(actor) {
  if (actor.flags?.[MODULE_ID]?.humanity) return false;
  const base = getHumanityBase(actor);
  await actor.update({
    [`flags.${MODULE_ID}.humanity`]: {
      base,
      currentMax: base,
      current: base
    }
  });
  return true;
}

export function formatQualityLabel(quality) {
  const { CRAFT_QUALITY } = window._cyberwareConfig ?? {};
  return CRAFT_QUALITY?.[quality]?.label ?? quality;
}
