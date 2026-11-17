import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

interface FirstPlaceFireworksCanvasProps {
  /** Triggers an immediate opening salvo whenever incremented (e.g. celebratory replay) */
  burstKey?: number;
}

interface FireworkRocket {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetY: number;
  hueColor: string;
  secondaryColor: string;
  pattern: 'chrysanthemum' | 'willow' | 'doubleRing' | 'crown';
  trail: Array<{ x: number; y: number }>;
}

interface FireworkSpark {
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
  drag: number;
  size: number;
  twinkle: boolean;
  twinklePhase: number;
  twinkleSpeed: number;
}

const FIREWORK_PALETTES = [
  { primary: '#fde047', secondary: '#ffffff' }, // Championship Gold & White
  { primary: '#f59e0b', secondary: '#fef08a' }, // Royal Amber & Light Gold
  { primary: '#ef4444', secondary: '#facc15' }, // Angola Crimson & Gold
  { primary: '#10b981', secondary: '#fde047' }, // Victory Emerald & Gold
  { primary: '#38bdf8', secondary: '#ffffff' }, // Diamond Sky & Silver
  { primary: '#fb923c', secondary: '#fef9c3' }, // Solar Flare Orange
];

const MAX_ACTIVE_SPARKS = 320;

/**
 * High-performance transparent background canvas fireworks display
 * rendered exclusively behind the ResultsPodium modal when the player finishes 1st.
 */
