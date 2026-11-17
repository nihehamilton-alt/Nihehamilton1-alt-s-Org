import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface ConfettiCannonCanvasProps {
  /** Increments to trigger an immediate twin-cannon barrage alongside the fireworks */
  burstKey?: number;
}

type CannonParticleKind = 'ribbon' | 'streamer' | 'diamond' | 'star' | 'disc';

interface CannonParticle {
  kind: CannonParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  color: string;
  highlightColor: string;
  alpha: number;
  decay: number;
  gravity: number;
  drag: number;
  spin: number;
  spinSpeed: number;
  tilt: number;
  tiltSpeed: number;
  flutterPhase: number;
  flutterFreq: number;
  flutterAmp: number;
  trail: Array<{ x: number; y: number }>;
}

interface MuzzleFlash {
  x: number;
  y: number;
  angle: number;
  radius: number;
  alpha: number;
  color: string;
}

const CANNON_PALETTE = [
  { fill: '#facc15', highlight: '#fef9c3' }, // Championship Gold
  { fill: '#f59e0b', highlight: '#fde68a' }, // Royal Amber
  { fill: '#ef4444', highlight: '#fca5a5' }, // Angola Crimson
  { fill: '#10b981', highlight: '#a7f3d0' }, // Emerald Spark
  { fill: '#38bdf8', highlight: '#e0f2fe' }, // Electric Cyan
  { fill: '#f43f5e', highlight: '#fecdd3' }, // Neon Rose
  { fill: '#e2e8f0', highlight: '#ffffff' }, // Metallic Silver
];

const MAX_CANNON_PARTICLES = 240;

/**
 * High-density twin-corner Confetti Cannon canvas overlay that launches
 * specular tumbling foil ribbons, coiled serpentine streamers, stars, and diamonds
 * synchronized with the 1st-place fireworks bursts for multi-layered celebration depth.
 */
