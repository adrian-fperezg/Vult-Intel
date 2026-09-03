import { useState, useEffect } from 'react';
import { Plus, Zap, MoreVertical, Play, Pause, Copy, Trash2, Users, MessageCircle, TrendingUp, Clock, CheckCircle2, AlertCircle, Edit, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import FlowCanvas from './FlowCanvas';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { PulseFlow, PulseFlowStatus } from '@/types/pulse';

const STATUS_META: Record<PulseFlowStatus, { label: string; className: string; icon: React.ReactNode }> = {
    active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: <CheckCircle2 className="size-3" /> },
    paused: { label: 'Paused', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20',       icon: <AlertCircle className="size-3" /> },
    draft:  { label: 'Draft',  className: 'bg-slate-500/10 text-slate-400 border-slate-500/20',       icon: <Clock className="size-3" /> },
};

export default function FlowsView() {
    const { currentUser } = useAuth();
    const [flows, setFlows] = useState<PulseFlow[]>([]);
    const [loading, setLoading] = useState(true);
    const [openCanvasId, setOpenCanvasId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;
        const flowsRef = collection(db, 'customers', currentUser.uid, 'pulse_flows');
        const unsub = onSnapshot(flowsRef, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PulseFlow));
            // Sort by last updated
            data.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
            setFlows(data);
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    const openFlow = flows.find(f => f.id === openCanvasId);

    const toggleStatus = async (id: string, currentStatus: PulseFlowStatus) => {
        if (!currentUser) return;
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        await updateDoc(doc(db, 'customers', currentUser.uid, 'pulse_flows', id), {
            status: newStatus,
            updatedAt: new Date().toISOString()
        });
    };

    const deleteFlow = async (id: string) => {
        if (!currentUser) return;
        if (!confirm('Are you sure you want to delete this flow?')) return;
        await deleteDoc(doc(db, 'customers', currentUser.uid, 'pulse_flows', id));
    };

    const createNewFlow = async () => {
        if (!currentUser) return;
        const newFlowRef = doc(collection(db, 'customers', currentUser.uid, 'pulse_flows'));
        const now = new Date().toISOString();
        const newFlow: PulseFlow = {
            id: newFlowRef.id,
            name: 'New Automation Flow',
            triggerType: 'Keyword',
            triggerKeyword: 'info',
            status: 'draft',
            subscribers: 0,
            completionRate: 0,
            conversionRate: 0,
            messages: 0,
            lastEdited: 'Just now',
            canvas: { nodes: [], edges: [] },
            createdAt: now,
            updatedAt: now
        };
        await setDoc(newFlowRef, newFlow);
        setOpenCanvasId(newFlowRef.id);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="size-5 text-violet-500 animate-spin mr-2" />
                <span className="text-slate-400 text-sm">Loading flows...</span>
            </div>
        );
    }

    return (
        <>
            {openFlow && (
                <FlowCanvas
                    flow={openFlow}
                    onClose={() => setOpenCanvasId(null)}
                />
            )}

            <div className="flex flex-col h-full overflow-hidden">
                {/* Header */}
                <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-white">Automation Flows</h2>
                        <p className="text-xs text-slate-500 mt-0.5">Build multi-step DM sequences that run on autopilot</p>
                    </div>
                    <button
                        onClick={createNewFlow}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20 active:scale-95"
                    >
                        <Plus className="size-4" />
                        Create Flow
                    </button>
                </div>

                {/* Stats Summary */}
                <div className="shrink-0 grid grid-cols-4 gap-px border-b border-white/5">
                    {[
                        { label: 'Total Flows',     value: flows.length.toString(),                                       icon: <Zap className="size-4 text-violet-400" /> },
                        { label: 'Active',          value: flows.filter(f => f.status === 'active').length.toString(),   icon: <CheckCircle2 className="size-4 text-emerald-400" /> },
                        { label: 'Total Reached',   value: flows.reduce((s, f) => s + f.subscribers, 0).toLocaleString(), icon: <Users className="size-4 text-blue-400" /> },
                        { label: 'Avg. Conversion', value: `${Math.round(flows.filter(f => f.status !== 'draft').reduce((s, f) => s + f.conversionRate, 0) / Math.max(1, flows.filter(f => f.status !== 'draft').length))}%`, icon: <TrendingUp className="size-4 text-amber-400" /> },
                    ].map(s => (
                        <div key={s.label} className="flex items-center gap-3 px-6 py-4 bg-[#0d1117]">
                            {s.icon}
                            <div>
                                <p className="text-white font-black text-lg leading-none">{s.value}</p>
                                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Flow Cards */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                    {flows.map(flow => {
                        const st = STATUS_META[flow.status];
                        return (
                            <div
                                key={flow.id}
                                className="bg-[#161b22] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all group"
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-violet-500/10 border border-violet-500/15 flex items-center justify-center">
                                            <Zap className="size-5 text-violet-400" />
                                        </div>
                                        <div>
                                            <h3 className="text-white font-bold">{flow.name}</h3>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-slate-600 font-semibold uppercase tracking-wider">Trigger:</span>
                                                <span className="text-xs text-slate-500">{flow.triggerType === 'Keyword' ? `Keyword "${flow.triggerKeyword}"` : flow.triggerType}</span>
                                                <span className="text-slate-600">·</span>
                                                <span className="text-xs text-slate-500">{flow.messages} steps</span>
                                                <span className="text-slate-600">·</span>
                                                <span className="text-xs text-slate-500">Edited {new Date(flow.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border", st.className)}>
                                            {st.icon}{st.label}
                                        </span>

                                        {flow.status !== 'draft' && (
                                            <button
                                                onClick={() => toggleStatus(flow.id, flow.status)}
                                                className={cn(
                                                    "size-8 rounded-lg flex items-center justify-center transition-colors shadow-sm",
                                                    flow.status === 'active'
                                                        ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                                )}
                                            >
                                                {flow.status === 'active' ? <Pause className="size-4" /> : <Play className="size-4" />}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => setOpenCanvasId(flow.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs font-semibold hover:bg-violet-500/20 transition-all"
                                        >
                                            <Edit className="size-3" /> Edit
                                        </button>
                                        <button
                                            onClick={() => deleteFlow(flow.id)}
                                            className="size-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                                        >
                                            <Trash2 className="size-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {flow.status !== 'draft' && (
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'Subscribers', value: flow.subscribers.toLocaleString(), icon: <Users className="size-3" />, color: 'text-blue-400' },
                                            { label: 'Completion',  value: `${flow.completionRate}%`,          icon: <CheckCircle2 className="size-3" />, color: 'text-emerald-400' },
                                            { label: 'Conversion',  value: `${flow.conversionRate}%`,          icon: <TrendingUp className="size-3" />, color: 'text-amber-400' },
                                        ].map(m => (
                                            <div key={m.label} className="bg-white/3 rounded-xl p-3 flex flex-col gap-1">
                                                <div className={cn("flex items-center gap-1", m.color)}>
                                                    {m.icon}
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{m.label}</span>
                                                </div>
                                                <p className="text-white font-bold text-sm">{m.value}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {flow.status === 'draft' && (
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setOpenCanvasId(flow.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs font-semibold hover:bg-violet-500/20 transition-all"
                                        >
                                            Build Flow →
                                        </button>
                                        <span className="text-xs text-slate-600">Set up your triggers and messages to publish</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
}
