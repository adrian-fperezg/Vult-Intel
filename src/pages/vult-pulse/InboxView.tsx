import { useState, useRef, useEffect } from 'react';
import { Search, Instagram, Facebook, MessageCircle, Send, Paperclip, Smile, Tag, MoreVertical, Check, CheckCheck, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, query, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import { PulseConversation, PulseMessage } from '@/types/pulse';

type Platform = 'instagram' | 'facebook' | 'whatsapp';

interface Conversation extends PulseConversation {
    name?: string;
    lastMessage?: string;
    unread?: number;
}

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
    instagram: <Instagram className="size-3.5 text-pink-400" />,
    facebook:  <Facebook className="size-3.5 text-blue-400" />,
    whatsapp:  <MessageCircle className="size-3.5 text-emerald-400" />,
};

const TAG_COLORS: Record<string, string> = {
    'Hot': 'bg-red-500/15 text-red-400', 'VIP': 'bg-amber-500/15 text-amber-400',
    'Lead': 'bg-blue-500/15 text-blue-400', 'Customer': 'bg-emerald-500/15 text-emerald-400',
};

const QUICK_REPLIES = [
    '¡Hola! Gracias por tu mensaje 👋',
    'El precio del plan Growth es $49/mes.',
    'Sí, tienes 14 días de prueba gratuita.',
    '¿Puedo agendar una demo para ti?',
];

