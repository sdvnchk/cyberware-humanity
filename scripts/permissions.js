import { MODULE_ID } from "./config.js";

export function canDo(settingKey) {
  return game.user.role >= (game.settings.get(MODULE_ID, settingKey) ?? 4);
}

export function requirePermission(settingKey) {
  if (canDo(settingKey)) return true;
  ui.notifications.warn(game.i18n.localize("CYBERWARE.PermissionDenied"));
  return false;
}
