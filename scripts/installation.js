import { MODULE_ID } from "./config.js";
import { getActorHumanity, getWillValue } from "./utils.js";
import { getAdaptationOutcome, applyInstallation } from "./humanity.js";

export async function openInstallDialog(actor, implant) {
  const humanity  = getActorHumanity(actor);
  const cyberData = implant.flags?.[MODULE_ID]?.cyberData;

  if (!humanity) {
    ui.notifications.error(game.i18n.localize("CYBERWARE.NoHumanityData"));
    return;
  }
  if (!cyberData) {
    ui.notifications.error(game.i18n.localize("CYBERWARE.NotCyberware"));
    return;
  }

  const will = getWillValue(actor);
  let rolledCost       = null;
  let adaptationResult = null;

  const content = `
    <div class="install-dialog">
      <div class="install-summary">
        <h3>${implant.name}</h3>
        <div class="stats-row">
          <span>${game.i18n.localize("CYBERWARE.CostDice")}:
            <strong>${cyberData.humanityCostDice}</strong>
          </span>
          <span>${game.i18n.localize("CYBERWARE.WillValue")}:
            <strong>${will}</strong>
          </span>
        </div>
        <div class="humanity-preview">
          <span>${game.i18n.localize("CYBERWARE.CurrentHumanity")}:
            <strong>${humanity.current} / ${humanity.currentMax} (${humanity.base})</strong>
          </span>
        </div>
      </div>

      <div class="install-steps">
        <div class="step step-1">
          <h4>${game.i18n.localize("CYBERWARE.Step1RollCost")}</h4>
          <button class="btn-roll-cost" type="button">
            <i class="fas fa-dice"></i> ${game.i18n.localize("CYBERWARE.RollCost")}
          </button>
          <div class="cost-result" style="display:none"></div>
        </div>

        <div class="step step-2">
          <h4>${game.i18n.localize("CYBERWARE.Step2RollAdaptation")}</h4>
          <button class="btn-roll-adaptation" type="button">
            <i class="fas fa-brain"></i> ${game.i18n.localize("CYBERWARE.RollAdaptation")}
          </button>
          <div class="adaptation-result" style="display:none"></div>
        </div>

        <div class="step step-3">
          <h4>${game.i18n.localize("CYBERWARE.Step3Apply")}</h4>
          <div class="final-preview" style="display:none"></div>
        </div>
      </div>
    </div>`;

  new Dialog({
    title:   `${game.i18n.localize("CYBERWARE.Install")}: ${implant.name}`,
    content,
    buttons: {
      apply: {
        icon:  '<i class="fas fa-check"></i>',
        label: game.i18n.localize("CYBERWARE.ApplyInstallation"),
        callback: async () => {
          if (!rolledCost || !adaptationResult) {
            ui.notifications.warn(game.i18n.localize("CYBERWARE.RollFirst"));
            return false;
          }

          // Re-read humanity at confirm time to get the freshest values
          const liveHumanity = getActorHumanity(actor) ?? humanity;

          const confirmed = await Dialog.confirm({
            title:   game.i18n.localize("CYBERWARE.ConfirmInstall"),
            content: buildConfirmContent(actor, liveHumanity, rolledCost, adaptationResult)
          });
          if (!confirmed) return false;

          await applyInstallation(actor, implant, rolledCost, adaptationResult);
        }
      },
      cancel: {
        icon:  '<i class="fas fa-times"></i>',
        label: game.i18n.localize("Cancel")
      }
    },
    default: "apply",
    render:  (html) => {
      wireInstallHandlers(html, actor, implant, cyberData, will,
        (cost)  => {
          rolledCost       = cost;
          refreshFinalPreview(html, getActorHumanity(actor) ?? humanity, rolledCost, adaptationResult);
        },
        (adapt) => {
          adaptationResult = adapt;
          refreshFinalPreview(html, getActorHumanity(actor) ?? humanity, rolledCost, adaptationResult);
        }
      );
    }
  }).render(true);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildConfirmContent(actor, humanity, cost, adaptation) {
  const actualCost = resolveActualCost(cost, adaptation);
  const hardCost   = Math.ceil(actualCost * 0.20);
  return `
    <div class="confirm-install">
      <p>${game.i18n.format("CYBERWARE.ConfirmApply", { name: actor.name })}</p>
      <ul>
        <li>${game.i18n.localize("CYBERWARE.CurrentHumanity")}:
          ${humanity.current} → <strong>${Math.max(0, humanity.current - actualCost)}</strong>
        </li>
        <li>${game.i18n.localize("CYBERWARE.MaxHumanity")}:
          ${humanity.currentMax} → <strong>${Math.max(0, humanity.currentMax - hardCost)}</strong>
        </li>
      </ul>
      <p><em>${game.i18n.localize("CYBERWARE.CanAdjustLater")}</em></p>
    </div>`;
}

function refreshFinalPreview(html, humanity, cost, adaptation) {
  if (!cost || !adaptation) return;

  const actualCost = resolveActualCost(cost, adaptation);
  const hardCost   = Math.ceil(actualCost * 0.20);

  html.find(".final-preview").html(`
    <div class="preview-values">
      <div>${game.i18n.localize("CYBERWARE.CurrentHumanity")}:
        ${humanity.current} → <strong>${Math.max(0, humanity.current - actualCost)}</strong>
      </div>
      <div>${game.i18n.localize("CYBERWARE.MaxHumanity")}:
        ${humanity.currentMax} → <strong>${Math.max(0, humanity.currentMax - hardCost)}</strong>
      </div>
      <div class="breakdown">
        ${game.i18n.localize("CYBERWARE.Hard")}: ${hardCost} |
        ${game.i18n.localize("CYBERWARE.Stress")}: ${actualCost - hardCost}
      </div>
    </div>`
  ).show();
}

function resolveActualCost(cost, adaptation) {
  if (adaptation.outcome === "critical_success") return cost.minPossible ?? cost.total;
  if (adaptation.outcome === "critical_failure")  return cost.maxPossible ?? cost.total;
  return cost.total;
}

function wireInstallHandlers(html, actor, implant, cyberData, will, onCostRolled, onAdaptRolled) {
  html.find(".btn-roll-cost").on("click", async (e) => {
    e.preventDefault();
    const roll = await new Roll(cyberData.humanityCostDice).evaluate();

    // Derive min/max from Die terms so critical outcomes can use them
    const diceTerms   = roll.terms.filter(t => t.constructor.name === "Die");
    const minPossible = roll.total - diceTerms.reduce((s, d) => s + (d.total - d.number), 0);
    const maxPossible = roll.total + diceTerms.reduce((s, d) => s + (d.number * d.faces - d.total), 0);

    const hard   = Math.ceil(roll.total * 0.20);
    const stress = roll.total - hard;
    const cost   = { total: roll.total, hard, stress, minPossible, maxPossible };

    html.find(".cost-result").html(`
      <div class="roll-result">
        <span class="total">${game.i18n.localize("CYBERWARE.Total")}: <strong>${roll.total}</strong></span>
        <span class="hard">${game.i18n.localize("CYBERWARE.Hard")}: <strong>${hard}</strong></span>
        <span class="stress">${game.i18n.localize("CYBERWARE.Stress")}: <strong>${stress}</strong></span>
      </div>`
    ).show();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  game.i18n.format("CYBERWARE.HumanityCostFlavor", { name: implant.name })
    });

    onCostRolled(cost);
  });

  html.find(".btn-roll-adaptation").on("click", async (e) => {
    e.preventDefault();
    const roll    = await new Roll("3d6").evaluate();
    const outcome = getAdaptationOutcome(roll.total, will);

    const labels = {
      critical_success: `✅ ${game.i18n.localize("CYBERWARE.CritSuccess")}`,
      success:          `✅ ${game.i18n.localize("CYBERWARE.Success")}`,
      failure:          `❌ ${game.i18n.localize("CYBERWARE.Failure")}`,
      critical_failure: `💀 ${game.i18n.localize("CYBERWARE.CritFailure")}`
    };

    html.find(".adaptation-result").html(`
      <div class="roll-result outcome-${outcome}">
        <span>${game.i18n.localize("CYBERWARE.Roll")}: ${roll.total}
          vs ${game.i18n.localize("CYBERWARE.Will")} ${will}</span>
        <span class="outcome-label"><strong>${labels[outcome]}</strong></span>
      </div>`
    ).show();

    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor:  game.i18n.format("CYBERWARE.AdaptationFlavor", { name: implant.name })
    });

    onAdaptRolled({ roll: roll.total, outcome });
  });
}
