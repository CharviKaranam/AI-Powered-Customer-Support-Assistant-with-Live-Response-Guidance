import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Plus, 
  X, 
  UploadCloud, 
  CheckCircle2, 
  FileText, 
  Sparkles, 
  RefreshCw, 
  Layers, 
  Search, 
  Trash2, 
  Package, 
  Cpu, 
  ShieldAlert, 
  CreditCard, 
  HelpCircle, 
  Sliders, 
  Check, 
  ExternalLink,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { INITIAL_KNOWLEDGE_BASE, PRESET_KNOWLEDGE_PACKS, chunkArticle } from '../rag/kb.js';

interface KnowledgeIngestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onArticleAdded?: () => void;
}

export const KnowledgeIngestionModal: React.FC<KnowledgeIngestionModalProps> = ({
  isOpen,
  onClose,
  onArticleAdded
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'packs' | 'explorer' | 'simulator'>('upload');
  const [articles, setArticles] = useState<any[]>(() => 
    INITIAL_KNOWLEDGE_BASE.map(a => ({ ...a, chunkCount: chunkArticle(a).length }))
  );
  const [packs, setPacks] = useState<any[]>(() => PRESET_KNOWLEDGE_PACKS);
  const [loading, setLoading] = useState<boolean>(false);
  const [ingesting, setIngesting] = useState<boolean>(false);
  const [loadingPackId, setLoadingPackId] = useState<string | null>(null);
  const [resetting, setResetting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form states
  const [title, setTitle] = useState<string>('');
  const [category, setCategory] = useState<string>('refund_request');
  const [authorityLevel, setAuthorityLevel] = useState<string>('Tier 1 Frontline Support');
  const [maxCompensation, setMaxCompensation] = useState<string>('$50 Goodwill Credit / Full Product Exchange');
  const [applicableProducts, setApplicableProducts] = useState<string>('All Storefront Products');
  const [tags, setTags] = useState<string>('refund, policy, compensation');
  const [content, setContent] = useState<string>('');
  const [steps, setSteps] = useState<string>('');

  // Explorer states
  const [explorerSearch, setExplorerSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(null);

  // Simulator states
  const [testQuery, setTestQuery] = useState<string>('My package was delivered to the wrong address and I need a replacement right away');
  const [testCategory, setTestCategory] = useState<string>('');
  const [simulating, setSimulating] = useState<boolean>(false);
  const [simResults, setSimResults] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadArticles();
      loadPacks();
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const loadArticles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/knowledge/articles');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setArticles(data);
        }
      }
    } catch {
      // Use pre-populated articles on network/parse error
    } finally {
      setLoading(false);
    }
  };

  const loadPacks = async () => {
    try {
      const res = await fetch('/api/knowledge/packs');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setPacks(data);
        }
      }
    } catch {
      // Use pre-populated packs on network/parse error
    }
  };

  const handleIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    setIngesting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    const stepsArray = steps
      .split('\n')
      .map(s => s.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean);

    const tagsArray = tags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const productsArray = applicableProducts
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    try {
      const res = await fetch('/api/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          category,
          authorityLevel,
          maxCompensation,
          applicableProducts: productsArray,
          tags: tagsArray,
          content,
          steps: stepsArray
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Ingestion failed');
      }

      const data = await res.json();
      setSuccessMessage(`Document "${title}" ingested, chunked (${data.chunksIndexed} chunks), and indexed into RAG vector store!`);
      setTitle('');
      setContent('');
      setSteps('');
      loadArticles();
      if (onArticleAdded) onArticleAdded();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to ingest knowledge article');
    } finally {
      setIngesting(false);
    }
  };

  const handleLoadPack = async (packId: string) => {
    setLoadingPackId(packId);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/knowledge/load-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to load pack');
      }
      const data = await res.json();
      setSuccessMessage(data.message || 'Knowledge pack successfully ingested and indexed!');
      loadArticles();
      if (onArticleAdded) onArticleAdded();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load knowledge pack');
    } finally {
      setLoadingPackId(null);
    }
  };

  const handleDeleteArticle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete article ${id} from Knowledge Base & RAG Index?`)) return;
    try {
      const res = await fetch(`/api/knowledge/articles/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMessage(`Article ${id} deleted successfully.`);
        loadArticles();
        if (onArticleAdded) onArticleAdded();
      }
    } catch (err) {
      console.error('Delete article failed', err);
    }
  };

  const handleResetKB = async () => {
    if (!window.confirm('Reset Knowledge Base to the official default Enterprise Support Dataset?')) return;
    setResetting(true);
    try {
      const res = await fetch('/api/knowledge/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSuccessMessage(data.message || 'Knowledge base reset to defaults.');
        loadArticles();
        if (onArticleAdded) onArticleAdded();
      }
    } catch (err) {
      console.error('Reset KB failed', err);
    } finally {
      setResetting(false);
    }
  };

  const handleRunRAGSimulator = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!testQuery.trim()) return;

    setSimulating(true);
    setSimResults(null);
    try {
      const res = await fetch('/api/knowledge/test-rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: testQuery,
          category: testCategory || undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSimResults(data);
      }
    } catch (err) {
      console.error('Simulator query failed', err);
    } finally {
      setSimulating(false);
    }
  };

  const handleQuickTemplate = (templateType: string) => {
    if (templateType === 'damaged_item') {
      setTitle('Damaged Goods Replacement & Immediate Reshipment Policy');
      setCategory('refund_request');
      setAuthorityLevel('Tier 1 Frontline Support');
      setMaxCompensation('Immediate replacement or $150 store credit');
      setApplicableProducts('Electronics, Perishables, Standard Goods');
      setTags('damaged, replacement, photo verification, courier claim');
      setContent('When items arrive damaged in transit or defective out of the box, customers are eligible for an immediate priority replacement with zero return shipping required for items under $200. Customers must submit a photo of the damaged carton and item barcode within 14 days of carrier drop-off.');
      setSteps('1. Ask customer for a clear photo of the damaged package and item condition\n2. Verify order number and confirm carrier delivery timestamp\n3. Issue zero-cost replacement order with Next-Day Air shipping\n4. Submit automated carrier insurance transit damage claim');
    } else if (templateType === 'subscription') {
      setTitle('Subscription Cancellation, Grace Period & Proration SOP');
      setCategory('billing_issue');
      setAuthorityLevel('Tier 1 Frontline Support');
      setMaxCompensation('100% full refund within 72 hours, prorated otherwise');
      setApplicableProducts('Pro SaaS, Enterprise Cloud, ResolveAI Annual');
      setTags('subscription, cancellation, billing, stripe, proration');
      setContent('Customers may cancel recurring subscription plans at any time directly through self-service or via support. If cancellation is requested within 72 hours of an automated billing charge, issue a 100% full refund immediately without penalty. Outside 72 hours, compute daily prorated credit.');
      setSteps('1. Look up customer subscription in Stripe/Billing Console\n2. Verify charge date and billing interval\n3. If within 72h window, click "Cancel & Full Refund"\n4. If outside window, apply prorated credit to account balance and cancel at period end');
    } else if (templateType === 'price_match') {
      setTitle('Price Match Guarantee & Competitor Discount Adjustment');
      setCategory('general_support');
      setAuthorityLevel('Tier 2 Senior Specialist');
      setMaxCompensation('Up to $100 price difference refund per order');
      setApplicableProducts('Smart Tech, Audio Gear, Accessories');
      setTags('price match, discount, competitor, adjustment, sales');
      setContent('We match lower advertised prices from authorized retailers (Amazon, Best Buy, Target) within 14 days of purchase. Item must be the identical model, color, and in-stock condition. Price match does not apply to marketplace third-party sellers, clearance, or flash sales.');
      setSteps('1. Request URL link or circular ad showing active competitor price\n2. Verify item model number and authorized retailer status\n3. Calculate net price difference\n4. Apply post-purchase partial refund back to original payment method');
    } else if (templateType === '2fa_reset') {
      setTitle('Two-Factor Authentication (2FA) Emergency Account Recovery');
      setCategory('account_access');
      setAuthorityLevel('Tier 2 Security & Compliance Specialist');
      setMaxCompensation('N/A (Security Protocol)');
      setApplicableProducts('All User Accounts, SSO, Dashboard');
      setTags('2fa, account recovery, security, verification, identity');
      setContent('When a customer loses access to their authenticator app or backup security codes, frontline agents must enforce strict identity verification before initiating a 2FA reset to protect customer data from SIM-swap and account takeover attacks.');
      setSteps('1. Confirm registered billing address, last 4 digits of payment card, and account creation date\n2. Send high-entropy one-time SMS/Email challenge code and confirm match\n3. Require government photo ID verification upload if suspicious IP location detected\n4. Issue 2FA bypass token valid for 30 minutes and require immediate password reset');
    }
  };

  const filteredArticles = articles.filter(art => {
    const matchesCat = selectedCategoryFilter === 'all' || art.category === selectedCategoryFilter;
    const matchesSearch = !explorerSearch.trim() || 
      art.title.toLowerCase().includes(explorerSearch.toLowerCase()) ||
      art.content.toLowerCase().includes(explorerSearch.toLowerCase()) ||
      (art.tags && art.tags.some((t: string) => t.toLowerCase().includes(explorerSearch.toLowerCase())));
    return matchesCat && matchesSearch;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl my-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30 shadow-inner">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Enterprise Knowledge Base & Real RAG Engine</h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Hybrid RAG Active
                </span>
              </div>
              <p className="text-xs text-slate-400">Ingest, chunk, vectorize, and semantically retrieve policy SOPs with dense & sparse indexing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 bg-slate-100/80 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'upload'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Ingest & Chunk Document
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('packs')}
            className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'packs'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Package className="w-4 h-4" />
            Curated Knowledge Packs
            <span className="text-[9px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.2 rounded-full font-bold">4 Packs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('explorer')}
            className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'explorer'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            Vector Index Explorer ({articles.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('simulator')}
            className={`px-4 py-2.5 rounded-t-xl transition flex items-center gap-2 cursor-pointer border-t-2 ${
              activeTab === 'simulator'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 border-indigo-600 font-bold shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border-transparent hover:bg-slate-200/50 dark:hover:bg-slate-800/50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            RAG Retrieval Simulator
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950/50">
          {successMessage && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
              <button onClick={() => setSuccessMessage(null)} className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 rounded-xl flex items-center justify-between text-xs font-semibold shadow-xs">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-700 dark:text-rose-400 hover:text-rose-900 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: UPLOAD & INGEST FORM */}
          {activeTab === 'upload' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                      <UploadCloud className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      Document Ingestion Pipeline
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Automatically parses, chunks, and creates vector embeddings</p>
                  </div>
                  
                  {/* Quick Templates */}
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium self-center mr-1">Quick SOP:</span>
                    <button
                      type="button"
                      onClick={() => handleQuickTemplate('damaged_item')}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 font-semibold px-2 py-1 rounded-lg cursor-pointer transition border border-slate-200/70 dark:border-slate-700"
                    >
                      Damaged Item
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickTemplate('subscription')}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 font-semibold px-2 py-1 rounded-lg cursor-pointer transition border border-slate-200/70 dark:border-slate-700"
                    >
                      Subscription Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickTemplate('price_match')}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 font-semibold px-2 py-1 rounded-lg cursor-pointer transition border border-slate-200/70 dark:border-slate-700"
                    >
                      Price Match
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickTemplate('2fa_reset')}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-300 font-semibold px-2 py-1 rounded-lg cursor-pointer transition border border-slate-200/70 dark:border-slate-700"
                    >
                      2FA Recovery
                    </button>
                  </div>
                </div>

                <form onSubmit={handleIngest} className="space-y-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Article Title / Standard Operating Procedure</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Return Policy for Damaged Electronics"
                        required
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Category / Domain Taxonomy</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      >
                        <option value="refund_request">Returns, Refunds & Exchanges</option>
                        <option value="delayed_order">Shipping, Logistics & Delivery</option>
                        <option value="billing_issue">Billing, Invoicing & Subscriptions</option>
                        <option value="product_troubleshoot">Hardware, IoT & Firmware Diagnostics</option>
                        <option value="account_access">Security, 2FA & Authentication</option>
                        <option value="general_support">General Support & Corporate Policies</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Agent Authority Level</label>
                      <input
                        type="text"
                        value={authorityLevel}
                        onChange={(e) => setAuthorityLevel(e.target.value)}
                        placeholder="e.g. Tier 1 Frontline Support"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Max Authorized Compensation</label>
                      <input
                        type="text"
                        value={maxCompensation}
                        onChange={(e) => setMaxCompensation(e.target.value)}
                        placeholder="e.g. $50 Goodwill Credit / Free Return"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Applicable Products (Comma separated)</label>
                      <input
                        type="text"
                        value={applicableProducts}
                        onChange={(e) => setApplicableProducts(e.target.value)}
                        placeholder="e.g. Audio Pro 4, Lumina Lamp, All Storefront"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Tags / Dense Semantic Keywords</label>
                      <input
                        type="text"
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="e.g. refund, damaged, expedited, replacement"
                        className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Full Policy Content / Context Guidelines</label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      rows={4}
                      placeholder="Paste authoritative policy terms, legal boundaries, exceptions, and eligibility rules..."
                      required
                      className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Procedural SOP Execution Steps (One per line)</label>
                    <textarea
                      value={steps}
                      onChange={(e) => setSteps(e.target.value)}
                      rows={3}
                      placeholder="1. Verify customer identity and order number&#10;2. Check carrier tracking status&#10;3. Authorize replacement with zero-dollar invoice"
                      className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 leading-relaxed font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={ingesting || !title.trim() || !content.trim()}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {ingesting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Generating Semantic Embeddings & Indexing Chunks...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Ingest & Vector Index Into Hybrid RAG Store
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right: RAG Stats & Architecture summary */}
              <div className="lg:col-span-4 space-y-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                  <h4 className="text-xs font-extrabold uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                    <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    RAG Architecture Specs
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-750 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Embedding Model</span>
                      <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100 bg-slate-200/70 dark:bg-slate-700 px-1.5 py-0.5 rounded">text-embedding-004</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-750 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Vector Dimension</span>
                      <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">768-D Float Vector</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-750 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Hybrid Scoring Ratio</span>
                      <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">60% Dense + 30% BM25 + 10% Cat</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-750 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Chunking Strategy</span>
                      <span className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Header + Steps + Policy Blocks</span>
                    </div>

                    <div className="p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-750 flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300 font-medium">Storage Engine</span>
                      <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">SQLite + In-Memory Index</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-5 rounded-2xl text-white shadow-md space-y-3 border border-indigo-800">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Real-Time Ingestion</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Ingested documents become immediately searchable in live simulations and manual replay mode. The live coaching agent pulls relevant excerpts to verify policy compliance and offer actionable suggestions.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('simulator')}
                    className="w-full py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/10 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    Test RAG Search With Live Queries
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CURATED KNOWLEDGE PACKS */}
          {activeTab === 'packs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">Pre-Curated Enterprise Support Knowledge Packs</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Inject high-quality, domain-specific SOP policies with granular steps and resolution limits in one click</p>
                </div>
                <button
                  type="button"
                  onClick={handleResetKB}
                  disabled={resetting}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 hover:text-rose-700 dark:hover:text-rose-300 text-slate-600 dark:text-slate-300 font-semibold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
                  Reset to Base Enterprise Dataset
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packs.map((pack) => {
                  const isAlreadyLoaded = pack.articles.every((art: any) => 
                    articles.some((a: any) => a.id === art.id)
                  );
                  const isLoadingThis = loadingPackId === pack.id;

                  return (
                    <div 
                      key={pack.id} 
                      className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded uppercase">
                              {pack.domain}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{pack.name}</h4>
                          </div>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                            {pack.articles.length} SOPs
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                          {pack.description}
                        </p>

                        <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Included SOP Articles:</span>
                          <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                            {pack.articles.map((art: any) => (
                              <li key={art.id} className="flex items-center gap-1.5 text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">{art.title}</span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500">({art.authorityLevel})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoadPack(pack.id)}
                        disabled={isLoadingThis || isAlreadyLoaded}
                        className={`w-full py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
                          isAlreadyLoaded
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 cursor-default'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                        }`}
                      >
                        {isLoadingThis ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Ingesting & Vectorizing Pack...
                          </>
                        ) : isAlreadyLoaded ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Pack Ingested & Active in Vector Store
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Ingest This Knowledge Pack ({pack.articles.length} Articles)
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: VECTOR INDEX EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="space-y-4">
              {/* Filter and Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={explorerSearch}
                    onChange={(e) => setExplorerSearch(e.target.value)}
                    placeholder="Search articles, tags, or contents..."
                    className="w-full bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 font-semibold focus:outline-none"
                  >
                    <option value="all">All Categories ({articles.length})</option>
                    <option value="refund_request">Refunds & Returns</option>
                    <option value="delayed_order">Shipping Logistics</option>
                    <option value="billing_issue">Billing & Charges</option>
                    <option value="product_troubleshoot">Troubleshooting</option>
                    <option value="account_access">Account & Security</option>
                    <option value="general_support">General Support</option>
                  </select>

                  <button
                    type="button"
                    onClick={loadArticles}
                    className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl transition cursor-pointer"
                    title="Refresh Vector Store"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Articles Grid */}
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-600" />
                  Loading RAG Vector Database...
                </div>
              ) : filteredArticles.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  No knowledge articles match your search filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredArticles.map((art) => {
                    const isExpanded = expandedArticleId === art.id;

                    return (
                      <div
                        key={art.id}
                        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition overflow-hidden"
                      >
                        <div
                          onClick={() => setExpandedArticleId(isExpanded ? null : art.id)}
                          className="p-4 flex items-center justify-between cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/40"
                        >
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900 dark:text-white">{art.title}</span>
                                <span className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                  {art.id}
                                </span>
                                {art.authorityLevel && (
                                  <span className="text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                                    {art.authorityLevel}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">{art.content}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                              {art.chunkCount || 3} Vector Chunks
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteArticle(art.id, e)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition cursor-pointer"
                              title="Delete from RAG Store"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 space-y-3.5 text-xs">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Full Policy Text</span>
                              <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed bg-white dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-750 text-[11px] font-mono whitespace-pre-wrap">
                                {art.content}
                              </p>
                            </div>

                            {art.steps && art.steps.length > 0 && (
                              <div>
                                <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Procedural SOP Execution Steps</span>
                                <div className="mt-1 space-y-1.5 bg-white dark:bg-slate-850 p-3 rounded-xl border border-slate-200 dark:border-slate-750">
                                  {art.steps.map((st: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-2 text-[11px] text-slate-800 dark:text-slate-200 font-medium">
                                      <span className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                                        {idx + 1}
                                      </span>
                                      <span>{st}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                              {art.maxCompensation && (
                                <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-750">
                                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Max Compensation:</span>
                                  <div className="font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">{art.maxCompensation}</div>
                                </div>
                              )}
                              {art.applicableProducts && (
                                <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-750">
                                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Products:</span>
                                  <div className="font-semibold text-slate-700 dark:text-slate-300 mt-0.5">{Array.isArray(art.applicableProducts) ? art.applicableProducts.join(', ') : art.applicableProducts}</div>
                                </div>
                              )}
                              {art.tags && (
                                <div className="bg-white dark:bg-slate-850 p-2.5 rounded-xl border border-slate-200 dark:border-slate-750">
                                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Indexed Tags:</span>
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {(Array.isArray(art.tags) ? art.tags : []).map((t: string, i: number) => (
                                      <span key={i} className="text-[9px] bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-mono">
                                        #{t}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RAG RETRIEVAL SIMULATOR */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div>
                  <h3 className="text-xs font-extrabold uppercase text-slate-900 dark:text-white tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    Live Hybrid RAG Vector Search Playground
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Test how customer chat messages are matched across dense vectors and sparse keywords in real-time</p>
                </div>

                <form onSubmit={handleRunRAGSimulator} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Simulated Customer Inquiry</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={testQuery}
                        onChange={(e) => setTestQuery(e.target.value)}
                        placeholder="Type any realistic customer message..."
                        required
                        className="flex-1 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium"
                      />
                      <button
                        type="submit"
                        disabled={simulating || !testQuery.trim()}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                      >
                        {simulating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        Run Hybrid RAG Search
                      </button>
                    </div>
                  </div>

                  {/* Preset Test Queries */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mr-1">Preset Tests:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setTestQuery('I need to cancel my subscription and get my money back for this renewal.');
                        handleRunRAGSimulator();
                      }}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded cursor-pointer transition border border-slate-200/60 dark:border-slate-700"
                    >
                      Subscription Refund
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTestQuery('My package tracking says delivered 3 days ago but I never received anything.');
                        handleRunRAGSimulator();
                      }}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded cursor-pointer transition border border-slate-200/60 dark:border-slate-700"
                    >
                      Lost Transit Shipment
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTestQuery('My smart speaker keeps disconnecting from 5GHz Wi-Fi after firmware update.');
                        handleRunRAGSimulator();
                      }}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded cursor-pointer transition border border-slate-200/60 dark:border-slate-700"
                    >
                      IoT Wi-Fi Troubleshooting
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTestQuery('Best Buy has this for $30 cheaper today, do you honor price matching?');
                        handleRunRAGSimulator();
                      }}
                      className="text-[10px] bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/60 hover:text-purple-700 dark:hover:text-purple-300 text-slate-700 dark:text-slate-300 font-medium px-2 py-0.5 rounded cursor-pointer transition border border-slate-200/60 dark:border-slate-700"
                    >
                      Price Match Request
                    </button>
                  </div>
                </form>
              </div>

              {/* Simulation Results Display */}
              {simulating ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <RefreshCw className="w-6 h-6 animate-spin mb-2 text-purple-600 dark:text-purple-400" />
                  Calculating 768-D dense cosine similarity and lexical token intersections...
                </div>
              ) : simResults ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 bg-purple-50/50 dark:bg-purple-950/40 p-3 rounded-xl border border-purple-100 dark:border-purple-800/80">
                    <span className="font-semibold text-purple-900 dark:text-purple-200">
                      Query matched {simResults.matches?.length || 0} top candidate articles from {simResults.totalIndexedChunks} vector chunks
                    </span>
                    <span className="font-mono text-[10px] text-purple-700 dark:text-purple-300 font-bold bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 rounded">
                      Hybrid Formula: Dense (60%) + BM25 (30%) + Category (10%)
                    </span>
                  </div>

                  <div className="space-y-3">
                    {simResults.matches?.map((match: any, index: number) => {
                      const scorePercent = Math.round(match.score * 100);
                      const semanticPercent = Math.round(match.semanticSimilarity * 100);
                      const lexicalPercent = Math.round(match.keywordScore * 100);

                      return (
                        <div
                          key={match.article.id}
                          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 text-xs font-bold flex items-center justify-center">
                                  #{index + 1}
                                </span>
                                <h4 className="text-xs font-bold text-slate-900 dark:text-white">{match.article.title}</h4>
                                <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
                                  {match.article.id}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{match.retrievalReason}</p>
                            </div>

                            {/* Score Badges */}
                            <div className="flex flex-col items-end">
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 font-mono">
                                  {scorePercent}% Match
                                </span>
                                <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full"
                                    style={{ width: `${Math.min(100, scorePercent)}%` }}
                                  ></div>
                                </div>
                              </div>
                              <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                                Dense: {semanticPercent}% | BM25: {lexicalPercent}%
                              </div>
                            </div>
                          </div>

                          {/* Matched Chunks Excerpt */}
                          {match.matchedChunks && match.matchedChunks.length > 0 && (
                            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                                Top Grounded Excerpt ({match.matchedChunks[0].chunkType}):
                              </span>
                              <div className="p-3 bg-slate-50 dark:bg-slate-850 rounded-xl border border-slate-200/70 dark:border-slate-750 text-[11px] text-slate-700 dark:text-slate-300 font-mono leading-relaxed">
                                {match.matchedChunks[0].content}
                              </div>
                            </div>
                          )}

                          {match.article.steps && match.article.steps.length > 0 && (
                            <div className="pt-2 flex flex-wrap gap-1.5 items-center text-[10px]">
                              <span className="font-bold text-emerald-700 dark:text-emerald-400">Recommended Steps:</span>
                              {match.article.steps.slice(0, 3).map((st: string, idx: number) => (
                                <span key={idx} className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-medium border border-emerald-100 dark:border-emerald-800">
                                  {idx + 1}. {st}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            Active Vector Store: <strong className="text-slate-800 dark:text-slate-200">{articles.length} SOPs</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold rounded-xl transition cursor-pointer border border-slate-800 dark:border-slate-700"
          >
            Close Knowledge Manager
          </button>
        </div>
      </div>
    </div>
  );
};

