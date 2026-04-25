import { MODULE_ID } from "./config.js";

const MACRO_DEFS = [
  {
    name: "Humanity: Therapy Recovery",
    img:  "icons/magic/holy/chalice-glowing-gold.webp",
    command: `// Humanity: Therapy Recovery (+1d6, capped at Current Max)
const actor = canvas.tokens?.controlled[0]?.actor
  ?? (game.user.character ? game.actors.get(game.user.character.id) : null);
if (!actor) { ui.notifications.warn("Select a token first."); return; }
const h = actor.flags["cyberware-humanity"]?.humanity;
if (!h) { ui.notifications.warn("No Humanity data on " + actor.name); return; }
const roll = await new Roll("1d6").evaluate();
await roll.toMessage({ flavor: "Therapy Recovery", speaker: ChatMessage.getSpeaker({ actor }) });
const newVal = Math.min(h.currentMax, h.current + roll.total);
await actor.update({ "flags.cyberware-humanity.humanity.current": newVal });
ui.notifications.info(actor.name + ": Humanity " + h.current + " → " + newVal + " (+" + roll.total + ")");`
  },
  {
    name: "Humanity: Heroism Recovery",
    img:  "icons/magic/life/heart-cross-strong-flame-red.webp",
    command: `// Humanity: Heroism Recovery (+1d3, capped at Current Max)
const actor = canvas.tokens?.controlled[0]?.actor
  ?? (game.user.character ? game.actors.get(game.user.character.id) : null);
if (!actor) { ui.notifications.warn("Select a token first."); return; }
const h = actor.flags["cyberware-humanity"]?.humanity;
if (!h) { ui.notifications.warn("No Humanity data on " + actor.name); return; }
const roll = await new Roll("1d3").evaluate();
await roll.toMessage({ flavor: "Humanity Recovery: Act of Heroism", speaker: ChatMessage.getSpeaker({ actor }) });
const newVal = Math.min(h.currentMax, h.current + roll.total);
await actor.update({ "flags.cyberware-humanity.humanity.current": newVal });
ui.notifications.info(actor.name + ": Humanity " + h.current + " → " + newVal + " (+" + roll.total + ")");`
  },
  {
    name: "Humanity: Status Report",
    img:  "icons/tools/navigation/compass-rose-blue-grey.webp",
    command: `// Humanity Status Report — posts all selected tokens to chat
const actors = (canvas.tokens?.controlled ?? []).map(t => t.actor).filter(Boolean);
if (!actors.length && game.user.character) actors.push(game.actors.get(game.user.character.id));
if (!actors.length) { ui.notifications.warn("Select at least one token."); return; }
const mid = "cyberware-humanity";
const threshColors = { human:"#00ff9f", detachment:"#ffed4e", dissociation:"#ff6600", prePsychosis:"#ff0040", cyberpsychosis:"#8B0000" };
function zone(cur, base) {
  if (base <= 0) return "cyberpsychosis";
  const p = (cur / base) * 100;
  if (p <= 0) return "cyberpsychosis"; if (p <= 25) return "prePsychosis";
  if (p <= 40) return "dissociation";  if (p <= 70) return "detachment";
  return "human";
}
const rows = actors.map(a => {
  const h = a.flags[mid]?.humanity;
  if (!h) return "<tr><td><strong>" + a.name + "</strong></td><td colspan='3'><em>no data</em></td></tr>";
  const pct = h.base > 0 ? Math.round((h.current / h.base) * 100) : 0;
  const z   = zone(h.current, h.base);
  const col = threshColors[z] ?? "#ccc";
  return "<tr><td><strong>" + a.name + "</strong></td>"
    + "<td style='text-align:center'>" + h.current + " / " + h.currentMax + " (" + h.base + ")</td>"
    + "<td style='text-align:center'>" + pct + "%</td>"
    + "<td style='color:" + col + ";font-weight:700;text-align:center'>" + z.toUpperCase() + "</td></tr>";
}).join("");
ChatMessage.create({
  content: "<table style='width:100%;font-size:12px'><thead><tr><th>Actor</th><th>Humanity</th><th>%</th><th>Zone</th></tr></thead><tbody>" + rows + "</tbody></table>",
  speaker: { alias: "Humanity System" }
});`
  },
  {
    name: "Humanity: Apply Damage",
    img:  "icons/magic/unholy/strike-body-explode-disintegrate.webp",
    command: `// Apply manual Humanity damage (20% hard / 80% stress split)
const actor = canvas.tokens?.controlled[0]?.actor
  ?? (game.user.character ? game.actors.get(game.user.character.id) : null);
if (!actor) { ui.notifications.warn("Select a token first."); return; }
const h = actor.flags["cyberware-humanity"]?.humanity;
if (!h) { ui.notifications.warn("No Humanity data on " + actor.name); return; }
const input = await Dialog.prompt({
  title: "Apply Humanity Damage",
  content: '<p>Humanity damage to apply to <strong>' + actor.name + '</strong>:</p>'
    + '<input type="number" id="hdmg" value="0" min="0" style="width:100%;font-size:16px;text-align:center">',
  callback: html => Number(html.find("#hdmg").val()),
  rejectClose: false
});
if (!input || input <= 0) return;
const hard       = Math.ceil(input * 0.20);
const newCurrent = Math.max(0, h.current - input);
const newMax     = Math.max(0, h.currentMax - hard);
await actor.update({
  "flags.cyberware-humanity.humanity.current":    newCurrent,
  "flags.cyberware-humanity.humanity.currentMax": newMax
});
ui.notifications.info(actor.name + ": Humanity " + h.current + "→" + newCurrent + " (max " + h.currentMax + "→" + newMax + ")");`
  },
  {
    name: "Humanity: Open Manager",
    img:  "icons/equipment/head/helm-barbute-steel-worn.webp",
    command: `// Open the Humanity Manager for the selected token's actor
const actor = canvas.tokens?.controlled[0]?.actor
  ?? (game.user.character ? game.actors.get(game.user.character.id) : null);
if (!actor) { ui.notifications.warn("Select a token first."); return; }
const mod = await import("/modules/cyberware-humanity/scripts/character-sheet-integration.js");
mod.openHumanityManager(actor);`
  }
];

export class MacroInstallerMenu extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id:    `${MODULE_ID}-macro-installer`,
      title: "Macro Installer"
    });
  }

  async render() {
    await installMacros();
    return this;
  }
}

export async function installMacros() {
  if (!game.user.isGM) {
    ui.notifications.warn(game.i18n.localize("CYBERWARE.PermissionDenied"));
    return;
  }
  const created = [];
  const skipped = [];

  for (const def of MACRO_DEFS) {
    if (game.macros.find(m => m.name === def.name)) {
      skipped.push(def.name);
    } else {
      await Macro.create({ name: def.name, type: "script", img: def.img, command: def.command.trim() });
      created.push(def.name);
    }
  }

  const parts = [];
  if (created.length) parts.push(`<p><strong>Created (${created.length}):</strong><br>${created.map(n => `• ${n}`).join("<br>")}</p>`);
  if (skipped.length) parts.push(`<p><strong>Already exist (${skipped.length}):</strong><br>${skipped.map(n => `• ${n}`).join("<br>")}</p>`);
  if (!parts.length)  parts.push("<p>Nothing to install.</p>");

  Dialog.prompt({
    title:   game.i18n.localize("CYBERWARE.Macros.ResultTitle"),
    content: parts.join(""),
    label:   "OK",
    rejectClose: false
  });
}
