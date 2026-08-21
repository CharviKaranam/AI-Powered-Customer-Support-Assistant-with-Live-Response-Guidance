import React, { useState } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Award, 
  TrendingDown, 
  TrendingUp, 
  Sparkles, 
  FileText, 
  Lightbulb, 
  ArrowRight,
  ShieldAlert,
  BarChart2,
  Download,
  Check,
  FileSpreadsheet
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid,
  ReferenceLine 
} from 'recharts';
import { PostInteractionReport } from '../types.js';
import { exportReportToPDF } from '../utils/pdfExport.js';

interface PostInteractionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: PostInteractionReport | null;
  onOpenAnalytics?: () => void;
  onStartNewSession?: () => void;
}

export const PostInteractionReportModal: React.FC<PostInteractionReportModalProps> = ({
  isOpen,
  onClose,
  report,
  onOpenAnalytics,
  onStartNewSession
}) => {
  const [downloadedFormat, setDownloadedFormat] = useState<'pdf' | 'md' | 'json' | null>(null);

  if (!isOpen || !report) return null;

  const { interactionSummary, sentimentJourney, resolutionQuality, coachingRecommendations } = report;

  const handleDownloadReport = (format: 'pdf' | 'md' | 'json' = 'pdf') => {
    if (format === 'pdf') {
      exportReportToPDF(report);
    } else if (format === 'json') {
      const dataStr = JSON.stringify(report, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ResolveAI_QA_Report_Session_${report.sessionId}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const markdown = `# Post-Interaction Performance & QA Evaluation Report
**Session ID:** ${report.sessionId}
**Generated:** ${new Date(report.generatedAt).toLocaleString()}
**Resolution Status:** ${interactionSummary.resolutionStatus} ${interactionSummary.escalated ? '(⚠️ Case Escalated)' : '(✅ Resolved)'}

---

## 1. Resolution Quality Evaluation
- **Overall Score:** ${resolutionQuality.score} / 100
- **Assessment Rationale:** ${resolutionQuality.reasoning}

---

## 2. Interaction Context & Outcome
- **Customer Issue:** ${interactionSummary.customerIssue}
- **Customer Objective:** ${interactionSummary.customerObjective}
- **Final Outcome:** ${interactionSummary.finalOutcome || interactionSummary.resolutionStatus}
${interactionSummary.keyEvents?.length ? `\n### Key Events:\n${interactionSummary.keyEvents.map(e => `- ${e}`).join('\n')}` : ''}
${interactionSummary.actionsTaken?.length ? `\n### Actions Taken:\n${interactionSummary.actionsTaken.map(a => `- ${a}`).join('\n')}` : ''}

---

## 3. Customer Sentiment & Frustration Journey
${sentimentJourney.map(pt => `- Turn ${pt.turn} [${pt.sender === 'customer' ? 'Customer' : 'Agent'}]: Frustration=${pt.frustrationScore}/100 | Emotion=${pt.emotion} | Sentiment=${pt.sentiment}\n  > "${pt.messageExcerpt}"`).join('\n')}

---

## 4. Key Strengths & Coaching Highlights
${(coachingRecommendations.strengths || []).map(s => `- ✅ ${s}`).join('\n')}

---

## 5. Areas for Skill Improvement
${(coachingRecommendations.areasForImprovement || []).map(a => `- ⚠️ ${a}`).join('\n')}

---

## 6. Actionable Next Steps
${(coachingRecommendations.recommendedActions || []).map(r => `- 💡 ${r}`).join('\n')}
`;

      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ResolveAI_QA_Report_Session_${report.sessionId}.md`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }

    setDownloadedFormat(format);
    setTimeout(() => setDownloadedFormat(null), 3000);
  };

  // Chart data preparation
  const chartData = sentimentJourney.map(pt => ({
    turn: `Turn ${pt.turn}`,
    frustration: pt.frustrationScore,
    emotion: pt.emotion,
    sentiment: pt.sentiment,
    sender: pt.sender === 'customer' ? 'Customer' : 'Agent',
    excerpt: pt.messageExcerpt
  }));

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (score >= 60) return 'text-amber-600 bg-amber-50 border-amber-200';
    return 'text-rose-600 bg-rose-50 border-rose-200';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl my-8 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-5 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">Post-Interaction Performance Report</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  interactionSummary.resolutionStatus === 'Resolved' 
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : interactionSummary.escalated 
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {interactionSummary.resolutionStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Session #{report.sessionId} • Generated {new Date(report.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {/* Download Report Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
              <button
                id="btn_download_pdf_report"
                onClick={() => handleDownloadReport('pdf')}
                title="Download formatted official PDF QA Evaluation Report"
                className="px-3 py-1.5 text-xs font-extrabold bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-lg transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                {downloadedFormat === 'pdf' ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadedFormat === 'pdf' ? 'PDF Exported!' : 'Download PDF'}</span>
              </button>
              <button
                onClick={() => handleDownloadReport('md')}
                title="Download Markdown Report"
                className="px-2 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>.MD</span>
              </button>
              <button
                onClick={() => handleDownloadReport('json')}
                title="Download raw JSON Report"
                className="px-2 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>.JSON</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/40">
          
          {/* Top Score & Outcome Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Resolution Quality Score Dial Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  <span>Resolution Quality Score</span>
                  <Award className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex items-baseline gap-2 my-2">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">{resolutionQuality.score}</span>
                  <span className="text-slate-400 dark:text-slate-500 text-sm font-medium">/ 100</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {resolutionQuality.reasoning}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400">Target Benchmark</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">≥ 80 / 100</span>
              </div>
            </div>

            {/* Interaction Summary Overview Card */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span>Interaction Summary</span>
                <FileText className="w-4 h-4 text-slate-400" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Customer Issue:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700">{interactionSummary.customerIssue}</p>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Objective:</span>
                  <p className="font-medium text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-100 dark:border-slate-700">{interactionSummary.customerObjective}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 text-xs block mb-1">Final Outcome:</span>
                <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-100 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300">
                  {interactionSummary.resolutionStatus === 'Resolved' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <span>{interactionSummary.finalOutcome}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment Journey Chart Section */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Turn-by-Turn Sentiment & Frustration Journey
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Tracks customer frustration score progression (0-100) across each conversation turn.</p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span> High Frustration (70+)
                </span>
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> Calm / Satisfied (&lt;35)
                </span>
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-56 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="frustrationGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="turn" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} />
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 max-w-xs border border-slate-700">
                            <div className="font-bold flex items-center justify-between border-b border-slate-800 pb-1">
                              <span>{data.turn} ({data.sender})</span>
                              <span className="text-indigo-400 font-semibold">{data.frustration} / 100 Frustration</span>
                            </div>
                            <div className="text-slate-300 font-medium pt-0.5">Emotion: {data.emotion} ({data.sentiment})</div>
                            <p className="text-slate-400 italic text-[11px] line-clamp-2">"{data.excerpt}"</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={70} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'High Risk Threshold', fill: '#f43f5e', fontSize: 10 }} />
                  <Area 
                    type="monotone" 
                    dataKey="frustration" 
                    stroke="#6366f1" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#frustrationGrad)" 
                    activeDot={{ r: 6, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Turn Badges Row */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-2 border-t border-slate-100 dark:border-slate-800">
              {sentimentJourney.map((pt) => (
                <div key={pt.turn} className="shrink-0 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-center min-w-[110px]">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase block">Turn {pt.turn}</span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate">{pt.emotion}</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded border ${
                    pt.frustrationScore > 70 ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' : pt.frustrationScore > 35 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  }`}>
                    Score: {pt.frustrationScore}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Coaching Recommendations Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Strengths Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Agent Strengths
              </h4>
              <ul className="space-y-2">
                {coachingRecommendations.strengths.map((str, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 bg-emerald-50/60 dark:bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5"></span>
                    <span>{str}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas for Improvement Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Areas for Improvement
              </h4>
              <ul className="space-y-2">
                {coachingRecommendations.areasForImprovement.map((area, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-100 dark:border-amber-800/80">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 mt-1.5"></span>
                    <span>{area}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Actions Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Recommended Next Steps
              </h4>
              <ul className="space-y-2">
                {coachingRecommendations.recommendedActions.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200 bg-indigo-50/60 dark:bg-indigo-950/30 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-800/80">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
            >
              Close Report
            </button>
            <button
              onClick={() => handleDownloadReport('md')}
              className="px-3.5 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {downloadedFormat === 'md' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Download className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
              <span>{downloadedFormat === 'md' ? 'Exported MD' : 'Export QA Report'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            {onOpenAnalytics && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAnalytics();
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <BarChart2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                View Team Analytics Dashboard
              </button>
            )}

            {onStartNewSession && (
              <button
                onClick={() => {
                  onClose();
                  onStartNewSession();
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-colors flex items-center gap-2 cursor-pointer"
              >
                <span>Start New Support Session</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
