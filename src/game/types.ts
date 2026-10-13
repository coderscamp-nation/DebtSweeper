export type DebtKey = "card" | "student" | "auto" | "mortgage";

export interface DebtDef {
  key: DebtKey;
  name: string;
  short: string;
  apr: number;
  principal: number;
  speed: number;
  color: string;
  glyph: string;
  sides: number;
}

export const DEBT_TYPES: Record<DebtKey, DebtDef> = {
  card: {
    key: "card",
    name: "High-APR Credit Card",
    short: "CREDIT",
    apr: 0.2499,
    principal: 3200,
    speed: 64,
    color: "#ff3d9e",
    glyph: "💳",
    sides: 3,
  },
  student: {
    key: "student",
    name: "Student Loan",
    short: "STUDENT",
    apr: 0.068,
    principal: 9000,
    speed: 40,
    color: "#35f3ff",
    glyph: "🎓",
    sides: 5,
  },
  auto: {
    key: "auto",
    name: "Auto Financing",
    short: "AUTO",
    apr: 0.0949,
    principal: 15000,
    speed: 50,
    color: "#b7ff2e",
    glyph: "🚗",
    sides: 4,
  },
  mortgage: {
    key: "mortgage",
    name: "Mortgage",
    short: "MORTGAGE",
    apr: 0.0645,
    principal: 34000,
    speed: 24,
    color: "#ffc400",
    glyph: "🏠",
    sides: 6,
  },
};

export type UpgradeId =
  | "avalanche"
  | "snowball"
  | "refinance"
  | "emergency"
  | "consolidate";

export interface UpgradeDef {
  id: UpgradeId;
  title: string;
  tag: string;
  color: string;
  desc: (lvl: number) => string;
  cost?: (score: number) => number;
}

export const UPGRADES: Record<UpgradeId, UpgradeDef> = {
  avalanche: {
    id: "avalanche",
    title: "Avalanche Strike",
    tag: "HIGHEST APR FIRST",
    color: "#ff3d9e",
    desc: (l) =>
      `Auto-targets the highest-APR beast on the field and deals +${
        50 + l * 25
      }% critical damage to it. Interest shots also pierce ${l + 1} target(s).`,
  },
  snowball: {
    id: "snowball",
    title: "Snowball Shockwave",
    tag: "SMALLEST DEBT FIRST",
    color: "#35f3ff",
    desc: (l) =>
      `Eliminating the smallest-balance debt releases a shockwave and grants +${
        30 + l * 15
      }% fire rate for ${(4 + l).toFixed(0)}s. Momentum stacks.`,
  },
  refinance: {
    id: "refinance",
    title: "Refinance Barrier",
    tag: "COSTS 12% OF SCORE",
    color: "#b7ff2e",
    desc: (l) =>
      `Permanently cuts every beast's effective APR speed by ${
        18 + l * 6
      }%. Upfront penalty: 12% of your current savings score.`,
    cost: (s) => Math.floor(s * 0.12),
  },
  emergency: {
    id: "emergency",
    title: "Emergency Fund",
    tag: "CORE REPAIR",
    color: "#ffc400",
    desc: (l) =>
      `Instantly restores $${(25000 + l * 5000).toLocaleString()} of Net Worth Core and raises its ceiling by 8%.`,
  },
  consolidate: {
    id: "consolidate",
    title: "Debt Consolidation",
    tag: "CASH FLOW",
    color: "#a97bff",
    desc: (l) =>
      `Overpayment reserve regenerates ${35 + l * 15}% faster and each overpayment hits ${
        15 + l * 10
      }% harder.`,
  },
};

export interface BossDef {
  name: string;
  title: string;
  glyph: string;
  color: string;
  accent: string;
  apr: number;
  principal: number;
  arena: "ring" | "pillars" | "cross" | "spiral";
  taunt: string;
}

/** Mini-boss appears every 10th wave; cycles and scales beyond the list. */
export const BOSSES: BossDef[] = [
  {
    name: "THE COLLECTOR",
    title: "Debt Collection Agency",
    glyph: "☎",
    color: "#ff3d9e",
    accent: "#ffd400",
    apr: 0.2999,
    principal: 120000,
    arena: "ring",
    taunt: "WE'VE BEEN TRYING TO REACH YOU",
  },
  {
    name: "VARIABLE PRIME",
    title: "Adjustable Rate Leviathan",
    glyph: "📈",
    color: "#ffc400",
    accent: "#ff6b6b",
    apr: 0.1899,
    principal: 260000,
    arena: "pillars",
    taunt: "YOUR RATE HAS BEEN ADJUSTED",
  },
  {
    name: "THE UNDERWRITER",
    title: "Subprime Securitizer",
    glyph: "🏦",
    color: "#35f3ff",
    accent: "#a97bff",
    apr: 0.1249,
    principal: 520000,
    arena: "cross",
    taunt: "SIGN HERE. AND HERE. AND HERE.",
  },
  {
    name: "COMPOUND REX",
    title: "Apex Interest Predator",
    glyph: "🐲",
    color: "#b7ff2e",
    accent: "#ff3d9e",
    apr: 0.3499,
    principal: 980000,
    arena: "spiral",
    taunt: "I GROW WHILE YOU SLEEP",
  },
];

export type Difficulty = "easy" | "medium" | "hard";

