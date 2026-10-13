import { ASSET_METRICS, POWERS, type HudState } from "../game/types";
import { fmt } from "../game/Game";

export function assetCounts(principal: number) {
  return ASSET_METRICS.map((m) => ({ ...m, count: Math.floor(principal / m.unit) }));
}

export function Bar({
  value,
  color,
  glow,
  height = 8,
}: {
  value: number;
  color: string;
  glow?: string;
  height?: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-full border border-white/15 bg-white/[0.07] backdrop-blur-sm"
      style={{ height, boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)" }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-100 ease-out"
        style={{
          width: `${Math.max(0, Math.min(100, value * 100))}%`,
          background: color,
          boxShadow: `0 0 12px ${glow ?? color}`,
        }}
      />
    </div>
  );
}

const CHIPS: { k: keyof HudState["levels"]; label: string; color: string }[] = [
  { k: "avalanche", label: "AVL", color: "#ff3d9e" },
  { k: "snowball", label: "SNW", color: "#35f3ff" },
  { k: "refinance", label: "REF", color: "#b7ff2e" },
  { k: "emergency", label: "EMG", color: "#ffc400" },
  { k: "consolidate", label: "CON", color: "#a97bff" },
];

/* ------------------------------------------------------------------ */
/* TOP BAR — lives above the canvas, never covers playfield            */
/* ------------------------------------------------------------------ */
export function HudTop({ hud, onPause }: { hud: HudState; onPause: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-3 pt-2 pb-1.5 md:px-4">
      <div className="min-w-0">
        <div className="font-display text-[8px] tracking-[0.25em] text-cyan-300/70 md:text-[9px]">
          LIFETIME INTEREST SAVED
        </div>
        <div
          className="font-display truncate text-xl font-black leading-none text-lime-300 md:text-3xl"
          style={{ textShadow: "0 0 18px rgba(183,255,46,.6)" }}
        >
          {fmt(hud.score)}
        </div>
        {hud.combo > 1 && (
          <div className="font-display text-[10px] font-bold text-pink-400">
            x{hud.combo} PAYOFF STREAK
          </div>
        )}
      </div>

      {/* Payoff metrics */}
      <div className="hidden flex-1 flex-wrap justify-center gap-1.5 sm:flex">
        {assetCounts(hud.principalCleared).map((m) => (
          <div
            key={m.key}
            title={m.label}
            className="flex items-center gap-1 rounded-lg border px-2 py-1"
            style={{
              borderColor: m.count > 0 ? m.color + "66" : "rgba(255,255,255,.12)",
              background: m.count > 0 ? m.color + "1f" : "rgba(255,255,255,.05)",
              opacity: m.count > 0 ? 1 : 0.4,
            }}
          >
            <span className="text-[12px] leading-none">{m.glyph}</span>
            <span className="font-display text-[11px] font-black" style={{ color: m.color }}>
              {m.count}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="text-right">
          <div className="font-display text-[8px] tracking-[0.2em] text-pink-300/70 md:text-[9px]">
            WAVE
          </div>
          <div className="font-display text-xl font-black leading-none text-white md:text-2xl">
            {hud.wave}
          </div>
          <div className="font-display text-[8px] tracking-widest text-white/40">
            {hud.enemiesLeft} LEFT
          </div>
        </div>
        <button
          onClick={onPause}
          className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/[0.07] text-white/85 backdrop-blur-md active:scale-95"
          aria-label="Pause"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BOTTOM BAR — health / overpay / beam, below the canvas              */
/* ------------------------------------------------------------------ */
export function HudBottom({ hud }: { hud: HudState }) {
  const coreRatio = hud.coreMax ? hud.coreHp / hud.coreMax : 0;
  const danger = coreRatio < 0.3;
  return (
    <div className="shrink-0 px-3 pb-2 pt-1.5 md:px-4">
      <div
        className="mx-auto flex max-w-3xl flex-col gap-1.5 rounded-2xl border border-white/20 bg-white/[0.06] p-2.5 backdrop-blur-md"
        style={{
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(255,255,255,.06), 0 8px 30px rgba(0,0,0,.35)",
        }}
      >
        <div className="flex items-center justify-between font-display text-[9px] tracking-[0.2em]">
          <span className={danger ? "animate-pulse text-pink-400" : "text-cyan-300/80"}>
            NET WORTH CORE {fmt(hud.coreHp)}
          </span>
          <span className="hidden text-white/30 sm:inline">{hud.stageName}</span>
          <span className="text-amber-300/80">
            {hud.fireRate.toFixed(1)}/s
            {hud.snowballTimer > 0 && <span className="ml-1 text-cyan-300">❄</span>}
          </span>
        </div>
        <Bar
          value={coreRatio}
          color={
            danger
              ? "linear-gradient(90deg,#ff2d55,#ff8a00)"
              : "linear-gradient(90deg,#35f3ff,#b7ff2e)"
          }
          glow={danger ? "#ff2d55" : "#35f3ff"}
          height={11}
        />
        <div className="flex items-center gap-3">
          <span className="font-display text-[9px] tracking-[0.2em] text-amber-300/80">OVERPAY</span>
          <div className="flex-1">
            <Bar
              value={hud.cash / 100}
              color="linear-gradient(90deg,#ffc400,#ffe14d)"
              glow="#ffc400"
              height={6}
            />
          </div>
          <div
            className="flex items-center gap-1.5 rounded-md border px-2 py-1"
            style={{
              borderColor: hud.beamColor + "66",
              background: hud.beamColor + "14",
              boxShadow: `0 0 12px ${hud.beamColor}33`,
            }}
          >
            <span
              className="block rounded-full"
              style={{
                width: 14,
                height: 2 + hud.beamTier * 2,
                background: hud.beamColor,
                boxShadow: `0 0 8px ${hud.beamColor}`,
              }}
            />
            <span
              className="font-display text-[9px] font-bold tracking-widest"
              style={{ color: hud.beamColor }}
            >
              {hud.beamName}
              {hud.beamTier > 0 && <span className="text-white/60"> MK{hud.beamTier + 1}</span>}
            </span>
          </div>
          <div className="hidden gap-1 md:flex">
            {CHIPS.filter((c) => hud.levels[c.k] > 0).map((c) => (
              <span
                key={c.k}
                className="rounded px-1.5 py-0.5 font-display text-[9px] font-bold"
                style={{
                  color: c.color,
                  border: `1px solid ${c.color}55`,
                  background: `${c.color}15`,
                }}
              >
                {c.label}·{hud.levels[c.k]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* OVERLAYS — only contextual panels float over the canvas             */
/* ------------------------------------------------------------------ */
export function HudOverlay({ hud }: { hud: HudState }) {
  return (
    <>
      {/* Bonus surge */}
      {hud.bonus && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-4">
          <div
            className="anim-in w-full max-w-md rounded-2xl border border-cyan-300/60 bg-cyan-400/10 px-4 py-2 backdrop-blur-md"
            style={{ boxShadow: "0 0 28px rgba(53,243,255,.35), inset 0 1px 0 rgba(255,255,255,.2)" }}
          >
            <div className="flex items-center justify-between">
              <span
                className="font-display text-sm font-black text-cyan-200"
                style={{ textShadow: "0 0 14px #35f3ff" }}
              >
                ✦ BONUS SURGE
              </span>
              <span className="font-display text-xs text-white/70">{hud.bonus.kills} INTERCEPTS</span>
            </div>
            <div className="mt-1.5 space-y-1">
              <Bar
                value={hud.bonus.left / hud.bonus.total}
                color="linear-gradient(90deg,#35f3ff,#b7ff2e)"
                glow="#35f3ff"
                height={7}
              />
              <Bar
                value={hud.bonus.vaultMax ? hud.bonus.vault / hud.bonus.vaultMax : 0}
                color={
                  hud.bonus.vault / (hud.bonus.vaultMax || 1) < 0.3
                    ? "linear-gradient(90deg,#ff2d55,#ff8a00)"
                    : "linear-gradient(90deg,#ffc400,#ffe14d)"
                }
                glow="#ffc400"
                height={6}
              />
            </div>
            <div className="mt-1 flex justify-between font-display text-[9px] tracking-widest text-white/55">
              <span>{hud.bonus.left.toFixed(1)}s LEFT</span>
              <span className="text-amber-300">VAULT {fmt(hud.bonus.vault)}</span>
              <span className={hud.bonus.leaks ? "text-rose-400" : "text-lime-300"}>
                {hud.bonus.leaks ? `${hud.bonus.leaks} LEAKS` : "FLAWLESS"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Boss */}
      {hud.boss && (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-4">
          <div
            className="anim-in w-full max-w-lg rounded-2xl border px-4 py-2 backdrop-blur-md"
            style={{
              borderColor: hud.boss.color + "88",
              background: hud.boss.color + "14",
              boxShadow: `0 0 28px ${hud.boss.color}44, inset 0 1px 0 rgba(255,255,255,.2)`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{hud.boss.glyph}</span>
                <div>
                  <div
                    className="font-display text-sm font-black leading-none"
                    style={{ color: hud.boss.color, textShadow: `0 0 14px ${hud.boss.color}` }}
                  >
                    {hud.boss.name}
                  </div>
                  <div className="text-[9px] tracking-widest text-white/50">{hud.boss.title}</div>
                </div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="block h-2 w-2 rounded-full"
                    style={{
                      background: i <= hud.boss!.phase ? hud.boss!.color : "rgba(255,255,255,.18)",
                      boxShadow: i <= hud.boss!.phase ? `0 0 8px ${hud.boss!.color}` : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="mt-1.5 space-y-1">
              <Bar
                value={hud.boss.principal / hud.boss.maxPrincipal}
                color="linear-gradient(90deg,#ff2d55,#ff8a00)"
                glow="#ff2d55"
                height={9}
              />
              <Bar
                value={hud.boss.interest / (hud.boss.maxPrincipal * 0.5)}
                color="linear-gradient(90deg,#ffd400,#ffe98a)"
                glow="#ffd400"
                height={5}
              />
            </div>
          </div>
        </div>
      )}

      {/* Active powerups */}
      {hud.actives.length > 0 && (
        <div
          className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col gap-1.5"
          style={{ top: hud.boss ? 118 : hud.bonus ? 124 : 10 }}
        >
          {hud.actives.map((a) => {
            const def = POWERS[a.id];
            return (
              <div
                key={a.id}
                className="flex w-44 items-center gap-2 rounded-lg border px-2 py-1 backdrop-blur-md"
                style={{
                  borderColor: def.color + "88",
                  background: def.color + "1f",
                  boxShadow: `0 0 16px ${def.color}44, inset 0 1px 0 rgba(255,255,255,.18)`,
                }}
              >
                <span className="text-sm leading-none">{def.glyph}</span>
                <div className="flex-1">
                  <div
                    className="font-display text-[9px] font-black tracking-widest"
                    style={{ color: def.color }}
                  >
                    {def.short}
                  </div>
                  <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(a.left / a.total) * 100}%`, background: def.color }}
                    />
                  </div>
                </div>
                <span className="font-display text-[10px] text-white/70">{a.left.toFixed(1)}s</span>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
