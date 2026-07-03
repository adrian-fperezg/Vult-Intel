import { useState } from 'react';
import {
    MessageSquare, Hash, Heart, Star, Zap, Plus,
    ChevronRight, ArrowRight, Edit, Trash2, X, Check, Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ToolType = 'comment-trigger' | 'keyword-reply' | 'story-mention' | 'welcome-message';

interface GrowthTool {
    id: string;
    type: ToolType;
    name: string;
    description: string;
    trigger: string;
    action: string;
    active: boolean;
    fires: number;
}

const MOCK_TOOLS: GrowthTool[] = [
    {
        id: '1', type: 'comment-trigger',
        name: 'Product Info Comment Trigger',
        description: 'When someone comments a keyword on your posts, auto-send them a DM.',
        trigger: 'Comment contains "info", "precio", or "price"',
        action: 'Send Welcome Flow with product catalog link',
        active: true, fires: 342
    },
    {
        id: '2', type: 'keyword-reply',
        name: '"Free Guide" Keyword Reply',
        description: 'Auto-reply to DMs containing a keyword with a pre-built message.',
        trigger: 'DM contains "free" or "guide" or "gratis"',
        action: 'Send PDF download link + enroll in Lead Nurture flow',
        active: true, fires: 218
    },
    {
        id: '3', type: 'story-mention',
        name: 'Story Mention Responder',
        description: 'When someone mentions you in their story, send them a personalized DM.',
        trigger: 'User mentions @your_account in a Story',
        action: 'Send "Thanks for the mention!" message + offer',
        active: false, fires: 67
    },
    {
        id: '4', type: 'welcome-message',
        name: 'New Follower Welcome',
        description: 'Automatically DM new followers within minutes of following.',
        trigger: 'New follower event',
        action: 'Send Welcome Series flow (3 messages over 48h)',
        active: true, fires: 1204
    },
];

const TYPE_META: Record<ToolType, { icon: React.ReactNode; color: string; label: string }> = {
    'comment-trigger':  { icon: <MessageSquare className="size-4" />, color: 'bg-violet-500/10 text-violet-400',  label: 'Comment Trigger' },
    'keyword-reply':    { icon: <Hash className="size-4" />,          color: 'bg-blue-500/10 text-blue-400',      label: 'Keyword Reply' },
    'story-mention':    { icon: <Star className="size-4" />,          color: 'bg-amber-500/10 text-amber-400',    label: 'Story Mention' },
    'welcome-message':  { icon: <Heart className="size-4" />,         color: 'bg-pink-500/10 text-pink-400',      label: 'Welcome Message' },
};

const TOOL_TEMPLATES = [
    { type: 'comment-trigger' as ToolType, name: 'Comment → DM Trigger', desc: 'When someone comments a keyword, DM them automatically' },
    { type: 'keyword-reply'   as ToolType, name: 'Keyword Auto-Reply',   desc: 'Reply to DMs containing specific words or phrases' },
    { type: 'story-mention'   as ToolType, name: 'Story Mention DM',     desc: 'Auto-DM anyone who mentions you in their story' },
    { type: 'welcome-message' as ToolType, name: 'New Follower Welcome', desc: 'Automatically welcome new followers with a DM' },
];

export default function GrowthToolsView() {
    const [tools, setTools] = useState<GrowthTool[]>(MOCK_TOOLS);
    const [showTemplates, setShowTemplates] = useState(false);

    const toggleActive = (id: string) => {
        setTools(prev => prev.map(t => t.id === id ? { ...t, active: !t.active } : t));
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-bold text-white">Growth Tools</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Trigger automations from comments, keywords, and story mentions</p>
                </div>
                <button
                    onClick={() => setShowTemplates(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-violet-500/20 active:scale-95"
                >
                    <Plus className="size-4" />
                    New Tool
                </button>
            </div>

            {/* Info Banner */}
            <div className="shrink-0 mx-6 mt-4 flex items-start gap-3 bg-blue-500/5 border border-blue-500/15 rounded-xl p-3.5">
                <Info className="size-4 text-blue-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                    Growth Tools run 24/7 and auto-enroll subscribers into flows when triggered. Instagram & Facebook APIs are required for live operation — enable in Settings.
                </p>
            </div>

            {/* Tools List */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-3">
                {tools.map(tool => {
                    const meta = TYPE_META[tool.type];
                    return (
                        <div key={tool.id} className={cn(
                            "bg-[#161b22] border rounded-2xl p-5 transition-all",
                            tool.active ? "border-white/8 hover:border-white/12" : "border-white/4 opacity-70 hover:opacity-90"
                        )}>
                            <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={cn("size-9 rounded-xl flex items-center justify-center", meta.color)}>
                                        {meta.icon}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-white font-bold text-sm">{tool.name}</h3>
                                            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", meta.color, "border-current/20")}>
                                                {meta.label}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">{tool.description}</p>
                                    </div>
                                </div>

                                {/* Toggle */}
                                <button
                                    onClick={() => toggleActive(tool.id)}
                                    className={cn(
                                        "relative shrink-0 w-11 h-6 rounded-full transition-all border",
                                        tool.active
                                            ? "bg-violet-500 border-violet-400"
                                            : "bg-white/8 border-white/15"
                                    )}
                                >
                                    <span className={cn(
                                        "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
                                        tool.active ? "left-5" : "left-0.5"
                                    )} />
                                </button>
                            </div>

                            {/* Trigger + Action */}
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-4">
                                <div className="flex-1 bg-white/3 border border-white/5 rounded-xl px-3 py-2">
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Trigger</p>
                                    <p className="text-xs text-slate-300">{tool.trigger}</p>
                                </div>
                                <ArrowRight className="size-4 text-slate-600 shrink-0" />
                                <div className="flex-1 bg-violet-500/5 border border-violet-500/10 rounded-xl px-3 py-2">
                                    <p className="text-[10px] text-violet-400/60 font-semibold uppercase tracking-wider mb-0.5">Action</p>
                                    <p className="text-xs text-violet-300">{tool.action}</p>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                                    <Zap className="size-3" />
                                    <span>Fired <span className="text-white font-bold">{tool.fires.toLocaleString()}</span> times</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button className="flex items-center gap-1 text-slate-500 hover:text-slate-300 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-white/5">
                                        <Edit className="size-3" /> Edit
                                    </button>
                                    <button className="flex items-center gap-1 text-slate-600 hover:text-red-400 text-xs transition-colors px-2 py-1 rounded-lg hover:bg-red-500/5">
                                        <Trash2 className="size-3" /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Templates Modal */}
            {showTemplates && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-[#161b22] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h3 className="text-white font-bold">Choose a Growth Tool</h3>
                            <button onClick={() => setShowTemplates(false)} className="text-slate-500 hover:text-white transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>
                        <div className="p-4 flex flex-col gap-2">
                            {TOOL_TEMPLATES.map(t => {
                                const meta = TYPE_META[t.type];
                                return (
                                    <button
                                        key={t.type}
                                        onClick={() => setShowTemplates(false)}
                                        className="flex items-center gap-4 p-4 rounded-xl border border-white/5 hover:border-violet-500/30 hover:bg-violet-500/5 text-left transition-all group"
                                    >
                                        <div className={cn("size-10 rounded-xl flex items-center justify-center shrink-0", meta.color)}>
                                            {meta.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white font-semibold text-sm">{t.name}</p>
                                            <p className="text-slate-500 text-xs mt-0.5">{t.desc}</p>
                                        </div>
                                        <ChevronRight className="size-4 text-slate-600 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
