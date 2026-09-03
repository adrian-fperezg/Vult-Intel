import { useCallback, useState, useRef } from 'react';
import ReactFlow, {
    Node, Edge, addEdge, Connection, useNodesState, useEdgesState,
    Background, Controls, MiniMap, Panel, BackgroundVariant, Handle, Position, useReactFlow, ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { MessageCircle, GitBranch, Clock, Zap, MousePointer, X, ChevronDown, Save, Play, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import FlowSidebar from './FlowSidebar';

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

function MessageNode({ id, data }: { id: string, data: any }) {
    const { setNodes } = useReactFlow();

    const updateText = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) {
                    n.data = { ...n.data, label: evt.target.value };
                }
                return n;
            })
        );
    };

    return (
        <div className="bg-[#1c2128] border border-blue-500/30 rounded-2xl px-4 py-4 min-w-[240px] max-w-[280px] shadow-lg hover:border-blue-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-blue-400 !border-blue-300 !size-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !border-blue-300 !size-3" />
            <div className="flex items-center gap-2 mb-3">
                <div className="size-6 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <MessageCircle className="size-3.5 text-blue-400" />
                </div>
                <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Send Message</span>
            </div>
            <textarea 
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg p-2 text-slate-300 text-xs leading-relaxed focus:outline-none focus:border-blue-500/50 resize-none"
                rows={3}
                value={data.label}
                onChange={updateText}
                placeholder="Type your message here..."
            />
            <button className="w-full mt-2 py-1.5 rounded-lg border border-dashed border-white/20 text-slate-400 text-[10px] font-bold hover:bg-white/5 hover:text-white transition-colors">
                + Add Button
            </button>
        </div>
    );
}

function ConditionNode({ id, data }: { id: string, data: any }) {
    const { setNodes } = useReactFlow();

    const updateCondition = (evt: React.ChangeEvent<HTMLSelectElement>) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) {
                    n.data = { ...n.data, conditionType: evt.target.value };
                }
                return n;
            })
        );
    };

    return (
        <div className="bg-[#1c2128] border border-amber-500/30 rounded-2xl px-4 py-4 min-w-[220px] shadow-lg hover:border-amber-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-amber-400 !border-amber-300 !size-3" />
            <Handle type="source" position={Position.Bottom} id="yes" className="!bg-emerald-400 !border-emerald-300 !size-3 !left-[35%]" />
            <Handle type="source" position={Position.Bottom} id="no" className="!bg-red-400 !border-red-300 !size-3 !left-[65%]" />
            <div className="flex items-center gap-2 mb-3">
                <div className="size-6 rounded-lg bg-amber-500/20 flex items-center justify-center">
                    <GitBranch className="size-3.5 text-amber-400" />
                </div>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Condition</span>
            </div>
            <select 
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg p-2 text-slate-300 text-xs focus:outline-none focus:border-amber-500/50 appearance-none"
                value={data.conditionType || 'replied'}
                onChange={updateCondition}
            >
                <option value="replied">Did they reply?</option>
                <option value="has_tag">Has Tag</option>
                <option value="clicked_button">Clicked Button</option>
            </select>
            <div className="flex gap-4 mt-3 px-1 text-[9px] font-bold">
                <span className="text-emerald-400">YES ↙</span>
                <span className="text-red-400 ml-auto">NO ↘</span>
            </div>
        </div>
    );
}

function DelayNode({ id, data }: { id: string, data: any }) {
    const { setNodes } = useReactFlow();

    const updateTime = (evt: React.ChangeEvent<HTMLInputElement>) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) {
                    n.data = { ...n.data, time: evt.target.value };
                }
                return n;
            })
        );
    };

    const updateUnit = (evt: React.ChangeEvent<HTMLSelectElement>) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) {
                    n.data = { ...n.data, unit: evt.target.value };
                }
                return n;
            })
        );
    };

    return (
        <div className="bg-[#1c2128] border border-slate-500/30 rounded-2xl px-4 py-4 min-w-[200px] shadow-lg hover:border-slate-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-slate-400 !border-slate-300 !size-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-slate-400 !border-slate-300 !size-3" />
            <div className="flex items-center gap-2 mb-3">
                <div className="size-6 rounded-lg bg-slate-500/20 flex items-center justify-center">
                    <Clock className="size-3.5 text-slate-400" />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Delay</span>
            </div>
            <div className="flex gap-2">
                <input 
                    type="number"
                    value={data.time || '1'}
                    onChange={updateTime}
                    className="w-16 bg-[#0d1117] border border-white/10 rounded-lg p-2 text-white font-bold text-xs text-center focus:outline-none focus:border-slate-500/50"
                />
                <select 
                    value={data.unit || 'hours'}
                    onChange={updateUnit}
                    className="flex-1 bg-[#0d1117] border border-white/10 rounded-lg p-2 text-slate-300 text-xs focus:outline-none focus:border-slate-500/50 appearance-none"
                >
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                </select>
            </div>
        </div>
    );
}

