import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface FirstPlaceParticleExplosionProps {
  /** Key that increments to re-trigger the 1st-place particle explosion */
  burstKey?: number;
}

interface BallisticParticle {
  id: number;
  kind: 'spark' | 'shard' | 'coin' | 'star' | 'crown';
  angleDeg: number;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  endX: number;
  endY: number;
  width: number;
  height: number;
  color: string;
  glow: string;
  spinZ: number;
  spinY: number;
  spinX: number;
  delay: number;
  duration: number;
  peakScale: number;
}

const CHAMPION_COLORS = [
  { color: '#fef08a', glow: 'rgba(254, 240, 138, 0.95)' },
  { color: '#facc15', glow: 'rgba(250, 204, 21, 0.95)' },
  { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.9)' },
  { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.9)' },
  { color: '#ffffff', glow: 'rgba(255, 255, 255, 0.98)' },
  { color: '#fb923c', glow: 'rgba(251, 146, 60, 0.85)' },
];

function deterministicRand(seed: number): number {
  const x = Math.sin(seed * 19.913 + 47.717) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Full-viewport Framer Motion high-impact particle explosion rendered
 * exclusively when the player finishes in 1st place on ResultsPodium.
 */
export const FirstPlaceParticleExplosion: React.FC<FirstPlaceParticleExplosionProps> = ({
  burstKey = 1,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const particles = useMemo<BallisticParticle[]>(() => {
    const total = 48;
    return Array.from({ length: total }).map((_, i) => {
      const r1 = deterministicRand(i * 3 + 1 + burstKey * 41);
      const r2 = deterministicRand(i * 5 + 17 + burstKey * 29);
      const r3 = deterministicRand(i * 7 + 53 + burstKey * 19);
      const r4 = deterministicRand(i * 11 + 89 + burstKey * 13);
      const r5 = deterministicRand(i * 13 + 131 + burstKey * 7);

      const palette = CHAMPION_COLORS[Math.floor(r1 * CHAMPION_COLORS.length)];

      let kind: BallisticParticle['kind'];
      if (i < 18) kind = 'spark';
      else if (i < 30) kind = 'shard';
      else if (i < 38) kind = 'coin';
      else if (i < 44) kind = 'star';
      else kind = 'crown';

      // Full 360° radial spread with slight upward bias for celebratory lift
      const baseAngle = (i / total) * Math.PI * 2 + (r2 - 0.5) * 0.22;
      const isSecondWave = i >= 56;
      const speed =
        kind === 'spark'
          ? 260 + r3 * 340
          : kind === 'crown'
          ? 180 + r3 * 220
          : 190 + r3 * 300;

      const vx = Math.cos(baseAngle) * speed;
      const vy = Math.sin(baseAngle) * speed - 45;
      const gravityDrop = kind === 'spark' ? 40 : 140 + r4 * 140;

      const delay = isSecondWave ? 0.14 + r4 * 0.16 : r4 * 0.08;
      const duration =
        kind === 'spark' ? 0.95 + r5 * 0.45 : 1.55 + r5 * 0.85;

      return {
        id: i,
        kind,
        angleDeg: (baseAngle * 180) / Math.PI,
        startX: (r1 - 0.5) * 14,
        startY: (r2 - 0.5) * 14,
        midX: vx * 0.68,
        midY: vy * 0.68,
        endX: vx * 1.15,
        endY: vy * 1.05 + gravityDrop,
        width:
          kind === 'spark'
            ? 24 + r1 * 26
            : kind === 'shard'
            ? 9 + r2 * 7
            : kind === 'coin'
            ? 14 + r1 * 6
            : 18 + r3 * 10,
        height:
          kind === 'spark'
            ? 3 + r2 * 2
            : kind === 'shard'
            ? 14 + r3 * 10
            : kind === 'coin'
            ? 14 + r1 * 6
            : 18 + r3 * 10,
        color: palette.color,
        glow: palette.glow,
        spinZ: kind === 'spark' ? (baseAngle * 180) / Math.PI : (r2 - 0.5) * 960,
        spinY: 360 + r3 * 720,
        spinX: 180 + r4 * 540,
        delay,
        duration,
        peakScale: kind === 'crown' ? 1.45 : kind === 'spark' ? 1.25 : 1.35,
      };
    });
  }, [burstKey]);

  if (shouldReduceMotion) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-[60] overflow-hidden flex items-center justify-center"
    >
      {/* Epicenter centered slightly above viewport middle to align with the crown reveal */}
      <div className="relative -translate-y-[8vh]">
        {/* Stage 1: Blinding Championship Gold Core Flash */}
        <motion.div
          key={`core-flash-${burstKey}`}
          initial={{ scale: 0.1, opacity: 1 }}
          animate={{ scale: [0.1, 1.85, 3.1], opacity: [1, 0.72, 0] }}
          transition={{ duration: 0.75, type: 'tween', ease: 'easeOut' }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(254,240,138,0.85)_26%,rgba(245,158,11,0.42)_55%,transparent_75%)]"
        />

        {/* Stage 2: Horizontal Anamorphic Impact Streak */}
        <motion.div
          key={`impact-beam-${burstKey}`}
          initial={{ scaleX: 0.08, scaleY: 1.6, opacity: 0.95 }}
          animate={{ scaleX: [0.08, 2.4, 3.6], scaleY: [1.6, 0.55, 0], opacity: [0.95, 0.7, 0] }}
          transition={{ duration: 0.72, type: 'tween', ease: [0.16, 1, 0.3, 1] }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-80 h-6 rounded-full bg-gradient-to-r from-transparent via-yellow-200 to-transparent shadow-[0_0_32px_rgba(250,204,21,0.95)]"
        />

        {/* Stage 3: Primary Expanding Shockwave Ring */}
        <motion.div
          key={`shockwave-1-${burstKey}`}
          initial={{ scale: 0.12, opacity: 0.95 }}
          animate={{ scale: [0.12, 2.6, 4.2], opacity: [0.95, 0.45, 0] }}
          transition={{ duration: 0.95, type: 'tween', ease: [0.12, 0.85, 0.25, 1] }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full border-4 border-yellow-300 shadow-[0_0_45px_rgba(250,204,21,0.9),inset_0_0_24px_rgba(254,240,138,0.65)]"
        />

        {/* Stage 4: Secondary Rotating Solar Halo Shockwave */}
        <motion.div
          key={`shockwave-2-${burstKey}`}
          initial={{ scale: 0.18, opacity: 0.85, rotate: 0 }}
          animate={{ scale: [0.18, 2.2, 3.6], opacity: [0.85, 0.38, 0], rotate: 55 }}
          transition={{ duration: 1.15, delay: 0.1, type: 'tween', ease: 'easeOut' }}
          className="absolute -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 border-dashed border-amber-300/90 shadow-[0_0_36px_rgba(245,158,11,0.7)]"
        />

        {/* 48 High-Velocity Radial Ballistic Particles */}
        {particles.map((p) => (
          <motion.div
            key={`p-${burstKey}-${p.id}`}
            initial={{
              x: p.startX,
              y: p.startY,
              scale: 0,
              opacity: 0,
              rotateZ: p.kind === 'spark' ? p.angleDeg : 0,
              rotateY: 0,
              rotateX: 0,
            }}
            animate={{
              x: [p.startX, p.midX, p.endX],
              y: [p.startY, p.midY, p.endY],
              scale: [0, p.peakScale, 0.9, 0],
              opacity: [0, 1, 0.95, 0],
              rotateZ: p.kind === 'spark' ? p.angleDeg : [0, p.spinZ * 0.6, p.spinZ],
              rotateY: p.kind === 'spark' ? 0 : [0, p.spinY * 0.5, p.spinY],
              rotateX: p.kind === 'spark' ? 0 : [0, p.spinX * 0.5, p.spinX],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              type: 'tween',
              ease: [0.12, 0.92, 0.25, 1],
              times: [0, 0.28, 0.72, 1],
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              willChange: 'transform, opacity',
            }}
            className="-translate-x-1/2 -translate-y-1/2"
          >
            {p.kind === 'spark' && (
              <div
                style={{
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  borderRadius: '9999px',
                  background: `linear-gradient(90deg, transparent 0%, ${p.color} 55%, #ffffff 100%)`,
                }}
              />
            )}

            {p.kind === 'shard' && (
              <div
                style={{
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  borderRadius: '2px',
                  background: `linear-gradient(145deg, #ffffff 0%, ${p.color} 45%, #b45309 100%)`,
                }}
              />
            )}

            {p.kind === 'coin' && (
              <div
                style={{
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  borderRadius: '9999px',
                  background: 'radial-gradient(circle at 35% 30%, #fef9c3 0%, #facc15 55%, #b45309 100%)',
                  border: '1.5px solid #fef08a',
                }}
              />
            )}

            {p.kind === 'star' && (
              <svg
                width={p.width}
                height={p.height}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2L12 0Z"
                  fill={p.color}
                />
              </svg>
            )}

            {p.kind === 'crown' && (
              <svg
                width={p.width + 4}
                height={p.height + 4}
                viewBox="0 0 24 24"
                fill="none"
              >
                <path
                  d="M2.5 18.5L4.5 7.5L9.5 12L12 4.5L14.5 12L19.5 7.5L21.5 18.5H2.5Z"
                  fill="#facc15"
                  stroke="#fef08a"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <rect x="3" y="19.5" width="18" height="2.2" rx="1" fill="#f59e0b" />
              </svg>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
