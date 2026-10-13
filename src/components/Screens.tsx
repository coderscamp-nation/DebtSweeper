import {
  ASSET_METRICS,
  DIFFICULTIES,
  UPGRADES,
  type Difficulty,
  type UpgradeId,
} from "../game/types";
import { fmt, BEAM_COLORS } from "../game/Game";

/** Traffic-light colouring for the difficulty tiers. */
const DIFF_TONE: Record<Difficulty, string> = {
  easy: "#3dff7a",
  medium: "#ffd400",
  hard: "#ff2e4d",
};

function BeamPreview({ points }: { points: number }) {
  const cur = BEAM_COLORS[points % BEAM_COLORS.length];
  const curTier = Math.floor(points / BEAM_COLORS.length);
  const nxt = BEAM_COLORS[(points + 1) % BEAM_COLORS.length];
  const nxtTier = Math.floor((points + 1) / BEAM_COLORS.length);
  const Chip = ({ c, tier, label }: { c: (typeof BEAM_COLORS)[0]; tier: number; label: string }) => (
    <div className="flex items-center gap-2">
      <span className="font-display text-[9px] tracking-widest text-white/35">{label}</span>
      <span
        className="block rounded-full"
        style={{
          width: 26,
          height: 3 + tier * 2.5,
          background: c.hex,
          boxShadow: `0 0 12px ${c.hex}`,
        }}
      />
      <span className="font-display text-[10px] font-bold" style={{ color: c.hex }}>
        {c.name}
        {tier > 0 && <span className="text-white/45"> MK{tier + 1}</span>}
      </span>
    </div>
  );
  return (
    <div className="mt-3 inline-flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-2">
      <Chip c={cur} tier={curTier} label="BEAM" />
      <span className="text-white/25">→</span>
      <Chip c={nxt} tier={nxtTier} label="NEXT" />
    </div>
  );
}

export interface ScoreRow {
  score: number;
  wave: number;
  killed: number;
  date: string;
}

const Panel = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`scan relative overflow-hidden rounded-3xl border border-cyan-400/25 bg-[#0a0620]/90 p-6 backdrop-blur-md md:p-8 ${className}`}
    style={{ boxShadow: "0 0 60px rgba(53,243,255,.14), inset 0 0 40px rgba(120,60,255,.12)" }}
  >
    {children}
  </div>
);

export const NeonButton = ({
  children,
  onClick,
  color = "#35f3ff",
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  color?: string;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`font-display rounded-xl px-6 py-3 text-sm font-black tracking-[0.18em] transition active:scale-[0.97] ${className}`}
    style={{
      color: "#05030f",
      background: `linear-gradient(135deg, ${color}, #ffffff)`,
      boxShadow: `0 0 26px ${color}80`,
    }}
  >
    {children}
  </button>
);

