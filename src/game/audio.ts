/* Procedural Web Audio engine: per-wave stage music + SFX. No assets, zero load time. */

type Wave = OscillatorType;

const SCALES: number[][] = [
  [0, 3, 5, 7, 10], // minor pentatonic
  [0, 2, 3, 5, 7, 8, 10], // natural minor
  [0, 2, 4, 5, 7, 9, 11], // ionian
  [0, 1, 5, 7, 8], // phrygian-ish
  [0, 2, 3, 6, 7, 9, 10], // dorian b5 / exotic
  [0, 3, 5, 6, 7, 10], // blues
];

export interface StageTheme {
  name: string;
  root: number; // midi
  scale: number[];
  bpm: number;
  lead: Wave;
  bass: Wave;
  arpDiv: number;
  colors: { a: string; b: string; grid: string; fog: string };
}

const PALETTES = [
  { a: "#35f3ff", b: "#7a3cff", grid: "rgba(90,70,190,0.18)", fog: "#120a28" },
  { a: "#ff3d9e", b: "#ff8a00", grid: "rgba(190,60,140,0.16)", fog: "#260a1e" },
  { a: "#b7ff2e", b: "#00c2a8", grid: "rgba(70,190,120,0.15)", fog: "#07231b" },
  { a: "#ffc400", b: "#ff4d4d", grid: "rgba(200,140,40,0.15)", fog: "#2a1605" },
  { a: "#a97bff", b: "#3c5bff", grid: "rgba(110,90,220,0.18)", fog: "#120f33" },
  { a: "#00ffd0", b: "#ff2d9b", grid: "rgba(0,200,180,0.15)", fog: "#032424" },
  { a: "#ff6b6b", b: "#6b1bff", grid: "rgba(170,60,180,0.16)", fog: "#1d0824" },
  { a: "#f8f8ff", b: "#00a3ff", grid: "rgba(120,160,220,0.16)", fog: "#0a1430" },
];

