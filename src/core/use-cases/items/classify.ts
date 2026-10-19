/**
 * Item classification for the catalogue filters: kind → type, plus damage for weapons.
 * Computed on read and sent to players and GM alike (no GM data involved).
 * Uses the Starfinder group/category when the data has it (weapons, armor, "other" items)
 * and name rules for the rest (tech, armor upgrades, augmentations), where AoN has no subgroup.
 * First matching rule wins, so specific rules come before generic ones.
 */

export interface Classifiable {
  name: string;
  kind: string;
  group: string | null;
  category: string | null;
  tags?: string[];
}

export type Damage = 'kinetic' | 'energy' | 'explosive';

const ENERGY = ['Laser', 'Plasma', 'Shock', 'Sonic', 'Cryo', 'Flame', 'Acid'];

type Rule = [type: string, re: RegExp];
const firstMatch = (rules: Rule[], name: string, fallback: string) =>
  rules.find(([, re]) => re.test(name))?.[0] ?? fallback;

const ARMOR_UPGRADE: Rule[] = [
  ['Medical', /Medical|MedObserve|Auto-CPR|Auto-Injector/],
  [
    'Weapons & combat',
    /Weapon Mount|Scaffold|Loader|Scrap Spikes|Snarl Barbs|Microspur|Quick-Release Sheath|Thrower Arms/,
  ],
  [
    'Mobility',
    /Jump Jets|Descent|Leapers|Hydrojet|Mobility|Longstrider|Forcepack|Burrowing|Load Lifter|Juggernaut|Agility|Stabilizer|Mindlink|Quicksuit|Exit Pod|Drop Pod/,
  ],
  [
    'Sensors & stealth',
    /Sensor|Infrared|Camera|Echolocation|Detector|Targeting|Noise Generator|Sonic Dampener|Haze|Grandchild|Lightwarp|Flashblinders|Projector|Reverberation/,
  ],
  [
    'Environment & life support',
    /Climate|Thermal|Radiation|Rebreather|Sustenance|Endurance|Courage|Reaction Accelerator/,
  ],
  [
    'Defense & fields',
    /Force Field|Shield|Plating|Reinforcement|Rampart|Deflective|Ferrofluid|Adaptive|Aligned|Stalwart|Molting|Polarization|Aversion|Slickskin|Electrostatic|Plasma Pain|Silicon|Quartz|Explosive Defense|Plates/,
  ],
];

const AUGMENT: Rule[] = [
  ['Senses & voice', /Eye|Ocular|Retinal|Darkvision|Lightvision|Olfaction|Voice/],
  ['Limbs & prosthetics', /Prosthetic|Knee|Feet/],
  ['Neural & interface', /Datajack|Synaptic/],
  [
    'Organs & resistance',
    /Lungs|Pressure|Bronchial|Respiration|Detoxifier|Antitoxin|Neutralizer|Blood|Hide|Plating/,
  ],
];

const HYBRID: Rule[] = [
  ['Sensors & vision', /Goggles|Scanner|Compass|Theodolite|Badge|Perusal/],
  ['Medical', /Life Shell|Redundancy/],
];

const TECH: Rule[] = [
  [
    'Medical',
    /Medkit|Medpatch|Medical|Sprayflesh|Stapler|Suture|Analeptic|Replenigel|Diagnostic|Subdermal|Inhaler|Chemalyzer/,
  ],
  ['Drones & organics', /Drone|Slime|Leech|Mechaflora|Mechakata|Crawling Cord|Ooze|Organic|Vat/],
  ['Power', /Battery|Inductive Bandolier|Solar Sheeting|Miniature Sun/],
  [
    'Weapons & defense',
    /Shock Stick|Grenade|Emplacement|Shield|Aegis|Pulse Ray|Combat Controller|Plasma Diverter|Swivelshot|Jammer Charge|Fungal Bomb|Hardlight Netting|Tactical Pumps|Inertial|Shock-absorbing|Traction Holster|Evenfire|Detonator/,
  ],
  [
    'Security & stealth',
    /Lock|Restraints|Warning Wire|Proximity Switch|Jammer|Micro Tap|Tracking Bug|Bug Snare|Camouflage|Voice Distorter|Mimic|Scrambler|Anykey|Bypass|Alert Redirector|Hushing|Noise Dampener|White-Noise|Sleeping Sentry|Passthrough|Electroviscous|Flushbuster|Stickyfinger/,
  ],
  [
    'Communication & data',
    /Comm|Datapad|Data Core|Broadcaster|Receiver|Translator|Speaker|Headphones|Blabbersponder|Quantogram|Infosite|Message|Beacon|Autocartographer/,
  ],
  [
    'Sensors & scanners',
    /Scanner|Magniscope|oggles|Xenobiologist|Shades|Sonar|Seismic|Sweeper|Motion|Snapshot|Electrosensory|Proximity Helmet|Designator|Mnemonic|Radiation Badge/,
  ],
  [
    'Survival & environment',
    /Enviro|Collar|Survival Straw|Scuba|Raft|Surfacer|Tent|Fire Extinguisher|Habitat|Acclimation|Altitude|Heatsink|Buoyant|Swarmproof|Purifying|Crash Pad|Oxygen|Antigravity|Antrigravity|Time-pit/,
  ],
  [
    'Tools & engineering',
    /Tool Kit|Drill|Autoclaw|Cable|rappler|Slick Module|Magboots|Magnegloves|Gloves|Paint|Grinder|Ion Tape|Gangway|Zipstick|Fitting|Portable Light|Nano Gadget|Puzzle Box|Smart Cable|All-Purpose|Formation Boots|Cartographer Boots/,
  ],
  [
    'Leisure & personal',
    /Musical|Game|Imaginarium|Infaux|Plushie|Relaxu|Treadmill|Emotion|Empathy|Feelings|Delectator|Scarf|Holdall|Valai|Envoy|Sovereign|Fashion|Multiverse|Eldricarnum|Torc|Programmer/,
  ],
];

