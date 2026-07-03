import { useState } from 'react';
import {
    BarChart2, TrendingUp, Users, MessageCircle,
    MousePointer, Zap, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { cn } from '@/lib/utils';

const SUBSCRIBER_GROWTH = [
    { day: 'Jun 27', subscribers: 1420 },
    { day: 'Jun 28', subscribers: 1535 },
    { day: 'Jun 29', subscribers: 1589 },
    { day: 'Jun 30', subscribers: 1701 },
    { day: 'Jul 1',  subscribers: 1842 },
    { day: 'Jul 2',  subscribers: 2010 },
    { day: 'Jul 3',  subscribers: 2187 },
];

const MESSAGE_VOLUME = [
    { day: 'Jun 27', sent: 310, opened: 220, clicked: 85 },
    { day: 'Jun 28', sent: 480, opened: 360, clicked: 134 },
    { day: 'Jun 29', sent: 390, opened: 280, clicked: 102 },
    { day: 'Jun 30', sent: 600, opened: 455, clicked: 198 },
    { day: 'Jul 1',  sent: 520, opened: 395, clicked: 171 },
    { day: 'Jul 2',  sent: 710, opened: 560, clicked: 243 },
    { day: 'Jul 3',  sent: 645, opened: 498, clicked: 219 },
];

const FLOW_PERFORMANCE = [
    { name: 'Welcome Series', triggered: 842, completed: 701, converted: 312 },
    { name: 'Lead Qualifier', triggered: 530, completed: 420, converted: 198 },
    { name: 'Cart Recovery', triggered: 310, completed: 245, converted: 134 },
    { name: 'Re-engagement', triggered: 220, completed: 165, converted: 54 },
];

const CUSTOM_TOOLTIP = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[#1c2128] border border-[#30363d] rounded-xl px-4 py-3 shadow-2xl text-xs">
            <p className="font-bold text-white mb-2">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="flex items-center gap-2 mb-0.5" style={{ color: p.color }}>
                    <span className="size-2 rounded-full inline-block" style={{ background: p.color }} />
                    {p.name}: <span className="font-bold text-white ml-1">{p.value}</span>
                </p>
            ))}
        </div>
    );
};

interface KpiCardProps {
    label: string;
    value: string;
    change: number;
    icon: React.ReactNode;
    color: string;
}

function KpiCard({ label, value, change, icon, color }: KpiCardProps) {
    const isUp = change >= 0;
    return (
        <div className="bg-[#161b22] border border-white/5 rounded-2xl p-5 flex flex-col gap-3 hover:border-white/10 transition-colors">
            <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-semibold uppercase tracking-widest">{label}</span>
                <div className={cn("size-8 rounded-xl flex items-center justify-center", color)}>{icon}</div>
            </div>
            <p className="text-3xl font-black text-white">{value}</p>
            <div className={cn("flex items-center gap-1 text-xs font-bold", isUp ? 'text-emerald-400' : 'text-red-400')}>
                {isUp ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
                {isUp ? '+' : ''}{change}% vs last 7d
            </div>
        </div>
    );
}

export default function VultPulseAnalytics() {
    return (
        <div className="flex flex-col gap-6 p-6 md:p-8 overflow-y-auto h-full">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="Total Subscribers"
                    value="2,187"
                    change={12.4}
                    icon={<Users className="size-4 text-violet-400" />}
                    color="bg-violet-500/10"
                />
                <KpiCard
                    label="Active Flows"
                    value="8"
                    change={0}
                    icon={<Zap className="size-4 text-amber-400" />}
                    color="bg-amber-500/10"
                />
                <KpiCard
                    label="Messages Sent (7d)"
                    value="3,655"
                    change={18.7}
                    icon={<MessageCircle className="size-4 text-sky-400" />}
                    color="bg-sky-500/10"
                />
                <KpiCard
                    label="Avg. Open Rate"
                    value="77.2%"
                    change={3.1}
                    icon={<MousePointer className="size-4 text-emerald-400" />}
                    color="bg-emerald-500/10"
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Subscriber Growth */}
                <div className="bg-[#161b22] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-1">Subscriber Growth</h3>
                    <p className="text-xs text-slate-500 mb-5">Total DM subscribers over time</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={SUBSCRIBER_GROWTH}>
                            <defs>
                                <linearGradient id="subGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                            <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CUSTOM_TOOLTIP />} />
                            <Area type="monotone" dataKey="subscribers" name="Subscribers" stroke="#8b5cf6" fill="url(#subGrad)" strokeWidth={2} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Message Volume */}
                <div className="bg-[#161b22] border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-white mb-1">Message Engagement</h3>
                    <p className="text-xs text-slate-500 mb-5">Sent, opened, and clicked per day</p>
                    <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={MESSAGE_VOLUME}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                            <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip content={<CUSTOM_TOOLTIP />} />
                            <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                            <Line type="monotone" dataKey="sent" name="Sent" stroke="#60a5fa" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="opened" name="Opened" stroke="#34d399" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="clicked" name="Clicked" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Flow Performance */}
            <div className="bg-[#161b22] border border-white/5 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-1">Flow Performance</h3>
                <p className="text-xs text-slate-500 mb-5">Triggered → Completed → Converted for each automation flow</p>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={FLOW_PERFORMANCE} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                        <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                        <Tooltip content={<CUSTOM_TOOLTIP />} />
                        <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                        <Bar dataKey="triggered" name="Triggered" fill="#8b5cf6" radius={[0,4,4,0]} />
                        <Bar dataKey="completed" name="Completed" fill="#6366f1" radius={[0,4,4,0]} />
                        <Bar dataKey="converted" name="Converted" fill="#34d399" radius={[0,4,4,0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