export interface DiffDef {
  id: Difficulty;
  name: string;
  blurb: string;
  color: string;
  coreHp: number;
  enemyScale: number; // principal multiplier
  aprScale: number; // interest accrual multiplier
  speedScale: number;
  spawnScale: number; // count multiplier
  cashRegen: number;
  scoreMult: number;
}

export const DIFFICULTIES: Record<Difficulty, DiffDef> = {
  easy: {
    id: "easy",
    name: "AUTOPAY",
    blurb: "Generous core, lazy interest. Learn the payoff rhythm.",
    color: "#b7ff2e",
    coreHp: 240000,
    enemyScale: 0.78,
    aprScale: 0.7,
    speedScale: 0.85,
    spawnScale: 0.8,
    cashRegen: 36,
    scoreMult: 0.7,
  },
  medium: {
    id: "medium",
    name: "MINIMUM DUE",
    blurb: "Real-world rates. Balanced pressure on your core.",
    color: "#35f3ff",
    coreHp: 150000,
    enemyScale: 1,
    aprScale: 1,
    speedScale: 1,
    spawnScale: 1,
    cashRegen: 26,
    scoreMult: 1,
  },
  hard: {
    id: "hard",
    name: "DEFAULT NOTICE",
    blurb: "Predatory APRs, relentless swarms, thin margins.",
    color: "#ff3d9e",
    coreHp: 105000,
    enemyScale: 1.25,
    aprScale: 1.45,
    speedScale: 1.18,
    spawnScale: 1.25,
    cashRegen: 21,
    scoreMult: 1.6,
  },
};

export type PowerId =
  | "freeze"
  | "overdrive"
  | "multishot"
  | "shield"
  | "jackpot"
  | "magnet"
  | "repair";

export interface PowerDef {
  id: PowerId;
  name: string;
  short: string;
  glyph: string;
  color: string;
  duration: number;
  desc: string;
  /** Instant powerups apply once on pickup instead of starting a timer. */
  instant?: boolean;
}

export const POWERS: Record<PowerId, PowerDef> = {
  freeze: {
    id: "freeze",
    name: "Rate Freeze",
    short: "FREEZE",
    glyph: "❄",
    color: "#7fe9ff",
    duration: 6,
    desc: "Interest stops compounding and beasts crawl.",
  },
  overdrive: {
    id: "overdrive",
    name: "Payday Overdrive",
    short: "OVERDRIVE",
    glyph: "⚡",
    color: "#ffd400",
    duration: 7,
    desc: "Triple fire rate, free overpayments.",
  },
  multishot: {
    id: "multishot",
    name: "Biweekly Split",
    short: "MULTISHOT",
    glyph: "✶",
    color: "#ff6bd6",
    duration: 8,
    desc: "Fires a 5-way payment spread.",
  },
  shield: {
    id: "shield",
    name: "Escrow Shield",
    short: "SHIELD",
    glyph: "🛡",
    color: "#9dff6b",
    duration: 9,
    desc: "Core takes zero damage.",
  },
  jackpot: {
    id: "jackpot",
    name: "Tax Refund",
    short: "JACKPOT",
    glyph: "💰",
    color: "#ffb347",
    duration: 10,
    desc: "Double savings on every payoff.",
  },
  magnet: {
    id: "magnet",
    name: "Garnishment",
    short: "MAGNET",
    glyph: "🧲",
    color: "#c08bff",
    duration: 8,
    desc: "Drags debts away from your core.",
  },
  repair: {
    id: "repair",
    name: "Bailout Package",
    short: "BAILOUT",
    glyph: "💚",
    color: "#2eff8b",
    duration: 0,
    desc: "Instantly restores 35% of Net Worth Core health.",
    instant: true,
  },
};

/** Real-world payoff milestones unlocked by destroyed principal. */
export interface AssetMetric {
  key: string;
  label: string;
  glyph: string;
  color: string;
  unit: number; // dollars of principal per unit
}

export const ASSET_METRICS: AssetMetric[] = [
  { key: "cards", label: "Cards Cut Up", glyph: "💳", color: "#ff3d9e", unit: 6500 },
  { key: "degrees", label: "Degrees Freed", glyph: "🎓", color: "#35f3ff", unit: 32000 },
  { key: "cars", label: "Cars Paid Off", glyph: "🚗", color: "#b7ff2e", unit: 28000 },
  { key: "homes", label: "Homes Owned", glyph: "🏠", color: "#ffc400", unit: 180000 },
  { key: "years", label: "Years Reclaimed", glyph: "⏳", color: "#a97bff", unit: 52000 },
];

export interface HudState {
  score: number;
  wave: number;
  coreHp: number;
  coreMax: number;
  cash: number;
  fireRate: number;
  enemiesLeft: number;
  combo: number;
  snowballTimer: number;
  totalKilled: number;
  levels: Record<UpgradeId, number>;
  beamName: string;
  beamColor: string;
  beamTier: number;
  beamStep: number;
  upgradePoints: number;
  stageName: string;
  stageColor: string;
  principalCleared: number;
  interestKilled: number;
  actives: { id: PowerId; left: number; total: number }[];
  powerBlocks: number;
  bonus: {
    left: number;
    total: number;
    kills: number;
    earned: number;
    vault: number;
    vaultMax: number;
    leaks: number;
  } | null;
  boss: {
    name: string;
    title: string;
    glyph: string;
    color: string;
    principal: number;
    maxPrincipal: number;
    interest: number;
    phase: number;
  } | null;
}
