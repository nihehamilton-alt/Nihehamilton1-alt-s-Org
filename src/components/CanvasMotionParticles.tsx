import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface MotionParticleBurst {
  id: number;
  kind: 'jump' | 'coin';
  xPct: number;
  yPct: number;
  color?: string;
  value?: number;
}

interface CanvasMotionParticlesProps {
  bursts: MotionParticleBurst[];
}

const JUMP_VECTORS: ReadonlyArray<{ dx: number; dy: number; size: number; delay: number }> = [
  { dx: -26, dy: -16, size: 6, delay: 0 },
  { dx: -15, dy: -28, size: 5, delay: 0.02 },
  { dx: 0, dy: -32, size: 6, delay: 0.01 },
  { dx: 15, dy: -28, size: 5, delay: 0.02 },
  { dx: 26, dy: -16, size: 6, delay: 0 },
  { dx: -18, dy: 8, size: 4, delay: 0.03 },
  { dx: 18, dy: 8, size: 4, delay: 0.03 },
];

const COIN_VECTORS: ReadonlyArray<{ dx: number; dy: number; size: number; rot: number; delay: number }> = [
  { dx: -28, dy: -20, size: 7, rot: 45, delay: 0 },
  { dx: 28, dy: -20, size: 7, rot: -45, delay: 0 },
  { dx: 0, dy: -34, size: 8, rot: 90, delay: 0.02 },
  { dx: -32, dy: 6, size: 6, rot: 30, delay: 0.02 },
  { dx: 32, dy: 6, size: 6, rot: -30, delay: 0.02 },
  { dx: -16, dy: 24, size: 5, rot: 60, delay: 0.03 },
  { dx: 16, dy: 24, size: 5, rot: -60, delay: 0.03 },
  { dx: 0, dy: 30, size: 5, rot: 0, delay: 0.04 },
];

export const CanvasMotionParticles: React.FC<CanvasMotionParticlesProps> = React.memo(({ bursts }) => {
  if (bursts.length === 0) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden z-[18]"
      aria-hidden="true"
    >
      <AnimatePresence>
        {bursts.map((burst) => (
          <div
            key={burst.id}
            className="absolute"
            style={{
              left: `${burst.xPct}%`,
              top: `${burst.yPct}%`,
            }}
          >
            {burst.kind === 'jump' ? (
              <>
                <motion.div
                  initial={{ opacity: 0.9, scale: 0.3, x: '-50%', y: '-50%' }}
                  animate={{ opacity: 0, scale: 1.55, x: '-50%', y: '-50%' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                  className="w-10 h-4 rounded-full border-2"
                  style={{
                    borderColor: burst.color || '#38bdf8',
                    boxShadow: `0 0 12px ${burst.color || 'rgba(56,189,248,0.65)'}`,
                  }}
                />

                {JUMP_VECTORS.map((vec, idx) => (
                  <motion.span
                    key={idx}
                    initial={{
                      opacity: 0.95,
                      scale: 0.5,
                      x: 0,
                      y: 0,
                    }}
                    animate={{
                      opacity: [0.95, 0.85, 0],
                      scale: [0.5, 1.15, 0.25],
                      x: vec.dx,
                      y: vec.dy,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.45,
                      delay: vec.delay,
                      ease: 'easeOut',
                    }}
                    className="absolute rounded-full -translate-x-1/2 -translate-y-1/2"
                    style={{
                      width: vec.size,
                      height: vec.size,
                      backgroundColor: idx % 2 === 0 ? burst.color || '#38bdf8' : '#fef08a',
                      boxShadow: `0 0 8px ${idx % 2 === 0 ? burst.color || '#38bdf8' : '#fde047'}`,
                    }}
                  />
                ))}
              </>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0.95, scale: 0.35, x: '-50%', y: '-50%' }}
                  animate={{ opacity: 0, scale: 1.75, x: '-50%', y: '-50%' }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.44, ease: 'easeOut' }}
                  className="w-9 h-9 rounded-full border-2 border-amber-300 shadow-[0_0_16px_rgba(253,224,71,0.85)]"
                />

                {COIN_VECTORS.map((vec, idx) => (
                  <motion.span
                    key={idx}
                    initial={{
                      opacity: 1,
                      scale: 0.4,
                      rotate: 0,
                      x: 0,
                      y: 0,
                    }}
                    animate={{
                      opacity: [1, 1, 0],
                      scale: [0.4, 1.2, 0.2],
                      rotate: vec.rot,
                      x: vec.dx,
                      y: vec.dy,
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.52,
                      delay: vec.delay,
                      ease: 'easeOut',
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[2px]"
                    style={{
                      width: vec.size,
                      height: vec.size,
                      backgroundColor: idx % 2 === 0 ? '#fde047' : '#f59e0b',
                      boxShadow: '0 0 10px rgba(253, 224, 71, 0.9)',
                    }}
                  />
                ))}

                {typeof burst.value === 'number' && burst.value > 0 && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.65, x: '-50%', y: -6 }}
                    animate={{ opacity: [0, 1, 1, 0], scale: [0.65, 1.15, 1, 0.95], x: '-50%', y: -34 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className="absolute font-mono font-black text-xs text-amber-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)] whitespace-nowrap"
                  >
                    +{burst.value} 🪙
                  </motion.span>
                )}
              </>
            )}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
});

CanvasMotionParticles.displayName = 'CanvasMotionParticles';
