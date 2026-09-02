import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useSocialApi } from '@/hooks/useSocialApi';
import ComposeView from './social-studio/ComposeView';
import QueueView from './social-studio/QueueView';
import CalendarView from './social-studio/CalendarView';
import AnalyticsView from './social-studio/AnalyticsView';
import AccountsView from './social-studio/AccountsView';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  PenSquare, CalendarDays, BarChart2, Link2,
  Layers, Share2
} from 'lucide-react';

const TABS = [
  { id: 'compose',  label: 'Compose',   icon: PenSquare },
  { id: 'queue',    label: 'Queue',      icon: Layers },
  { id: 'calendar', label: 'Calendar',   icon: CalendarDays },
  { id: 'analytics',label: 'Analytics',  icon: BarChart2 },
  { id: 'accounts', label: 'Accounts',   icon: Link2 },
] as const;

type Tab = (typeof TABS)[number]['id'];

export default function SocialStudioLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const api = useSocialApi();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postToEdit, setPostToEdit] = useState<any>(null); // NEW

  const activeTab = (searchParams.get('tab') as Tab) || 'compose';
  const setTab = (tab: Tab) => setSearchParams({ tab });

  const loadAccounts = useCallback(async () => {
    if (!api.activeProjectId) {
      setLoadingAccounts(false);
      return;
    }
    try {
      setLoadingAccounts(true);
      const data = await api.getAccounts();
      setAccounts(data || []);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[Accounts] AbortError ignored during cleanup');
        return;
      }
      toast.error(err.message);
    } finally { setLoadingAccounts(false); }
  }, [api, api.activeProjectId]);

  const loadPosts = useCallback(async () => {
    if (!api.activeProjectId) {
      setLoadingPosts(false);
      return;
    }
    try {
      setLoadingPosts(true);
      const data = await api.getPosts();
      setPosts(data || []);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[Posts] AbortError ignored during cleanup');
        return;
      }
      toast.error(err.message);
    } finally { setLoadingPosts(false); }
  }, [api, api.activeProjectId]);

  useEffect(() => {
    loadAccounts();
    loadPosts();

    // Handle OAuth redirect back with ?connected=platform
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      toast.success(`✅ ${connected.charAt(0).toUpperCase() + connected.slice(1)} connected!`);
      setSearchParams({ tab: 'accounts' });
      loadAccounts();
    }
    if (error) {
      toast.error(`OAuth error: ${decodeURIComponent(error)}`);
      setSearchParams({ tab: 'accounts' });
    }
  }, [api.activeProjectId]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden text-white font-sans bg-background-dark">
      {/* Module Header */}
      <div className="shrink-0 border-b border-white/5 bg-[#0d1117] sticky top-0 z-50">
        <div className="px-8 pt-6 pb-0">
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)] relative">
                    <Share2 className="size-5 text-violet-400" strokeWidth={1.75} />
                    <div className="absolute inset-0 rounded-xl bg-violet-500/5 animate-pulse" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white tracking-tight leading-none">Social Studio</h1>
                    <p className="text-[11px] text-violet-400/60 font-semibold uppercase tracking-widest mt-1">Schedule & publish to all your social platforms</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <div className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span className="text-[11px] text-emerald-300 font-semibold tabular-nums">
                    {accounts.length} account{accounts.length !== 1 ? 's' : ''} connected
                  </span>
                </div>
            </div>

            {/* Tabs */}
            <nav className="flex items-center gap-0 overflow-x-auto hide-scrollbar" role="tablist">
                {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <button
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                        setTab(tab.id);
                        if (tab.id !== 'compose') setPostToEdit(null); // Clear on tab switch
                    }}
                    className={cn(
                        "relative px-5 pb-3.5 pt-1 text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                        isActive ? "text-violet-400" : "text-slate-500 hover:text-slate-300"
                    )}
                    >
                    <tab.icon className={cn("size-3.5", isActive ? "text-violet-400" : "")} />
                    {tab.label}
                    {isActive && (
                        <motion.div
                            layoutId="social-studio-tab-underline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                    )}
                    </button>
                );
                })}
            </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col min-h-full"
          >
            <ErrorBoundary>
              {activeTab === 'compose' && (
                <ComposeView
                  accounts={accounts}
                  loadingAccounts={loadingAccounts}
                  onPostCreated={() => {
                    setPostToEdit(null);
                    setTab('queue');
                    loadPosts();
                  }}
                  onNavigateToAccounts={() => setTab('accounts')}
                  initialPost={postToEdit}
                />
              )}
              {activeTab === 'queue' && (
                <QueueView
                  posts={posts}
                  loading={loadingPosts}
                  onRefresh={loadPosts}
                  api={api}
                  onEdit={(post) => {
                    setPostToEdit(post);
                    setTab('compose');
                  }}
                />
              )}
              {activeTab === 'calendar' && (
                <CalendarView posts={posts} loading={loadingPosts} />
              )}
              {/* P2.8: AnalyticsView is fully autonomous (self-fetching), no props needed */}
              {activeTab === 'analytics' && <AnalyticsView />}
              {activeTab === 'accounts' && (
                <AccountsView
                  accounts={accounts}
                  loading={loadingAccounts}
                  onRefresh={loadAccounts}
                  api={api}
                />
              )}
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