export default function InboxView() {
    const { currentUser } = useAuth();
    const [activeConvoId, setActiveConvoId] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [inputText, setInputText] = useState('');
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [messages, setMessages] = useState<PulseMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Fetch conversations
    useEffect(() => {
        if (!currentUser) return;
        const convosRef = collection(db, 'customers', currentUser.uid, 'pulse_conversations');
        const unsub = onSnapshot(convosRef, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Conversation));
            data.sort((a, b) => new Date(b.updatedAt?.toDate?.() || 0).getTime() - new Date(a.updatedAt?.toDate?.() || 0).getTime());
            setConversations(data);
            setLoading(false);
            if (data.length > 0 && !activeConvoId) {
                setActiveConvoId(data[0].id);
            }
        });
        return () => unsub();
    }, [currentUser]);

    // Fetch messages for active conversation
    useEffect(() => {
        if (!currentUser || !activeConvoId) return;
        const msgsRef = collection(db, 'customers', currentUser.uid, 'pulse_conversations', activeConvoId, 'messages');
        const q = query(msgsRef, orderBy('timestamp', 'asc'));
        const unsub = onSnapshot(q, (snap) => {
            const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PulseMessage));
            setMessages(msgs);
            // Scroll to bottom when new messages arrive
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        });
        return () => unsub();
    }, [currentUser, activeConvoId]);

    const activeConvo = conversations.find(c => c.id === activeConvoId);

    const filteredConvos = conversations.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        c.contactId.toLowerCase().includes(search.toLowerCase())
    );

    const sendMessage = async () => {
        if (!inputText.trim() || !currentUser || !activeConvoId) return;
        const text = inputText;
        setInputText('');
        
        const msgsRef = collection(db, 'customers', currentUser.uid, 'pulse_conversations', activeConvoId, 'messages');
        await addDoc(msgsRef, {
            text,
            sender: 'bot', // Or 'admin'
            timestamp: serverTimestamp()
        });
    };

    return (
        <div className="flex h-full overflow-hidden">
            {/* Left pane — conversation list */}
            <div className="w-72 xl:w-80 shrink-0 flex flex-col border-r border-white/5 bg-[#0d1117]">
                <div className="p-4 border-b border-white/5">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Search conversations..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/8 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/40 transition-all"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {filteredConvos.map(convo => (
                        <button
                            key={convo.id}
                            onClick={() => setActiveConvoId(convo.id)}
                            className={cn(
                                "w-full flex items-start gap-3 px-4 py-3.5 border-b border-white/4 text-left transition-all hover:bg-white/3",
                                activeConvoId === convo.id && "bg-violet-500/8 border-l-2 border-l-violet-500"
                            )}
                        >
                            {/* Avatar */}
                            <div className="relative shrink-0">
                                <div className="size-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                    {convo.name.charAt(0)}
                                </div>
                                <div className="absolute -bottom-0.5 -right-0.5">
                                    {PLATFORM_ICONS[convo.platform]}
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                    <p className={cn("text-sm font-semibold truncate", (convo.unread || 0) > 0 ? "text-white" : "text-slate-300")}>
                                        {convo.name || convo.contactId}
                                    </p>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{convo.lastMessage}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    {/* Tags omitted for now */}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                                <span className="text-[10px] text-slate-500 font-medium whitespace-nowrap">
                                    {convo.updatedAt?.toDate?.() ? convo.updatedAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                </span>
                                {!!convo.unread && convo.unread > 0 && (
                                    <span className="shrink-0 size-5 rounded-full bg-violet-500 text-white text-[10px] font-black flex items-center justify-center">
                                        {convo.unread}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Right pane — conversation */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Conversation Header */}
                <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d1117]">
                    <div className="flex items-center gap-3">
                        <div className="size-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                            {activeConvo?.name?.charAt(0) || '?'}
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm truncate">{activeConvo?.name || activeConvo?.contactId}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                {activeConvo && PLATFORM_ICONS[activeConvo.platform]}
                                {activeConvo?.contactId}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!activeConvo ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <MessageCircle className="size-8 mb-2 opacity-50" />
                            <p>Select a conversation</p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500">
                            <p>No messages yet.</p>
                        </div>
                    ) : (
                        messages.map((msg, i) => {
                            const isMe = msg.sender === 'bot';
                            // Simple clustering
                            const prevMsg = messages[i - 1];
                            const isFirstInCluster = !prevMsg || prevMsg.sender !== msg.sender;
                            
                            const timeStr = msg.timestamp?.toDate?.() ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                            
                            return (
                                <div key={msg.id} className={cn("flex flex-col max-w-[75%]", isMe ? "ml-auto items-end" : "mr-auto items-start", !isFirstInCluster && "mt-1")}>
                                    <div className={cn(
                                        "px-4 py-2 text-sm",
                                        isMe ? "bg-violet-600 text-white rounded-2xl rounded-tr-sm" : "bg-[#161b22] text-slate-200 rounded-2xl rounded-tl-sm border border-white/5"
                                    )}>
                                        {msg.text}
                                    </div>
                                    {isFirstInCluster && (
                                        <div className="flex items-center gap-1 mt-1 px-1">
                                            <span className="text-[10px] text-slate-500">{timeStr}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Replies */}
                <div className="shrink-0 px-6 py-2 border-t border-white/4 flex items-center gap-2 overflow-x-auto no-scrollbar">
                    <span className="text-[10px] text-slate-600 font-semibold shrink-0">Quick:</span>
                    {QUICK_REPLIES.map((r, i) => (
                        <button
                            key={i}
                            onClick={() => setInputText(r)}
                            className="shrink-0 px-3 py-1 bg-white/4 hover:bg-violet-500/10 border border-white/8 hover:border-violet-500/20 rounded-full text-xs text-slate-400 hover:text-violet-300 transition-all"
                        >
                            {r.length > 30 ? r.slice(0, 28) + '…' : r}
                        </button>
                    ))}
                </div>

                {/* Input */}
                    <div className="shrink-0 px-6 py-4 border-t border-white/5 bg-[#0d1117]">
                        <div className="flex items-center gap-3 bg-[#161b22] border border-white/8 rounded-2xl px-4 py-2 focus-within:border-violet-500/40 transition-all">
                            <button className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                                <Smile className="size-5" />
                            </button>
                            <input
                                type="text"
                                placeholder="Type a message..."
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                            />
                            <button className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
                                <Paperclip className="size-5" />
                            </button>
                            <button
                                onClick={sendMessage}
                                disabled={!inputText.trim()}
                                className="size-8 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 shrink-0"
                            >
                                <Send className="size-4" />
                            </button>
                        </div>
                    </div>
                </div>
        </div>
    );
}
