import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart2, Users, Eye, Heart,
  MessageSquare, Share2, RefreshCw, AlertCircle,
  ChevronUp, ChevronDown, Instagram, Facebook, Linkedin,
  Youtube, Twitter, Globe, Image, ArrowUpRight,
  ArrowDownRight, Minus, BarChart, FileText, Zap, Hash, X
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart as ReBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts';
import { safeFormatDate } from '@/utils/socialParsers';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';

const BASE_URL = (import.meta.env.VITE_OUTREACH_API_URL ?? 'http://localhost:3001') + '/api/social';

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface DayMetric {
  date: string;
  impressions: number;
  engagements: number;
  reach: number;
}

interface TopPost {
  id: string;
  text: string;
  imageUrl: string | null;
  date: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  reach: number;
  engagementRate: number;
}

interface AccountAnalytics {
  accountId: string;
  platform: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  followers: number;
  prevFollowers: number;
  impressions: number;
  prevImpressions: number;
  engagements: number;
  prevEngagements: number;
  reach: number;
  engagementRate: number;
  dailySeries: DayMetric[];
  topPosts: TopPost[];
  error: string | null;
}

interface Summary {
  totalPosts: number;
  totalFollowers: number;
  totalImpressions: number;
  totalEngagements: number;
  totalReach: number;
  engagementRate: number;
  followerGrowth: { value: number; pct: number };
  impressionsGrowth: { value: number; pct: number };
  engagementsGrowth: { value: number; pct: number };
}

interface PostHistory {
  id: string;
  body: string;
  platform: string;
  accountName: string;
  scheduledAt: string;
  publishedAt: string;
  impressions: number;
  engagements: number;
  engagementRate: number;
  mediaUrl: string | null;
}

interface AnalyticsData {
  summary: Summary;
  byAccount: AccountAnalytics[];
  postsHistory: PostHistory[];
  dailyAggregated: DayMetric[];
  range: { from: string; to: string; days: number };
}

// ─── PLATFORM META ────────────────────────────────────────────────────────────

