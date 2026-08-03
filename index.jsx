import React, { useState, useRef, useCallback, useEffect } from "react";

// ── palette rotation for background mood shifts ─────────────────
const PALETTES = [
  ["#FF6B9D", "#FFC93C"],
  ["#7C3AED", "#22D3EE"],
  ["#FF5E5B", "#FFED66"],
  ["#00C9A7", "#FFC75F"],
  ["#845EC2", "#FF6F91"],
  ["#00D2FC", "#F9F871"],
];

const MILESTONES = [
  { at: 10, text: "RISCALDAMENTO 🔥" },
  { at: 25, text: "PIEDOMANIA 🦶" },
  { at: 50, text: "SEI UN PROFESSIONISTA" },
  { at: 100, text: "LEGGENDA DEI PIEDI 👑" },
  { at: 200, text: "FIDOSESK È FIERO DI TE" },
];

let idSeed = 0;
const nextId = () => idSeed++;

// ── tiny synth engine, no external audio files needed ────────────
function useSynth() {
  const ctxRef = useRef(null);
  const enabledRef = useRef(true);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const tone = useCallback(
    ({ freq = 440, dur = 0.12, type = "sine", vol = 0.18, sweepTo = null, delay = 0 }) => {
      if (!enabledRef.current) return;
      const ctx = getCtx();
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    },
    [getCtx]
  );

  // playful upward "boop" that rises slightly with combo intensity
  const playTap = useCallback(
    (comboLevel = 0) => {
      const base = 320 + Math.min(comboLevel, 12) * 14;
      tone({ freq: base, sweepTo: base * 1.7, dur: 0.1, type: "triangle", vol: 0.14 });
    },
    [tone]
  );

  const playMilestone = useCallback(() => {
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) => tone({ freq: f, dur: 0.22, type: "square", vol: 0.12, delay: i * 0.09 }));
  }, [tone]);

  const playShake = useCallback(() => {
    tone({ freq: 90, sweepTo: 45, dur: 0.28, type: "sawtooth", vol: 0.2 });
  }, [tone]);

  const setEnabled = useCallback((v) => {
    enabledRef.current = v;
  }, []);

  return { playTap, playMilestone, playShake, setEnabled, getCtx };
}

function useShake() {
  const [shake, setShake] = useState(false);
  const trigger = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 220);
  }, []);
  return [shake, trigger];
}

