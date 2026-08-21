import React, { useEffect, useState } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertTriangle, 
  BookOpen, 
  Award, 
  RefreshCw, 
  Eye, 
  ShieldAlert, 
  Layers, 
  Zap,
  HelpCircle,
  Lightbulb,
  Database,
  Download
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  Legend 
} from 'recharts';
import { PerformanceAnalyticsData, PostInteractionReport } from '../types.js';

interface AnalyticsDashboardProps {
  onSelectSessionReport: (sessionId: string) => void;
  onBackToConsole: () => void;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  onSelectSessionReport,
  onBackToConsole
}) => {
  const [data, setData] = useState<PerformanceAnalyticsData | null>(null);
  const [dbStats, setDbStats] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resAnalytics, resStats] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/db/stats')
      ]);
      if (!resAnalytics.ok) throw new Error(`HTTP ${resAnalytics.status}`);
      const json = await resAnalytics.json();
      setData(json);

      if (resStats.ok) {
        const statsJson = await resStats.json();
        setDbStats(statsJson);
      }
    } catch (err: any) {
      console.error('Failed to load performance analytics:', err);
      setError('Failed to load performance analytics data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[500px] flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
        <RefreshCw className="w-8 h-8 text-indigo-600 dark:text-indigo-400 animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Calculating Performance Analytics Across Support Sessions...</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Aggregating resolution quality, escalation triggers, and knowledge gaps from SQLite.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-center max-w-lg mx-auto my-12">
        <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-rose-900 dark:text-rose-200">Analytics Load Error</h3>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1 mb-4">{error || 'No performance data available.'}</p>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-rose-600 text-white font-medium text-xs rounded-xl shadow hover:bg-rose-700 transition-colors"
        >
          Retry Load
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 dark:bg-slate-850 text-white p-6 rounded-2xl shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <BarChart2 className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Support Performance & AI Coaching Analytics</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Real-time aggregate insights across completed customer interactions, de-escalation efficiency, knowledge base retrieval gaps, and agent skill growth metrics.
          </p>

          {/* SQL Storage indicator */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-slate-800 text-indigo-300 border border-slate-700 text-[11px] font-medium px-2.5 py-1 rounded-lg">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              Backend: <strong className="text-white">Python 3 + SQLite Engine (resolve_ai.sqlite)</strong>
            </span>
            {dbStats && (
              <span className="text-[11px] text-slate-400 bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-700/60">
                {dbStats.sessionsCount} Sessions • {dbStats.messagesCount} Logged Turns • {dbStats.reportsCount} Reports
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href="/api/db/export"
            download="resolve_ai.sqlite"
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Download full SQLite database file"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export SQL DB</span>
          </a>

          <button
            onClick={fetchAnalytics}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Refresh Analytics Data"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          <button
            onClick={onBackToConsole}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>Back to Live Console</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* Total Sessions */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Total Sessions</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{data.totalSessions}</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Recorded in database</span>
        </div>

        {/* Resolution Rate */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Resolution Rate</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{data.resolutionRate}%</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{data.resolvedSessions} resolved sessions</span>
        </div>

        {/* Escalation Rate */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Escalation Rate</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-rose-600 dark:text-rose-400">
              {data.totalSessions > 0 ? Math.round((data.escalatedSessions / data.totalSessions) * 100) : 0}%
            </span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{data.escalatedSessions} escalated sessions</span>
        </div>

        {/* Avg Resolution Quality */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Quality Score</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{data.avgResolutionQualityScore}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">/ 100</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Avg quality rating</span>
        </div>

        {/* Avg Escalation Risk */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Escalation Risk</span>
            <ShieldAlert className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{data.avgEscalationRiskScore}</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Avg max risk score</span>
        </div>

        {/* Avg Turns per Session */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Avg Turns</span>
            <BarChart2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{data.avgTurnCount}</span>
          </div>
          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Messages / interaction</span>
        </div>

      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Quality Score & Frustration Trend Line Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Session De-escalation & Resolution Quality Progression
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Initial vs Final Customer Frustration scores compared with Resolution Quality Score across interactions.</p>
            </div>
          </div>

          <div className="h-64 w-full pt-2">
            {data.improvementIndicators.sentimentProgression.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.improvementIndicators.sentimentProgression} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="sessionLabel" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.75rem', border: '1px solid #334155', color: '#fff', fontSize: '12px' }} 
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="initialFrustration" name="Initial Customer Frustration" stroke="#f43f5e" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="finalFrustration" name="Final Customer Frustration" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="qualityScore" name="Resolution Quality Score" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 italic">
                No session data recorded yet. Complete a support session to view trends.
              </div>
            )}
          </div>
        </div>

        {/* Common Escalation Triggers Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Common Escalation Triggers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Top recurring conditions triggering high escalation risk alerts.</p>

            <div className="space-y-3">
              {data.commonEscalationTriggers.map((trig, idx) => {
                const maxCount = Math.max(...data.commonEscalationTriggers.map(t => t.count), 1);
                const pct = Math.round((trig.count / maxCount) * 100);
                return (
                  <div key={idx} className="space-y-1 text-xs">
                    <div className="flex justify-between text-slate-700 dark:text-slate-300 font-medium">
                      <span className="truncate max-w-[200px]">{trig.trigger}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{trig.count} occurrence{trig.count > 1 ? 's' : ''}</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-rose-500 h-full rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>Proactive coaching on de-escalation reduces supervisor transfers by up to 40%.</span>
          </div>
        </div>

      </div>

      {/* 2-Column Knowledge Gaps & Agent Skill Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Knowledge Base Coverage Gaps Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Knowledge Base Coverage Gaps & Retrieval Failures
            </h2>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              {data.knowledgeGaps.length} Topics Identified
            </span>
          </div>

          <div className="space-y-3">
            {data.knowledgeGaps.map((gap, idx) => (
              <div key={idx} className="p-3 bg-amber-50/50 dark:bg-amber-950/40 rounded-xl border border-amber-200/60 dark:border-amber-800/60 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-amber-900 dark:text-amber-200">
                  <span>{gap.topic}</span>
                  <span className="bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200 dark:border-amber-800">
                    {gap.count} low-match query
                  </span>
                </div>
                <p className="text-amber-800 dark:text-amber-300 text-[11px] leading-relaxed">
                  <span className="font-semibold">Reason:</span> {gap.reason}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Agent Skill Growth & Coaching Indicators */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Agent Coaching & Skill Growth Indicators
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Top Strengths */}
            <div className="space-y-2">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider text-[11px] block">
                Recognized Strengths
              </span>
              <ul className="space-y-1.5">
                {data.improvementIndicators.strengths.map((s, idx) => (
                  <li key={idx} className="p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-100 dark:border-emerald-800/80 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span className="truncate pr-1">{s.name}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 shrink-0">x{s.count}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Areas Needing Attention */}
            <div className="space-y-2">
              <span className="font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider text-[11px] block">
                Areas for Attention
              </span>
              <ul className="space-y-1.5">
                {data.improvementIndicators.areasToImprove.map((a, idx) => (
                  <li key={idx} className="p-2 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-100 dark:border-rose-800/80 text-slate-700 dark:text-slate-200 flex items-center justify-between">
                    <span className="truncate pr-1">{a.name}</span>
                    <span className="font-bold text-rose-700 dark:text-rose-400 shrink-0">x{a.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Recent Sessions Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-0">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Recorded Support Interaction Sessions</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Access completed post-interaction performance reports and sentiment journeys.</p>
          </div>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
            {data.sessionHistoryList.length} total sessions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-3 px-4">Session ID</th>
                <th className="py-3 px-4">Scenario</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Turns</th>
                <th className="py-3 px-4">Quality Score</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {data.sessionHistoryList.length > 0 ? (
                data.sessionHistoryList.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-600 dark:text-indigo-400">#{s.id.slice(0, 8)}</td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{s.scenarioName}</td>
                    <td className="py-3 px-4">
                      <span className="capitalize px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {s.mode}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        s.status === 'resolved' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' : s.status === 'escalated' ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">{s.turnCount} turns</td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100">
                      {s.qualityScore !== undefined ? `${s.qualityScore} / 100` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectSessionReport(s.id)}
                        className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Report</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 dark:text-slate-500 italic">
                    No support session records found in database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