const PLATFORM_META: Record<string, { label: string; color: string; chartColor: string; icon: any; bg: string }> = {
  instagram: { label: 'Instagram', color: 'text-pink-400',   chartColor: '#f472b6', icon: Instagram, bg: 'bg-pink-500/10 border-pink-500/20' },
  facebook:  { label: 'Facebook',  color: 'text-blue-400',   chartColor: '#60a5fa', icon: Facebook,  bg: 'bg-blue-500/10 border-blue-500/20' },
  linkedin:  { label: 'LinkedIn',  color: 'text-sky-400',    chartColor: '#38bdf8', icon: Linkedin,  bg: 'bg-sky-500/10 border-sky-500/20' },
  youtube:   { label: 'YouTube',   color: 'text-red-400',    chartColor: '#f87171', icon: Youtube,   bg: 'bg-red-500/10 border-red-500/20' },
  twitter:   { label: 'Twitter/X', color: 'text-slate-300',  chartColor: '#94a3b8', icon: Twitter,   bg: 'bg-slate-500/10 border-slate-500/20' },
  threads:   { label: 'Threads',   color: 'text-slate-300',  chartColor: '#94a3b8', icon: Hash,      bg: 'bg-slate-500/10 border-slate-500/20' },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function GrowthBadge({ pct }: { pct: number }) {
  if (pct === 0) return (
    <span className="flex items-center gap-0.5 text-[11px] text-slate-500 font-medium">
      <Minus className="size-3" /> 0%
    </span>
  );
  const isPos = pct > 0;
  return (
    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${isPos ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPos ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {isPos ? '+' : ''}{pct}%
    </span>
  );
}


const DEFAULT_META = { label: 'Social', color: 'text-slate-400', chartColor: '#94a3b8', icon: Globe, bg: 'bg-white/10 border-white/15' };

function getPlatformMeta(platform: string) {
  return PLATFORM_META[platform] || DEFAULT_META;
}

// ─── SKELETON ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.04] rounded-lg ${className}`} />;
}

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a2030] border border-white/10 rounded-xl px-4 py-3 shadow-xl shadow-black/40 text-[12px]">
      <p className="text-slate-400 font-medium mb-2">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="text-white font-semibold">{fmtNum(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── DATE RANGE PRESETS ───────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: '7 days',  days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

// P2.8: AnalyticsView is fully autonomous; it does not use parent posts/loading props.
// The parent (SocialStudioLayout) still passes them for compatibility but we remove
// them from the interface so there is no confusion.

type SortKey = 'publishedAt' | 'platform' | 'impressions' | 'engagements' | 'engagementRate';
type SortDir = 'asc' | 'desc';

// P2.7: SortHeader defined outside the component to avoid remounting on every render.
function SortHeader({ label, sKey, sortKey, sortDir, onSort }: {
  label: string;
  sKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === sKey;
  return (
    <button
      className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        active ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
      }`}
      onClick={() => onSort(sKey)}
    >
      {label}
      {active ? (sortDir === 'asc' ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : <ChevronDown className="size-3 opacity-30" />}
    </button>
  );
}

export default function AnalyticsView() {
  const { currentUser } = useAuth();
  const { activeProjectId } = useProject();

  const getHeaders = useCallback(async () => {
    if (!currentUser) throw new Error('Not authenticated');
    const token = await currentUser.getIdToken(true);
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'x-project-id': activeProjectId ?? '',
    };
  }, [currentUser, activeProjectId]);

  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(new Set());
  // P0.5: reference list of all accounts that persists across filtered fetches
  const [allAccountsRef, setAllAccountsRef] = useState<AccountAnalytics[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('publishedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const fetchAnalytics = useCallback(async () => {
    // P0.6: don't hang in skeleton state when there's no project
    if (!activeProjectId) {
      setLoading(false);
      setError('Selecciona un proyecto para ver analytics');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const h = await getHeaders();
      const params = new URLSearchParams({ days: String(days) });
      if (selectedAccounts.size > 0) {
        params.set('account_ids', Array.from(selectedAccounts).join(','));
      }
      const res = await fetch(`${BASE_URL}/analytics?${params.toString()}`, { headers: h });
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setData(json);
      // P0.5: only update reference list when showing all accounts (no filter)
      if (selectedAccounts.size === 0) {
        setAllAccountsRef(json.byAccount || []);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [activeProjectId, days, selectedAccounts, getHeaders]);

  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPage(1); // P2.6: reset pagination when filter changes
  };

  // All accounts from data — respects the current filter (used for By Account sections)
  const allAccounts = data?.byAccount || [];

  // Top posts: merge from all accounts, sort by engagements
  // P2.6: guard against missing topPosts / dailySeries fields
  const allTopPosts = useMemo(() => {
    if (!data) return [];
    const posts: (TopPost & { platform: string; accountName: string })[] = [];
    for (const acc of data.byAccount) {
      for (const p of acc.topPosts ?? []) {
        posts.push({ ...p, platform: acc.platform, accountName: acc.displayName });
      }
    }
    posts.sort((a, b) => (b.likes + b.comments) - (a.likes + a.comments));
    return posts.slice(0, 6);
  }, [data]);

  // Sorted + paginated posts history
  const sortedHistory = useMemo(() => {
    if (!data) return [];
    const h = [...data.postsHistory];
    h.sort((a: any, b: any) => {
      let va = a[sortKey], vb = b[sortKey];
      if (typeof va === 'string') va = new Date(va).getTime();
      if (typeof vb === 'string') vb = new Date(vb).getTime();
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return h;
  }, [data, sortKey, sortDir]);

  const totalPages = Math.ceil(sortedHistory.length / PAGE_SIZE);
  const pagedHistory = sortedHistory.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
    setPage(1);
  };

  // Chart data: add labels
  const chartData = (data?.dailyAggregated || []).map(d => ({
    ...d,
    label: safeFormatDate(d.date, 'MMM d', '—'),
  }));

  // Per-account chart data — P2.6: guard against missing dailySeries
  const perAccountChartData = useMemo(() => {
    if (!data) return [];
    const allDates = new Set<string>();
    for (const acc of data.byAccount) {
      for (const d of acc.dailySeries ?? []) allDates.add(d.date);
    }
    return Array.from(allDates).sort().map(date => {
      const point: Record<string, any> = { date, label: safeFormatDate(date, 'MMM d', '—') };
      for (const acc of data.byAccount) {
        const day = (acc.dailySeries ?? []).find(d => d.date === date);
        point[`${acc.platform}_${acc.accountId.slice(-4)}_imp`] = day?.impressions || 0;
        point[`${acc.platform}_${acc.accountId.slice(-4)}_eng`] = day?.engagements || 0;
      }
      return point;
    });
  }, [data]);

  // ── SUMMARY CARDS config
  const summary = data?.summary;
  const summaryCards = [
    {
      label: 'Total Posts',
      value: summary ? fmtNum(summary.totalPosts) : '—',
      icon: FileText,
      growth: null,
      accent: 'from-violet-500/20 to-purple-500/10',
      border: 'border-violet-500/20',
      iconBg: 'bg-violet-500/15',
      iconColor: 'text-violet-400',
    },
    {
      label: 'Total Followers',
      value: summary ? fmtNum(summary.totalFollowers) : '—',
      icon: Users,
      growth: summary?.followerGrowth,
      accent: 'from-sky-500/20 to-blue-500/10',
      border: 'border-sky-500/20',
      iconBg: 'bg-sky-500/15',
      iconColor: 'text-sky-400',
    },
    {
      label: 'Impressions',
      value: summary ? fmtNum(summary.totalImpressions) : '—',
      icon: Eye,
      growth: summary?.impressionsGrowth,
      accent: 'from-indigo-500/20 to-violet-500/10',
      border: 'border-indigo-500/20',
      iconBg: 'bg-indigo-500/15',
      iconColor: 'text-indigo-400',
    },
    {
      label: 'Engagements',
      value: summary ? fmtNum(summary.totalEngagements) : '—',
      icon: Heart,
      growth: summary?.engagementsGrowth,
      accent: 'from-pink-500/20 to-rose-500/10',
      border: 'border-pink-500/20',
      iconBg: 'bg-pink-500/15',
      iconColor: 'text-pink-400',
    },
    {
      label: 'Eng. Rate',
      value: summary ? `${summary.engagementRate}%` : '—',
      icon: Zap,
      growth: null,
      accent: 'from-amber-500/20 to-orange-500/10',
      border: 'border-amber-500/20',
      iconBg: 'bg-amber-500/15',
      iconColor: 'text-amber-400',
    },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">

        {/* ── Top Controls ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Analytics</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">Real-time performance across all connected accounts</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Date preset pills */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/8">
              {DATE_PRESETS.map(p => (
                <button
                  key={p.days}
                  onClick={() => { setDays(p.days); setPage(1); }}
                  className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-all duration-150 ${days === p.days ? 'bg-violet-500 text-white shadow-md shadow-violet-500/25' : 'text-slate-500 hover:text-white'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Refresh */}
            <button
              onClick={fetchAnalytics}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-slate-400 hover:text-white text-[12px] font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Account Filter Pills — P0.5: use allAccountsRef so pills persist after filtering */}
        {allAccountsRef.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {allAccountsRef.map(acc => {
              const meta = PLATFORM_META[acc.platform];
              const Icon = meta?.icon || Globe;
              const isSelected = selectedAccounts.has(acc.accountId);
              return (
                <button
                  key={acc.accountId}
                  onClick={() => toggleAccount(acc.accountId)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12px] font-medium transition-all duration-150 ${
                    isSelected
                      ? `${meta?.bg || 'bg-white/10 border-white/20'} ${meta?.color || 'text-white'}`
                      : 'bg-white/[0.02] border-white/8 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="size-3" />
                  {acc.displayName}
                </button>
              );
            })}
            {/* Clear filter button when a filter is active */}
            {selectedAccounts.size > 0 && (
              <button
                onClick={() => { setSelectedAccounts(new Set()); setPage(1); }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/8 bg-white/[0.02] text-[12px] font-medium text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X className="size-3" /> Limpiar filtro
              </button>
            )}
          </div>
        )}

        {/* ── Error Banner ──────────────────────────────────────────────── */}
        {error && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/8 border border-red-500/20 text-red-400 text-[13px]">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {/* ── Summary Cards ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {summaryCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`relative overflow-hidden rounded-xl border ${card.border} p-4 bg-gradient-to-br ${card.accent} backdrop-blur-sm`}
            >
              <div className={`size-8 rounded-lg ${card.iconBg} flex items-center justify-center mb-3`}>
                <card.icon className={`size-3.5 ${card.iconColor}`} />
              </div>
              {loading ? (
                <>
                  <Skeleton className="h-7 w-20 mb-1.5" />
                  <Skeleton className="h-3.5 w-16" />
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-white tabular-nums tracking-tight leading-none">{card.value}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[11px] text-slate-500 font-medium">{card.label}</p>
                    {card.growth !== null && card.growth !== undefined && (
                      <GrowthBadge pct={card.growth.pct} />
                    )}
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* ── Charts Row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

          {/* Engagements + Impressions by day */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-5">
              <BarChart className="size-4 text-violet-400" />
              <h3 className="text-[13px] font-semibold text-white">Impressions & Engagements</h3>
              <span className="text-[11px] text-slate-600">— last {days} days</span>
            </div>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-600 text-[13px]">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="grad-imp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="grad-eng" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f472b6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f472b6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  <Area type="monotone" dataKey="impressions" name="Impressions" stroke="#818cf8" strokeWidth={2} fill="url(#grad-imp)" dot={false} />
                  <Area type="monotone" dataKey="engagements" name="Engagements" stroke="#f472b6" strokeWidth={2} fill="url(#grad-eng)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Per-account breakdown bar chart */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <div className="flex items-center gap-2 mb-5">
              <Users className="size-4 text-sky-400" />
              <h3 className="text-[13px] font-semibold text-white">Account Performance</h3>
              <span className="text-[11px] text-slate-600">— impressions by platform</span>
            </div>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : perAccountChartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-slate-600 text-[13px]">No accounts connected</div>
            ) : (
              // P1.2: use perAccountChartData and render one Bar per account
              <ResponsiveContainer width="100%" height={200}>
                <ReBarChart data={perAccountChartData} barSize={6}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                  {allAccounts.map(acc => (
                    <Bar
                      key={acc.accountId}
                      dataKey={`${acc.platform}_${acc.accountId.slice(-4)}_imp`}
                      name={acc.displayName}
                      fill={getPlatformMeta(acc.platform).chartColor}
                      radius={[3, 3, 0, 0]}
                    />
                  ))}
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Per-Account Cards ─────────────────────────────────────────── */}
        {!loading && allAccounts.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">By Account</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {allAccounts.map((acc, i) => {
                const meta = getPlatformMeta(acc.platform);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={acc.accountId}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-3.5"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        {acc.avatarUrl ? (
                          <img src={acc.avatarUrl} alt={acc.displayName} className="size-8 rounded-full object-cover" />
                        ) : (
                          <div className={`size-8 rounded-full ${meta.bg || 'bg-white/10'} flex items-center justify-center`}>
                            <Icon className={`size-4 ${meta.color || 'text-slate-400'}`} />
                          </div>
                        )}
                        <div className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full ${meta.bg || 'bg-white/10'} border border-[#0d1117] flex items-center justify-center`}>
                          <Icon className={`size-2 ${meta.color}`} />
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">{acc.displayName}</p>
                        <p className="text-[11px] text-slate-600">@{acc.username} · {meta.label || acc.platform}</p>
                      </div>
                    </div>

                    {/* Error notice */}
                    {acc.error && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-400/80 bg-amber-400/5 border border-amber-400/15 px-2.5 py-1.5 rounded-lg">
                        <AlertCircle className="size-3 shrink-0" />
                        {acc.error}
                      </div>
                    )}

                    {/* Metrics grid */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Followers', value: acc.followers, prev: acc.prevFollowers },
                        { label: 'Impressions', value: acc.impressions, prev: acc.prevImpressions },
                        { label: 'Engagements', value: acc.engagements, prev: acc.prevEngagements },
                      ].map(m => {
                        const pct = m.prev > 0 ? Math.round(((m.value - m.prev) / m.prev) * 100) : 0;
                        return (
                          <div key={m.label} className="bg-white/[0.02] rounded-lg p-2 border border-white/5">
                            <p className="text-[14px] font-bold text-white tabular-nums leading-none">{fmtNum(m.value)}</p>
                            <p className="text-[10px] text-slate-600 mt-0.5">{m.label}</p>
                            {m.prev > 0 && <GrowthBadge pct={pct} />}
                          </div>
                        );
                      })}
                    </div>

                    {/* Eng Rate */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">Engagement Rate</span>
                      <span className={`font-semibold ${acc.engagementRate > 2 ? 'text-emerald-400' : acc.engagementRate > 0.5 ? 'text-amber-400' : 'text-slate-400'}`}>
                        {acc.engagementRate}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Top Posts ─────────────────────────────────────────────────── */}
        {!loading && allTopPosts.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Top Posts</h3>
              <span className="text-[11px] text-slate-700">— by engagement in selected period</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTopPosts.map((post, i) => {
                const meta = getPlatformMeta(post.platform);
                const Icon = meta.icon;
                return (
                  <motion.div
                    key={`${post.id}-${i}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="group rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden hover:border-white/10 hover:bg-white/[0.035] transition-all duration-200"
                  >
                    {/* Thumbnail */}
                    <div className="relative h-36 bg-white/[0.03] border-b border-white/5">
                      {post.imageUrl ? (
                        <img src={post.imageUrl} alt="" className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="size-8 text-slate-700" />
                        </div>
                      )}
                      {/* Platform badge */}
                      <div className={`absolute top-2 right-2 size-6 rounded-full ${meta.bg || 'bg-white/10'} border border-black/20 flex items-center justify-center`}>
                        <Icon className={`size-3 ${meta.color || 'text-white'}`} />
                      </div>
                      {/* Account name badge */}
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 rounded-full text-[10px] text-slate-300 backdrop-blur-sm">
                        {(post as any).accountName}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 space-y-2">
                      <p className="text-[12px] text-slate-300 leading-relaxed line-clamp-2">{post.text || '(No text)'}</p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{safeFormatDate(post.date, 'MMM d, yyyy')}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px]">
                        <span className="flex items-center gap-1 text-pink-400"><Heart className="size-3" /> {fmtNum(post.likes)}</span>
                        <span className="flex items-center gap-1 text-blue-400"><MessageSquare className="size-3" /> {fmtNum(post.comments)}</span>
                        {post.shares > 0 && <span className="flex items-center gap-1 text-green-400"><Share2 className="size-3" /> {fmtNum(post.shares)}</span>}
                        {post.impressions > 0 && <span className="flex items-center gap-1 text-slate-500"><Eye className="size-3" /> {fmtNum(post.impressions)}</span>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Posts History Table ────────────────────────────────────────── */}
        {!loading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Published Posts</h3>
              <span className="text-[11px] text-slate-700">— {sortedHistory.length} total</span>
            </div>

            {sortedHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-xl border border-white/5 bg-white/[0.02] text-center">
                <BarChart2 className="size-8 text-slate-700 mb-3" />
                <p className="text-[13px] text-slate-500">No published posts in this period</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-white/5 overflow-hidden">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-4 py-3 text-left">
                          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Post</span>
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortHeader label="Date" sKey="publishedAt" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-left">
                          <SortHeader label="Platform" sKey="platform" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right">
                          <SortHeader label="Impressions" sKey="impressions" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right">
                          <SortHeader label="Engagements" sKey="engagements" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </th>
                        <th className="px-4 py-3 text-right">
                          <SortHeader label="Eng.Rate" sKey="engagementRate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {pagedHistory.map((post, i) => {
                        const meta = getPlatformMeta(post.platform);
                        const Icon = meta.icon;
                        return (
                          <tr key={`${post.id}-${i}`} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5 max-w-[280px]">
                                {post.mediaUrl ? (
                                  <img src={post.mediaUrl} alt="" className="size-8 rounded-md object-cover shrink-0 border border-white/10" />
                                ) : (
                                  <div className="size-8 rounded-md bg-white/[0.03] border border-white/8 flex items-center justify-center shrink-0">
                                    <Image className="size-3.5 text-slate-700" />
                                  </div>
                                )}
                                <p className="text-slate-300 truncate leading-snug">{post.body || '(No text)'}</p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                              {post.publishedAt ? safeFormatDate(post.publishedAt, 'MMM d, HH:mm') : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`flex items-center gap-1.5 ${meta.color || 'text-slate-400'} font-medium`}>
                                <Icon className="size-3" />
                                {meta.label || post.platform}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmtNum(post.impressions)}</td>
                            <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{fmtNum(post.engagements)}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`font-semibold tabular-nums ${post.engagementRate > 2 ? 'text-emerald-400' : post.engagementRate > 0.5 ? 'text-amber-400' : 'text-slate-500'}`}>
                                {post.engagementRate > 0 ? `${post.engagementRate}%` : '—'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="text-slate-600">
                      Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedHistory.length)} of {sortedHistory.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Prev
                      </button>
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`size-8 rounded-lg text-[12px] font-semibold transition-colors ${page === p ? 'bg-violet-500 text-white' : 'bg-white/[0.03] border border-white/8 text-slate-500 hover:text-white'}`}
                        >
                          {p}
                        </button>
                      ))}
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/8 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Loading skeleton for sections below cards ─────────────────── */}
        {loading && (
          <div className="space-y-5">
            <Skeleton className="h-64 w-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
