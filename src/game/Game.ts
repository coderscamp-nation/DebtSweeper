import {
  BOSSES,
  DEBT_TYPES,
  DIFFICULTIES,
  POWERS,
  type BossDef,
  type DebtDef,
  type DebtKey,
  type Difficulty,
  type HudState,
  type PowerId,
  type UpgradeId,
} from "./types";
import { audio, stageTheme, type StageTheme } from "./audio";

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Beam evolution palette: blue → yellow → red → green, then repeats wider. */
export const BEAM_COLORS = [
  { name: "BLUE", hex: "#4cc3ff", core: "#dff4ff" },
  { name: "YELLOW", hex: "#ffd400", core: "#fff6c9" },
  { name: "RED", hex: "#ff3355", core: "#ffd9e0" },
  { name: "GREEN", hex: "#4dff88", core: "#dcffe8" },
];

const UNITS: { v: number; s: string; d: number }[] = [
  { v: 1e33, s: "De", d: 2 },
  { v: 1e30, s: "No", d: 2 },
  { v: 1e27, s: "Oc", d: 2 },
  { v: 1e24, s: "Sp", d: 2 },
  { v: 1e21, s: "Sx", d: 2 },
  { v: 1e18, s: "Qi", d: 2 },
  { v: 1e15, s: "Q", d: 2 },
  { v: 1e12, s: "T", d: 2 },
  { v: 1e9, s: "B", d: 2 },
  { v: 1e6, s: "M", d: 2 },
  { v: 1e4, s: "k", d: 1 },
];

/** Compact currency: $12.3k → $4.21M → $1.08B → $3.40T → $9.12Q … */
export const fmt = (n: number) => {
  if (!isFinite(n)) return "$∞";
  const neg = n < 0;
  const a = Math.abs(n);
  let out: string;
  const u = UNITS.find((x) => a >= x.v);
  if (u) {
    const scaled = a / u.v;
    // keep it to 4 significant chars: 9.99 / 99.9 / 999
    const dec = scaled >= 100 ? 0 : scaled >= 10 ? 1 : u.d;
    out = scaled.toFixed(dec) + u.s;
  } else {
    out = Math.round(a).toLocaleString();
  }
  return (neg ? "-$" : "$") + out;
};

interface Enemy {
  id: number;
  def: DebtDef;
  x: number;
  y: number;
  principal: number;
  maxPrincipal: number;
  interest: number;
  r: number;
  rot: number;
  spin: number;
  flash: number;
  critFlash: number;
  attacking: boolean;
  wobble: number;
  dead: boolean;
  chilled: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  over: boolean;
  life: number;
  pierce: number;
  hit: number[];
  color: string;
  r: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  type: 0 | 1 | 2; // dot / confetti / ring
  rot?: number;
  spin?: number;
}

interface Boss {
  def: BossDef;
  tier: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  principal: number;
  maxPrincipal: number;
  interest: number;
  rot: number;
  flash: number;
  phase: number;
  t: number;
  atkCd: number;
  pattern: number;
  dead: boolean;
  entry: number;
}

/** Arena obstacle: blocks shots, bounces beasts. */
interface Hazard {
  x: number;
  y: number;
  r: number;
  rot: number;
  spin: number;
  pulse: number;
  flash: number;
}

/** Bonus-stage danmaku sprite. */
interface Sprite {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  hp: number;
  maxHp: number;
  kind: number; // 0 sine, 1 diver, 2 orbiter, 3 turret
  t: number;
  phase: number;
  amp: number;
  baseX: number;
  fireCd: number;
  flash: number;
  value: number;
  color: string;
  dead: boolean;
}

/** Boss / enemy projectile. */
interface Foe {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  color: string;
  homing: boolean;
  spin: number;
}

interface PowerBlock {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  rot: number;
  flash: number;
  dead: boolean;
}

interface Pickup {
  id: PowerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  bob: number;
}

interface Floater {
  x: number;
  y: number;
  vy: number;
  life: number;
  text: string;
  color: string;
  size: number;
  big: boolean;
  keep?: boolean;
}

export type GamePhase = "running" | "paused" | "upgrade" | "over";

interface Callbacks {
  onHud: (s: HudState) => void;
  onWaveComplete: (wave: number, choices: UpgradeId[]) => void;
  onGameOver: (score: number, wave: number, killed: number) => void;
  onBanner: (text: string, sub: string) => void;
}

