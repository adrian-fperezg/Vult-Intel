import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useSocialApi } from '@/hooks/useSocialApi';
import {
  Send, Clock, FileEdit, Plus, X, Image, Link2,
  Linkedin, Twitter, Youtube, Facebook, Instagram, ExternalLink, Video, Hash,
  MessageSquare, ChevronDown, ChevronUp, Settings2, RefreshCw, RotateCcw,
  Globe, Users, Lock, Eye
} from 'lucide-react';
import { format } from 'date-fns';

// ─── Platform metadata ───────────────────────────────────────────────────────

const PLATFORM_META: Record<string, {
  icon: any; color: string; bg: string; activeBg: string; label: string;
  charLimit: number; supportsFirstComment: boolean; contentTypes: string[];
  features: string[];
  focusBorder: string; // P2.9: literal class — Tailwind cannot build dynamic class strings at runtime
}> = {
  linkedin: {
    icon: Linkedin, color: 'text-blue-400', bg: 'bg-blue-500/8 border-blue-500/15',
    activeBg: 'bg-blue-500/15 border-blue-500/35', label: 'LinkedIn', charLimit: 3000,
    supportsFirstComment: true,
    contentTypes: ['Post', 'Article', 'Document'],
    features: ['visibility', 'poll'],
    focusBorder: 'focus-within:border-blue-500/30',
  },
  facebook: {
    icon: Facebook, color: 'text-blue-500', bg: 'bg-blue-600/8 border-blue-600/15',
    activeBg: 'bg-blue-600/15 border-blue-600/35', label: 'Facebook', charLimit: 63206,
    supportsFirstComment: true,
    contentTypes: ['Post', 'Reel', 'Story'],
    features: ['link_preview'],
    focusBorder: 'focus-within:border-blue-600/30',
  },
  instagram: {
    icon: Instagram, color: 'text-pink-400', bg: 'bg-pink-500/8 border-pink-500/15',
    activeBg: 'bg-pink-500/15 border-pink-500/35', label: 'Instagram', charLimit: 2200,
    supportsFirstComment: true,
    contentTypes: ['Post', 'Reel', 'Story', 'Carousel'],
    features: ['alt_text', 'location', 'collab'],
    focusBorder: 'focus-within:border-pink-500/30',
  },
  youtube: {
    icon: Youtube, color: 'text-red-400', bg: 'bg-red-500/8 border-red-500/15',
    activeBg: 'bg-red-500/15 border-red-500/35', label: 'YouTube', charLimit: 5000,
    supportsFirstComment: false,
    contentTypes: ['Community Post'],
    features: ['visibility', 'poll'],
    focusBorder: 'focus-within:border-red-500/30',
  },
  twitter: {
    icon: Twitter, color: 'text-sky-400', bg: 'bg-sky-500/8 border-sky-500/15',
    activeBg: 'bg-sky-500/15 border-sky-500/35', label: 'Twitter / X', charLimit: 280,
    supportsFirstComment: false,
    contentTypes: ['Tweet', 'Thread'],
    features: ['reply_settings', 'poll'],
    focusBorder: 'focus-within:border-sky-500/30',
  },
  tiktok: {
    icon: ExternalLink, color: 'text-white', bg: 'bg-white/[0.03] border-white/8',
    activeBg: 'bg-white/[0.08] border-white/20', label: 'TikTok', charLimit: 2200,
    supportsFirstComment: false,
    contentTypes: ['Video Post'],
    features: ['privacy', 'allow_comments', 'allow_duet', 'allow_stitch'],
    focusBorder: 'focus-within:border-white/20',
  },
  threads: {
    icon: Hash, color: 'text-slate-300', bg: 'bg-white/[0.03] border-white/8',
    activeBg: 'bg-white/[0.08] border-white/20', label: 'Threads', charLimit: 500,
    supportsFirstComment: true,
    contentTypes: ['Thread'],
    features: ['reply_settings'],
    focusBorder: 'focus-within:border-white/20',
  },
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface NetworkState {
  customBody: string | undefined;       // undefined = use master
  firstComment: string;
  contentType: string;
  // Twitter
  twitterReplySettings: 'everyone' | 'followers' | 'mentioned';
  twitterThread: string[];
  twitterPoll: { options: string[]; duration: number } | null;
  // LinkedIn
  linkedinVisibility: 'PUBLIC' | 'CONNECTIONS';
  linkedinPoll: { options: string[]; duration: number } | null;
  // Instagram
  instagramAltText: string;
  instagramLocation: string;
  instagramCollabAccount: string;
  // YouTube
  youtubeVisibility: 'PUBLIC' | 'UNLISTED' | 'PRIVATE';
  youtubePoll: { options: string[] } | null;
  // TikTok
  tiktokPrivacy: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'SELF_ONLY';
  tiktokAllowComments: boolean;
  tiktokAllowDuet: boolean;
  tiktokAllowStitch: boolean;
  // Threads
  threadsReplySettings: 'everyone' | 'following' | 'mentioned';
}

// ─── Media Mapping Types ─────────────────────────────────────────────────────

interface MediaAssignment {
  previewUrl: string;      // URL.createObjectURL — instant local preview
  uploadedUrl: string | null; // becomes real URL after server upload
  fileName: string;
}

// accountId → MediaAssignment
type MediaMapping = Record<string, MediaAssignment>;

const defaultNetworkState = (platform: string): NetworkState => ({
  customBody: undefined,
  firstComment: '',
  contentType: PLATFORM_META[platform]?.contentTypes[0] || 'Post',
  twitterReplySettings: 'everyone',
  twitterThread: [],
  twitterPoll: null,
  linkedinVisibility: 'PUBLIC',
  linkedinPoll: null,
  instagramAltText: '',
  instagramLocation: '',
  instagramCollabAccount: '',
  youtubeVisibility: 'PUBLIC',
  youtubePoll: null,
  tiktokPrivacy: 'PUBLIC_TO_EVERYONE',
  tiktokAllowComments: true,
  tiktokAllowDuet: true,
  tiktokAllowStitch: true,
  threadsReplySettings: 'everyone',
});

// ─── Props ───────────────────────────────────────────────────────────────────

interface ComposeViewProps {
  accounts: any[];
  loadingAccounts: boolean;
  onPostCreated: () => void;
  onNavigateToAccounts: () => void;
  initialPost?: any; // NEW
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function charColor(count: number, limit: number): string {
  const pct = count / limit;
  if (pct >= 1) return 'text-red-400 font-bold';
  if (pct >= 0.9) return 'text-amber-400';
  return 'text-slate-600';
}

// ─── Platform-specific options panels ────────────────────────────────────────

function PlatformOptions({ platform, state, onChange }: {
  platform: string;
  state: NetworkState;
  onChange: (patch: Partial<NetworkState>) => void;
}) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;

  return (
    <div className="space-y-3 pt-1">
      {/* Content type */}
      {meta.contentTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {meta.contentTypes.map(type => (
            <button
              key={type}
              onClick={() => onChange({ contentType: type })}
              className={cn(
                'px-3 py-1 rounded-lg text-[12px] font-semibold transition-all border',
                state.contentType === type
                  ? `${meta.activeBg} ${meta.color}`
                  : 'border-white/8 text-slate-500 hover:text-slate-300 bg-white/[0.02]'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      )}

      {/* Twitter/Threads reply settings — P2.3: derive correct options per platform */}
      {meta.features.includes('reply_settings') && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 w-24 shrink-0">Who can reply</span>
          <div className="flex gap-1">
            {(platform === 'twitter'
              ? (['everyone', 'followers', 'mentioned'] as const)
              : (['everyone', 'following', 'mentioned'] as const)
            ).map(opt => {
              const Icon = opt === 'everyone' ? Globe : opt === 'followers' || opt === 'following' ? Users : MessageSquare;
              return (
                <button key={opt} onClick={() =>
                  platform === 'twitter'
                    ? onChange({ twitterReplySettings: opt as 'everyone' | 'followers' | 'mentioned' })
                    : onChange({ threadsReplySettings: opt as 'everyone' | 'following' | 'mentioned' })
                }
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border capitalize',
                    (platform === 'twitter' ? state.twitterReplySettings : state.threadsReplySettings) === opt
                      ? `${meta.activeBg} ${meta.color}`
                      : 'border-white/8 text-slate-600 hover:text-slate-300 bg-white/[0.02]'
                  )}
                >
                  <Icon className="size-3" />
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Twitter poll */}
      {platform === 'twitter' && meta.features.includes('poll') && (
        <div>
          {!state.twitterPoll ? (
            <button onClick={() => onChange({ twitterPoll: { options: ['', ''], duration: 1 } })}
              className="text-[11px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
            >
              <Plus className="size-3" /> Add Poll
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/8">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Poll</span>
                <button onClick={() => onChange({ twitterPoll: null })} className="text-slate-600 hover:text-red-400">
                  <X className="size-3" />
                </button>
              </div>
              {state.twitterPoll.options.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={e => {
                    const options = [...state.twitterPoll!.options];
                    options[i] = e.target.value;
                    onChange({ twitterPoll: { ...state.twitterPoll!, options } });
                  }}
                  placeholder={`Option ${i + 1}`}
                  maxLength={25}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-sky-500/40"
                />
              ))}
              {state.twitterPoll.options.length < 4 && (
                <button onClick={() => onChange({ twitterPoll: { ...state.twitterPoll!, options: [...state.twitterPoll!.options, ''] } })}
                  className="text-[11px] text-slate-600 hover:text-slate-400 flex items-center gap-1"
                >
                  <Plus className="size-3" /> Add option
                </button>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500">Duration</span>
                <select value={state.twitterPoll.duration}
                  onChange={e => onChange({ twitterPoll: { ...state.twitterPoll!, duration: +e.target.value } })}
                  className="bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1 text-[11px] text-white outline-none"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map(d => (
                    <option key={d} value={d}>{d} day{d !== 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Twitter thread */}
      {platform === 'twitter' && state.contentType === 'Thread' && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Thread Tweets</span>
          </div>
          {state.twitterThread.map((tweet, i) => (
            <div key={i} className="relative">
              <textarea
                value={tweet}
                onChange={e => {
                  const newThread = [...state.twitterThread];
                  newThread[i] = e.target.value;
                  onChange({ twitterThread: newThread });
                }}
                placeholder={`Tweet ${i + 2}...`}
                rows={3}
                className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-2 text-[13px] text-white placeholder:text-slate-700 outline-none focus:border-sky-500/30 resize-none pr-8 transition-colors"
              />
              <button
                onClick={() => {
                  const newThread = state.twitterThread.filter((_, idx) => idx !== i);
                  onChange({ twitterThread: newThread });
                }}
                className="absolute top-2 right-2 p-1 text-slate-600 hover:text-red-400 bg-black/40 hover:bg-black/60 rounded-md transition-colors"
              >
                <X className="size-3" />
              </button>
              <div className="flex justify-between items-center mt-1 px-1">
                {tweet.length > 280 ? (
                  <p className="text-[10px] text-red-400">
                    ⚠ Exceeds limit by {tweet.length - 280} characters
                  </p>
                ) : <span />}
                <span className={cn('text-[10px] tabular-nums', tweet.length > 280 ? 'text-red-400' : 'text-slate-500')}>
                  {tweet.length} / 280
                </span>
              </div>
            </div>
          ))}
          <button
            onClick={() => onChange({ twitterThread: [...state.twitterThread, ''] })}
            className="text-[11px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
          >
            <Plus className="size-3" /> Add another tweet
          </button>
        </div>
      )}

      {/* LinkedIn visibility & poll */}
      {platform === 'linkedin' && (
        <>
          {meta.features.includes('visibility') && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-24 shrink-0">Visibility</span>
              <div className="flex gap-1">
                {(['PUBLIC', 'CONNECTIONS'] as const).map(v => {
                  const Icon = v === 'PUBLIC' ? Globe : Users;
                  return (
                    <button key={v} onClick={() => onChange({ linkedinVisibility: v })}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border',
                        state.linkedinVisibility === v
                          ? `${meta.activeBg} ${meta.color}`
                          : 'border-white/8 text-slate-600 hover:text-slate-300 bg-white/[0.02]'
                      )}
                    >
                      <Icon className="size-3" />
                      {v === 'PUBLIC' ? 'Public' : 'Connections'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!state.linkedinPoll ? (
            <button onClick={() => onChange({ linkedinPoll: { options: ['', '', '', ''], duration: 7 } })}
              className="text-[11px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
            >
              <Plus className="size-3" /> Add Poll
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/8">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Poll</span>
                <button onClick={() => onChange({ linkedinPoll: null })} className="text-slate-600 hover:text-red-400">
                  <X className="size-3" />
                </button>
              </div>
              {state.linkedinPoll.options.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={e => {
                    const options = [...state.linkedinPoll!.options];
                    options[i] = e.target.value;
                    onChange({ linkedinPoll: { ...state.linkedinPoll!, options } });
                  }}
                  placeholder={`Option ${i + 1}`}
                  maxLength={30}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-blue-500/40"
                />
              ))}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-slate-500">Duration</span>
                <select value={state.linkedinPoll.duration}
                  onChange={e => onChange({ linkedinPoll: { ...state.linkedinPoll!, duration: +e.target.value } })}
                  className="bg-white/[0.03] border border-white/8 rounded-lg px-2 py-1 text-[11px] text-white outline-none"
                >
                  {[1, 3, 7, 14].map(d => <option key={d} value={d}>{d} day{d !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Instagram options */}
      {platform === 'instagram' && (
        <div className="space-y-2">
          {meta.features.includes('alt_text') && (
            <div className="flex items-start gap-2">
              <span className="text-[11px] text-slate-500 w-24 shrink-0 pt-1.5">Alt text</span>
              <input value={state.instagramAltText}
                onChange={e => onChange({ instagramAltText: e.target.value })}
                placeholder="Describe your image for accessibility..."
                className="flex-1 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-pink-500/30"
              />
            </div>
          )}
          {meta.features.includes('location') && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-24 shrink-0">Location</span>
              <input value={state.instagramLocation}
                onChange={e => onChange({ instagramLocation: e.target.value })}
                placeholder="Add location..."
                className="flex-1 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-pink-500/30"
              />
            </div>
          )}
          {meta.features.includes('collab') && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-24 shrink-0">Collab</span>
              <input value={state.instagramCollabAccount}
                onChange={e => onChange({ instagramCollabAccount: e.target.value })}
                placeholder="@username for collaboration post..."
                className="flex-1 bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-pink-500/30"
              />
            </div>
          )}
        </div>
      )}

      {/* YouTube options */}
      {platform === 'youtube' && (
        <>
          {meta.features.includes('visibility') && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 w-24 shrink-0">Visibility</span>
              <div className="flex gap-1">
                {(['PUBLIC', 'UNLISTED', 'PRIVATE'] as const).map(v => {
                  const icons = { PUBLIC: Globe, UNLISTED: Eye, PRIVATE: Lock };
                  const Icon = icons[v];
                  return (
                    <button key={v} onClick={() => onChange({ youtubeVisibility: v })}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border capitalize',
                        state.youtubeVisibility === v
                          ? `${meta.activeBg} ${meta.color}`
                          : 'border-white/8 text-slate-600 hover:text-slate-300 bg-white/[0.02]'
                      )}
                    >
                      <Icon className="size-3" />
                      {v.charAt(0) + v.slice(1).toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!state.youtubePoll ? (
            <button onClick={() => onChange({ youtubePoll: { options: ['', ''] } })}
              className="text-[11px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
            >
              <Plus className="size-3" /> Add Poll
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-white/[0.03] border border-white/8">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Poll</span>
                <button onClick={() => onChange({ youtubePoll: null })} className="text-slate-600 hover:text-red-400">
                  <X className="size-3" />
                </button>
              </div>
              {state.youtubePoll.options.map((opt, i) => (
                <input key={i} value={opt}
                  onChange={e => {
                    const options = [...state.youtubePoll!.options];
                    options[i] = e.target.value;
                    onChange({ youtubePoll: { options } });
                  }}
                  placeholder={`Option ${i + 1}`}
                  className="w-full bg-white/[0.03] border border-white/8 rounded-lg px-3 py-1.5 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-red-500/30"
                />
              ))}
              {state.youtubePoll.options.length < 5 && (
                <button onClick={() => onChange({ youtubePoll: { options: [...state.youtubePoll!.options, ''] } })}
                  className="text-[11px] text-slate-600 hover:text-slate-400 flex items-center gap-1"
                >
                  <Plus className="size-3" /> Add option
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* TikTok options */}
      {platform === 'tiktok' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 w-24 shrink-0">Privacy</span>
            <div className="flex gap-1 flex-wrap">
              {([
                { v: 'PUBLIC_TO_EVERYONE', l: 'Public', Icon: Globe },
                { v: 'MUTUAL_FOLLOW_FRIENDS', l: 'Friends', Icon: Users },
                { v: 'SELF_ONLY', l: 'Private', Icon: Lock },
              ] as const).map(({ v, l, Icon }) => (
                <button key={v} onClick={() => onChange({ tiktokPrivacy: v })}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border',
                    state.tiktokPrivacy === v
                      ? `${meta.activeBg} ${meta.color}`
                      : 'border-white/8 text-slate-600 hover:text-slate-300 bg-white/[0.02]'
                  )}
                >
                  <Icon className="size-3" /> {l}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            {([
              { key: 'tiktokAllowComments' as const, label: 'Comments' },
              { key: 'tiktokAllowDuet' as const, label: 'Duet' },
              { key: 'tiktokAllowStitch' as const, label: 'Stitch' },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => onChange({ [key]: !state[key] })}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors border',
                  state[key]
                    ? `${meta.activeBg} ${meta.color}`
                    : 'border-white/8 text-slate-500 bg-white/[0.02]'
                )}
              >
                <div className={cn('size-1.5 rounded-full', state[key] ? 'bg-current' : 'bg-slate-700')} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Media Mapper Component ──────────────────────────────────────────────────

function MediaMapper({
  selectedAccounts,
  mediaMapping,
  onAssign,
  onRemove,
  isUploading,
}: {
  selectedAccounts: any[];
  mediaMapping: MediaMapping;
  onAssign: (accountIds: string[], file: File) => Promise<void>;
  onRemove: (accountId: string) => void;
  isUploading: boolean;
}) {
  const [stagingFile, setStagingFile] = useState<File | null>(null);
  const [stagingPreviewUrl, setStagingPreviewUrl] = useState<string>('');
  const [stagingTargets, setStagingTargets] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);
  const mapperInputRef = useRef<HTMLInputElement>(null);

  // Accounts already assigned to another image
  const assignedAccountIds = new Set(Object.keys(mediaMapping));

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Revoke previous object URL to avoid memory leak
    if (stagingPreviewUrl) URL.revokeObjectURL(stagingPreviewUrl);
    const url = URL.createObjectURL(file);
    setStagingFile(file);
    setStagingPreviewUrl(url);
    setStagingTargets(new Set());
    if (mapperInputRef.current) mapperInputRef.current.value = '';
  };

  const toggleTarget = (id: string) => {
    setStagingTargets(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!stagingFile || stagingTargets.size === 0) return;
    setIsAssigning(true);
    try {
      await onAssign(Array.from(stagingTargets), stagingFile);
      // Clear staging
      if (stagingPreviewUrl) URL.revokeObjectURL(stagingPreviewUrl);
      setStagingFile(null);
      setStagingPreviewUrl('');
      setStagingTargets(new Set());
    } finally {
      setIsAssigning(false);
    }
  };

  const handleClearStaging = () => {
    if (stagingPreviewUrl) URL.revokeObjectURL(stagingPreviewUrl);
    setStagingFile(null);
    setStagingPreviewUrl('');
    setStagingTargets(new Set());
  };

  // Group assigned accounts by image (same uploadedUrl = same batch)
  const assignedEntries = Object.entries(mediaMapping);

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div className="size-5 rounded-md bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
          <Image className="size-3 text-violet-400" />
        </div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Media per account</p>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      {/* Already-assigned summaries */}
      {assignedEntries.length > 0 && (
        <div className="space-y-1.5">
          {assignedEntries.map(([accountId, assignment]) => {
            const account = selectedAccounts.find(a => a.id === accountId);
            if (!account) return null;
            const meta = PLATFORM_META[account.platform];
            const Icon = meta?.icon || ExternalLink;
            const displayUrl = assignment.uploadedUrl || assignment.previewUrl;
            return (
              <div key={accountId} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                {/* Thumbnail */}
                <div className="relative size-10 rounded-md overflow-hidden shrink-0 border border-white/10">
                  <img src={displayUrl} alt="" className="w-full h-full object-cover" />
                  {!assignment.uploadedUrl && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <RefreshCw className="size-3 text-white animate-spin" />
                    </div>
                  )}
                </div>
                {/* Account pill */}
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Icon className={cn('size-3 shrink-0', meta?.color || 'text-slate-400')} />
                  <span className="text-[12px] text-slate-300 truncate font-medium">
                    {account.display_name || account.username}
                  </span>
                  {assignment.uploadedUrl ? (
                    <span className="text-[10px] text-emerald-400 shrink-0 flex items-center gap-0.5">
                      <span>✓</span> Ready
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-400 shrink-0">Uploading…</span>
                  )}
                </div>
                {/* Remove */}
                <button
                  onClick={() => onRemove(accountId)}
                  className="size-5 rounded flex items-center justify-center text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Remove assignment"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Staging area */}
      {!stagingFile ? (
        /* Upload trigger */
        <button
          onClick={() => mapperInputRef.current?.click()}
          disabled={isUploading || isAssigning}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-dashed border-white/12 bg-white/[0.02] hover:border-violet-500/30 hover:bg-violet-500/5 text-slate-500 hover:text-violet-400 text-[13px] font-medium transition-all duration-200 disabled:opacity-40 group"
        >
          <Plus className="size-4 transition-transform group-hover:scale-110" />
          Assign image to specific accounts
        </button>
      ) : (
        /* Staging: preview + account selector + confirm */
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-violet-500/25 bg-violet-500/5 overflow-hidden"
        >
          {/* Image preview row */}
          <div className="flex items-start gap-3 p-3 border-b border-white/5">
            <div className="relative size-16 rounded-lg overflow-hidden shrink-0 border border-white/10">
              <img src={stagingPreviewUrl} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[12px] font-semibold text-white truncate">{stagingFile.name}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{(stagingFile.size / 1024).toFixed(0)} KB</p>
              <p className="text-[11px] text-violet-400 mt-1">Select accounts to assign this image →</p>
            </div>
            <button onClick={handleClearStaging} className="text-slate-600 hover:text-slate-300 p-0.5 transition-colors">
              <X className="size-3.5" />
            </button>
          </div>

          {/* Account checkboxes */}
          <div className="p-3 space-y-1.5">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-2">Apply to:</p>
            {selectedAccounts.map(account => {
              const meta = PLATFORM_META[account.platform];
              const Icon = meta?.icon || ExternalLink;
              const alreadyAssigned = assignedAccountIds.has(account.id);
              const isChecked = stagingTargets.has(account.id);
              return (
                <button
                  key={account.id}
                  onClick={() => !alreadyAssigned && toggleTarget(account.id)}
                  disabled={alreadyAssigned}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all duration-150',
                    alreadyAssigned
                      ? 'border-white/5 bg-white/[0.01] opacity-40 cursor-not-allowed'
                      : isChecked
                      ? `${meta?.activeBg || 'bg-white/10 border-white/20'} ${meta?.color || 'text-white'}`
                      : 'border-white/8 bg-white/[0.02] text-slate-400 hover:text-white hover:bg-white/5'
                  )}
                >
                  {/* Checkbox visual */}
                  <div className={cn(
                    'size-4 rounded border flex items-center justify-center shrink-0 transition-all',
                    alreadyAssigned ? 'border-white/10 bg-white/5' :
                    isChecked ? 'border-current bg-current/20' : 'border-white/20 bg-transparent'
                  )}>
                    {isChecked && !alreadyAssigned && <span className="text-[8px] font-bold">✓</span>}
                    {alreadyAssigned && <X className="size-2.5 opacity-50" />}
                  </div>
                  <Icon className={cn('size-3.5 shrink-0', meta?.color || 'text-slate-400')} />
                  <span className="text-[12px] font-medium truncate">
                    {account.display_name || account.username}
                  </span>
                  {alreadyAssigned && (
                    <span className="ml-auto text-[10px] text-slate-600 shrink-0">already assigned</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Confirm button */}
          <div className="px-3 pb-3">
            <button
              onClick={handleAssign}
              disabled={stagingTargets.size === 0 || isAssigning}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-[13px] transition-colors shadow-md shadow-violet-500/20"
            >
              {isAssigning ? (
                <><RefreshCw className="size-3.5 animate-spin" /> Uploading & Assigning…</>
              ) : (
                <><Image className="size-3.5" /> Assign to {stagingTargets.size > 0 ? `${stagingTargets.size} account${stagingTargets.size > 1 ? 's' : ''}` : 'selected accounts'}</>
              )}
            </button>
          </div>
        </motion.div>
      )}

      <input
        ref={mapperInputRef}
        type="file"
        accept="image/*,video/mp4,video/quicktime"
        className="hidden"
        onChange={handlePickFile}
      />
    </div>
  );
}

// ─── Platform Preview ─────────────────────────────────────────────────────────

function PlatformPreview({ account, text, mediaUrls, linkUrl, firstComment, contentType }: {
  account: any; text: string; mediaUrls: string[];
  linkUrl: string; firstComment: string; contentType: string;
}) {
  const platform = account?.platform;
  const meta = PLATFORM_META[platform];
  if (!meta || !account) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-3">
      <Image className="size-7 opacity-20" />
      <p className="text-[13px] max-w-[180px] text-center leading-relaxed">Select an account to see preview</p>
    </div>
  );

  const Icon = meta.icon;

  return (
    <div className="w-full">
      {/* Post card */}
      <div className="bg-white/[0.03] border border-white/8 rounded-xl p-4">
        {/* Account header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="size-9 rounded-full bg-white/5 overflow-hidden border border-white/10 shrink-0">
            {account.avatar_url
              ? <img src={account.avatar_url} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full bg-violet-500/20 flex items-center justify-center">
                  <Icon className={cn('size-4', meta.color)} />
                </div>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-slate-200 leading-tight truncate">
              {account.display_name || account.username}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Icon className={cn('size-3', meta.color)} />
              <span className="text-[11px] text-slate-600">{meta.label}</span>
              {contentType !== meta.contentTypes[0] && (
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', meta.activeBg, meta.color)}>
                  {contentType}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Text */}
        {text ? (
          <p className="text-[13px] text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">
            {platform === 'twitter' && text.length > 280
              ? text.slice(0, 280) + '…'
              : text}
          </p>
        ) : (
          <p className="text-[13px] text-slate-700 italic mb-3">Your text will appear here...</p>
        )}

        {/* Media */}
        {mediaUrls.length > 0 && (
          <div className={cn(
            'grid gap-0.5 rounded-lg overflow-hidden mb-3',
            mediaUrls.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
          )}>
            {mediaUrls.slice(0, platform === 'instagram' && contentType === 'Story' ? 1 : 4).map((url, i) => (
              <div key={i} className="aspect-square bg-black/30">
                {url.match(/\.(mp4|mov)$/i)
                  ? <div className="w-full h-full flex items-center justify-center"><Video className="size-6 text-white/20" /></div>
                  : <img src={url} className="w-full h-full object-cover" alt="" />
                }
              </div>
            ))}
          </div>
        )}

        {/* Link preview */}
        {linkUrl && (
          <div className="mt-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2">
            <Link2 className="size-3 text-slate-600 shrink-0" />
            <p className="text-[11px] text-slate-500 truncate">{linkUrl}</p>
          </div>
        )}

        {/* Platform-specific footer */}
        {platform === 'twitter' && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 text-slate-700">
            <span className="text-[11px]">💬</span>
            <span className="text-[11px]">🔁</span>
            <span className="text-[11px]">❤️</span>
            <span className="text-[11px]">📊</span>
          </div>
        )}

        {platform === 'instagram' && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-4 text-slate-700">
            <span className="text-[12px]">♡</span>
            <span className="text-[12px]">💬</span>
            <span className="text-[12px]">✈️</span>
          </div>
        )}

        {platform === 'linkedin' && (
          <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-3 text-slate-700">
            <span className="text-[11px]">👍 Like</span>
            <span className="text-[11px]">💬 Comment</span>
            <span className="text-[11px]">🔁 Repost</span>
          </div>
        )}
      </div>

      {/* First comment preview */}
      {firstComment.trim() && (
        <div className="mt-3 flex gap-2 pl-2">
          <div className="size-6 rounded-full bg-white/5 overflow-hidden border border-white/10 shrink-0">
            {account.avatar_url
              ? <img src={account.avatar_url} className="w-full h-full object-cover" alt="" />
              : <div className="w-full h-full bg-violet-500/20" />
            }
          </div>
          <div className="flex-1 bg-white/[0.03] rounded-lg p-2.5 border border-white/5">
            <p className="text-[11px] font-semibold text-slate-400 mb-0.5">
              {account.display_name || account.username}
            </p>
            <p className="text-[12px] text-slate-500 whitespace-pre-wrap">{firstComment}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Network Card ─────────────────────────────────────────────────────────────

// P0.3: NetworkCard does NOT receive fileInputRef/onUpload/isUploading.
// Media upload in the customize-per-network panel is handled exclusively by MediaMapper.
function NetworkCard({ account, state, masterBody, isActive, onActivate, onChange }: {
  account: any;
  state: NetworkState;
  masterBody: string;
  isActive: boolean;
  onActivate: () => void;
  onChange: (patch: Partial<NetworkState>) => void;
}) {
  const platform = account.platform;
  const meta = PLATFORM_META[platform];
  const [expanded, setExpanded] = useState(true);
  const Icon = meta?.icon || ExternalLink;

  const effectiveText = state.customBody !== undefined ? state.customBody : masterBody;
  const charLimit = meta?.charLimit || 99999;
  const charCount = effectiveText.length;
  const isOverLimit = charCount > charLimit;
  const hasCustomBody = state.customBody !== undefined;

  const accountName = account.display_name || account.username;

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden transition-all duration-200',
        isActive ? `${meta?.activeBg || 'bg-white/[0.08] border-white/20'}` : 'bg-white/[0.02] border-white/5 hover:border-white/10'
      )}
    >
      {/* Card header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => { setExpanded(e => !e); onActivate(); }}
      >
        <div className="size-8 rounded-lg bg-black/20 overflow-hidden flex items-center justify-center shrink-0">
          {account.avatar_url
            ? <img src={account.avatar_url} className="w-full h-full object-cover" alt="" />
            : <Icon className={cn('size-4', meta?.color || 'text-slate-400')} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white truncate">{accountName}</p>
          <div className="flex items-center gap-1.5">
            <Icon className={cn('size-2.5', meta?.color || 'text-slate-500')} />
            <span className="text-[11px] text-slate-500">{meta?.label || platform}</span>
            {state.contentType !== meta?.contentTypes[0] && (
              <span className={cn('text-[10px] px-1 rounded', meta?.color, 'opacity-70')}>· {state.contentType}</span>
            )}
            {hasCustomBody && (
              <span className="text-[10px] text-violet-400 font-semibold">· Customized</span>
            )}
          </div>
        </div>
        {/* Char count */}
        <span className={cn('text-[11px] font-mono tabular-nums shrink-0', charColor(charCount, charLimit))}>
          {charLimit !== 99999 && `${charCount}/${charLimit}`}
        </span>
        {expanded ? <ChevronUp className="size-3.5 text-slate-600 shrink-0" /> : <ChevronDown className="size-3.5 text-slate-600 shrink-0" />}
      </div>

      {/* Card body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">

              {/* Custom text area */}
              <div className={cn(
                'rounded-lg border overflow-hidden transition-all',
                isOverLimit
                  ? 'border-red-500/30'
                  : cn('border-white/8', meta?.focusBorder || 'focus-within:border-violet-500/30')
              )}>
                <div className="flex items-center justify-between px-3 pt-2 pb-0">
                  <span className="text-[10px] text-slate-600 font-medium">
                    {hasCustomBody ? 'Custom text' : 'Using master text'}
                  </span>
                  {hasCustomBody && (
                    <button
                      onClick={() => onChange({ customBody: undefined })}
                      className="text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="size-2.5" /> Reset to master
                    </button>
                  )}
                </div>
                <textarea
                  value={effectiveText}
                  onChange={e => onChange({ customBody: e.target.value })}
                  placeholder={hasCustomBody ? 'Write custom text for this network...' : masterBody || 'Write custom text for this network...'}
                  rows={4}
                  className="w-full bg-transparent text-white text-[13px] leading-relaxed px-3 py-2 resize-none outline-none placeholder:text-slate-700"
                />
                {isOverLimit && (
                  <p className="text-[10px] text-red-400 px-3 pb-2">
                    ⚠ Exceeds {meta?.label} limit by {charCount - charLimit} characters
                  </p>
                )}
              </div>

              {/* Platform-specific options */}
              <PlatformOptions platform={platform} state={state} onChange={onChange} />

              {/* First comment */}
              {meta?.supportsFirstComment && (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest block">
                    First Comment
                  </label>
                  <textarea
                    value={state.firstComment}
                    onChange={e => onChange({ firstComment: e.target.value })}
                    placeholder="Add a first comment to boost engagement..."
                    rows={2}
                    className="w-full bg-white/[0.02] border border-white/8 rounded-lg px-3 py-2 text-[12px] text-white placeholder:text-slate-700 outline-none focus:border-violet-500/30 resize-none transition-colors"
                  />
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main ComposeView ─────────────────────────────────────────────────────────

export default function ComposeView({ accounts, loadingAccounts, onPostCreated, onNavigateToAccounts }: ComposeViewProps) {
  const api = useSocialApi();

  // Master state
  const [body, setBody] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  // Per-account selection & network states
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [networkStates, setNetworkStates] = useState<Record<string, NetworkState>>({});
  const [customizePerNetwork, setCustomizePerNetwork] = useState(false);
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);

  // ── Media mapping: accountId → uploaded image assignment
  const [mediaMapping, setMediaMapping] = useState<MediaMapping>({});

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const getNetworkState = useCallback((accountId: string, platform: string): NetworkState => {
    return networkStates[accountId] || defaultNetworkState(platform);
  }, [networkStates]);

  // P2.2: updateNetworkState receives platform to produce a correct defaultNetworkState
  const updateNetworkState = useCallback((accountId: string, platform: string, patch: Partial<NetworkState>) => {
    setNetworkStates(prev => ({
      ...prev,
      [accountId]: { ...(prev[accountId] || defaultNetworkState(platform)), ...patch }
    }));
  }, []);

  const toggleAccount = (account: any) => {
    const id = account.id;
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (activeNetworkId === id) setActiveNetworkId(null);
      } else {
        next.add(id);
        // Init state if needed
        if (!networkStates[id]) {
          setNetworkStates(p => ({ ...p, [id]: defaultNetworkState(account.platform) }));
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (initialPost) {
      setBody(initialPost.body || '');
      // Parse media_urls safely
      let m: string[] = [];
      try {
        m = typeof initialPost.media_urls === 'string' ? JSON.parse(initialPost.media_urls) : initialPost.media_urls;
      } catch (e) {}
      setMediaUrls(Array.isArray(m) ? m.filter(u => typeof u === 'string') : []);
      
      setLinkUrl(initialPost.link_url || '');
      setShowLinkInput(!!initialPost.link_url);
      
      if (initialPost.scheduled_at) {
        // datetime-local expects YYYY-MM-DDThh:mm format in local time
        const date = new Date(initialPost.scheduled_at);
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
        setScheduledAt(localISOTime);
      }
      
      const newSelected = new Set<string>();
      const newNetStates: Record<string, NetworkState> = {};
      const newMediaMapping: MediaMapping = {};
      
      let initialTargets = [];
      try {
        initialTargets = typeof initialPost.targets === 'string' ? JSON.parse(initialPost.targets) : initialPost.targets;
      } catch (e) {}
      
      if (Array.isArray(initialTargets)) {
        initialTargets.forEach((t: any) => {
          newSelected.add(t.social_account_id);
          let po: any = {};
          if (t.platform_options) {
            try { po = typeof t.platform_options === 'string' ? JSON.parse(t.platform_options) : t.platform_options; } catch(e) {}
          }
          
          const platform = t.platform;
          const defaultState = defaultNetworkState(platform);
          
          newNetStates[t.social_account_id] = {
            ...defaultState,
            customBody: t.custom_body, // can be null/undefined, meaning fallback to global
            firstComment: t.first_comment || '',
            contentType: po.contentType || defaultState.contentType,
            twitterReplySettings: po.replySettings || defaultState.twitterReplySettings,
            twitterThread: po.thread || defaultState.twitterThread,
            twitterPoll: po.poll || defaultState.twitterPoll,
            linkedinVisibility: po.visibility || defaultState.linkedinVisibility,
            linkedinPoll: po.poll || defaultState.linkedinPoll,
            instagramAltText: po.altText || defaultState.instagramAltText,
            instagramLocation: po.location || defaultState.instagramLocation,
            instagramCollabAccount: po.collabAccount || defaultState.instagramCollabAccount,
            youtubeVisibility: po.visibility || defaultState.youtubeVisibility,
            youtubePoll: po.poll || defaultState.youtubePoll,
            tiktokPrivacy: po.privacy || defaultState.tiktokPrivacy,
            tiktokAllowComments: po.allowComments ?? defaultState.tiktokAllowComments,
            tiktokAllowDuet: po.allowDuet ?? defaultState.tiktokAllowDuet,
            tiktokAllowStitch: po.allowStitch ?? defaultState.tiktokAllowStitch,
            threadsReplySettings: po.replySettings || defaultState.threadsReplySettings
          };
          
          if (po.media_urls && Array.isArray(po.media_urls) && po.media_urls.length > 0) {
            newMediaMapping[t.social_account_id] = {
              previewUrl: po.media_urls[0],
              uploadedUrl: po.media_urls[0],
              fileName: 'Custom Media'
            };
          }
        });
      }
      
      setSelectedAccountIds(newSelected);
      setNetworkStates(newNetStates);
      setMediaMapping(newMediaMapping);
      
      if (newSelected.size > 0 && Array.isArray(initialTargets)) {
        // If any target has custom body or thread or specific media, turn on customize mode
        const hasCustom = initialTargets.some((t: any) => t.custom_body || t.first_comment || (t.platform_options && t.platform_options.includes('media_urls')));
        setCustomizePerNetwork(hasCustom);
      }
    }
  }, [initialPost]);

  // Lowest char limit across selected platforms
  const lowestCharLimit = (() => {
    const limits = Array.from(selectedAccountIds)
      .map(id => accounts.find(a => a.id === id)?.platform)
      .filter(Boolean)
      .map(p => PLATFORM_META[p]?.charLimit || 99999);
    return limits.length ? Math.min(...limits) : 99999;
  })();

  const masterCharCount = body.length;
  const masterOverLimit = lowestCharLimit !== 99999 && masterCharCount > lowestCharLimit;

  // Active preview account
  const previewAccount = activeNetworkId
    ? accounts.find(a => a.id === activeNetworkId)
    : selectedAccountIds.size > 0
    ? accounts.find(a => selectedAccountIds.has(a.id))
    : null;

  const previewNetworkState = previewAccount
    ? getNetworkState(previewAccount.id, previewAccount.platform)
    : null;

  const previewText = previewNetworkState?.customBody !== undefined
    ? previewNetworkState.customBody
    : body;

  // Preview media: account-specific mapping takes full priority over master pool
  const previewMediaUrls = previewAccount && mediaMapping[previewAccount.id]
    ? (mediaMapping[previewAccount.id].uploadedUrl
        ? [mediaMapping[previewAccount.id].uploadedUrl as string]
        : [mediaMapping[previewAccount.id].previewUrl])
    : mediaUrls;

  // ── Media Mapping handlers ────────────────────────────────────────────────

  const handleMediaAssign = useCallback(async (accountIds: string[], file: File) => {
    // 1. Immediately register with local preview URL (optimistic)
    const localPreviewUrl = URL.createObjectURL(file);
    setMediaMapping(prev => {
      const next = { ...prev };
      for (const id of accountIds) {
        // P2.4: revoke old blob URL before replacing it
        if (next[id]?.previewUrl && next[id].previewUrl !== next[id].uploadedUrl) {
          const stillUsedElsewhere = Object.values(next).some(
            (v, _) => v !== next[id] && v.previewUrl === next[id].previewUrl
          );
          if (!stillUsedElsewhere) URL.revokeObjectURL(next[id].previewUrl);
        }
        next[id] = { previewUrl: localPreviewUrl, uploadedUrl: null, fileName: file.name };
      }
      return next;
    });

    // 2. Upload to server
    try {
      const urls = await api.uploadMedia([file]);
      const uploadedUrl = urls[0];
      setMediaMapping(prev => {
        const next = { ...prev };
        for (const id of accountIds) {
          if (next[id]) {
            // Replace previewUrl with uploadedUrl so the blob is no longer referenced
            next[id] = { ...next[id], uploadedUrl, previewUrl: uploadedUrl };
          }
        }
        // F3: revoke the local blob once — after the loop, when no entry points to it
        const stillReferenced = Object.values(next).some(v => v.previewUrl === localPreviewUrl);
        if (!stillReferenced) URL.revokeObjectURL(localPreviewUrl);
        return next;
      });
    } catch (err: any) {
      // Rollback on failure — remove mapping and revoke blob
      setMediaMapping(prev => {
        const next = { ...prev };
        for (const id of accountIds) delete next[id];
        // F3: revoke once after all deletions
        const stillReferenced = Object.values(next).some(v => v.previewUrl === localPreviewUrl);
        if (!stillReferenced) URL.revokeObjectURL(localPreviewUrl);
        return next;
      });
      toast.error(`Upload failed: ${err.message}`);
    }
  }, [api]);

  const handleMediaRemove = useCallback((accountId: string) => {
    setMediaMapping(prev => {
      const next = { ...prev };
      // P2.4: revoke blob URL on remove (only if not shared)
      const previewUrl = next[accountId]?.previewUrl;
      if (previewUrl) {
        const others = Object.values(next).filter(
          (v, _) => v !== next[accountId] && v.previewUrl === previewUrl
        );
        if (others.length === 0) URL.revokeObjectURL(previewUrl);
      }
      delete next[accountId];
      return next;
    });
  }, []);

  // ── Media upload ─────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (mediaUrls.length + files.length > 10) return toast.error('Max 10 media files');
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

  // ── Submit ────────────────────────────────────────────────────────────────

  const resetComposer = () => {
    // P2.4: revoke all blob preview URLs before clearing mediaMapping
    const prevMapping = mediaMapping;
    const revokedUrls = new Set<string>();
    for (const entry of Object.values(prevMapping)) {
      if (entry.previewUrl && !revokedUrls.has(entry.previewUrl)) {
        URL.revokeObjectURL(entry.previewUrl);
        revokedUrls.add(entry.previewUrl);
      }
    }
    // Reset
    setBody('');
    setMediaUrls([]);
    setLinkUrl('');
    setScheduledAt('');
    setSelectedAccountIds(new Set());
    setNetworkStates({});
    setCustomizePerNetwork(false);
    setActiveNetworkId(null);
    setMediaMapping({});
    onPostCreated();
  };

  const handleSubmit = async (mode: 'draft' | 'schedule' | 'now') => {
    if (selectedAccountIds.size === 0) return toast.error('Select at least one account');

    // P0.2: guard against in-progress uploads
    const pendingUploads = Array.from(selectedAccountIds)
      .filter(id => mediaMapping[id] && !mediaMapping[id].uploadedUrl);
    if (isUploading || pendingUploads.length > 0) {
      return toast.error('Espera a que termine de subir el media antes de publicar');
    }

    // P2.5: correct type-safe content/media check
    for (const id of Array.from(selectedAccountIds)) {
      const acct = accounts.find(a => a.id === id);
      if (!acct) continue;
      const ns = getNetworkState(id, acct.platform);
      const text = ns.customBody !== undefined ? ns.customBody : body;
      const hasMedia = Boolean(mediaMapping[id]) || mediaUrls.length > 0;
      if (!text.trim() && !hasMedia) {
        return toast.error(`Account ${acct.display_name || acct.platform} has no content or media.`);
      }
    }

    // P0.1: validate scheduled date is future
    if (mode === 'schedule') {
      if (!scheduledAt) return toast.error('Selecciona fecha y hora para programar');
      if (new Date(scheduledAt).getTime() <= Date.now()) {
        return toast.error('La fecha de programación debe ser futura');
      }
    }

    // Validate per-platform
    for (const id of Array.from(selectedAccountIds)) {
      const acct = accounts.find(a => a.id === id);
      if (!acct) continue;
      const ns = getNetworkState(id, acct.platform);
      const text = ns.customBody !== undefined ? ns.customBody : body;
      const meta = PLATFORM_META[acct.platform];
      if (meta && text.length > meta.charLimit) {
        return toast.error(`Text too long for ${meta.label} (limit: ${meta.charLimit} chars)`);
      }
      // P2.1: check mediaMapping[id] too for TikTok (media may be per-account via MediaMapper)
      if (acct.platform === 'tiktok' && mediaUrls.length === 0 && !mediaMapping[id]) {
        return toast.error('TikTok requires at least one video');
      }
      if (acct.platform === 'instagram' && mediaUrls.length === 0 && !mediaMapping[id]) {
        return toast.error('Instagram requires at least one image or video');
      }
    }

    setIsSubmitting(true);
    try {
      const custom_bodies: Record<string, string> = {};
      const network_first_comments: Record<string, string> = {};
      const network_options: Record<string, any> = {};

      for (const id of Array.from(selectedAccountIds)) {
        const acct = accounts.find(a => a.id === id);
        if (!acct) continue;
        const ns = getNetworkState(id, acct.platform);
        if (ns.customBody !== undefined && ns.customBody !== body) {
          custom_bodies[id] = ns.customBody;
        }
        if (ns.firstComment.trim()) {
          network_first_comments[id] = ns.firstComment.trim();
        }
        // Build platform_options
        const opts: Record<string, any> = { contentType: ns.contentType };
        if (acct.platform === 'twitter') {
          opts.replySettings = ns.twitterReplySettings;
          if (ns.twitterPoll) opts.poll = ns.twitterPoll;
          if (ns.contentType === 'Thread' && ns.twitterThread?.length > 0) {
            opts.thread = ns.twitterThread.filter(t => t.trim().length > 0);
          }
        }
        if (acct.platform === 'linkedin') {
          opts.visibility = ns.linkedinVisibility;
          if (ns.linkedinPoll) opts.poll = ns.linkedinPoll;
        }
        if (acct.platform === 'instagram') {
          if (ns.instagramAltText) opts.altText = ns.instagramAltText;
          if (ns.instagramLocation) opts.location = ns.instagramLocation;
          if (ns.instagramCollabAccount) opts.collabAccount = ns.instagramCollabAccount;
        }
        if (acct.platform === 'youtube') {
          opts.visibility = ns.youtubeVisibility;
          if (ns.youtubePoll) opts.poll = ns.youtubePoll;
        }
        if (acct.platform === 'tiktok') {
          opts.privacy = ns.tiktokPrivacy;
          opts.allowComments = ns.tiktokAllowComments;
          opts.allowDuet = ns.tiktokAllowDuet;
          opts.allowStitch = ns.tiktokAllowStitch;
        }
        if (acct.platform === 'threads') {
          opts.replySettings = ns.threadsReplySettings;
        }
        // Per-account media override: replaces master pool completely for this account
        const accountMedia = mediaMapping[id];
        if (accountMedia?.uploadedUrl) {
          opts.media_urls = [accountMedia.uploadedUrl];
        } else if (mediaUrls.length > 0 && !accountMedia) {
          // No specific assignment: use master pool (handled by backend default)
        }
        network_options[id] = opts;
      }

      // Build per-account media_urls map so backend can override correctly
      const network_media_urls: Record<string, string[]> = {};
      for (const id of Array.from(selectedAccountIds)) {
        const accountMedia = mediaMapping[id];
        if (accountMedia?.uploadedUrl) {
          network_media_urls[id] = [accountMedia.uploadedUrl];
        }
      }

      const payload = {
        body,
        link_url: linkUrl || undefined,
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
        scheduled_at: mode === 'schedule' && scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        account_ids: Array.from(selectedAccountIds),
        status: mode === 'draft' ? 'draft' : 'scheduled',
        custom_bodies: Object.keys(custom_bodies).length > 0 ? custom_bodies : undefined,
        network_first_comments: Object.keys(network_first_comments).length > 0 ? network_first_comments : undefined,
        network_options: Object.keys(network_options).length > 0 ? network_options : undefined,
        network_media_urls: Object.keys(network_media_urls).length > 0 ? network_media_urls : undefined,
      };

      let post;
      if (initialPost?.id) {
        post = await api.updatePost(initialPost.id, payload);
      } else {
        post = await api.createPost(payload);
      }

      if (mode === 'now') {
        try {
          await api.publishNow(post.id);
          toast.success('🚀 Published!');
        } catch (publishErr: any) {
          // Post already created: degrade to draft so it doesn't sit in queue as
          // "scheduled" with no scheduled_at date (the scheduler will never pick it up).
          try { await api.updatePost(post.id, { status: 'draft' }); } catch { /* best effort */ }
          toast.error(`No se pudo publicar: ${publishErr.message}. El post quedó en la cola, revísalo ahí.`);
          resetComposer();
          return;
        }
      } else if (mode === 'schedule') {
        toast.success('📅 Scheduled!');
      } else {
        toast.success('📝 Saved as draft');
      }

      resetComposer();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-0 flex overflow-hidden w-full">

      {/* ── Left: Composer ────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col min-w-0">
        
        {/* No accounts */}
        {!loadingAccounts && accounts.length === 0 && (
          <div className="flex-1 flex flex-col">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="m-auto flex flex-col items-center justify-center py-24 px-12 rounded-2xl border border-white/5 bg-white/[0.02] text-center"
            >
              <div className="size-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
                <Link2 className="size-6 text-violet-400" />
              </div>
              <h3 className="text-[15px] font-semibold text-white mb-2">Connect your first account</h3>
              <p className="text-[13px] text-slate-500 max-w-xs mb-6 leading-relaxed">
                Connect LinkedIn, YouTube, Facebook, Twitter, or TikTok to start publishing.
              </p>
              <button onClick={onNavigateToAccounts}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white font-semibold text-[13px] transition-colors"
              >
                <Plus className="size-3.5" /> Connect Account
              </button>
            </motion.div>
          </div>
        )}

        {accounts.length > 0 && (
          <>
            {/* Top Static Content */}
            <div className="shrink-0 flex flex-col gap-5 px-6 pt-6 md:px-8 md:pt-8">
            {/* Account selector */}
            <div className="space-y-2.5">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Post to</p>
              <div className="flex flex-wrap gap-1.5">
                {accounts.map(account => {
                  const meta = PLATFORM_META[account.platform];
                  const Icon = meta?.icon || ExternalLink;
                  const selected = selectedAccountIds.has(account.id);
                  return (
                    <button key={account.id} onClick={() => toggleAccount(account)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all duration-150',
                        selected
                          ? `${meta?.activeBg || 'bg-white/10 border-white/20'} ${meta?.color || 'text-white'}`
                          : 'border-white/8 bg-white/[0.02] text-slate-500 hover:text-slate-300 hover:bg-white/5'
                      )}
                    >
                      <Icon className="size-3.5" />
                      <span className="max-w-[110px] truncate">{account.display_name || account.username}</span>
                      {selected && <X className="size-2.5 ml-0.5 opacity-50" />}
                    </button>
                  );
                })}
                <button onClick={onNavigateToAccounts}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/10 text-slate-600 hover:text-slate-400 text-[13px] transition-colors"
                >
                  <Plus className="size-3" /> Add account
                </button>
              </div>
            </div>

            {/* Master composer */}
            <div className={cn("space-y-1.5", customizePerNetwork && "hidden")}>
              <div className={cn(
                'rounded-xl border bg-white/[0.02] overflow-hidden transition-all',
                masterOverLimit ? 'border-red-500/30' : 'border-white/8 focus-within:border-violet-500/25 focus-within:bg-white/[0.03]'
              )}>
                <textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder="What's on your mind? Write your post here..."
                  className="w-full bg-transparent text-white text-[14px] leading-relaxed p-4 resize-none outline-none placeholder:text-slate-700 min-h-[160px]"
                  rows={7}
                />

                {/* Media thumbnails */}
                {mediaUrls.length > 0 && (
                  <div className="px-4 pb-4 grid grid-cols-5 gap-2">
                    {mediaUrls.map((url, i) => {
                      const isVideo = url.match(/\.(mp4|mov)$/i);
                      return (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-white/10 group">
                          {isVideo
                            ? <div className="w-full h-full bg-black/40 flex flex-col items-center justify-center gap-1">
                                <Video className="size-5 text-white/40" />
                                <span className="text-[9px] text-white/40 font-medium">VIDEO</span>
                              </div>
                            : <img src={url} alt="" className="w-full h-full object-cover" />
                          }
                          <button onClick={() => setMediaUrls(prev => prev.filter((_, j) => j !== i))}
                            className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-red-500 rounded text-white opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Link input */}
                <AnimatePresence>
                  {showLinkInput && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden bg-white/[0.02] border-t border-white/5 px-4 py-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="size-3.5 text-blue-400" />
                          <span className="text-[12px] font-semibold text-blue-400">Link URL</span>
                        </div>
                        <button onClick={() => setShowLinkInput(false)} className="text-slate-600 hover:text-slate-400">
                          <X className="size-3.5" />
                        </button>
                      </div>
                      <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                        placeholder="https://example.com"
                        className="w-full bg-transparent text-[13px] text-white placeholder:text-slate-700 outline-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 py-2.5 border-t border-white/5">
                  <div className="flex items-center gap-0.5">
                    <input type="file" multiple accept="image/*,video/mp4,video/quicktime"
                      className="hidden" ref={fileInputRef} onChange={handleFileUpload}
                    />
                    <button onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading || mediaUrls.length >= 10}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-slate-600 hover:text-slate-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
                    >
                      <Image className="size-3.5" />
                      {isUploading ? 'Uploading...' : 'Media'}
                    </button>
                    <button onClick={() => setShowLinkInput(v => !v)}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors',
                        showLinkInput ? 'bg-blue-500/10 text-blue-400' : 'text-slate-600 hover:text-slate-300 hover:bg-white/5'
                      )}
                    >
                      <Link2 className="size-3.5" /> Link
                    </button>
                  </div>
                  <div className={cn('text-[11px] font-mono tabular-nums pr-1 transition-colors', charColor(masterCharCount, lowestCharLimit))}>
                    {lowestCharLimit !== 99999
                      ? `${masterCharCount} / ${lowestCharLimit}`
                      : masterCharCount > 0 ? masterCharCount : ''
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Customize per network button */}
            {selectedAccountIds.size > 0 && (
              <button
                onClick={() => {
                  setCustomizePerNetwork(v => !v);
                  if (!customizePerNetwork && selectedAccountIds.size > 0) {
                    const firstId = Array.from(selectedAccountIds)[0];
                    setActiveNetworkId(firstId);
                  }
                }}
                className={cn(
                  'flex items-center justify-between w-full px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-all duration-200',
                  customizePerNetwork
                    ? 'bg-violet-500/15 border-violet-500/35 text-violet-300'
                    : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white hover:border-white/20'
                )}
              >
                <div className="flex items-center gap-2">
                  <Settings2 className="size-3.5" />
                  Customize for each network
                </div>
                <ChevronDown className={cn('size-3.5 transition-transform duration-200', customizePerNetwork && 'rotate-180')} />
              </button>
            )}
            </div>

            {/* Scrollable Network Cards */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 md:px-8 py-5">
              <AnimatePresence>
              {customizePerNetwork && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-5"
                >
                  {/* ── Media Mapper ──────────────────────────────────── */}
                  <MediaMapper
                    selectedAccounts={Array.from(selectedAccountIds).map(id => accounts.find(a => a.id === id)).filter(Boolean)}
                    mediaMapping={mediaMapping}
                    onAssign={handleMediaAssign}
                    onRemove={handleMediaRemove}
                    isUploading={isUploading}
                  />

                  {/* Divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] text-slate-600 uppercase tracking-widest font-semibold">Text per account</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>

                  {/* ── Per-network cards ─────────────────────────────── */}
                  <div className="space-y-2.5">
                    {Array.from(selectedAccountIds).map(id => {
                      const account = accounts.find(a => a.id === id);
                      if (!account) return null;
                      const ns = getNetworkState(id, account.platform);
                      const assignedMedia = mediaMapping[id];
                      return (
                        <div key={id} className="relative">
                          {/* Media thumbnail badge on card */}
                          {assignedMedia && (
                            <div className="absolute -top-1.5 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25">
                              <div className="size-3.5 rounded overflow-hidden border border-white/20 shrink-0">
                                <img
                                  src={assignedMedia.uploadedUrl || assignedMedia.previewUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <span className="text-[9px] text-emerald-400 font-semibold">
                                {assignedMedia.uploadedUrl ? 'Image assigned' : 'Uploading…'}
                              </span>
                            </div>
                          )}
                          <NetworkCard
                            account={account}
                            state={ns}
                            masterBody={body}
                            isActive={activeNetworkId === id}
                            onActivate={() => setActiveNetworkId(id)}
                            onChange={(patch) => updateNetworkState(id, account.platform, patch)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
              </AnimatePresence>
            </div>

            {/* Bottom Static Content */}
            <div className="shrink-0 flex flex-col gap-5 px-6 pb-6 md:px-8 md:pb-8 pt-1">
              {/* Schedule picker */}
              <div className="space-y-2">
              <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest">Schedule for (optional)</p>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                className="bg-white/[0.03] border border-white/8 rounded-lg px-3.5 py-2 text-[13px] text-slate-300 outline-none focus:border-violet-500/30 w-full md:w-auto [color-scheme:dark] transition-colors"
              />
              </div>
            </div>
          </>
        )}

        {/* Fixed Actions Bar */}
        {accounts.length > 0 && (
          <div className="shrink-0 flex items-center gap-2 px-6 md:px-8 py-4 border-t border-white/5 bg-[#0d1117] relative z-20 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
            {/* P0.1: mutually exclusive Post Now vs Schedule */}
            {!scheduledAt ? (
              <button
                onClick={() => handleSubmit('now')}
                disabled={isSubmitting || masterOverLimit}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] transition-colors shadow-md shadow-violet-500/20"
              >
                <Send className="size-3.5" />
                {isSubmitting ? 'Publishing...' : 'Post Now'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSubmit('schedule')}
                  disabled={isSubmitting || masterOverLimit}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[13px] transition-colors shadow-md shadow-violet-500/20"
                >
                  <Clock className="size-3.5" />
                  {isSubmitting ? 'Scheduling...' : 'Schedule'}
                </button>
                <button
                  onClick={() => setScheduledAt('')}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-slate-600 hover:text-slate-300 text-[12px] transition-colors"
                >
                  <X className="size-3" /> Publicar ahora en vez de programar
                </button>
              </>
            )}
            <button
              onClick={() => handleSubmit('draft')}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-slate-600 hover:text-slate-300 text-[13px] transition-colors"
            >
              <FileEdit className="size-3.5" /> Save Draft
            </button>
          </div>
        )}
      </div>

      {/* ── Right: Preview ────────────────────────────────────────────── */}
      {accounts.length > 0 && (
        <div className="hidden lg:flex flex-col w-[360px] xl:w-[400px] shrink-0 border-l border-white/5 bg-white/[0.01]">
          {/* Preview header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <div className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              <h3 className="text-[12px] font-semibold text-slate-400 uppercase tracking-widest">
                {previewAccount
                  ? `${PLATFORM_META[previewAccount.platform]?.label || previewAccount.platform} Preview`
                  : 'Network Previews'
                }
              </h3>
            </div>
            {/* Preview switcher if multiple selected */}
            {selectedAccountIds.size > 1 && (
              <div className="flex items-center gap-1">
                {Array.from(selectedAccountIds).map(id => {
                  const acc = accounts.find(a => a.id === id);
                  if (!acc) return null;
                  const meta = PLATFORM_META[acc.platform];
                  const Icon = meta?.icon || ExternalLink;
                  return (
                    <button key={id}
                      onClick={() => setActiveNetworkId(id)}
                      title={acc.display_name || acc.username}
                      className={cn(
                        'size-6 rounded-lg flex items-center justify-center transition-all border',
                        (activeNetworkId === id || (!activeNetworkId && Array.from(selectedAccountIds)[0] === id))
                          ? `${meta?.activeBg} border-current ${meta?.color}`
                          : 'bg-white/[0.03] border-white/8 text-slate-600 hover:text-slate-400'
                      )}
                    >
                      <Icon className="size-3" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-6">
            {!previewAccount ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center gap-3">
                <Image className="size-7 opacity-20" />
                <p className="text-[13px] max-w-[180px] leading-relaxed">Select an account to see how your post will look</p>
              </div>
            ) : (
              <PlatformPreview
                account={previewAccount}
                text={previewText}
                mediaUrls={previewMediaUrls}
                linkUrl={linkUrl}
                firstComment={previewNetworkState?.firstComment || ''}
                contentType={previewNetworkState?.contentType || PLATFORM_META[previewAccount.platform]?.contentTypes[0] || 'Post'}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
