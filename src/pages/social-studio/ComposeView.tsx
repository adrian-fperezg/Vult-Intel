import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useSocialApi } from '@/hooks/useSocialApi';
import {
  Send, Clock, FileEdit, Plus, X, Image, Link2,
  Linkedin, Twitter, Youtube, Facebook, Instagram, ExternalLink, Video, Hash,
  MessageSquare
} from 'lucide-react';
import { format } from 'date-fns';

const PLATFORM_META: Record<string, { icon: any; color: string; bg: string; label: string; charLimit?: number }> = {
  linkedin:  { icon: Linkedin,  color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/30',   label: 'LinkedIn',  charLimit: 3000 },
  facebook:  { icon: Facebook,  color: 'text-blue-500',   bg: 'bg-blue-600/10 border-blue-600/30',   label: 'Facebook',  charLimit: 63206 },
  instagram: { icon: Instagram, color: 'text-pink-400',   bg: 'bg-pink-500/10 border-pink-500/30',   label: 'Instagram', charLimit: 2200 },
  youtube:   { icon: Youtube,   color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/30',      label: 'YouTube',   charLimit: 5000 },
  twitter:   { icon: Twitter,   color: 'text-sky-400',    bg: 'bg-sky-500/10 border-sky-500/30',      label: 'Twitter/X', charLimit: 280 },
  tiktok:    { icon: ExternalLink, color: 'text-white',   bg: 'bg-white/5 border-white/20',           label: 'TikTok',    charLimit: 2200 },
  threads:   { icon: Hash,      color: 'text-slate-100',  bg: 'bg-slate-500/10 border-slate-500/30',  label: 'Threads',   charLimit: 500 },
};

interface ComposeViewProps {
  accounts: any[];
  loadingAccounts: boolean;
  onPostCreated: () => void;
  onNavigateToAccounts: () => void;
}

export default function ComposeView({ accounts, loadingAccounts, onPostCreated, onNavigateToAccounts }: ComposeViewProps) {
  const api = useSocialApi();
  const [body, setBody] = useState('');
  const [customBodies, setCustomBodies] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'master' | string>('master');
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [scheduledAt, setScheduledAt] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [firstComment, setFirstComment] = useState('');
  const [showFirstComment, setShowFirstComment] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [instagramType, setInstagramType] = useState<'POST' | 'REEL' | 'STORY'>('POST');
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (activeTab === id) setActiveTab('master');
      }
      else next.add(id);
      return next;
    });
  };

  const hasInstagramSelected = Array.from(selectedAccountIds).some(id => accounts.find(a => a.id === id)?.platform === 'instagram');
  const hasFacebookSelected = Array.from(selectedAccountIds).some(id => accounts.find(a => a.id === id)?.platform === 'facebook');
  const showPostTypeSelector = hasInstagramSelected || hasFacebookSelected;

  const lowestCharLimit = Math.min(
    ...Array.from(selectedAccountIds)
      .map(id => accounts.find(a => a.id === id)?.platform)
      .filter(Boolean)
      .map(p => PLATFORM_META[p]?.charLimit || 99999)
  ) || 99999;

  const charCount = body.length;
  const isOverLimit = lowestCharLimit !== 99999 && charCount > lowestCharLimit;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    if (mediaUrls.length + files.length > 10) {
      return toast.error('You can only attach up to 10 media files');
    }

    setIsUploading(true);
    try {
      const urls = await api.uploadMedia(files);
      setMediaUrls(prev => [...prev, ...urls]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    setMediaUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (mode: 'draft' | 'schedule' | 'now') => {
    if (!body.trim() && mediaUrls.length === 0) return toast.error('Write something or attach media first!');
    if (selectedAccountIds.size === 0) return toast.error('Select at least one account');
    if (mode === 'schedule' && !scheduledAt) return toast.error('Pick a date/time to schedule');
    if (isOverLimit) return toast.error(`Text exceeds character limit for one of your platforms`);
    
    if (hasInstagramSelected && mediaUrls.length === 0) {
      return toast.error('Instagram requires at least one image or video');
    }

    setIsSubmitting(true);
    try {
      const post = await api.createPost({
        body,
        link_url: linkUrl || undefined,
        link_title: showPostTypeSelector ? instagramType : undefined,
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
        first_comment: showFirstComment && firstComment.trim() ? firstComment.trim() : undefined,
        scheduled_at: mode === 'schedule' ? scheduledAt : undefined,
        account_ids: Array.from(selectedAccountIds),
        custom_bodies: Object.keys(customBodies).length > 0 ? customBodies : undefined,
        status: mode === 'draft' ? 'draft' : mode === 'now' ? 'scheduled' : 'scheduled',
      });

      if (mode === 'now') {
        await api.publishNow(post.id);
        toast.success('🚀 Published!');
      } else if (mode === 'schedule') {
        toast.success('📅 Scheduled!');
      } else {
        toast.success('📝 Saved as draft');
      }

      setBody('');
      setCustomBodies({});
      setActiveTab('master');
      setSelectedAccountIds(new Set());
      setScheduledAt('');
      setLinkUrl('');
      setMediaUrls([]);
      setFirstComment('');
      setShowFirstComment(false);
      onPostCreated();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-0 overflow-hidden">
      
      {/* Left Panel: Composer */}
      <div className="flex-1 lg:max-w-[640px] overflow-y-auto custom-scrollbar flex flex-col gap-5 p-6 md:p-8">
        
        {/* No accounts CTA */}
        {!loadingAccounts && accounts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 rounded-2xl border border-white/5 bg-white/[0.02] text-center"
          >
            <div className="size-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
              <Link2 className="size-6 text-violet-400" />
            </div>
            <h3 className="text-[15px] font-semibold text-white mb-1.5">Connect your first account</h3>
            <p className="text-[13px] text-slate-500 max-w-xs mb-6 leading-relaxed">
              Connect LinkedIn, YouTube, Facebook, Twitter, or TikTok to start publishing.
            </p>
            <button
              onClick={onNavigateToAccounts}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-semibold text-[13px] transition-colors"
            >
              <Plus className="size-3.5" /> Connect Account
            </button>
          </motion.div>
        )}

        {accounts.length > 0 && (
          <>
            {/* Account Selector */}
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Post to</p>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(account => {
                  const meta = PLATFORM_META[account.platform] || { icon: ExternalLink, color: 'text-slate-400', bg: 'bg-white/5 border-white/20', label: account.platform };
                  const Icon = meta.icon;
                  const selected = selectedAccountIds.has(account.id);
                  return (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all duration-150",
                        selected
                          ? `${meta.bg} ${meta.color}`
                          : "border-white/8 bg-white/[0.03] text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span className="max-w-[110px] truncate">{account.display_name || account.username}</span>
                      {selected && <X className="size-2.5 ml-0.5 opacity-50" />}
                    </button>
                  );
                })}
                <button
                  onClick={onNavigateToAccounts}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/10 text-slate-600 hover:text-slate-400 text-[13px] transition-colors"
                >
                  <Plus className="size-3" /> Add account
                </button>
              </div>
            </div>

            {showPostTypeSelector && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2.5">
                <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Post Type</p>
                <div className="flex gap-1.5 p-1 bg-white/[0.03] border border-white/5 rounded-xl w-fit">
                  {(['POST', 'REEL', 'STORY'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setInstagramType(type)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-all duration-150",
                        instagramType === type 
                          ? "bg-violet-500/25 text-violet-300 shadow-sm" 
                          : "text-slate-500 hover:text-slate-300"
                      )}
                    >
                      {type === 'POST' && mediaUrls.length > 1 ? 'Carousel' : type === 'POST' ? 'Feed Post' : type === 'REEL' ? 'Reel' : 'Story'}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Custom Text Tabs */}
            {selectedAccountIds.size > 0 && (
              <div className="flex gap-0 overflow-x-auto custom-scrollbar border-b border-white/5">
                <button
                  onClick={() => setActiveTab('master')}
                  className={cn(
                    "px-3 py-2 text-[12px] font-semibold border-b-2 transition-all duration-150 whitespace-nowrap -mb-px",
                    activeTab === 'master' ? "border-violet-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300"
                  )}
                >
                  All networks
                </button>
                {Array.from(selectedAccountIds).map(id => {
                  const account = accounts.find(a => a.id === id);
                  if (!account) return null;
                  const meta = PLATFORM_META[account.platform];
                  const Icon = meta?.icon || ExternalLink;
                  return (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold border-b-2 transition-all duration-150 whitespace-nowrap -mb-px",
                        activeTab === id ? `border-current ${meta?.color}` : "border-transparent text-slate-500 hover:text-slate-300"
                      )}
                    >
                      <Icon className="size-3" />
                      {account.display_name || account.username}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Composer */}
            <div className={cn(
              "rounded-xl border bg-[#0f1419] overflow-hidden transition-all duration-200",
              isOverLimit ? "border-red-500/40 shadow-sm shadow-red-500/10" : "border-white/8 focus-within:border-violet-500/30 focus-within:shadow-md focus-within:shadow-violet-500/5"
            )}>
              <textarea
                ref={textareaRef}
                value={activeTab === 'master' ? body : (customBodies[activeTab] !== undefined ? customBodies[activeTab] : body)}
                onChange={e => {
                  if (activeTab === 'master') setBody(e.target.value);
                  else setCustomBodies(prev => ({ ...prev, [activeTab]: e.target.value }));
                }}
                placeholder={activeTab === 'master' ? "What's on your mind? Write your post here..." : "Customize text for this network..."}
                rows={8}
                className="w-full bg-transparent text-white text-[14px] leading-relaxed p-4 resize-none outline-none placeholder:text-slate-700"
              />
              
              {mediaUrls.length > 0 && (
                <div className="px-5 pb-5 grid grid-cols-5 gap-2">
                  {mediaUrls.map((url, i) => {
                    const isVideo = url.match(/\.(mp4|mov)$/i);
                    return (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                        {isVideo ? (
                          <div className="w-full h-full bg-black/40 flex flex-col items-center justify-center gap-1">
                             <Video className="size-6 text-white/50" />
                             <span className="text-[10px] text-white/50 font-medium">VIDEO</span>
                          </div>
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                        <button 
                          onClick={() => removeMedia(i)}
                          className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* First Comment Area */}
              <AnimatePresence>
                {showFirstComment && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="px-4 py-3.5 border-t border-white/5 bg-white/[0.02]">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="size-3.5 text-violet-400" />
                          <span className="text-[12px] font-semibold text-violet-400">First Comment</span>
                        </div>
                        <button onClick={() => setShowFirstComment(false)} className="text-slate-600 hover:text-slate-400">
                           <X className="size-3.5" />
                        </button>
                      </div>
                      <textarea 
                        value={firstComment}
                        onChange={e => setFirstComment(e.target.value)}
                        placeholder="Add a first comment to boost engagement..."
                        rows={2}
                        className="w-full bg-transparent text-white text-[13px] p-0 outline-none resize-none placeholder:text-slate-700"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Link input */}
              <AnimatePresence>
                {showLinkInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden bg-white/[0.02] border-t border-white/5 px-4 py-3.5"
                  >
                     <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="size-3.5 text-blue-400" />
                          <span className="text-[12px] font-semibold text-blue-400">Link URL</span>
                        </div>
                        <button onClick={() => setShowLinkInput(false)} className="text-slate-600 hover:text-slate-400">
                           <X className="size-3.5" />
                        </button>
                      </div>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full bg-transparent text-[13px] text-white placeholder:text-slate-700 outline-none"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/5">
                <div className="flex items-center gap-0.5">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/mp4,video/quicktime"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading || mediaUrls.length >= 10}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 hover:text-slate-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
                  >
                    <Image className="size-3.5" /> {isUploading ? 'Uploading...' : 'Media'}
                  </button>
                  <button
                    onClick={() => setShowLinkInput(v => !v)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                      showLinkInput ? "bg-blue-500/10 text-blue-400" : "text-slate-600 hover:text-slate-300 hover:bg-white/5"
                    )}
                  >
                    <Link2 className="size-3.5" /> Link
                  </button>
                  <button
                    onClick={() => setShowFirstComment(v => !v)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                      showFirstComment ? "bg-violet-500/10 text-violet-400" : "text-slate-600 hover:text-slate-300 hover:bg-white/5"
                    )}
                  >
                    <MessageSquare className="size-3.5" /> First Comment
                  </button>
                </div>
                <div className={cn(
                  "text-[11px] font-mono tabular-nums pr-1 transition-colors",
                  isOverLimit ? "text-red-400 font-bold" : charCount > (lowestCharLimit * 0.9) ? "text-amber-400" : "text-slate-700"
                )}>
                  {lowestCharLimit !== 99999 ? `${charCount} / ${lowestCharLimit}` : charCount > 0 ? charCount : ''}
                </div>
              </div>
            </div>

            {/* Schedule picker */}
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Schedule for (optional)</p>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="bg-white/[0.03] border border-white/8 rounded-lg px-3.5 py-2 text-[13px] text-slate-300 outline-none focus:border-violet-500/40 w-full md:w-auto [color-scheme:dark] transition-colors"
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => handleSubmit('now')}
                disabled={isSubmitting || isOverLimit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] transition-colors shadow-md shadow-violet-500/20"
              >
                <Send className="size-3.5" />
                {isSubmitting ? 'Publishing...' : 'Post Now'}
              </button>
              {scheduledAt && (
                <button
                  onClick={() => handleSubmit('schedule')}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 text-slate-300 font-semibold text-[13px] transition-colors"
                >
                  <Clock className="size-3.5" />
                  Schedule
                </button>
              )}
              <button
                onClick={() => handleSubmit('draft')}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-600 hover:text-slate-300 text-[13px] transition-colors"
              >
                <FileEdit className="size-3.5" />
                Save Draft
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right Panel: Previews (Only when accounts exist) */}
      {accounts.length > 0 && (
        <div className="hidden lg:flex flex-col w-[380px] shrink-0 border-l border-white/5 bg-white/[0.01] h-full">
          <div className="flex items-center gap-2 px-6 pt-6 pb-4 shrink-0">
            <div className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
            <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest">Network Previews</h3>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-8">
            {selectedAccountIds.size === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center gap-3">
                 <Image className="size-7 opacity-20" />
                 <p className="text-[13px] max-w-[180px] leading-relaxed">Select an account to see how your post will look</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from(selectedAccountIds).map(id => {
                   const account = accounts.find(a => a.id === id);
                   if (!account) return null;
                   const meta = PLATFORM_META[account.platform];
                   const Icon = meta?.icon || ExternalLink;
                   return (
                     <div key={id} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="size-8 rounded-full bg-white/5 overflow-hidden border border-white/10 shrink-0">
                            {account.avatar_url ? <img src={account.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-violet-500/20" />}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-slate-200 leading-tight">{account.display_name || account.username}</p>
                            <p className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                              <Icon className={cn("size-2.5", meta?.color)} />
                              {meta?.label || account.platform}
                            </p>
                          </div>
                        </div>
                        
                        {(() => {
                           const text = customBodies[id] !== undefined ? customBodies[id] : body;
                           if (!text && mediaUrls.length === 0) return <div className="text-[13px] text-slate-700 italic mb-3">Your text will appear here...</div>;
                           if (text) return <div className="text-[13px] text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">{text}</div>;
                           return null;
                        })()}

                        {mediaUrls.length > 0 && (
                          <div className={cn("grid gap-0.5 rounded-lg overflow-hidden mb-3", mediaUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                             {mediaUrls.slice(0, 4).map((url, i) => (
                               <div key={i} className="aspect-square bg-black/30">
                                 {url.match(/\.(mp4|mov)$/i) ? (
                                    <div className="w-full h-full flex items-center justify-center"><Video className="size-6 text-white/20" /></div>
                                 ) : (
                                    <img src={url} className="w-full h-full object-cover" />
                                 )}
                               </div>
                             ))}
                          </div>
                        )}
                        
                        {showLinkInput && linkUrl && (
                          <div className="mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2">
                            <Link2 className="size-3 text-slate-600 shrink-0" />
                            <div className="text-[11px] text-slate-500 truncate">{linkUrl}</div>
                          </div>
                        )}

                        {showFirstComment && firstComment.trim() && (
                          <div className="mt-3 pt-3 border-t border-white/5 flex gap-2">
                             <div className="size-6 rounded-full bg-white/5 overflow-hidden border border-white/10 shrink-0">
                                {account.avatar_url ? <img src={account.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-violet-500/20" />}
                             </div>
                             <div className="flex-1 bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
                               <p className="text-[11px] font-semibold text-slate-400 mb-0.5">{account.display_name || account.username}</p>
                               <div className="text-[12px] text-slate-500 whitespace-pre-wrap">{firstComment}</div>
                             </div>
                          </div>
                        )}
                     </div>
                   );
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
