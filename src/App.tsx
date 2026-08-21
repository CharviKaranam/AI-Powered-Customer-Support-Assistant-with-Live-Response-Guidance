import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  Sparkles,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  User,
  ArrowRight,
  History,
  ShieldAlert,
  Smile,
  Frown,
  Meh,
  Clock,
  BrainCircuit,
  Info,
  ChevronRight,
  ExternalLink,
  LifeBuoy,
  Search,
  SlidersHorizontal,
  Tag,
  Ticket,
  Gift,
  Percent,
  Truck,
  RotateCcw,
  Copy,
  Plus,
  Trash2,
  Award,
  BarChart2,
  Sun,
  Moon
} from 'lucide-react';
import { Scenario, SimulationSession, Message } from './types.js';
import { EscalationRiskCard } from './components/EscalationRiskCard.js';
import { KnowledgeRecommendationsCard } from './components/KnowledgeRecommendationsCard.js';
import { ReplayModeModal } from './components/ReplayModeModal.js';
import { PostInteractionReportModal } from './components/PostInteractionReportModal.js';
import { AnalyticsDashboard } from './components/AnalyticsDashboard.js';
import { KnowledgeIngestionModal } from './components/KnowledgeIngestionModal.js';
import { PostInteractionReport } from './types.js';

export default function App() {
  // Theme state (Light / Dark mode)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('resolve_ai_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('resolve_ai_theme', theme);
    } catch (e) {
      console.error('Failed to sync theme preference:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Selected configuration for the simulator setup
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('Any');
  const [selectedSentiment, setSelectedSentiment] = useState<string>('Any');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>('any');

  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [activeSession, setActiveSession] = useState<SimulationSession | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [manualCustomerInput, setManualCustomerInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingAction, setLoadingAction] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [viewHistoryMode, setViewHistoryMode] = useState<boolean>(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState<any | null>(null);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState<string>('All');

  // Mode Selection State
  const [setupModeTab, setSetupModeTab] = useState<'simulator' | 'manual' | 'replay'>('simulator');
  const [interactionMode, setInteractionMode] = useState<'simulator' | 'manual' | 'replay'>('simulator');

  // Knowledge Base Modal
  const [kbModalOpen, setKbModalOpen] = useState<boolean>(false);

  // Replay Mode States
  const [replayModalOpen, setReplayModalOpen] = useState<boolean>(false);
  const [replayTurns, setReplayTurns] = useState<{ sender: 'customer' | 'agent'; text: string }[]>([]);
  const [replayTurnIndex, setReplayTurnIndex] = useState<number>(0);
  const [replayScenarioTitle, setReplayScenarioTitle] = useState<string>('');

  // Milestone 4: Report and Analytics States
  const [viewAnalyticsMode, setViewAnalyticsMode] = useState<boolean>(false);
  const [reportModalOpen, setReportModalOpen] = useState<boolean>(false);
  const [activeReport, setActiveReport] = useState<PostInteractionReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState<boolean>(false);

  const handleEndSessionAndGenerateReport = async (status: 'resolved' | 'escalated' = 'resolved') => {
    if (!activeSession) return;
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, summary: 'Session completed by support representative.' })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveSession(data.session);
        setActiveReport(data.report);
        setReportModalOpen(true);
        fetchHistory();
      }
    } catch (err) {
      console.error("Failed to generate post-interaction report", err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleOpenReportForSession = async (sessionId: string) => {
    setGeneratingReport(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/post-report`);
      if (res.ok) {
        const report = await res.json();
        setActiveReport(report);
        setReportModalOpen(true);
      }
    } catch (err) {
      console.error("Failed to load post report", err);
    } finally {
      setGeneratingReport(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load scenarios and past history on start
  useEffect(() => {
    fetchScenarios();
    fetchHistory();
  }, []);

  // Scroll to bottom of chat whenever messages list updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const fetchScenarios = async () => {
    try {
      const res = await fetch('/api/scenarios');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setScenarios(data);
        setSelectedScenarioId('any');
      }
    } catch (e) {
      console.error('Failed to load scenarios', e);
      setError('Failed to connect to the backend server. Please make sure the server is fully started.');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        setHistory(data);
        localStorage.setItem('resolve_ai_history_cache', JSON.stringify(data));
      } else {
        const cached = localStorage.getItem('resolve_ai_history_cache');
        if (cached) setHistory(JSON.parse(cached));
      }
    } catch (e) {
      console.error('Failed to load history', e);
      const cached = localStorage.getItem('resolve_ai_history_cache');
      if (cached) setHistory(JSON.parse(cached));
    }
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to permanently delete this session log?')) return;
    try {
      const res = await fetch(`/api/history/session/${sessionId}`, { method: 'DELETE' });
      if (res.ok) {
        if (selectedHistorySession?.id === sessionId) {
          setSelectedHistorySession(null);
        }
        fetchHistory();
      }
    } catch (err) {
      console.error('Failed to delete session', err);
    }
  };

  const handleClearAllHistory = async () => {
    if (!window.confirm('Are you sure you want to permanently clear ALL training session history logs?')) return;
    try {
      const res = await fetch('/api/history', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        setSelectedHistorySession(null);
        localStorage.removeItem('resolve_ai_history_cache');
      }
    } catch (err) {
      console.error('Failed to clear history', err);
    }
  };

  const handleStartSimulation = async (scenarioId: string | null, difficulty: string, sentiment: string) => {
    setLoading(true);
    setLoadingAction('Initializing Simulation Agent...');
    setError(null);
    setInteractionMode('simulator');
    try {
      const res = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenarioId: scenarioId || 'any',
          difficulty,
          sentiment
        })
      });
      if (!res.ok) throw new Error('Failed to initialize session');
      const data = await res.json();
      setActiveSession({ ...data.session, mode: 'simulator' });
      setMessages([data.initialMessage]);
      setViewHistoryMode(false);
      setSelectedHistorySession(null);
      fetchHistory(); // Refresh general history list
    } catch (e: any) {
      console.error(e);
      setError('Failed to start customer simulation session. Make sure your API keys are correct.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleStartManualSession = async (customCustomerText: string, scenarioId: string | null) => {
    if (!customCustomerText.trim()) return;
    setLoading(true);
    setLoadingAction('Analyzing Customer Message with 4-Agent Pipeline...');
    setError(null);
    setInteractionMode('manual');
    try {
      const res = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenarioId: scenarioId || 'any',
          difficulty: 'Medium',
          sentiment: 'Frustrated',
          mode: 'manual',
          customGreeting: customCustomerText.trim()
        })
      });
      if (!res.ok) throw new Error('Failed to initialize manual session');
      const data = await res.json();
      setActiveSession({ ...data.session, mode: 'manual' });
      setMessages([data.initialMessage]);
      setViewHistoryMode(false);
      setSelectedHistorySession(null);
      setManualCustomerInput('');
      fetchHistory();
    } catch (e: any) {
      console.error(e);
      setError('Failed to start manual session: ' + (e.message || 'API connection error'));
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleSendManualCustomerTurn = async (text: string) => {
    if (!text.trim() || !activeSession || loading) return;
    setLoading(true);
    setLoadingAction('Running Intent, RAG, and Coaching Agents...');
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${activeSession.id}/manual-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: 'customer', text: text.trim() })
      });
      if (!res.ok) throw new Error('Failed to submit customer turn');
      const data = await res.json();
      setMessages(prev => [...prev, data.message]);
      setManualCustomerInput('');
    } catch (err: any) {
      console.error(err);
      setError('Failed to process customer turn: ' + err.message);
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleStartReplaySession = async (turns: { sender: 'customer' | 'agent'; text: string }[], title: string) => {
    if (!turns || turns.length === 0) {
      setError('No replay turns found to execute.');
      return;
    }
    setLoading(true);
    setLoadingAction('Initializing Replay Session...');
    setError(null);
    try {
      const res = await fetch('/api/simulation/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scenarioId: 'any', 
          difficulty: 'Medium', 
          sentiment: 'Frustrated',
          mode: 'replay',
          customGreeting: turns[0]?.sender === 'customer' ? turns[0].text : 'Hello'
        })
      });
      if (!res.ok) throw new Error('Failed to initialize session');
      const data = await res.json();
      const session = { ...data.session, mode: 'replay' as const };
      setActiveSession(session);
      setInteractionMode('replay');
      setReplayTurns(turns);
      setReplayScenarioTitle(title);
      setReplayTurnIndex(0);
      setViewHistoryMode(false);

      const initialMsg = data.initialMessage || data.message || data.customerMessage;
      if (initialMsg) {
        setMessages([initialMsg]);
      } else {
        setMessages([]);
        await executeReplayStep(session.id, turns[0], 0);
      }
      fetchHistory();
    } catch (e: any) {
      console.error(e);
      setError('Failed to start Replay Mode session.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const executeReplayStep = async (sessionId: string, turn: { sender: 'customer' | 'agent'; text: string }, index: number) => {
    if (!turn || !turn.text) return;
    setLoading(true);
    setLoadingAction(`Replaying Turn ${index + 1}/${replayTurns.length || 1}...`);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/replay-turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: turn.text, sender: turn.sender })
      });
      if (!res.ok) throw new Error('Failed to step replay turn');
      const data = await res.json();
      const newMsg = data.message || data.customerMessage || data.agentMessage;
      if (newMsg) {
        setMessages(prev => {
          const filtered = prev.filter(m => m && m.id !== newMsg.id);
          return [...filtered, newMsg];
        });
      }
      setReplayTurnIndex(index);
    } catch (err: any) {
      console.error(err);
      setError('An error occurred executing replay turn.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleNextReplayTurn = async () => {
    if (!activeSession || replayTurnIndex >= replayTurns.length - 1 || loading) return;
    const nextIndex = replayTurnIndex + 1;
    await executeReplayStep(activeSession.id, replayTurns[nextIndex], nextIndex);
  };

  const handleSendSpecificMessage = async (textToSend: string) => {
    if (!textToSend.trim() || !activeSession || loading) return;

    setLoading(true);
    setLoadingAction('Customer Simulator evaluating response...');
    setError(null);

    // Optimistically add agent message to client state
    const tempAgentMsg: Message = {
      id: 'temp-' + Date.now(),
      sessionId: activeSession.id,
      sender: 'agent',
      text: textToSend,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempAgentMsg]);

    try {
      const res = await fetch('/api/simulation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          messageText: textToSend
        })
      });

      if (!res.ok) throw new Error('Failed to send message');
      const data = await res.json();

      // Replace messages with final state (or append customer message)
      setMessages(prev => {
        // Remove temp agent message and replace with official ones
        const list = prev.filter(m => !m.id.startsWith('temp-'));
        return [...list, data.agentMessage, data.customerMessage];
      });

      // Update active session state if status changes
      if (data.sessionStatus !== 'active') {
        setActiveSession(prev => prev ? { ...prev, status: data.sessionStatus, summary: data.reasoning } : null);
        fetchHistory(); // Refresh list to capture resolution status
      }
    } catch (e: any) {
      console.error(e);
      setError('An error occurred while transmitting your message to the Customer Agent.');
    } finally {
      setLoading(false);
      setLoadingAction('');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeSession || loading) return;

    const textToSend = inputMessage;
    setInputMessage('');
    await handleSendSpecificMessage(textToSend);
  };

  const loadPastSessionDetails = async (sess: any) => {
    try {
      const res = await fetch(`/api/simulation/session/${sess.id}`);
      const data = await res.json();
      setSelectedHistorySession({
        ...sess,
        messages: data.messages
      });
    } catch (e) {
      console.error('Failed to load session details', e);
    }
  };

  const useSuggestion = (text: string) => {
    setInputMessage(text);
  };

  const activeScenario = scenarios.find(s => s.id === activeSession?.scenarioId);
  const selectedScenario = scenarios.find(s => s.id === selectedScenarioId);

  // Helper colors for badges
  const getSentimentStyles = (sentiment?: string) => {
    switch (sentiment) {
      case 'Positive': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'Neutral': return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
      case 'Negative': return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800';
      default: return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const getFrustrationStyles = (level?: string) => {
    switch (level) {
      case 'Low': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800';
      case 'Medium': return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'High': return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse';
      default: return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  const getEscalationStyles = (risk?: string) => {
    switch (risk) {
      case 'Low': return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800';
      case 'Medium': return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      case 'High': return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 font-semibold animate-bounce';
      default: return 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700';
    }
  };

  // Extract the latest customer analysis from the message history
  const customerMessages = messages.filter(m => m.sender === 'customer');
  const latestCustomerMsg = customerMessages[customerMessages.length - 1];

  return (
    <div id="resolve_ai_app" className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      {/* Top Header Section */}
      <header id="header_section" className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs sticky top-0 z-50 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-2.5 rounded-xl shadow-md shadow-indigo-100 dark:shadow-none flex items-center justify-center">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                ResolveAI
                <span className="text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 uppercase tracking-wide">
                  Coaching Engine
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">AI Support Coaching & Customer Simulation Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            {activeSession ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  {interactionMode === 'replay' ? 'Replay Mode:' : 'Simulation Mode:'}{' '}
                  <span className="text-indigo-600 dark:text-indigo-400 font-extrabold uppercase">
                    {interactionMode === 'replay' ? (replayScenarioTitle || 'Custom Replay') : activeScenario?.name}
                  </span>
                </span>

                <button
                  id="btn_end_session_report"
                  onClick={() => handleEndSessionAndGenerateReport('resolved')}
                  disabled={generatingReport}
                  className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 px-3 py-1.5 rounded-xl transition font-semibold cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <Award className="h-3.5 w-3.5" />
                  {generatingReport ? 'Evaluating...' : 'End & View Report'}
                </button>

                <button
                  id="btn_quit_simulation"
                  onClick={() => {
                    setActiveSession(null);
                    setMessages([]);
                    setInteractionMode('simulator');
                    setReplayTurns([]);
                    setReplayTurnIndex(0);
                    setError(null);
                    setLoading(false);
                    setLoadingAction('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-xl transition font-medium cursor-pointer"
                >
                  Quit
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  id="btn_open_kb_manager"
                  onClick={() => setKbModalOpen(true)}
                  className="text-xs flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2 rounded-xl transition font-bold cursor-pointer shadow-2xs"
                >
                  <BookOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Knowledge Base (RAG)
                </button>

                <button
                  id="btn_open_analytics"
                  onClick={() => {
                    setViewAnalyticsMode(!viewAnalyticsMode);
                    setViewHistoryMode(false);
                  }}
                  className={`text-xs flex items-center gap-1.5 border px-3.5 py-2 rounded-xl transition font-bold cursor-pointer ${
                    viewAnalyticsMode
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <BarChart2 className="h-4 w-4" />
                  Analytics
                </button>

                <button
                  id="btn_open_replay_mode"
                  onClick={() => {
                    setViewAnalyticsMode(false);
                    setReplayModalOpen(true);
                  }}
                  className="text-xs flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3.5 py-2 rounded-xl transition font-bold cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                  Replay Mode
                </button>

                <button
                  id="btn_toggle_history"
                  onClick={() => {
                    setViewHistoryMode(!viewHistoryMode);
                    setViewAnalyticsMode(false);
                    setSelectedHistorySession(null);
                  }}
                  className={`text-xs flex items-center gap-2 border px-3.5 py-2 rounded-xl transition font-medium cursor-pointer ${
                    viewHistoryMode
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-600 shadow-md'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <History className="h-4 w-4" />
                  {viewHistoryMode ? 'Setup' : 'History Logs'}
                </button>
              </div>
            )}

            {/* Dark/Light Mode Switcher Button */}
            <button
              id="btn_toggle_theme"
              type="button"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl transition font-bold cursor-pointer border bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700 shadow-2xs"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-indigo-600" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col min-h-0">
        {/* Error Alert Bar */}
        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-shake">
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm">System Connection Alert</p>
              <p className="text-xs mt-1 text-rose-700">{error}</p>
            </div>
          </div>
        )}

        {/* ANALYTICS DASHBOARD VIEW */}
        {!activeSession && viewAnalyticsMode && (
          <AnalyticsDashboard
            onSelectSessionReport={handleOpenReportForSession}
            onBackToConsole={() => setViewAnalyticsMode(false)}
          />
        )}

        {/* SETUP SCREEN / 3-MODE TRAINING SELECTOR */}
        {!activeSession && !viewHistoryMode && !viewAnalyticsMode && (
          <div id="setup_screen" className="flex-1 flex flex-col justify-center py-6">
            <div className="text-center max-w-2xl mx-auto mb-6">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full uppercase tracking-wider border border-indigo-200 dark:border-indigo-800">
                Support Agent Training & Evaluation Suite
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-3 tracking-tight">
                AI Customer Coaching Console
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mt-2 text-sm">
                Choose your training mode to begin practicing customer interactions with multi-agent real-time feedback.
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-center gap-2 mb-8 max-w-xl mx-auto w-full p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <button
                id="tab_mode_simulator"
                type="button"
                onClick={() => setSetupModeTab('simulator')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  setupModeTab === 'simulator'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-750'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                1. Simulator Mode
              </button>
              <button
                id="tab_mode_manual"
                type="button"
                onClick={() => setSetupModeTab('manual')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  setupModeTab === 'manual'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-750'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <MessageSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                2. Manual Mode
              </button>
              <button
                id="tab_mode_replay"
                type="button"
                onClick={() => {
                  setSetupModeTab('replay');
                  setReplayModalOpen(true);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  setupModeTab === 'replay'
                    ? 'bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 shadow-sm border border-slate-200 dark:border-slate-750'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <RotateCcw className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                3. Replay Mode
              </button>
            </div>

            {/* MANUAL MODE INTERFACE */}
            {setupModeTab === 'manual' && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-4xl mx-auto w-full flex flex-col gap-5">
                <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      Manual Testing & Coaching Mode
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                      Paste real customer messages or test arbitrary support queries to evaluate AI Intent extraction, RAG Knowledge Base matching, Escalation Risk detection, and suggested responses.
                    </p>
                  </div>
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Live Input
                  </span>
                </div>

                {/* Pre-fill Quick Queries */}
                <div className="flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Quick High-Friction Test Cases (Click to Test):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      {
                        title: "Delayed Order & Angry Customer",
                        text: "Where the hell is my order #8841? It was promised 4 days ago and tracking is stuck. I demand an immediate refund or I am canceling my account!"
                      },
                      {
                        title: "Damaged Delivery & Photo Verification",
                        text: "I received package #4412 today but the glass teapot inside is shattered. Can you send a replacement today or issue a refund?"
                      },
                      {
                        title: "Account Login & MFA Locked Out",
                        text: "I cannot log into my workspace account. It says too many failed MFA attempts. I have an urgent client demo in 20 minutes!"
                      },
                      {
                        title: "Disputed Credit Card Charge",
                        text: "I see an unexpected recurring charge of $49.99 on my credit card statement for Order #9910. I never authorized this renewal!"
                      }
                    ].map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setManualCustomerInput(sample.text)}
                        className="text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition flex flex-col gap-1 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          {sample.title}
                        </span>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 italic font-serif">"{sample.text}"</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Input Box */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Paste Customer Message or Query:
                  </label>
                  <textarea
                    rows={4}
                    value={manualCustomerInput}
                    onChange={(e) => setManualCustomerInput(e.target.value)}
                    placeholder="Enter customer message here (e.g., 'My tracking number 9912 is stuck, what is happening?')..."
                    className="w-full p-3.5 text-xs bg-slate-50 dark:bg-slate-800/80 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-sans"
                  />
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    The 4 orchestrator agents (Intent, Knowledge RAG, Risk & Coaching) will analyze the input in real-time.
                  </span>
                  <button
                    type="button"
                    id="btn_start_manual_session"
                    onClick={() => handleStartManualSession(manualCustomerInput, 'any')}
                    disabled={!manualCustomerInput.trim() || loading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-8 rounded-xl text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    Start Live Coaching for Query
                  </button>
                </div>
              </div>
            )}

            {/* SIMULATOR MODE INTERFACE */}
            {setupModeTab === 'simulator' && (
              <>
                {scenarios.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm max-w-md mx-auto text-center">
                    <RefreshCw className="h-8 w-8 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Initializing agent scenarios and policies...</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-8 max-w-5xl mx-auto w-full">
                    {/* 2-Column top grid: Difficulty & Sentiment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Category A: Difficulty */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <SlidersHorizontal className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                            1. Select Difficulty Level
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { id: 'Any', label: 'Any Level', desc: 'Random difficulty challenge', icon: Sparkles },
                            { id: 'Easy', label: 'Easy', desc: 'Patient & opening customer', icon: Smile },
                            { id: 'Medium', label: 'Medium', desc: 'Average friction customer', icon: Meh },
                            { id: 'High', label: 'High', desc: 'Critical & complex escalation', icon: Frown }
                          ].map((lvl) => {
                            const isSel = selectedDifficulty === lvl.id;
                            const Icon = lvl.icon;
                            return (
                              <button
                                key={lvl.id}
                                id={`difficulty_box_${lvl.id}`}
                                onClick={() => setSelectedDifficulty(lvl.id)}
                                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSel
                                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/10 shadow-sm'
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 w-full justify-between">
                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{lvl.label}</span>
                                  <Icon className={`h-4 w-4 ${isSel ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{lvl.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Category B: Sentiment */}
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                            2. Select Customer Mood
                          </h3>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                          {[
                            { id: 'Any', label: 'Any Mood', desc: 'Unpredictable starting state', icon: Sparkles },
                            { id: 'Concerned', label: 'Concerned', desc: 'Anxious / Worried', icon: Smile },
                            { id: 'Frustrated', label: 'Frustrated', desc: 'Highly impatient', icon: Frown },
                            { id: 'Angry', label: 'Angry', desc: 'Furious & suspicious', icon: Frown },
                            { id: 'Annoyed', label: 'Annoyed', desc: 'Demanding & critical', icon: Meh }
                          ].map((mood) => {
                            const isSel = selectedSentiment === mood.id;
                            const Icon = mood.icon;
                            return (
                              <button
                                key={mood.id}
                                id={`mood_box_${mood.id}`}
                                onClick={() => setSelectedSentiment(mood.id)}
                                className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                                  isSel
                                    ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-600/10 shadow-sm'
                                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 w-full justify-between">
                                  <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">{mood.label}</span>
                                  <Icon className={`h-4 w-4 ${isSel ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                                </div>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-tight">{mood.desc}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Category C: Scenarios List */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col gap-5">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <h3 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">
                          3. Select Simulation Scenario
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Any Scenario Box */}
                        <button
                          id="scenario_card_any"
                          onClick={() => setSelectedScenarioId('any')}
                          className={`cursor-pointer rounded-2xl border p-5 text-left transition-all flex flex-col justify-between relative hover:shadow-md ${
                            selectedScenarioId === 'any'
                              ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/40 ring-2 ring-indigo-600/10 shadow-sm'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-3 mb-4">
                              <div className="w-12 h-12 rounded-full border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/80 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Sparkles className="h-6 w-6 animate-pulse" />
                              </div>
                              <div>
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">Random Customer</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">Auto-resolved on start</p>
                              </div>
                            </div>
                            <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">Any Training Case</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                              Let the simulator automatically pick a random scenario from all active options or match it to your chosen Difficulty and Sentiment options above!
                            </p>
                          </div>

                          <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-6 w-full">
                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-150 dark:border-indigo-800">
                              Recommended Choice
                            </span>
                          </div>

                          {selectedScenarioId === 'any' && (
                            <div className="absolute top-4 right-4 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          )}
                        </button>

                        {/* Predefined Scenario Boxes */}
                        {scenarios.map((sc) => {
                          const isSelected = selectedScenarioId === sc.id;
                          return (
                            <button
                              key={sc.id}
                              id={`scenario_card_${sc.id}`}
                              onClick={() => setSelectedScenarioId(sc.id)}
                              className={`cursor-pointer rounded-2xl border p-5 text-left transition-all flex flex-col justify-between relative hover:shadow-md ${
                                isSelected
                                  ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/40 ring-2 ring-indigo-600/10 shadow-sm'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center gap-3 mb-4">
                                  <img
                                    src={sc.customerProfile.avatarUrl}
                                    alt={sc.customerProfile.name}
                                    className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                  />
                                  <div>
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-tight">{sc.customerProfile.name}</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Simulated Customer</p>
                                  </div>
                                </div>

                                <h3 className="font-bold text-slate-900 dark:text-white text-base mb-2">{sc.name}</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-xs leading-relaxed line-clamp-3 mb-4">{sc.description}</p>
                              </div>

                              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-2 w-full">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    sc.difficulty === 'Easy' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-150 dark:border-emerald-800' :
                                    sc.difficulty === 'Medium' ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-150 dark:border-amber-800' :
                                    'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-150 dark:border-rose-800'
                                  }`}>
                                    {sc.difficulty}
                                  </span>
                                  <span className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
                                    {sc.initialMood}
                                  </span>
                                </div>
                              </div>

                              {isSelected && (
                                <div className="absolute top-4 right-4 bg-indigo-600 text-white rounded-full p-1 shadow-sm">
                                  <CheckCircle2 className="h-4 w-4" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Launch Button */}
                    <div className="mt-4 text-center">
                      <button
                        id="btn_start_simulation"
                        onClick={() => handleStartSimulation(selectedScenarioId, selectedDifficulty, selectedSentiment)}
                        disabled={loading}
                        className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 px-12 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none transition-all transform active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                      >
                        {loading ? (
                          <>
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            {loadingAction || 'Loading Simulation...'}
                          </>
                        ) : (
                          <>
                            Start Live Customer Simulation
                            <ArrowRight className="h-5 w-5" />
                          </>
                        )}
                      </button>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        The AI coaching framework and knowledge base indexes will prepare dynamically upon launching.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PERFORMANCE HISTORY VIEW */}
        {!activeSession && viewHistoryMode && (
          <div id="history_screen" className="flex-grow flex flex-col lg:flex-row gap-6 py-4">
            {/* Sidebar list of past sessions */}
            <div className="w-full lg:w-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col h-[620px]">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">Permanent History Logs</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{history.length} saved sessions</p>
                  </div>
                </div>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-950/80 border border-rose-200 dark:border-rose-800 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear All
                  </button>
                )}
              </div>

              {/* History Search & Filter controls */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 space-y-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search past logs by scenario or customer..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {['All', 'Active', 'Resolved', 'Escalated'].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setHistoryFilterStatus(st)}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                        historyFilterStatus === st
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* History list */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 p-2 space-y-1">
                {history.length === 0 ? (
                  <div className="text-center p-8 text-slate-400 text-xs">
                    No simulation history logs found. Complete your first training module to save permanent performance logs here.
                  </div>
                ) : (
                  history
                    .filter((sess) => {
                      const matchesSearch =
                        !historySearchQuery ||
                        (sess.scenarioName || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                        (sess.customerName || '').toLowerCase().includes(historySearchQuery.toLowerCase());
                      const matchesStatus =
                        historyFilterStatus === 'All' || sess.status === historyFilterStatus.toLowerCase();
                      return matchesSearch && matchesStatus;
                    })
                    .map((sess) => {
                      const isActive = selectedHistorySession?.id === sess.id;
                      return (
                        <div
                          key={sess.id}
                          onClick={() => loadPastSessionDetails(sess)}
                          className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1.5 cursor-pointer border ${
                            isActive ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800' : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">{sess.scenarioName}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase ${
                                sess.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800' :
                                sess.status === 'escalated' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-800' :
                                'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800'
                              }`}>
                                {sess.status}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteSession(sess.id, e)}
                                title="Delete this session record"
                                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/60 transition cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1 font-medium">
                              <User className="h-3 w-3 text-slate-400" /> {sess.customerName}
                            </span>
                            <span className="flex items-center gap-1 font-mono">
                              <Clock className="h-3 w-3 text-slate-400" /> {new Date(sess.startedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

            {/* Session Detail display */}
            <div className="flex-grow bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm h-[620px] flex flex-col overflow-hidden">
              {selectedHistorySession ? (
                <div className="flex flex-col h-full">
                  {/* Past session detail header */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 dark:text-white text-base">{selectedHistorySession.scenarioName}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Session ID: <span className="font-mono">{selectedHistorySession.id}</span> • Started {new Date(selectedHistorySession.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs font-extrabold px-3 py-1 rounded-xl uppercase border ${
                      selectedHistorySession.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                    }`}>
                      {selectedHistorySession.status}
                    </span>
                  </div>

                  {/* Body with messages and analysis */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Summary Card */}
                    {selectedHistorySession.summary && (
                      <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-150 dark:border-indigo-800/80 rounded-xl p-4">
                        <h4 className="text-xs font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider mb-1">Coach Final Evaluation</h4>
                        <p className="text-xs text-indigo-950 dark:text-indigo-200 leading-relaxed font-sans font-medium">{selectedHistorySession.summary}</p>
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Conversation Audit Log</h4>
                      {selectedHistorySession.messages?.map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col max-w-[90%] ${
                            msg.sender === 'agent' ? 'ml-auto items-end' : 'mr-auto items-start'
                          }`}
                        >
                          <div className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                            msg.sender === 'agent'
                              ? 'bg-indigo-600 text-white rounded-tr-none shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                          }`}>
                            <p className="font-sans whitespace-pre-wrap">{msg.text}</p>
                          </div>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                            {msg.sender === 'customer' ? 'Simulated Customer' : 'Support Agent'} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>

                          {/* Analysis metadata of that customer turn */}
                          {msg.sender === 'customer' && (msg.intent || msg.coachingOutput) && (
                            <div className="mt-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-3 w-full text-[11px] space-y-2">
                              <div className="flex flex-wrap gap-1.5">
                                {msg.intent && (
                                  <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded font-bold text-[9px] uppercase">
                                    Intent: {msg.intent}
                                  </span>
                                )}
                                {msg.sentiment && (
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getSentimentStyles(msg.sentiment)}`}>
                                    Sentiment: {msg.sentiment}
                                  </span>
                                )}
                                {msg.emotionalState && (
                                  <span className="bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded text-[9px] border border-indigo-200 dark:border-indigo-800 font-bold uppercase">
                                    Mood: {msg.emotionalState}
                                  </span>
                                )}
                              </div>

                              {msg.coachingGuidance && (
                                <p className="text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/50 p-2 rounded-lg border border-amber-200/60 dark:border-amber-800/60 font-medium">
                                  💡 <strong>Coach Guidance:</strong> {msg.coachingGuidance}
                                </p>
                              )}

                              {msg.responseSuggestion && (
                                <p className="text-xs text-indigo-950 dark:text-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                  🤖 <strong>AI Suggested Response:</strong> "{msg.responseSuggestion}"
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <LifeBuoy className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                  <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm">No Session Selected</h4>
                  <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs mt-1">
                    Select a completed training log from the sidebar to review full chat transcripts and coaching analysis.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ACTIVE SIMULATION INTERACTION PORTAL: THREE-PANEL LIVE SUPPORT CONSOLE (50% / 30% / 20%) */}
        {activeSession && (
          <div id="simulation_portal" className="flex-1 grid grid-cols-1 lg:grid-cols-10 gap-4 lg:gap-4.5 min-h-0">
            {/* PANEL 1: Conversation Window (50% - 5 of 10 cols) */}
            <section id="chat_panel" className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs flex flex-col h-[740px] lg:h-[calc(100vh-130px)] overflow-hidden">
              {/* Active customer card header */}
              <div className="py-2 px-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={activeScenario?.customerProfile?.avatarUrl}
                    alt={activeScenario?.customerProfile?.name}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-slate-900 dark:text-white text-xs leading-none">{activeScenario?.customerProfile?.name}</h3>
                      <span className="text-[8px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-slate-700 dark:text-slate-300">
                        {interactionMode === 'manual' ? 'MANUAL' : interactionMode === 'replay' ? 'REPLAY' : 'SIMULATED'}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[170px] mt-0.5">
                      {replayScenarioTitle || activeScenario?.name || 'Customer Inquiry'}
                    </p>
                  </div>
                </div>

                {/* Simulated status badges */}
                <div className="flex items-center gap-2">
                  {latestCustomerMsg && (
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium hidden sm:inline-block">
                      Mood: <strong className="text-slate-800 dark:text-slate-200">{latestCustomerMsg.emotionalState || 'Active'}</strong>
                    </span>
                  )}
                  <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                    activeSession.status === 'resolved' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                    activeSession.status === 'escalated' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
                    'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 animate-pulse'
                  }`}>
                    {activeSession.status === 'resolved' ? '🟢 RESOLVED' :
                     activeSession.status === 'escalated' ? '⚠️ ESCALATED' :
                     '🔵 LIVE'}
                  </span>
                </div>
              </div>

              {/* High/Critical Escalation Risk Alert Banner */}
              {latestCustomerMsg?.escalationRiskOutput && 
               (latestCustomerMsg.escalationRiskOutput.risk_level === 'High' || latestCustomerMsg.escalationRiskOutput.risk_level === 'Critical') && (
                <div className="bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-800/80 p-2.5 flex items-start justify-between gap-2.5 text-rose-900 dark:text-rose-200 shadow-2xs">
                  <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-700">
                        ⚠️ {latestCustomerMsg.escalationRiskOutput.risk_level} Escalation Alert ({latestCustomerMsg.escalationRiskOutput.escalation_score}/100)
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-1 font-medium leading-tight">
                      {latestCustomerMsg.escalationRiskOutput.reasoning}
                    </p>
                  </div>
                </div>
              )}

              {/* Chat Message Window */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 bg-slate-50/50 dark:bg-slate-950/40">
                {messages.filter(Boolean).map((msg) => {
                  const isAgent = msg.sender === 'agent';
                  return (
                    <div
                      key={msg.id}
                      id={`chat_bubble_${msg.id}`}
                      className={`flex flex-col max-w-[85%] ${isAgent ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-2xs transition-all ${
                        isAgent
                          ? 'bg-indigo-600 text-white rounded-tr-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
                      }`}>
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1 px-1">
                        {isAgent ? 'You (Support Agent)' : activeScenario?.customerProfile?.name || 'Customer'} •{' '}
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Live Sentiment & Emotion Analysis on this message */}
                      {!isAgent && msg.sentiment && (
                        <div className="mt-1 flex flex-wrap gap-1 items-center">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${getSentimentStyles(msg.sentiment)}`}>
                            {msg.sentiment === 'Positive' ? <Smile className="h-2.5 w-2.5" /> :
                             msg.sentiment === 'Negative' ? <Frown className="h-2.5 w-2.5" /> :
                             <Meh className="h-2.5 w-2.5" />}
                            {msg.sentiment}
                          </span>
                          {msg.emotionalState && (
                            <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-150 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full">
                              {msg.emotionalState}
                            </span>
                          )}
                          {msg.frustrationLevel && (
                            <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border ${getFrustrationStyles(msg.frustrationLevel)}`}>
                              Frustration: {msg.frustrationLevel}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Simulated Customer Typing State */}
                {loading && (
                  <div className="flex flex-col items-start max-w-[85%]">
                    <div className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 p-3 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-700 shadow-2xs flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="h-1.5 w-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="h-1.5 w-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 italic font-mono">{loadingAction}</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Simulation Result Final Summaries */}
              {activeSession.status !== 'active' && (
                <div className="p-3.5 bg-slate-100 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-2.5">
                  {activeSession.status === 'resolved' ? (
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs bg-emerald-50 dark:bg-emerald-950/60 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      SIMULATION COMPLETE: Problem Successfully Resolved!
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs bg-rose-50 dark:bg-rose-950/60 px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800">
                      <ShieldAlert className="h-4 w-4" />
                      SIMULATION COMPLETE: Case Escalated to Supervisor
                    </div>
                  )}

                  {activeSession.summary && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 rounded-xl p-2.5 max-w-sm shadow-inner text-left font-mono">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-0.5 text-[9px]">Evaluation Summary:</h4>
                      <p className="leading-relaxed line-clamp-3">{activeSession.summary}</p>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenReportForSession(activeSession.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3.5 rounded-xl text-xs shadow-xs transition flex items-center gap-1 cursor-pointer"
                    >
                      <Award className="h-3.5 w-3.5" />
                      View QA Report
                    </button>
                    <button
                      id="btn_restart_simulation_done"
                      onClick={() => {
                        setActiveSession(null);
                        setMessages([]);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-xl text-xs shadow-xs transition cursor-pointer"
                    >
                      Exit to Catalog
                    </button>
                  </div>
                </div>
              )}

              {/* Goodwill & Compensation Quick Action Pills */}
              {activeSession.status === 'active' && interactionMode === 'simulator' && (
                <div className="px-3 py-1 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Gift className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    Offers:
                  </span>
                  <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                    <button
                      type="button"
                      onClick={() => setInputMessage("I am so sorry for the order delay! As a gesture of goodwill, I have generated a $15 discount coupon code (RESOLVE15) for your next order, and waived your shipping fee.")}
                      className="inline-flex items-center gap-1 text-[9px] font-semibold bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg shadow-2xs whitespace-nowrap transition cursor-pointer"
                    >
                      <Ticket className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
                      $15 Coupon
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMessage("I have processed a full $5.99 shipping fee refund to your original payment method due to the delay. The credit will reflect in 2-3 business days.")}
                      className="inline-flex items-center gap-1 text-[9px] font-semibold bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg shadow-2xs whitespace-nowrap transition cursor-pointer"
                    >
                      <Truck className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                      Shipping Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMessage("I understand your frustration with this issue. I can offer you an instant 50% store credit cashback ($15.00) credited directly to your account balance right now.")}
                      className="inline-flex items-center gap-1 text-[9px] font-semibold bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg shadow-2xs whitespace-nowrap transition cursor-pointer"
                    >
                      <Percent className="h-2.5 w-2.5 text-amber-600 dark:text-amber-400" />
                      50% Store Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => setInputMessage("I have placed a free priority express replacement order for you with expedited shipping. You will receive the new tracking number via email shortly.")}
                      className="inline-flex items-center gap-1 text-[9px] font-semibold bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-lg shadow-2xs whitespace-nowrap transition cursor-pointer"
                    >
                      <RotateCcw className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                      Free Replacement
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Mode: Option to paste next customer reply */}
              {activeSession.status === 'active' && interactionMode === 'manual' && (
                <div className="px-3 py-2 bg-emerald-50/70 dark:bg-emerald-950/40 border-t border-emerald-200 dark:border-emerald-800 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                      <MessageSquare className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                      Inject Customer Turn (Manual Mode)
                    </span>
                    <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-mono">4-agent live eval</span>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={manualCustomerInput}
                      onChange={(e) => setManualCustomerInput(e.target.value)}
                      placeholder="Type what customer replies next..."
                      className="flex-1 bg-white dark:bg-slate-800 border border-emerald-300 dark:border-emerald-700 rounded-xl px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-emerald-500/20 text-slate-800 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleSendManualCustomerTurn(manualCustomerInput)}
                      disabled={!manualCustomerInput.trim() || loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl disabled:opacity-50 transition cursor-pointer shadow-2xs"
                    >
                      Process Turn
                    </button>
                  </div>
                </div>
              )}

              {/* Replay Mode Step Controller */}
              {activeSession.status === 'active' && interactionMode === 'replay' && (
                <div className="p-2.5 bg-indigo-50/90 dark:bg-indigo-950/60 border-t border-indigo-150 dark:border-indigo-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase bg-indigo-600 text-white px-2 py-0.5 rounded font-mono">
                      Turn {replayTurnIndex + 1}/{replayTurns.length}
                    </span>
                    <span className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate max-w-[130px]">
                      {replayTurns[replayTurnIndex]?.text ? `"${replayTurns[replayTurnIndex].text.slice(0, 30)}..."` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleNextReplayTurn}
                      disabled={replayTurnIndex >= replayTurns.length - 1 || loading}
                      className="text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronRight className="h-3.5 w-3.5" />}
                      {replayTurnIndex >= replayTurns.length - 1 ? 'End' : 'Step Turn'}
                    </button>
                    <button
                      type="button"
                      id="btn_quit_replay_bar"
                      onClick={() => {
                        setActiveSession(null);
                        setMessages([]);
                        setInteractionMode('simulator');
                        setReplayTurns([]);
                        setReplayTurnIndex(0);
                      }}
                      className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 px-2.5 py-1.5 rounded-xl transition cursor-pointer"
                    >
                      Exit Replay
                    </button>
                  </div>
                </div>
              )}

              {/* Message Typing Form */}
              {activeSession.status === 'active' && (
                <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <form
                    id="chat_input_form"
                    onSubmit={handleSendMessage}
                    className="p-2.5 flex items-center gap-2"
                  >
                    <input
                      type="text"
                      id="agent_message_input"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder={
                        interactionMode === 'replay'
                          ? "Type message or step next replay turn..."
                          : "Type your reply to customer..."
                      }
                      disabled={loading}
                      className="flex-1 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-750 focus:bg-white dark:focus:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 outline-none transition disabled:opacity-75 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="submit"
                      id="btn_send_message"
                      disabled={!inputMessage.trim() || loading}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              )}
            </section>

            {/* PANEL 2: Real-time AI Coaching Feed (30% - 3 of 10 cols) */}
            <section id="coaching_panel" className="lg:col-span-3 flex flex-col gap-3.5 h-[740px] lg:h-[calc(100vh-130px)] overflow-y-auto pr-1 scrollbar-thin">
              {/* Escalation Risk Monitor Agent Card */}
              <EscalationRiskCard
                escalationRiskOutput={latestCustomerMsg?.escalationRiskOutput}
                frustrationScore={latestCustomerMsg?.frustrationScore}
                frustrationLevel={latestCustomerMsg?.frustrationLevel}
                onApplyAction={(actionText) => setInputMessage(actionText)}
              />

              {/* Card 1: AI Customer Analysis Gauges */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                    Live Customer Analysis
                  </h4>
                  <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded font-mono font-bold">Real-time</span>
                </div>

                {latestCustomerMsg ? (
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Intent Badge */}
                    <div className="col-span-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Detected Intent</p>
                        {latestCustomerMsg.satisfactionTrend && (
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            latestCustomerMsg.satisfactionTrend === 'Improving' ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' :
                            latestCustomerMsg.satisfactionTrend === 'Declining' ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                          }`}>
                            Trend: {latestCustomerMsg.satisfactionTrend}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1 leading-snug flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                        {latestCustomerMsg.intent || 'Analyzing Intent...'}
                      </p>
                    </div>

                    {/* Sentiment */}
                    <div className={`border rounded-xl p-2 ${getSentimentStyles(latestCustomerMsg.sentiment)}`}>
                      <p className="text-[9px] font-bold uppercase tracking-wider opacity-75">Sentiment</p>
                      <div className="flex items-center gap-1 mt-0.5 font-bold text-xs">
                        {latestCustomerMsg.sentiment === 'Positive' ? <Smile className="h-3.5 w-3.5" /> :
                         latestCustomerMsg.sentiment === 'Negative' ? <Frown className="h-3.5 w-3.5" /> :
                         <Meh className="h-3.5 w-3.5" />}
                        {latestCustomerMsg.sentiment}
                      </div>
                    </div>

                    {/* Emotional State */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2">
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">Emotion</p>
                      <div className="flex items-center gap-1 mt-0.5 font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                        <span className="text-sm leading-none">🎭</span>
                        {latestCustomerMsg.emotionalState}
                      </div>
                    </div>

                    {/* Frustration Level & Score */}
                    <div className={`border rounded-xl p-2 ${getFrustrationStyles(latestCustomerMsg.frustrationLevel)}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold uppercase tracking-wider opacity-75">Frustration</p>
                        <span className="text-[9px] font-extrabold font-mono">
                          {latestCustomerMsg.frustrationScore !== undefined ? `${latestCustomerMsg.frustrationScore}/100` : latestCustomerMsg.frustrationLevel}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 font-bold text-xs">
                        <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                        {latestCustomerMsg.frustrationLevel}
                      </div>
                      <div className="w-full bg-slate-200/60 dark:bg-slate-700 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (latestCustomerMsg.frustrationScore ?? 50) > 70 ? 'bg-rose-600' :
                            (latestCustomerMsg.frustrationScore ?? 50) > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, latestCustomerMsg.frustrationScore ?? (latestCustomerMsg.frustrationLevel === 'High' ? 85 : latestCustomerMsg.frustrationLevel === 'Medium' ? 50 : 15)))}%` }}
                        />
                      </div>
                    </div>

                    {/* Escalation Risk */}
                    <div className={`border rounded-xl p-2 ${getEscalationStyles(latestCustomerMsg.escalationRisk)}`}>
                      <p className="text-[9px] font-bold uppercase tracking-wider opacity-75">Risk Tier</p>
                      <div className="flex items-center gap-1 mt-0.5 font-bold text-xs">
                        <ShieldAlert className="h-3 w-3 flex-shrink-0" />
                        {latestCustomerMsg.escalationRisk}
                      </div>
                    </div>

                    {/* Agent Reasoning Explanation */}
                    {latestCustomerMsg.reasoningDetails && (
                      <div className="col-span-2 bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl p-2 text-[10px] space-y-1">
                        <p className="text-[9px] font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">Analysis Rationale</p>
                        <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-tight">
                          • <strong>Intent:</strong> {latestCustomerMsg.reasoningDetails.intent}
                        </p>
                        <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-tight">
                          • <strong>Frustration:</strong> {latestCustomerMsg.reasoningDetails.frustration} {latestCustomerMsg.reasoningDetails.trend}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-xs italic flex flex-col items-center justify-center gap-1">
                    <Info className="h-4 w-4 text-slate-300 dark:text-slate-600" />
                    Waiting for initial customer state data...
                  </div>
                )}
              </div>

              {/* Card 2: AI Action Advice & Coaching Guidance */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
                    <LifeBuoy className="h-3.5 w-3.5 text-amber-500" />
                    Coaching & Guidance Agent
                  </h4>
                  <span className="text-[9px] bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded font-mono font-bold">
                    Pedagogical
                  </span>
                </div>

                {latestCustomerMsg && (latestCustomerMsg.coachingOutput || latestCustomerMsg.coachingGuidance) ? (
                  <div className="space-y-2">
                    {latestCustomerMsg.coachingOutput?.coaching_tips && latestCustomerMsg.coachingOutput.coaching_tips.length > 0 ? (
                      <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-xl p-2.5 flex flex-col gap-1.5">
                        <p className="text-[9px] text-amber-900 dark:text-amber-300 font-extrabold uppercase tracking-wider flex items-center gap-1">
                          <span>💡</span> Action Coaching Tips:
                        </p>
                        <ul className="space-y-1 pl-1">
                          {latestCustomerMsg.coachingOutput.coaching_tips.map((tip, idx) => (
                            <li key={idx} className="text-[11px] text-amber-950 dark:text-amber-200 font-medium flex items-start gap-1.5 leading-snug">
                              <span className="text-amber-600 font-bold">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                        {latestCustomerMsg.coachingOutput.reasoning && (
                          <p className="text-[10px] text-amber-800 dark:text-amber-300 italic mt-0.5 bg-amber-100/50 dark:bg-amber-900/40 p-1.5 rounded-lg font-sans border border-amber-200/50 dark:border-amber-800/50">
                            <strong>Strategy:</strong> {latestCustomerMsg.coachingOutput.reasoning}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/60 rounded-xl p-2.5 flex gap-2">
                        <div className="bg-amber-500 text-white rounded-full p-1 h-6 w-6 flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono">
                          💡
                        </div>
                        <div>
                          <p className="text-[9px] text-amber-800 dark:text-amber-300 font-bold uppercase">Training Instruction:</p>
                          <p className="text-[11px] text-amber-950 dark:text-amber-200 mt-0.5 font-mono leading-relaxed">
                            {latestCustomerMsg.coachingGuidance}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-3 text-slate-400 dark:text-slate-500 text-xs italic">
                    Coaching guidance updates dynamically after each turn.
                  </div>
                )}
              </div>

              {/* Card 3: AI Suggested Response & Quality Evaluation */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs p-3.5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs tracking-wider uppercase flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                    AI Suggested Response & Quality
                  </h4>
                  <span className="text-[9px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded font-mono font-bold">
                    Copilot
                  </span>
                </div>

                {latestCustomerMsg && (latestCustomerMsg.coachingOutput || latestCustomerMsg.responseSuggestion) ? (
                  <div className="flex flex-col gap-2.5">
                    {/* Primary Suggested Response Box */}
                    <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 shadow-inner">
                      <p className="text-[11px] text-slate-800 dark:text-slate-100 leading-relaxed font-sans whitespace-pre-wrap font-medium">
                        "{latestCustomerMsg.coachingOutput?.suggested_response || latestCustomerMsg.responseSuggestion}"
                      </p>
                    </div>

                    {/* Response Quality Scores Breakdown */}
                    {latestCustomerMsg.coachingOutput?.response_quality && (
                      <div className="bg-indigo-50/40 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800 rounded-xl p-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-extrabold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                            Quality Evaluation (7-D Score)
                          </span>
                          <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded">
                            Avg {Math.round(
                              Object.values(latestCustomerMsg.coachingOutput.response_quality).reduce((a, b) => a + b, 0) / 7
                            )}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2.5 gap-y-1 text-[9px]">
                          {Object.entries(latestCustomerMsg.coachingOutput.response_quality).map(([dim, score]) => (
                            <div key={dim} className="flex flex-col gap-0.5">
                              <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400 font-semibold capitalize">
                                <span className="truncate">{dim}</span>
                                <span className="font-mono text-indigo-950 dark:text-indigo-200 font-bold">{score}</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${score >= 90 ? 'bg-emerald-500' : score >= 75 ? 'bg-indigo-500' : 'bg-amber-500'}`}
                                  style={{ width: `${score}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Tone Variations */}
                    {latestCustomerMsg.coachingOutput?.alternative_responses && (
                      <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5">
                        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tone Variations (Click to Select):</span>
                        <div className="grid grid-cols-1 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInputMessage(latestCustomerMsg.coachingOutput?.alternative_responses.formal || '')}
                            className="text-left bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:border-indigo-500 dark:active:border-indigo-400 rounded-lg p-2 text-[10px] text-slate-800 dark:text-slate-100 transition cursor-pointer shadow-2xs group"
                          >
                            <span className="font-extrabold text-indigo-600 dark:text-indigo-400 block text-[9px] uppercase tracking-wider">🏛️ Formal Tone:</span>
                            <span className="line-clamp-2 text-[10px] text-slate-600 dark:text-slate-300 mt-0.5 group-hover:text-slate-900 dark:group-hover:text-white">
                              "{latestCustomerMsg.coachingOutput.alternative_responses.formal}"
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setInputMessage(latestCustomerMsg.coachingOutput?.alternative_responses.empathetic || '')}
                            className="text-left bg-white dark:bg-slate-800 hover:bg-pink-50/50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:border-pink-500 dark:active:border-pink-400 rounded-lg p-2 text-[10px] text-slate-800 dark:text-slate-100 transition cursor-pointer shadow-2xs group"
                          >
                            <span className="font-extrabold text-pink-600 dark:text-pink-400 block text-[9px] uppercase tracking-wider">❤️ Empathetic Tone:</span>
                            <span className="line-clamp-2 text-[10px] text-slate-600 dark:text-slate-300 mt-0.5 group-hover:text-slate-900 dark:group-hover:text-white">
                              "{latestCustomerMsg.coachingOutput.alternative_responses.empathetic}"
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    {activeSession.status === 'active' && (
                      <div className="flex items-center gap-1.5 pt-0.5">
                        <button
                          id="btn_use_suggestion"
                          onClick={() => useSuggestion(latestCustomerMsg.coachingOutput?.suggested_response || latestCustomerMsg.responseSuggestion || '')}
                          className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 transition border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          <Copy className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                          Insert
                        </button>
                        <button
                          id="btn_send_suggestion_now"
                          onClick={() => handleSendSpecificMessage(latestCustomerMsg.coachingOutput?.suggested_response || latestCustomerMsg.responseSuggestion || '')}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-2 rounded-xl text-[11px] flex items-center justify-center gap-1 transition shadow-2xs cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          Send Now
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-xs italic">
                    AI suggestions will formulate with knowledge grounded replies.
                  </div>
                )}
              </div>
            </section>

            {/* PANEL 3: Knowledge Recommendation Panel (20% - 2 of 10 cols) */}
            <section id="knowledge_panel" className="lg:col-span-2 flex flex-col gap-3.5 h-[740px] lg:h-[calc(100vh-130px)] overflow-y-auto pr-1 scrollbar-thin">
              <KnowledgeRecommendationsCard
                recommendations={latestCustomerMsg?.knowledgeRecommendations}
                relevantArticles={latestCustomerMsg?.relevantArticles}
                relevantKnowledge={latestCustomerMsg?.relevantKnowledge}
                activeSessionStatus={activeSession.status}
                onInsertPolicy={(policyText) => setInputMessage(policyText)}
                onOpenIngestionModal={() => setKbModalOpen(true)}
              />
            </section>
          </div>
        )}
      </main>

      {/* Knowledge Base Ingestion & Chunking Modal */}
      <KnowledgeIngestionModal
        isOpen={kbModalOpen}
        onClose={() => setKbModalOpen(false)}
      />

      {/* Replay Mode Modal */}
      <ReplayModeModal
        isOpen={replayModalOpen}
        onClose={() => setReplayModalOpen(false)}
        onStartReplay={handleStartReplaySession}
      />

      {/* Post-Interaction Report Modal */}
      <PostInteractionReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        report={activeReport}
        onOpenAnalytics={() => {
          setViewAnalyticsMode(true);
          setViewHistoryMode(false);
        }}
        onStartNewSession={() => {
          setActiveSession(null);
          setMessages([]);
          setViewAnalyticsMode(false);
        }}
      />
    </div>
  );
}
