import { MODULE_ID, PERMISSION_LEVELS }        from "./config.js";
import { registerCharacterSheetHooks }           from "./character-sheet-integration.js";
import { registerCalendariaHooks }               from "./calendaria-integration.js";
import { markAsCyberware, openCyberwareConfig }  from "./cyberware.js";
import { checkThresholdCrossing }                from "./thresholds.js";
import { getActorHumanity, getWillValue }        from "./utils.js";
import { canDo, requirePermission }              from "./permissions.js";
import { MacroInstallerMenu }                    from "./macros.js";

// ── init ─────────────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Cyberware & Humanity Manager`);

  // ── Core settings ───────────────────────────────────────────────────────────

  game.settings.register(MODULE_ID, "autoInitializeHumanity", {
    name:    "CYBERWARE.Settings.AutoInitHumanity",
    hint:    "CYBERWARE.Settings.AutoInitHumanityHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "enableCalendariaIntegration", {
    name:    "CYBERWARE.Settings.CalendariaIntegration",
    hint:    "CYBERWARE.Settings.CalendariaIntegrationHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  // ── Notification settings ───────────────────────────────────────────────────

  game.settings.register(MODULE_ID, "notifyPlayerOnThreshold", {
    name:    "CYBERWARE.Settings.NotifyPlayer",
    hint:    "CYBERWARE.Settings.NotifyPlayerHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "publicThresholdNotification", {
    name:    "CYBERWARE.Settings.PublicThreshold",
    hint:    "CYBERWARE.Settings.PublicThresholdHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  // ── Permission settings ─────────────────────────────────────────────────────

  game.settings.register(MODULE_ID, "permMarkCyberware", {
    name:    "CYBERWARE.Settings.PermMarkCyberware",
    hint:    "CYBERWARE.Settings.PermMarkCyberwareHint",
    scope:   "world",
    config:  true,
    type:    Number,
    choices: PERMISSION_LEVELS,
    default: 4,
    restricted: true
  });

  game.settings.register(MODULE_ID, "permConfigCyberware", {
    name:    "CYBERWARE.Settings.PermConfigCyberware",
    hint:    "CYBERWARE.Settings.PermConfigCyberwareHint",
    scope:   "world",
    config:  true,
    type:    Number,
    choices: PERMISSION_LEVELS,
    default: 4,
    restricted: true
  });

  game.settings.register(MODULE_ID, "permInstallImplant", {
    name:    "CYBERWARE.Settings.PermInstallImplant",
    hint:    "CYBERWARE.Settings.PermInstallImplantHint",
    scope:   "world",
    config:  true,
    type:    Number,
    choices: PERMISSION_LEVELS,
    default: 4,
    restricted: true
  });

  game.settings.register(MODULE_ID, "permEditHumanity", {
    name:    "CYBERWARE.Settings.PermEditHumanity",
    hint:    "CYBERWARE.Settings.PermEditHumanityHint",
    scope:   "world",
    config:  true,
    type:    Number,
    choices: PERMISSION_LEVELS,
    default: 3,
    restricted: true
  });

  // ── Macro installer button ──────────────────────────────────────────────────

  game.settings.registerMenu(MODULE_ID, "macroInstaller", {
    name:       "CYBERWARE.Settings.InstallMacros",
    hint:       "CYBERWARE.Settings.InstallMacrosHint",
    label:      "CYBERWARE.Settings.InstallMacrosBtn",
    icon:       "fas fa-magic",
    type:       MacroInstallerMenu,
    restricted: true
  });

  // ── Handlebars helper ───────────────────────────────────────────────────────

  Handlebars.registerHelper("cyberConcat", (...args) => {
    args.pop(); // drop options object
    return args.join("");
  });
});

// ── ready ─────────────────────────────────────────────────────────────────────

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);

  registerCharacterSheetHooks();
  registerCalendariaHooks();

  Hooks.on("renderItemSheet", onRenderItemSheet);
  Hooks.on("updateActor",     onUpdateActor);
});

// ── Item Sheet — "Mark / Unmark / Configure" buttons ─────────────────────────

