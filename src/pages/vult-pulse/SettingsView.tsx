import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { useSocialApi } from '@/hooks/useSocialApi';
import { 
    Instagram, Facebook, MessageCircle, CheckCircle2, 
    Link2, ExternalLink, Settings as SettingsIcon, Trash2, 
    Smartphone, Send, Lock, Linkedin
} from 'lucide-react';

const PLATFORMS = [
    {
        id: 'instagram_dm',
        name: 'Instagram DM',
        icon: Instagram,
        color: 'text-pink-400',
        bg: 'bg-pink-500/10 border-pink-500/20',
        activeBg: 'bg-pink-500/15 border-pink-500/40',
        description: 'Automate Instagram Direct Messages',
        type: 'oauth',
        setupRequired: true,
        setupGuide: 'Requires Meta App with instagram_manage_messages permission. Awaiting Meta Review.',
    },
    {
        id: 'facebook',
        name: 'Facebook Messenger',
        icon: Facebook,
        color: 'text-blue-500',
        bg: 'bg-blue-600/10 border-blue-600/20',
        activeBg: 'bg-blue-600/15 border-blue-600/40',
        description: 'Automate Messenger for your Page',
        type: 'oauth',
        setupRequired: true,
        setupGuide: 'Requires Meta App with pages_messaging permission. Ensure FACEBOOK_APP_ID is set.',
    },
    {
        id: 'whatsapp',
        name: 'WhatsApp Business',
        icon: MessageCircle,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10 border-emerald-500/20',
        activeBg: 'bg-emerald-500/15 border-emerald-500/40',
        description: 'Automate WhatsApp Business API',
        type: 'oauth',
        setupRequired: true,
        setupGuide: 'Requires WhatsApp Business Account setup via Meta Developer Portal.',
    },
    {
        id: 'telegram',
        name: 'Telegram Bot',
        icon: Send,
        color: 'text-sky-400',
        bg: 'bg-sky-500/10 border-sky-500/20',
        activeBg: 'bg-sky-500/15 border-sky-500/40',
        description: 'Connect a Telegram Bot via Token',
        type: 'token',
        tokenFields: [{ id: 'botToken', label: 'Bot Token', placeholder: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11' }],
        setupRequired: false,
    },
    {
        id: 'twilio',
        name: 'SMS (Twilio)',
        icon: Smartphone,
        color: 'text-red-400',
        bg: 'bg-red-500/10 border-red-500/20',
        activeBg: 'bg-red-500/15 border-red-500/40',
        description: 'Send and receive SMS messages',
        type: 'token',
        tokenFields: [
            { id: 'accountSid', label: 'Account SID', placeholder: 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' },
            { id: 'authToken', label: 'Auth Token', type: 'password', placeholder: '••••••••••••••••' },
            { id: 'phoneNumber', label: 'Twilio Phone Number', placeholder: '+1234567890' }
        ],
        setupRequired: false,
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: Linkedin,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10 border-blue-500/20',
        activeBg: 'bg-blue-500/15 border-blue-500/40',
        description: 'Automate LinkedIn Messaging',
        type: 'oauth',
        setupRequired: false, // Already configured in your env
    }
];

export default function SettingsView() {
    const [searchParams, setSearchParams] = useSearchParams();
    const api = useSocialApi();
    
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [expandedSetup, setExpandedSetup] = useState<string | null>(null);
    const [expandedToken, setExpandedToken] = useState<string | null>(null);
    const [tokenData, setTokenData] = useState<Record<string, string>>({});
    const [connectingToken, setConnectingToken] = useState<string | null>(null);

    const loadAccounts = useCallback(async () => {
        try {
            setLoading(true);
            const data = await api.getAccounts();
            setAccounts(data || []);
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    }, [api]);

    useEffect(() => {
        loadAccounts();

        const connected = searchParams.get('connected');
        const error = searchParams.get('error');
        if (connected) {
            toast.success(`✅ ${connected.replace('_dm', '').toUpperCase()} connected!`);
            setSearchParams({ tab: 'settings' });
        }
        if (error) {
            toast.error(`Connection error: ${decodeURIComponent(error)}`);
            setSearchParams({ tab: 'settings' });
        }
    }, [api.activeProjectId]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleDisconnect = async (id: string, name: string) => {
        if (!confirm(`Disconnect ${name}?`)) return;
        setDeletingId(id);
        try {
            await api.deleteAccount(id);
            toast.success(`${name} disconnected`);
            loadAccounts();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleOAuthConnect = (platformId: string) => {
        const url = api.getConnectUrl(platformId, 'vult-pulse');
        window.location.href = url;
    };

    const handleTokenConnect = async (platformId: string) => {
        setConnectingToken(platformId);
        try {
            await api.connectTokenAccount(platformId, tokenData);
            toast.success('Connected successfully!');
            setExpandedToken(null);
            setTokenData({});
            loadAccounts();
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setConnectingToken(null);
        }
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="shrink-0 px-8 py-6 border-b border-white/5 bg-[#0d1117] sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-slate-500/10 rounded-xl border border-slate-500/20">
                        <SettingsIcon className="size-5 text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white">Channel Settings</h2>
                        <p className="text-sm text-slate-500 mt-0.5">Connect your social accounts to enable DM automation</p>
                    </div>
                </div>
            </div>

            <div className="p-8 max-w-4xl space-y-6">
                
                {/* Connected Accounts */}
                {accounts.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Connected Channels</h3>
                        <div className="grid gap-4">
                            {accounts.map(account => {
                                const platform = PLATFORMS.find(p => p.id === account.platform);
                                const Icon = platform?.icon || ExternalLink;
                                
                                return (
                                    <motion.div
                                        key={account.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn("flex items-center gap-4 p-5 rounded-2xl border transition-colors", platform?.activeBg || "bg-[#161b22] border-white/10")}
                                    >
                                        <div className="size-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                                            {account.avatar_url 
                                                ? <img src={account.avatar_url} className="size-full object-cover" alt="" />
                                                : <Icon className={cn("size-6", platform?.color || "text-slate-400")} />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-white font-bold text-lg truncate">
                                                {account.display_name || account.username}
                                            </h3>
                                            <div className="flex flex-col gap-1 mt-1">
                                                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                                    <CheckCircle2 className="size-3.5" />
                                                    Connected · {account.platform.replace('_', ' ').toUpperCase()}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleDisconnect(account.id, account.display_name || account.username)}
                                            disabled={deletingId === account.id}
                                            className="px-4 py-2 border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                                        >
                                            {deletingId === account.id ? 'Disconnecting...' : 'Disconnect'}
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Available Channels */}
                <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">Available Channels</h3>
                    
                    {loading && accounts.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">Loading channels...</div>
                    ) : (
                        <div className="grid gap-4">
                            {PLATFORMS.map(platform => {
                                const isConnected = accounts.some(a => a.platform === platform.id);
                                if (isConnected) return null;
                                const Icon = platform.icon;

                                return (
                                    <motion.div
                                        key={platform.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={cn("rounded-2xl border transition-all overflow-hidden", platform.bg)}
                                    >
                                        <div className="flex items-center justify-between gap-4 p-5">
                                            <div className="flex items-center gap-5">
                                                <div className="size-12 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                                                    <Icon className={cn("size-6", platform.color)} />
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-bold text-lg">{platform.name}</h3>
                                                    <p className="text-slate-400 text-sm">{platform.description}</p>
                                                </div>
                                            </div>

                                            <div>
                                                {platform.setupRequired ? (
                                                    <button 
                                                        onClick={() => setExpandedSetup(expandedSetup === platform.id ? null : platform.id)}
                                                        className="flex items-center gap-2 px-4 py-2 border border-white/10 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-semibold transition-all"
                                                    >
                                                        <Lock className="size-4" /> Setup Required
                                                    </button>
                                                ) : platform.type === 'token' ? (
                                                    <button 
                                                        onClick={() => setExpandedToken(expandedToken === platform.id ? null : platform.id)}
                                                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-bold transition-all"
                                                    >
                                                        <Link2 className="size-4" /> Connect
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => handleOAuthConnect(platform.id)}
                                                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-bold transition-all"
                                                    >
                                                        <Link2 className="size-4" /> Connect
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Setup Guide Expansion */}
                                        <AnimatePresence>
                                            {expandedSetup === platform.id && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-white/5 px-5 pb-5 pt-4 bg-black/10"
                                                >
                                                    <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                                        <ExternalLink className="size-5 text-blue-400 shrink-0" />
                                                        <div>
                                                            <p className="text-sm font-semibold text-blue-300">Developer Setup Needed</p>
                                                            <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                                                                {platform.setupGuide}
                                                            </p>
                                                            <a href="https://developers.facebook.com" target="_blank" rel="noreferrer" className="inline-block mt-3 text-xs font-semibold text-blue-400 hover:text-blue-300">
                                                                Go to Developer Portal →
                                                            </a>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>

                                        {/* Token Input Expansion */}
                                        <AnimatePresence>
                                            {expandedToken === platform.id && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="border-t border-white/5 px-5 pb-5 pt-4 bg-black/10"
                                                >
                                                    <div className="space-y-4 max-w-lg">
                                                        {platform.tokenFields?.map(field => (
                                                            <div key={field.id} className="space-y-1.5">
                                                                <label className="text-xs font-semibold text-slate-400">{field.label}</label>
                                                                <input
                                                                    type={field.type || 'text'}
                                                                    placeholder={field.placeholder}
                                                                    value={tokenData[field.id] || ''}
                                                                    onChange={e => setTokenData({...tokenData, [field.id]: e.target.value})}
                                                                    className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-white/30"
                                                                />
                                                            </div>
                                                        ))}
                                                        <div className="pt-2">
                                                            <button 
                                                                onClick={() => handleTokenConnect(platform.id)}
                                                                disabled={connectingToken === platform.id || platform.tokenFields?.some(f => !tokenData[f.id])}
                                                                className="w-full flex justify-center items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white rounded-xl text-sm font-bold transition-all"
                                                            >
                                                                {connectingToken === platform.id ? 'Connecting...' : `Connect ${platform.name}`}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
