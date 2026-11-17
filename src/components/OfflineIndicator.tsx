import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, RefreshCw, CheckCircle, HelpCircle, X } from 'lucide-react';
import {
  useOnlineStatus,
  getPendingSyncCount,
  syncPendingMatchesToServer,
} from '../utils/offlineSync';
import { useI18n } from '../contexts/I18nContext';

export const OfflineIndicator: React.FC = () => {
  const { t } = useI18n();
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingSyncCount());
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const updateCount = () => setPendingCount(getPendingSyncCount());
    window.addEventListener('online', updateCount);
    window.addEventListener('offline', updateCount);
    window.addEventListener('rei-run-sync-updated', updateCount);

    const interval = setInterval(updateCount, 3000);
    return () => {
      window.removeEventListener('online', updateCount);
      window.removeEventListener('offline', updateCount);
      window.removeEventListener('rei-run-sync-updated', updateCount);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      setIsSyncing(true);
      syncPendingMatchesToServer().then((res) => {
        setIsSyncing(false);
        setPendingCount(getPendingSyncCount());
        if (res.syncedCount > 0) {
          setSyncToast(`🔄 ${res.syncedCount} ✓`);
          setTimeout(() => setSyncToast(null), 4000);
        }
      });
    }
  }, [isOnline, pendingCount]);

  const handleManualSync = async () => {
    if (!isOnline) {
      setSyncToast(`⚠️ ${t.offline.offlineShort}`);
      setTimeout(() => setSyncToast(null), 4000);
      return;
    }
    setIsSyncing(true);
    const res = await syncPendingMatchesToServer();
    setIsSyncing(false);
    setPendingCount(getPendingSyncCount());
    setSyncToast(
      res.syncedCount > 0 ? `✅ ${res.syncedCount}` : `✅ ${t.offline.allSynced}`
    );
    setTimeout(() => setSyncToast(null), 3500);
  };

  return (
    <>
      <AnimatePresence>
        {syncToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-emerald-950/95 border-2 border-emerald-500/70 text-emerald-200 text-xs font-mono font-bold shadow-2xl flex items-center gap-2 backdrop-blur-xl"
          >
            <CheckCircle size={16} className="text-emerald-400 shrink-0" />
            <span>{syncToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-3 right-3 z-40 flex items-center gap-1.5 font-mono text-[11px]">
        {!isOnline ? (
          <button
            type="button"
            onClick={() => setShowExplainer(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full game-btn-gold font-bold cursor-pointer"
            title={t.offline.modalTitle}
          >
            <WifiOff size={14} className="shrink-0" />
            <span className="hidden sm:inline">{t.offline.offlineBanner}</span>
            <span className="sm:hidden">{t.offline.offlineShort}</span>
            {pendingCount > 0 && (
              <span className="bg-zinc-950 text-amber-400 px-1.5 py-0.5 rounded-full text-[10px] font-black">
                {pendingCount}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowExplainer(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full game-panel text-zinc-300 hover:text-white transition-all cursor-pointer"
            title={t.offline.modalTitle}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.75)]" />
            <span className="hidden sm:inline text-[10px]">{t.offline.onlineBanner}</span>
            <HelpCircle size={12} className="text-zinc-400" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showExplainer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              className="relative w-full max-w-md game-panel-gold rounded-3xl p-5 sm:p-6 text-zinc-100 flex flex-col gap-4 font-sans"
            >
              <button
                type="button"
                onClick={() => setShowExplainer(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                <span className="text-3xl">📡</span>
                <div>
                  <h3 className="text-base font-black uppercase text-amber-400 font-display">
                    {t.offline.modalTitle}
                  </h3>
                  <span className="text-xs text-zinc-400 font-mono">{t.offline.modalSub}</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl game-subplate flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {isOnline ? (
                    <Wifi size={20} className="text-emerald-400" />
                  ) : (
                    <WifiOff size={20} className="text-amber-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold block">
                      {t.offline.currentStatus}{' '}
                      <strong className={isOnline ? 'text-emerald-400' : 'text-amber-400'}>
                        {isOnline ? t.offline.onlineState : t.offline.offlineState}
                      </strong>
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {pendingCount > 0
                        ? `${pendingCount} ${t.offline.pendingCount}`
                        : t.offline.allSynced}
                    </span>
                  </div>
                </div>

                {isOnline && (
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="p-2 rounded-xl game-btn-secondary text-amber-400 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>

              <div className="flex flex-col gap-2.5 text-xs text-zinc-300">
                <div className="flex items-start gap-2.5 p-2.5 rounded-xl game-subplate">
                  <span className="text-base font-mono font-black text-amber-400">1.</span>
                  <div>
                    <strong className="text-amber-300 block">{t.offline.step1Title}</strong>
                    <span>{t.offline.step1Body}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl game-subplate">
                  <span className="text-base font-mono font-black text-amber-400">2.</span>
                  <div>
                    <strong className="text-amber-300 block">{t.offline.step2Title}</strong>
                    <span>{t.offline.step2Body}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 rounded-xl game-subplate">
                  <span className="text-base font-mono font-black text-amber-400">3.</span>
                  <div>
                    <strong className="text-amber-300 block">{t.offline.step3Title}</strong>
                    <span>{t.offline.step3Body}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowExplainer(false)}
                className="w-full py-3 rounded-2xl game-btn-gold font-black text-xs uppercase tracking-wider cursor-pointer"
              >
                {t.offline.continueBtn}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