function onRenderItemSheet(app, html, _data) {
  const item = app.item;
  if (!item) return;

  const isCyber = Boolean(item.flags?.[MODULE_ID]?.isCyberware);

  if (isCyber) {
    // ── ⚙ Configure button ──────────────────────────────────────────────────
    const configBtn = $(`
      <a class="header-button mark-cyberware-btn control active"
         title="${game.i18n.localize("CYBERWARE.ConfigureCyberware")}">
        <i class="fas fa-cog"></i>
        <span>${game.i18n.localize("CYBERWARE.Cyberware")}</span>
      </a>`);

    html.find(".window-header .header-button.close").before(configBtn);

    configBtn.on("click", (e) => {
      e.preventDefault();
      if (!requirePermission("permConfigCyberware")) return;
      openCyberwareConfig(item);
    });

    // ── ✕ Unmark button ─────────────────────────────────────────────────────
    const unmarkBtn = $(`
      <a class="header-button unmark-cyberware-btn control"
         title="${game.i18n.localize("CYBERWARE.UnmarkAsCyberware")}">
        <i class="fas fa-times-circle"></i>
        <span>${game.i18n.localize("CYBERWARE.Unmark")}</span>
      </a>`);

    html.find(".window-header .header-button.close").before(unmarkBtn);

    unmarkBtn.on("click", async (e) => {
      e.preventDefault();
      if (!requirePermission("permMarkCyberware")) return;

      const confirmed = await Dialog.confirm({
        title:   game.i18n.localize("CYBERWARE.UnmarkConfirmTitle"),
        content: game.i18n.format("CYBERWARE.UnmarkConfirmContent", { name: item.name }),
        defaultYes: false
      });
      if (!confirmed) return;

      await item.update({
        [`flags.${MODULE_ID}.-=isCyberware`]: null,
        [`flags.${MODULE_ID}.-=cyberData`]:   null
      });
      ui.notifications.info(game.i18n.format("CYBERWARE.UnmarkedAsCyberware", { name: item.name }));
      app.render(true);
    });

  } else {
    // ── 🤖 Mark button ──────────────────────────────────────────────────────
    const markBtn = $(`
      <a class="header-button mark-cyberware-btn control"
         title="${game.i18n.localize("CYBERWARE.MarkAsCyberware")}">
        <i class="fas fa-robot"></i>
        <span>${game.i18n.localize("CYBERWARE.MarkAsCyberware")}</span>
      </a>`);

    html.find(".window-header .header-button.close").before(markBtn);

    markBtn.on("click", async (e) => {
      e.preventDefault();
      if (!requirePermission("permMarkCyberware")) return;
      await markAsCyberware(item);
      app.render(true);
    });
  }
}

// ── Actor update — threshold detection + Will sync ────────────────────────

function onUpdateActor(actor, change) {
  const willPaths = [
    "system.attributes.WILL.value",
    "system.attributes.will.value",
    "system.will"
  ];
  for (const path of willPaths) {
    const newWill = foundry.utils.getProperty(change, path);
    if (typeof newWill === "number" && newWill > 0) {
      _handleWillChange(actor, newWill);
      break;
    }
  }

  const humanityChange = change.flags?.[MODULE_ID]?.humanity;
  if (!humanityChange) return;

  const newCurrent = humanityChange.current;
  if (newCurrent === undefined) return;

  const oldCurrent = actor._source?.flags?.[MODULE_ID]?.humanity?.current;
  if (oldCurrent === undefined || oldCurrent === newCurrent) return;

  checkThresholdCrossing(actor, oldCurrent, newCurrent);
}

async function _handleWillChange(actor, newWill) {
  const humanity = getActorHumanity(actor);
  if (!humanity) return;

  const newBase = newWill * 5;
  if (newBase === humanity.base) return;

  const baseDelta = newBase - humanity.base;
  const newMax    = Math.max(0, humanity.currentMax + baseDelta);

  await actor.update({
    [`flags.${MODULE_ID}.humanity.base`]:       newBase,
    [`flags.${MODULE_ID}.humanity.currentMax`]: newMax
  });

  ui.notifications.info(
    `${actor.name}: Will changed — Humanity base updated to ${newBase} (max: ${newMax}).`
  );
}
