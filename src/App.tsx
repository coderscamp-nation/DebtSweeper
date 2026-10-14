import { useCallback, useEffect, useRef, useState } from "react";
import { Game } from "./game/Game";
import { audio } from "./game/audio";
import type { Difficulty, HudState, UpgradeId } from "./game/types";
import { HudTop, HudBottom, HudOverlay, AudioButtons } from "./components/Hud";
import {
  GameOverScreen,
  PauseScreen,
  StartScreen,
  UpgradeScreen,
  type ScoreRow,
} from "./components/Screens";

type Screen = "menu" | "playing" | "paused" | "upgrade" | "over";

const KEY = "debtsweeper.scores.v1";

const loadScores = (): ScoreRow[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ScoreRow[]) : [];
  } catch {
    return [];
  }
};

const emptyHud: HudState = {
  score: 0,
  wave: 1,
  coreHp: 150000,
  coreMax: 150000,
  cash: 100,
  fireRate: 3.4,
  enemiesLeft: 0,
  combo: 0,
  snowballTimer: 0,
  totalKilled: 0,
  levels: { avalanche: 0, snowball: 0, refinance: 0, emergency: 0, consolidate: 0 },
  beamName: "BLUE",
  beamColor: "#4cc3ff",
  beamTier: 0,
  beamStep: 0,
  upgradePoints: 0,
  stageName: "MINIMUM PAYMENTS",
  stageColor: "#35f3ff",
  principalCleared: 0,
  interestKilled: 0,
  actives: [],
  powerBlocks: 0,
  boss: null,
  bonus: null,
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const bannerTimer = useRef<number | null>(null);

  const [screen, setScreen] = useState<Screen>("menu");
  const [hud, setHud] = useState<HudState>(emptyHud);
  const [choices, setChoices] = useState<UpgradeId[]>([]);
  const [waveDone, setWaveDone] = useState(1);
  const [banner, setBanner] = useState<{ t: string; s: string } | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>(loadScores);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    () => (localStorage.getItem("debtsweeper.diff") as Difficulty) || "medium",
  );
  const [musicMuted, setMusicMuted] = useState(
    () => localStorage.getItem("debtsweeper.musicMuted") === "1",
  );
  const [sfxMuted, setSfxMuted] = useState(
    () => localStorage.getItem("debtsweeper.sfxMuted") === "1",
  );

  const toggleMusic = useCallback(() => {
    setMusicMuted((m) => {
      const next = !m;
      localStorage.setItem("debtsweeper.musicMuted", next ? "1" : "0");
      audio.resume();
      audio.setMusicMuted(next);
      return next;
    });
  }, []);

  const toggleSfx = useCallback(() => {
    setSfxMuted((m) => {
      const next = !m;
      localStorage.setItem("debtsweeper.sfxMuted", next ? "1" : "0");
      audio.resume();
      audio.setSfxMuted(next);
      if (!next) audio.ui();
      return next;
    });
  }, []);

  // apply persisted mutes to the engine on boot
  useEffect(() => {
    audio.setMusicMuted(localStorage.getItem("debtsweeper.musicMuted") === "1");
    audio.setSfxMuted(localStorage.getItem("debtsweeper.sfxMuted") === "1");
  }, []);
  const [result, setResult] = useState({
    score: 0,
    wave: 0,
    killed: 0,
    record: false,
    principal: 0,
    interest: 0,
    blocks: 0,
    bosses: 0,
    difficulty: "medium" as Difficulty,
  });

  const showBanner = useCallback((t: string, s: string) => {
    setBanner({ t, s });
    if (bannerTimer.current) window.clearTimeout(bannerTimer.current);
    bannerTimer.current = window.setTimeout(() => setBanner(null), 1700);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, {
      onHud: (s) => setHud(s),
      onWaveComplete: (wave, c) => {
        setWaveDone(wave);
        setChoices(c);
        setScreen("upgrade");
      },
      onGameOver: (score, wave, killed) => {
        const row: ScoreRow = {
          score,
          wave,
          killed,
          date: new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        };
        const prev = loadScores();
        const next = [...prev, row].sort((a, b) => b.score - a.score).slice(0, 10);
        localStorage.setItem(KEY, JSON.stringify(next));
        setScores(next);
        const g2 = gameRef.current;
        setResult({
          score,
          wave,
          killed,
          record: next[0]?.score === score && score > 0,
          principal: g2?.principalCleared ?? 0,
          interest: g2?.interestKilled ?? 0,
          blocks: g2?.blocksBroken ?? 0,
          bosses: g2?.bossesSlain ?? 0,
          difficulty: g2?.difficulty ?? "medium",
        });
        setScreen("over");
      },
      onBanner: showBanner,
    });
    g.setPhase("paused");
    g.running = true;
    g.last = performance.now();
    g.raf = requestAnimationFrame(g.loop);
    gameRef.current = g;
    return () => {
      g.destroy();
      gameRef.current = null;
    };
  }, [showBanner]);

  const start = useCallback(() => {
    audio.resume();
    audio.setMusicMuted(musicMuted);
    audio.setSfxMuted(sfxMuted);
    setHud(emptyHud);
    localStorage.setItem("debtsweeper.diff", difficulty);
    gameRef.current?.start(difficulty);
    setScreen("playing");
  }, [difficulty, musicMuted, sfxMuted]);

  const pause = useCallback(() => {
    if (!gameRef.current) return;
    gameRef.current.setPhase("paused");
    audio.setMusicVolume(0.08);
    setScreen("paused");
  }, []);

  const resume = useCallback(() => {
    if (!gameRef.current) return;
    gameRef.current.setPhase("running");
    audio.resume();
    audio.setMusicVolume(0.34);
    setScreen("playing");
  }, []);

  const quit = useCallback(() => {
    if (!gameRef.current) return;
    gameRef.current.reset();
    gameRef.current.setPhase("paused");
    audio.stopMusic();
    setScreen("menu");
  }, []);

  const pick = useCallback((id: UpgradeId) => {
    audio.setMusicVolume(0.34);
    gameRef.current?.applyUpgrade(id);
    setScreen("playing");
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "p" || k === "escape") {
        setScreen((s) => {
          if (s === "playing") {
            gameRef.current?.setPhase("paused");
            audio.setMusicVolume(0.08);
            return "paused";
          }
          if (s === "paused") {
            gameRef.current?.setPhase("running");
            audio.resume();
            audio.setMusicVolume(0.34);
            return "playing";
          }
          return s;
        });
      }
      if (k === "enter") {
        setScreen((s) => {
          if (s === "menu" || s === "over") {
            setTimeout(start, 0);
            return s;
          }
          return s;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [start]);

  // auto-pause when tab hidden
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && gameRef.current?.phase === "running") {
        gameRef.current.setPhase("paused");
        audio.setMusicVolume(0.0);
        setScreen("paused");
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#05030f]">
      {/* ---- HUD above the canvas ---- */}
      {screen === "playing" && (
        <HudTop
          hud={hud}
          onPause={pause}
          audio={{
            musicMuted,
            sfxMuted,
            onToggleMusic: toggleMusic,
            onToggleSfx: toggleSfx,
          }}
        />
      )}

      {/* ---- Playfield ---- */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

        {screen === "playing" && <HudOverlay hud={hud} />}

        {screen === "playing" && banner && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 grid place-items-center">
            <div className="anim-in text-center">
              <div
                className="font-display text-4xl font-black tracking-[0.2em] text-white md:text-6xl"
                style={{ textShadow: "0 0 26px #ff3d9e, 0 0 60px #35f3ff" }}
              >
                {banner.t}
              </div>
              <div className="font-display mt-1 text-[10px] tracking-[0.45em] text-cyan-300/80">
                {banner.s}
              </div>
            </div>
          </div>
        )}

        {/* Mobile overpay hint zone */}
        {screen === "playing" && (
          <div className="pointer-events-none absolute bottom-3 right-3 md:hidden">
            <div className="grid h-16 w-16 place-items-center rounded-full border border-amber-300/40 bg-amber-300/10">
              <div className="font-display text-center text-[8px] leading-tight tracking-widest text-amber-200/80">
                TAP
                <br />
                OVERPAY
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- HUD below the canvas ---- */}
      {screen === "playing" && <HudBottom hud={hud} />}

      {/* Audio controls on non-playing screens (during play they live next to pause) */}
      {screen !== "playing" && (
        <div className="absolute right-3 top-3 z-30 flex gap-2">
          <AudioButtons
            musicMuted={musicMuted}
            sfxMuted={sfxMuted}
            onToggleMusic={toggleMusic}
            onToggleSfx={toggleSfx}
          />
        </div>
      )}

      {screen === "menu" && (
        <StartScreen
          onStart={start}
          best={scores}
          difficulty={difficulty}
          setDifficulty={(d) => {
            audio.resume();
            audio.ui();
            setDifficulty(d);
          }}
        />
      )}
      {screen === "upgrade" && (
        <UpgradeScreen
          wave={waveDone}
          choices={choices}
          levels={hud.levels}
          score={hud.score}
          points={hud.upgradePoints}
          onPick={pick}
        />
      )}
      {screen === "paused" && <PauseScreen onResume={resume} onQuit={quit} />}
      {screen === "over" && (
        <GameOverScreen
          score={result.score}
          wave={result.wave}
          killed={result.killed}
          best={scores}
          isRecord={result.record}
          principal={result.principal}
          interest={result.interest}
          blocks={result.blocks}
          bosses={result.bosses}
          difficulty={result.difficulty}
          onRestart={start}
          onMenu={quit}
        />
      )}
    </div>
  );
}
