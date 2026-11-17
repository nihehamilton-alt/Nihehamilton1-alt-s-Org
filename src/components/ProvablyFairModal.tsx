import React, { useState } from 'react';
import { ShieldCheck, Check, Copy } from 'lucide-react';
import { useI18n } from '../contexts/I18nContext';

interface ProvablyFairModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverSeedHash?: string;
  clientSeed?: string;
  nonce?: number;
}

export const ProvablyFairModal: React.FC<ProvablyFairModalProps> = ({
  isOpen,
  onClose,
  serverSeedHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  clientSeed = 'reizero_luanda_client_seed_7749',
  nonce = 1420,
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="game-panel rounded-3xl border-emerald-500/45 max-w-lg w-full p-5 sm:p-6 shadow-[0_0_65px_rgba(16,185,129,0.22)] flex flex-col gap-4 text-zinc-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl game-subplate border border-emerald-400/40 flex items-center justify-center shadow-[0_0_14px_rgba(16,185,129,0.2)]">
              <ShieldCheck className="text-emerald-400" size={22} />
            </div>
            <div>
              <h2 className="text-base font-black text-emerald-400 uppercase tracking-wide">
                {t.provablyFair.title}
              </h2>
              <span className="text-xs text-zinc-400 font-mono">{t.provablyFair.subtitle}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl game-btn-secondary text-zinc-300 hover:text-white flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-zinc-300 leading-relaxed">{t.provablyFair.body}</p>

        <div className="flex flex-col gap-3 font-mono text-xs">
          <div className="game-subplate p-3 rounded-2xl flex flex-col gap-1">
            <div className="flex items-center justify-between text-zinc-400 text-[10px]">
              <span className="font-bold">{t.provablyFair.serverSeedLabel}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(serverSeedHash, 'server')}
                className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied === 'server' ? <Check size={12} /> : <Copy size={12} />}
                <span>{t.provablyFair.copyBtn}</span>
              </button>
            </div>
            <span className="text-emerald-400 break-all text-[11px] select-all">
              {serverSeedHash}
            </span>
          </div>

          <div className="game-subplate p-3 rounded-2xl flex flex-col gap-1">
            <div className="flex items-center justify-between text-zinc-400 text-[10px]">
              <span className="font-bold">{t.provablyFair.clientSeedLabel}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(clientSeed, 'client')}
                className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {copied === 'client' ? <Check size={12} /> : <Copy size={12} />}
                <span>{t.provablyFair.copyBtn}</span>
              </button>
            </div>
            <span className="text-zinc-200 break-all text-[11px] select-all">
              {clientSeed}
            </span>
          </div>

          <div className="game-subplate p-3 rounded-2xl flex items-center justify-between">
            <span className="text-zinc-400 text-[10px] font-bold">
              {t.provablyFair.nonceLabel}
            </span>
            <span className="text-amber-400 font-bold text-sm">#{nonce}</span>
          </div>
        </div>

        <div className="p-3 bg-emerald-950/45 border border-emerald-500/35 rounded-2xl text-[11px] text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🛡️</span>
            <span>{t.provablyFair.certLabel}</span>
          </div>
          <span className="font-bold text-emerald-400">{t.provablyFair.verifiedBadge}</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-zinc-950 font-black text-xs uppercase tracking-wider cursor-pointer transition-all shadow-[0_0_20px_rgba(16,185,129,0.28)]"
        >
          {t.provablyFair.closeBtn}
        </button>
      </div>
    </div>
  );
};
