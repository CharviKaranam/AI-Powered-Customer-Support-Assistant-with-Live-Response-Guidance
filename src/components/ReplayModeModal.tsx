import React, { useState } from 'react';
import { Play, RotateCcw, Upload, FileText, CheckCircle2, ChevronRight, X, Sparkles, BrainCircuit } from 'lucide-react';

interface ReplayTurn {
  sender: 'customer' | 'agent';
  text: string;
}

interface ReplayModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartReplay: (turns: ReplayTurn[], scenarioTitle: string) => void;
}

const PRESET_TRANSCRIPTS = [
  {
    id: 'delayed_order',
    title: 'Delayed Order & Escalation Threat',
    description: 'Customer order #94820 is 5 days late with no tracking update. Threatens BBB review.',
    turns: [
      { sender: 'customer', text: 'Where is my order #94820? It was supposed to be delivered 5 days ago and the tracking has not updated since last week!' },
      { sender: 'agent', text: 'Hello! I am very sorry for the delay with order #94820. Let me check the carrier details right now.' },
      { sender: 'customer', text: 'Checking is not enough! This was a gift for my daughter\'s birthday tomorrow. If this isn\'t resolved immediately, I will file a complaint with the BBB and request a full chargeback!' },
      { sender: 'agent', text: 'I completely understand your frustration. I am calling our courier logistics desk directly to issue a priority rush re-dispatch.' },
      { sender: 'customer', text: 'Okay, please guarantee it will arrive tomorrow or refund my money right now.' }
    ]
  },
  {
    id: 'refund_denied',
    title: 'Return Policy Dispute & Manager Request',
    description: 'Customer missed 30-day return window by 2 days due to hospitalization.',
    turns: [
      { sender: 'customer', text: 'I tried to submit a return for item #TR-402 online, but the system says my 30-day window expired 2 days ago. I was in the hospital!' },
      { sender: 'agent', text: 'Thank you for reaching out. I hope you are feeling better now. Our standard policy requires returns within 30 days.' },
      { sender: 'customer', text: 'Are you serious? I was literally in intensive care! I demand to speak to a supervisor right now. Your policy is completely heartless!' },
      { sender: 'agent', text: 'I sincerely apologize. Given your medical emergency, I will make an explicit supervisor exception and email you a pre-paid return label immediately.' },
      { sender: 'customer', text: 'Thank you so much, I really appreciate you understanding my situation.' }
    ]
  },
  {
    id: 'wrong_item',
    title: 'Wrong Item Delivered & Goodwill Refund',
    description: 'Customer received incorrect size and damaged box.',
    turns: [
      { sender: 'customer', text: 'I received package #88392 today, but you sent me size Small instead of Large, and the box was crushed.' },
      { sender: 'agent', text: 'Oh no! I am so sorry for sending the incorrect size. I will get this fixed right away.' },
      { sender: 'customer', text: 'I need the correct item before Friday because I am leaving on a business trip.' }
    ]
  }
];