const PERSONAL: Rule[] = [
  [
    'Clothing & looks',
    /Clothing|Jewelry|Cosmetics|Perfume|Tattoo|Umbrella|Mineral Dye|Grooming|Hygiene|Religious Symbol/,
  ],
  [
    'Knowledge',
    /Book|Library|Codex|Linguist|Galaxy Map|Speech Encoder|Researcher|Calendara|Arcanascopic|Treadsetter/,
  ],
  [
    'Camping & travel',
    /Bedroll|Blanket|Tent|Sleeping|Hammock|Cot|Canteen|Mess Kit|Lighter|Backpack|Rope|Ladder|Saddle|Map|Binoculars|Oxygen|Warming|pack|Waymarker|Life Suit|Scuba|Frosthiker|Pot,|Emergency Kit|Energel|Condenser|Hazmat|Gear Clamp|Magnetic Jack|Wake-up|Stomach Tabs|Allergy Pod|Spidersatchel/,
  ],
  [
    'Tools & maintenance',
    /Tool|Glass Cutter|Maintenance|Epoxy|Aerosol|Frictionless|Extinguisher|Collector|Power Hub|Mag Weights|Junk Camouflage|Meteorological|Motion Trigger|Helping Hand|Safety Helmet|String Lights/,
  ],
];

const OTHER_GROUP: Record<string, string> = {
  Medicinals: 'Medicinals',
  'Food and Drinks': 'Food & drink',
  Lodgings: 'Lodging',
  'Professional Services': 'Services',
  'Trade Goods': 'Trade goods',
  Transportation: 'Transport',
};

/** Algol goods by tag, in priority order. */
const LOCAL: [type: string, tags: string[]][] = [
  ['Lodging', ['lodging']],
  ['Food & drink', ['meal', 'food', 'drink']],
  ['Medicine & mates', ['mate', 'medicine', 'herb']],
  ['Krupp & animals', ['krupp', 'mount', 'animal']],
  ['Relics & curiosities', ['relic', 'scrap']],
  ['Field kit', ['kit']],
  ['Books & maps', ['book', 'map']],
  ['Certification', ['seal']],
  ['Ammunition', ['ammo']],
  ['Travel & survival', ['travel', 'water', 'fuel']],
  ['Materials', ['chitin', 'silk', 'parts']],
  ['Dezolis goods', ['dezolis']],
  ['Kolian goods', ['kolian']],
];

const WEAPON_CLASS: Record<string, string> = {
  BasicMelee: 'Melee',
  AdvMelee: 'Melee',
  SmallArms: 'Small arms',
  Longarms: 'Longarms',
  Heavy: 'Heavy weapons',
  Sniper: 'Sniper',
  Grenade: 'Grenades',
  Special: 'Special',
};

export function itemType(i: Classifiable): string {
  switch (i.kind) {
    case 'weapon': {
      if (i.group === 'Ammo')
        return /Battery|Petrol/.test(i.name) ? 'Batteries & fuel' : 'Ammunition';
      const base = WEAPON_CLASS[i.group ?? ''] ?? 'Other weapons';
      if (base === 'Melee')
        return ENERGY.includes(i.category ?? '') ? 'Melee (powered)' : 'Melee (analog)';
      return base;
    }
    case 'armor':
      return i.group === 'Heavy' ? 'Heavy armor' : 'Light armor';
    case 'armorUpgrade':
      return firstMatch(ARMOR_UPGRADE, i.name, 'Utility & systems');
    case 'cybernetic':
    case 'biotech':
    case 'personalUpgrade':
      return firstMatch(AUGMENT, i.name, 'Other augmentations');
    case 'hybrid':
      return firstMatch(HYBRID, i.name, 'Survival & utility');
    case 'tech':
      return firstMatch(TECH, i.name, 'Other technology');
    case 'other':
      if (i.group === 'Personal Items') return firstMatch(PERSONAL, i.name, 'Home & comfort');
      return OTHER_GROUP[i.group ?? ''] ?? 'Other gear';
    case 'local': {
      const tags = i.tags ?? [];
      return LOCAL.find(([, ts]) => ts.some((t) => tags.includes(t)))?.[0] ?? 'Other goods';
    }
    default:
      return 'Other';
  }
}

/** Weapons only: kinetic (blades, bullets, arrows), energy (laser, plasma, shock…) or explosive. */
export function itemDamage(i: Classifiable): Damage | null {
  if (i.kind !== 'weapon') return null;
  if (i.group === 'Grenade') return 'explosive';
  if (i.group === 'Ammo') return /Battery|Petrol/.test(i.name) ? 'energy' : 'kinetic';
  return ENERGY.includes(i.category ?? '') ? 'energy' : 'kinetic';
}