export function StartScreen({
  onStart,
  best,
  difficulty,
  setDifficulty,
}: {
  onStart: () => void;
  best: ScoreRow[];
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto p-4">
      <Panel className="anim-in w-full max-w-xl px-4 sm:px-6">
        <div className="w-full text-center">
          <div className="font-display text-[9px] tracking-[0.4em] text-pink-400 sm:text-[10px] sm:tracking-[0.5em]">
            NEON PAYOFF ARENA
          </div>
          <h1
            className="font-display mx-auto mt-2 w-full max-w-full whitespace-nowrap text-center font-black leading-[1.1]"
            style={{
              fontSize: "clamp(1.45rem, 7.2vw, 3.1rem)",
              letterSpacing: "0.02em",
              color: "#fff",
              textShadow: "0 0 22px #35f3ff, 0 0 60px #ff3d9e",
            }}
          >
            DEBT<span className="text-pink-400">SWEEPER</span>
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm text-cyan-100/70">
            Defend your Net Worth Core from compounding debt.
          </p>
          <div className="mt-2 font-display text-[10px] tracking-[0.2em] text-white/35">
            MOVE · AUTO-FIRE · <span className="text-amber-300/80">SPACE / TAP TO OVERPAY</span>
          </div>
        </div>

        {/* Difficulty select */}
        <div className="mt-6">
          <div className="font-display mb-2 text-center text-[10px] tracking-[0.3em] text-white/35">
            DIFFICULTY
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => {
              const def = DIFFICULTIES[d];
              const on = difficulty === d;
              const tone = DIFF_TONE[d];
              return (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className="rounded-xl border px-2 py-3 text-center transition active:scale-[0.97]"
                  style={{
                    borderColor: on ? tone : "rgba(255,255,255,.12)",
                    background: on ? tone + "1f" : "rgba(255,255,255,.04)",
                    boxShadow: on ? `0 0 24px ${tone}55` : "none",
                  }}
                >
                  <div
                    className="font-display text-base font-black"
                    style={{
                      color: tone,
                      textShadow: on ? `0 0 14px ${tone}` : "none",
                      opacity: on ? 1 : 0.7,
                    }}
                  >
                    {d.toUpperCase()}
                  </div>
                  <div
                    className="font-display mt-1 text-[9px] tracking-wider"
                    style={{ color: tone, opacity: 0.6 }}
                  >
                    ×{def.scoreMult.toFixed(1)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-4 font-display text-[9px] tracking-[0.18em] text-white/30">
          <span>
            <span className="text-cyan-300/70">WAVE 5s</span> BONUS SURGE
          </span>
          <span className="text-white/15">·</span>
          <span>
            <span className="text-pink-300/70">WAVE 10s</span> BOSS ARENA
          </span>
        </div>

        <div className="mt-5 flex justify-center">
          <NeonButton onClick={onStart} color="#b7ff2e" className="px-10 py-4 text-base">
            START SWEEPING
          </NeonButton>
        </div>

        {best.length > 0 && (
          <div className="mt-6">
            <div className="font-display mb-2 text-center text-[10px] tracking-[0.3em] text-white/40">
              LOCAL HALL OF SOLVENCY
            </div>
            <div className="space-y-1">
              {best.slice(0, 5).map((r, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs"
                >
                  <span className="font-display text-white/40">#{i + 1}</span>
                  <span className="font-display font-bold text-lime-300">{fmt(r.score)}</span>
                  <span className="text-white/50">wave {r.wave}</span>
                  <span className="text-white/30">{r.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function UpgradeScreen({
  wave,
  choices,
  levels,
  score,
  points,
  onPick,
}: {
  wave: number;
  choices: UpgradeId[];
  levels: Record<UpgradeId, number>;
  score: number;
  points: number;
  onPick: (id: UpgradeId) => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="anim-in w-full max-w-3xl">
        <div className="mb-4 text-center">
          <div className="font-display text-[10px] tracking-[0.4em] text-lime-300">WAVE {wave} CLEARED</div>
          <h2
            className="font-display text-2xl font-black text-white md:text-4xl"
            style={{ textShadow: "0 0 20px #b7ff2e" }}
          >
            CHOOSE A PAYOFF STRATEGY
          </h2>
          <div className="mt-1 text-xs text-white/50">Savings banked: {fmt(score)}</div>
          <BeamPreview points={points} />
          <div className="mt-1 text-[10px] tracking-widest text-white/30">
            EVERY UPGRADE EVOLVES YOUR PAYMENT BEAM
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {choices.map((id) => {
            const u = UPGRADES[id];
            const lvl = levels[id];
            const cost = u.cost ? u.cost(score) : 0;
            return (
              <button
                key={id}
                onClick={() => onPick(id)}
                className="group scan relative overflow-hidden rounded-2xl border bg-[#0a0620]/95 p-5 text-left transition hover:-translate-y-1 active:scale-[0.98]"
                style={{ borderColor: u.color + "55", boxShadow: `0 0 26px ${u.color}22` }}
              >
                <div className="font-display text-[9px] tracking-[0.2em]" style={{ color: u.color }}>
                  {u.tag}
                </div>
                <div className="font-display mt-1 text-lg font-black text-white">{u.title}</div>
                <div className="mt-2 text-xs leading-relaxed text-white/65">{u.desc(lvl)}</div>
                <div className="mt-3 flex items-center justify-between text-[10px]">
                  <span className="font-display tracking-widest text-white/40">
                    {lvl > 0 ? `LV ${lvl} → ${lvl + 1}` : "NEW"}
                  </span>
                  {cost > 0 && <span className="font-display text-rose-400">-{fmt(cost)}</span>}
                </div>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-1 opacity-60"
                  style={{ background: u.color }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PauseScreen({ onResume, onQuit }: { onResume: () => void; onQuit: () => void }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
      <Panel className="anim-in w-full max-w-sm text-center">
        <h2 className="font-display text-3xl font-black text-white" style={{ textShadow: "0 0 20px #35f3ff" }}>
          PAUSED
        </h2>
        <p className="mt-2 text-xs text-white/50">Interest is frozen. For now.</p>
        <div className="mt-6 flex flex-col gap-3">
          <NeonButton onClick={onResume} color="#35f3ff">
            RESUME
          </NeonButton>
          <button
            onClick={onQuit}
            className="font-display rounded-xl border border-white/15 px-6 py-3 text-xs tracking-[0.2em] text-white/60 active:scale-95"
          >
            QUIT TO MENU
          </button>
        </div>
      </Panel>
    </div>
  );
}

export function GameOverScreen({
  score,
  wave,
  killed,
  best,
  isRecord,
  principal,
  interest,
  blocks,
  bosses,
  difficulty,
  onRestart,
  onMenu,
}: {
  score: number;
  wave: number;
  killed: number;
  best: ScoreRow[];
  isRecord: boolean;
  principal: number;
  interest: number;
  blocks: number;
  bosses: number;
  difficulty: Difficulty;
  onRestart: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <Panel className="anim-in w-full max-w-lg text-center">
        <div className="font-display text-[10px] tracking-[0.4em] text-rose-400">NET WORTH CORE LIQUIDATED</div>
        <h2 className="font-display mt-1 text-4xl font-black text-white" style={{ textShadow: "0 0 24px #ff3d9e" }}>
          BANKRUPT
        </h2>
        {isRecord && (
          <div className="font-display mt-2 inline-block rounded-full border border-lime-300/40 bg-lime-300/10 px-3 py-1 text-[10px] tracking-widest text-lime-300">
            ★ NEW PERSONAL RECORD
          </div>
        )}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["SAVED", fmt(score), "#b7ff2e"],
            ["WAVE", String(wave), "#35f3ff"],
            ["BEASTS", String(killed), "#ff3d9e"],
          ].map(([l, v, c]) => (
            <div key={l} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="font-display text-[9px] tracking-widest text-white/40">{l}</div>
              <div className="font-display text-lg font-black" style={{ color: c }}>
                {v}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="font-display mb-2 text-[10px] tracking-[0.3em] text-white/40">
            WHAT YOUR PAYOFF BOUGHT BACK
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {ASSET_METRICS.map((m) => {
              const count = Math.floor(principal / m.unit);
              return (
                <div
                  key={m.key}
                  className="rounded-lg border p-2"
                  style={{
                    borderColor: count > 0 ? m.color + "55" : "rgba(255,255,255,.08)",
                    background: count > 0 ? m.color + "12" : "transparent",
                    opacity: count > 0 ? 1 : 0.4,
                  }}
                >
                  <div className="text-base leading-none">{m.glyph}</div>
                  <div className="font-display text-base font-black" style={{ color: m.color }}>
                    {count}
                  </div>
                  <div className="text-[8px] leading-tight text-white/45">{m.label}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
            <div className="text-white/50">
              Principal erased <b className="text-rose-300">{fmt(principal)}</b>
            </div>
            <div className="text-white/50">
              Interest shredded <b className="text-amber-300">{fmt(interest)}</b>
            </div>
            <div className="text-white/50">
              Vaults cracked <b className="text-lime-300">{blocks}</b>
            </div>
            <div className="col-span-3 text-white/50">
              Titans defeated <b className="text-pink-300">{bosses}</b>
            </div>
          </div>
          <div className="font-display mt-2 text-[9px] tracking-widest text-white/30">
            <span style={{ color: DIFF_TONE[difficulty] }}>{difficulty.toUpperCase()}</span> · ×
            {DIFFICULTIES[difficulty].scoreMult.toFixed(1)}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <NeonButton onClick={onRestart} color="#b7ff2e">
            RESTART INSTANTLY
          </NeonButton>
          <button
            onClick={onMenu}
            className="font-display rounded-xl border border-white/15 px-6 py-3 text-xs tracking-[0.2em] text-white/60 active:scale-95"
          >
            MENU
          </button>
        </div>
        {best.length > 0 && (
          <div className="mt-6 space-y-1 text-left">
            <div className="font-display mb-1 text-center text-[10px] tracking-[0.3em] text-white/40">
              TOP RUNS
            </div>
            {best.slice(0, 5).map((r, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs"
              >
                <span className="font-display text-white/40">#{i + 1}</span>
                <span className="font-display font-bold text-lime-300">{fmt(r.score)}</span>
                <span className="text-white/50">wave {r.wave}</span>
                <span className="text-white/30">{r.date}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
