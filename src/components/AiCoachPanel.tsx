import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Send, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { RacePerformanceMetrics } from '../types/game';
import { useI18n } from '../contexts/I18nContext';

interface AiCoachPanelProps {
  playerName: string;
  avatarName: string;
  performance?: RacePerformanceMetrics | null;
  userRank?: number;
  mode?: 'post-race' | 'tactical';
  onInteract?: () => void;
}

interface CoachCopy {
  title: string;
  subtitle: string;
  analyzeBtn: string;
  askBtn: string;
  loading: string;
  placeholder: string;
  quickPrompts: string[];
  emptyHint: string;
  modelBadge: string;
}

function getCoachCopy(lang: string): CoachCopy {
  if (lang === 'en') {
    return {
      title: 'King AI Tactical Coach',
      subtitle: 'Real-time Gemini insights for your Luanda run',
      analyzeBtn: 'Analyze Run with AI',
      askBtn: 'Ask AI',
      loading: 'Analyzing telemetry & track rhythm...',
      placeholder: 'Ask about jumps, Dash timing, or barriers...',
      quickPrompts: [
        'How to cut reaction time under 380ms?',
        'Best timing for the 4s Dash?',
        'When to jump vs switch lanes?',
      ],
      emptyHint: 'Tap Analyze or ask any tactical question about the 40s track.',
      modelBadge: 'Gemini AI',
    };
  }
  if (lang.startsWith('es')) {
    return {
      title: 'Coach IA del Rey',
      subtitle: 'Estrategia en vivo con Gemini para las 5 pistas',
      analyzeBtn: 'Analizar Carrera con IA',
      askBtn: 'Consultar IA',
      loading: 'Analizando tus reflejos y ritmo...',
      placeholder: 'Pregunta sobre saltos, Dash o barreras...',
      quickPrompts: [
        '¿Cómo bajar mi reacción de 380ms?',
        '¿Mejor momento para usar el Dash?',
        '¿Cuándo saltar o cambiar de carril?',
      ],
      emptyHint: 'Pulsa Analizar o haz una pregunta táctica sobre la carrera de 40s.',
      modelBadge: 'Gemini AI',
    };
  }
  if (lang === 'fr') {
    return {
      title: 'Coach IA du Roi',
      subtitle: 'Analyse tactique Gemini pour les 5 voies',
      analyzeBtn: 'Analyser avec l’IA',
      askBtn: 'Demander',
      loading: 'Analyse des réflexes en cours...',
      placeholder: 'Question sur sauts, Dash ou barrières...',
      quickPrompts: [
        'Passer sous 380ms de réaction ?',
        'Quand activer le Dash (4s) ?',
        'Sauter ou changer de voie ?',
      ],
      emptyHint: 'Cliquez sur Analyser ou posez une question tactique.',
      modelBadge: 'Gemini AI',
    };
  }
  return {
    title: 'Coach IA do Rei',
    subtitle: 'Inteligência tática com Gemini para as 5 faixas',
    analyzeBtn: 'Analisar Corrida com IA',
    askBtn: 'Perguntar',
    loading: 'A analisar reflexos e leitura da pista...',
    placeholder: 'Pergunta sobre saltos, Dash ou barreiras...',
    quickPrompts: [
      'Como reagir abaixo de 380 ms?',
      'Quando usar o Dash de 4s?',
      'Quando saltar ou mudar de faixa?',
    ],
    emptyHint: 'Pede uma análise tática da tua corrida ou faz uma pergunta ao Coach IA.',
    modelBadge: 'Gemini AI',
  };
}

export const AiCoachPanel: React.FC<AiCoachPanelProps> = ({
  playerName,
  avatarName,
  performance = null,
  userRank = 1,
  mode = 'tactical',
  onInteract,
}) => {
  const { lang } = useI18n();
  const prefersReducedMotion = useReducedMotion();
  const copy = getCoachCopy(lang);

  const [question, setQuestion] = useState<string>('');
  const [advice, setAdvice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const requestCoach = async (customQuestion?: string) => {
    onInteract?.();
    if (loading) return;

    const queryText = (customQuestion ?? question).trim();
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lang,
          playerName,
          avatarName,
          performance,
          userRank,
          mode,
          question: queryText || undefined,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        advice?: string;
        error?: string;
      };

      if (!res.ok || !data.ok || !data.advice) {
        setErrorMsg(data.error || 'Não foi possível obter resposta da IA agora.');
        return;
      }

      setAdvice(data.advice);
      if (customQuestion) {
        setQuestion('');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Falha de ligação ao servidor do Coach IA.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.section
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl game-panel border-sky-500/35 p-3.5 flex flex-col gap-2.5"
      aria-label={copy.title}
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-xl bg-sky-500/15 border border-sky-400/40 flex items-center justify-center shrink-0">
            <Bot size={15} className="text-sky-300" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-zinc-100 truncate">
              {copy.title}
            </h3>
            <p className="text-[10px] font-mono text-zinc-400 truncate">{copy.subtitle}</p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-md bg-sky-500/15 border border-sky-400/35 text-[10px] font-mono font-bold text-sky-300 shrink-0 flex items-center gap-1">
          <Sparkles size={11} />
          {copy.modelBadge}
        </span>
      </div>

      {/* Botões rápidos táticos */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={loading}
          onClick={() => requestCoach()}
          className="px-2.5 py-1.5 rounded-lg game-btn-gold disabled:opacity-60 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 cursor-pointer"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          <span>{copy.analyzeBtn}</span>
        </button>

        {copy.quickPrompts.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={loading}
            onClick={() => requestCoach(preset)}
            className="px-2.5 py-1.5 rounded-lg game-btn-secondary disabled:opacity-60 text-zinc-200 text-[10px] font-mono font-bold cursor-pointer"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Campo de pergunta direta */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void requestCoach(question);
        }}
        className="flex items-center gap-1.5"
      >
        <input
          type="text"
          value={question}
          onFocus={() => onInteract?.()}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={copy.placeholder}
          maxLength={240}
          className="flex-1 min-w-0 rounded-xl game-subplate px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-sky-400 outline-none"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-zinc-950 font-black text-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          <span>{copy.askBtn}</span>
        </button>
      </form>

      {/* Estado de carregamento, erro real ou conselho */}
      {loading && (
        <div className="rounded-xl game-subplate border-sky-500/35 px-3 py-2 flex items-center gap-2 text-xs font-mono text-sky-300">
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>{copy.loading}</span>
        </div>
      )}

      {errorMsg && !loading && (
        <div className="rounded-xl bg-rose-950/70 border border-rose-500/50 px-3 py-2 flex items-start gap-2 text-[11px] text-rose-200">
          <AlertCircle size={14} className="text-rose-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {advice && !loading && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl game-subplate border-sky-500/35 px-3 py-2.5 text-xs leading-relaxed text-zinc-200 whitespace-pre-line"
        >
          {advice}
        </motion.div>
      )}

      {!advice && !errorMsg && !loading && (
        <p className="text-[11px] font-mono text-zinc-400 px-0.5">{copy.emptyHint}</p>
      )}
    </motion.section>
  );
};
