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
    <div className="h-full flex flex-col lg:flex-row gap-6 p-4 md:p-8 overflow-hidden">
      
      {/* Left Panel: Composer */}
      <div className="flex-1 lg:max-w-2xl overflow-y-auto custom-scrollbar flex flex-col gap-6 p-1 pr-4">
        
        {/* No accounts CTA */}
        {!loadingAccounts && accounts.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 rounded-2xl border border-violet-500/20 bg-violet-500/5 text-center"
          >
            <div className="size-16 rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
              <Link2 className="size-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Connect your first account</h3>
            <p className="text-sm text-slate-500 max-w-xs mb-6">
              Connect LinkedIn, YouTube, Facebook, Twitter, or TikTok to start publishing.
            </p>
            <button
              onClick={onNavigateToAccounts}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-semibold text-sm transition-colors"
            >
              <Plus className="size-4" /> Connect Account
            </button>
          </motion.div>
        )}

        {accounts.length > 0 && (
          <>
            {/* Account Selector */}
            <div className="space-y-3">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Post to</p>
              <div className="flex flex-wrap gap-2">
                {accounts.map(account => {
                  const meta = PLATFORM_META[account.platform] || { icon: ExternalLink, color: 'text-slate-400', bg: 'bg-white/5 border-white/20', label: account.platform };
                  const Icon = meta.icon;
                  const selected = selectedAccountIds.has(account.id);
                  return (
                    <button
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all duration-200",
                        selected
                          ? `${meta.bg} ${meta.color}`
                          : "border-white/10 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <Icon className="size-4" />
                      <span className="max-w-[120px] truncate">{account.display_name || account.username}</span>
                      {selected && <X className="size-3 ml-0.5 opacity-60" />}
                    </button>
                  );
                })}
                <button
                  onClick={onNavigateToAccounts}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-white/10 text-slate-600 hover:text-slate-400 text-sm transition-colors"
                >
                  <Plus className="size-3.5" /> Add account
                </button>
              </div>
            </div>

            {showPostTypeSelector && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3">
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Post Type</p>
                <div className="flex gap-2">
                  {(['POST', 'REEL', 'STORY'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setInstagramType(type)}
                      className={cn(
                        "px-4 py-2 rounded-xl border text-sm font-semibold transition-colors",
                        instagramType === type 
                          ? "bg-violet-500/20 border-violet-500/40 text-violet-400" 
                          : "bg-[#161b22] border-white/10 text-slate-400 hover:text-slate-300 hover:bg-white/5"
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
              <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1 mt-2">
                <button
                  onClick={() => setActiveTab('master')}
                  className={cn(
                    "px-4 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                    activeTab === 'master' ? "border-violet-500 text-violet-400 bg-violet-500/10" : "border-transparent text-slate-400 hover:text-slate-300 hover:bg-white/5"
                  )}
                >
                  Master Text
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
                        "flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
                        activeTab === id ? `border-[currentColor] ${meta?.color} ${meta?.bg.split(' ')[0]}` : "border-transparent text-slate-400 hover:text-slate-300 hover:bg-white/5"
                      )}
                    >
                      <Icon className="size-4" />
                      {account.display_name || account.username}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Composer */}
            <div className={cn(
              "rounded-2xl border bg-[#0d1117] overflow-hidden transition-all duration-200 shadow-xl",
              isOverLimit ? "border-red-500/50 shadow-red-500/10" : "border-white/10 focus-within:border-violet-500/40 focus-within:shadow-violet-500/10",
              selectedAccountIds.size > 0 ? "rounded-tl-none" : ""
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
                className="w-full bg-transparent text-white text-[15px] leading-relaxed p-5 resize-none outline-none placeholder:text-slate-600"
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
                    <div className="px-5 py-4 border-t border-white/5 bg-[#161b22]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="size-4 text-violet-400" />
                          <span className="text-sm font-semibold text-violet-400">First Comment</span>
                        </div>
                        <button onClick={() => setShowFirstComment(false)} className="text-slate-500 hover:text-slate-300">
                           <X className="size-4" />
                        </button>
                      </div>
                      <textarea 
                        value={firstComment}
                        onChange={e => setFirstComment(e.target.value)}
                        placeholder="Add a first comment to boost engagement (works on LinkedIn, Facebook, Instagram, Twitter)..."
                        rows={2}
                        className="w-full bg-black/20 text-white text-[14px] p-3 rounded-xl border border-white/5 outline-none focus:border-violet-500/40 resize-none placeholder:text-slate-600"
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
                    className="overflow-hidden bg-[#161b22] border-t border-white/5 px-5 py-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Link2 className="size-4 text-blue-400" />
                        <span className="text-sm font-semibold text-blue-400">Link URL</span>
                      </div>
                      <button onClick={() => setShowLinkInput(false)} className="text-slate-500 hover:text-slate-300">
                         <X className="size-4" />
                      </button>
                    </div>
                    <input
                      type="url"
                      value={linkUrl}
                      onChange={e => setLinkUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="w-full bg-black/20 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-blue-500/40"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0d1117] border-t border-white/5">
                <div className="flex items-center gap-1">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 disabled:opacity-50 transition-colors"
                  >
                    <Image className="size-3.5" /> {isUploading ? 'Uploading...' : 'Media'}
                  </button>
                  <button
                    onClick={() => setShowLinkInput(v => !v)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      showLinkInput ? "bg-blue-500/15 text-blue-300" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                    )}
                  >
                    <Link2 className="size-3.5" /> Link
                  </button>
                  <button
                    onClick={() => setShowFirstComment(v => !v)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      showFirstComment ? "bg-violet-500/15 text-violet-300" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                    )}
                  >
                    <MessageSquare className="size-3.5" /> First Comment
                  </button>
                </div>
                <div className={cn(
                  "text-xs font-mono tabular-nums transition-colors",
                  isOverLimit ? "text-red-400 font-bold" : charCount > (lowestCharLimit * 0.9) ? "text-amber-400" : "text-slate-600"
                )}>
                  {lowestCharLimit !== 99999 ? `${charCount} / ${lowestCharLimit}` : charCount > 0 ? charCount : ''}
                </div>
              </div>
            </div>

            {/* Schedule picker */}
            <div className="space-y-2 pt-2">
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Schedule for (optional)</p>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="bg-[#161b22] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-violet-500/40 w-full md:w-auto [color-scheme:dark]"
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-4">
              <button
                onClick={() => handleSubmit('now')}
                disabled={isSubmitting || isOverLimit}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-violet-500/20"
              >
                <Send className="size-4" />
                {isSubmitting ? 'Publishing...' : 'Post Now'}
              </button>
              {scheduledAt && (
                <button
                  onClick={() => handleSubmit('schedule')}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm transition-colors"
                >
                  <Clock className="size-4" />
                  Schedule
                </button>
              )}
              <button
                onClick={() => handleSubmit('draft')}
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-3 rounded-xl text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                <FileEdit className="size-4" />
                Save Draft
              </button>
            </div>
          </>
        )}
      </div>

      {/* Right Panel: Previews (Only when accounts exist) */}
      {accounts.length > 0 && (
        <div className="hidden lg:flex w-[400px] flex-col border-l border-white/10 pl-6 h-full">
          <h3 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2 shrink-0">
            <div className="size-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
            Network Previews
          </h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar rounded-2xl bg-[#0d1117]/50 p-1">
            {selectedAccountIds.size === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center gap-3 border border-white/5 rounded-2xl bg-white/5">
                 <Image className="size-8 opacity-20" />
                 <p className="text-sm max-w-[200px]">Select an account to see how your post will look</p>
              </div>
            ) : (
              <div className="space-y-5 pb-8">
                {Array.from(selectedAccountIds).map(id => {
                   const account = accounts.find(a => a.id === id);
                   if (!account) return null;
                   const meta = PLATFORM_META[account.platform];
                   const Icon = meta?.icon || ExternalLink;
                   return (
                     <div key={id} className="bg-[#161b22] border border-white/5 rounded-xl p-5 shadow-lg">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="size-10 rounded-full bg-white/5 overflow-hidden border border-white/10">
                            {account.avatar_url ? <img src={account.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-violet-500/20" />}
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-slate-200 leading-tight">{account.display_name || account.username}</p>
                            <p className="text-[12px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <Icon className={cn("size-3", meta?.color)} />
                              {meta?.label || account.platform}
                            </p>
                          </div>
                        </div>
                        
                        {(() => {
                           const text = customBodies[id] !== undefined ? customBodies[id] : body;
                           if (!text && mediaUrls.length === 0) return <div className="text-[14px] text-slate-600 italic mb-3">Your text will appear here...</div>;
                           if (text) return <div className="text-[14px] text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">{text}</div>;
                           return null;
                        })()}

                        {mediaUrls.length > 0 && (
                          <div className={cn("grid gap-1 rounded-xl overflow-hidden mb-3 border border-white/5", mediaUrls.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
                             {mediaUrls.slice(0, 4).map((url, i) => (
                               <div key={i} className="aspect-square bg-black/40">
                                 {url.match(/\.(mp4|mov)$/i) ? (
                                    <div className="w-full h-full flex items-center justify-center"><Video className="size-8 text-white/30" /></div>
                                 ) : (
                                    <img src={url} className="w-full h-full object-cover" />
                                 )}
                               </div>
                             ))}
                          </div>
                        )}
                        
                        {showLinkInput && linkUrl && (
                          <div className="mt-2 p-3 rounded-lg bg-black/20 border border-white/5 flex items-center gap-3">
                            <div className="p-2 bg-white/5 rounded-md"><Link2 className="size-4 text-slate-400" /></div>
                            <div className="text-xs text-slate-400 truncate">{linkUrl}</div>
                          </div>
                        )}

                        {showFirstComment && firstComment.trim() && (
                          <div className="mt-4 pt-3 border-t border-white/5 flex gap-3 relative">
                             <div className="w-[2px] h-full bg-white/5 absolute left-4 top-10" />
                             <div className="size-8 rounded-full bg-white/5 overflow-hidden border border-white/10 shrink-0 z-10">
                                {account.avatar_url ? <img src={account.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-violet-500/20" />}
                             </div>
                             <div className="flex-1 bg-black/20 rounded-xl p-3 border border-white/5">
                               <p className="text-[12px] font-bold text-slate-300 mb-0.5">{account.display_name || account.username}</p>
                               <div className="text-[13px] text-slate-400 whitespace-pre-wrap">{firstComment}</div>
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
