# Cyberware & Humanity Manager

**Foundry VTT module for GURPS 4e Cyberpunk campaigns.**

Tracks the three-value Humanity system (Base / Max / Current), provides a step-by-step cyberware installation workflow with dice rolls, and notifies the GM when a character crosses a degradation threshold — all without forcing automation. The GM and players stay in control; the module handles the math and the reminders.

---

## Requirements

| Dependency | Required | Notes |
|---|---|---|
| Foundry VTT | v12+ | Verified on v13 |
| GURPS 4e system (`gurps`) | ✅ Required | v0.17+ (crnormand/gurps) |
| Calendaria | ☐ Optional | Auto-counts down temporary trait durations |
| Simple Calendar | ☐ Optional | Alternative to Calendaria for the same feature |

---

## Installation

**Method 1 — Manifest URL** (recommended)

In Foundry → *Add-on Modules* → *Install Module*, paste:
```
https://raw.githubusercontent.com/sdvnchk/gurps-humanity/main/module.json
```

**Method 2 — Manual**

Download the latest `module.zip` from [Releases](https://github.com/sdvnchk/gurps-humanity/releases), extract into your `Data/modules/cyberware-humanity/` folder, and restart Foundry.

---

## Module settings

Open *Game Settings → Module Settings → Cyberware & Humanity Manager*:

| Setting | Default | Description |
|---|---|---|
| Auto-Initialize Humanity | ON | Creates Humanity flags (Will × 5) automatically when a character sheet is first opened |
| Enable Calendar Integration | OFF | Tracks temporary-trait countdowns via Calendaria or Simple Calendar |

---

## For Players

### Understanding your three Humanity values

Your character sheet gets a **HUMANITY** widget injected below the HP/FP block:

```
HUMANITY            ⚙
  36  /  48  /  50
  ████████░░░░░░░░
  ⚠️ Detachment
```

| Value | What it is |
|---|---|
| **Current** (left) | Your Humanity right now |
| **Current Max** (middle) | Maximum your Humanity can recover to; reduced permanently by cyberware |
| **Base** (right, read-only) | Will × 5; never changes unless your Will changes |

You can edit Current and Current Max directly by clicking the numbers.

### Humanity thresholds

| Humanity | Zone | Description |
|---|---|---|
| > 70% of Base | 🟢 Human | You're still fully yourself |
| 40–70% | ⚠️ Detachment | Emotional distance; GM may assign negative traits |
| 25–39% | 🟠 Dissociation | Reality feels thin; GM assigns traits |
| 1–24% | 🔴 Pre-Psychosis | Dangerous territory |
| 0% | 💀 CYBERPSYCHOSIS | Character becomes an NPC |

The widget colour and status label update automatically as your Humanity changes.

### How to restore Humanity

All recovery is manual — update the **Current** value directly:

| Source | Recovery |
|---|---|
| Therapy session (1 week) | +1d6 |
| Act of genuine heroism | +1d3 |
| Downtime / rest | GM's discretion |
| Removing an implant | Restore the Hard Cost of that implant to Current Max |

---

## For the GM

### Marking a piece of equipment as Cyberware

1. Open the item sheet for any equipment.
2. Click the **🤖 Mark as Cyberware** button in the title bar.
3. Click it again (now labelled **⚙ Cyberware**) to open the configuration dialog.

**Configuration options:**

| Field | Description |
|---|---|
| Category | Combat / Utility / Neural / Sensory / Medical |
| Slot | Body location (Frontal Cortex, Eyes, Arms, etc.) |
| Humanity Cost (dice) | Dice expression — `1d6`, `2d6`, `1d6-2`, etc. |
| Craft Quality | Affects malfunction threshold (Street ×0.5 to Prototype ×15) |
| Can Malfunction | Toggle + base threshold for malfunction rolls (3d6 ≤ X) |
| Requires Maintenance | Toggle + monthly cost |

### Installing an implant

1. Open the character's **Humanity Manager** (⚙ button on the Humanity widget).
2. Click **🔌** next to the implant you want to install.
3. The installation dialog opens:

**Step 1 — Roll Humanity Cost**
Click *Roll Cost* to roll the item's cost dice (e.g. `2d6`).
The result is split: **20% Hard** (permanent — reduces Current Max) and **80% Stress** (temporary).

**Step 2 — Roll Adaptation (3d6 vs Will)**

| Outcome | Effect |
|---|---|
| Critical Success (≤ 4, or Will−10) | Use the *minimum* possible cost |
| Success (≤ Will) | Use the rolled cost |
| Failure (> Will) | Use the rolled cost + GM assigns a **temporary** negative trait (1d6 days) |
| Critical Failure (≥ 17, or Will+10) | Use the *maximum* possible cost + GM assigns a **permanent** negative trait |

**Step 3 — Apply Changes**
Click *Apply Changes*. A confirmation dialog shows the exact delta before you commit. You can cancel and adjust manually at any time.

### Threshold crossing notifications

When a character's Humanity crosses a threshold (in either direction), the module sends a **whisper to all GMs** with:
- The new zone name and colour
- A list of suggested negative traits (for worsening transitions)
- Direction indicator (⬇️ worsening / ⬆️ recovering)

The GM decides which traits, if any, to actually assign.

### Craft Quality quick reference

| Quality | Cost × | Malfunction mod |
|---|---|---|
| Street Grade | ×0.5 | +4 |
| Cheap | ×0.75 | +2 |
| Standard | ×1.0 | — |
| Fine | ×4.0 | −2 |
| Military | ×6.0 | −3 |
| Very Fine | ×10 | −4 |
| Prototype | ×15 | +3 |

*Cost multipliers are shown for reference — pricing is handled manually.*

### Calendar integration (optional)

Enable *Calendar Integration* in module settings. When the in-game date advances (via Calendaria or Simple Calendar), temporary traits on all characters automatically have their remaining days decremented. A notification appears when a trait expires so the GM can remove it manually.

---

## Console API

Open the browser console (`F12`) in any Foundry game where this module is active.

### Read a character's Humanity

```js
// By actor name
const actor = game.actors.getName("Jax Ryder");
const h = actor.flags["cyberware-humanity"].humanity;
console.log(h); // { base: 50, currentMax: 44, current: 36 }
```

### Manually set Humanity values

```js
const actor = game.actors.getName("Jax Ryder");

// Set current value only
await actor.update({ "flags.cyberware-humanity.humanity.current": 30 });

// Set all three at once
await actor.update({
  "flags.cyberware-humanity.humanity.current":    30,
  "flags.cyberware-humanity.humanity.currentMax": 44,
  "flags.cyberware-humanity.humanity.base":       50
});
```

### Initialize Humanity manually (bypassing Auto-Init)

```js
const actor = game.actors.getName("Jax Ryder");
const will  = actor.system.attributes.WILL.value; // e.g. 10
const base  = will * 5;                            // 50

await actor.update({
  "flags.cyberware-humanity.humanity": { base, currentMax: base, current: base }
});
```

### Apply Humanity damage directly

```js
const actor  = game.actors.getName("Jax Ryder");
const h      = actor.flags["cyberware-humanity"].humanity;
const damage = 8;   // total cost of the implant
const hard   = Math.ceil(damage * 0.20);  // 2 — permanent

await actor.update({
  "flags.cyberware-humanity.humanity.current":    Math.max(0, h.current    - damage),
  "flags.cyberware-humanity.humanity.currentMax": Math.max(0, h.currentMax - hard)
});
```

### Restore Humanity (therapy)

```js
const actor = game.actors.getName("Jax Ryder");
const h     = actor.flags["cyberware-humanity"].humanity;
const roll  = await new Roll("1d6").evaluate();
await roll.toMessage({ flavor: "Therapy recovery" });

const newCurrent = Math.min(h.currentMax, h.current + roll.total);
await actor.update({ "flags.cyberware-humanity.humanity.current": newCurrent });
```

### Check threshold for a value

```js
// Returns: "human" | "detachment" | "dissociation" | "prePsychosis" | "cyberpsychosis"
const { getThresholdForValue } = await import(
  "/modules/cyberware-humanity/scripts/utils.js"
);
console.log(getThresholdForValue(22, 50)); // "dissociation"
```

### Open the Humanity Manager for an actor

```js
const { openHumanityManager } = await import(
  "/modules/cyberware-humanity/scripts/character-sheet-integration.js"
);
openHumanityManager(game.actors.getName("Jax Ryder"));
```

### Open the install dialog for an implant

```js
const { openInstallDialog } = await import(
  "/modules/cyberware-humanity/scripts/installation.js"
);
const actor   = game.actors.getName("Jax Ryder");
const implant = actor.items.getName("Cybereyes Mk.I");
openInstallDialog(actor, implant);
```

### List all cyberware on an actor

```js
const actor = game.actors.getName("Jax Ryder");
const mId   = "cyberware-humanity";

actor.items
  .filter(i => i.flags[mId]?.isCyberware)
  .forEach(i => {
    const d = i.flags[mId].cyberData;
    console.log(`${i.name} | ${d.slot} | ${d.humanityCostDice} | installed: ${d.installed}`);
  });
```

### Add a temporary trait

```js
const actor = game.actors.getName("Jax Ryder");
const traits = actor.flags["cyberware-humanity"]?.temporaryTraits ?? [];

await actor.update({
  "flags.cyberware-humanity.temporaryTraits": [
    ...traits,
    { name: "Nightmares [-5]", daysRemaining: 6, source: "Mantis Blades install" }
  ]
});
```

---

## Roadmap

### v1.1 — Quality of Life
- [ ] Uninstall button on the Humanity Manager (restores Hard Cost to Current Max)
- [ ] Temporary-trait list panel with manual remove/extend buttons
- [ ] Recovery roll button (1d6 therapy) directly in the Humanity Manager
- [ ] Sheet widget for the `enemy` actor type (currently character only)

### v1.2 — Compendium
- [ ] Compendium pack with 30+ pre-configured cyberware items
- [ ] Default implants import macro
- [ ] Preset trait tables per threshold (selectable by GM)

### v1.3 — Body Map
- [ ] Visual body silhouette showing occupied/free slots
- [ ] Slot conflict warnings (e.g. two items claiming the same eye)

### v2.0 — Advanced
- [ ] Optional automatic Active Effect application (damage to secondary stats, vision bonuses, etc.) — toggled per-implant, off by default
- [ ] Malfunction roll automation with result table
- [ ] Maintenance scheduler with calendar integration
- [ ] Full Simple Calendar / Calendaria deep integration (track install date, schedule maintenance, auto-expire traits)

### Not planned (by design)
These are explicitly **out of scope** to keep the module non-invasive:

- ❌ Auto-assignment of negative traits
- ❌ Hard enforcement of slot limits
- ❌ Automatic stat penalties from cyberpsychosis
- ❌ Forced character restrictions at any threshold

---

## License

[Apache 2.0](LICENSE)