export class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cb: Callbacks;
  w = 0;
  h = 0;
  dpr = 1;
  raf = 0;
  last = 0;
  acc = 0;
  running = false;
  phase: GamePhase = "running";

  // world
  core = { x: 0, y: 0, hp: 150000, max: 150000, r: 54, pulse: 0, flash: 0 };
  player = { x: 0, y: 0, vx: 0, vy: 0, r: 15, speed: 290, angle: -Math.PI / 2, recoil: 0, hurt: 0 };
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  particles: Particle[] = [];
  floaters: Floater[] = [];
  spawnQueue: { key: DebtKey; t: number }[] = [];
  blocks: PowerBlock[] = [];
  pickups: Pickup[] = [];
  actives: Partial<Record<PowerId, number>> = {};
  blockTimer = 6;
  blocksThisWave = 0;
  boss: Boss | null = null;
  hazards: Hazard[] = [];
  foes: Foe[] = [];
  bossesSlain = 0;
  // bonus danmaku stage
  bonus = false;
  bonusTime = 0;
  bonusMax = 34;
  bonusWaveT = 0;
  bonusFormation = 0;
  bonusKills = 0;
  bonusScore = 0;
  bonusRunsDone = 0;
  bonusLeaks = 0;
  sprites: Sprite[] = [];
  scrollY = 0;
  /** The protected vault that sits at the bottom of the screen during a surge. */
  vault = { x: 0, y: 0, w: 0, h: 34, value: 0, max: 0, flash: 0, shake: 0 };
  difficulty: Difficulty = "medium";
  theme: StageTheme = stageTheme(1);
  principalCleared = 0;
  interestKilled = 0;
  blocksBroken = 0;

  // stats
  score = 0;
  wave = 0;
  killed = 0;
  combo = 0;
  comboTimer = 0;
  baseFireRate = 3.4;
  bonusFireRate = 0;
  fireCd = 0;
  cash = 100;
  cashMax = 100;
  cashRegen = 26;
  snowballTimer = 0;
  waveActive = false;
  levels: Record<UpgradeId, number> = {
    avalanche: 0,
    snowball: 0,
    refinance: 0,
    emergency: 0,
    consolidate: 0,
  };

  shake = 0;
  shakeX = 0;
  shakeY = 0;
  flashAlpha = 0;
  time = 0;
  hudT = 0;
  idSeq = 1;
  targetId: number | null = null;

  keys = new Set<string>();
  touchMove: { id: number; ox: number; oy: number; x: number; y: number } | null = null;
  firePressed = false;
  stars: { x: number; y: number; z: number }[] = [];

  constructor(canvas: HTMLCanvasElement, cb: Callbacks) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { alpha: false })!;
    this.cb = cb;
    this.resize();
    this.reset();
    window.addEventListener("resize", this.resize);
    // the canvas region changes size when HUD bars mount/unmount
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("pointercancel", this.onPointerUp);
  }

  ro: ResizeObserver | null = null;

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("pointercancel", this.onPointerUp);
  }

  resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(320, rect.width);
    this.h = Math.max(320, rect.height);
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.core.x = this.w / 2;
    this.core.y = this.h / 2;
    this.core.r = clamp(Math.min(this.w, this.h) * 0.075, 38, 62);
    if (this.bonus) {
      this.vault.x = this.w / 2;
      this.vault.y = this.h - 40;
      this.vault.w = Math.min(this.w * 0.62, 420);
    }
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * this.w,
      y: Math.random() * this.h,
      z: rand(0.2, 1),
    }));
  };

  get diff() {
    return DIFFICULTIES[this.difficulty];
  }

  reset() {
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floaters = [];
    this.spawnQueue = [];
    this.blocks = [];
    this.pickups = [];
    this.actives = {};
    this.blockTimer = 6;
    this.blocksThisWave = 0;
    this.boss = null;
    this.hazards = [];
    this.foes = [];
    this.bossesSlain = 0;
    this.bonus = false;
    this.sprites = [];
    this.bonusKills = 0;
    this.bonusScore = 0;
    this.bonusRunsDone = 0;
    this.scrollY = 0;
    this.principalCleared = 0;
    this.interestKilled = 0;
    this.blocksBroken = 0;
    this.theme = stageTheme(1);
    this.score = 0;
    this.wave = 0;
    this.killed = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bonusFireRate = 0;
    this.cash = 100;
    this.cashMax = 100;
    this.cashRegen = this.diff.cashRegen;
    this.snowballTimer = 0;
    this.core.max = this.diff.coreHp;
    this.core.hp = this.diff.coreHp;
    this.core.flash = 0;
    this.player.x = this.w / 2;
    this.player.y = this.h / 2 + 110;
    this.player.vx = this.player.vy = 0;
    this.levels = { avalanche: 0, snowball: 0, refinance: 0, emergency: 0, consolidate: 0 };
    this.shake = 0;
    this.phase = "running";
    this.waveActive = false;
  }

  start(difficulty: Difficulty = this.difficulty) {
    this.difficulty = difficulty;
    this.reset();
    this.nextWave();
    this.running = true;
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.loop);
  }

  setPhase(p: GamePhase) {
    this.phase = p;
    if (p === "running") this.last = performance.now();
  }

  // ---------------- bonus danmaku stage ----------------
  /** Every 5th wave that isn't a boss wave (5, 15, 25, 35 ...). */
  get isBonusWave() {
    return this.wave > 0 && this.wave % 5 === 0 && this.wave % 10 !== 0;
  }

  startBonus() {
    this.bonus = true;
    this.bonusTime = 0;
    this.bonusMax = 34;
    this.bonusWaveT = 0.8;
    this.bonusFormation = 0;
    this.bonusKills = 0;
    this.bonusScore = 0;
    this.bonusLeaks = 0;
    this.sprites = [];
    this.foes = [];
    this.hazards = [];
    this.enemies = [];
    this.spawnQueue = [];

    // Stand up the protected vault across the bottom of the screen.
    const startValue = 60000 * this.wave * this.diff.scoreMult;
    this.vault = {
      x: this.w / 2,
      y: this.h - 40,
      w: Math.min(this.w * 0.62, 420),
      h: 34,
      value: startValue,
      max: startValue,
      flash: 0,
      shake: 0,
    };
    // Park the ship in front of the vault, facing up.
    this.player.x = this.w / 2;
    this.player.y = this.h - 170;
    this.player.vx = this.player.vy = 0;
    this.player.angle = -Math.PI / 2;

    this.cb.onBanner("BONUS SURGE", "DEFEND THE VAULT — SHOOT UPWARD");
    this.flashAlpha = 0.5;
  }

  /** Vault takes a hit from a crash or a shot. */
  damageVault(amount: number, x: number, label: string) {
    if (!this.bonus) return;
    const dmg = Math.min(this.vault.value, amount);
    this.vault.value -= dmg;
    this.vault.flash = 1;
    this.vault.shake = 1;
    this.shake = Math.max(this.shake, 10);
    this.bonusLeaks++;
    this.addFloater(
      clamp(x, 70, this.w - 70),
      this.vault.y - 46,
      "-" + fmt(dmg) + " " + label,
      "#ff4d6d",
      18,
      true,
    );
    for (let i = 0; i < 16; i++) {
      this.particles.push({
        x: clamp(x, 10, this.w - 10),
        y: this.vault.y - this.vault.h / 2,
        vx: rand(-180, 180),
        vy: rand(-260, -40),
        life: rand(0.3, 0.8),
        max: 0.8,
        size: rand(2, 5),
        color: i % 2 ? "#ff4d6d" : "#ffc400",
        type: 1,
        rot: Math.random() * TAU,
        spin: rand(-10, 10),
      });
    }
    audio.coreHit();
  }

  hitsVault(x: number, y: number, r: number) {
    const v = this.vault;
    return (
      y + r >= v.y - v.h / 2 &&
      y - r <= v.y + v.h / 2 &&
      x + r >= v.x - v.w / 2 &&
      x - r <= v.x + v.w / 2
    );
  }

  addSprite(x: number, y: number, kind: number, tier: number) {
    const colors = ["#35f3ff", "#ff6bd6", "#b7ff2e", "#ffc400"];
    const hp = (240 + tier * 90) * this.diff.enemyScale;
    this.sprites.push({
      x,
      y,
      vx: 0,
      vy: 70 + tier * 10,
      r: kind === 3 ? 17 : 13,
      hp,
      maxHp: hp,
      kind,
      t: Math.random() * TAU,
      phase: Math.random() * TAU,
      amp: rand(40, 110),
      baseX: x,
      fireCd: rand(0.8, 2.4),
      flash: 0,
      value: 4200 * (1 + tier * 0.35),
      color: colors[kind % colors.length],
      dead: false,
    });
  }

  /** Classic shmup formations: V-wings, snaking columns, rings, turret walls. */
  spawnFormation() {
    const tier = Math.floor(this.wave / 5);
    const f = this.bonusFormation++ % 4;
    const W = this.w;
    if (f === 0) {
      // V-wing sweeping down
      const n = 7;
      const cx = rand(W * 0.3, W * 0.7);
      for (let i = 0; i < n; i++) {
        const off = i - (n - 1) / 2;
        this.addSprite(cx + off * 46, -40 - Math.abs(off) * 32, 0, tier);
      }
    } else if (f === 1) {
      // two snaking columns diving
      for (let s = 0; s < 2; s++) {
        const cx = s === 0 ? W * 0.25 : W * 0.75;
        for (let i = 0; i < 6; i++) this.addSprite(cx, -40 - i * 56, 1, tier);
      }
    } else if (f === 2) {
      // orbiting ring that drifts in
      const n = 9;
      const cx = W / 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        this.addSprite(cx + Math.cos(a) * 110, -90 + Math.sin(a) * 60, 2, tier);
      }
    } else {
      // turret wall — slow, heavy, lots of fire
      const n = 4;
      for (let i = 0; i < n; i++) {
        this.addSprite(((i + 0.5) / n) * W, -50 - (i % 2) * 40, 3, tier);
      }
    }
  }

  spriteFire(s: Sprite) {
    // Raiders shoot down at the vault, leading slightly toward the defender.
    const aimTargetX = Math.random() < 0.55 ? this.vault.x : this.player.x;
    const aimTargetY = Math.random() < 0.55 ? this.vault.y : this.player.y;
    const toP = Math.atan2(aimTargetY - s.y, aimTargetX - s.x);
    const tier = Math.floor(this.wave / 5);
    const dmg = 0;
    const push = (a: number, sp: number, homing = false) =>
      this.foes.push({
        x: s.x,
        y: s.y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 6,
        dmg,
        life: 6,
        color: s.color,
        homing,
        spin: Math.random() * TAU,
      });
    if (s.kind === 3) {
      // downward fan barrage
      const n = 4 + Math.min(4, tier);
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.26 + Math.sin(s.t) * 0.2;
        push(a, 170);
      }
      s.fireCd = 1.5;
    } else if (s.kind === 2) {
      for (let i = -1; i <= 1; i++) push(toP + i * 0.22, 210);
      s.fireCd = rand(1.6, 2.6);
    } else {
      push(toP, 240);
      s.fireCd = rand(1.4, 2.8);
    }
  }

  updateBonus(dt: number) {
    if (!this.bonus) return;
    this.bonusTime += dt;
    this.scrollY += dt * 190;

    // formation spawner
    this.bonusWaveT -= dt;
    if (this.bonusWaveT <= 0 && this.bonusTime < this.bonusMax - 6) {
      this.bonusWaveT = Math.max(2.2, 4.2 - this.wave * 0.04);
      this.spawnFormation();
    }

    const p = this.player;
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i];
      s.t += dt;
      s.flash = Math.max(0, s.flash - dt * 5);
      if (s.kind === 0) {
        s.x = s.baseX + Math.sin(s.t * 1.8 + s.phase) * s.amp;
        s.y += s.vy * dt;
      } else if (s.kind === 1) {
        s.y += s.vy * 1.35 * dt;
        s.x += Math.sin(s.t * 3 + s.phase) * 130 * dt;
      } else if (s.kind === 2) {
        s.y += s.vy * 0.5 * dt;
        s.x += Math.cos(s.t * 1.4 + s.phase) * 170 * dt;
      } else {
        s.y += s.vy * 0.38 * dt;
        s.x += Math.sin(s.t * 0.8) * 55 * dt;
      }
      s.x = clamp(s.x, s.r + 6, this.w - s.r - 6);

      s.fireCd -= dt;
      if (s.fireCd <= 0 && s.y > 30) this.spriteFire(s);

      // graze the player: costs cash flow, never the core
      if (Math.hypot(p.x - s.x, p.y - s.y) < p.r + s.r) {
        p.hurt = 1;
        this.cash = Math.max(0, this.cash - 30 * dt * 10);
        this.shake = Math.max(this.shake, 5);
      }

      // CRASH: raider reaches the vault and detonates against it
      if (this.hitsVault(s.x, s.y, s.r)) {
        this.damageVault(s.maxHp * 9 + this.vault.max * 0.045, s.x, "CRASH");
        this.confetti(s.x, s.y, "#ff4d6d", 18);
        this.sprites.splice(i, 1);
        continue;
      }

      if (s.y > this.h + 60) {
        this.sprites.splice(i, 1);
        continue;
      }
      if (s.dead) this.sprites.splice(i, 1);
    }

    this.vault.flash = Math.max(0, this.vault.flash - dt * 2.2);
    this.vault.shake = Math.max(0, this.vault.shake - dt * 3);

    // stage complete — time up, or the vault has been drained dry
    if ((this.bonusTime >= this.bonusMax && !this.sprites.length) || this.vault.value <= 0) {
      this.endBonus();
    }
  }

  hitSprite(s: Sprite, dmg: number, x: number, y: number) {
    s.hp -= dmg;
    s.flash = 1;
    this.burst(x, y, s.color, 4);
    if (s.hp <= 0 && !s.dead) {
      s.dead = true;
      this.bonusKills++;
      this.combo++;
      this.comboTimer = 3;
      const gain = s.value * this.diff.scoreMult * (1 + this.combo * 0.04) * (this.has("jackpot") ? 2 : 1);
      this.score += gain;
      this.bonusScore += gain;
      this.addFloater(s.x, s.y - 16, "+" + fmt(gain), "#b7ff2e", 14, false);
      this.confetti(s.x, s.y, s.color, 12);
      this.shake = Math.max(this.shake, 4);
      audio.hit();
      // every 8th kill coughs up a powerup
      if (this.bonusKills % 8 === 0) {
        this.pickups.push({
          id: this.rollPowerId(),
          x: s.x,
          y: s.y,
          vx: 0,
          vy: 40,
          life: 10,
          bob: 0,
        });
        audio.powerBlock();
      }
    }
  }

  endBonus() {
    // The surviving vault IS the payout — every leak cost you real money.
    const survived = Math.max(0, this.vault.value);
    const ratio = this.vault.max > 0 ? survived / this.vault.max : 0;
    const flawless = this.bonusLeaks === 0;
    const payout = survived + this.bonusScore * 0.35 + (flawless ? this.vault.max * 0.5 : 0);
    this.score += payout;
    this.bonusRunsDone++;
    this.bonus = false;
    this.sprites = [];
    this.foes = [];
    this.flashAlpha = 0.6;
    this.shake = 16;

    const cx = this.core.x;
    const cy = this.core.y;
    this.addFloater(cx, cy - 104, "SURGE CLEARED", "#35f3ff", 26, true, true);
    this.addFloater(cx, cy - 74, `${this.bonusKills} INTERCEPTS`, "#ffffff", 17, true, true);
    this.addFloater(
      cx,
      cy - 46,
      `VAULT ${Math.round(ratio * 100)}% INTACT`,
      ratio > 0.75 ? "#b7ff2e" : ratio > 0.4 ? "#ffc400" : "#ff6b6b",
      19,
      true,
      true,
    );
    this.addFloater(cx, cy - 16, "+" + fmt(payout) + " BANKED", "#b7ff2e", 23, true, true);
    if (flawless) {
      this.bonusFireRate = Math.min(9, this.bonusFireRate + 0.5);
      this.addFloater(cx, cy + 14, "FLAWLESS DEFENSE · +FIRE RATE", "#ffc400", 16, true, true);
    }
    this.confetti(cx, cy, "#35f3ff", 70);
    audio.wave();
  }

  drawVault(ctx: CanvasRenderingContext2D) {
    if (!this.bonus) return;
    const v = this.vault;
    const ratio = clamp(v.max > 0 ? v.value / v.max : 0, 0, 1);
    const sx = v.shake > 0 ? rand(-4, 4) * v.shake : 0;
    const low = ratio < 0.3;
    ctx.save();
    ctx.translate(sx, 0);

    // approach warning glow
    ctx.globalCompositeOperation = "lighter";
    const grd = ctx.createLinearGradient(0, v.y - 70, 0, v.y + 30);
    grd.addColorStop(0, "rgba(0,0,0,0)");
    grd.addColorStop(1, low ? "rgba(255,45,85,.3)" : "rgba(53,243,255,.22)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, v.y - 70, this.w, 100);
    ctx.globalCompositeOperation = "source-over";

    // defense line
    ctx.strokeStyle = low ? "rgba(255,77,109,.6)" : "rgba(53,243,255,.4)";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(0, v.y - v.h / 2 - 16);
    ctx.lineTo(this.w, v.y - v.h / 2 - 16);
    ctx.stroke();
    ctx.setLineDash([]);

    // vault body
    const x0 = v.x - v.w / 2;
    const y0 = v.y - v.h / 2;
    ctx.fillStyle = v.flash > 0.2 ? "rgba(255,255,255,.9)" : "rgba(12,8,30,.92)";
    ctx.strokeStyle = v.flash > 0.2 ? "#ffffff" : low ? "#ff4d6d" : "#35f3ff";
    ctx.lineWidth = 3;
    ctx.shadowColor = low ? "#ff4d6d" : "#35f3ff";
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.roundRect(x0, y0, v.w, v.h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // value fill
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x0 + 3, y0 + 3, (v.w - 6) * ratio, v.h - 6, 8);
    ctx.clip();
    const fg = ctx.createLinearGradient(x0, 0, x0 + v.w, 0);
    fg.addColorStop(0, low ? "#ff2d55" : "#35f3ff");
    fg.addColorStop(1, low ? "#ff8a00" : "#b7ff2e");
    ctx.fillStyle = fg;
    ctx.fillRect(x0, y0, v.w, v.h);
    ctx.restore();

    // label
    ctx.font = "900 13px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#05030f";
    ctx.fillText("VAULT  " + fmt(v.value), v.x, v.y + 5);

    // rivets
    ctx.fillStyle = low ? "#ff4d6d" : "#35f3ff";
    for (let i = 0; i <= 6; i++) {
      const px = x0 + (v.w / 6) * i;
      ctx.beginPath();
      ctx.arc(px, y0 - 6, 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------- boss waves ----------------
  get isBossWave() {
    return this.wave > 0 && this.wave % 10 === 0;
  }

  /** Build the arena obstacle layout for a boss encounter. */
  buildArena(kind: BossDef["arena"]) {
    this.hazards = [];
    const cx = this.core.x;
    const cy = this.core.y;
    const R = Math.min(this.w, this.h);
    const add = (x: number, y: number, r: number) =>
      this.hazards.push({
        x,
        y,
        r,
        rot: Math.random() * TAU,
        spin: rand(-0.5, 0.5),
        pulse: Math.random() * TAU,
        flash: 0,
      });

    if (kind === "ring") {
      const n = 10;
      const rad = R * 0.33;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        add(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, 20);
      }
    } else if (kind === "pillars") {
      for (let gx = -1; gx <= 1; gx++) {
        for (let gy = -1; gy <= 1; gy++) {
          if (gx === 0 && gy === 0) continue;
          add(cx + gx * R * 0.3, cy + gy * R * 0.3, 26);
        }
      }
    } else if (kind === "cross") {
      for (let i = 1; i <= 4; i++) {
        const d = R * 0.11 * i + R * 0.1;
        add(cx + d, cy, 18);
        add(cx - d, cy, 18);
        add(cx, cy + d, 18);
        add(cx, cy - d, 18);
      }
    } else {
      // spiral
      for (let i = 0; i < 16; i++) {
        const a = i * 0.72;
        const d = R * 0.1 + i * R * 0.018;
        add(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 15);
      }
    }
    // keep obstacles clear of the core and inside the viewport
    this.hazards = this.hazards.filter(
      (hz) =>
        Math.hypot(hz.x - cx, hz.y - cy) > this.core.r + 55 &&
        hz.x > hz.r + 10 &&
        hz.x < this.w - hz.r - 10 &&
        hz.y > hz.r + 10 &&
        hz.y < this.h - hz.r - 10,
    );
  }

  /**
   * Debris field for normal waves. Nothing until the first boss falls, then the
   * course keeps a permanent scattering of small rocks that grows every 10 waves.
   */
  buildDebris() {
    this.hazards = [];
    const cleared = Math.floor((this.wave - 1) / 10); // bosses passed
    if (cleared <= 0) return;

    // 4 rocks after boss 1, +3 per boss, capped so the arena stays playable
    const count = Math.min(22, 4 + (cleared - 1) * 3 + Math.floor((this.wave % 10) / 4));
    const baseR = Math.min(this.w, this.h) * 0.022;
    const cx = this.core.x;
    const cy = this.core.y;
    const minCore = this.core.r + 95;
    let guard = 0;

    while (this.hazards.length < count && guard++ < count * 40) {
      const r = clamp(baseR * rand(0.75, 1.45) * (1 + cleared * 0.06), 10, 30);
      const x = rand(r + 16, this.w - r - 16);
      const y = rand(r + 16, this.h - r - 16);
      // keep clear of the core and don't clump on top of each other
      if (Math.hypot(x - cx, y - cy) < minCore + r) continue;
      let overlaps = false;
      for (const o of this.hazards) {
        if (Math.hypot(o.x - x, o.y - y) < o.r + r + 46) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;
      this.hazards.push({
        x,
        y,
        r,
        rot: Math.random() * TAU,
        spin: rand(-0.6, 0.6),
        pulse: Math.random() * TAU,
        flash: 0,
      });
    }
  }

  spawnBoss() {
    const tier = Math.floor((this.wave - 1) / 10); // 0,1,2,...
    const def = BOSSES[tier % BOSSES.length];
    const loops = Math.floor(tier / BOSSES.length);
    const hp =
      def.principal * (1 + tier * 0.55) * (1 + loops * 1.4) * this.diff.enemyScale;
    this.boss = {
      def,
      tier,
      x: this.core.x,
      y: -140,
      vx: 0,
      vy: 0,
      r: clamp(Math.min(this.w, this.h) * 0.1, 48, 88),
      principal: hp,
      maxPrincipal: hp,
      interest: hp * 0.14,
      rot: 0,
      flash: 0,
      phase: 1,
      t: 0,
      atkCd: 2.2,
      pattern: 0,
      dead: false,
      entry: 1,
    };
    this.buildArena(def.arena);
    this.cb.onBanner(def.name, def.taunt);
    this.shake = 18;
    this.flashAlpha = 0.45;
  }

  bossFire(count: number, speed: number, spread: number, baseAngle: number, homing = false) {
    const b = this.boss;
    if (!b) return;
    const dmg = b.maxPrincipal * 0.016 * this.diff.aprScale;
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i - (count - 1) / 2) * spread;
      this.foes.push({
        x: b.x + Math.cos(a) * (b.r * 0.8),
        y: b.y + Math.sin(a) * (b.r * 0.8),
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        r: homing ? 9 : 7,
        dmg,
        life: 6,
        color: homing ? b.def.accent : b.def.color,
        homing,
        spin: Math.random() * TAU,
      });
    }
    audio.coreHit();
  }

  updateBoss(dt: number) {
    const b = this.boss;
    if (!b) return;
    b.t += dt;
    b.rot += dt * 0.6;
    b.flash = Math.max(0, b.flash - dt * 4);

    // entrance glide
    if (b.entry > 0) {
      b.entry -= dt * 0.6;
      b.y += (this.core.y - this.h * 0.26 - b.y) * Math.min(1, dt * 2.2);
      b.x = this.core.x;
      return;
    }

    // interest compounds on the boss too
    if (!this.has("freeze")) {
      b.interest += ((b.principal * b.def.apr) / 12) * dt * this.diff.aprScale;
    }

    // phase by remaining principal
    const ratio = b.principal / b.maxPrincipal;
    const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
    if (newPhase !== b.phase) {
      b.phase = newPhase;
      this.shake = 20;
      this.flashAlpha = 0.5;
      this.addFloater(b.x, b.y - b.r - 30, "PHASE " + newPhase, b.def.accent, 26, true, true);
      this.confetti(b.x, b.y, b.def.color, 30);
      audio.upgrade();
    }

    // orbital movement around the core
    const speed = (0.35 + b.phase * 0.22) * this.diff.speedScale * (this.has("freeze") ? 0.2 : 1);
    const orbit = Math.min(this.w, this.h) * 0.3;
    const ang = b.t * speed;
    const tx = this.core.x + Math.cos(ang) * orbit;
    const ty = this.core.y + Math.sin(ang) * orbit * 0.62;
    b.x += (tx - b.x) * Math.min(1, dt * 1.6);
    b.y += (ty - b.y) * Math.min(1, dt * 1.6);
    b.x = clamp(b.x, b.r + 8, this.w - b.r - 8);
    b.y = clamp(b.y, b.r + 8, this.h - b.r - 8);

    // attacks
    b.atkCd -= dt * (this.has("freeze") ? 0.25 : 1);
    if (b.atkCd <= 0) {
      const toPlayer = Math.atan2(this.player.y - b.y, this.player.x - b.x);
      b.pattern = (b.pattern + 1) % 3;
      if (b.pattern === 0) {
        // radial burst
        const n = 8 + b.phase * 4;
        this.bossFire(n, 150 + b.phase * 25, TAU / n, b.t);
        b.atkCd = 2.6 - b.phase * 0.35;
      } else if (b.pattern === 1) {
        // aimed shotgun at the player
        this.bossFire(3 + b.phase, 230, 0.16, toPlayer);
        b.atkCd = 1.7 - b.phase * 0.2;
      } else {
        // homing collection notices
        this.bossFire(b.phase, 120, 0.4, toPlayer, true);
        b.atkCd = 3.1 - b.phase * 0.3;
        // summon adds in later phases
        if (b.phase >= 2) {
          const keys: DebtKey[] = ["card", "student", "auto"];
          this.spawn(keys[Math.floor(Math.random() * keys.length)]);
        }
      }
    }

    // boss body contact drains the core
    const d = Math.hypot(b.x - this.core.x, b.y - this.core.y);
    if (d < this.core.r + b.r && !this.has("shield")) {
      this.core.hp -= b.maxPrincipal * 0.02 * dt;
      this.core.flash = 1;
    }
  }

  hitBoss(dmg: number, over: boolean, x: number, y: number) {
    const b = this.boss;
    if (!b || b.dead || b.entry > 0) return;
    b.flash = 1;
    if (over) {
      b.principal -= dmg;
      this.addFloater(x, y - 14, "-" + fmt(dmg), "#ffe14d", 18, false);
    } else if (b.interest > 0) {
      const applied = Math.min(b.interest, dmg);
      b.interest -= applied;
      b.principal -= (dmg - applied) * 0.18;
      this.addFloater(x, y - 14, "-" + fmt(applied), "#ffd84d", 14, false);
    } else {
      b.principal -= dmg * 0.22;
      this.addFloater(x, y - 14, "-" + fmt(dmg * 0.22), "#ff8fbf", 14, false);
    }
    this.burst(x, y, b.def.color, 5);
    if (b.principal <= 0) this.killBoss();
  }

  killBoss() {
    const b = this.boss;
    if (!b || b.dead) return;
    b.dead = true;
    this.bossesSlain++;
    this.killed++;
    const saved =
      (b.maxPrincipal + b.interest + b.maxPrincipal * b.def.apr * 12) *
      this.diff.scoreMult *
      (this.has("jackpot") ? 2 : 1);
    this.score += saved;
    this.principalCleared += b.maxPrincipal;
    this.interestKilled += Math.max(0, b.interest);
    this.bonusFireRate = Math.min(9, this.bonusFireRate + 0.6);

    this.shake = 34;
    this.flashAlpha = 0.95;
    this.confetti(b.x, b.y, b.def.color, 120);
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: b.x,
        y: b.y,
        vx: Math.cos(a) * rand(80, 560),
        vy: Math.sin(a) * rand(80, 560),
        life: rand(0.5, 1.3),
        max: 1.3,
        size: rand(2, 6),
        color: i % 2 ? b.def.color : b.def.accent,
        type: 0,
      });
    }
    this.addFloater(b.x, b.y - 90, b.def.name + " DEFEATED", b.def.color, 26, true, true);
    this.addFloater(b.x, b.y - 58, "SAVED " + fmt(saved), "#b7ff2e", 22, true, true);
    this.addFloater(b.x, b.y - 28, "+PERMANENT CASH FLOW", "#35f3ff", 16, true, true);
    // victory spoils: two guaranteed powerups from the wreckage
    const ids = (Object.keys(POWERS) as PowerId[]).sort(() => Math.random() - 0.5).slice(0, 2);
    ids.forEach((id, i) => {
      const a = (i / ids.length) * TAU + Math.random();
      this.pickups.push({
        id,
        x: b.x + Math.cos(a) * 34,
        y: b.y + Math.sin(a) * 34,
        vx: Math.cos(a) * 70,
        vy: Math.sin(a) * 70,
        life: 16,
        bob: i,
      });
    });

    audio.kill(b.r);
    audio.wave();
    // clear the screen of incoming fire as a reward
    this.foes = [];
    this.boss = null;
  }

  // ---------------- waves ----------------
  nextWave() {
    this.wave++;
    const w = this.wave;
    const pool: DebtKey[] = ["card"];
    if (w >= 2) pool.push("student");
    if (w >= 3) pool.push("auto");
    if (w >= 4) pool.push("mortgage");
    this.hazards = [];
    this.foes = [];
    this.boss = null;
    this.spawnQueue = [];
    this.bonus = false;
    this.sprites = [];
    const bossWave = this.isBossWave;
    const bonusWave = this.isBonusWave;

    if (bonusWave) {
      // no debt swarm — the surge stage supplies its own enemies
    } else if (bossWave) {
      // escort swarm is small; the boss is the main event
      const escort = Math.round(4 * this.diff.spawnScale);
      let et = 2.2;
      for (let i = 0; i < escort; i++) {
        this.spawnQueue.push({ key: pool[Math.floor(Math.random() * pool.length)], t: et });
        et += rand(1.4, 2.6);
      }
    } else {
      const count = Math.round((5 + w * 1.9) * this.diff.spawnScale);
      let t = 0.4;
      for (let i = 0; i < count; i++) {
        const key = pool[Math.floor(Math.random() * pool.length)];
        this.spawnQueue.push({ key, t });
        t += Math.max(0.28, 1.15 - w * 0.05) * rand(0.7, 1.3);
      }
      if (w % 3 === 0 && w >= 4) this.spawnQueue.push({ key: "mortgage", t: t + 0.6 });
    }

    this.waveActive = true;
    this.theme = stageTheme(w);
    this.stars = this.stars.map((s) => ({ ...s }));
    this.blocksThisWave = 0;
    this.blockTimer = bossWave
      ? rand(3, 5)
      : w >= 50
        ? rand(6, 10)
        : rand(5, 9) * this.blockRate().interval;
    audio.startStage(w);
    audio.wave();
    if (bonusWave) {
      this.startBonus();
    } else if (bossWave) {
      this.spawnBoss();
    } else {
      this.buildDebris();
      this.cb.onBanner(`WAVE ${w}`, this.theme.name);
    }
  }

  spawn(key: DebtKey) {
    const def = DEBT_TYPES[key];
    const mult = (1 + (this.wave - 1) * 0.16) * this.diff.enemyScale;
    const edge = Math.floor(Math.random() * 4);
    const m = 40;
    let x = 0;
    let y = 0;
    if (edge === 0) (x = rand(0, this.w)), (y = -m);
    else if (edge === 1) (x = this.w + m), (y = rand(0, this.h));
    else if (edge === 2) (x = rand(0, this.w)), (y = this.h + m);
    else (x = -m), (y = rand(0, this.h));
    const p = def.principal * mult * rand(0.85, 1.15);
    this.enemies.push({
      id: this.idSeq++,
      def,
      x,
      y,
      principal: p,
      maxPrincipal: p,
      interest: p * 0.08,
      r: 0,
      rot: Math.random() * TAU,
      spin: rand(-0.7, 0.7),
      flash: 0,
      critFlash: 0,
      attacking: false,
      wobble: Math.random() * TAU,
      dead: false,
      chilled: false,
    });
  }

  // ---------------- powerups ----------------
  has(p: PowerId) {
    return (this.actives[p] ?? 0) > 0;
  }

  /**
   * Vault drop schedule.
   *  Waves  1-10 : full rate, unchanged.
   *  Waves 11-49 : slow taper — longer gaps, lower roll chance, shrinking
   *                per-wave cap (always more than 1).
   *  Waves 50+   : hard-capped at exactly ONE vault per wave.
   *  Boss waves  : always 3 guaranteed support drops, regardless of depth.
   */
  blockRate() {
    const w = this.wave;
    // Boss waves always supply support drops, no matter how deep you are.
    if (this.isBossWave) return { interval: 0.55, chance: 1, maxPerWave: 3, concurrent: 2 };
    if (w >= 50) return { interval: 1, chance: 1, maxPerWave: 1, concurrent: 1 };
    if (w <= 10) return { interval: 1, chance: 1, maxPerWave: 99, concurrent: 2 };
    // gradual slowdown across 10-wave bands inching toward wave 50
    if (w <= 19) return { interval: 1.12, chance: 0.94, maxPerWave: 6, concurrent: 2 };
    if (w <= 29) return { interval: 1.3, chance: 0.87, maxPerWave: 5, concurrent: 2 };
    if (w <= 39) return { interval: 1.55, chance: 0.78, maxPerWave: 4, concurrent: 2 };
    if (w <= 44) return { interval: 1.8, chance: 0.7, maxPerWave: 3, concurrent: 1 };
    return { interval: 2.05, chance: 0.62, maxPerWave: 2, concurrent: 1 }; // 45-49
  }

  nextBlockDelay() {
    const r = this.blockRate();
    // Boss waves: steady support drops throughout the fight.
    if (this.isBossWave) return rand(7, 11);
    if (this.wave >= 50) {
      // single guaranteed vault, dropped early-ish in the wave
      return rand(7, 12);
    }
    return rand(11, 17) * r.interval;
  }

  blockChance() {
    return this.blockRate().chance;
  }

  spawnBlock() {
    const m = 90;
    const cx = this.core.x;
    const cy = this.core.y;
    let x = 0;
    let y = 0;
    for (let i = 0; i < 24; i++) {
      x = rand(m, this.w - m);
      y = rand(m, this.h - m);
      if (Math.hypot(x - cx, y - cy) <= this.core.r + 110) continue;
      // don't bury a vault inside an obstacle
      let clear = true;
      for (const hz of this.hazards) {
        if (Math.hypot(hz.x - x, hz.y - y) < hz.r + 48) {
          clear = false;
          break;
        }
      }
      if (clear) break;
    }
    const hp = 5200 * (1 + this.wave * 0.22) * this.diff.enemyScale;
    this.blocks.push({
      x,
      y,
      vx: rand(-18, 18),
      vy: rand(-18, 18),
      hp,
      maxHp: hp,
      rot: Math.random() * TAU,
      flash: 0,
      dead: false,
    });
    this.addFloater(x, y - 36, "BONUS VAULT", "#ffe14d", 16, false);
  }

  /** Roll a random powerup. Re-rolls a heal once if there's nothing to heal. */
  rollPowerId(): PowerId {
    const ids = Object.keys(POWERS) as PowerId[];
    let id = ids[Math.floor(Math.random() * ids.length)];
    const healthy = this.bonus
      ? this.vault.value / Math.max(1, this.vault.max) > 0.9
      : this.core.hp / this.core.max > 0.9;
    if (id === "repair" && healthy) id = ids[Math.floor(Math.random() * ids.length)];
    return id;
  }

  breakBlock(b: PowerBlock) {
    if (b.dead) return;
    b.dead = true;
    this.blocksBroken++;
    const id = this.rollPowerId();
    const def = POWERS[id];
    this.pickups.push({ id, x: b.x, y: b.y, vx: rand(-40, 40), vy: rand(-40, 40), life: 11, bob: 0 });
    const bonus = 1800 * this.diff.scoreMult * (1 + this.wave * 0.35);
    this.score += bonus;
    this.shake = Math.max(this.shake, 14);
    this.flashAlpha = Math.max(this.flashAlpha, 0.3);
    this.confetti(b.x, b.y, def.color, 34);

    // Three guaranteed, non-overlapping, on-screen callouts.
    // Anchor inside a safe band so the whole stack always fits vertically.
    const by = clamp(b.y, 150, Math.max(150, this.h - 150));
    this.addFloater(b.x, by - 74, "VAULT CRACKED", "#ffe14d", 22, true, true);
    this.addFloater(b.x, by - 44, "+" + fmt(bonus) + " BONUS", "#b7ff2e", 17, true, true);
    this.addFloater(b.x, by - 16, def.glyph + " " + def.short + " DROPPED", def.color, 17, true, true);

    audio.powerBlock();
  }

  collect(p: Pickup) {
    const def = POWERS[p.id];
    audio.pickup(Object.keys(POWERS).indexOf(p.id));
    // Instant powerups (heals) apply once instead of starting a timer.
    if (def.instant) {
      this.applyInstantPower(p.id, p.x, p.y);
      return;
    }
    this.actives[p.id] = def.duration;
    this.addFloater(this.player.x, this.player.y - 46, def.glyph + " " + def.short, def.color, 24, true);
    this.addFloater(this.player.x, this.player.y - 24, def.desc, def.color, 12, false);
    this.confetti(p.x, p.y, def.color, 22);
    this.shake = Math.max(this.shake, 9);
    this.flashAlpha = Math.max(this.flashAlpha, 0.25);
    if (p.id === "shield") this.core.flash = 0;
  }

  applyInstantPower(id: PowerId, x: number, y: number) {
    const def = POWERS[id];
    if (id !== "repair") return;

    // During a bonus surge the vault is the "health" that matters.
    if (this.bonus) {
      const missing = this.vault.max - this.vault.value;
      const amount = Math.min(missing, this.vault.max * 0.35);
      this.vault.value += amount;
      this.vault.flash = 0;
      this.confetti(x, y, def.color, 22);
      this.confetti(this.vault.x, this.vault.y - 20, def.color, 26);
      this.particles.push({
        x: this.vault.x,
        y: this.vault.y,
        vx: 0,
        vy: 0,
        life: 0.6,
        max: 0.6,
        size: this.vault.w / 2,
        color: def.color,
        type: 2,
      });
      this.addFloater(this.vault.x, this.vault.y - 52, "+" + fmt(amount) + " VAULT RESTORED", def.color, 22, true, true);
      this.shake = Math.max(this.shake, 9);
      this.flashAlpha = Math.max(this.flashAlpha, 0.25);
      return;
    }

    const missing = this.core.max - this.core.hp;
    const amount = Math.min(missing, this.core.max * 0.35);

    // Never a wasted pickup: a full core converts the bailout into a cash bonus.
    if (amount <= 0) {
      const bonus = 6000 * this.wave * this.diff.scoreMult;
      this.score += bonus;
      this.confetti(x, y, def.color, 22);
      this.addFloater(this.player.x, this.player.y - 46, "CORE FULL", def.color, 20, true, true);
      this.addFloater(this.player.x, this.player.y - 20, "+" + fmt(bonus) + " BONUS", "#b7ff2e", 17, true, true);
      this.shake = Math.max(this.shake, 9);
      this.flashAlpha = Math.max(this.flashAlpha, 0.25);
      return;
    }

    this.core.hp += amount;
    this.core.flash = 0;
    // green cross-burst rising off the core + an expanding heal ring
    this.confetti(x, y, def.color, 22);
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU;
      const d = rand(0, this.core.r);
      this.particles.push({
        x: this.core.x + Math.cos(a) * d,
        y: this.core.y + Math.sin(a) * d,
        vx: Math.cos(a) * rand(20, 90),
        vy: -rand(60, 240),
        life: rand(0.5, 1),
        max: 1,
        size: rand(2, 4.5),
        color: i % 3 === 0 ? "#ffffff" : def.color,
        type: 0,
      });
    }
    this.particles.push({
      x: this.core.x,
      y: this.core.y,
      vx: 0,
      vy: 0,
      life: 0.7,
      max: 0.7,
      size: this.core.r + 26,
      color: def.color,
      type: 2,
    });
    this.addFloater(this.player.x, this.player.y - 46, def.glyph + " " + def.short, def.color, 24, true, true);
    this.addFloater(this.core.x, this.core.y - this.core.r - 34, "+" + fmt(amount) + " CORE RESTORED", def.color, 21, true, true);
    this.shake = Math.max(this.shake, 9);
    this.flashAlpha = Math.max(this.flashAlpha, 0.25);
  }

  // ---------------- input ----------------
  onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    this.keys.add(k);
    if (k === " ") this.tryOverpay();
  };
  onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());

  onPointerDown = (e: PointerEvent) => {
    if (this.phase !== "running") return;
    const r = this.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    if (e.pointerType === "mouse") {
      this.tryOverpay();
      return;
    }
    if (x < this.w * 0.55 && !this.touchMove) {
      this.touchMove = { id: e.pointerId, ox: x, oy: y, x, y };
    } else {
      this.tryOverpay();
    }
  };
  onPointerMove = (e: PointerEvent) => {
    if (this.touchMove && e.pointerId === this.touchMove.id) {
      const r = this.canvas.getBoundingClientRect();
      this.touchMove.x = e.clientX - r.left;
      this.touchMove.y = e.clientY - r.top;
    }
  };
  onPointerUp = (e: PointerEvent) => {
    if (this.touchMove && e.pointerId === this.touchMove.id) this.touchMove = null;
  };

  /** Total upgrade levels taken — drives beam evolution. */
  get upgradePoints() {
    let n = 0;
    for (const k in this.levels) n += this.levels[k as UpgradeId];
    return n;
  }

  /** Beam colour cycles blue → yellow → red → green, then widens and cycles again. */
  get beam() {
    const pts = this.upgradePoints;
    const idx = pts % BEAM_COLORS.length;
    const tier = Math.floor(pts / BEAM_COLORS.length);
    const c = BEAM_COLORS[idx];
    return {
      index: idx,
      tier,
      name: c.name,
      color: c.hex,
      core: c.core,
      radius: 4 + tier * 1.9,
      lineWidth: 2.6 + tier * 1.5,
      damageMult: 1 + tier * 0.22 + idx * 0.04,
    };
  }

  get fireRate() {
    const snow = this.snowballTimer > 0 ? 1 + (0.3 + this.levels.snowball * 0.15) : 1;
    const od = this.has("overdrive") ? 3 : 1;
    return Math.min(26, (this.baseFireRate + this.bonusFireRate) * snow * od);
  }

  tryOverpay() {
    if (this.phase !== "running") return;
    const cost = this.has("overdrive") ? 0 : 38;
    if (this.cash < cost) {
      this.addFloater(this.player.x, this.player.y - 26, "NO CASH FLOW", "#ff6b6b", 15, false);
      return;
    }
    this.cash -= cost;
    const target = this.pickTarget();
    let ang = this.player.angle;
    const bs = this.boss;
    if (bs && !bs.dead && bs.entry <= 0)
      ang = Math.atan2(bs.y - this.player.y, bs.x - this.player.x);
    else if (target) ang = Math.atan2(target.y - this.player.y, target.x - this.player.x);
    const dmg = 4300 * (1 + this.wave * 0.1) * (1 + this.levels.consolidate * 0.15);
    for (let i = -1; i <= 1; i++) {
      const a = ang + i * 0.1;
      this.bullets.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * 980,
        vy: Math.sin(a) * 980,
        dmg: dmg / 3,
        over: true,
        life: 1.3,
        pierce: 2,
        hit: [],
        color: "#ffe14d",
        r: 7,
      });
    }
    this.player.recoil = 1;
    this.shake = Math.max(this.shake, 7);
    audio.overpay();
    for (let i = 0; i < 14; i++) {
      const a = ang + rand(-0.5, 0.5);
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * rand(80, 320),
        vy: Math.sin(a) * rand(80, 320),
        life: 0.4,
        max: 0.4,
        size: rand(1.5, 3.5),
        color: "#ffe14d",
        type: 0,
      });
    }
  }

  pickTarget(): Enemy | null {
    if (!this.enemies.length) return null;
    let best: Enemy | null = null;
    let bestScore = -Infinity;
    const avalanche = this.levels.avalanche > 0;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - this.player.x, e.y - this.player.y);
      let s = -d * 0.01;
      if (avalanche) s += e.def.apr * 180;
      else s += (1200 - Math.hypot(e.x - this.core.x, e.y - this.core.y)) * 0.004;
      if (s > bestScore) {
        bestScore = s;
        best = e;
      }
    }
    return best;
  }

  // ---------------- loop ----------------
  loop = (now: number) => {
    this.raf = requestAnimationFrame(this.loop);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (this.phase === "running") this.update(dt);
    else {
      // keep light ambient motion
      this.time += dt * 0.3;
    }
    this.render();
  };

  update(dt: number) {
    this.time += dt;
    this.hudT += dt;

    // --- spawn queue ---
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      this.spawnQueue[i].t -= dt;
      if (this.spawnQueue[i].t <= 0) {
        this.spawn(this.spawnQueue[i].key);
        this.spawnQueue.splice(i, 1);
      }
    }

    // --- input / player ---
    let ix = 0;
    let iy = 0;
    const k = this.keys;
    if (k.has("a") || k.has("arrowleft")) ix -= 1;
    if (k.has("d") || k.has("arrowright")) ix += 1;
    if (k.has("w") || k.has("arrowup")) iy -= 1;
    if (k.has("s") || k.has("arrowdown")) iy += 1;
    if (this.touchMove) {
      const dx = this.touchMove.x - this.touchMove.ox;
      const dy = this.touchMove.y - this.touchMove.oy;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const f = Math.min(1, d / 58);
        ix += (dx / d) * f;
        iy += (dy / d) * f;
      }
    }
    const mag = Math.hypot(ix, iy);
    if (mag > 1) {
      ix /= mag;
      iy /= mag;
    }
    const p = this.player;
    p.vx += (ix * p.speed - p.vx) * Math.min(1, dt * 12);
    p.vy += (iy * p.speed - p.vy) * Math.min(1, dt * 12);
    p.x = clamp(p.x + p.vx * dt, 18, this.w - 18);
    p.y = clamp(p.y + p.vy * dt, 18, this.h - 18);
    if (this.bonus) {
      // full vertical freedom — the defender may fly the entire canvas,
      // only stopping short of overlapping the vault itself.
      p.y = clamp(p.y, p.r + 4, this.vault.y - this.vault.h / 2 - p.r - 4);
    }
    p.recoil = Math.max(0, p.recoil - dt * 5);
    p.hurt = Math.max(0, p.hurt - dt * 2);

    this.cash = Math.min(this.cashMax, this.cash + this.cashRegen * (1 + this.levels.consolidate * 0.35) * dt);
    if (this.snowballTimer > 0) this.snowballTimer -= dt;

    // --- powerup timers ---
    for (const key of Object.keys(this.actives) as PowerId[]) {
      const v = (this.actives[key] ?? 0) - dt;
      if (v <= 0) {
        delete this.actives[key];
        this.addFloater(this.player.x, this.player.y - 34, POWERS[key].short + " ENDED", "#ffffff", 13, false);
      } else this.actives[key] = v;
    }

    // --- bonus vault blocks (steady for 10 waves, tapering to 1/wave at 50) ---
    if (this.waveActive) {
      const rate = this.blockRate();
      const underCap = this.blocksThisWave < rate.maxPerWave;
      if (underCap) {
        this.blockTimer -= dt;
        if (this.blockTimer <= 0 && this.blocks.length < rate.concurrent) {
          this.blockTimer = this.nextBlockDelay();
          // boss waves and wave 50+ guarantee their vaults; earlier bands roll
          if (this.isBossWave || this.wave >= 50 || Math.random() < rate.chance) {
            this.blocksThisWave++;
            this.spawnBlock();
          }
        }
      }
    }
    for (const b of this.blocks) {
      b.x = clamp(b.x + b.vx * dt, 50, this.w - 50);
      b.y = clamp(b.y + b.vy * dt, 50, this.h - 50);
      if (b.x <= 50 || b.x >= this.w - 50) b.vx *= -1;
      if (b.y <= 50 || b.y >= this.h - 50) b.vy *= -1;
      b.rot += dt * 0.8;
      b.flash = Math.max(0, b.flash - dt * 5);
    }
    this.blocks = this.blocks.filter((b) => !b.dead);

    // --- pickups ---
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pu = this.pickups[i];
      pu.life -= dt;
      pu.bob += dt * 4;
      const dx = p.x - pu.x;
      const dy = p.y - pu.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 190) {
        const pull = (1 - d / 190) * 420;
        pu.vx += (dx / d) * pull * dt;
        pu.vy += (dy / d) * pull * dt;
      }
      pu.vx *= 1 - 1.4 * dt;
      pu.vy *= 1 - 1.4 * dt;
      pu.x = clamp(pu.x + pu.vx * dt, 20, this.w - 20);
      pu.y = clamp(pu.y + pu.vy * dt, 20, this.h - 20);
      if (d < p.r + 20) {
        this.collect(pu);
        this.pickups.splice(i, 1);
      } else if (pu.life <= 0) this.pickups.splice(i, 1);
    }
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // --- boss / bonus stage ---
    this.updateBoss(dt);
    this.updateBonus(dt);

    // --- hazards (arena obstacles) ---
    for (const hz of this.hazards) {
      hz.rot += hz.spin * dt;
      hz.pulse += dt * 2;
      hz.flash = Math.max(0, hz.flash - dt * 4);
      // keep rocks on-screen after a resize / orientation change
      hz.x = clamp(hz.x, hz.r + 8, Math.max(hz.r + 8, this.w - hz.r - 8));
      hz.y = clamp(hz.y, hz.r + 8, Math.max(hz.r + 8, this.h - hz.r - 8));

      const pdx = p.x - hz.x;
      const pdy = p.y - hz.y;
      const pd = Math.hypot(pdx, pdy);
      if (pd < hz.r + p.r) {
        const push = (hz.r + p.r - pd) / (pd || 1);
        p.x += pdx * push;
        p.y += pdy * push;
        p.vx *= 0.6;
        p.vy *= 0.6;
      }

      // NOTE: Debt Beasts phase straight through obstacles — debt doesn't
      // respect cover. Rocks only block shots and the player ship.
    }

    // --- enemy projectiles ---
    const shieldOn = this.has("shield");
    for (let i = this.foes.length - 1; i >= 0; i--) {
      const f = this.foes[i];
      f.life -= dt;
      f.spin += dt * 6;
      if (f.homing) {
        const a = Math.atan2(this.player.y - f.y, this.player.x - f.x);
        const sp = Math.hypot(f.vx, f.vy);
        f.vx += (Math.cos(a) * sp - f.vx) * Math.min(1, dt * 1.4);
        f.vy += (Math.sin(a) * sp - f.vy) * Math.min(1, dt * 1.4);
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.life <= 0 || f.x < -40 || f.x > this.w + 40 || f.y < -40 || f.y > this.h + 40) {
        this.foes.splice(i, 1);
        continue;
      }
      // blocked by arena obstacles
      let blocked = false;
      for (const hz of this.hazards) {
        if (Math.hypot(hz.x - f.x, hz.y - f.y) < hz.r + f.r) {
          hz.flash = 1;
          this.burst(f.x, f.y, f.color, 5);
          this.foes.splice(i, 1);
          blocked = true;
          break;
        }
      }
      if (blocked) continue;
      // hits the player: drains cash flow
      if (Math.hypot(p.x - f.x, p.y - f.y) < p.r + f.r) {
        this.foes.splice(i, 1);
        p.hurt = 1;
        this.cash = Math.max(0, this.cash - 26);
        this.shake = Math.max(this.shake, 8);
        this.burst(f.x, f.y, f.color, 12);
        this.addFloater(p.x, p.y - 30, "LATE FEE", "#ff6b6b", 15, false);
        audio.coreHit();
        continue;
      }
      // bonus stage: shots that get past you chip the vault's value
      if (this.bonus) {
        if (this.hitsVault(f.x, f.y, f.r)) {
          this.foes.splice(i, 1);
          if (!shieldOn) this.damageVault(this.vault.max * 0.022, f.x, "HIT");
          this.burst(f.x, f.y, f.color, 12);
        }
        continue;
      }
      // hits the core
      if (Math.hypot(this.core.x - f.x, this.core.y - f.y) < this.core.r + f.r) {
        this.foes.splice(i, 1);
        if (!shieldOn) {
          this.core.hp -= f.dmg;
          this.core.flash = 1;
          this.shake = Math.max(this.shake, 7);
        }
        this.burst(f.x, f.y, f.color, 14);
        continue;
      }
    }

    // --- aim & auto fire ---
    const target = this.pickTarget();
    this.targetId = target ? target.id : null;
    // the boss outranks regular debts once it has entered the arena
    const bossActive = !!this.boss && !this.boss.dead && this.boss.entry <= 0;
    const aimAtBoss =
      bossActive &&
      (!target ||
        Math.hypot(this.boss!.x - p.x, this.boss!.y - p.y) <
          Math.hypot(target.x - p.x, target.y - p.y) * 1.45);
    // bonus stage: lock on to the nearest danmaku sprite
    let sprite: Sprite | null = null;
    if (this.bonus) {
      let bd = Infinity;
      for (const s of this.sprites) {
        if (s.dead || s.y < -10) continue;
        const d = Math.hypot(s.x - p.x, s.y - p.y);
        if (d < bd) {
          bd = d;
          sprite = s;
        }
      }
    }
    if (this.bonus) {
      // Classic vertical shooter: the ship always fires straight up,
      // with a tiny tilt toward the nearest raider for readability.
      let want = -Math.PI / 2;
      if (sprite) want += clamp((sprite.x - p.x) / 420, -0.3, 0.3);
      const diff = ((want - p.angle + Math.PI * 3) % TAU) - Math.PI;
      p.angle += diff * Math.min(1, dt * 16);
    } else {
      const aimX = aimAtBoss ? this.boss!.x : target?.x;
      const aimY = aimAtBoss ? this.boss!.y : target?.y;
      if (aimX !== undefined && aimY !== undefined) {
        const want = Math.atan2(aimY - p.y, aimX - p.x);
        const diff = ((want - p.angle + Math.PI * 3) % TAU) - Math.PI;
        p.angle += diff * Math.min(1, dt * 14);
      }
    }
    this.fireCd -= dt;
    if ((target || bossActive || this.bonus) && this.fireCd <= 0) {
      this.fireCd = 1 / this.fireRate;
      this.shootMin(p.angle);
    }

    // --- enemies ---
    const slow = 1 - Math.min(0.75, this.levels.refinance * 0.18 + Math.max(0, this.levels.refinance - 1) * 0.06);
    const frozen = this.has("freeze");
    const magnet = this.has("magnet");
    const shielded = this.has("shield");
    const aprS = this.diff.aprScale * (frozen ? 0 : 1);
    for (const e of this.enemies) {
      // compound interest: monthly rate applied per second
      e.interest += ((e.principal * e.def.apr) / 12) * dt * 1.15 * aprS;
      e.interest += ((e.interest * e.def.apr) / 12) * dt * aprS;
      const bal = e.principal + e.interest;
      e.r = 11 + Math.sqrt(bal) * 0.16;
      e.rot += e.spin * dt;
      e.wobble += dt * 3;
      e.flash = Math.max(0, e.flash - dt * 5);
      e.critFlash = Math.max(0, e.critFlash - dt * 3);

      const dx = this.core.x - e.x;
      const dy = this.core.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = this.core.r + e.r - 6;
      // Refinance Barrier field: extra drag once a beast crosses the green shell
      e.chilled = this.levels.refinance > 0 && d < this.refiRadius + e.r;
      const fieldSlow = e.chilled ? 1 - Math.min(0.45, 0.14 + this.levels.refinance * 0.07) : 1;
      if (e.chilled && Math.random() < dt * 5) {
        this.particles.push({
          x: e.x + rand(-e.r, e.r),
          y: e.y + rand(-e.r, e.r),
          vx: rand(-20, 20),
          vy: rand(-30, 10),
          life: 0.5,
          max: 0.5,
          size: rand(1, 2.4),
          color: "#b7ff2e",
          type: 0,
        });
      }
      if (magnet) {
        // Garnishment: debts are flung to the far edges but stay fully on-screen.
        // Keep the whole body + health bars visible inside the viewport.
        const pad = e.r + 26;
        const minX = pad;
        const maxX = this.w - pad;
        const minY = pad;
        const maxY = this.h - pad;
        // How far out along the core→edge ray this beast can travel.
        const ux = -dx / d;
        const uy = -dy / d;
        let maxT = Infinity;
        if (ux > 0.0001) maxT = Math.min(maxT, (maxX - e.x) / ux);
        else if (ux < -0.0001) maxT = Math.min(maxT, (minX - e.x) / ux);
        if (uy > 0.0001) maxT = Math.min(maxT, (maxY - e.y) / uy);
        else if (uy < -0.0001) maxT = Math.min(maxT, (minY - e.y) / uy);
        if (!isFinite(maxT)) maxT = 0;
        maxT = Math.max(0, maxT);
        // Ease out as it nears the rim so it parks at the edge instead of slamming.
        const step = Math.min(maxT, 420 * dt * Math.min(1, maxT / 90));
        e.x += ux * step;
        e.y += uy * step;
        e.x = clamp(e.x, minX, maxX);
        e.y = clamp(e.y, minY, maxY);
        if (maxT < 6 && Math.random() < dt * 8) {
          this.particles.push({
            x: e.x,
            y: e.y,
            vx: rand(-40, 40),
            vy: rand(-40, 40),
            life: 0.35,
            max: 0.35,
            size: rand(1, 2.6),
            color: POWERS.magnet.color,
            type: 0,
          });
        }
      }
      if (d > reach && !magnet) {
        e.attacking = false;
        const sp =
          e.def.speed *
          (1 + Math.min(0.6, e.interest / Math.max(1, e.principal))) *
          slow *
          fieldSlow *
          this.diff.speedScale *
          (frozen ? 0.18 : 1);
        e.x += (dx / d) * sp * dt;
        e.y += (dy / d) * sp * dt;
      } else if (d <= reach) {
        e.attacking = true;
        const dps = shielded ? 0 : bal * 0.045;
        this.core.hp -= dps * dt;
        if (!shielded) {
          this.core.flash = Math.min(1, this.core.flash + dt * 2);
          if (Math.random() < dt * 1.6) audio.coreHit();
        }
        if (Math.random() < dt * 14) {
          this.particles.push({
            x: e.x + rand(-e.r, e.r),
            y: e.y + rand(-e.r, e.r),
            vx: -(dx / d) * rand(20, 90),
            vy: -(dy / d) * rand(20, 90),
            life: 0.5,
            max: 0.5,
            size: rand(1, 3),
            color: e.def.color,
            type: 0,
          });
        }
      }
      // nudge player
      const pdx = p.x - e.x;
      const pdy = p.y - e.y;
      const pd = Math.hypot(pdx, pdy);
      if (pd < e.r + p.r) {
        const push = (e.r + p.r - pd) * 6;
        p.x += (pdx / (pd || 1)) * push * dt * 10;
        p.y += (pdy / (pd || 1)) * push * dt * 10;
        if (p.hurt <= 0) {
          p.hurt = 1;
          this.cash = Math.max(0, this.cash - 12);
          this.shake = Math.max(this.shake, 4);
        }
      }
    }
    this.core.flash = Math.max(0, this.core.flash - dt * 1.4);

    // --- bullets ---
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > this.w + 40 || b.y < -40 || b.y > this.h + 40) {
        this.bullets.splice(i, 1);
        continue;
      }
      let consumed = false;
      // arena obstacles absorb shots
      for (const hz of this.hazards) {
        if (Math.hypot(hz.x - b.x, hz.y - b.y) < hz.r + b.r) {
          hz.flash = 1;
          this.burst(b.x, b.y, "#8fa6ff", 4);
          this.bullets.splice(i, 1);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;
      // bonus-stage sprites
      if (this.bonus) {
        let hitS = false;
        for (const s of this.sprites) {
          if (s.dead) continue;
          if (Math.hypot(s.x - b.x, s.y - b.y) < s.r + b.r) {
            this.hitSprite(s, b.dmg * (b.over ? 2.2 : 1), b.x, b.y);
            b.pierce--;
            if (b.pierce <= 0) {
              this.bullets.splice(i, 1);
              hitS = true;
            }
            break;
          }
        }
        if (hitS) continue;
      }
      // boss hit
      const bs = this.boss;
      if (bs && !bs.dead && bs.entry <= 0 && Math.hypot(bs.x - b.x, bs.y - b.y) < bs.r + b.r) {
        this.hitBoss(b.dmg, b.over, b.x, b.y);
        this.bullets.splice(i, 1);
        continue;
      }
      for (const bl of this.blocks) {
        if (bl.dead) continue;
        if (Math.abs(bl.x - b.x) < 26 && Math.abs(bl.y - b.y) < 26) {
          bl.hp -= b.dmg * (b.over ? 1.6 : 1);
          bl.flash = 1;
          this.burst(b.x, b.y, "#ffe14d", 5);
          this.addFloater(bl.x, bl.y - 34, "-" + fmt(b.dmg), "#ffe14d", 12, false);
          if (bl.hp <= 0) this.breakBlock(bl);
          this.bullets.splice(i, 1);
          consumed = true;
          break;
        }
      }
      if (consumed) continue;
      for (const e of this.enemies) {
        if (e.dead || b.hit.includes(e.id)) continue;
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          b.hit.push(e.id);
          this.hitEnemy(e, b);
          b.pierce--;
          if (b.pierce <= 0) {
            this.bullets.splice(i, 1);
            break;
          }
        }
      }
    }
    this.blocks = this.blocks.filter((b) => !b.dead);

    // --- cleanup / kills handled in hitEnemy ---
    this.enemies = this.enemies.filter((e) => !e.dead);

    // --- particles ---
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pa = this.particles[i];
      pa.life -= dt;
      if (pa.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      pa.x += pa.vx * dt;
      pa.y += pa.vy * dt;
      if (pa.type === 1) {
        pa.vy += 520 * dt;
        pa.vx *= 1 - 1.2 * dt;
        pa.rot = (pa.rot || 0) + (pa.spin || 0) * dt;
      } else {
        pa.vx *= 1 - 2.4 * dt;
        pa.vy *= 1 - 2.4 * dt;
      }
    }
    if (this.particles.length > 520) this.particles.splice(0, this.particles.length - 520);

    // --- floaters ---
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 1 - 1.6 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }

    // --- shake ---
    this.shake = Math.max(0, this.shake - dt * 26);
    const s = this.shake;
    this.shakeX = rand(-s, s);
    this.shakeY = rand(-s, s);
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.4);

    // --- wave complete ---
    if (
      this.waveActive &&
      !this.spawnQueue.length &&
      !this.enemies.length &&
      !this.boss &&
      !this.bonus &&
      !this.sprites.length &&
      !this.pickups.length // let the player sweep up any loose spoils first
    ) {
      this.waveActive = false;
      this.blocks = [];
      this.pickups = [];
      this.hazards = [];
      this.foes = [];
      audio.stopMusic();
      audio.ui();
      this.score += 2500 * this.wave * this.diff.scoreMult;
      this.addFloater(this.core.x, this.core.y - 70, "WAVE CLEARED", "#b7ff2e", 30, true);
      this.setPhase("upgrade");
      this.emitHud();
      this.cb.onWaveComplete(this.wave, this.rollChoices());
    }

    // --- game over ---
    audio.setIntensity(1 - clamp(this.core.hp / this.core.max, 0, 1));
    if (this.core.hp <= 0 && this.phase === "running") {
      this.core.hp = 0;
      audio.gameOver();
      this.explodeCore();
      this.setPhase("over");
      this.cb.onGameOver(Math.floor(this.score), this.wave, this.killed);
    }

    if (this.hudT > 0.08) {
      this.hudT = 0;
      this.emitHud();
    }
  }

  emitHud() {
    this.cb.onHud({
      score: Math.floor(this.score),
      wave: this.wave,
      coreHp: Math.max(0, this.core.hp),
      coreMax: this.core.max,
      cash: this.cash,
      fireRate: this.fireRate,
      enemiesLeft: this.enemies.length + this.spawnQueue.length,
      combo: this.combo,
      snowballTimer: Math.max(0, this.snowballTimer),
      totalKilled: this.killed,
      levels: { ...this.levels },
      beamName: this.beam.name,
      beamColor: this.beam.color,
      beamTier: this.beam.tier,
      beamStep: this.beam.index,
      upgradePoints: this.upgradePoints,
      stageName: this.theme.name,
      stageColor: this.theme.colors.a,
      principalCleared: this.principalCleared,
      interestKilled: this.interestKilled,
      powerBlocks: this.blocksBroken,
      bonus: this.bonus
        ? {
            left: Math.max(0, this.bonusMax - this.bonusTime),
            total: this.bonusMax,
            kills: this.bonusKills,
            earned: this.bonusScore,
            vault: Math.max(0, this.vault.value),
            vaultMax: this.vault.max,
            leaks: this.bonusLeaks,
          }
        : null,
      boss:
        this.boss && !this.boss.dead
          ? {
              name: this.boss.def.name,
              title: this.boss.def.title,
              glyph: this.boss.def.glyph,
              color: this.boss.def.color,
              principal: Math.max(0, this.boss.principal),
              maxPrincipal: this.boss.maxPrincipal,
              interest: Math.max(0, this.boss.interest),
              phase: this.boss.phase,
            }
          : null,
      actives: (Object.keys(this.actives) as PowerId[]).map((k) => ({
        id: k,
        left: this.actives[k] ?? 0,
        total: POWERS[k].duration,
      })),
    });
  }

  rollChoices(): UpgradeId[] {
    const core: UpgradeId[] = ["avalanche", "snowball", "refinance"];
    const extra: UpgradeId[] = ["emergency", "consolidate"];
    const pick: UpgradeId[] = [];
    const shuffled = [...core].sort(() => Math.random() - 0.5);
    pick.push(shuffled[0], shuffled[1]);
    const third = Math.random() < 0.5 ? shuffled[2] : extra[Math.floor(Math.random() * extra.length)];
    pick.push(third);
    return pick.sort(() => Math.random() - 0.5);
  }

  applyUpgrade(id: UpgradeId) {
    this.levels[id]++;
    const lvl = this.levels[id];
    if (id === "refinance") {
      const cost = Math.floor(this.score * 0.12);
      this.score = Math.max(0, this.score - cost);
      this.addFloater(this.core.x, this.core.y + 40, "-" + fmt(cost) + " REFI FEE", "#ff6b6b", 20, true);
    }
    if (id === "emergency") {
      this.core.max *= 1.08;
      this.core.hp = Math.min(this.core.max, this.core.hp + 25000 + (lvl - 1) * 5000);
    }
    if (id === "consolidate") this.cashMax += 15;
    audio.upgrade();
    const nb = this.beam;
    this.addFloater(
      this.player.x,
      this.player.y - 42,
      `BEAM → ${nb.name}${nb.tier > 0 ? " MK" + (nb.tier + 1) : ""}`,
      nb.color,
      22,
      true,
    );
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: Math.cos(a) * rand(60, 300),
        vy: Math.sin(a) * rand(60, 300),
        life: rand(0.3, 0.7),
        max: 0.7,
        size: rand(1.5, 3.5),
        color: i % 2 ? nb.color : nb.core,
        type: 0,
      });
    }
    this.flashAlpha = 0.5;
    this.setPhase("running");
    this.nextWave();
  }

  shootMin(ang: number) {
    const beam = this.beam;
    const dmg = (430 * (1 + this.wave * 0.12) + this.killed * 14) * beam.damageMult;
    const spread = this.has("multishot") ? [-0.26, -0.13, 0, 0.13, 0.26] : [0];
    for (const off of spread) {
      const a = ang + off + rand(-0.045, 0.045);
      this.bullets.push({
        x: this.player.x + Math.cos(ang) * 16,
        y: this.player.y + Math.sin(ang) * 16,
        vx: Math.cos(a) * 760,
        vy: Math.sin(a) * 760,
        dmg: spread.length > 1 ? dmg * 0.72 : dmg,
        over: false,
        life: 1.1,
        pierce: 1 + this.levels.avalanche,
        hit: [],
        color: spread.length > 1 ? POWERS.multishot.color : beam.color,
        r: beam.radius,
      });
    }
    audio.shoot();
    this.player.recoil = Math.min(1, this.player.recoil + 0.35);
    this.particles.push({
      x: this.player.x + Math.cos(ang) * 18,
      y: this.player.y + Math.sin(ang) * 18,
      vx: Math.cos(ang) * 60,
      vy: Math.sin(ang) * 60,
      life: 0.12,
      max: 0.12,
      size: 4 + beam.tier * 1.6,
      color: beam.core,
      type: 0,
    });
  }

  hitEnemy(e: Enemy, b: Bullet) {
    const isAvalancheTarget = this.levels.avalanche > 0 && e.id === this.targetId;
    let dmg = b.dmg;
    let crit = false;
    if (isAvalancheTarget) {
      dmg *= 1 + (0.5 + this.levels.avalanche * 0.25);
      crit = true;
    }
    e.flash = 1;
    if (b.over) {
      // overpayment: straight to principal
      e.critFlash = 1;
      e.principal -= dmg;
      this.addFloater(e.x + rand(-8, 8), e.y - e.r - 6, "-" + fmt(dmg), crit ? "#ff3d9e" : "#ffe14d", crit ? 22 : 18, crit);
      this.shake = Math.max(this.shake, 5);
      this.burst(b.x, b.y, "#ffe14d", 10);
    } else {
      if (e.interest > 0) {
        const applied = Math.min(e.interest, dmg);
        e.interest -= applied;
        const left = dmg - applied;
        if (left > 0) e.principal -= left * 0.18;
        this.addFloater(e.x + rand(-10, 10), e.y - e.r - 4, "-" + fmt(applied), "#ffd84d", 14, false);
      } else {
        e.principal -= dmg * 0.18;
        this.addFloater(e.x + rand(-10, 10), e.y - e.r - 4, "-" + fmt(dmg * 0.18), "#ff8fbf", 13, false);
      }
      this.burst(b.x, b.y, e.def.color, 4);
      if (Math.random() < 0.3) audio.hit();
    }
    if (e.principal <= 0) this.kill(e);
  }

  kill(e: Enemy, fromShockwave = false) {
    if (e.dead) return;
    e.dead = true;
    this.killed++;
    this.combo++;
    this.comboTimer = 3;

    // smallest debt on field? (snowball)
    let smallest = true;
    for (const o of this.enemies) {
      if (o === e || o.dead) continue;
      if (o.maxPrincipal < e.maxPrincipal) smallest = false;
    }
    const balAtKill = Math.max(0, e.maxPrincipal) + e.interest;
    const jackpot = this.has("jackpot") ? 2 : 1;
    const lifetimeSaved =
      (balAtKill + e.maxPrincipal * e.def.apr * 8) *
      (1 + this.combo * 0.05) *
      this.diff.scoreMult *
      jackpot;
    this.score += lifetimeSaved;
    this.principalCleared += e.maxPrincipal;
    this.interestKilled += Math.max(0, e.interest);
    audio.kill(e.r);

    this.bonusFireRate = Math.min(9, this.bonusFireRate + 0.11);
    this.shake = Math.max(this.shake, Math.min(22, 8 + e.r * 0.25));
    this.flashAlpha = Math.max(this.flashAlpha, 0.22);

    this.addFloater(e.x, e.y - e.r - 12, "SAVED " + fmt(lifetimeSaved), "#b7ff2e", 24, true);
    this.addFloater(e.x, e.y + 6, "+CASH FLOW", "#35f3ff", 14, false);
    if (this.combo > 2) this.addFloater(e.x, e.y + 24, `x${this.combo} STREAK`, "#ff3d9e", 15, false);

    this.confetti(e.x, e.y, e.def.color, Math.floor(clamp(e.r * 1.6, 18, 60)));
    this.particles.push({
      x: e.x,
      y: e.y,
      vx: 0,
      vy: 0,
      life: 0.5,
      max: 0.5,
      size: e.r,
      color: e.def.color,
      type: 2,
    });

    if (this.levels.snowball > 0 && smallest && !fromShockwave) {
      this.snowballTimer = 4 + this.levels.snowball;
      this.shockwave(e.x, e.y);
    }
  }

  shockwave(x: number, y: number) {
    const radius = 190 + this.levels.snowball * 35;
    const dmg = 2600 * (1 + this.levels.snowball * 0.5);
    this.particles.push({ x, y, vx: 0, vy: 0, life: 0.6, max: 0.6, size: radius, color: "#35f3ff", type: 2 });
    this.addFloater(x, y - 36, "SNOWBALL!", "#35f3ff", 26, true);
    this.shake = Math.max(this.shake, 16);
    for (const o of this.enemies) {
      if (o.dead) continue;
      if (Math.hypot(o.x - x, o.y - y) < radius + o.r) {
        const applied = Math.min(o.interest, dmg);
        o.interest -= applied;
        o.principal -= (dmg - applied) * 0.3;
        o.flash = 1;
        this.addFloater(o.x, o.y - o.r, "-" + fmt(dmg), "#35f3ff", 16, false);
        if (o.principal <= 0) this.kill(o, true);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  explodeCore() {
    for (let i = 0; i < 120; i++) {
      const a = Math.random() * TAU;
      const s = rand(60, 620);
      this.particles.push({
        x: this.core.x,
        y: this.core.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: rand(0.5, 1.4),
        max: 1.4,
        size: rand(2, 6),
        color: ["#ff3d9e", "#ffc400", "#ffffff"][i % 3],
        type: 0,
      });
    }
    this.shake = 30;
    this.flashAlpha = 0.9;
  }

  burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * rand(40, 260),
        vy: Math.sin(a) * rand(40, 260),
        life: rand(0.18, 0.4),
        max: 0.4,
        size: rand(1.2, 3),
        color,
        type: 0,
      });
    }
  }

  confetti(x: number, y: number, color: string, n: number) {
    const palette = [color, "#ffffff", "#b7ff2e", "#35f3ff", "#ff3d9e", "#ffc400"];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const s = rand(80, 460);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 120,
        life: rand(0.6, 1.3),
        max: 1.3,
        size: rand(3, 7),
        color: palette[Math.floor(Math.random() * palette.length)],
        type: 1,
        rot: Math.random() * TAU,
        spin: rand(-12, 12),
      });
    }
  }

  addFloater(
    x: number,
    y: number,
    text: string,
    color: string,
    size: number,
    big: boolean,
    keep = false,
  ) {
    if (this.floaters.length > 60) {
      // never evict a protected callout to make room
      const i = this.floaters.findIndex((f) => !f.keep);
      this.floaters.splice(i >= 0 ? i : 0, 1);
    }
    // keep the text inside the viewport so callouts are never clipped
    const halfW = text.length * size * 0.33 + 10;
    const cx = clamp(x, halfW, Math.max(halfW, this.w - halfW));
    const cy = clamp(y, size + 14, Math.max(size + 14, this.h - 24));
    this.floaters.push({
      x: cx,
      y: cy,
      vy: big ? -62 : -44,
      life: big ? 1.3 : 0.85,
      text,
      color,
      size,
      big,
      keep,
    });
  }

  // ---------------- render ----------------
  render() {
    const ctx = this.ctx;
    const { w, h } = this;
    ctx.save();
    ctx.translate(this.shakeX, this.shakeY);

    // bg — tinted by the current stage theme
    const pal = this.theme.colors;
    const g = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, pal.fog);
    g.addColorStop(1, "#05030f");
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, w + 80, h + 80);

    // grid
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    const step = 56;
    const off = (this.time * 10) % step;
    ctx.beginPath();
    for (let x = -step + off; x < w + step; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = -step + off; y < h + step; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
    ctx.stroke();

    // stars — streak downward during the bonus surge stage
    if (this.bonus) {
      for (const s of this.stars) {
        const y = (s.y + this.scrollY * s.z) % (h + 40);
        ctx.fillStyle = `rgba(190,230,255,${0.2 + s.z * 0.5})`;
        ctx.fillRect(s.x, y, s.z * 1.6, 6 + s.z * 16);
      }
    } else {
      for (const s of this.stars) {
        ctx.fillStyle = `rgba(200,220,255,${0.12 + s.z * 0.25})`;
        ctx.fillRect(s.x, s.y, s.z * 2, s.z * 2);
      }
    }

    // boss arena floor plate
    if (this.boss) {
      const pal2 = this.theme.colors;
      const R = Math.min(w, h) * 0.42;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.13;
      ctx.strokeStyle = pal2.a;
      ctx.lineWidth = 2;
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        ctx.arc(this.core.x, this.core.y, (R / 4) * i, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + this.time * 0.08;
        ctx.beginPath();
        ctx.moveTo(this.core.x, this.core.y);
        ctx.lineTo(this.core.x + Math.cos(a) * R, this.core.y + Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = this.boss.def.color;
      ctx.beginPath();
      ctx.arc(this.core.x, this.core.y, R, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    if (!this.bonus) {
      this.drawCoreAuras(ctx);
      this.drawCore(ctx);
    }

    // bullets
    const beam = this.beam;
    for (const b of this.bullets) {
      const outer = b.over ? 5 : beam.lineWidth;
      const tx = b.x - b.vx * 0.022;
      const ty = b.y - b.vy * 0.022;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";
      // outer glow pass
      ctx.strokeStyle = b.color;
      ctx.lineWidth = outer;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.over ? 18 : 10 + beam.tier * 5;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      // hot white-ish core
      ctx.shadowBlur = 0;
      ctx.strokeStyle = b.over ? "#fffbe6" : beam.core;
      ctx.lineWidth = Math.max(1, outer * 0.42);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.restore();
    }

    this.drawVault(ctx);
    this.drawHazards(ctx);
    this.drawSprites(ctx);
    this.drawBoss(ctx);
    this.drawBlocks(ctx);
    for (const e of this.enemies) this.drawEnemy(ctx, e);
    this.drawFoes(ctx);
    this.drawPickups(ctx);

    this.drawPlayerAuras(ctx);
    this.drawPowerAuras(ctx);
    this.drawPlayer(ctx);

    // particles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      const t = p.life / p.max;
      if (p.type === 2) {
        ctx.globalAlpha = Math.max(0, t * 0.8);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 + (1 - t) * 6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.4 - t) * 1.6, 0, TAU);
        ctx.stroke();
      } else if (p.type === 1) {
        ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.6));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      } else {
        ctx.globalAlpha = Math.max(0, t);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
      }
    }
    ctx.restore();

    // floaters
    ctx.textAlign = "center";
    for (const f of this.floaters) {
      const a = Math.min(1, f.life * 2.2);
      ctx.globalAlpha = a;
      ctx.font = `${f.big ? 900 : 700} ${f.size}px Orbitron, Rajdhani, sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = f.big ? 16 : 6;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    // touch joystick
    if (this.touchMove) {
      const t = this.touchMove;
      ctx.strokeStyle = "rgba(53,243,255,0.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.ox, t.oy, 54, 0, TAU);
      ctx.stroke();
      const dx = t.x - t.ox;
      const dy = t.y - t.oy;
      const d = Math.hypot(dx, dy) || 1;
      const cl = Math.min(d, 54);
      ctx.fillStyle = "rgba(53,243,255,0.5)";
      ctx.beginPath();
      ctx.arc(t.ox + (dx / d) * cl, t.oy + (dy / d) * cl, 20, 0, TAU);
      ctx.fill();
    }

    ctx.restore();

    if (this.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,255,255,${this.flashAlpha * 0.5})`;
      ctx.fillRect(0, 0, w, h);
    }

    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.65)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  drawCore(ctx: CanvasRenderingContext2D) {
    const { x, y, r } = this.core;
    const hpRatio = clamp(this.core.hp / this.core.max, 0, 1);
    const pulse = 1 + Math.sin(this.time * 3) * 0.04;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const rr = r * (1.5 + i * 0.45) + Math.sin(this.time * 2 + i) * 6;
      ctx.strokeStyle = `rgba(53,243,255,${0.16 - i * 0.045})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rr, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    const g = ctx.createRadialGradient(x, y, 2, x, y, r * pulse);
    const dmgTint = this.core.flash;
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.35, dmgTint > 0.2 ? "#ff5f8f" : "#35f3ff");
    g.addColorStop(1, "rgba(20,8,60,0.9)");
    ctx.fillStyle = g;
    ctx.shadowColor = dmgTint > 0.2 ? "#ff3d9e" : "#35f3ff";
    ctx.shadowBlur = 36;
    ctx.beginPath();
    ctx.arc(x, y, r * pulse, 0, TAU);
    ctx.fill();
    ctx.shadowBlur = 0;

    // rotating hex shield showing hp
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(this.time * 0.4);
    ctx.strokeStyle = hpRatio > 0.35 ? "#b7ff2e" : "#ff3d9e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, r + 12, -Math.PI / 2, -Math.PI / 2 + TAU * hpRatio);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "700 11px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NET WORTH", x, y + 4);
    ctx.font = "900 13px Orbitron, sans-serif";
    ctx.fillText(fmt(this.core.hp), x, y + 20);
  }

  drawSprites(ctx: CanvasRenderingContext2D) {
    if (!this.sprites.length) return;
    for (const s of this.sprites) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.sin(s.t * 2) * 0.25);
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = s.flash > 0.15 ? "#ffffff" : s.color + "3a";
      ctx.strokeStyle = s.flash > 0.15 ? "#ffffff" : s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (s.kind === 3) {
        // turret: hexagon
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const px = Math.cos(a) * s.r;
          const py = Math.sin(a) * s.r;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
      } else {
        // fighter: downward dart
        ctx.moveTo(0, s.r);
        ctx.lineTo(s.r, -s.r * 0.6);
        ctx.lineTo(0, -s.r * 0.2);
        ctx.lineTo(-s.r, -s.r * 0.6);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // hp pip
      if (s.hp < s.maxHp) {
        ctx.fillStyle = "rgba(0,0,0,.55)";
        ctx.fillRect(s.x - 13, s.y - s.r - 9, 26, 3);
        ctx.fillStyle = s.color;
        ctx.fillRect(s.x - 13, s.y - s.r - 9, 26 * clamp(s.hp / s.maxHp, 0, 1), 3);
      }
    }
  }

  drawHazards(ctx: CanvasRenderingContext2D) {
    if (!this.hazards.length) return;
    const pal = this.theme.colors;
    for (const hz of this.hazards) {
      const breathe = 1 + Math.sin(hz.pulse) * 0.05;
      ctx.save();
      ctx.translate(hz.x, hz.y);
      ctx.rotate(hz.rot);
      // solid asteroid-ish body
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TAU;
        const rr = hz.r * breathe * (0.84 + ((i * 37) % 10) / 44);
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = hz.flash > 0.1 ? "rgba(255,255,255,.65)" : "rgba(14,10,34,.92)";
      ctx.fill();
      ctx.strokeStyle = hz.flash > 0.1 ? "#ffffff" : pal.a;
      ctx.lineWidth = 2;
      ctx.shadowColor = pal.a;
      ctx.shadowBlur = 14;
      ctx.stroke();
      // inner circuitry
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, hz.r * 0.45, 0, TAU);
      ctx.strokeStyle = pal.b;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawFoes(ctx: CanvasRenderingContext2D) {
    if (!this.foes.length) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const f of this.foes) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.spin);
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 16;
      ctx.fillStyle = f.color;
      if (f.homing) {
        // envelope-shaped "collection notice"
        ctx.fillRect(-f.r, -f.r * 0.7, f.r * 2, f.r * 1.4);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-f.r, -f.r * 0.7);
        ctx.lineTo(0, f.r * 0.2);
        ctx.lineTo(f.r, -f.r * 0.7);
        ctx.stroke();
      } else {
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU;
          const rr = i % 2 ? f.r * 0.5 : f.r;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(0, 0, f.r * 0.32, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  drawBoss(ctx: CanvasRenderingContext2D) {
    const b = this.boss;
    if (!b || b.dead) return;
    const def = b.def;
    const entering = b.entry > 0;
    ctx.save();
    ctx.globalAlpha = entering ? clamp(1 - b.entry, 0.15, 1) : 1;

    // threat aura
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i % 2 ? def.accent : def.color;
      ctx.globalAlpha = 0.18 - i * 0.045;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r + 18 + i * 16 + Math.sin(this.time * 2 + i) * 6, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // armoured body: layered rotating polygons
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 34;
    for (let layer = 0; layer < 3; layer++) {
      const sides = 6 + layer;
      const rr = b.r * (1 - layer * 0.21);
      const dir = layer % 2 ? -1 : 1;
      ctx.save();
      ctx.rotate(b.rot * dir * (1 + layer * 0.4));
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * TAU;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle =
        b.flash > 0.15
          ? "rgba(255,255,255,.85)"
          : layer === 0
            ? def.color + "26"
            : "rgba(10,6,28,.7)";
      ctx.fill();
      ctx.strokeStyle = b.flash > 0.15 ? "#ffffff" : layer === 1 ? def.accent : def.color;
      ctx.lineWidth = 3 - layer * 0.6;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // glyph core
    ctx.font = `${Math.round(b.r * 0.85)}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(def.glyph, b.x, b.y);
    ctx.textBaseline = "alphabetic";

    // phase pips
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(b.x - 18 + i * 18, b.y + b.r + 16, 5, 0, TAU);
      ctx.fillStyle = i < b.phase ? def.accent : "rgba(255,255,255,.18)";
      ctx.fill();
    }

    // name + APR tag
    ctx.font = "900 12px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = def.color;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12;
    ctx.fillText(def.name + "  " + (def.apr * 100).toFixed(2) + "% APR", b.x, b.y - b.r - 20);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  drawBlocks(ctx: CanvasRenderingContext2D) {
    for (const b of this.blocks) {
      const ratio = clamp(b.hp / b.maxHp, 0, 1);
      const s = 24;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(Math.sin(b.rot) * 0.18);
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowColor = "#ffe14d";
      ctx.shadowBlur = 22 + Math.sin(this.time * 6) * 8;
      ctx.fillStyle = b.flash > 0.1 ? "#ffffff" : "rgba(255,225,77,0.22)";
      ctx.strokeStyle = b.flash > 0.1 ? "#ffffff" : "#ffe14d";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-s, -s, s * 2, s * 2);
      ctx.fill();
      ctx.stroke();
      // inner spinning diamond
      ctx.rotate(this.time * 1.6);
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(11, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-11, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("🎁", b.x, b.y);
      ctx.textBaseline = "alphabetic";

      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(b.x - 26, b.y - 36, 52, 5);
      ctx.fillStyle = "#ffe14d";
      ctx.fillRect(b.x - 26, b.y - 36, 52 * ratio, 5);
    }
  }

  drawPickups(ctx: CanvasRenderingContext2D) {
    for (const pu of this.pickups) {
      const def = POWERS[pu.id];
      const y = pu.y + Math.sin(pu.bob) * 5;
      const blink = pu.life < 3 && Math.floor(pu.life * 8) % 2 === 0;
      if (blink) continue;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = def.color;
      ctx.shadowColor = def.color;
      ctx.shadowBlur = 22;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(pu.x, y, 17, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = def.color;
      ctx.fill();
      ctx.globalAlpha = 1;
      // orbiting sparks
      for (let i = 0; i < 3; i++) {
        const a = this.time * 3 + (i / 3) * TAU;
        ctx.beginPath();
        ctx.arc(pu.x + Math.cos(a) * 23, y + Math.sin(a) * 23, 2.2, 0, TAU);
        ctx.fillStyle = def.color;
        ctx.fill();
      }
      ctx.restore();
      ctx.font = "16px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(def.glyph, pu.x, y);
      ctx.textBaseline = "alphabetic";
      ctx.font = "700 9px Orbitron, sans-serif";
      ctx.fillStyle = def.color;
      ctx.fillText(def.short, pu.x, y + 30);
    }
  }

  /** Active powerup auras around the player / core. */
  drawPowerAuras(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    if (this.has("shield")) {
      const r = this.core.r + 30 + Math.sin(this.time * 4) * 4;
      ctx.strokeStyle = POWERS.shield.color;
      ctx.shadowColor = POWERS.shield.color;
      ctx.shadowBlur = 26;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(this.core.x, this.core.y, r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.09;
      ctx.fillStyle = POWERS.shield.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (this.has("freeze")) {
      ctx.strokeStyle = POWERS.freeze.color;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const r = ((this.time * 60 + i * 90) % 400) + 40;
        ctx.beginPath();
        ctx.arc(this.core.x, this.core.y, r, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (this.has("magnet")) {
      ctx.strokeStyle = POWERS.magnet.color;
      ctx.shadowColor = POWERS.magnet.color;
      ctx.shadowBlur = 16;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = this.time * 1.5 + (i / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(this.core.x + Math.cos(a) * 60, this.core.y + Math.sin(a) * 60);
        ctx.lineTo(this.core.x + Math.cos(a) * 190, this.core.y + Math.sin(a) * 190);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (this.has("overdrive")) {
      ctx.strokeStyle = POWERS.overdrive.color;
      ctx.shadowColor = POWERS.overdrive.color;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.6 + Math.sin(this.time * 18) * 0.3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 16, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (this.has("jackpot")) {
      ctx.fillStyle = POWERS.jackpot.color;
      ctx.globalAlpha = 0.8;
      for (let i = 0; i < 5; i++) {
        const a = -this.time * 4 + (i / 5) * TAU;
        ctx.beginPath();
        ctx.arc(p.x + Math.cos(a) * (p.r + 32), p.y + Math.sin(a) * (p.r + 32), 3, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (this.has("multishot")) {
      ctx.strokeStyle = POWERS.multishot.color;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = 1.5;
      for (const off of [-0.26, -0.13, 0.13, 0.26]) {
        const a = p.angle + off;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(a) * 150, p.y + Math.sin(a) * 150);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /** Polygon barrier helper. */
  strokePoly(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    sides: number,
    rot: number,
    color: string,
    width: number,
    alpha: number,
    fill = 0,
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    if (fill > 0) {
      ctx.globalAlpha = fill;
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.stroke();
    ctx.restore();
  }

  /** Auras tied to owned upgrades, drawn around the objects they affect. */
  drawCoreAuras(ctx: CanvasRenderingContext2D) {
    const { x, y, r } = this.core;
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // REFINANCE BARRIER — green hex shells slowing everything that enters
    const refi = this.levels.refinance;
    if (refi > 0) {
      const R = this.refiRadius;
      const breathe = 1 + Math.sin(t * 1.6) * 0.015;
      this.strokePoly(ctx, x, y, R * breathe, 6, t * 0.22, "#b7ff2e", 2 + refi * 0.6, 0.45, 0.035);
      this.strokePoly(ctx, x, y, R * 0.92, 6, -t * 0.3, "#b7ff2e", 1, 0.22);
      // energy nodes travelling the perimeter
      for (let i = 0; i < 6 + refi; i++) {
        const a = t * 0.6 + (i / (6 + refi)) * TAU;
        ctx.fillStyle = "#dcff8a";
        ctx.globalAlpha = 0.55 + Math.sin(t * 4 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // EMERGENCY FUND — amber shield plating hugging the core
    const emg = this.levels.emergency;
    if (emg > 0) {
      for (let i = 0; i < emg && i < 4; i++) {
        const rr = r + 20 + i * 7;
        ctx.globalAlpha = 0.5 - i * 0.08;
        ctx.strokeStyle = "#ffc400";
        ctx.lineWidth = 2.5;
        ctx.shadowColor = "#ffc400";
        ctx.shadowBlur = 12;
        for (let s = 0; s < 4; s++) {
          const a0 = t * (0.5 + i * 0.12) + s * (TAU / 4);
          ctx.beginPath();
          ctx.arc(x, y, rr, a0, a0 + 1.0);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  get refiRadius() {
    return Math.min(this.w, this.h) * 0.34 + this.levels.refinance * 14;
  }

  drawPlayerAuras(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    const t = this.time;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // SNOWBALL SHOCKWAVE — cyan orbiting snowballs, flare while buff is live
    const snow = this.levels.snowball;
    if (snow > 0) {
      const live = this.snowballTimer > 0;
      const orbit = p.r + 20 + (live ? 6 + Math.sin(t * 12) * 3 : 0);
      ctx.globalAlpha = live ? 0.95 : 0.5;
      ctx.strokeStyle = "#35f3ff";
      ctx.lineWidth = live ? 2.5 : 1.2;
      ctx.shadowColor = "#35f3ff";
      ctx.shadowBlur = live ? 20 : 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, orbit, 0, TAU);
      ctx.stroke();
      const n = 2 + snow;
      for (let i = 0; i < n; i++) {
        const a = t * (live ? 5 : 2) + (i / n) * TAU;
        const bx = p.x + Math.cos(a) * orbit;
        const by = p.y + Math.sin(a) * orbit;
        ctx.fillStyle = "#d9fbff";
        ctx.beginPath();
        ctx.arc(bx, by, live ? 5 : 3.4, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // AVALANCHE STRIKE — pink targeting chevrons sweeping around the drone
    const avl = this.levels.avalanche;
    if (avl > 0) {
      const rr = p.r + 13;
      ctx.strokeStyle = "#ff3d9e";
      ctx.shadowColor = "#ff3d9e";
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2;
      for (let i = 0; i < 2 + avl; i++) {
        const a0 = -t * 2.4 + (i / (2 + avl)) * TAU;
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.arc(p.x, p.y, rr, a0, a0 + 0.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    // DEBT CONSOLIDATION — violet dashed cash-flow ring
    const con = this.levels.consolidate;
    if (con > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(t * 1.1);
      ctx.setLineDash([5, 7]);
      ctx.strokeStyle = "#a97bff";
      ctx.shadowColor = "#a97bff";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 1.5 + con * 0.5;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(0, 0, p.r + 26 + con * 2, 0, TAU);
      ctx.stroke();
      ctx.restore();
    }

    // Beam tier halo — matches current beam colour
    const beam = this.beam;
    if (this.upgradePoints > 0) {
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1;
      ctx.strokeStyle = beam.color;
      ctx.shadowColor = beam.color;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1 + beam.tier;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 5, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  drawPlayer(ctx: CanvasRenderingContext2D) {
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + Math.PI / 2);
    const rec = 1 - p.recoil * 0.18;
    ctx.scale(rec, 1 / rec);
    ctx.shadowColor = p.hurt > 0 ? "#ff3d9e" : "#b7ff2e";
    ctx.shadowBlur = 20;
    ctx.fillStyle = p.hurt > 0 ? "#ff8ab8" : "#dfffa8";
    ctx.beginPath();
    ctx.moveTo(0, -p.r - 6);
    ctx.lineTo(p.r, p.r);
    ctx.lineTo(0, p.r * 0.45);
    ctx.lineTo(-p.r, p.r);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // thruster
    ctx.fillStyle = `rgba(53,243,255,${0.4 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.moveTo(-5, p.r + 1);
    ctx.lineTo(5, p.r + 1);
    ctx.lineTo(0, p.r + 8 + Math.random() * 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // cash ring
    const ratio = this.cash / this.cashMax;
    ctx.strokeStyle = ratio >= 0.38 ? "rgba(255,225,77,0.85)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 9, -Math.PI / 2, -Math.PI / 2 + TAU * ratio);
    ctx.stroke();
  }

  drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
    const bal = e.principal + e.interest;
    const isTarget = e.id === this.targetId;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    const squish = 1 + Math.sin(e.wobble) * 0.05;
    ctx.scale(squish, 2 - squish);

    ctx.beginPath();
    const sides = e.def.sides;
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * TAU;
      const rr = e.r * (1 + Math.sin(e.wobble + i) * 0.06);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = e.flash > 0.1 ? "#ffffff" : e.def.color + "33";
    ctx.shadowColor = e.def.color;
    ctx.shadowBlur = 16 + e.critFlash * 24;
    ctx.fill();
    ctx.lineWidth = isTarget ? 3.5 : 2;
    ctx.strokeStyle = e.flash > 0.1 ? "#ffffff" : e.def.color;
    ctx.stroke();
    ctx.restore();

    // glyph
    ctx.font = `${Math.round(clamp(e.r * 0.95, 12, 40))}px serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.95;
    ctx.fillText(e.def.glyph, e.x, e.y);
    ctx.textBaseline = "alphabetic";
    ctx.globalAlpha = 1;

    // Refinance Barrier chill shell on beasts inside the field
    if (e.chilled) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.5 + Math.sin(this.time * 5 + e.id) * 0.15;
      this.strokePoly(ctx, e.x, e.y, e.r + 6, 6, -this.time * 0.8, "#b7ff2e", 1.6, 0.6, 0.06);
      ctx.restore();
    }

    // target reticle / Avalanche lock-on barrier
    if (isTarget) {
      const avl = this.levels.avalanche > 0;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(e.x, e.y);
      ctx.rotate(-this.time * 2);
      ctx.strokeStyle = avl ? "#ff3d9e" : "rgba(255,255,255,0.5)";
      ctx.shadowColor = avl ? "#ff3d9e" : "transparent";
      ctx.shadowBlur = avl ? 16 : 0;
      ctx.lineWidth = avl ? 3 : 2;
      const rr = e.r + 11;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, rr, i * (TAU / 4) + 0.3, i * (TAU / 4) + 0.95);
        ctx.stroke();
      }
      ctx.restore();
      if (avl) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const pulse = e.r + 17 + Math.sin(this.time * 6) * 3;
        this.strokePoly(ctx, e.x, e.y, pulse, 3, this.time * 1.4, "#ff3d9e", 2, 0.75, 0.07);
        ctx.restore();
      }
    }

    // health bars
    const bw = Math.max(44, e.r * 2.3);
    const bx = e.x - bw / 2;
    const by = e.y - e.r - 16;
    const pRatio = clamp(e.principal / e.maxPrincipal, 0, 1);
    const iRatio = clamp(e.interest / (e.maxPrincipal * 0.75), 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(bx - 1, by - 1, bw + 2, 10);
    ctx.fillStyle = "#3a0d20";
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = "#ff2d55";
    ctx.fillRect(bx, by, bw * pRatio, 4);
    ctx.fillStyle = "#3a2f05";
    ctx.fillRect(bx, by + 5, bw, 3);
    ctx.fillStyle = "#ffd400";
    ctx.fillRect(bx, by + 5, bw * iRatio, 3);

    // balance label
    ctx.font = "700 10px Orbitron, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(fmt(bal) + "  " + (e.def.apr * 100).toFixed(1) + "%", e.x, by - 5);
  }
}
