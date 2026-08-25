import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  Clock, AlertCircle, FileEdit, Trash2, Send,
  RefreshCw, Linkedin, Twitter, Youtube, Facebook, Instagram, ExternalLink,
  Pause, Play, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { safeParseArray, safeFormatDate } from '@/utils/socialParsers';
import { STATUS_STYLES, KNOWN_STATUSES } from '@/constants/socialStatus';

// ─── Platform icon map ────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, any> = {
  linkedin: Linkedin, twitter: Twitter, youtube: Youtube,
  facebook: Facebook, instagram: Instagram, tiktok: ExternalLink,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface QueueViewProps {
  posts: any[];
  loading: boolean;
  onRefresh: () => void;
  api: any;
  onEdit?: (post: any) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QueueView({ posts, loading, onRefresh, api, onEdit }: QueueViewProps) {
  // P2.11: store only the ID, derive post on each render
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const activePost = activePostId ? posts.find(p => p.id === activePostId) ?? null : null;

  const wrapAction = async (id: string, action: () => Promise<void>, successMsg: string) => {
    setWorkingId(id);
    try {
      await action();
      if (successMsg) toast.success(successMsg);
      onRefresh();
      if (activePostId === id) setActivePostId(null); // Close modal on state change
    } catch (err: any) {
      toast.error(err.message);
    } finally { setWorkingId(null); }
  };

  const handleDelete = (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    wrapAction(id, () => api.deletePost(id), 'Post deleted');
  };

  const handlePublishNow = (id: string) => wrapAction(id, () => api.publishNow(id), '🚀 Published!');
  const handlePause = (id: string) => wrapAction(id, () => api.pausePost(id), 'Post paused');
  const handleResume = (id: string) => wrapAction(id, () => api.resumePost(id), 'Post resumed');
  const handleRetry = (id: string) => wrapAction(id, () => api.retryPost(id), 'Retrying post...');

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="size-6 border-2 border-t-violet-500 border-white/10 rounded-full animate-spin" />
    </div>
  );

  // P0.4: include publishing + other (unknown statuses)
  const grouped = {
    failed:     posts.filter(p => p.status === 'failed'),
    publishing: posts.filter(p => p.status === 'publishing'),
    paused:     posts.filter(p => p.status === 'paused'),
    scheduled:  posts.filter(p => p.status === 'scheduled'),
    draft:      posts.filter(p => p.status === 'draft'),
    published:  posts.filter(p => p.status === 'published'),
    other:      posts.filter(p => !KNOWN_STATUSES.includes(p.status)),
  };

  return (
    <div className="h-full flex relative">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto p-6 md:p-8 space-y-10">
          {posts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="size-16 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mb-5">
                <Clock className="size-8 text-slate-700" />
              </div>
              <h3 className="text-sm font-semibold text-white">Your queue is empty</h3>
              <p className="text-[13px] text-slate-500 mt-1">Compose a new post to get started.</p>
            </div>
          )}

          {/* P0.4: render all known statuses + other */}
          {([...KNOWN_STATUSES, 'other'] as const).map(status => {
            const statusPosts = grouped[status];
            if (!statusPosts.length) return null;
            const style = STATUS_STYLES[status] || STATUS_STYLES.other;

            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-4">
                  <div className={cn("size-2 rounded-full", style.dot)} />
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                    {style.label} <span className="text-slate-600 opacity-60 ml-1">({statusPosts.length})</span>
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {statusPosts.map(post => {
                    // P1.1: safe parsing
                    const targets = safeParseArray<any>(post.targets);
                    const media = safeParseArray<string>(post.media_urls).filter(u => typeof u === 'string');

                    return (
                      <motion.div
                        key={post.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => setActivePostId(post.id)}
                        className={cn(
                          "group relative rounded-xl border p-4 transition-all duration-200 cursor-pointer hover:shadow-lg",
                          style.border, style.bg,
                          "hover:bg-white/[0.06] hover:border-white/20"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Platforms & Date */}
                            <div className="flex items-center gap-3 mb-2">
                              <div className="flex items-center -space-x-1">
                                {targets.map((t: any) => {
                                  const Icon = PLATFORM_ICONS[t.platform] || ExternalLink;
                                  return (
                                    <div key={t.id} className="size-6 rounded-full bg-[#1e2329] border border-slate-700 flex items-center justify-center shadow-sm">
                                      <Icon className="size-3 text-slate-300" />
                                    </div>
                                  );
                                })}
                              </div>
                              {/* P1.1: safe date formatting */}
                              <span className="text-[11px] text-slate-500 font-medium">
                                {post.scheduled_at
                                  ? safeFormatDate(post.scheduled_at, 'MMM d, h:mm a')
                                  : post.published_at
                                    ? `Published ${safeFormatDate(post.published_at, 'MMM d')}`
                                    : 'No date'}
                              </span>
                            </div>

                            {/* Body Excerpt */}
                            <p className="text-[13px] text-slate-200 leading-relaxed line-clamp-2 pr-6">
                              {post.body || <span className="italic text-slate-500">No text content...</span>}
                            </p>

                            {/* Error inline alert if failed */}
                            {post.status === 'failed' && post.error_message && (
                              <div className="mt-3 flex items-start gap-2 text-[12px] text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                                <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                                <span className="line-clamp-1">{post.error_message}</span>
                              </div>
                            )}
                          </div>

                          {/* Media Thumbnail or Status Icon */}
                          <div className="shrink-0 flex flex-col items-end gap-3">
                            <div className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide", style.color)}>
                              <style.icon className="size-3.5" />
                              {style.label}
                            </div>

                            {media.length > 0 && (
                              <div className="size-12 rounded-lg overflow-hidden border border-white/10 relative">
                                {media[0].match(/\.(mp4|mov|webm)$/i) ? (
                                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                    <Play className="size-4 text-white" />
                                  </div>
                                ) : (
                                  <img src={media[0]} alt="Media" className="w-full h-full object-cover" />
                                )}
                                {media.length > 1 && (
                                  <div className="absolute bottom-0.5 right-0.5 bg-black/70 px-1 rounded text-[9px] font-medium text-white">
                                    +{media.length - 1}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* P1.5: pointer-events-none when invisible to prevent mobile tap-through */}
                        <div
                          className="absolute inset-y-0 right-0 pr-4 flex items-center opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity"
                          onClick={e => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5 bg-[#161b22] p-1.5 rounded-xl border border-white/10 shadow-xl">

                            {post.status === 'scheduled' && (
                              <>
                                <button onClick={() => handlePause(post.id)} disabled={workingId === post.id} className="p-2 rounded-lg hover:bg-amber-500/10 text-slate-400 hover:text-amber-400" title="Pause">
                                  <Pause className="size-3.5" />
                                </button>
                                <button onClick={() => {
                                  if (onEdit) onEdit(post);
                                  else toast("Edit coming soon");
                                }} className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white" title="Edit">
                                  <FileEdit className="size-3.5" />
                                </button>
                              </>
                            )}

                            {post.status === 'paused' && (
                              <button onClick={() => handleResume(post.id)} disabled={workingId === post.id} className="p-2 rounded-lg hover:bg-blue-500/10 text-slate-400 hover:text-blue-400" title="Resume">
                                <Play className="size-3.5" />
                              </button>
                            )}

                            {post.status === 'failed' && (
                              <button onClick={() => handleRetry(post.id)} disabled={workingId === post.id} className="p-2 rounded-lg hover:bg-violet-500/10 text-slate-400 hover:text-violet-400" title="Retry">
                                <RefreshCw className="size-3.5" />
                              </button>
                            )}

                            {(post.status === 'draft' || post.status === 'scheduled') && (
                              <button onClick={() => handlePublishNow(post.id)} disabled={workingId === post.id} className="p-2 rounded-lg hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400" title="Publish Now">
                                <Send className="size-3.5" />
                              </button>
                            )}

                            <div className="w-[1px] h-4 bg-white/10 mx-1" />

                            <button onClick={() => handleDelete(post.id)} disabled={workingId === post.id} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-400 hover:text-red-400" title="Delete">
                              <Trash2 className="size-3.5" />
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

      {/* Detail Modal Overlay */}
      <AnimatePresence>
        {activePost && (
          <PostDetailModal
            post={activePost}
            onClose={() => setActivePostId(null)}
            workingId={workingId}
            onDelete={() => handleDelete(activePost.id)}
            onPublishNow={() => handlePublishNow(activePost.id)}
            onPause={() => handlePause(activePost.id)}
            onResume={() => handleResume(activePost.id)}
            onRetry={() => handleRetry(activePost.id)}
            onEdit={() => {
              if (onEdit) onEdit(activePost);
              else toast("Edit coming soon");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST DETAIL MODAL (Slide-over / Centered Modal)
// ─────────────────────────────────────────────────────────────────────────────
function PostDetailModal({
  post, onClose, workingId, onDelete, onPublishNow, onPause, onResume, onRetry, onEdit
}: any) {
  const [showRawError, setShowRawError] = useState(false);
  // P1.1: safe parsing in modal
  const targets = safeParseArray<any>(post.targets);
  const media = safeParseArray<string>(post.media_urls).filter(u => typeof u === 'string');
  const style = STATUS_STYLES[post.status] || STATUS_STYLES.other;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-2xl max-h-[90vh] bg-[#0d1117] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn("px-6 py-4 flex items-center justify-between border-b border-white/5", style.bg)}>
          <div className="flex items-center gap-3">
            <div className={cn("flex items-center justify-center size-8 rounded-lg border", style.bg, style.border)}>
              <style.icon className={cn("size-4", style.color)} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Post Details</h2>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {/* P1.1: safe date formatting */}
                {post.scheduled_at
                  ? `Scheduled for ${safeFormatDate(post.scheduled_at, 'MMMM d, yyyy h:mm a')}`
                  : post.published_at
                    ? `Published on ${safeFormatDate(post.published_at, 'MMMM d, yyyy')}`
                    : 'No date scheduled'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl text-slate-400 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

          {/* Main Error Alert */}
          {post.status === 'failed' && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 space-y-3">
              <div className="flex gap-3">
                <AlertCircle className="size-5 text-red-400 shrink-0" />
                <div>
                  <h3 className="text-[13px] font-semibold text-red-200">Publishing Failed</h3>
                  <p className="text-[12px] text-red-300 mt-1">{post.error_message}</p>
                </div>
              </div>

              {post.error_code && (
                <div>
                  <button
                    onClick={() => setShowRawError(!showRawError)}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 font-medium"
                  >
                    {showRawError ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    View raw error details
                  </button>
                  {showRawError && (
                    <pre className="mt-2 p-3 bg-black/40 rounded-lg text-[10px] text-red-300 overflow-x-auto border border-red-500/10 whitespace-pre-wrap break-all">
                      {post.error_code}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Content</h4>
            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 text-[13px] text-slate-300 leading-relaxed whitespace-pre-wrap">
              {post.body || <span className="italic text-slate-600">No body text</span>}
            </div>
          </div>

          {/* Media Grid */}
          {media.length > 0 && (
            <div>
              <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Media ({media.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {media.map((url: string, i: number) => (
                  <div key={i} className="aspect-square rounded-xl overflow-hidden border border-white/10 bg-black/50 relative group">
                    {url.match(/\.(mp4|mov|webm)$/i) ? (
                      <video src={url} className="w-full h-full object-cover" controls />
                    ) : (
                      <img src={url} alt={`Media ${i}`} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Targets */}
          <div>
            <h4 className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest mb-2">Platforms</h4>
            <div className="space-y-2">
              {targets.map((t: any) => {
                const Icon = PLATFORM_ICONS[t.platform] || ExternalLink;
                const isFailed = t.status === 'failed';
                const isPub = t.status === 'published';
                return (
                  <div key={t.id} className="flex flex-col bg-white/[0.02] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-full bg-[#1e2329] border border-slate-700 flex items-center justify-center">
                          <Icon className="size-3.5 text-slate-300" />
                        </div>
                        <span className="text-[13px] font-medium text-slate-200 capitalize">{t.platform}</span>
                      </div>
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border",
                        isFailed ? "bg-red-500/10 text-red-400 border-red-500/20" :
                        isPub ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                        "bg-white/5 text-slate-400 border-white/10"
                      )}>
                        {t.status}
                      </div>
                    </div>
                    {isFailed && t.error_message && (
                      <div className="mt-3 text-[11px] text-red-300 bg-red-500/5 p-2 rounded-lg border border-red-500/10">
                        {t.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between">
          <button
            onClick={onDelete}
            disabled={workingId === post.id}
            className="flex items-center gap-2 px-3 py-2 text-[12px] font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <Trash2 className="size-4" />
            Delete Post
          </button>

          <div className="flex items-center gap-2">
            {post.status === 'scheduled' && (
              <>
                <button onClick={onEdit} className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                  <FileEdit className="size-4" /> Edit
                </button>
                <button onClick={onPause} disabled={workingId === post.id} className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors">
                  <Pause className="size-4" /> Pause
                </button>
                <button onClick={onPublishNow} disabled={workingId === post.id} className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors">
                  <Send className="size-4" /> Post Now
                </button>
              </>
            )}

            {post.status === 'paused' && (
              <button onClick={onResume} disabled={workingId === post.id} className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-colors">
                <Play className="size-4" /> Resume Schedule
              </button>
            )}

            {post.status === 'failed' && (
              <button onClick={onRetry} disabled={workingId === post.id} className="flex items-center gap-2 px-4 py-2 text-[12px] font-medium text-white bg-violet-500 hover:bg-violet-600 rounded-lg transition-colors shadow-lg shadow-violet-500/20">
                <RefreshCw className="size-4" /> Retry Post
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
