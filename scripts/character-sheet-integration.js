import { MODULE_ID }                              from "./config.js";
import {
  getActorHumanity,
  getThresholdForValue, getThresholdData,
  ensureHumanityFlags
}                                                   from "./utils.js";
import { openInstallDialog }                        from "./installation.js";
import { markAsCyberware, openCyberwareConfig }     from "./cyberware.js";
import { uninstallImplant }                         from "./humanity.js";
import { checkThresholdCrossing }                   from "./thresholds.js";
import { canDo }                                    from "./permissions.js";
import {
  getTemporaryTraits,
  openAddTempTraitDialog,
  openEditTempTraitDialog,
  removeTemporaryTrait
}                                                   from "./temporary-traits.js";

// ── Manager dialog state ──────────────────────────────────────────────────────

let _managerActor  = null;
let _managerDialog = null;

function _refreshManager() {
  if (!_managerActor) return;
  const actor = game.actors.get(_managerActor.id);
  if (!actor) return;
  if (_managerDialog?.rendered) _managerDialog.close();
  openHumanityManager(actor);
}

// ── Hook registration ────────────────────────────────────────────────────────

export function registerCharacterSheetHooks() {
  Hooks.on("renderActorSheet", onRenderActorSheet);
  // NOTE: updateActor handled solely in main.js to avoid duplicate notifications.
}

// ── Sheet render hook ────────────────────────────────────────────────────────

async function onRenderActorSheet(app, html, _data) {
  const actor = app.actor;
  if (!actor || actor.type !== "character") return;

  if (game.settings.get(MODULE_ID, "autoInitializeHumanity") && actor.isOwner) {
    const initialised = await ensureHumanityFlags(actor);
    if (initialised) return;
  }

  const humanity = getActorHumanity(actor);
  if (!humanity) return;

  injectHumanityTrack(html, actor, humanity);
  injectTempTraitButtons(html, actor);
  injectEquipmentButtons(html, actor);
}

// ── Track injection ──────────────────────────────────────────────────────────

