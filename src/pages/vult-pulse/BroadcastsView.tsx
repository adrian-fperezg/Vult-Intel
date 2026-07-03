import { useState } from 'react';
import {
    Send, Plus, Clock, CheckCircle2, AlertCircle, ChevronRight,
    Users, BarChart2, Eye, MousePointer, X, Instagram, Facebook, MessageCircle, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

type BroadcastStatus = 'sent' | 'scheduled' | 'draft' | 'failed';
type Platform = 'instagram' | 'facebook' | 'whatsapp' | 'all';

interface Broadcast {
    id: string;
    name: string;
    message: string;
    platform: Platform;
    segment: string;
    status: BroadcastStatus;
    scheduledAt?: string;
    sentAt?: string;
    recipients: number;
    delivered: number;
    opened: number;
    clicked: number;
}

const MOCK_BROADCASTS: Broadcast[] = [
    {
        id: '1', name: 'July Flash Sale 🔥', message: 'Hey {name}! Our biggest sale of the year is here. Tap below to get 40% off any plan today only! 👇',
        platform: 'instagram', segment: 'All Subscribers', status: 'sent', sentAt: 'Jul 2, 12:00 PM',
        recipients: 2187, delivered: 2143, opened: 1854, clicked: 642
    },
    {
        id: '2', name: 'Webinar Reminder — Jul 10', message: "Don't forget! Our free AI Marketing Webinar is tomorrow at 6 PM. Click to save your spot. 🎯",
        platform: 'all', segment: 'Hot Leads', status: 'scheduled', scheduledAt: 'Jul 9, 10:00 AM',
        recipients: 310, delivered: 0, opened: 0, clicked: 0
    },
    {
        id: '3', name: 'Re-engagement Campaign', message: "We miss you! It's been a while. Here's a special 20% discount just for coming back. 💜",
        platform: 'facebook', segment: 'Inactive (30d+)', status: 'draft',
        recipients: 0, delivered: 0, opened: 0, clicked: 0
    },
    {
        id: '4', name: 'New Feature Announcement', message: 'Exciting news! Vult Pulse just launched. Automate your DMs and grow your audience on autopilot. 🚀',
        platform: 'whatsapp', segment: 'Customers', status: 'sent', sentAt: 'Jun 28, 9:00 AM',
        recipients: 456, delivered: 449, opened: 401, clicked: 189
    },
];

const STATUS_STYLES: Record<BroadcastStatus, { label: string; className: string; icon: React.ReactNode }> = {
    sent:      { label: 'Sent',      className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="size-3" /> },
    scheduled: { label: 'Scheduled', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',         icon: <Clock className="size-3" /> },
    draft:     { label: 'Draft',     className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',       icon: <AlertCircle className="size-3" /> },
    failed:    { label: 'Failed',    className: 'bg-red-500/10 text-red-400 border-red-500/20',             icon: <AlertCircle className="size-3" /> },
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    instagram: <Instagram className="size-3.5 text-pink-400" />,
    facebook:  <Facebook className="size-3.5 text-blue-400" />,
    whatsapp:  <MessageCircle className="size-3.5 text-emerald-400" />,
    all:       <Send className="size-3.5 text-violet-400" />,
};

function pct(a: number, b: number) {
    if (!b) return '—';
    return `${Math.round((a / b) * 100)}%`;
}

export default function BroadcastsView() {
    const [showComposer, setShowComposer] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [newName, setNewName] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<Platform>('all');

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-white">Broadcasts</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Send one-time DM campaigns to your subscribers</p>
                </div>
                <button
                    onClick={() => setShowComposer(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20 active:scale-95"
                >
                    <Plus className="size-4" />
                    New Broadcast
                </button>
            </div>

            {/* Broadcasts List */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                {MOCK_BROADCASTS.map(b => {
                    const st = STATUS_STYLES[b.status];
                    return (
                        <div key={b.id} className="bg-[#161b22] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors group cursor-pointer">
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="size-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                                        {PLATFORM_ICONS[b.platform]}
                                    </div>
                                    <div>
                                        <h3 className="text-white font-bold text-sm">{b.name}</h3>
                                        <p className="text-xs text-slate-500 mt-0.5">
                                            {b.sentAt ? `Sent ${b.sentAt}` : b.scheduledAt ? `Scheduled ${b.scheduledAt}` : 'Draft'}
                                            {' · '}{b.segment}
                                        </p>
                                    </div>
                                </div>
                                <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0", st.className)}>
                                    {st.icon}{st.label}
                                </span>
                            </div>

                            <p className="text-slate-400 text-xs leading-relaxed mb-4 line-clamp-2 bg-white/3 rounded-xl px-3 py-2 border border-white/5">
                                {b.message}
                            </p>

                            {b.status === 'sent' && (
                                <div className="grid grid-cols-4 gap-3">
                                    {[
                                        { label: 'Recipients', value: b.recipients.toLocaleString(), icon: <Users className="size-3" /> },
                                        { label: 'Delivered',  value: `${pct(b.delivered, b.recipients)}`, icon: <CheckCircle2 className="size-3" /> },
                                        { label: 'Opened',     value: `${pct(b.opened, b.delivered)}`, icon: <Eye className="size-3" /> },
                                        { label: 'Clicked',    value: `${pct(b.clicked, b.delivered)}`, icon: <MousePointer className="size-3" /> },
                                    ].map(m => (
                                        <div key={m.label} className="bg-white/3 rounded-xl p-3 flex flex-col gap-1">
                                            <div className="flex items-center gap-1 text-slate-500">
                                                {m.icon}
                                                <span className="text-[10px] font-semibold uppercase tracking-wider">{m.label}</span>
                                            </div>
                                            <p className="text-white font-bold text-sm">{m.value}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {b.status === 'scheduled' && (
                                <div className="flex items-center gap-2 text-blue-400 text-xs font-medium">
                                    <Calendar className="size-3.5" />
                                    Will be sent to {b.recipients} subscribers on {b.scheduledAt}
                                </div>
                            )}

                            {b.status === 'draft' && (
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs font-semibold hover:bg-violet-500/20 transition-all">
                                        Edit Draft
                                    </button>
                                    <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold hover:bg-emerald-500/20 transition-all">
                                        <Send className="size-3" /> Schedule & Send
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Composer Modal */}
            {showComposer && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h3 className="text-white font-bold">New Broadcast</h3>
                            <button onClick={() => setShowComposer(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="p-6 flex flex-col gap-4">
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Campaign Name</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    placeholder="e.g. July Flash Sale"
                                    className="w-full bg-white/5 border border-white/8 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Platform</label>
                                <div className="flex gap-2">
                                    {(['all', 'instagram', 'facebook', 'whatsapp'] as const).map(p => (
                                        <button
                                            key={p}
                                            onClick={() => setSelectedPlatform(p)}
                                            className={cn(
                                                "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-semibold transition-all capitalize",
                                                selectedPlatform === p
                                                    ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                                                    : "border-white/8 text-slate-400 hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            {PLATFORM_ICONS[p]}
                                            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Message</label>
                                <p className="text-[10px] text-slate-600 mb-1.5">Use {'{'}{'{'}name{'}'} {'}'} to personalize.</p>
                                <textarea
                                    value={newMessage}
                                    onChange={e => setNewMessage(e.target.value)}
                                    rows={5}
                                    placeholder="Hey {name}! We have something special for you..."
                                    className="w-full bg-white/5 border border-white/8 rounded-xl py-2.5 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 transition-all resize-none"
                                />
                                <p className="text-xs text-slate-600 text-right mt-1">{newMessage.length}/1000</p>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Audience Segment</label>
                                <select className="w-full bg-white/5 border border-white/8 rounded-xl py-2.5 px-4 text-sm text-slate-300 focus:outline-none focus:border-violet-500/50 transition-all appearance-none">
                                    <option>All Subscribers (2,187)</option>
                                    <option>Hot Leads (310)</option>
                                    <option>Customers (456)</option>
                                    <option>Inactive 30d+ (198)</option>
                                    <option>VIP (89)</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 p-6 pt-0">
                            <button
                                onClick={() => setShowComposer(false)}
                                className="flex-1 py-2.5 border border-white/10 text-slate-400 rounded-xl text-sm font-semibold hover:bg-white/5 hover:text-white transition-all"
                            >
                                Save as Draft
                            </button>
                            <button className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20 active:scale-95 flex items-center justify-center gap-2">
                                <Calendar className="size-4" /> Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
