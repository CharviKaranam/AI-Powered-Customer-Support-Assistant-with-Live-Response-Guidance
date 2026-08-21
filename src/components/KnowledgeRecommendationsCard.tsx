import React, { useState } from 'react';
import { BookOpen, Search, Plus, CheckCircle2, RefreshCw } from 'lucide-react';

interface KnowledgeRecommendationItem {
  title: string;
  category: string;
  summary: string;
  excerpt: string;
  relevance_score: number;
  reasoning?: string;
  steps?: string[];
}

interface KnowledgeRecommendationsCardProps {
  recommendations?: KnowledgeRecommendationItem[];
  relevantArticles?: any[];
  relevantKnowledge?: string[];
  activeSessionStatus?: string;
  onInsertPolicy: (policyText: string) => void;
  onOpenIngestionModal?: () => void;
}

export const KnowledgeRecommendationsCard: React.FC<KnowledgeRecommendationsCardProps> = ({
  recommendations,
  relevantArticles,
  relevantKnowledge,
  activeSessionStatus = 'active',
  onInsertPolicy,
  onOpenIngestionModal
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState<boolean>(false);

  const handleSearchKB = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searching) return;

    setSearching(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(searchQuery)}`);
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (err) {
      console.error('KB search failed', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-3.5 flex flex-col gap-3 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
        <div className="flex items-center justify-between gap-1">
          <h4 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase flex items-center gap-1.5 min-w-0">
            <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">RAG Knowledge Assist</span>
          </h4>
          {onOpenIngestionModal && (
            <button
              type="button"
              onClick={onOpenIngestionModal}
              className="text-[9px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-300 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg transition cursor-pointer shrink-0"
            >
              Manage KB
            </button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[8px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">
            Vector Cosine RAG Grounded
          </span>
        </div>
      </div>

      {/* Manual KB Direct Vector Search Bar */}
      <form onSubmit={handleSearchKB} className="relative flex items-center">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search policies (e.g. 'Refund', 'Shipping')..."
          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-7 pr-14 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-[11px]"
        />
        <Search className="h-3 w-3 text-slate-400 dark:text-slate-500 absolute left-2 top-2" />
        <button
          type="submit"
          disabled={searching || !searchQuery.trim()}
          className="absolute right-1 text-[9px] font-bold bg-emerald-600 dark:bg-emerald-500 text-white px-2 py-1 rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 transition disabled:opacity-50 cursor-pointer"
        >
          {searching ? <RefreshCw className="h-2.5 w-2.5 animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Manual Search Results Overlay */}
      {searchResults.length > 0 && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-2.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-[9px] uppercase">
              Search Results ({searchResults.length})
            </span>
            <button
              onClick={() => setSearchResults([])}
              className="text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Clear
            </button>
          </div>
          {searchResults.map((art, idx) => (
            <div key={idx} className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-bold text-slate-900 dark:text-slate-100 text-[10px] truncate">{art.title}</span>
                <span className="text-[8px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1 py-0.2 rounded font-mono shrink-0">
                  {art.category}
                </span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug">{art.content}</p>
              {activeSessionStatus === 'active' && (
                <button
                  type="button"
                  onClick={() => onInsertPolicy(`According to our official ${art.title} policy: ${art.content}`)}
                  className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-emerald-600 px-2 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-slate-600 transition"
                >
                  Insert Policy
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* RAG Retrieved Recommendations list */}
      {(recommendations && recommendations.length > 0) || (relevantArticles && relevantArticles.length > 0) || (relevantKnowledge && relevantKnowledge.length > 0) ? (
        <div className="space-y-2.5">
          {recommendations && recommendations.length > 0 ? (
            recommendations.map((rec, idx) => (
              <div key={idx} className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-[10px] font-extrabold text-emerald-950 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1 leading-tight">
                      <BookOpen className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{rec.title}</span>
                    </span>
                    <span className="text-[9px] font-extrabold bg-emerald-600 dark:bg-emerald-500 text-white px-1.5 py-0.2 rounded font-mono shrink-0">
                      {Math.round(rec.relevance_score * 100)}% Match
                    </span>
                  </div>
                  <span className="text-[8px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono self-start">
                    {rec.category}
                  </span>
                </div>

                <p className="text-[10px] font-medium text-emerald-950 dark:text-emerald-200 leading-snug">
                  {rec.summary}
                </p>

                <div className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-800/80 rounded-lg p-2 space-y-0.5">
                  <p className="text-[8px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase">Policy Excerpt:</p>
                  <p className="text-[9px] text-slate-700 dark:text-slate-300 leading-relaxed font-mono">
                    "{rec.excerpt}"
                  </p>
                </div>

                {rec.reasoning && (
                  <p className="text-[9px] text-emerald-800 dark:text-emerald-300 italic bg-emerald-100/50 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/40">
                    <strong>RAG Rationale:</strong> {rec.reasoning}
                  </p>
                )}

                {activeSessionStatus === 'active' && (
                  <button
                    type="button"
                    onClick={() => onInsertPolicy(`According to our official ${rec.category} for ${rec.title}: ${rec.excerpt}`)}
                    className="self-end text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    Insert Policy
                  </button>
                )}
              </div>
            ))
          ) : relevantArticles && relevantArticles.length > 0 ? (
            relevantArticles.map((art) => (
              <div key={art.id} className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/60 rounded-xl p-2.5 flex flex-col gap-1.5">
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider flex items-center gap-1">
                    <BookOpen className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{art.title}</span>
                  </span>
                  <span className="text-[8px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono shrink-0">
                    {art.category}
                  </span>
                </div>

                <p className="text-[10px] text-emerald-950 dark:text-emerald-200 leading-snug">
                  {art.content}
                </p>

                {art.steps && art.steps.length > 0 && (
                  <div className="bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-800/80 rounded-lg p-2 space-y-1">
                    <p className="text-[8px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase">Policy Steps:</p>
                    {art.steps.map((step: string, sIdx: number) => (
                      <div key={sIdx} className="text-[9px] text-slate-700 dark:text-slate-300 flex items-start gap-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">•</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}

                {activeSessionStatus === 'active' && (
                  <button
                    type="button"
                    onClick={() => onInsertPolicy(`According to our company policy for ${art.title}: ${art.steps ? art.steps[0] : art.content}`)}
                    className="self-end text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-100 dark:hover:bg-slate-700 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    Insert Policy
                  </button>
                )}
              </div>
            ))
          ) : (
            relevantKnowledge?.map((title, idx) => (
              <div key={idx} className="flex items-start justify-between gap-1 p-2 bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800 rounded-xl">
                <div className="flex items-start gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] font-semibold text-emerald-950 dark:text-emerald-200 leading-tight">
                    {title}
                  </span>
                </div>
                {activeSessionStatus === 'active' && (
                  <button
                    type="button"
                    onClick={() => onInsertPolicy(`Following our guidelines regarding ${title}, let me assist you right away.`)}
                    className="text-[8px] font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700 px-1.5 py-0.5 rounded hover:bg-emerald-100 dark:hover:bg-slate-700 transition shrink-0 cursor-pointer"
                  >
                    Insert
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-xs italic">
          Matching knowledge base recommendations will appear here.
        </div>
      )}
    </div>
  );
};
