import { MODULE_ID } from "./config.js";

export function getTemporaryTraits(actor) {
  return actor.flags?.[MODULE_ID]?.temporaryTraits ?? [];
}

export async function addTemporaryTrait(actor, { name, daysRemaining, source = "" }) {
  const traits = getTemporaryTraits(actor);
  const id = foundry.utils.randomID();
  const days = daysRemaining === null ? null : Number(daysRemaining);
  await actor.update({
    [`flags.${MODULE_ID}.temporaryTraits`]: [
      ...traits,
      { id, name, daysRemaining: days, totalDays: days, source, createdAt: new Date().toISOString() }
    ]
  });
  return id;
}

export async function removeTemporaryTrait(actor, traitId) {
  const traits = getTemporaryTraits(actor).filter(t => t.id !== traitId);
  await actor.update({ [`flags.${MODULE_ID}.temporaryTraits`]: traits });
}

export async function updateTemporaryTrait(actor, traitId, updates) {
  const traits = getTemporaryTraits(actor).map(t =>
    t.id === traitId ? { ...t, ...updates } : t
  );
  await actor.update({ [`flags.${MODULE_ID}.temporaryTraits`]: traits });
}

export function openAddTempTraitDialog(actor, prefillName = "", onDone = null) {
  const content = `
    <form class="temp-trait-form">
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.TempTrait.Name")}</label>
        <input type="text" name="name" value="${prefillName.replace(/"/g, "&quot;")}"
               placeholder="Nightmares [-5]" autofocus>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.TempTrait.Days")}</label>
        <div class="temp-trait-days-row">
          <input type="number" name="daysRemaining" value="6" min="1" max="999"
                 class="days-input" id="temp-days-input">
          <label class="checkbox perm-checkbox">
            <input type="checkbox" name="isPermanent" id="temp-perm-check">
            ${game.i18n.localize("CYBERWARE.TempTrait.Permanent")}
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.TempTrait.Source")}</label>
        <input type="text" name="source"
               placeholder="${game.i18n.localize("CYBERWARE.TempTrait.SourcePlaceholder")}">
      </div>
    </form>`;

  new Dialog({
    title:   game.i18n.localize("CYBERWARE.TempTrait.AddTitle"),
    content,
    buttons: {
      add: {
        icon:  '<i class="fas fa-plus"></i>',
        label: game.i18n.localize("CYBERWARE.TempTrait.Add"),
        callback: async (html) => {
          const form = html.find("form")[0];
          if (!form) return false;
          const fd   = new FormDataExtended(form).object;
          const name = (fd.name ?? "").trim();
          if (!name) {
            ui.notifications.warn(game.i18n.localize("CYBERWARE.TempTrait.NameRequired"));
            return false;
          }
          const days = fd.isPermanent ? null : (Number(fd.daysRemaining) || 6);
          await addTemporaryTrait(actor, { name, daysRemaining: days, source: fd.source ?? "" });
          if (onDone) onDone();
        }
      },
      cancel: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel")
      }
    },
    default: "add",
    render: (html) => {
      html.find("#temp-perm-check").on("change", function () {
        html.find(".days-input").prop("disabled", this.checked);
      });
    }
  }).render(true);
}

export function openEditTempTraitDialog(actor, trait, onDone = null) {
  const isPerm = trait.daysRemaining === null;
  const content = `
    <form class="temp-trait-form">
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.TempTrait.Name")}</label>
        <input type="text" name="name" value="${(trait.name ?? "").replace(/"/g, "&quot;")}">
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.TempTrait.Days")}</label>
        <div class="temp-trait-days-row">
          <input type="number" name="daysRemaining"
                 value="${trait.daysRemaining ?? 1}" min="1" max="999"
                 class="days-input" ${isPerm ? "disabled" : ""}>
          <label class="checkbox perm-checkbox">
            <input type="checkbox" name="isPermanent" ${isPerm ? "checked" : ""}>
            ${game.i18n.localize("CYBERWARE.TempTrait.Permanent")}
          </label>
        </div>
      </div>
      <div class="form-group">
        <label>${game.i18n.localize("CYBERWARE.TempTrait.Source")}</label>
        <input type="text" name="source" value="${(trait.source ?? "").replace(/"/g, "&quot;")}">
      </div>
    </form>`;

  new Dialog({
    title:   game.i18n.localize("CYBERWARE.TempTrait.EditTitle"),
    content,
    buttons: {
      save: {
        icon:  '<i class="fas fa-save"></i>',
        label: game.i18n.localize("CYBERWARE.TempTrait.Update"),
        callback: async (html) => {
          const form = html.find("form")[0];
          if (!form) return false;
          const fd   = new FormDataExtended(form).object;
          const name = (fd.name ?? "").trim();
          if (!name) {
            ui.notifications.warn(game.i18n.localize("CYBERWARE.TempTrait.NameRequired"));
            return false;
          }
          const days = fd.isPermanent ? null : (Number(fd.daysRemaining) || 1);
          await updateTemporaryTrait(actor, trait.id, { name, daysRemaining: days, source: fd.source ?? "" });
          if (onDone) onDone();
        }
      },
      cancel: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel")
      }
    },
    default: "save",
    render: (html) => {
      html.find("input[name=isPermanent]").on("change", function () {
        html.find(".days-input").prop("disabled", this.checked);
      });
    }
  }).render(true);
}
