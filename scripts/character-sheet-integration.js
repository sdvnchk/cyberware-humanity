import { MODULE_ID } from "./config.js";
import {
  getActorHumanity, getHumanityBase,
  getThresholdForValue, getThresholdData,
  ensureHumanityFlags
} from "./utils.js";
import { openInstallDialog }   from "./installation.js";
import { openCyberwareConfig } from "./cyberware.js";
import { checkThresholdCrossing } from "./thresholds.js";

// ── Hook registration ────────────────────────────────────────────────────────

export function registerCharacterSheetHooks() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
  Hooks.on("updateActor",      onUpdateActorForThreshold);
}

// ── Sheet render hook ────────────────────────────────────────────────────────

async function onRenderActorSheet(app, html, _data) {
  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

  if (game.settings.get(MODULE_ID, "autoInitializeHumanity") && actor.isOwner) {
    const initialised = await ensureHumanityFlags(actor);
    if (initialised) return; // re-render will fire again
  }

  const humanity = getActorHumanity(actor);
  if (!humanity) return;

  injectHumanityTrack(html, actor, humanity);
}

// ── Track injection ──────────────────────────────────────────────────────────

function injectHumanityTrack(html, actor, humanity) {
  // Remove any stale track from a previous render
  html.find(".humanity-track").remove();

  const base       = humanity.base;
  const current    = humanity.current;
  const currentMax = humanity.currentMax;
  const pct        = base > 0 ? Math.min(100, (current    / base) * 100) : 0;
  const maxPct     = base > 0 ? Math.min(100, (currentMax / base) * 100) : 0;
  const threshKey  = getThresholdForValue(current, base);
  const threshData = getThresholdData(threshKey);
  const color      = threshData.color;

  const trackHtml = buildTrackHtml({ current, currentMax, base, pct, maxPct, threshKey, color, actorId: actor.id, canEdit: actor.isOwner });

  // Ordered list of candidate insertion points within the GURPS character sheet
  const candidates = [
    ".resource-list",
    ".attributes .resources",
    ".secondary-attributes",
    ".char-resources",
    ".char-stats",
    ".basic-attributes",
    ".sheet-sidebar",
    ".attributes",
    "form.gurps-sheet"
  ];

  let inserted = false;
  for (const sel of candidates) {
    const target = html.find(sel).first();
    if (target.length) {
      target.append(trackHtml);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    html.find(".sheet-body, .window-content").first().prepend(trackHtml);
  }

  // Apply CSS custom property for dynamic colouring
  const track = html.find(".humanity-track");
  track.css("--humanity-color", color);

  wireTrackEvents(html, actor);
}

function buildTrackHtml({ current, currentMax, base, pct, maxPct, threshKey, color, actorId, canEdit }) {
  const threshData = getThresholdData(threshKey);
  const readOnly   = canEdit ? "" : "readonly disabled";

  const statusIcons = {
    human:          "🟢",
    detachment:     "⚠️",
    dissociation:   "🟠",
    prePsychosis:   "🔴",
    cyberpsychosis: "💀"
  };

  // Threshold marker positions (% of base)
  const markers = [
    { pct: 70, label: "Detachment" },
    { pct: 40, label: "Dissociation" },
    { pct: 25, label: "Pre-Psychosis" }
  ].map(m =>
    `<div class="threshold-marker" style="left:${m.pct}%" title="${m.label}"></div>`
  ).join("");

  return `
    <div class="resource-track humanity-track" data-actor-id="${actorId}"
         style="--humanity-color:${color}">
      <div class="resource-label">
        <span class="label-text">
          ${game.i18n.localize("CYBERWARE.Humanity").toUpperCase()}
        </span>
        <button class="btn-open-humanity-manager" type="button"
                title="${game.i18n.localize("CYBERWARE.OpenManager")}">
          <i class="fas fa-cog"></i>
        </button>
      </div>

      <div class="resource-values">
        <input type="number"
               name="flags.${MODULE_ID}.humanity.current"
               value="${current}"
               class="resource-input current"
               title="${game.i18n.localize("CYBERWARE.CurrentHumanity")}"
               min="0" max="${currentMax}"
               data-dtype="Number"
               ${readOnly}>
        <span class="separator">/</span>
        <input type="number"
               name="flags.${MODULE_ID}.humanity.currentMax"
               value="${currentMax}"
               class="resource-input max"
               title="${game.i18n.localize("CYBERWARE.MaxHumanity")}"
               min="0" max="${base}"
               data-dtype="Number"
               ${readOnly}>
        <span class="separator">/</span>
        <span class="base-value"
              title="${game.i18n.localize("CYBERWARE.BaseHumanity")} (Will × 5)">
          ${base}
        </span>
      </div>

      <div class="humanity-mini-bar">
        <div class="bar-max-fill"  style="width:${maxPct}%"></div>
        <div class="bar-fill"      style="width:${pct}%;background:${color}"></div>
        <div class="threshold-markers">${markers}</div>
      </div>

      <div class="humanity-status" data-status="${threshKey}">
        <span class="status-icon">${statusIcons[threshKey] ?? "❓"}</span>
        <span class="status-text">${threshData.label}</span>
      </div>
    </div>`;
}

// ── Track event wiring ───────────────────────────────────────────────────────

function wireTrackEvents(html, actor) {
  html.find(".btn-open-humanity-manager").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openHumanityManager(actor);
  });

  // Direct numeric input editing
  html.find(".humanity-track .resource-input").on("change", async (e) => {
    const input = e.currentTarget;
    const value = parseInt(input.value, 10);
    if (isNaN(value)) return;

    const humanity = getActorHumanity(actor);
    if (!humanity) return;

    if (input.name.endsWith(".current")) {
      const old = humanity.current;
      await actor.update({ [input.name]: Math.max(0, value) });
      checkThresholdCrossing(actor, old, value);
    } else if (input.name.endsWith(".currentMax")) {
      await actor.update({ [input.name]: Math.max(0, value) });
    }
  });
}

