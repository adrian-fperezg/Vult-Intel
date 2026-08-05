import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart2, TrendingUp, CheckCircle2, AlertCircle, Clock, FileEdit } from 'lucide-react';

interface AnalyticsViewProps {
  posts: any[];
  loading: boolean;
}

export default function AnalyticsView({ posts, loading }: AnalyticsViewProps) {
  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter(p => p.status === 'published').length;
    const scheduled = posts.filter(p => p.status === 'scheduled').length;
    const failed = posts.filter(p => p.status === 'failed').length;
    const drafts = posts.filter(p => p.status === 'draft').length;
    const successRate = published + failed > 0 ? Math.round((published / (published + failed)) * 100) : 0;

    // Platform breakdown from targets
    const byPlatform: Record<string, { total: number; published: number }> = {};
    posts.forEach(post => {
      const targets = typeof post.targets === 'string' ? JSON.parse(post.targets) : (post.targets || []);
      targets.forEach((t: any) => {
        if (!byPlatform[t.platform]) byPlatform[t.platform] = { total: 0, published: 0 };
        byPlatform[t.platform].total++;
        if (t.status === 'published') byPlatform[t.platform].published++;
      });
    });

    return { total, published, scheduled, failed, drafts, successRate, byPlatform };
  }, [posts]);

  const statCards = [
    { label: 'Total Posts',   value: stats.total,            icon: BarChart2,    accent: 'bg-violet-500/10 border-violet-500/15', iconColor: 'text-violet-400' },
    { label: 'Published',     value: stats.published,        icon: CheckCircle2, accent: 'bg-emerald-500/10 border-emerald-500/15', iconColor: 'text-emerald-400' },
    { label: 'Scheduled',     value: stats.scheduled,        icon: Clock,        accent: 'bg-blue-500/10 border-blue-500/15',    iconColor: 'text-blue-400' },
    { label: 'Failed',        value: stats.failed,           icon: AlertCircle,  accent: 'bg-red-500/10 border-red-500/15',      iconColor: 'text-red-400' },
    { label: 'Drafts',        value: stats.drafts,           icon: FileEdit,     accent: 'bg-slate-500/10 border-slate-500/15',  iconColor: 'text-slate-400' },
    { label: 'Success Rate',  value: `${stats.successRate}%`, icon: TrendingUp,  accent: 'bg-teal-500/10 border-teal-500/15',    iconColor: 'text-teal-400' },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto p-6 md:p-8 space-y-6">

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl bg-white/[0.03] border border-white/5 p-4 hover:bg-white/[0.05] transition-colors"
            >
              <div className={`size-8 rounded-lg border ${card.accent} flex items-center justify-center mb-3`}>
                <card.icon className={`size-3.5 ${card.iconColor}`} />
              </div>
              <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{card.value}</p>
              <p className="text-[11px] text-slate-600 mt-0.5 font-medium">{card.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Platform breakdown */}
        {Object.keys(stats.byPlatform).length > 0 && (
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-5">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-4">By Platform</p>
            <div className="space-y-3.5">
              {Object.entries(stats.byPlatform).map(([platform, data]) => {
                const pct = data.total > 0 ? Math.round((data.published / data.total) * 100) : 0;
                return (
                  <div key={platform}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] text-slate-300 capitalize font-medium">{platform}</span>
                      <span className="text-[11px] text-slate-600">{data.published}/{data.total} published</span>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="size-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
              <BarChart2 className="size-6 text-slate-700" />
            </div>
            <p className="text-[13px] text-slate-600">No data yet. Start publishing to see analytics.</p>
          </div>
        )}
      </div>
    </div>
  );
}
