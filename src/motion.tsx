import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type Variants } from "motion/react";
import { BadgeCheck, Users, Wallet } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Shared presets                                                      */
/* ------------------------------------------------------------------ */

export const spring = { type: "spring" as const, stiffness: 380, damping: 32 };
export const softSpring = { type: "spring" as const, stiffness: 260, damping: 26 };

/** Parent: staggers its children in. Child: slides up + fades. */
export const listV: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};
export const cardV: Variants = {
  hidden: { opacity: 0, y: 22, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 26 } },
  exit: { opacity: 0, scale: 0.94, transition: { duration: 0.16 } },
};

/** Bottom-sheet animation props (spread onto motion.div). */
export const backdropAnim = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.22 },
};
export const panelAnim = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: { type: "spring" as const, damping: 34, stiffness: 400, mass: 0.9 },
};

/* ------------------------------------------------------------------ */
/* Headline reveal, word by word                                       */
/* ------------------------------------------------------------------ */

export function SplitWords({ text, delay = 0, wordClassName = "" }: { text: string; delay?: number; wordClassName?: string }) {
  const words = text.split(" ");
  return (
    <span aria-label={text}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} aria-hidden="true" className="inline-block overflow-hidden py-[0.1em] -my-[0.1em] align-bottom">
          <motion.span
            className={`inline-block ${wordClassName}`}
            initial={{ y: "115%", rotate: 4 }}
            animate={{ y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 210, damping: 24, delay: delay + i * 0.07 }}
          >
            {word}
            {i < words.length - 1 ? "\u00A0" : ""}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Seat dots: fill in as people join                                   */
/* ------------------------------------------------------------------ */

export function SeatDots({ seats, joined }: { seats: number; joined: number }) {
  const total = Math.min(Math.max(seats, 0), 8);
  return (
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <motion.span
          key={i}
          className={`seat-dot ${i < joined ? "seat-dot-filled" : ""}`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.25 + i * 0.05 }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Trip-created celebration                                            */
/* ------------------------------------------------------------------ */

export function AnimatedCheck() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <motion.path d="M5 12.5l4.5 4.5L19 7.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.45, delay: 0.35, ease: "easeOut" }} />
    </svg>
  );
}

const BURST_COLORS = ["#2563eb", "#f5a623", "#16a34a", "#38bdf8", "#f472b6"];

export function SuccessBurst() {
  const particles = Array.from({ length: 16 }).map((_, i) => {
    const angle = (i / 16) * Math.PI * 2 + (i % 2 ? 0.15 : 0);
    const dist = 52 + (i % 3) * 16;
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, color: BURST_COLORS[i % BURST_COLORS.length], round: i % 2 === 0, spin: (i % 2 ? 1 : -1) * (120 + i * 18) };
  });
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden="true">
      <motion.span
        className="absolute -left-6 -top-6 h-12 w-12 rounded-full border-2 border-[#16a34a]"
        initial={{ scale: 0.4, opacity: 0.7 }}
        animate={{ scale: 2.6, opacity: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
      />
      {particles.map((p, i) => (
        <motion.span
          key={i}
          className={`absolute -left-[4px] -top-[4px] h-2 w-2 ${p.round ? "rounded-full" : "rounded-[2px]"}`}
          style={{ background: p.color }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: p.x, y: p.y, scale: [0, 1.2, 0.7], opacity: [1, 1, 0], rotate: p.spin }}
          transition={{ duration: 0.95, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Hero: a live route scene                                            */
/* ------------------------------------------------------------------ */

const ROUTE = "M56 262 C 56 150, 190 214, 200 142 S 300 64, 344 74";

function Chip({ className, delay, bob, children }: { className: string; delay: number; bob: number; children: ReactNode }) {
  return (
    <motion.div
      className={`scene-chip ${className}`}
      initial={{ opacity: 0, scale: 0.7, y: 14 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 18, delay }}
    >
      <motion.div className="scene-chip-inner" animate={{ y: [0, -5, 0] }} transition={{ duration: bob, repeat: Infinity, ease: "easeInOut", delay: delay + 0.6 }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function HeroScene() {
  const reduce = useReducedMotion();
  const pathRef = useRef<SVGPathElement>(null);
  const [stops, setStops] = useState<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    setStops([0.36, 0.68].map((t) => {
      const pt = path.getPointAtLength(len * t);
      return { x: pt.x, y: pt.y };
    }));
  }, []);

  // Pointer-driven 3D tilt (desktop only)
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [5, -5]), { stiffness: 120, damping: 18 });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-6, 6]), { stiffness: 120, damping: 18 });
  const onMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    mx.set((event.clientX - rect.left) / rect.width - 0.5);
    my.set((event.clientY - rect.top) / rect.height - 0.5);
  };
  const onLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      className="scene-wrap"
      initial={{ opacity: 0, y: 28, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.2 }}
    >
      <motion.div className="scene" style={{ rotateX, rotateY, transformPerspective: 1000 }} onPointerMove={onMove} onPointerLeave={onLeave}>
        <div className="scene-grid" />
        <svg viewBox="0 0 400 340" className="absolute inset-0 h-full w-full" role="img" aria-label="A car driving a route between two points while passengers join along the way">
          <defs>
            <linearGradient id="routeGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#2563eb" />
              <stop offset="1" stopColor="#38bdf8" />
            </linearGradient>
          </defs>

          {/* road: wide soft base, drawn-in trail, marching dashes */}
          <path ref={pathRef} d={ROUTE} fill="none" stroke="rgba(37,99,235,.10)" strokeWidth="16" strokeLinecap="round" />
          <motion.path d={ROUTE} fill="none" stroke="url(#routeGrad)" strokeWidth="4" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.8, delay: 0.5, ease: [0.65, 0, 0.35, 1] }} />
          <path d={ROUTE} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 10" className={reduce ? "" : "scene-march"} opacity="0.9" />

          {/* pickup stops */}
          {stops.map((stop, i) => (
            <g key={i} transform={`translate(${stop.x} ${stop.y})`}>
              {!reduce && (
                <circle r="6" fill="none" stroke="#f5a623" strokeWidth="2">
                  <animate attributeName="r" values="6;20" dur="2.6s" begin={`${1.2 + i * 1.1}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values=".7;0" dur="2.6s" begin={`${1.2 + i * 1.1}s`} repeatCount="indefinite" />
                </circle>
              )}
              <circle r="6" fill="#fff" stroke="#f5a623" strokeWidth="3" />
            </g>
          ))}

          {/* start pin */}
          <g transform="translate(56 262)">
            {!reduce && (
              <circle r="9" fill="none" stroke="#2563eb" strokeWidth="2">
                <animate attributeName="r" values="9;26" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values=".6;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            <circle r="10" fill="#2563eb" stroke="#fff" strokeWidth="4" />
          </g>

          {/* end pin */}
          <g transform="translate(344 74)">
            <circle r="16" fill="rgba(15,23,42,.08)" />
            <circle r="10" fill="#0f172a" stroke="#fff" strokeWidth="4" />
            <circle r="3" fill="#fff" />
          </g>

          {/* the car */}
          {reduce ? (
            stops[1] && <g transform={`translate(${stops[1].x} ${stops[1].y}) rotate(-28)`}><Car /></g>
          ) : (
            <g>
              <Car />
              <animateMotion dur="9s" begin="1.2s" repeatCount="indefinite" rotate="auto" calcMode="spline" keyTimes="0;1" keySplines="0.45 0 0.25 1" path={ROUTE} />
            </g>
          )}
        </svg>

        <Chip className="chip-a" delay={0.9} bob={4.2}>
          <span className="chip-icon bg-[#fdebc8] text-[#996d16]"><Users className="h-3.5 w-3.5" /></span>
          <span>2 seats left</span>
        </Chip>
        <Chip className="chip-b" delay={1.15} bob={5}>
          <span className="chip-icon bg-[#dbeafe] text-[#2563eb]"><Wallet className="h-3.5 w-3.5" /></span>
          <span>GHS 8 each</span>
        </Chip>
        <Chip className="chip-c" delay={1.4} bob={4.6}>
          <span className="chip-icon bg-[#dcf1e3] text-[#16794a]"><BadgeCheck className="h-3.5 w-3.5" /></span>
          <span>Request approved</span>
        </Chip>
      </motion.div>
    </motion.div>
  );
}

function Car() {
  return (
    <g>
      <ellipse cx="0" cy="9" rx="15" ry="4" fill="rgba(15,23,42,.18)" />
      <rect x="-15" y="-8" width="30" height="16" rx="6" fill="#2563eb" stroke="#fff" strokeWidth="2" />
      <rect x="1" y="-6" width="9" height="12" rx="3" fill="#dbeafe" />
      <rect x="-9" y="-6" width="7" height="12" rx="2" fill="#1d4ed8" />
      <circle cx="14" cy="-4.5" r="1.8" fill="#fde68a" />
      <circle cx="14" cy="4.5" r="1.8" fill="#fde68a" />
    </g>
  );
}
