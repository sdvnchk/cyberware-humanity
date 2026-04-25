import { MODULE_ID }                   from "./config.js";
import { registerCharacterSheetHooks } from "./character-sheet-integration.js";
import { registerCalendariaHooks }     from "./calendaria-integration.js";
import { markAsCyberware, openCyberwareConfig } from "./cyberware.js";
import { checkThresholdCrossing }      from "./thresholds.js";
import { getActorHumanity }            from "./utils.js";

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
});

// ── ready ─────────────────────────────────────────────────────────────────────

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Ready`);

  registerCharacterSheetHooks();
  registerCalendariaHooks();

  Hooks.on("renderItemSheet", onRenderItemSheet);
  Hooks.on("updateActor",     onUpdateActor);
});

// ── Item Sheet — "Mark as Cyberware" button ───────────────────────────────────

const SUPPORTED_ITEM_TYPES = new Set(["equipment", "item", "gear", "weapon", "armor"]);

function onRenderItemSheet(app, html, _data) {
  const item = app.item;
  if (!item) return;

  // Accept any item type (GURPS uses "equipment" but let GM decide)
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

  // Insert before the close button
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

// ── Actor update — threshold detection ───────────────────────────────────────

function onUpdateActor(actor, change) {
  const humanityChange = change.flags?.[MODULE_ID]?.humanity;
  if (!humanityChange) return;

  const newCurrent = humanityChange.current;
  if (newCurrent === undefined) return;

  const oldCurrent = actor._source?.flags?.[MODULE_ID]?.humanity?.current;
  if (oldCurrent === undefined || oldCurrent === newCurrent) return;

  checkThresholdCrossing(actor, oldCurrent, newCurrent);
}
