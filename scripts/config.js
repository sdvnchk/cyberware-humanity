export const MODULE_ID = "cyberware-humanity";

export const THRESHOLDS = {
  human: {
    minPercent: 70,
    label: "Human",
    color: "#00ff9f",
    suggestedTraits: []
  },
  detachment: {
    minPercent: 40,
    maxPercent: 70,
    label: "Detachment",
    color: "#ffed4e",
    suggestedTraits: [
      "Low Empathy [-20]",
      "Callous [-5]",
      "Oblivious [-5]",
      "Bad Temper [-10]"
    ]
  },
  dissociation: {
    minPercent: 25,
    maxPercent: 40,
    label: "Dissociation",
    color: "#ff6600",
    suggestedTraits: [
      "Callous [-5]",
      "Nightmares [-5]",
      "Paranoia [-10]",
      "Hard of Hearing [-10]",
      "Absent-Mindedness [-15]"
    ]
  },
  prePsychosis: {
    minPercent: 1,
    maxPercent: 25,
    label: "Pre-Psychosis",
    color: "#ff0040",
    suggestedTraits: [
      "Berserk (12) [-10]",
      "Bloodlust (12) [-10]",
      "Sadism (12) [-15]",
      "Flashbacks (12) [-10]",
      "Delusion [-5 to -15]"
    ]
  },
  cyberpsychosis: {
    minPercent: 0,
    maxPercent: 1,
    label: "CYBERPSYCHOSIS",
    color: "#8B0000",
    suggestedTraits: []
  }
};

export const CRAFT_QUALITY = {
  street:    { label: "Street Grade",  costMult: 0.5,  malfunctionMod: +4 },
  cheap:     { label: "Cheap",         costMult: 0.75, malfunctionMod: +2 },
  standard:  { label: "Standard",      costMult: 1.0,  malfunctionMod:  0 },
  fine:      { label: "Fine",          costMult: 4.0,  malfunctionMod: -2 },
  military:  { label: "Military",      costMult: 6.0,  malfunctionMod: -3 },
  veryFine:  { label: "Very Fine",     costMult: 10.0, malfunctionMod: -4 },
  prototype: { label: "Prototype",     costMult: 15.0, malfunctionMod: +3 }
};

export const CYBERWARE_SLOTS = [
  "frontal_cortex",
  "operating_system",
  "eyes",
  "face",
  "arms",
  "hands",
  "skeleton",
  "nervous_system",
  "circulatory_system",
  "integumentary_system",
  "legs",
  "internal"
];

export const CYBERWARE_CATEGORIES = [
  "combat",
  "utility",
  "neural",
  "sensory",
  "medical"
];

export const DEFAULT_CYBER_DATA = {
  category: "utility",
  slot: "internal",
  humanityCostDice: "1d6",
  craftQuality: "standard",
  condition: "mint",
  malfunction: { enabled: false, threshold: 6 },
  maintenance: { required: false, cost: 300 },
  installed: false
};

export const PERMISSION_LEVELS = {
  1: "CYBERWARE.Settings.RolePlayer",
  2: "CYBERWARE.Settings.RoleTrusted",
  3: "CYBERWARE.Settings.RoleAssistant",
  4: "CYBERWARE.Settings.RoleGamemaster"
};

// GURPS system data paths to try when reading Will.
// crnormand/gurps stores primary attributes under system.attributes.WILL (uppercase).
export const WILL_DATA_PATHS = [
  "system.attributes.WILL.value",   // crnormand/gurps (canonical)
  "system.attributes.will.value",   // alternative capitalisation
  "system.will.value",
  "system.will",
  "system.attributes.IQ.value",     // IQ as last resort
  "system.attributes.iq.value"
];