function injectHumanityTrack(html, actor, humanity) {
  html.find(".humanity-track").remove();

  const base       = humanity.base;
  const current    = humanity.current;
  const currentMax = humanity.currentMax;
  const pct        = base > 0 ? Math.min(100, (current    / base) * 100) : 0;
  const maxPct     = base > 0 ? Math.min(100, (currentMax / base) * 100) : 0;
  const threshKey  = getThresholdForValue(current, base);
  const threshData = getThresholdData(threshKey);
  const color      = threshData.color;

  const canEdit = actor.isOwner && canDo("permEditHumanity");
  const trackHtml = buildTrackHtml({ current, currentMax, base, pct, maxPct, threshKey, color, actorId: actor.id, canEdit });

  let inserted = false;
  const isModern = html.find(".modern-sheet").length > 0;

  if (isModern) {
    const secStats = html.find(".ms-secondary-stats").first();
    if (secStats.length) { secStats.after(trackHtml); inserted = true; }
    if (!inserted) {
      const res = html.find(".ms-resources").first();
      if (res.length) { res.append(trackHtml); inserted = true; }
    }
  } else {
    const hpfp = html.find("#hp-fp").first();
    if (hpfp.length) { hpfp.after(trackHtml); inserted = true; }
    if (!inserted) {
      const stats = html.find("#stats").first();
      if (stats.length) { stats.append(trackHtml); inserted = true; }
    }
  }

  if (!inserted) {
    html.find(".sheet-body, .window-content, form").first().prepend(trackHtml);
  }

  html.find(".humanity-track").css("--humanity-color", color);
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

  const markers = [
    { pct: 70, key: "detachment" },
    { pct: 40, key: "dissociation" },
    { pct: 25, key: "prePsychosis" }
  ].map(m =>
    `<div class="threshold-marker" style="left:${m.pct}%" title="${game.i18n.localize(`CYBERWARE.Threshold.${m.key}`)}"></div>`
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
        <span class="status-text">${game.i18n.localize(threshData.label)}</span>
      </div>
    </div>`;
}

// ── Temp-trait clock buttons injected into the GURPS sheet trait rows ─────────
// Targets the most common GURPS trait-list selectors for Classic GCS and Modern.

function injectTempTraitButtons(html, actor) {
  const traits = getTemporaryTraits(actor);

  // Selectors that map to individual trait name elements in GURPS sheets.
  // We look for the parent <li> or row element and append the button there.
  const rowSelectors = [
    // Classic GCS sheet
    "#ads li",  "#disads li",  "#quirks li",
    // Modern sheet
    ".adv-item", ".disadv-item", ".perk-item", ".quirk-item"
  ];

  for (const sel of rowSelectors) {
    html.find(sel).each(function () {
      const row      = $(this);
      // Avoid double-injection if sheet re-renders partially
      if (row.find(".btn-temp-trait-toggle").length) return;

      // Grab name from the first text-bearing child only; skip rows with no clear name.
      const nameEl  = row.find(".item-name, .adv-name, .name").first();
      const rawName = nameEl.text().trim().replace(/\s+/g, " ");
      if (!rawName) return;

      const existingTrait = traits.find(t => t.name === rawName);
      const isTemp        = Boolean(existingTrait);
      const title         = isTemp
        ? game.i18n.localize("CYBERWARE.TempTrait.EditTooltip")
        : game.i18n.localize("CYBERWARE.TempTrait.AddTooltip");

      let timerDisplay = "";
      if (isTemp && existingTrait) {
        if (existingTrait.daysRemaining === null) {
          timerDisplay = `<span class="cyber-timer-value perm">∞</span>`;
        } else if (existingTrait.daysRemaining <= 0) {
          timerDisplay = `<span class="cyber-timer-value expired">!</span>`;
        } else {
          timerDisplay = `<span class="cyber-timer-value">${existingTrait.daysRemaining}d</span>`;
        }
      }

      const wrap = $(`
        <span class="cyber-trait-timer${isTemp ? " is-tracked" : ""}">
          <button class="btn-temp-trait-toggle${isTemp ? " is-temp" : ""}"
                  type="button"
                  title="${title}"
                  data-trait-name="${rawName.replace(/"/g, "&quot;")}">
            <i class="fas fa-clock"></i>
          </button>
          ${timerDisplay}
        </span>`);

      row.append(wrap);

      wrap.find(".btn-temp-trait-toggle").on("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (existingTrait) {
          openEditTempTraitDialog(actor, existingTrait, _refreshManager);
        } else {
          openAddTempTraitDialog(actor, rawName, _refreshManager);
        }
      });
    });
  }
}

// ── Equipment list cyberware buttons ────────────────────────────────────────

function injectEquipmentButtons(html, actor) {
  // Selectors covering Classic GCS and Modern GURPS sheet equipment rows
  const rowSelectors = [
    "#equipment tbody tr",
    "#carried-equipment tbody tr",
    "#other-equipment tbody tr",
    "table.eqtable tbody tr",
    ".equipment-item",
    ".eqt-item",
    "[data-item-id]"
  ];

  for (const sel of rowSelectors) {
    html.find(sel).each(function () {
      const row = $(this);
      if (row.find(".btn-mark-equipment").length) return;

      // Try data-item-id first (modern sheet), then name matching (classic)
      let item = null;
      const itemId = row.data("item-id") ?? row.data("itemId");
      if (itemId) {
        item = actor.items.get(String(itemId));
      } else {
        const nameEl  = row.find(".eqt-name, .item-name, td:nth-child(2)").first();
        const rawName = nameEl.text().trim().replace(/\s+/g, " ").split("\n")[0];
        if (!rawName) return;
        item = actor.items.find(i => i.name === rawName);
      }

      if (!item) return;

      const isCyber = Boolean(item.flags?.[MODULE_ID]?.isCyberware);
      const title   = isCyber
        ? game.i18n.localize("CYBERWARE.ConfigureCyberware")
        : game.i18n.localize("CYBERWARE.MarkAsCyberware");

      const btn = $(`
        <button class="btn-mark-equipment${isCyber ? " is-cyber" : ""}"
                type="button"
                data-item-id="${item.id}"
                title="${title}">
          <i class="fas ${isCyber ? "fa-cog" : "fa-robot"}"></i>
        </button>`);

      // Insert after the name cell, or append to row
      const nameCell = row.find(".eqt-name, .item-name, td:nth-child(2)").first();
      if (nameCell.length) {
        nameCell.append(btn);
      } else {
        row.append(btn);
      }

      btn.on("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isCyber) {
          if (!canDo("permConfigCyberware")) {
            ui.notifications.warn(game.i18n.localize("CYBERWARE.PermissionDenied"));
            return;
          }
          openCyberwareConfig(item);
        } else {
          if (!canDo("permMarkCyberware")) {
            ui.notifications.warn(game.i18n.localize("CYBERWARE.PermissionDenied"));
            return;
          }
          await markAsCyberware(item);
        }
      });
    });
  }
}

// ── Track event wiring ───────────────────────────────────────────────────────

function wireTrackEvents(html, actor) {
  html.find(".btn-open-humanity-manager").on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openHumanityManager(actor);
  });

  html.find(".humanity-track .resource-input").on("change", async (e) => {
    if (!canDo("permEditHumanity")) return;
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

// ── Humanity Manager dialog ──────────────────────────────────────────────────

export function openHumanityManager(actor) {
  const humanity = getActorHumanity(actor);
  if (!humanity) {
    ui.notifications.error(game.i18n.localize("CYBERWARE.NoHumanityData"));
    return;
  }

  if (_managerDialog?.rendered) _managerDialog.close();
  _managerActor = actor;

  const cyberItems  = actor.items.filter(i => i.flags?.[MODULE_ID]?.isCyberware);
  const base        = humanity.base;
  const pct         = base > 0 ? Math.round((humanity.current / base) * 100) : 0;
  const threshKey   = getThresholdForValue(humanity.current, base);
  const threshData  = getThresholdData(threshKey);
  const canInstall  = canDo("permInstallImplant");

  // ── Overview ────────────────────────────────────────────────────────────────
  const overviewHtml = `
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
      </div>
      <div class="manager-bar-row">
        <div class="manager-bar">
          <div class="bar-fill" style="width:${pct}%;background:${threshData.color}"></div>
          <div class="manager-thresh-markers">
            <span class="mgr-marker" style="left:70%"
                  title="${game.i18n.localize("CYBERWARE.Threshold.detachment")}"></span>
            <span class="mgr-marker" style="left:40%"
                  title="${game.i18n.localize("CYBERWARE.Threshold.dissociation")}"></span>
            <span class="mgr-marker" style="left:25%"
                  title="${game.i18n.localize("CYBERWARE.Threshold.prePsychosis")}"></span>
          </div>
        </div>
        <span class="manager-pct" style="color:${threshData.color}">${pct}%</span>
      </div>
      <div class="manager-thresh-labels">
        <span class="mgr-label" style="left:70%">${game.i18n.localize("CYBERWARE.Threshold.detachment")}</span>
        <span class="mgr-label" style="left:40%">${game.i18n.localize("CYBERWARE.Threshold.dissociation")}</span>
        <span class="mgr-label" style="left:25%">${game.i18n.localize("CYBERWARE.Threshold.prePsychosis")}</span>
      </div>
      <div class="manager-status" data-status="${threshKey}">${game.i18n.localize(threshData.label)}</div>
    </div>`;

  // ── Cyberware table ──────────────────────────────────────────────────────────
  const cyberRowsHtml = cyberItems.length
    ? cyberItems.map(item => {
        const cd        = item.flags[MODULE_ID].cyberData;
        const slotLabel = game.i18n.localize(`CYBERWARE.Slot.${cd.slot}`);
        const installBtn = !cd.installed
          ? `<button class="btn-install-item" data-item-id="${item.id}" type="button"
                     title="${game.i18n.localize("CYBERWARE.Install")}" ${canInstall ? "" : "disabled"}>
               <i class="fas fa-plug"></i>
             </button>`
          : `<button class="btn-uninstall-item" data-item-id="${item.id}" type="button"
                     title="${game.i18n.localize("CYBERWARE.Uninstall")}" ${canInstall ? "" : "disabled"}>
               <i class="fas fa-eject"></i>
             </button>`;
        return `
          <tr class="cyberware-row ${cd.installed ? "installed" : "uninstalled"}">
            <td>${item.name}</td>
            <td>${slotLabel}</td>
            <td>${cd.humanityCostDice}</td>
            <td class="text-center">${cd.installed ? "✓" : "—"}</td>
            <td class="row-actions">
              ${installBtn}
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

  const cyberTableHtml = `
    <div class="cyberware-list">
      <h3>${game.i18n.localize("CYBERWARE.InstalledImplants")}</h3>
      <table class="cyberware-table">
        <thead>
          <tr>
            <th>${game.i18n.localize("CYBERWARE.Name")}</th>
            <th>${game.i18n.localize("CYBERWARE.SlotLabel")}</th>
            <th>${game.i18n.localize("CYBERWARE.Cost")}</th>
            <th>${game.i18n.localize("CYBERWARE.Installed")}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>${cyberRowsHtml}</tbody>
      </table>
    </div>`;

  const content = `
    <div class="humanity-manager">
      ${overviewHtml}
      ${cyberTableHtml}
    </div>`;

  _managerDialog = new Dialog({
    title:   `${game.i18n.localize("CYBERWARE.HumanityManager")}: ${actor.name}`,
    content,
    buttons: {
      close: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Close") || "Закрыть"
      }
    },
    default: "close",
    render: (dialogHtml) => _wireManagerEvents(dialogHtml, actor)
  });

  _managerDialog.render(true);
}

