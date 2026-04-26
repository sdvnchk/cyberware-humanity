import { MODULE_ID, DEFAULT_CYBER_DATA, CYBERWARE_SLOTS, CYBERWARE_CATEGORIES, CRAFT_QUALITY } from "./config.js";

export async function markAsCyberware(item) {
  await item.update({
    [`flags.${MODULE_ID}.isCyberware`]: true,
    [`flags.${MODULE_ID}.cyberData`]:   { ...DEFAULT_CYBER_DATA }
  });
  ui.notifications.info(
    game.i18n.format("CYBERWARE.MarkedAsCyberware", { name: item.name })
  );
}

export async function openCyberwareConfig(item) {
  const data = item.flags?.[MODULE_ID]?.cyberData ?? { ...DEFAULT_CYBER_DATA };

  const slotOptions = CYBERWARE_SLOTS.map(s =>
    `<option value="${s}" ${data.slot === s ? "selected" : ""}>
       ${game.i18n.localize(`CYBERWARE.Slot.${s}`)}
     </option>`
  ).join("");

  const categoryOptions = CYBERWARE_CATEGORIES.map(c =>
    `<option value="${c}" ${data.category === c ? "selected" : ""}>
       ${game.i18n.localize(`CYBERWARE.Category.${c}`)}
     </option>`
  ).join("");

  const qualityOptions = Object.entries(CRAFT_QUALITY).map(([k, v]) => {
    const modStr = v.malfunctionMod !== 0
      ? `, ${v.malfunctionMod > 0 ? "+" : ""}${v.malfunctionMod} malf`
      : "";
    return `<option value="${k}" ${data.craftQuality === k ? "selected" : ""}>
              ${game.i18n.localize(v.label)} (×${v.costMult}${modStr})
            </option>`;
  }).join("");

  const content = `
    <form class="cyberware-config-form">
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.CategoryLabel")}</label>
        <select name="category">${categoryOptions}</select>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.SlotLabel")}</label>
        <select name="slot">${slotOptions}</select>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.HumanityCostDice")}</label>
        <div class="form-fields">
          <input type="text" name="humanityCostDice" value="${data.humanityCostDice}" placeholder="2d6">
        </div>
        <p class="hint">${game.i18n.localize("CYBERWARE.HumanityCostDiceHint")}</p>
      </div>

      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.CraftQualityLabel")}</label>
        <select name="craftQuality">${qualityOptions}</select>
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="malfunctionEnabled" ${data.malfunction?.enabled ? "checked" : ""}>
          ${game.i18n.localize("CYBERWARE.CanMalfunction")}
        </label>
        <div class="form-fields">
          <input type="number" name="malfunctionThreshold"
                 value="${data.malfunction?.threshold ?? 6}" min="3" max="18">
        </div>
        <p class="hint">${game.i18n.localize("CYBERWARE.MalfunctionHint")}</p>
      </div>

      <div class="form-group">
        <label class="checkbox">
          <input type="checkbox" name="maintenanceRequired" ${data.maintenance?.required ? "checked" : ""}>
          ${game.i18n.localize("CYBERWARE.RequiresMaintenance")}
        </label>
        <div class="form-fields">
          <input type="number" name="maintenanceCost"
                 value="${data.maintenance?.cost ?? 300}" min="0">
        </div>
        <p class="hint">${game.i18n.localize("CYBERWARE.MaintenanceCostHint")}</p>
      </div>
    </form>`;

  new Dialog({
    title: `${game.i18n.localize("CYBERWARE.ConfigureTitle")}: ${item.name}`,
    content,
    buttons: {
      save: {
        icon:  '<i class="fas fa-save"></i>',
        label: game.i18n.localize("CYBERWARE.Save"),
        callback: async (html) => {
          const form = html.find("form")[0];
          if (!form) return false;
          const fd = new FormDataExtended(form).object;
          await item.update({
            [`flags.${MODULE_ID}.cyberData`]: {
              ...data,
              category:          fd.category,
              slot:              fd.slot,
              humanityCostDice:  fd.humanityCostDice,
              craftQuality:      fd.craftQuality,
              malfunction: {
                enabled:   Boolean(fd.malfunctionEnabled),
                threshold: Number(fd.malfunctionThreshold)
              },
              maintenance: {
                required: Boolean(fd.maintenanceRequired),
                cost:     Number(fd.maintenanceCost)
              }
            }
          });
          ui.notifications.info(
            game.i18n.format("CYBERWARE.ConfigSaved", { name: item.name })
          );
        }
      },
      cancel: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel")
      }
    },
    default: "save"
  }).render(true);
}
