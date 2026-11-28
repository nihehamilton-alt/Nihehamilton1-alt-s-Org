import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowLeftRight, ArrowUp, Timer, X, Zap } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';
import { TOTAL_GAME_TIME_SECONDS } from '../game/constants';

interface HowToPlayTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayTutorialModal: React.FC<HowToPlayTutorialModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { lang } = useI18n();
  const shouldReduceMotion = useReducedMotion();
  const langCode = (lang || 'pt').slice(0, 2);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const copy = useMemo(() => {
    if (langCode === 'en') {
      return {
        badge: 'FIRST VISIT · QUICK GUIDE',
        title: 'How to Play',
        subtitle: 'Master the 5 lanes of Marginal de Luanda in seconds',
        controlsHeading: 'Basic Controls',
        controls: [
          {
            key: 'lane',
            title: 'Switch Lanes',
            keys: '← / → · A / D · Swipe',
            desc: 'Dodge stopped candongueiros & barriers.',
          },
          {
            key: 'jump',
            title: 'Jump',
            keys: '↑ / W · Swipe Up',
            desc: 'Leap over potholes, drums & basins.',
          },
          {
            key: 'slide',
            title: 'Slide / Duck',
            keys: '↓ / S · Swipe Down',
            desc: 'Duck cleanly under fallen power lines.',
          },
          {
            key: 'dash',
            title: 'Royal Dash',
            keys: 'Space · Double Tap',
            desc: 'Turbo burst to smash obstacles (4s cooldown).',
          },
        ],
        ruleTitle: 'The 60-Second Rule (Timed Sprint)',
        ruleBadge: `Current match: ${TOTAL_GAME_TIME_SECONDS}s`,
        ruleBody:
          'Every race runs against the clock under the classic 60-second sprint rule (currently tuned to 40s for fast action): stumbling only slows you down briefly with zero instant death. Cover the greatest distance before time expires to claim the Royal Throne!',
        cta: 'Got it, let’s race!',
      };
    }

    if (langCode === 'es') {
      return {
        badge: 'PRIMERA VISITA · GUÍA RÁPIDA',
        title: 'Cómo Jugar',
        subtitle: 'Domina los 5 carriles de la Marginal en segundos',
        controlsHeading: 'Controles Básicos',
        controls: [
          {
            key: 'lane',
            title: 'Cambiar de Carril',
            keys: '← / → · A / D · Deslizar',
            desc: 'Esquiva candongueiros y barreras.',
          },
          {
            key: 'jump',
            title: 'Saltar',
            keys: '↑ / W · Deslizar Arriba',
            desc: 'Salta baches, tambores y cubetas.',
          },
          {
            key: 'slide',
            title: 'Deslizarse',
            keys: '↓ / S · Deslizar Abajo',
            desc: 'Agáchate bajo cables eléctricos caídos.',
          },
          {
            key: 'dash',
            title: 'Dash Real',
            keys: 'Espacio · Doble Toque',
            desc: 'Impulso turbo destructor (recarga 4s).',
          },
        ],
        ruleTitle: 'La Regla de los 60 Segundos',
        ruleBadge: `Partida actual: ${TOTAL_GAME_TIME_SECONDS}s`,
        ruleBody:
          'Cada carrera se decide por cronómetro bajo la regla clásica de hasta 60 segundos (actualmente ajustada a 40s de acción intensa): tropezar solo frena tu ritmo sin eliminación súbita. ¡Recorre la mayor distancia antes de que acabe el tiempo!',
        cta: '¡Entendido, a correr!',
      };
    }

    if (langCode === 'fr') {
      return {
        badge: 'PREMIÈRE VISITE · GUIDE RAPIDE',
        title: 'Comment Jouer',
        subtitle: 'Maîtrisez les 5 voies de la Marginal en quelques secondes',
        controlsHeading: 'Contrôles de Base',
        controls: [
          {
            key: 'lane',
            title: 'Changer de Voie',
            keys: '← / → · A / D · Glisser',
            desc: 'Évitez les véhicules et barrières.',
          },
          {
            key: 'jump',
            title: 'Sauter',
            keys: '↑ / W · Glisser Haut',
            desc: 'Franchissez trous, fûts et bassines.',
          },
          {
            key: 'slide',
            title: 'Glisser / Baisser',
            keys: '↓ / S · Glisser Bas',
            desc: 'Passez sous les câbles électriques.',
          },
          {
            key: 'dash',
            title: 'Dash Royal',
            keys: 'Espace · Double Tap',
            desc: 'Accélération turbo (recharge 4s).',
          },
        ],
        ruleTitle: 'La Règle des 60 Secondes',
        ruleBadge: `Course actuelle : ${TOTAL_GAME_TIME_SECONDS}s`,
        ruleBody:
          'Chaque manche se joue contre la montre selon la règle classique des 60 secondes maximum (actuellement calibrée à 40s pour un rythme intense) : aucun K.O. instantané, celui qui parcourt la plus grande distance l’emporte !',
        cta: 'Compris, c’est parti !',
      };
    }

    return {
      badge: 'PRIMEIRA VISITA · GUIA RÁPIDO',
      title: 'Como Jogar',
      subtitle: 'Domina as 5 faixas da Marginal de Luanda em segundos',
      controlsHeading: 'Controles Básicos',
      controls: [
        {
          key: 'lane',
          title: 'Trocar de Faixa',
          keys: '← / → · A / D · Arrastar',
          desc: 'Desvia de candongueiros e barreiras.',
        },
        {
          key: 'jump',
          title: 'Saltar (Jump)',
          keys: '↑ / W · Arrastar Cima',
          desc: 'Salta buracos, bacias e tambores.',
        },
        {
          key: 'slide',
          title: 'Deslizar (Slide)',
          keys: '↓ / S · Arrastar Baixo',
          desc: 'Agacha-te sob fios elétricos caídos.',
        },
        {
          key: 'dash',
          title: 'Dash Real',
          keys: 'Espaço · Toque Duplo',
          desc: 'Impulso turbo que destrói obstáculos (4s).',
        },
      ],
      ruleTitle: 'A Regra dos 60 Segundos',
      ruleBadge: `Corrida atual: ${TOTAL_GAME_TIME_SECONDS}s`,
      ruleBody:
        'A partida é uma disputa direta contra o cronómetro dentro da regra clássica de até 60 segundos (atualmente calibrada para 40s de ritmo intenso): bater num obstáculo apenas abranda o passo — nunca elimina! Vence quem percorrer a maior distância até o tempo zerar.',
      cta: 'Entendido, vamos jogar!',
    };
  }, [langCode]);

  const renderControlIcon = (key: string) => {
    switch (key) {
      case 'lane':
        return <ArrowLeftRight className="w-4 h-4 text-sky-300 shrink-0" />;
      case 'jump':
        return <ArrowUp className="w-4 h-4 text-emerald-300 shrink-0" />;
      case 'slide':
        return <ArrowDown className="w-4 h-4 text-amber-300 shrink-0" />;
      default:
        return <Zap className="w-4 h-4 text-yellow-300 shrink-0" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="how-to-play-tutorial-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.05 : 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-to-play-tutorial-title"
          data-testid="how-to-play-tutorial-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
        >
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 18 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className="relative w-full max-w-md game-panel-gold rounded-3xl p-5 shadow-[0_0_65px_rgba(245,158,11,0.34)] flex flex-col gap-3.5 text-zinc-200 max-h-[90vh] overflow-y-auto"
          >
            {/* Cabeçalho */}
            <div className="flex items-start justify-between gap-3 border-b border-amber-500/20 pb-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl game-subplate border border-amber-400/50 flex items-center justify-center shadow-[0_0_16px_rgba(245,158,11,0.25)] shrink-0">
                  <span className="text-2xl">👑</span>
                </div>
                <div className="min-w-0">
                  <span className="inline-block text-[9px] font-mono font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/45 text-amber-300 mb-1">
                    {copy.badge}
                  </span>
                  <h2
                    id="how-to-play-tutorial-title"
                    className="text-lg font-black text-amber-400 uppercase tracking-wide leading-tight"
                  >
                    {copy.title}
                  </h2>
                  <p className="text-[11px] text-zinc-400 leading-snug mt-0.5">{copy.subtitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar tutorial"
                className="w-8 h-8 rounded-xl game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Controles Básicos */}
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-black text-zinc-400 px-0.5">
                {copy.controlsHeading}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {copy.controls.map((ctrl) => (
                  <div
                    key={ctrl.key}
                    className="game-subplate rounded-2xl p-2.5 border border-white/10 flex items-start gap-2.5"
                  >
                    <div className="w-8 h-8 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                      {renderControlIcon(ctrl.key)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-zinc-100 leading-tight">
                        {ctrl.title}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-amber-300 mt-0.5">
                        {ctrl.keys}
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-snug mt-0.5">{ctrl.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regra dos 60 Segundos */}
            <div className="rounded-2xl p-3.5 bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-emerald-500/10 border border-amber-400/45 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-amber-300">
                  <Timer className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{copy.ruleTitle}</span>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-950/80 border border-emerald-500/45 text-emerald-300">
                  {copy.ruleBadge}
                </span>
              </div>
              <p className="text-xs text-zinc-200 leading-relaxed">{copy.ruleBody}</p>
            </div>

            {/* Botão Principal */}
            <button
              type="button"
              data-testid="how-to-play-tutorial-close"
              onClick={onClose}
              className="w-full py-3 rounded-2xl game-btn-gold text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer active:scale-[0.99] transition-transform"
            >
              {copy.cta}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