// ── Manager event wiring ─────────────────────────────────────────────────────

function _wireManagerEvents(html, actor) {
  // Cyberware table buttons
  html.find(".btn-install-item").on("click", async (e) => {
    if (!canDo("permInstallImplant")) {
      ui.notifications.warn(game.i18n.localize("CYBERWARE.PermissionDenied"));
      return;
    }
    const item = actor.items.get(e.currentTarget.dataset.itemId);
    if (!item) return;
    if (_managerDialog?.rendered) _managerDialog.close();
    openInstallDialog(actor, item);
  });

  html.find(".btn-uninstall-item").on("click", async (e) => {
    if (!canDo("permInstallImplant")) {
      ui.notifications.warn(game.i18n.localize("CYBERWARE.PermissionDenied"));
      return;
    }
    const item      = actor.items.get(e.currentTarget.dataset.itemId);
    if (!item) return;
    const hardPaid  = item.flags?.[MODULE_ID]?.cyberData?.installData?.hardCostPaid ?? 0;
    const restoreLabel = hardPaid > 0
      ? game.i18n.format("CYBERWARE.UninstallRestoreOption", { hard: hardPaid })
      : game.i18n.localize("CYBERWARE.UninstallNoHardCost");

    const choice = await _uninstallDialog(item.name, actor.name, restoreLabel, hardPaid > 0);
    if (choice === null) return; // cancelled

    await uninstallImplant(actor, item, choice === "restore");
    _refreshManager();
  });

  html.find(".btn-config-item").on("click", (e) => {
    const item = actor.items.get(e.currentTarget.dataset.itemId);
    if (item) openCyberwareConfig(item);
  });
}