// ── Actor update hook (threshold detection) ──────────────────────────────────

function onUpdateActorForThreshold(actor, change) {
  const humanityChange = change.flags?.[MODULE_ID]?.humanity;
  if (!humanityChange) return;

  const newCurrent = humanityChange.current;
  if (newCurrent === undefined) return;

  const oldCurrent = actor._source?.flags?.[MODULE_ID]?.humanity?.current;
  if (oldCurrent === undefined || oldCurrent === newCurrent) return;

  checkThresholdCrossing(actor, oldCurrent, newCurrent);
}

// ── Humanity Manager dialog ──────────────────────────────────────────────────

export function openHumanityManager(actor) {
  const humanity = getActorHumanity(actor);
  if (!humanity) {
    ui.notifications.error(game.i18n.localize("CYBERWARE.NoHumanityData"));
    return;
  }

  const cyberItems = actor.items.filter(i => i.flags?.[MODULE_ID]?.isCyberware);
  const base       = humanity.base;
  const pct        = base > 0 ? Math.round((humanity.current / base) * 100) : 0;
  const threshKey  = getThresholdForValue(humanity.current, base);
  const threshData = getThresholdData(threshKey);

  const rowsHtml = cyberItems.length
    ? cyberItems.map(item => {
        const cd = item.flags[MODULE_ID].cyberData;
        const slotLabel = game.i18n.localize(`CYBERWARE.Slot.${cd.slot}`);
        return `
          <tr class="cyberware-row ${cd.installed ? "installed" : "uninstalled"}">
            <td>${item.name}</td>
            <td>${slotLabel}</td>
            <td>${cd.humanityCostDice}</td>
            <td class="text-center">${cd.installed ? "✓" : "—"}</td>
            <td class="row-actions">
              ${!cd.installed
                ? `<button class="btn-install-item" data-item-id="${item.id}" type="button"
                           title="${game.i18n.localize("CYBERWARE.Install")}">
                     <i class="fas fa-plug"></i>
                   </button>`
                : ""}
              <button class="btn-config-item" data-item-id="${item.id}" type="button"
                      title="${game.i18n.localize("CYBERWARE.ConfigureCyberware")}">
                <i class="fas fa-cog"></i>
              </button>
            </td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="5" class="no-items">
         <em>${game.i18n.localize("CYBERWARE.NoCyberwareItems")}</em>
       </td></tr>`;

  const content = `
    <div class="humanity-manager">
      <div class="humanity-overview" style="--humanity-color:${threshData.color}">
        <h3>${game.i18n.localize("CYBERWARE.HumanityOverview")}</h3>
        <div class="overview-values">
          <div class="ov-val">
            <span class="ov-label">${game.i18n.localize("CYBERWARE.Base")}</span>
            <span class="ov-number">${humanity.base}</span>
          </div>
          <div class="ov-val">
            <span class="ov-label">${game.i18n.localize("CYBERWARE.Maximum")}</span>
            <span class="ov-number">${humanity.currentMax}</span>
          </div>
          <div class="ov-val">
            <span class="ov-label">${game.i18n.localize("CYBERWARE.Current")}</span>
            <span class="ov-number" style="color:${threshData.color}">${humanity.current}</span>
          </div>
          <div class="ov-val">
            <span class="ov-label">%</span>
            <span class="ov-number" style="color:${threshData.color}">${pct}%</span>
          </div>
        </div>
        <div class="manager-bar">
          <div class="bar-fill" style="width:${pct}%;background:${threshData.color}"></div>
        </div>
        <div class="manager-status" data-status="${threshKey}">
          ${threshData.label}
        </div>
      </div>

      <div class="cyberware-list">
        <h3>${game.i18n.localize("CYBERWARE.InstalledImplants")}</h3>
        <table class="cyberware-table">
          <thead>
            <tr>
              <th>${game.i18n.localize("CYBERWARE.Name")}</th>
              <th>${game.i18n.localize("CYBERWARE.Slot")}</th>
              <th>${game.i18n.localize("CYBERWARE.Cost")}</th>
              <th>${game.i18n.localize("CYBERWARE.Installed")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>`;

  new Dialog({
    title:   `${game.i18n.localize("CYBERWARE.HumanityManager")}: ${actor.name}`,
    content,
    buttons: {
      close: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Close")
      }
    },
    default: "close",
    render:  (html) => {
      html.find(".btn-install-item").on("click", async (e) => {
        const item = actor.items.get(e.currentTarget.dataset.itemId);
        if (!item) return;
        // Close the manager, then open install dialog
        html.closest(".app").find(".header-button.close").trigger("click");
        openInstallDialog(actor, item);
      });

      html.find(".btn-config-item").on("click", (e) => {
        const item = actor.items.get(e.currentTarget.dataset.itemId);
        if (item) openCyberwareConfig(item);
      });
    }
  }).render(true);
}