export const FirstPlaceFireworksCanvas: React.FC<FirstPlaceFireworksCanvasProps> = ({
  burstKey = 1,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const launchSalvoRef = useRef<(() => void) | null>(null);

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

    const rockets: FireworkRocket[] = [];
    const sparks: FireworkSpark[] = [];
    let rafId = 0;
    let isRunning = true;
    const pendingTimeouts: Array<ReturnType<typeof setTimeout>> = [];

    const spawnRocket = (zone?: 'left' | 'right' | 'top') => {
      if (document.hidden) return;
      const palette = FIREWORK_PALETTES[Math.floor(Math.random() * FIREWORK_PALETTES.length)];
      const patterns: FireworkRocket['pattern'][] = [
        'chrysanthemum',
        'willow',
        'doubleRing',
        'crown',
      ];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];

      // Bias sky targets around the framing sky zones so bursts stay richly visible around the modal
      let startX: number;
      let targetX: number;
      let targetY: number;

      if (zone === 'left') {
        startX = width * (0.08 + Math.random() * 0.22);
        targetX = width * (0.08 + Math.random() * 0.22);
        targetY = height * (0.14 + Math.random() * 0.34);
      } else if (zone === 'right') {
        startX = width * (0.7 + Math.random() * 0.22);
        targetX = width * (0.7 + Math.random() * 0.22);
        targetY = height * (0.14 + Math.random() * 0.34);
      } else if (zone === 'top') {
        startX = width * (0.28 + Math.random() * 0.44);
        targetX = width * (0.25 + Math.random() * 0.5);
        targetY = height * (0.08 + Math.random() * 0.16);
      } else {
        const pick = Math.random();
        if (pick < 0.38) {
          startX = width * (0.07 + Math.random() * 0.23);
          targetX = width * (0.08 + Math.random() * 0.24);
          targetY = height * (0.12 + Math.random() * 0.36);
        } else if (pick < 0.76) {
          startX = width * (0.7 + Math.random() * 0.23);
          targetX = width * (0.68 + Math.random() * 0.24);
          targetY = height * (0.12 + Math.random() * 0.36);
        } else {
          startX = width * (0.25 + Math.random() * 0.5);
          targetX = width * (0.22 + Math.random() * 0.56);
          targetY = height * (0.07 + Math.random() * 0.18);
        }
      }

      const startY = height + 10;
      const travelTimeFrames = 32 + Math.random() * 14;
      const gravityRocket = 0.22;
      const vx = (targetX - startX) / travelTimeFrames;
      const vy = (targetY - startY - 0.5 * gravityRocket * travelTimeFrames * travelTimeFrames) / travelTimeFrames;

      rockets.push({
        x: startX,
        y: startY,
        vx,
        vy,
        targetY,
        hueColor: palette.primary,
        secondaryColor: palette.secondary,
        pattern,
        trail: [],
      });
    };

    const detonateRocket = (r: FireworkRocket) => {
      if (sparks.length > MAX_ACTIVE_SPARKS) {
        sparks.splice(0, sparks.length - MAX_ACTIVE_SPARKS);
      }

      if (r.pattern === 'doubleRing') {
        const outerCount = 28;
        const innerCount = 16;
        for (let i = 0; i < outerCount; i++) {
          const angle = (i / outerCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
          const speed = 5.4 + Math.random() * 1.4;
          sparks.push({
            x: r.x,
            y: r.y,
            px: r.x,
            py: r.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: r.hueColor,
            alpha: 1,
            decay: 0.013 + Math.random() * 0.008,
            gravity: 0.085,
            drag: 0.968,
            size: 2.3,
            twinkle: true,
            twinklePhase: Math.random() * Math.PI * 2,
            twinkleSpeed: 0.28 + Math.random() * 0.2,
          });
        }
        for (let i = 0; i < innerCount; i++) {
          const angle = (i / innerCount) * Math.PI * 2;
          const speed = 2.9 + Math.random() * 0.7;
          sparks.push({
            x: r.x,
            y: r.y,
            px: r.x,
            py: r.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            color: r.secondaryColor,
            alpha: 1,
            decay: 0.016 + Math.random() * 0.008,
            gravity: 0.075,
            drag: 0.965,
            size: 2.0,
            twinkle: false,
            twinklePhase: 0,
            twinkleSpeed: 0,
          });
        }
        return;
      }

      const count = r.pattern === 'willow' ? 34 : r.pattern === 'crown' ? 38 : 32;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.24;
        const baseSpeed =
          r.pattern === 'willow'
            ? 2.2 + Math.random() * 4.4
            : r.pattern === 'crown'
            ? (i % 5 === 0 ? 6.6 : 3.2 + Math.random() * 2.8)
            : 2.0 + Math.random() * 5.2;

        const isSecondary = i % 3 === 0;
        sparks.push({
          x: r.x,
          y: r.y,
          px: r.x,
          py: r.y,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          color: isSecondary ? r.secondaryColor : r.hueColor,
          alpha: 1,
          decay:
            r.pattern === 'willow'
              ? 0.0085 + Math.random() * 0.006
              : 0.012 + Math.random() * 0.01,
          gravity: r.pattern === 'willow' ? 0.115 : 0.08,
          drag: r.pattern === 'willow' ? 0.955 : 0.966,
          size: r.pattern === 'willow' ? 2.5 : 1.8 + Math.random() * 1.4,
          twinkle: r.pattern === 'willow' || i % 2 === 0,
          twinklePhase: Math.random() * Math.PI * 2,
          twinkleSpeed: 0.25 + Math.random() * 0.25,
        });
      }
    };

    const triggerOpeningSalvo = () => {
      spawnRocket('left');
      pendingTimeouts.push(setTimeout(() => isRunning && spawnRocket('right'), 140));
      pendingTimeouts.push(setTimeout(() => isRunning && spawnRocket('top'), 320));
      pendingTimeouts.push(setTimeout(() => isRunning && spawnRocket('left'), 540));
      pendingTimeouts.push(setTimeout(() => isRunning && spawnRocket('right'), 720));
    };

    launchSalvoRef.current = triggerOpeningSalvo;
    triggerOpeningSalvo();

    const intervalId = setInterval(() => {
      if (!isRunning || document.hidden) return;
      spawnRocket();
      if (Math.random() > 0.55) {
        pendingTimeouts.push(setTimeout(() => isRunning && spawnRocket(), 220));
      }
    }, 950);

    const render = () => {
      if (!isRunning) return;

      // Soft alpha fade preserves transparent background so CSS gold aurora shines through
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = 'lighter';

      // Update & draw ascending rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();

        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.22;

        if (r.trail.length > 1) {
          ctx.beginPath();
          ctx.moveTo(r.trail[0].x, r.trail[0].y);
          for (let t = 1; t < r.trail.length; t++) {
            ctx.lineTo(r.trail[t].x, r.trail[t].y);
          }
          ctx.strokeStyle = r.hueColor;
          ctx.lineWidth = 2.2;
          ctx.lineCap = 'round';
          ctx.globalAlpha = 0.85;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.6, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.95;
        ctx.fill();

        if (r.vy >= 0 || r.y <= r.targetY) {
          detonateRocket(r);
          rockets.splice(i, 1);
        }
      }

      // Update & draw firework burst sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.px = s.x;
        s.py = s.y;
        s.vx *= s.drag;
        s.vy *= s.drag;
        s.vy += s.gravity;
        s.x += s.vx;
        s.y += s.vy;
        s.alpha -= s.decay;

        if (s.alpha <= 0.015) {
          sparks.splice(i, 1);
          continue;
        }

        let drawAlpha = s.alpha;
        if (s.twinkle) {
          s.twinklePhase += s.twinkleSpeed;
          drawAlpha *= 0.65 + 0.35 * Math.sin(s.twinklePhase);
        }

        ctx.globalAlpha = Math.max(0, Math.min(1, drawAlpha));
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.px, s.py);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();

        // Bright pinpoint ember head
        if (s.alpha > 0.58) {
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = Math.max(0, drawAlpha * 0.75);
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size * 0.52, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      launchSalvoRef.current = null;
      cancelAnimationFrame(rafId);
      clearInterval(intervalId);
      pendingTimeouts.forEach(clearTimeout);
      window.removeEventListener('resize', resize);
    };
  }, [shouldReduceMotion]);

  useEffect(() => {
    if (burstKey > 1 && launchSalvoRef.current) {
      launchSalvoRef.current();
    }
  }, [burstKey]);

  if (shouldReduceMotion) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none w-full h-full z-0"
    />
  );
};
