import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import {
  Clock, CheckCircle2, AlertCircle, FileEdit, Trash2, Send,
  RefreshCw, Linkedin, Twitter, Youtube, Facebook, Instagram, ExternalLink
} from 'lucide-react';

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin, twitter: Twitter, youtube: Youtube,
  facebook: Facebook, instagram: Instagram, tiktok: ExternalLink,
};
const STATUS_STYLES: Record<string, { label: string; color: string; dot: string; icon: any }> = {
  draft:      { label: 'Draft',      color: 'text-slate-400',   dot: 'bg-slate-500',   icon: FileEdit },
  scheduled:  { label: 'Scheduled',  color: 'text-violet-400',  dot: 'bg-violet-500',  icon: Clock },
  publishing: { label: 'Publishing', color: 'text-amber-400',   dot: 'bg-amber-500',   icon: RefreshCw },
  published:  { label: 'Published',  color: 'text-emerald-400', dot: 'bg-emerald-500', icon: CheckCircle2 },
  failed:     { label: 'Failed',     color: 'text-red-400',     dot: 'bg-red-500',     icon: AlertCircle },
};

interface QueueViewProps {
  posts: any[];
  loading: boolean;
  onRefresh: () => void;
  api: any;
}

export default function QueueView({ posts, loading, onRefresh, api }: QueueViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    setDeletingId(id);
    try {
      await api.deletePost(id);
      toast.success('Post deleted');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setDeletingId(null); }
  };

  const handlePublishNow = async (id: string) => {
    setPublishingId(id);
    try {
      await api.publishNow(id);
      toast.success('🚀 Published!');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setPublishingId(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="size-6 border-2 border-t-violet-500 border-white/10 rounded-full animate-spin" />
    </div>
  );

  const grouped = {
    scheduled: posts.filter(p => p.status === 'scheduled'),
    draft: posts.filter(p => p.status === 'draft'),
    published: posts.filter(p => p.status === 'published'),
    failed: posts.filter(p => p.status === 'failed'),
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-2xl mx-auto p-6 md:p-8 space-y-8">
        {posts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="size-14 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-4">
              <Clock className="size-6 text-slate-700" />
            </div>
            <p className="text-[13px] text-slate-600">No posts yet. Compose your first post!</p>
          </div>
        )}

        {(['scheduled', 'draft', 'failed', 'published'] as const).map(status => {
          const statusPosts = grouped[status];
          if (!statusPosts.length) return null;
          const style = STATUS_STYLES[status];
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("size-1.5 rounded-full", style.dot)} />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                  {style.label} · {statusPosts.length}
                </span>
              </div>
              <div className="space-y-2">
                {statusPosts.map(post => {
                  const targets = typeof post.targets === 'string' ? JSON.parse(post.targets) : (post.targets || []);
                  return (
                    <motion.div
                      key={post.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] px-4 py-3.5 transition-all duration-150"
                    >
                      {/* Status badge */}
                      <div className={cn("absolute top-3.5 right-3.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide", style.color)}>
                        <style.icon className="size-3" />
                        {style.label}
                      </div>

                      {/* Platforms */}
                      <div className="flex items-center gap-1 mb-2.5">
                        {targets.map((t: any) => {
                          const Icon = PLATFORM_ICONS[t.platform] || ExternalLink;
                          const failed = t.status === 'failed';
                          return (
                            <div key={t.id} title={failed ? t.error_message : t.platform}
                              className={cn("size-5 rounded-full flex items-center justify-center", failed ? "bg-red-500/15" : "bg-white/[0.05]")}>
                              <Icon className={cn("size-2.5", failed ? "text-red-400" : "text-slate-500")} />
                            </div>
                          );
                        })}
                      </div>

                      {/* Body */}
                      <p className="text-[13px] text-slate-300 leading-relaxed line-clamp-2 pr-24">{post.body}</p>

                      {/* Metadata */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-[11px] text-slate-600">
                          {post.scheduled_at
                            ? format(parseISO(post.scheduled_at), 'MMM d, yyyy · h:mm a')
                            : post.published_at
                            ? `Published ${format(parseISO(post.published_at), 'MMM d')}`
                            : 'No date set'}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {(post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed') && (
                            <button
                              onClick={() => handlePublishNow(post.id)}
                              disabled={publishingId === post.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 text-violet-400 text-[11px] font-medium transition-colors"
                            >
                              <Send className="size-2.5" />
                              {publishingId === post.id ? '...' : 'Post now'}
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(post.id)}
                            disabled={deletingId === post.id}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-700 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