function ActionNode({ id, data }: { id: string, data: any }) {
    const { setNodes } = useReactFlow();

    const updateAction = (evt: React.ChangeEvent<HTMLSelectElement>) => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === id) {
                    n.data = { ...n.data, actionType: evt.target.value };
                }
                return n;
            })
        );
    };

    return (
        <div className="bg-[#1c2128] border border-emerald-500/30 rounded-2xl px-4 py-4 min-w-[200px] shadow-lg hover:border-emerald-500/50 transition-colors">
            <Handle type="target" position={Position.Top} className="!bg-emerald-400 !border-emerald-300 !size-3" />
            <Handle type="source" position={Position.Bottom} className="!bg-emerald-400 !border-emerald-300 !size-3" />
            <div className="flex items-center gap-2 mb-3">
                <div className="size-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                    <MousePointer className="size-3.5 text-emerald-400" />
                </div>
                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Action</span>
            </div>
            <select 
                className="w-full bg-[#0d1117] border border-white/10 rounded-lg p-2 text-slate-300 text-xs focus:outline-none focus:border-emerald-500/50 appearance-none"
                value={data.actionType || 'add_tag'}
                onChange={updateAction}
            >
                <option value="add_tag">Add Tag: Lead</option>
                <option value="notify_sales">Notify Sales Team</option>
                <option value="remove_tag">Remove Tag</option>
            </select>
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

import { PulseFlow } from '@/types/pulse';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

interface FlowCanvasProps {
    flow: PulseFlow;
    onClose: () => void;
}

function FlowCanvasContent({ flow, onClose }: FlowCanvasProps) {
    const { currentUser } = useAuth();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const [nodes, setNodes, onNodesChange] = useNodesState(flow.canvas?.nodes?.length ? flow.canvas.nodes : INITIAL_NODES);
    const [edges, setEdges, onEdgesChange] = useEdgesState(flow.canvas?.edges?.length ? flow.canvas.edges : INITIAL_EDGES);
    const [saved, setSaved] = useState(false);
    const [flowName, setFlowName] = useState(flow.name);
    const [triggerKeyword, setTriggerKeyword] = useState(flow.triggerKeyword || 'hola');
    const { screenToFlowPosition } = useReactFlow();

    const onConnect = useCallback((connection: Connection) => {
        setEdges(eds => addEdge({ ...connection, animated: false, style: { stroke: '#475569', strokeWidth: 1.5 } }, eds));
    }, [setEdges]);

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const type = event.dataTransfer.getData('application/reactflow');

            // check if the dropped element is valid
            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });
            
            const newNode: Node = {
                id: `node-${Date.now()}`,
                type,
                position,
                data: { label: type === 'message' ? '' : type === 'delay' ? 'Wait 1 hour' : type === 'condition' ? 'If user clicked...' : 'Add tag: Lead' }
            };

            setNodes((nds) => nds.concat(newNode));
        },
        [screenToFlowPosition, setNodes]
    );

    const addNode = (type: string) => {
        const newNode: Node = {
            id: `node-${Date.now()}`,
            type,
            position: { x: 200 + Math.random() * 200, y: 200 + Math.random() * 200 },
            data: { label: type === 'message' ? 'Type your message here...' : type === 'delay' ? 'Wait 1 hour' : type === 'condition' ? 'If user clicked...' : 'Add tag: Lead' }
        };
        setNodes(nds => [...nds, newNode]);
    };

    const handleSave = async () => {
        if (!currentUser) return;
        await updateDoc(doc(db, 'customers', currentUser.uid, 'pulse_flows', flow.id), {
            name: flowName,
            triggerKeyword,
            canvas: { nodes, edges },
            updatedAt: new Date().toISOString()
        });
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
                        <input
                            type="text"
                            value={flowName}
                            onChange={(e) => setFlowName(e.target.value)}
                            className="bg-transparent text-white font-bold text-lg border-b border-transparent hover:border-white/20 focus:border-violet-500 focus:outline-none px-1"
                        />
                        <div className="flex items-center gap-2 mt-0.5 px-1">
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Trigger Keyword:</span>
                            <input
                                type="text"
                                value={triggerKeyword}
                                onChange={(e) => setTriggerKeyword(e.target.value)}
                                className="bg-transparent text-xs text-violet-400 font-medium border-b border-transparent hover:border-violet-500/50 focus:border-violet-500 focus:outline-none"
                            />
                        </div>
                    </div>
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

export default function FlowCanvas(props: FlowCanvasProps) {
    return (
        <ReactFlowProvider>
            <FlowCanvasContent {...props} />
        </ReactFlowProvider>
    );
}
