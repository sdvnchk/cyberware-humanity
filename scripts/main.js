import { MODULE_ID }                   from "./config.js";
import { registerCharacterSheetHooks } from "./character-sheet-integration.js";
import { registerCalendariaHooks }     from "./calendaria-integration.js";
import { markAsCyberware, openCyberwareConfig } from "./cyberware.js";
import { checkThresholdCrossing }      from "./thresholds.js";
import { getActorHumanity, getWillValue } from "./utils.js";

// ── init ─────────────────────────────────────────────────────────────────────

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Cyberware & Humanity Manager`);

  game.settings.register(MODULE_ID, "enableCalendariaIntegration", {
    name:    "CYBERWARE.Settings.CalendariaIntegration",
    hint:    "CYBERWARE.Settings.CalendariaIntegrationHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "autoInitializeHumanity", {
    name:    "CYBERWARE.Settings.AutoInitHumanity",
    hint:    "CYBERWARE.Settings.AutoInitHumanityHint",
    scope:   "world",
    config:  true,
    type:    Boolean,
    default: true
  });

  // Register a Handlebars helper used in templates
  Handlebars.registerHelper("cyberConcat", (...args) => {
    // Last arg is the Handlebars options object — drop it
    args.pop();
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

// ── Item Sheet — "Mark as Cyberware" button ────────────────────────────────

function onRenderItemSheet(app, html, _data) {
  const item = app.item;
  if (!item) return;

  const isCyber = Boolean(item.flags?.[MODULE_ID]?.isCyberware);

  const btnClass = `header-button mark-cyberware-btn control ${isCyber ? "active" : ""}`;
  const btnTitle = isCyber
    ? game.i18n.localize("CYBERWARE.ConfigureCyberware")
    : game.i18n.localize("CYBERWARE.MarkAsCyberware");
  const btnLabel = isCyber
    ? game.i18n.localize("CYBERWARE.Cyberware")
    : game.i18n.localize("CYBERWARE.MarkAsCyberware");

  const btn = $(`
    <a class="${btnClass}" title="${btnTitle}">
      <i class="fas fa-robot"></i>
      <span>${btnLabel}</span>
    </a>`);

  html.find(".window-header .header-button.close").before(btn);

  btn.on("click", async (e) => {
    e.preventDefault();
    if (!isCyber) {
      await markAsCyberware(item);
      app.render(true);
    } else {
      openCyberwareConfig(item);
    }
  });
}

// ── Actor update — threshold detection + Will sync ────────────────────────

function onUpdateActor(actor, change) {
  // ① If Will changed, resync the humanity base (Will × 5).
  //    We only adjust currentMax proportionally; current stays as-is.
  //    The GM can correct manually if needed.
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

  // ② Threshold check when humanity.current changes.
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

  const newBase   = newWill * 5;
  const oldBase   = humanity.base;
  if (newBase === oldBase) return;

  const baseDelta   = newBase - oldBase;
  const newMax      = Math.max(0, humanity.currentMax + baseDelta);

  await actor.update({
    [`flags.${MODULE_ID}.humanity.base`]:       newBase,
    [`flags.${MODULE_ID}.humanity.currentMax`]: newMax
  });

  ui.notifications.info(
    `${actor.name}: Will changed — Humanity base updated to ${newBase} (max: ${newMax}).`
  );
}
