import React from 'react';
import { MessageCircle, GitBranch, Clock, MousePointer, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export const NODE_TYPES = [
    { type: 'message',   label: 'Send Message', desc: 'Send text, images, or buttons', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',   icon: <MessageCircle className="size-4" /> },
    { type: 'condition', label: 'Condition',    desc: 'Split flow with if/then logic', color: 'border-amber-500/30 text-amber-400 bg-amber-500/10', icon: <GitBranch className="size-4" /> },
    { type: 'delay',     label: 'Delay',        desc: 'Wait before next step',         color: 'border-slate-500/30 text-slate-400 bg-slate-500/10', icon: <Clock className="size-4" /> },
    { type: 'action',    label: 'Action',       desc: 'Add tags, notify team',         color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10', icon: <MousePointer className="size-4" /> },
];

export default function FlowSidebar() {
    const onDragStart = (event: React.DragEvent, nodeType: string) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="w-72 bg-[#161b22] border-r border-white/5 flex flex-col h-full z-10 shrink-0">
            <div className="p-4 border-b border-white/5">
                <h3 className="text-sm font-bold text-white">Flow Elements</h3>
                <p className="text-xs text-slate-500 mt-1">Drag and drop elements into the canvas to build your sequence.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Messaging</div>
                <SidebarNode item={NODE_TYPES.find(n => n.type === 'message')!} onDragStart={onDragStart} />
                
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Logic</div>
                <SidebarNode item={NODE_TYPES.find(n => n.type === 'condition')!} onDragStart={onDragStart} />
                <SidebarNode item={NODE_TYPES.find(n => n.type === 'delay')!} onDragStart={onDragStart} />
                
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-4 mb-1">Data & Actions</div>
                <SidebarNode item={NODE_TYPES.find(n => n.type === 'action')!} onDragStart={onDragStart} />
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
