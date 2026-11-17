import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface Top1GoldenBurstProps {
  /** Altera a chave para disparar uma nova explosão dourada */
  burstKey?: number;
  /** Variante de posicionamento: 'overlay' cobre o topo do card/pódio, 'pedestal' foca no pedestal de 1º lugar */
  variant?: 'overlay' | 'pedestal';
}

interface GoldenConfettiParticle {
  id: number;
  kind: 'ribbon' | 'foil' | 'sparkle' | 'star';
  color: string;
  glow: string;
  startX: number;
  midX: number;
  endX: number;
  peakY: number;
  endY: number;
  width: number;
  height: number;
  rotateZ: number;
  rotateY: number;
  rotateX: number;
  delay: number;
  duration: number;
}

interface AmbientGlint {
  id: number;
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
}

const GOLD_PALETTE = [
  { color: '#fde047', glow: 'rgba(253, 224, 71, 0.85)' },
  { color: '#facc15', glow: 'rgba(250, 204, 21, 0.9)' },
  { color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.85)' },
  { color: '#fef08a', glow: 'rgba(254, 240, 138, 0.95)' },
  { color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.85)' },
  { color: '#ffffff', glow: 'rgba(255, 255, 255, 0.95)' },
];

// Gerador determinístico pseudo-aleatório (evita flicker em re-renderizações)
function seeded(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Sistema de partículas em Framer Motion exclusivo para vitórias Top 1:
 * explode confetes dourados metálicos em 3D e brilhos cintilantes sobre o pódio.
 */
export const Top1GoldenBurst: React.FC<Top1GoldenBurstProps> = ({
  burstKey = 1,
  variant = 'overlay',
}) => {
  const particles = useMemo<GoldenConfettiParticle[]>(() => {
    const count = variant === 'pedestal' ? 22 : 36;
    const spreadScale = variant === 'pedestal' ? 0.55 : 1;

    return Array.from({ length: count }).map((_, i) => {
      const r1 = seeded(i + 1 + burstKey * 31);
      const r2 = seeded(i + 101 + burstKey * 17);
      const r3 = seeded(i + 211 + burstKey * 13);
      const r4 = seeded(i + 307 + burstKey * 7);
      const r5 = seeded(i + 409 + burstKey * 23);

      const palette = GOLD_PALETTE[Math.floor(r1 * GOLD_PALETTE.length)];
      const kinds: GoldenConfettiParticle['kind'][] = [
        'ribbon',
        'ribbon',
        'foil',
        'sparkle',
        'star',
      ];
      const kind = kinds[i % kinds.length];

      // Ângulo radial apontado para cima e para os lados formando leque de explosão
      const angle = -Math.PI * (0.12 + r2 * 0.76);
      const power = (140 + r3 * 220) * spreadScale;
      const vx = Math.cos(angle) * power;
      const vy = Math.sin(angle) * power;

      // Segunda onda ligeiramente atrasada para sensação de cascata real
      const waveDelay = i >= count * 0.65 ? 0.28 + r4 * 0.22 : r4 * 0.14;

      return {
        id: i,
        kind,
        color: palette.color,
        glow: palette.glow,
        startX: (r5 - 0.5) * 28,
        midX: vx * 0.72,
        endX: vx * 1.18 + (r1 - 0.5) * 45,
        peakY: vy * 0.85,
        endY: vy * 0.15 + (140 + r3 * 160) * spreadScale,
        width: kind === 'ribbon' ? 6 + r1 * 5 : kind === 'foil' ? 8 + r2 * 5 : 12 + r3 * 8,
        height: kind === 'ribbon' ? 14 + r2 * 8 : kind === 'foil' ? 8 + r1 * 5 : 12 + r3 * 8,
        rotateZ: (r2 - 0.5) * 900,
        rotateY: 360 + r3 * 720,
        rotateX: 180 + r4 * 540,
        delay: waveDelay,
        duration: 1.7 + r5 * 0.9,
      };
    });
  }, [burstKey, variant]);

  const glints = useMemo<AmbientGlint[]>(() => {
    const count = variant === 'pedestal' ? 6 : 8;
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: `${10 + seeded(i + 501) * 80}%`,
      top: `${8 + seeded(i + 607) * 76}%`,
      size: 12 + seeded(i + 709) * 12,
      delay: seeded(i + 811) * 1.8,
      duration: 1.4 + seeded(i + 919) * 1.2,
    }));
  }, [variant]);

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none overflow-hidden z-20"
    >
      {/* Clarão dourado central no momento da explosão */}
      <motion.div
        key={`flash-${burstKey}-${variant}`}
        initial={{ opacity: 0.9, scale: 0.2 }}
        animate={{ opacity: [0.9, 0.45, 0], scale: [0.2, 1.4, 2.1] }}
        transition={{ duration: 0.85, type: 'tween', ease: 'easeOut' }}
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(254,240,138,0.75)_0%,rgba(245,158,11,0.35)_45%,transparent_72%)] ${
          variant === 'pedestal' ? 'top-1/3 w-44 h-44' : 'top-[42%] w-72 h-72'
        }`}
      />

      {/* Onda expansiva dourada sobre o pódio */}
      <motion.div
        key={`ring-${burstKey}-${variant}`}
        initial={{ opacity: 0.85, scale: 0.15 }}
        animate={{ opacity: [0.85, 0.35, 0], scale: [0.15, 1.35, 1.95] }}
        transition={{ duration: 0.95, type: 'tween', ease: 'easeOut' }}
        className={`absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-yellow-300/90 shadow-[0_0_30px_rgba(250,204,21,0.75)] ${
          variant === 'pedestal' ? 'top-1/3 w-36 h-36' : 'top-[42%] w-64 h-64'
        }`}
      />

      {/* Epicentro da explosão de confetes dourados e brilhos */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 ${
          variant === 'pedestal' ? 'top-[32%]' : 'top-[44%]'
        }`}
      >
        {particles.map((p) => (
          <motion.div
            key={`${burstKey}-${p.id}`}
            initial={{
              x: p.startX,
              y: 0,
              scale: 0,
              opacity: 0,
              rotateZ: 0,
              rotateY: 0,
              rotateX: 0,
            }}
            animate={{
              x: [p.startX, p.midX, p.endX],
              y: [0, p.peakY, p.endY],
              scale: [0, 1.25, 1, 0.65],
              opacity: [0, 1, 1, 0],
              rotateZ: [0, p.rotateZ * 0.5, p.rotateZ],
              rotateY: [0, p.rotateY * 0.5, p.rotateY],
              rotateX: [0, p.rotateX * 0.5, p.rotateX],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              type: 'tween',
              ease: [0.16, 1, 0.3, 1],
              times: [0, 0.38, 0.78, 1],
            }}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              willChange: 'transform, opacity',
            }}
          >
            {p.kind === 'star' || p.kind === 'sparkle' ? (
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
            ) : (
              <div
                style={{
                  width: `${p.width}px`,
                  height: `${p.height}px`,
                  background: `linear-gradient(135deg, #fef9c3 0%, ${p.color} 55%, #b45309 100%)`,
                  borderRadius: p.kind === 'ribbon' ? '2px' : '1px',
                }}
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Brilhos dourados cintilantes contínuos sobre o pódio do Top 1 */}
      {glints.map((g) => (
        <motion.div
          key={`glint-${variant}-${g.id}`}
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{
            scale: [0, 1.15, 0.35, 1, 0],
            opacity: [0, 1, 0.4, 0.95, 0],
            rotate: [0, 45, 90],
          }}
          transition={{
            duration: g.duration,
            delay: g.delay,
            repeat: Infinity,
            repeatDelay: 0.6,
            type: 'tween',
            ease: 'easeInOut',
          }}
          style={{
            position: 'absolute',
            left: g.left,
            top: g.top,
            willChange: 'transform, opacity',
          }}
        >
          <svg
            width={g.size}
            height={g.size}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 1L14.2 9.8L23 12L14.2 14.2L12 23L9.8 14.2L1 12L9.8 9.8L12 1Z"
              fill="#fef08a"
            />
          </svg>
        </motion.div>
      ))}
    </div>
  );
};