export function stageTheme(wave: number): StageTheme {
  const i = Math.max(0, wave - 1);
  const pal = PALETTES[i % PALETTES.length];
  const scale = SCALES[i % SCALES.length];
  const roots = [45, 43, 48, 41, 46, 44, 50, 40];
  const leads: Wave[] = ["square", "sawtooth", "triangle", "square", "sawtooth", "triangle"];
  const names = [
    "MINIMUM PAYMENTS",
    "REVOLVING BALANCE",
    "GRACE PERIOD OVER",
    "VARIABLE RATE",
    "COLLECTIONS CALL",
    "BALLOON PAYMENT",
    "CREDIT FREEZE",
    "FINAL STATEMENT",
  ];
  return {
    name: names[i % names.length],
    root: roots[i % roots.length],
    scale,
    bpm: Math.min(168, 96 + i * 7),
    lead: leads[i % leads.length],
    bass: i % 2 ? "sawtooth" : "square",
    arpDiv: i % 3 === 2 ? 3 : 4,
    colors: pal,
  };
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  delay: DelayNode | null = null;
  theme: StageTheme = stageTheme(1);
  step = 0;
  timer: number | null = null;
  nextTime = 0;
  playing = false;
  muted = false;
  intensity = 0;

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.85;
    this.master.connect(ctx.destination);

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 7;
    comp.connect(this.master);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.34;
    this.musicGain.connect(comp);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(comp);

    this.delay = ctx.createDelay(1);
    this.delay.delayTime.value = 0.26;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(wet);
    wet.connect(comp);
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  }

  setIntensity(v: number) {
    this.intensity = Math.max(0, Math.min(1, v));
  }

  // ---------- music scheduler ----------
  startStage(wave: number) {
    this.init();
    if (!this.ctx) return;
    this.theme = stageTheme(wave);
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    if (!this.playing) {
      this.playing = true;
      this.timer = window.setInterval(() => this.schedule(), 30);
    }
  }

  stopMusic() {
    this.playing = false;
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }

  setMusicVolume(v: number) {
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.playing) return;
    const spb = 60 / this.theme.bpm;
    const stepDur = spb / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.step++;
      this.nextTime += stepDur;
    }
  }

  private playStep(step: number, t: number, dur: number) {
    const th = this.theme;
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;

    // kick
    if (s % 4 === 0) this.kick(t);
    // snare/clap
    if (s === 4 || s === 12) this.noiseHit(t, 0.16, 1800, 0.22);
    // hats
    if (s % 2 === 1) this.noiseHit(t, 0.045, 7000, 0.07 + this.intensity * 0.05);

    // bass
    if (s % 2 === 0) {
      const deg = [0, 0, 3, 0, 5, 0, 3, 2][(s / 2) % 8];
      const n = th.root + (th.scale[deg % th.scale.length] ?? 0) - 12;
      this.tone(mtof(n), t, dur * 1.7, th.bass, 0.3, 420 + this.intensity * 500, false);
    }

    // arp lead
    if (step % th.arpDiv === 0) {
      const idx = (Math.floor(step / th.arpDiv) + bar * 2) % th.scale.length;
      const oct = bar === 3 ? 12 : 0;
      const n = th.root + th.scale[idx] + 12 + oct;
      this.tone(mtof(n), t, dur * 1.3, th.lead, 0.12 + this.intensity * 0.08, 2600, true);
    }

    // pad swell on bar start
    if (s === 0) {
      const n = th.root + th.scale[bar % th.scale.length];
      this.tone(mtof(n), t, spbSafe(th.bpm) * 3.6, "triangle", 0.07, 900, true);
      this.tone(mtof(n + 7), t, spbSafe(th.bpm) * 3.6, "triangle", 0.05, 900, true);
    }
  }

  private kick(t: number) {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.25);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noise() {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      const len = ctx.sampleRate * 0.4;
      const b = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = b;
    }
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    return src;
  }

  private noiseHit(t: number, dur: number, freq: number, vol: number, dest?: GainNode) {
    const ctx = this.ctx;
    if (!ctx) return;
    const src = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(dest ?? this.musicGain!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private tone(
    freq: number,
    t: number,
    dur: number,
    type: Wave,
    vol: number,
    cutoff: number,
    echo: boolean,
    dest?: GainNode,
  ) {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(cutoff, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(dest ?? this.musicGain!);
    if (echo && this.delay) g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  // ---------- SFX ----------
  private sweep(from: number, to: number, dur: number, type: Wave, vol: number, echo = false) {
    const ctx = this.ctx;
    if (!ctx || !this.sfxGain) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    if (echo && this.delay) g.connect(this.delay);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  shoot() {
    if (!this.ctx) return;
    this.sweep(820 + Math.random() * 120, 300, 0.07, "square", 0.055);
  }
  overpay() {
    this.sweep(180, 1400, 0.16, "sawtooth", 0.14, true);
    if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.12, 2400, 0.14, this.sfxGain!);
  }
  hit() {
    if (!this.ctx) return;
    this.noiseHit(this.ctx.currentTime, 0.05, 3200, 0.07, this.sfxGain!);
  }
  kill(size: number) {
    this.sweep(520 + size * 6, 70, 0.4, "sawtooth", 0.2, true);
    if (this.ctx) this.noiseHit(this.ctx.currentTime, 0.3, 700, 0.22, this.sfxGain!);
    [0, 4, 7, 12].forEach((n, i) => {
      const ct = this.ctx;
      if (!ct) return;
      this.tone(mtof(72 + n), ct.currentTime + i * 0.045, 0.22, "triangle", 0.1, 4000, true, this.sfxGain!);
    });
  }
  coreHit() {
    this.sweep(220, 60, 0.22, "square", 0.12);
  }
  powerBlock() {
    [0, 5, 9, 14, 19].forEach((n, i) => {
      const ct = this.ctx;
      if (!ct) return;
      this.tone(mtof(70 + n), ct.currentTime + i * 0.05, 0.3, "square", 0.13, 5000, true, this.sfxGain!);
    });
  }
  pickup(kind: number) {
    const base = 76 + kind * 2;
    [0, 4, 7].forEach((n, i) => {
      const ct = this.ctx;
      if (!ct) return;
      this.tone(mtof(base + n), ct.currentTime + i * 0.04, 0.25, "triangle", 0.16, 6000, true, this.sfxGain!);
    });
  }
  wave() {
    [0, 7, 12, 16, 19, 24].forEach((n, i) => {
      const ct = this.ctx;
      if (!ct) return;
      this.tone(mtof(60 + n), ct.currentTime + i * 0.07, 0.4, "square", 0.14, 6000, true, this.sfxGain!);
    });
  }
  upgrade() {
    [0, 3, 7, 10, 12].forEach((n, i) => {
      const ct = this.ctx;
      if (!ct) return;
      this.tone(mtof(64 + n), ct.currentTime + i * 0.06, 0.35, "sawtooth", 0.12, 5000, true, this.sfxGain!);
    });
  }
  gameOver() {
    this.stopMusic();
    [0, -2, -5, -9, -14].forEach((n, i) => {
      const ct = this.ctx;
      if (!ct) return;
      this.tone(mtof(60 + n), ct.currentTime + i * 0.17, 0.7, "sawtooth", 0.17, 2200, true, this.sfxGain!);
    });
  }
  ui() {
    this.sweep(900, 1500, 0.06, "square", 0.08);
  }
}

const spbSafe = (bpm: number) => 60 / bpm;

export const audio = new AudioEngine();
