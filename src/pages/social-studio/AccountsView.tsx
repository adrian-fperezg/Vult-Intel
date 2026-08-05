import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import {
  Link2, Trash2, ExternalLink, CheckCircle2, Lock,
  Linkedin, Twitter, Youtube, Facebook, Instagram, Hash, RefreshCw
} from 'lucide-react';

const PLATFORMS = [
  {
    id: 'youtube',
    name: 'YouTube',
    icon: Youtube,
    color: 'text-red-400',
    bg: 'bg-red-500/8 border-red-500/15',
    activeBg: 'bg-red-500/10 border-red-500/20',
    description: 'Publish to your YouTube community posts',
    envKey: 'GOOGLE_CLIENT_ID',
    available: true,
  },
  {
    id: 'threads',
    name: 'Threads',
    icon: Hash,
    color: 'text-slate-300',
    bg: 'bg-white/[0.03] border-white/8',
    activeBg: 'bg-white/[0.05] border-white/12',
    description: 'Publish posts to your Threads account',
    envKey: 'THREADS_CLIENT_ID',
    available: false,
    setupUrl: 'https://developers.facebook.com/apps',
    setupGuide: 'Create a Meta App → configure Threads App tokens → add to Railway variables',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-400',
    bg: 'bg-blue-500/8 border-blue-500/15',
    activeBg: 'bg-blue-500/10 border-blue-500/20',
    description: 'Publish posts to your LinkedIn profile',
    envKey: 'LINKEDIN_CLIENT_ID',
    available: true,
    setupUrl: 'https://www.linkedin.com/developers/apps',
    setupGuide: 'Create a LinkedIn App → get Client ID & Secret → add to Railway as LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'text-blue-500',
    bg: 'bg-blue-600/8 border-blue-600/15',
    activeBg: 'bg-blue-600/10 border-blue-600/20',
    description: 'Publish to your Facebook Page',
    envKey: 'FACEBOOK_APP_ID',
    available: false,
    setupUrl: 'https://developers.facebook.com/apps',
    setupGuide: 'Create a Meta App → get App ID & Secret → add to Railway as FACEBOOK_APP_ID / FACEBOOK_APP_SECRET',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-400',
    bg: 'bg-pink-500/8 border-pink-500/15',
    activeBg: 'bg-pink-500/10 border-pink-500/20',
    description: 'Publish to Instagram via Facebook',
    envKey: 'FACEBOOK_APP_ID',
    available: true,
    setupUrl: 'https://developers.facebook.com/apps',
    setupGuide: 'Same as Facebook (uses Meta platform) → link your Instagram Business account to your Page',
  },
  {
    id: 'twitter',
    name: 'Twitter / X',
    icon: Twitter,
    color: 'text-sky-400',
    bg: 'bg-sky-500/8 border-sky-500/15',
    activeBg: 'bg-sky-500/10 border-sky-500/20',
    description: 'Publish tweets to your X account',
    envKey: 'TWITTER_CLIENT_ID',
    available: false,
    setupUrl: 'https://developer.twitter.com/en/apps',
    setupGuide: 'Create a Twitter Developer App → get Client ID & Secret → add to Railway as TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    icon: ExternalLink,
    color: 'text-white',
    bg: 'bg-white/[0.03] border-white/8',
    activeBg: 'bg-white/[0.05] border-white/12',
    description: 'Publish videos to TikTok (video required)',
    envKey: 'TIKTOK_CLIENT_KEY',
    available: false,
    setupUrl: 'https://developers.tiktok.com',
    setupGuide: 'Create a TikTok Developer App → get Client Key & Secret → add to Railway as TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET',
  },
];

const BACKEND_URL = import.meta.env.VITE_OUTREACH_API_URL ?? 'http://localhost:3001';

interface AccountsViewProps {
  accounts: any[];
  loading: boolean;
  onRefresh: () => void;
  api: any;
}