export const ConfettiCannonCanvas: React.FC<ConfettiCannonCanvasProps> = ({
  burstKey = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const fireBarrageRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (shouldReduceMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize);

    const particles: CannonParticle[] = [];
    const flashes: MuzzleFlash[] = [];
    const pendingTimeouts: Array<ReturnType<typeof setTimeout>> = [];
    let rafId = 0;
    let isRunning = true;

    const fireSingleCannon = (side: 'left' | 'right', count: number, powerScale = 1) => {
      if (document.hidden) return;

      if (particles.length > MAX_CANNON_PARTICLES - count) {
        particles.splice(0, Math.max(0, particles.length - (MAX_CANNON_PARTICLES - count)));
      }

      const originX = side === 'left' ? width * 0.03 : width * 0.97;
      const originY = height * 0.96;
      // Base angle aims diagonally upward & across the canopy (radians, 0 = right, -PI/2 = up)
      const baseAngle = side === 'left' ? -Math.PI * 0.34 : -Math.PI * 0.66;

      flashes.push({
        x: originX,
        y: originY,
        angle: baseAngle,
        radius: 42 * powerScale,
        alpha: 0.95,
        color: '#fef08a',
      });

      const minDim = Math.min(width, height);
      const speedBase = Math.max(12, Math.min(24, minDim * 0.025)) * powerScale;

      for (let i = 0; i < count; i++) {
        const swatch = CANNON_PALETTE[Math.floor(Math.random() * CANNON_PALETTE.length)];
        const roll = Math.random();
        let kind: CannonParticleKind;
        if (roll < 0.38) kind = 'ribbon';
        else if (roll < 0.62) kind = 'streamer';
        else if (roll < 0.78) kind = 'diamond';
        else if (roll < 0.91) kind = 'star';
        else kind = 'disc';

        const spreadAngle = baseAngle + (Math.random() - 0.5) * 0.48;
        const velocity = speedBase * (0.55 + Math.random() * 0.75);

        particles.push({
          kind,
          x: originX + (Math.random() - 0.5) * 14,
          y: originY + (Math.random() - 0.5) * 14,
          vx: Math.cos(spreadAngle) * velocity,
          vy: Math.sin(spreadAngle) * velocity,
          width:
            kind === 'ribbon'
              ? 6 + Math.random() * 5
              : kind === 'streamer'
              ? 2.8 + Math.random() * 1.8
              : kind === 'star'
              ? 8 + Math.random() * 5
              : kind === 'diamond'
              ? 7 + Math.random() * 5
              : 5 + Math.random() * 4,
          height:
            kind === 'ribbon'
              ? 14 + Math.random() * 10
              : kind === 'diamond'
              ? 11 + Math.random() * 6
              : 8 + Math.random() * 4,
          color: swatch.fill,
          highlightColor: swatch.highlight,
          alpha: 0.98,
          decay: kind === 'streamer' ? 0.0055 + Math.random() * 0.004 : 0.0045 + Math.random() * 0.004,
          gravity: kind === 'streamer' ? 0.19 : 0.23 + Math.random() * 0.07,
          drag: kind === 'streamer' ? 0.968 : 0.962,
          spin: Math.random() * Math.PI * 2,
          spinSpeed: (Math.random() - 0.5) * 0.24,
          tilt: Math.random() * Math.PI * 2,
          tiltSpeed: 0.14 + Math.random() * 0.18,
          flutterPhase: Math.random() * Math.PI * 2,
          flutterFreq: 0.08 + Math.random() * 0.08,
          flutterAmp: 0.35 + Math.random() * 0.55,
          trail: [],
        });
      }
    };

    const fireTwinCannonBarrage = () => {
      // Immediate synchronized volley flanking the fireworks opening salvo
      fireSingleCannon('left', 34, 1.08);
      fireSingleCannon('right', 34, 1.08);

      // Layered staggered second wave timed with sky detonations
      pendingTimeouts.push(
        setTimeout(() => {
          if (!isRunning) return;
          fireSingleCannon('left', 22, 0.95);
          fireSingleCannon('right', 22, 0.95);
        }, 360)
      );

      pendingTimeouts.push(
        setTimeout(() => {
          if (!isRunning) return;
          fireSingleCannon('left', 18, 1.02);
          fireSingleCannon('right', 18, 1.02);
        }, 820)
      );
    };

    fireBarrageRef.current = fireTwinCannonBarrage;
    fireTwinCannonBarrage();

    // Follow-up celebratory cannon volleys matching the periodic fireworks cadence
    const intervalId = setInterval(() => {
      if (!isRunning || document.hidden) return;
      const side: 'left' | 'right' = Math.random() > 0.5 ? 'left' : 'right';
      fireSingleCannon(side, 18, 0.92);
    }, 2100);

    const drawStar4 = (rOuter: number, rInner: number) => {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const radius = i % 2 === 0 ? rOuter : rInner;
        const a = (i * Math.PI) / 4;
        const px = Math.cos(a) * radius;
        const py = Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    };

    const render = () => {
      if (!isRunning) return;

      ctx.clearRect(0, 0, width, height);

      // Muzzle blast glow cones at cannon mouths
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.alpha -= 0.085;
        f.radius += 5.5;
        if (f.alpha <= 0.02) {
          flashes.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(f.x, f.y);
        ctx.rotate(f.angle);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, f.radius);
        grad.addColorStop(0, `rgba(255, 255, 255, ${f.alpha * 0.9})`);
        grad.addColorStop(0.35, `rgba(250, 204, 21, ${f.alpha * 0.65})`);
        grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, f.radius, -0.55, 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Update & draw cannon particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        if (p.kind === 'streamer') {
          p.trail.push({ x: p.x, y: p.y });
          if (p.trail.length > 9) p.trail.shift();
        }

        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;

        // Aerodynamic lateral flutter once upward launch slows
        p.flutterPhase += p.flutterFreq;
        const flutterDrift = Math.sin(p.flutterPhase) * p.flutterAmp;
        p.x += p.vx + flutterDrift;
        p.y += p.vy;

        p.spin += p.spinSpeed;
        p.tilt += p.tiltSpeed;
        p.alpha -= p.decay;

        if (p.alpha <= 0.02 || p.y > height + 40) {
          particles.splice(i, 1);
          continue;
        }

        const tiltCos = Math.cos(p.tilt);
        const glint = Math.abs(tiltCos) < 0.28;
        const activeColor = glint ? p.highlightColor : p.color;

        if (p.kind === 'streamer') {
          if (p.trail.length > 1) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
            ctx.strokeStyle = activeColor;
            ctx.lineWidth = p.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();
            ctx.moveTo(p.trail[0].x, p.trail[0].y);
            for (let t = 1; t < p.trail.length; t++) {
              const wave = Math.sin(p.flutterPhase + t * 0.85) * 2.4;
              ctx.lineTo(p.trail[t].x + wave, p.trail[t].y);
            }
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            ctx.restore();
          }
          continue;
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin);
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        ctx.fillStyle = activeColor;

        if (p.kind === 'ribbon') {
          const foilScaleY = 0.22 + 0.78 * Math.abs(tiltCos);
          ctx.scale(1, foilScaleY);
          // Subtle S-curve metallic ribbon foil
          ctx.beginPath();
          ctx.moveTo(-p.width * 0.5, -p.height * 0.5);
          ctx.quadraticCurveTo(p.width * 0.3, 0, -p.width * 0.25, p.height * 0.5);
          ctx.lineTo(p.width * 0.45, p.height * 0.5);
          ctx.quadraticCurveTo(p.width * 0.85, 0, p.width * 0.35, -p.height * 0.5);
          ctx.closePath();
          ctx.fill();
        } else if (p.kind === 'diamond') {
          ctx.scale(0.35 + 0.65 * Math.abs(tiltCos), 1);
          ctx.beginPath();
          ctx.moveTo(0, -p.height * 0.55);
          ctx.lineTo(p.width * 0.55, 0);
          ctx.lineTo(0, p.height * 0.55);
          ctx.lineTo(-p.width * 0.55, 0);
          ctx.closePath();
          ctx.fill();
        } else if (p.kind === 'star') {
          const pulse = 0.65 + 0.35 * Math.abs(tiltCos);
          ctx.scale(pulse, pulse);
          drawStar4(p.width * 0.65, p.width * 0.22);
          ctx.fill();
        } else {
          // Metallic confetti disc
          ctx.scale(0.35 + 0.65 * Math.abs(tiltCos), 1);
          ctx.beginPath();
          ctx.arc(0, 0, p.width * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      fireBarrageRef.current = null;
      cancelAnimationFrame(rafId);
      clearInterval(intervalId);
      pendingTimeouts.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    if (burstKey > 1 && fireBarrageRef.current) {
      fireBarrageRef.current();
    }
  }, [burstKey]);

  if (shouldReduceMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none w-full h-full z-[15]"
    />
  );
};