export const ReplayModeModal: React.FC<ReplayModeModalProps> = ({
  isOpen,
  onClose,
  onStartReplay
}) => {
  const [pastedJson, setPastedJson] = useState<string>('');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('delayed_order');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLaunchPreset = () => {
    const preset = PRESET_TRANSCRIPTS.find(p => p.id === selectedPresetId);
    if (preset) {
      onStartReplay(preset.turns as ReplayTurn[], preset.title);
      onClose();
    }
  };

  const handleLaunchCustomJson = () => {
    setError(null);
    const raw = pastedJson.trim();
    if (!raw) {
      setError('Please paste or upload a transcript first.');
      return;
    }

    try {
      let turns: ReplayTurn[] = [];

      // Try parsing as JSON first
      if (raw.startsWith('[') || raw.startsWith('{')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            turns = parsed.map(item => ({
              sender: (item.sender === 'agent' || item.role === 'agent' || item.role === 'assistant' ? 'agent' : 'customer') as 'customer' | 'agent',
              text: item.text || item.content || item.message || ''
            })).filter(t => t.text.trim().length > 0);
          } else if (parsed.messages && Array.isArray(parsed.messages)) {
            turns = parsed.messages.map((item: any) => ({
              sender: (item.sender === 'agent' || item.role === 'agent' || item.role === 'assistant' ? 'agent' : 'customer') as 'customer' | 'agent',
              text: item.text || item.content || item.message || ''
            })).filter((t: any) => t.text.trim().length > 0);
          }
        } catch (e) {
          // If JSON parse fails, fall through to text parsing
        }
      }

      // If no turns found via JSON, parse as line-by-line dialogue
      if (turns.length === 0) {
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        for (const line of lines) {
          const lower = line.toLowerCase();
          if (lower.startsWith('agent:') || lower.startsWith('support:') || lower.startsWith('rep:') || lower.startsWith('assistant:')) {
            const text = line.substring(line.indexOf(':') + 1).trim();
            if (text) turns.push({ sender: 'agent', text });
          } else if (lower.startsWith('customer:') || lower.startsWith('user:') || lower.startsWith('client:') || lower.startsWith('caller:')) {
            const text = line.substring(line.indexOf(':') + 1).trim();
            if (text) turns.push({ sender: 'customer', text });
          } else if (line.length > 0) {
            // Default alternating or assign customer first
            const sender = turns.length % 2 === 0 ? 'customer' : 'agent';
            turns.push({ sender, text: line });
          }
        }
      }

      if (turns.length === 0) {
        throw new Error('No valid message turns found. Format with "Customer: ..." and "Agent: ..." lines or JSON array.');
      }

      onStartReplay(turns, 'Custom Replay Session');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Invalid transcript format. Please verify formatting.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setPastedJson(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 text-white p-2.5 rounded-xl">
              <RotateCcw className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                Replay Interaction Mode
                <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-2.5 py-0.5 rounded-full border border-indigo-400/30 uppercase font-mono">
                  Milestone 5
                </span>
              </h3>
              <p className="text-xs text-slate-300">Replay historic or sample customer transcripts turn-by-turn through the AI Coaching engine.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-900">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 p-3 rounded-xl text-xs font-medium">
              ⚠️ {error}
            </div>
          )}

          {/* Option A: Select Preset Transcript */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              1. Select Sample Replay Scenario Preset
            </h4>
            <div className="grid grid-cols-1 gap-3">
              {PRESET_TRANSCRIPTS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => setSelectedPresetId(preset.id)}
                  className={`p-4 rounded-2xl border text-left cursor-pointer transition flex items-start justify-between gap-3 ${
                    selectedPresetId === preset.id
                      ? 'border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/70 ring-2 ring-indigo-600/20 dark:ring-indigo-400/40 shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{preset.title}</h5>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{preset.description}</p>
                    <span className="inline-block text-[10px] font-mono font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded mt-1 border border-slate-200 dark:border-slate-600">
                      {preset.turns.length} Turn Conversation
                    </span>
                  </div>
                  {selectedPresetId === preset.id && (
                    <CheckCircle2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleLaunchPreset}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer"
            >
              <Play className="h-4 w-4" />
              Launch Selected Replay Preset
            </button>
          </div>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-400 dark:text-slate-500 font-bold">Or Upload Custom Transcript</span>
            </div>
          </div>

          {/* Option B: Upload / Paste Custom Transcript JSON */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                2. Paste or Upload Transcript JSON
              </h4>
              <label className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 cursor-pointer flex items-center gap-1">
                <Upload className="h-3 w-3" />
                Browse JSON File
                <input type="file" accept=".json,.txt" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>

            <textarea
              value={pastedJson}
              onChange={(e) => setPastedJson(e.target.value)}
              placeholder='Paste JSON transcript array here, e.g. [{"sender": "customer", "text": "Where is my package?"}, {"sender": "agent", "text": "Let me check..."}]'
              rows={4}
              className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs font-mono focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none"
            />

            <button
              onClick={handleLaunchCustomJson}
              disabled={!pastedJson.trim()}
              className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition flex items-center justify-center gap-2 text-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer border border-slate-800 dark:border-slate-700"
            >
              <BrainCircuit className="h-4 w-4 text-indigo-400" />
              Launch Custom JSON Replay
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