export default function AccountsView({ accounts, loading, onRefresh, api }: AccountsViewProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [expandedSetup, setExpandedSetup] = useState<string | null>(null);
  const [providersStatus, setProvidersStatus] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/social/auth/providers/status`)
      .then(res => res.json())
      .then(data => setProvidersStatus(data))
      .catch(console.error);
  }, []);

  const handleDisconnect = async (id: string, name: string) => {
    if (!confirm(`Disconnect ${name}?`)) return;
    setDeletingId(id);
    try {
      await api.deleteAccount(id);
      toast.success(`${name} disconnected`);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally { setDeletingId(null); }
  };

  const handleSync = async (platformId: string) => {
    const accountToSync = accounts.find(a => a.platform === platformId);
    if (!accountToSync) return;

    setSyncingId(platformId);
    try {
      const res = await api.syncAccount(accountToSync.id);
      if (res.count > 0) {
        toast.success(`Successfully synced ${res.count} ${platformId} accounts`);
      } else {
        toast.success('Accounts are already up to date');
      }
      onRefresh();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleConnect = (platformId: string) => {
    const url = api.getConnectUrl(platformId);
    window.location.href = url;
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar bg-[#090b0f]">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 space-y-12">

        {/* Connected accounts */}
        {accounts.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[14px] font-bold text-white tracking-wide">Connected Accounts</h2>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[11px] font-semibold text-slate-300">
                {accounts.length}
              </span>
              <div className="flex-1 h-px bg-white/5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(account => {
                const platform = PLATFORMS.find(p => p.id === account.platform);
                const Icon = platform?.icon || ExternalLink;
                const isSyncingThis = syncingId === account.id;
                const isDeletingThis = deletingId === account.id;

                return (
                  <motion.div
                    key={account.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "relative group overflow-hidden rounded-2xl border transition-all duration-300 bg-[#0d1117]",
                      isSyncingThis ? "border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]" : "border-white/10 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]",
                      (isSyncingThis || isDeletingThis) && "opacity-60 pointer-events-none"
                    )}
                  >
                    {/* Shimmer loading effect */}
                    {isSyncingThis && (
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent z-0" />
                    )}

                    <div className="relative z-10 flex flex-col h-full p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="relative size-14 rounded-xl bg-black/40 flex items-center justify-center overflow-hidden shrink-0 border border-white/5 shadow-inner">
                          {account.avatar_url
                            ? <img src={account.avatar_url} className="size-full object-cover" />
                            : <Icon className={cn("size-6", platform?.color || 'text-slate-400')} />
                          }
                          <div className={cn(
                            "absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-[#0d1117] flex items-center justify-center",
                            platform?.activeBg || "bg-slate-800"
                          )}>
                            <Icon className={cn("size-2.5", platform?.color || 'text-white')} />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="size-3" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Active</span>
                        </div>
                      </div>

                      <div className="flex-1 min-w-0 mb-5">
                        <p className="text-[15px] font-bold text-white truncate" title={account.display_name || account.username}>
                          {account.display_name || account.username}
                        </p>
                        <p className="text-[12px] text-slate-400 capitalize mt-0.5">{account.platform}</p>
                      </div>

                      <div className="flex items-center gap-2 pt-4 border-t border-white/5">
                        <button
                          onClick={() => handleDisconnect(account.id, account.display_name || account.username)}
                          disabled={isDeletingThis}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors text-[12px] font-semibold"
                        >
                          <Trash2 className="size-3.5" /> Disconnect
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Available platforms */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pt-4">
            <h2 className="text-[14px] font-bold text-white tracking-wide">Connect a platform</h2>
            <div className="flex-1 h-px bg-white/5" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PLATFORMS.map(platform => {
              const connected = accounts.some(a => a.platform === platform.id);
              const Icon = platform.icon;
              const isSyncingThis = syncingId === platform.id;

              return (
                <motion.div
                  key={platform.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("rounded-2xl border overflow-hidden transition-colors", platform.bg, isSyncingThis && "opacity-80 pointer-events-none border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]")}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 relative">
                    {/* Shimmer loading effect */}
                    {isSyncingThis && (
                      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-blue-500/10 to-transparent z-0 pointer-events-none" />
                    )}
                    
                    <div className="flex items-center gap-4 flex-1 min-w-0 z-10">
                      <div className="size-11 rounded-xl bg-black/20 flex items-center justify-center shrink-0 border border-white/5">
                        <Icon className={cn("size-5", platform.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-white flex items-center gap-2">
                          {platform.name}
                          {connected && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] uppercase font-bold tracking-wider">Connected</span>}
                        </p>
                        <p className="text-[12px] text-slate-500 mt-0.5">{platform.description}</p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center z-10">
                      {connected ? (
                        <button
                          onClick={() => handleSync(platform.id)}
                          disabled={isSyncingThis}
                          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[13px] font-bold transition-colors"
                        >
                          <RefreshCw className={cn("size-3.5", isSyncingThis && "animate-spin")} />
                          {isSyncingThis ? 'Syncing...' : `Sync ${platform.name}`}
                        </button>
                      ) : (
                        (platform.available || providersStatus[platform.id]) ? (
                          <button
                            onClick={() => handleConnect(platform.id)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[13px] font-bold transition-colors"
                          >
                            <Link2 className="size-3.5" /> Connect
                          </button>
                        ) : (
                          <button
                            onClick={() => setExpandedSetup(expandedSetup === platform.id ? null : platform.id)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-white/10 text-slate-500 hover:text-slate-300 text-[12px] font-semibold transition-colors"
                          >
                            <Lock className="size-3" /> Setup Required
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Setup guide */}
                  {expandedSetup === platform.id && !(platform.available || providersStatus[platform.id]) && (
                    <div className="px-5 pb-5 pt-0 border-t border-white/5 space-y-3 mt-0">
                      <p className="text-[13px] text-slate-400 leading-relaxed pt-4">{platform.setupGuide}</p>
                      {platform.setupUrl && (
                        <a
                          href={platform.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-violet-500/10 text-[12px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          <ExternalLink className="size-3" /> Open Developer Portal
                        </a>
                      )}
                      <p className="text-[11px] text-slate-600 font-medium">
                        After adding env vars, this button will become active automatically.
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
