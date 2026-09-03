import React from 'react';
import { 
    MessageCircle, GitBranch, Clock, MousePointer, GripVertical, 
    Hash, MessageSquare, AtSign, Megaphone, Video, Image as ImageIcon, 
    LayoutList, Shuffle, Webhook, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const NODE_TYPES = [
    // Triggers
    { category: 'triggers', type: 'trigger_keyword', label: 'Keyword', desc: 'Message contains specific word', color: 'border-violet-500/30 text-violet-400 bg-violet-500/10', icon: <Hash className="size-4" /> },
    { category: 'triggers', type: 'trigger_comment', label: 'Post Comment', desc: 'User comments on a Post/Reel', color: 'border-violet-500/30 text-violet-400 bg-violet-500/10', icon: <MessageSquare className="size-4" /> },
    { category: 'triggers', type: 'trigger_story',   label: 'Story Mention', desc: 'User mentions you in a Story', color: 'border-violet-500/30 text-violet-400 bg-violet-500/10', icon: <AtSign className="size-4" /> },
    { category: 'triggers', type: 'trigger_ad',      label: 'Meta Ad Click', desc: 'User clicks Click-to-Message ad', color: 'border-violet-500/30 text-violet-400 bg-violet-500/10', icon: <Megaphone className="size-4" /> },
    { category: 'triggers', type: 'trigger_live',    label: 'Live Stream', desc: 'User comments on Live Video', color: 'border-violet-500/30 text-violet-400 bg-violet-500/10', icon: <Video className="size-4" /> },
    
    // Messaging
    { category: 'messaging', type: 'message',   label: 'Text Message', desc: 'Send text with optional buttons', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',   icon: <MessageCircle className="size-4" /> },
    { category: 'messaging', type: 'media',     label: 'Media Message', desc: 'Send Image, Video, or Audio', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',   icon: <ImageIcon className="size-4" /> },
    { category: 'messaging', type: 'carousel',  label: 'Carousel', desc: 'Send horizontal scrollable cards', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',   icon: <LayoutList className="size-4" /> },

    // Logic
    { category: 'logic', type: 'condition', label: 'Condition',    desc: 'Split flow with if/then rules', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10', icon: <GitBranch className="size-4" /> },
    { category: 'logic', type: 'delay',     label: 'Smart Delay',  desc: 'Wait before next step',         color: 'border-slate-500/30 text-slate-400 bg-slate-500/10', icon: <Clock className="size-4" /> },
    { category: 'logic', type: 'randomizer',label: 'A/B Split',    desc: 'Randomize traffic flow (A/B Test)', color: 'border-pink-500/30 text-pink-400 bg-pink-500/10', icon: <Shuffle className="size-4" /> },

    // Actions
    { category: 'actions', type: 'action',  label: 'CRM Action',   desc: 'Add tags, subscribe to sequence', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10', icon: <MousePointer className="size-4" /> },
    { category: 'actions', type: 'webhook', label: 'API Request',  desc: 'Send data to Zapier/Make', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10', icon: <Webhook className="size-4" /> },
    { category: 'actions', type: 'ai',      label: 'AI Handover',  desc: 'Let AI Agent take over chat', color: 'border-cyan-500/30 text-cyan-400 bg-cyan-500/10', icon: <Bot className="size-4" /> },
];

export default function FlowSidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-80 bg-[#161b22] border-r border-white/5 flex flex-col h-full z-10 shrink-0">
            <div className="p-4 border-b border-white/5 shrink-0">
                <h3 className="text-sm font-bold text-white">Flow Elements</h3>
                <p className="text-xs text-slate-500 mt-1">Drag and drop elements into the canvas to build your sequence.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/5" /> Triggers <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {NODE_TYPES.filter(n => n.category === 'triggers').map(n => (
                            <SidebarNode key={n.type} item={n} onDragStart={onDragStart} />
                        ))}
                    </div>
                </div>

                <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/5" /> Messaging <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {NODE_TYPES.filter(n => n.category === 'messaging').map(n => (
                            <SidebarNode key={n.type} item={n} onDragStart={onDragStart} />
                        ))}
                    </div>
                </div>
                
                <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/5" /> Logic <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {NODE_TYPES.filter(n => n.category === 'logic').map(n => (
                            <SidebarNode key={n.type} item={n} onDragStart={onDragStart} />
                        ))}
                    </div>
                </div>
                
                <div>
                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <div className="h-px flex-1 bg-white/5" /> Data & Actions <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {NODE_TYPES.filter(n => n.category === 'actions').map(n => (
                            <SidebarNode key={n.type} item={n} onDragStart={onDragStart} />
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
}

function SidebarNode({ item, onDragStart }: { item: typeof NODE_TYPES[0], onDragStart: (e: React.DragEvent, type: string) => void }) {
    return (
        <div
            className="flex items-start gap-3 p-3 rounded-xl border border-white/5 bg-[#0d1117] hover:border-white/20 cursor-grab active:cursor-grabbing transition-colors group"
            onDragStart={(event) => onDragStart(event, item.type)}
            draggable
        >
            <div className={cn("shrink-0 size-8 rounded-lg flex items-center justify-center border", item.color)}>
                {item.icon}
            </div>
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-slate-200">{item.label}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{item.desc}</p>
            </div>
            <GripVertical className="size-4 text-slate-700 group-hover:text-slate-500 transition-colors shrink-0 self-center" />
        </div>
    );
}
