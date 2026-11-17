import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { sounds } from '../audio/soundEffects';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  shape: 'ribbon' | 'circle' | 'square' | 'star';
  alpha: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
  wobble: number;
  wobbleSpeed: number;
  gravity: number;
  drag: number;
}

interface CelebrationExplosionProps {
  onComplete?: () => void;
  playAudio?: boolean;
}

export const CelebrationExplosion: React.FC<CelebrationExplosionProps> = ({
  onComplete,
  playAudio = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Paleta oficial de celebração de Luanda e Cassino Real do Rei Zero
  const colors = useMemo(
    () => [
      '#facc15', // Dourado Real
      '#eab308', // Ouro Forte
      '#dc2626', // Vermelho Angola
      '#16a34a', // Verde Triunfo
      '#38bdf8', // Diamante Azul
      '#f43f5e', // Rosa Vivo
      '#ffffff', // Prata Puro
    ],
    []
  );

  useEffect(() => {
    // 1. Toca o som comemorativo imediatamente ao disparar a explosão
    if (playAudio) {
      try {
        sounds.playVictoryExplosion();
      } catch (err) {
        console.error('Erro ao tocar som de vitória:', err);
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    const resizeCanvas = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 2. Sistema de Partículas Leve em Canvas (Alta Performance a 60fps)
    const particles: Particle[] = [];
    const particleCount = 120; // Equilíbrio ideal entre densidade e fluidez 60 FPS mobile/desktop

    // Três pontos de detonação explosiva (Epicentro Central + Canhão Esquerdo + Canhão Direito)
    const origins = [
      { x: width * 0.5, y: height * 0.45, count: Math.floor(particleCount * 0.5), spread: Math.PI * 2, minSpeed: 6, maxSpeed: 18 },
      { x: width * 0.1, y: height * 0.85, count: Math.floor(particleCount * 0.25), spread: Math.PI * 0.5, baseAngle: -Math.PI / 4, minSpeed: 10, maxSpeed: 22 },
      { x: width * 0.9, y: height * 0.85, count: Math.floor(particleCount * 0.25), spread: Math.PI * 0.5, baseAngle: (-3 * Math.PI) / 4, minSpeed: 10, maxSpeed: 22 },
    ];

    origins.forEach((origin) => {
      for (let i = 0; i < origin.count; i++) {
        let angle: number;
        if (origin.baseAngle !== undefined) {
          angle = origin.baseAngle + (Math.random() - 0.5) * origin.spread;
        } else {
          angle = Math.random() * origin.spread;
        }

        const speed = origin.minSpeed + Math.random() * (origin.maxSpeed - origin.minSpeed);
        const shapes: Particle['shape'][] = ['ribbon', 'circle', 'square', 'star'];
        const shape = shapes[Math.floor(Math.random() * shapes.length)];

        particles.push({
          x: origin.x,
          y: origin.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: shape === 'ribbon' ? 7 + Math.random() * 8 : 4 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape,
          alpha: 1,
          decay: 0.007 + Math.random() * 0.009, // Duração de ~3.5 a 4.5 segundos
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.06 + Math.random() * 0.08,
          gravity: 0.18 + Math.random() * 0.12,
          drag: 0.978,
        });
      }
    });

    let isRunning = true;

    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      let activeParticles = 0;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        if (p.alpha <= 0.01) continue;

        activeParticles++;

        // Física
        p.vx *= p.drag;
        p.vy *= p.drag;
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;

        p.rotation += p.rotationSpeed;
        p.wobble += p.wobbleSpeed;
        p.alpha -= p.decay;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        // Efeito 3D de fita ondulante
        const scaleX = Math.cos(p.wobble);
        ctx.scale(scaleX, 1);

        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'ribbon') {
          ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
        } else if (p.shape === 'square') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else if (p.shape === 'star') {
          // Estrela brilhante
          ctx.beginPath();
          for (let s = 0; s < 5; s++) {
            ctx.lineTo(
              Math.cos(((18 + s * 72) * Math.PI) / 180) * p.size,
              -Math.sin(((18 + s * 72) * Math.PI) / 180) * p.size
            );
            ctx.lineTo(
              Math.cos(((54 + s * 72) * Math.PI) / 180) * (p.size / 2),
              -Math.sin(((54 + s * 72) * Math.PI) / 180) * (p.size / 2)
            );
          }
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      if (activeParticles > 0) {
        animationFrameId = requestAnimationFrame(render);
      } else {
        isRunning = false;
        if (onComplete) onComplete();
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [colors, onComplete, playAudio]);

  // 3. Explosão de Elementos Triunfais com Framer Motion (Coroas, Moedas, Estrelas Radiais)
  const burstIcons = useMemo(() => {
    const icons = ['👑', '🪙', '✨', '💎', '🏆', '🎉', '⭐', '🥇'];
    const total = 12;
    return Array.from({ length: total }).map((_, i) => {
      const angle = (i / total) * Math.PI * 2;
      const distance = 160 + (i % 3) * 60;
      return {
        id: i,
        icon: icons[i % icons.length],
        targetX: Math.cos(angle) * distance,
        targetY: Math.sin(angle) * distance,
        rotate: Math.random() * 720 - 360,
        scale: 1 + Math.random() * 0.4,
        delay: (i % 4) * 0.04,
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden flex items-center justify-center">
      {/* Canvas Particle System Leve e Ultra Rápido */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none w-full h-full z-40"
      />

      {/* Onda de Choque Dourada com Framer Motion */}
      <motion.div
        initial={{ scale: 0.1, opacity: 0.95 }}
        animate={{ scale: [0.1, 2.4, 3.2], opacity: [0.95, 0.4, 0] }}
        transition={{ duration: 1.4, type: 'tween', ease: 'easeOut' }}
        className="absolute w-72 h-72 rounded-full border-4 border-amber-400 shadow-[0_0_80px_rgba(250,204,21,0.8)] z-40"
      />

      {/* Segunda onda de choque cintilante */}
      <motion.div
        initial={{ scale: 0.1, opacity: 0.8 }}
        animate={{ scale: [0.1, 1.8, 2.6], opacity: [0.8, 0.25, 0] }}
        transition={{ duration: 1.1, delay: 0.15, type: 'tween', ease: 'easeOut' }}
        className="absolute w-60 h-60 rounded-full border-2 border-emerald-400 shadow-[0_0_60px_rgba(16,185,129,0.7)] z-40"
      />

      {/* Dispersão Radial Explosiva de Ícones Reais com Framer Motion */}
      <div className="relative w-0 h-0 z-50">
        {burstIcons.map((item) => (
          <motion.div
            key={item.id}
            initial={{ x: 0, y: 0, scale: 0, opacity: 0, rotate: 0 }}
            animate={{
              x: [0, item.targetX * 0.6, item.targetX],
              y: [0, item.targetY * 0.6, item.targetY + 40],
              scale: [0, 1.5, item.scale, 0],
              opacity: [0, 1, 1, 0],
              rotate: [0, item.rotate],
            }}
            transition={{
              duration: 2.2,
              delay: item.delay,
              type: 'tween',
              ease: [0.22, 1, 0.36, 1],
            }}
            className="absolute text-2xl sm:text-3xl select-none pointer-events-none -translate-x-1/2 -translate-y-1/2"
          >
            {item.icon}
          </motion.div>
        ))}
      </div>
    </div>
  );
};
