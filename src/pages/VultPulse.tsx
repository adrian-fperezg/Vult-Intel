import { useState } from 'react';
import { useSearchParams, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, Zap, Inbox, Users, Radio,
    BarChart2, Settings, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useUserMetrics } from '@/hooks/useUserMetrics';

import FlowsView      from './vult-pulse/FlowsView';
import InboxView      from './vult-pulse/InboxView';
import ContactsView   from './vult-pulse/ContactsView';
import BroadcastsView from './vult-pulse/BroadcastsView';
import GrowthToolsView from './vult-pulse/GrowthToolsView';
import AnalyticsView  from './vult-pulse/AnalyticsView';

type PulseTab = 'flows' | 'inbox' | 'contacts' | 'broadcasts' | 'growth-tools' | 'analytics';

const TABS: Array<{ id: PulseTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'flows',        label: 'Flows',        icon: <Zap className="size-4" /> },
    { id: 'inbox',        label: 'Inbox',        icon: <Inbox className="size-4" />, badge: 3 },
    { id: 'contacts',     label: 'Contacts',     icon: <Users className="size-4" /> },
    { id: 'broadcasts',   label: 'Broadcasts',   icon: <Radio className="size-4" /> },
    { id: 'growth-tools', label: 'Growth Tools', icon: <MessageCircle className="size-4" /> },
    { id: 'analytics',    label: 'Analytics',    icon: <BarChart2 className="size-4" /> },
];

export default function VultPulse() {
    const { isFounder } = useAuth();
    const { activeAddons, loading } = useUserMetrics();
    const [searchParams, setSearchParams] = useSearchParams();
    const [bannerDismissed, setBannerDismissed] = useState(false);

    const activeTab = (searchParams.get('tab') as PulseTab) || 'flows';
    const setTab = (tab: PulseTab) => setSearchParams({ tab });

    const hasVultPulse = isFounder || activeAddons.includes('vult_pulse');

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-3 text-slate-400">
                    <div className="size-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
                    <span className="text-sm font-medium">Loading Vult Pulse…</span>
                </div>
            </div>
        );
    }

    if (!hasVultPulse) {
        return <Navigate to="/settings" replace />;
    }

    return (
        <div className="flex flex-col h-full w-full overflow-hidden bg-[#0d1117]">
            {/* Module Header */}
            <div className="shrink-0 border-b border-white/5">
                {/* Trial / Founder Banner */}
                <AnimatePresence>
                    {!bannerDismissed && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex items-center justify-between gap-4 px-8 py-2.5 bg-violet-500/10 border-b border-violet-500/20">
                                <div className="flex items-center gap-2 text-sm">
                                    <Zap className="size-3.5 text-violet-400 shrink-0" />
                                    <span className="text-violet-300 font-medium">
                                        {isFounder
                                            ? 'Founder access — Vult Pulse fully unlocked 🚀'
                                            : 'Vult Pulse is active — DM automation running 24/7 ⚡'
                                        }
                                    </span>
                                </div>
                                <button onClick={() => setBannerDismissed(true)} className="text-violet-400/60 hover:text-violet-300 transition-colors">
                                    <X className="size-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="px-4 md:px-8 pt-4 md:pt-6 pb-0">
                    {/* Title + Meta */}
                    <div className="flex items-center gap-3 mb-5">
                        <div className="p-2 bg-violet-500/10 rounded-xl border border-violet-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]">
                            <MessageCircle className="size-5 text-violet-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-white tracking-tight">Vult Pulse</h1>
                            <p className="text-[11px] text-violet-400/60 font-semibold uppercase tracking-widest">Chat Automation</p>
                        </div>
                    </div>

                    {/* Tab Bar */}
                    <nav className="flex items-center gap-0 overflow-x-auto no-scrollbar" role="tablist">
                        {TABS.map(({ id, label, icon, badge }) => {
                            const isActive = activeTab === id;
                            return (
                                <button
                                    key={id}
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setTab(id)}
                                    className={cn(
                                        'relative px-5 pb-3.5 pt-1 text-sm font-semibold transition-colors flex items-center gap-2 shrink-0',
                                        isActive ? 'text-violet-400' : 'text-slate-500 hover:text-slate-300'
                                    )}
                                >
                                    {icon}
                                    {label}
                                    {badge ? (
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                                            isActive ? "bg-violet-500/20 text-violet-300" : "bg-white/10 text-slate-400"
                                        )}>
                                            {badge}
                                        </span>
                                    ) : null}
                                    {isActive && (
                                        <motion.div
                                            layoutId="pulse-tab-underline"
                                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-400 rounded-full"
                                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className="h-full"
                    >
                        {activeTab === 'flows'        && <FlowsView />}
                        {activeTab === 'inbox'        && <InboxView />}
                        {activeTab === 'contacts'     && <ContactsView />}
                        {activeTab === 'broadcasts'   && <BroadcastsView />}
                        {activeTab === 'growth-tools' && <GrowthToolsView />}
                        {activeTab === 'analytics'    && <AnalyticsView />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
