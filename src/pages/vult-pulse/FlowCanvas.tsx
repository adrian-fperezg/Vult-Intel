import { useCallback, useState } from 'react';
import ReactFlow, {
    Node, Edge, addEdge, Connection, useNodesState, useEdgesState,
    Background, Controls, MiniMap, Panel, BackgroundVariant, Handle, Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { MessageCircle, GitBranch, Clock, Zap, MousePointer, X, ChevronDown, Save, Play, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Custom Node Components ───────────────────────────────────────────────────

function TriggerNode({ data }: { data: any }) {
    return (
        <div className="bg-violet-600 border-2 border-violet-400 rounded-2xl px-5 py-4 min-w-[200px] shadow-xl shadow-violet-500/30">
            <Handle type="source" position={Position.Bottom} className="!bg-violet-300 !border-violet-200 !size-3" />
            <div className="flex items-center gap-2.5 mb-1">
                <Zap className="size-4 text-violet-200" />
                <span className="text-[10px] font-black text-violet-200 uppercase tracking-widest">Trigger</span>
            </div>
            <p className="text-white font-bold text-sm">{data.label}</p>
            <p className="text-violet-200 text-xs mt-0.5">{data.sub || 'When this happens...'}</p>
        </div>
    );
}

function MessageNode({ data }: { data: any }) {
    return (
        <div className="bg-[#1c2128] border border-blue-500/30 rounded-2xl px-5 py-4 min-w-[220px] max-w-[280px] shadow-lg hover:border-blue-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-blue-400 !border-blue-300 !size-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !border-blue-300 !size-3" />
            <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MessageCircle className="size-3.5 text-blue-400" />
                </div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Send Message</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">{data.label}</p>
        </div>
    );
}

function ConditionNode({ data }: { data: any }) {
    return (
        <div className="bg-[#1c2128] border border-amber-500/30 rounded-2xl px-5 py-4 min-w-[200px] shadow-lg hover:border-amber-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-amber-400 !border-amber-300 !size-3" />
            <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-400 !border-emerald-300 !size-3 !left-[35%]" />
            <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-400 !border-red-300 !size-3 !left-[65%]" />
            <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <GitBranch className="size-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Condition</span>
            </div>
            <p className="text-slate-300 text-xs">{data.label}</p>
            <div className="flex gap-4 mt-2 text-[9px] font-bold">
                <span className="text-emerald-400">YES ↙</span>
                <span className="text-red-400 ml-auto">NO ↘</span>
            </div>
        </div>
    );
}

function DelayNode({ data }: { data: any }) {
    return (
        <div className="bg-[#1c2128] border border-slate-500/30 rounded-2xl px-5 py-4 min-w-[180px] shadow-lg hover:border-slate-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-slate-400 !border-slate-300 !size-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !border-slate-300 !size-3" />
            <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-lg bg-slate-500/20 flex items-center justify-center">
                    <Clock className="size-3.5 text-slate-400" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delay</span>
            </div>
            <p className="text-white font-bold text-sm">{data.label}</p>
        </div>
    );
}

function ActionNode({ data }: { data: any }) {
    return (
        <div className="bg-[#1c2128] border border-emerald-500/30 rounded-2xl px-5 py-4 min-w-[200px] shadow-lg hover:border-emerald-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-emerald-400 !border-emerald-300 !size-3" />
            <div className="flex items-center gap-2 mb-2">
                <div className="size-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <MousePointer className="size-3.5 text-emerald-400" />
                </div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Action</span>
            </div>
            <p className="text-slate-300 text-xs">{data.label}</p>
        </div>
    );
}

const NODE_TYPES = {
    trigger:   TriggerNode,
    message:   MessageNode,
    condition: ConditionNode,
    delay:     DelayNode,
    action:    ActionNode,
};

const INITIAL_NODES: Node[] = [
    { id: '1', type: 'trigger',   position: { x: 300, y: 50  }, data: { label: 'New Follower',     sub: 'Instagram · When someone follows you' } },
    { id: '2', type: 'message',   position: { x: 270, y: 200 }, data: { label: '👋 Hey {name}! Thanks for following! We help brands grow with AI-powered marketing. Want to see how?' } },
    { id: '3', type: 'delay',     position: { x: 300, y: 370 }, data: { label: 'Wait 2 hours' } },
    { id: '4', type: 'condition', position: { x: 280, y: 500 }, data: { label: 'Did they reply?' } },
    { id: '5', type: 'message',   position: { x: 100, y: 660 }, data: { label: '🚀 Amazing! Here\'s a free 14-day trial just for you: vultintel.com/trial' } },
    { id: '6', type: 'message',   position: { x: 440, y: 660 }, data: { label: '💜 No worries! Here\'s our free marketing guide anyway: vultintel.com/guide' } },
    { id: '7', type: 'action',    position: { x: 100, y: 820 }, data: { label: 'Add tag: Hot Lead · Notify sales team' } },
];

const INITIAL_EDGES: Edge[] = [
    { id: 'e1-2', source: '1', target: '2', animated: true, style: { stroke: '#8b5cf6', strokeWidth: 2 } },
    { id: 'e2-3', source: '2', target: '3', animated: false, style: { stroke: '#475569', strokeWidth: 1.5 } },
    { id: 'e3-4', source: '3', target: '4', animated: false, style: { stroke: '#475569', strokeWidth: 1.5 } },
    { id: 'e4-5', source: '4', sourceHandle: 'yes', target: '5', animated: true, style: { stroke: '#34d399', strokeWidth: 1.5 }, label: 'Yes', labelStyle: { fill: '#34d399', fontSize: 11, fontWeight: 700 } },
    { id: 'e4-6', source: '4', sourceHandle: 'no',  target: '6', animated: false, style: { stroke: '#f87171', strokeWidth: 1.5 }, label: 'No', labelStyle: { fill: '#f87171', fontSize: 11, fontWeight: 700 } },
    { id: 'e5-7', source: '5', target: '7', animated: false, style: { stroke: '#475569', strokeWidth: 1.5 } },
];

const NODE_PALETTE = [
    { type: 'message',   label: 'Send Message', color: 'border-blue-500/30 text-blue-400 bg-blue-500/10',   icon: <MessageCircle className="size-4" /> },
    { type: 'condition', label: 'Condition',    color: 'border-amber-500/30 text-amber-400 bg-amber-500/10', icon: <GitBranch className="size-4" /> },
    { type: 'delay',     label: 'Delay',        color: 'border-slate-500/30 text-slate-400 bg-slate-500/10', icon: <Clock className="size-4" /> },
    { type: 'action',    label: 'Action',       color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10', icon: <MousePointer className="size-4" /> },
];

interface FlowCanvasProps {
    flowName: string;
    onClose: () => void;
}

export default function FlowCanvas({ flowName, onClose }: FlowCanvasProps) {
    const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
    const [saved, setSaved] = useState(false);

    const onConnect = useCallback((connection: Connection) => {
        setEdges(eds => addEdge({ ...connection, animated: false, style: { stroke: '#475569', strokeWidth: 1.5 } }, eds));
    }, [setEdges]);

    const addNode = (type: string) => {
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type,
            position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
            data: { label: type === 'message' ? 'Type your message here...' : type === 'delay' ? 'Wait 1 hour' : type === 'condition' ? 'If user clicked...' : 'Add tag: Lead' }
        };
        setNodes(nds => [...nds, newNode]);
    };

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-[#0d1117] z-50 flex flex-col">
            {/* Canvas Toolbar */}
            <div className="shrink-0 flex items-center justify-between px-6 py-3 border-b border-white/5 bg-[#161b22]">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-lg"
                    >
                        <X className="size-5" />
                    </button>
                    <div className="h-5 w-px bg-white/10" />
                    <div>
                        <h2 className="text-white font-bold text-sm">{flowName}</h2>
                        <p className="text-xs text-slate-500">Flow Builder</p>
                    </div>
                </div>

                {/* Node Palette */}
                <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-semibold mr-1">Add step:</span>
                    {NODE_PALETTE.map(n => (
                        <button
                            key={n.type}
                            onClick={() => addNode(n.type)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all hover:scale-105 active:scale-95",
                                n.color
                            )}
                        >
                            {n.icon} {n.label}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-2 text-slate-400 border border-white/8 rounded-xl text-xs font-semibold hover:text-white hover:bg-white/5 transition-all">
                        <Eye className="size-3.5" /> Preview
                    </button>
                    <button
                        onClick={handleSave}
                        className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                            saved
                                ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                                : "bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/20"
                        )}
                    >
                        <Save className="size-3.5" /> {saved ? 'Saved!' : 'Save'}
                    </button>
                    <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all">
                        <Play className="size-3.5" /> Publish
                    </button>
                </div>
            </div>

            {/* ReactFlow Canvas */}
            <div className="flex-1">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={NODE_TYPES}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    defaultEdgeOptions={{ animated: false }}
                    proOptions={{ hideAttribution: true }}
                >
                    <Background variant={BackgroundVariant.Dots} color="#ffffff08" gap={24} size={1} />
                    <Controls className="!bg-[#161b22] !border-white/10 !shadow-xl" />
                    <MiniMap
                        className="!bg-[#161b22] !border-white/10 !rounded-xl"
                        nodeColor={(n) => {
                            if (n.type === 'trigger')   return '#8b5cf6';
                            if (n.type === 'message')   return '#3b82f6';
                            if (n.type === 'condition') return '#f59e0b';
                            if (n.type === 'delay')     return '#64748b';
                            return '#34d399';
                        }}
                        maskColor="#0d111766"
                    />
                    <Panel position="bottom-center">
                        <div className="flex items-center gap-2 bg-[#161b22] border border-white/8 rounded-full px-4 py-2 text-xs text-slate-500">
                            <span>Drag nodes to reposition</span>
                            <span>·</span>
                            <span>Connect handles to build flow</span>
                            <span>·</span>
                            <span>Delete selected: <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-slate-400 font-mono">⌫</kbd></span>
                        </div>
                    </Panel>
                </ReactFlow>
            </div>
        </div>
    );
}