// ── Uninstall choice dialog ───────────────────────────────────────────────────

function _uninstallDialog(implantName, actorName, restoreLabel, canRestore) {
  return new Promise((resolve) => {
    const buttons = {
      cancel: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel"),
        callback: () => resolve(null)
      }
    };

    if (canRestore) {
      buttons.restore = {
        icon:  '<i class="fas fa-undo"></i>',
        label: game.i18n.localize("CYBERWARE.UninstallAndRestore"),
        callback: () => resolve("restore")
      };
      buttons.noRestore = {
        icon:  '<i class="fas fa-eject"></i>',
        label: game.i18n.localize("CYBERWARE.UninstallOnly"),
        callback: () => resolve("noRestore")
      };
    } else {
      buttons.confirm = {
        icon:  '<i class="fas fa-eject"></i>',
        label: game.i18n.localize("CYBERWARE.Uninstall"),
        callback: () => resolve("noRestore")
      };
    }

    new Dialog({
      title:   game.i18n.localize("CYBERWARE.UninstallTitle"),
      content: `
        <div class="uninstall-dialog">
          <p>${game.i18n.format("CYBERWARE.UninstallConfirm", { name: implantName, actor: actorName })}</p>
          <p class="restore-hint"><em>${restoreLabel}</em></p>
        </div>`,
      buttons,
      default: canRestore ? "restore" : "confirm",
      close:   () => resolve(null)
    }).render(true);
  });
}
