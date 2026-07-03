import { useState } from 'react';
import { Instagram, Facebook, MessageCircle, CheckCircle2, AlertCircle, Link2, ExternalLink, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'connected' | 'disconnected' | 'error';

interface SocialAccount {
    id: string;
    platform: 'instagram' | 'facebook' | 'whatsapp';
    name: string;
    handle: string;
    status: ConnectionStatus;
    lastSync?: string;
    errorMsg?: string;
}

const MOCK_ACCOUNTS: SocialAccount[] = [
    {
        id: '1', platform: 'instagram', name: 'Vult Intel', handle: '@vultintel',
        status: 'disconnected'
    },
    {
        id: '2', platform: 'facebook', name: 'Vult Intel Official', handle: 'vultintel',
        status: 'disconnected'
    },
    {
        id: '3', platform: 'whatsapp', name: 'Vult Support', handle: '+1 (555) 123-4567',
        status: 'disconnected'
    }
];

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    instagram: <Instagram className="size-6 text-pink-400" />,
    facebook:  <Facebook className="size-6 text-blue-400" />,
    whatsapp:  <MessageCircle className="size-6 text-emerald-400" />,
};

const PLATFORM_THEMES = {
    instagram: 'hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(244,114,182,0.1)]',
    facebook:  'hover:border-blue-500/50 hover:shadow-[0_0_15px_rgba(96,165,250,0.1)]',
    whatsapp:  'hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(52,211,153,0.1)]',
};

export default function SettingsView() {
    const [accounts, setAccounts] = useState<SocialAccount[]>(MOCK_ACCOUNTS);
    const [isConnecting, setIsConnecting] = useState<string | null>(null);

    const handleConnect = (id: string) => {
        setIsConnecting(id);
        // Simulate OAuth flow delay
        setTimeout(() => {
            setAccounts(prev => prev.map(acc => 
                acc.id === id 
                    ? { ...acc, status: 'connected', lastSync: 'Just now' } 
                    : acc
            ));
            setIsConnecting(null);
        }, 1500);
    };

    const handleDisconnect = (id: string) => {
        setAccounts(prev => prev.map(acc => 
            acc.id === id 
                ? { ...acc, status: 'disconnected', lastSync: undefined } 
                : acc
        ));
    };

    return (
        <div className="flex flex-col h-full overflow-y-auto">
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

            <div className="p-8 max-w-4xl">
                <div className="grid gap-6">
                    {accounts.map(acc => (
                        <div key={acc.id} className={cn(
                            "bg-[#161b22] border rounded-2xl p-6 transition-all duration-300",
                            acc.status === 'connected' ? "border-emerald-500/30" : "border-white/10",
                            PLATFORM_THEMES[acc.platform]
                        )}>
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-5">
                                    <div className="size-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                        {PLATFORM_ICONS[acc.platform]}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-lg capitalize">{acc.platform}</h3>
                                        {acc.status === 'connected' ? (
                                            <div className="flex flex-col gap-1 mt-1">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-slate-300 font-medium">{acc.name}</span>
                                                    <span className="text-slate-500">{acc.handle}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                                                    <CheckCircle2 className="size-3.5" />
                                                    Connected · Last sync: {acc.lastSync}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-1 mt-1">
                                                <p className="text-slate-500 text-sm">Not connected</p>
                                                <p className="text-xs text-slate-600">Connect to enable automations for {acc.platform}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    {acc.status === 'connected' ? (
                                        <button 
                                            onClick={() => handleDisconnect(acc.id)}
                                            className="px-4 py-2 border border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 rounded-xl text-sm font-semibold transition-all"
                                        >
                                            Disconnect
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => handleConnect(acc.id)}
                                            disabled={isConnecting === acc.id}
                                            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-slate-200 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isConnecting === acc.id ? (
                                                <>
                                                    <div className="size-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                    Connecting...
                                                </>
                                            ) : (
                                                <>
                                                    <Link2 className="size-4" />
                                                    Connect {acc.platform.charAt(0).toUpperCase() + acc.platform.slice(1)}
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {acc.status === 'connected' && acc.platform === 'instagram' && (
                                <div className="mt-6 pt-5 border-t border-white/5">
                                    <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                                        <ExternalLink className="size-5 text-blue-400 shrink-0" />
                                        <div>
                                            <p className="text-sm font-semibold text-blue-300">Message Control Settings</p>
                                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                Make sure to allow message access in your Instagram App: Settings &gt; Privacy &gt; Messages &gt; Allow Access to Messages.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
