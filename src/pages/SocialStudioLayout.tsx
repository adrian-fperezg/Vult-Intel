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
      console.error(err);
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
    <div className="absolute inset-0 flex flex-col min-h-0 bg-[#0d1117] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-0 shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
            <Share2 className="size-4 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight leading-none">Social Studio</h1>
            <p className="text-[11px] text-slate-500 mt-0.5">Schedule & publish to all your social platforms</p>
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
      <div className="flex items-end gap-0 px-8 pt-5 shrink-0">
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setTab(tab.id);
                if (tab.id !== 'compose') setPostToEdit(null); // Clear on tab switch
              }}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-all duration-150 border-b-2",
                isActive
                  ? "border-violet-400 text-white"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              <tab.icon className={cn("size-3.5", isActive ? "text-violet-400" : "")} />
              {tab.label}
            </button>
          );
        })}
        <div className="flex-1 border-b-2 border-white/5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 flex flex-col"
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
