import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, UserCheck, Coins, ShieldAlert, ArrowRight } from 'lucide-react';
import { AVATARS } from '../data/avatars';
import { getLocalizedAvatar } from '../data/translations';
import { useI18n } from '../contexts/I18nContext';
import { RoomConfig } from '../types/game';
import { sounds } from '../audio/soundEffects';
import { AvatarDoll } from './AvatarDoll';

interface InviteOnboardingModalProps {
  roomConfig: RoomConfig;
  isDemo: boolean;
  initialAvatarId: string;
  onComplete: (result: { name: string; avatarId: string }) => void;
}

export const InviteOnboardingModal: React.FC<InviteOnboardingModalProps> = ({
  roomConfig,
  isDemo,
  initialAvatarId,
  onComplete,
}) => {
  const { lang, t, formatMoney } = useI18n();
  const [step, setStep] = useState<'customize' | 'entering'>('customize');
  const [chosenName, setChosenName] = useState<string>('');
  const [chosenAvatarId, setChosenAvatarId] = useState<string>(initialAvatarId || 'rei-zero');
  const [nameError, setNameError] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(3);

  const chosenAvatar = getLocalizedAvatar(chosenAvatarId, lang);

  useEffect(() => {
    if (step !== 'entering') return;
    setCountdown(3);

    const t1 = setTimeout(() => setCountdown(2), 1000);
    const t2 = setTimeout(() => setCountdown(1), 2000);
    const t3 = setTimeout(() => {
      try {
        sounds.playCoin();
      } catch {
        // noop
      }
      onComplete({
        name: chosenName.trim() || chosenAvatar.name,
        avatarId: chosenAvatarId,
      });
    }, 3000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [step, chosenName, chosenAvatarId, chosenAvatar.name, onComplete]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chosenName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    try {
      sounds.playCountdownGo();
    } catch {
      // noop
    }
    setStep('entering');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative game-panel-gold rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-[0_0_75px_rgba(245,158,11,0.38)] flex flex-col gap-4 text-zinc-100 my-auto max-h-[92vh] overflow-y-auto"
      >
        {/* Ambient Glow */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-32 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Invite Header */}
        <div className="relative z-10 flex flex-col gap-2 border-b border-amber-500/20 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 font-mono text-[10px] font-black uppercase">
              <Sparkles size={12} />
              <span>{t.onboarding.inviteBadge}</span>
            </span>
            <span className="px-2.5 py-1 rounded-xl game-subplate font-mono text-xs font-bold text-amber-400">
              {roomConfig.code}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-black text-amber-400 leading-tight">
            {t.onboarding.title}
          </h2>
          <p className="text-xs text-zinc-300 font-mono">{t.onboarding.subtitle}</p>

          <div className="mt-1 p-2.5 rounded-2xl game-subplate flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <span className="text-zinc-300">
              <span className="text-zinc-500">{t.onboarding.hostLabel}</span>{' '}
              <strong className="text-amber-300">{roomConfig.hostName}</strong> · {roomConfig.title}
            </span>
            <span className="text-emerald-400 font-black">
              {t.onboarding.stakeLabel} {formatMoney(roomConfig.betAmount)}
            </span>
          </div>
        </div>

        {/* Account Balance Mode Banner (Test Phase Funded vs Real Phase 0 KZ) */}
        <div
          className={`relative z-10 p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-mono ${
            isDemo
              ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-200'
              : 'bg-amber-950/50 border-amber-500/40 text-amber-200'
          }`}
        >
          {isDemo ? (
            <Coins size={18} className="text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert size={18} className="text-amber-400 shrink-0" />
          )}
          <div className="flex-1">
            <span className="block font-bold leading-snug">
              {isDemo ? t.onboarding.demoBonusBanner : t.onboarding.realZeroBanner}
            </span>
          </div>
          <span
            className={`px-2 py-1 rounded-lg font-black text-xs shrink-0 ${
              isDemo
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'game-subplate text-zinc-300'
            }`}
          >
            {isDemo ? `+${formatMoney(100_000)}` : formatMoney(0)}
          </span>
        </div>

        {step === 'customize' ? (
          <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-4">
            {/* Avatar Name Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
                {t.onboarding.chooseNameLabel}
              </label>
              <input
                type="text"
                autoFocus
                maxLength={22}
                value={chosenName}
                onChange={(e) => {
                  setChosenName(e.target.value);
                  if (nameError && e.target.value.trim()) setNameError(false);
                }}
                placeholder={t.onboarding.namePlaceholder}
                className={`w-full game-subplate border-2 rounded-2xl px-4 py-3 text-sm font-bold text-zinc-100 font-mono focus:outline-none transition-colors ${
                  nameError
                    ? 'border-rose-500 focus:border-rose-400'
                    : 'border-zinc-700 focus:border-amber-400'
                }`}
              />
              {nameError && (
                <span className="text-[11px] font-mono text-rose-400 font-bold">
                  {t.onboarding.nameRequiredHint}
                </span>
              )}
            </div>

            {/* Avatar Selector Grid */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
                {t.onboarding.chooseAvatarLabel}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {AVATARS.map((item) => {
                  const loc = getLocalizedAvatar(item.id, lang);
                  const isSelected = chosenAvatarId === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setChosenAvatarId(item.id);
                        try {
                          sounds.playCountdownTick();
                        } catch {
                          // noop
                        }
                      }}
                      className={`p-2.5 rounded-2xl border-2 flex flex-col items-center text-center gap-1 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-b from-amber-500/25 to-amber-950/35 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.3)] scale-[1.02]'
                          : 'game-subplate hover:border-amber-500/40'
                      }`}
                    >
                      <AvatarDoll
                        avatarId={item.id}
                        name={loc.name}
                        color={item.color}
                        size={40}
                        variant="full"
                        className="filter drop-shadow"
                      />
                      <span className="text-[11px] font-black text-zinc-100 truncate w-full">
                        {loc.name}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400 truncate w-full">
                        {loc.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl game-btn-gold text-zinc-950 font-black text-sm sm:text-base uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <UserCheck size={18} />
              <span>{t.onboarding.confirmEnterBtn}</span>
              <ArrowRight size={18} />
            </button>
          </form>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative z-10 py-6 px-4 rounded-2xl game-subplate border border-amber-500/45 flex flex-col items-center text-center gap-3"
          >
            <motion.div
              animate={{ scale: [1, 1.12, 1], y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, type: 'tween', ease: 'easeInOut' }}
              className="filter drop-shadow-[0_0_20px_rgba(245,158,11,0.75)]"
            >
              <AvatarDoll
                avatarId={chosenAvatarId}
                name={chosenName.trim() || chosenAvatar.name}
                color={chosenAvatar.color}
                size={68}
                variant="full"
              />
            </motion.div>

            <div className="flex flex-col items-center">
              <span className="text-lg font-black text-amber-300 font-mono">
                {chosenName.trim() || chosenAvatar.name}
              </span>
              <span className="text-xs text-zinc-400 font-mono">{chosenAvatar.title}</span>
            </div>

            <h3 className="text-base font-black uppercase text-zinc-100 mt-1">
              {t.onboarding.enteringTitle}
            </h3>
            <p className="text-xs text-zinc-400 font-mono max-w-sm">
              {t.onboarding.enteringSub} <strong className="text-amber-300">{roomConfig.hostName}</strong>
            </p>

            <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-400 flex items-center justify-center font-mono font-black text-2xl text-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              {countdown}
              {t.onboarding.secondsSuffix}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