export default function TapFeet() {
  const [count, setCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bursts, setBursts] = useState([]);
  const [pops, setPops] = useState([]);
  const [paletteIdx, setPaletteIdx] = useState(0);
  const [milestone, setMilestone] = useState(null);
  const [scale, setScale] = useState(1);
  const [shake, triggerShake] = useShake();
  const comboTimer = useRef(null);
  const btnRef = useRef(null);
  const seenMilestones = useRef(new Set());
  const [muted, setMuted] = useState(false);
  const synth = useSynth();

  useEffect(() => {
    synth.setEnabled(!muted);
  }, [muted, synth]);

  const EMOJIS = ["🦶", "🦶🏻", "🦶🏼", "🦶🏽", "🦶🏾", "🦶🏿"];

  const handleTap = useCallback(
    (e) => {
      const rect = btnRef.current.getBoundingClientRect();
      const cx = e.clientX ?? rect.left + rect.width / 2;
      const cy = e.clientY ?? rect.top + rect.height / 2;
      const localX = cx - rect.left;
      const localY = cy - rect.top;

      synth.playTap(combo);

      // increment
      setCount((c) => {
        const nc = c + 1;
        const hit = MILESTONES.find((m) => m.at === nc && !seenMilestones.current.has(nc));
        if (hit) {
          seenMilestones.current.add(nc);
          setMilestone(hit.text);
          synth.playMilestone();
          setTimeout(() => setMilestone(null), 1600);
        }
        return nc;
      });

      // combo streak
      setCombo((c) => c + 1);
      clearTimeout(comboTimer.current);
      comboTimer.current = setTimeout(() => setCombo(0), 900);

      // squash/pop button
      setScale(0.86);
      setTimeout(() => setScale(1.06), 80);
      setTimeout(() => setScale(1), 170);

      // shake on multiples of 10
      if ((count + 1) % 10 === 0) {
        triggerShake();
        synth.playShake();
        setPaletteIdx((p) => (p + 1) % PALETTES.length);
      }

      // particle burst of little feet flying outward
      const burstId = nextId();
      const particles = Array.from({ length: 10 }).map(() => ({
        id: nextId(),
        angle: Math.random() * Math.PI * 2,
        dist: 60 + Math.random() * 70,
        rot: (Math.random() - 0.5) * 240,
        emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
        size: 14 + Math.random() * 16,
        dur: 500 + Math.random() * 300,
      }));
      setBursts((b) => [...b, { id: burstId, x: localX, y: localY, particles }]);
      setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== burstId));
      }, 900);

      // floating +1 score popup
      const popId = nextId();
      setPops((p) => [...p, { id: popId, x: localX, y: localY }]);
      setTimeout(() => {
        setPops((p) => p.filter((x) => x.id !== popId));
      }, 700);
    },
    [count, triggerShake]
  );

  const [c1, c2] = PALETTES[paletteIdx];

  return (
    <div
      className="relative min-h-screen w-full flex flex-col items-center justify-center overflow-hidden select-none"
      style={{
        background: `radial-gradient(circle at 50% 20%, ${c1}22, transparent 60%), linear-gradient(160deg, #0F0B1E, #1A1030)`,
        transition: "background 0.6s ease",
        fontFamily: "'Poppins', 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@500;700;800&family=Fredoka:wght@600;700&display=swap');

        @keyframes floatBg {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(6deg); }
        }
        @keyframes shakeScreen {
          0%, 100% { transform: translate(0,0); }
          25% { transform: translate(-6px, 3px); }
          50% { transform: translate(6px, -3px); }
          75% { transform: translate(-4px, -2px); }
        }
        @keyframes popFly {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.5); }
          15% { opacity: 1; transform: translate(-50%,-50%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -140%) scale(1); }
        }
        @keyframes particleOut {
          0% { opacity: 1; transform: translate(-50%,-50%) rotate(0deg) scale(1); }
          100% { opacity: 0; transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.4); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 40px 10px rgba(255,255,255,0.15), 0 0 0 0 rgba(255,255,255,0.0); }
          50% { box-shadow: 0 0 70px 22px rgba(255,255,255,0.28), 0 0 0 14px rgba(255,255,255,0.03); }
        }
        @keyframes milestonePop {
          0% { opacity: 0; transform: translate(-50%,-50%) scale(0.4) rotate(-6deg); }
          15% { opacity: 1; transform: translate(-50%,-50%) scale(1.15) rotate(2deg); }
          25% { transform: translate(-50%,-50%) scale(1) rotate(0deg); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%,-70%) scale(0.9) rotate(0deg); }
        }
        @keyframes comboWiggle {
          0%,100% { transform: rotate(-3deg) scale(1); }
          50% { transform: rotate(3deg) scale(1.08); }
        }
        .shake-screen { animation: shakeScreen 0.22s ease; }
        .bg-blob { animation: floatBg 6s ease-in-out infinite; }
      `}</style>

      {/* ambient floating feet, decorative */}
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="bg-blob absolute text-3xl opacity-10 pointer-events-none"
          style={{
            left: `${(i * 47) % 100}%`,
            top: `${(i * 31) % 100}%`,
            animationDelay: `${i * 0.7}s`,
            filter: "blur(0.5px)",
          }}
        >
          🦶
        </div>
      ))}

      <button
        onClick={() => setMuted((m) => !m)}
        className="fixed top-5 right-5 z-50 w-11 h-11 rounded-full flex items-center justify-center text-lg"
        style={{
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.15)",
          color: "white",
        }}
        aria-label={muted ? "Attiva audio" : "Disattiva audio"}
      >
        {muted ? "🔇" : "🔊"}
      </button>

      <div className={`relative flex flex-col items-center ${shake ? "shake-screen" : ""}`}>
        {/* title */}
        <h1
          className="text-3xl md:text-5xl font-extrabold text-center mb-2 px-6"
          style={{
            fontFamily: "'Fredoka', sans-serif",
            background: `linear-gradient(90deg, ${c1}, ${c2})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            transition: "background 0.6s ease",
            textShadow: "0 4px 30px rgba(0,0,0,0.4)",
          }}
        >
          tocca i piedi a fidosesk
        </h1>
        <p className="text-white/50 text-sm mb-8 tracking-wide">l'unico vero obiettivo della tua giornata</p>

        {/* counter */}
        <div className="flex items-center gap-3 mb-10">
          <div
            className="px-6 py-2 rounded-full font-bold text-lg text-white"
            style={{
              background: `linear-gradient(90deg, ${c1}, ${c2})`,
              transition: "background 0.6s ease",
            }}
          >
            {count} tocchi
          </div>
          {combo >= 3 && (
            <div
              className="px-4 py-1.5 rounded-full text-sm font-bold text-white"
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.25)",
                animation: "comboWiggle 0.35s ease-in-out infinite",
              }}
            >
              🔥 x{combo} combo
            </div>
          )}
        </div>

        {/* the button */}
        <div className="relative">
          <button
            ref={btnRef}
            onClick={handleTap}
            className="relative rounded-full flex items-center justify-center active:brightness-110"
            style={{
              width: 220,
              height: 220,
              fontSize: 92,
              background: `linear-gradient(145deg, ${c1}, ${c2})`,
              transform: `scale(${scale})`,
              transition: "transform 0.12s cubic-bezier(.34,1.56,.64,1), background 0.6s ease",
              border: "6px solid rgba(255,255,255,0.25)",
              animation: "glowPulse 2.2s ease-in-out infinite",
              cursor: "pointer",
              touchAction: "manipulation",
            }}
          >
            🦶
          </button>

          {/* particle bursts */}
          {bursts.map((burst) => (
            <div key={burst.id} className="absolute inset-0 pointer-events-none">
              {burst.particles.map((p) => {
                const tx = Math.cos(p.angle) * p.dist;
                const ty = Math.sin(p.angle) * p.dist;
                return (
                  <span
                    key={p.id}
                    className="absolute"
                    style={{
                      left: burst.x,
                      top: burst.y,
                      fontSize: p.size,
                      "--tx": `${tx}px`,
                      "--ty": `${ty}px`,
                      "--rot": `${p.rot}deg`,
                      animation: `particleOut ${p.dur}ms ease-out forwards`,
                    }}
                  >
                    {p.emoji}
                  </span>
                );
              })}
            </div>
          ))}

          {/* +1 popups */}
          {pops.map((pop) => (
            <span
              key={pop.id}
              className="absolute pointer-events-none font-extrabold text-2xl"
              style={{
                left: pop.x,
                top: pop.y,
                color: c2,
                textShadow: "0 2px 10px rgba(0,0,0,0.4)",
                animation: "popFly 700ms ease-out forwards",
              }}
            >
              +1
            </span>
          ))}
        </div>

        <p className="text-white/30 text-xs mt-10 tracking-wide">continua a toccare, non fermarti mai</p>
      </div>

      {/* milestone banner */}
      {milestone && (
        <div
          className="fixed left-1/2 top-1/4 px-8 py-4 rounded-2xl font-extrabold text-xl text-white text-center z-50"
          style={{
            background: `linear-gradient(90deg, ${c1}, ${c2})`,
            animation: "milestonePop 1.6s ease forwards",
            boxShadow: "0 10px 50px rgba(0,0,0,0.5)",
            fontFamily: "'Fredoka', sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {milestone}
        </div>
      )}
    </div>
  );
}
