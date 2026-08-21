import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle2, ChevronRight, Zap } from 'lucide-react';

interface EscalationRiskCardProps {
  escalationRiskOutput?: {
    escalation_score: number;
    risk_level: 'Low' | 'Medium' | 'High' | 'Critical';
    confidence_score: number;
    reasoning: string;
    recommended_actions: string[];
    detected_triggers: string[];
  };
  frustrationScore?: number;
  frustrationLevel?: string;
  onApplyAction?: (actionText: string) => void;
}

export const EscalationRiskCard: React.FC<EscalationRiskCardProps> = ({
  escalationRiskOutput,
  frustrationScore = 0,
  frustrationLevel = 'Low',
  onApplyAction
}) => {
  if (!escalationRiskOutput) {
    const score = frustrationScore || (frustrationLevel === 'High' ? 85 : frustrationLevel === 'Medium' ? 50 : 15);
    const level = score > 80 ? 'Critical' : score > 60 ? 'High' : score > 35 ? 'Medium' : 'Low';

    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <h4 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            Escalation Risk Monitor
          </h4>
          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border uppercase ${
            level === 'Critical' ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 animate-pulse' :
            level === 'High' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
            level === 'Medium' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' :
            'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
          }`}>
            {level} Risk
          </span>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
          <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-200 dark:text-slate-700"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={`${score > 80 ? 'text-rose-600 dark:text-rose-400' : score > 60 ? 'text-amber-500 dark:text-amber-400' : 'text-emerald-500 dark:text-emerald-400'}`}
                strokeDasharray={`${score}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-xs font-black font-mono text-slate-800 dark:text-slate-100">{score}</span>
          </div>

          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Escalation Threat Meter</span>
              <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">Score {score}/100</span>
            </div>
            <p className="text-xs text-slate-700 dark:text-slate-300 leading-tight">
              {level === 'Critical' || level === 'High' ? (
                <strong className="text-rose-700 dark:text-rose-400">Immediate supervisor intervention recommended.</strong>
              ) : (
                'Customer sentiment remains stable under support guidance.'
              )}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { escalation_score, risk_level, confidence_score, reasoning, recommended_actions, detected_triggers } = escalationRiskOutput;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'Critical': return { bg: 'bg-rose-600', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-800', badge: 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700' };
      case 'High': return { bg: 'bg-rose-500', text: 'text-rose-500 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800', badge: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' };
      case 'Medium': return { bg: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' };
      default: return { bg: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' };
    }
  };

  const colors = getRiskColor(risk_level);

  return (
    <div className={`bg-white dark:bg-slate-900 border rounded-2xl shadow-xs p-4 flex flex-col gap-3 ${colors.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
        <h4 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase flex items-center gap-2">
          <ShieldAlert className={`h-4 w-4 ${colors.text}`} />
          Escalation Risk Monitor Agent
        </h4>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            Conf: {Math.round(confidence_score * 100)}%
          </span>
          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase ${colors.badge} ${risk_level === 'Critical' ? 'animate-bounce' : ''}`}>
            {risk_level} Risk
          </span>
        </div>
      </div>

      {/* Gauge and Score Bar */}
      <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
        <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-slate-200 dark:text-slate-700"
              strokeWidth="3.5"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={colors.text}
              strokeDasharray={`${escalation_score}, 100`}
              strokeWidth="3.5"
              strokeLinecap="round"
              stroke="currentColor"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute text-xs font-black font-mono text-slate-800 dark:text-slate-100">{escalation_score}</span>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Risk Score Gauge</span>
            <span className="text-[9px] font-mono font-bold text-slate-700 dark:text-slate-300">{escalation_score}/100</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${colors.bg} transition-all duration-500`}
              style={{ width: `${escalation_score}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-snug mt-1 font-medium">
            {reasoning}
          </p>
        </div>
      </div>

      {/* Detected Triggers */}
      {detected_triggers && detected_triggers.length > 0 && (
        <div className="space-y-1">
          <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500" />
            Detected Risk Triggers:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {detected_triggers.map((trigger, i) => (
              <span key={i} className="text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md">
                ⚠️ {trigger}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommended De-escalation Actions */}
      {recommended_actions && recommended_actions.length > 0 && (
        <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-xl p-3 space-y-1.5">
          <span className="text-[10px] font-extrabold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            Actionable De-escalation Protocol:
          </span>
          <ul className="space-y-1">
            {recommended_actions.map((act, i) => (
              <li key={i} className="text-[11px] text-amber-950 dark:text-amber-200 font-medium flex items-start justify-between gap-2">
                <span className="flex items-start gap-1.5">
                  <ChevronRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>{act}</span>
                </span>
                {onApplyAction && (
                  <button
                    type="button"
                    onClick={() => onApplyAction(act)}
                    className="text-[9px] font-bold bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-0.5 rounded hover:bg-amber-100 dark:hover:bg-slate-700 transition whitespace-nowrap cursor-pointer flex-shrink-0"
                  >
                    Use Action
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
