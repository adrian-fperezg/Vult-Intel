import { useState, useRef, useEffect } from 'react';
import { Search, Instagram, Facebook, MessageCircle, Send, Paperclip, Smile, Tag, MoreVertical, Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Platform = 'instagram' | 'facebook' | 'whatsapp';

interface Message {
    id: string;
    from: 'contact' | 'me';
    text: string;
    timestamp: string;
    status?: 'sent' | 'delivered' | 'read';
}

interface Conversation {
    id: string;
    name: string;
    handle: string;
    platform: Platform;
    lastMessage: string;
    lastTime: string;
    unread: number;
    tags: string[];
    messages: Message[];
}

const MOCK_CONVERSATIONS: Conversation[] = [
    {
        id: '1', name: 'Sofia Martínez', handle: '@sofia.mkt', platform: 'instagram', lastMessage: 'Cuánto cuesta el plan pro?', lastTime: '2m', unread: 2, tags: ['Hot'],
        messages: [
            { id: 'm1', from: 'me', text: '👋 Hola Sofia! Gracias por seguirnos. Somos Vult Intel — AI para marketing. ¿En qué podemos ayudarte?', timestamp: '10:00 AM', status: 'read' },
            { id: 'm2', from: 'contact', text: 'Hola! Vi su anuncio. Me interesa saber más sobre la plataforma', timestamp: '10:02 AM' },
            { id: 'm3', from: 'me', text: 'Con gusto! Vult Intel te ayuda a crear estrategias de marketing con IA. Tienes acceso a análisis de marca, generador de contenido, y mucho más 🚀', timestamp: '10:02 AM', status: 'read' },
            { id: 'm4', from: 'contact', text: 'Cuánto cuesta el plan pro?', timestamp: '10:05 AM' },
        ]
    },
    {
        id: '2', name: 'Diego Ruiz', handle: '@diegoruiz', platform: 'whatsapp', lastMessage: 'Ok perfecto, lo pruebo!', lastTime: '1h', unread: 0, tags: ['VIP', 'Customer'],
        messages: [
            { id: 'm1', from: 'contact', text: 'Buenas! Tengo una duda con la factura', timestamp: 'Yesterday 4:00 PM' },
            { id: 'm2', from: 'me', text: 'Claro Diego, cuéntame. Te ayudo de inmediato.', timestamp: 'Yesterday 4:01 PM', status: 'read' },
            { id: 'm3', from: 'contact', text: 'Es que no me llegó el recibo del mes pasado', timestamp: 'Yesterday 4:05 PM' },
            { id: 'm4', from: 'me', text: 'Ya lo reviso! Te lo reenvío en un momento ✅', timestamp: 'Yesterday 4:06 PM', status: 'read' },
            { id: 'm5', from: 'contact', text: 'Ok perfecto, lo pruebo!', timestamp: 'Yesterday 4:20 PM' },
        ]
    },
    {
        id: '3', name: 'Ana López', handle: '@analopez_', platform: 'instagram', lastMessage: 'Muchas gracias!', lastTime: '3h', unread: 0, tags: ['Lead'],
        messages: [
            { id: 'm1', from: 'contact', text: 'Hola! Quiero el ebook de marketing gratuito', timestamp: '8:00 AM' },
            { id: 'm2', from: 'me', text: '¡Genial! Aquí tienes el link para descargarlo 👉 vultintel.com/guide', timestamp: '8:00 AM', status: 'read' },
            { id: 'm3', from: 'contact', text: 'Muchas gracias!', timestamp: '8:05 AM' },
        ]
    },
    {
        id: '4', name: 'Isabel Torres', handle: '@isabelto', platform: 'instagram', lastMessage: 'Tiene prueba gratuita?', lastTime: '10m', unread: 1, tags: ['Hot'],
        messages: [
            { id: 'm1', from: 'contact', text: 'Vi el anuncio. Tiene prueba gratuita?', timestamp: '9:55 AM' },
        ]
    },
    {
        id: '5', name: 'Carlos Herrera', handle: '@c.herrera', platform: 'facebook', lastMessage: 'Ok entendido', lastTime: '1d', unread: 0, tags: ['Customer'],
        messages: [
            { id: 'm1', from: 'contact', text: 'Ok entendido', timestamp: 'Yesterday 2:00 PM' },
        ]
    },
];

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
    const [activeConvoId, setActiveConvoId] = useState<string>('1');
    const [search, setSearch] = useState('');
    const [inputText, setInputText] = useState('');
    const [conversations, setConversations] = useState(MOCK_CONVERSATIONS);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const activeConvo = conversations.find(c => c.id === activeConvoId)!;

    const filteredConvos = conversations.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.handle.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [activeConvoId]);

    const sendMessage = () => {
        if (!inputText.trim()) return;
        setConversations(prev => prev.map(c => {
            if (c.id !== activeConvoId) return c;
            return {
                ...c,
                lastMessage: inputText,
                lastTime: 'now',
                unread: 0,
                messages: [
                    ...c.messages,
                    { id: `m${Date.now()}`, from: 'me' as const, text: inputText, timestamp: 'Now', status: 'sent' as const }
                ]
            };
        }));
        setInputText('');
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
                            onClick={() => {
                                setActiveConvoId(convo.id);
                                setConversations(prev => prev.map(c => c.id === convo.id ? { ...c, unread: 0 } : c));
                            }}
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
                                    <p className={cn("text-sm font-semibold truncate", convo.unread > 0 ? "text-white" : "text-slate-300")}>
                                        {convo.name}
                                    </p>
                                    <span className="text-[10px] text-slate-500 shrink-0 ml-2">{convo.lastTime}</span>
                                </div>
                                <p className="text-xs text-slate-500 truncate">{convo.lastMessage}</p>
                                <div className="flex items-center gap-1 mt-1">
                                    {convo.tags.map(tag => (
                                        <span key={tag} className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold", TAG_COLORS[tag])}>
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {convo.unread > 0 && (
                                <span className="shrink-0 size-5 rounded-full bg-violet-500 text-white text-[10px] font-black flex items-center justify-center">
                                    {convo.unread}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Right pane — conversation */}
            {activeConvo && (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Conversation Header */}
                    <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d1117]">
                        <div className="flex items-center gap-3">
                            <div className="size-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                                {activeConvo.name.charAt(0)}
                            </div>
                            <div>
                                <p className="text-white font-bold text-sm">{activeConvo.name}</p>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                    {PLATFORM_ICONS[activeConvo.platform]}
                                    {activeConvo.handle}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {activeConvo.tags.map(tag => (
                                <span key={tag} className={cn("px-2.5 py-1 rounded-full text-xs font-bold", TAG_COLORS[tag])}>
                                    {tag}
                                </span>
                            ))}
                            <button className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                                <Tag className="size-4" />
                            </button>
                            <button className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 hover:bg-white/5 rounded-lg">
                                <MoreVertical className="size-4" />
                            </button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
                        {activeConvo.messages.map(msg => (
                            <div key={msg.id} className={cn("flex", msg.from === 'me' ? 'justify-end' : 'justify-start')}>
                                <div className={cn(
                                    "max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                    msg.from === 'me'
                                        ? "bg-violet-600 text-white rounded-tr-sm"
                                        : "bg-[#1c2128] text-slate-200 rounded-tl-sm border border-white/5"
                                )}>
                                    <p>{msg.text}</p>
                                    <div className={cn("flex items-center gap-1 mt-1", msg.from === 'me' ? "justify-end" : "justify-start")}>
                                        <span className={cn("text-[10px]", msg.from === 'me' ? "text-violet-300" : "text-slate-500")}>
                                            {msg.timestamp}
                                        </span>
                                        {msg.from === 'me' && msg.status && (
                                            <span className="text-violet-300">
                                                {msg.status === 'read' ? <CheckCheck className="size-3" /> : <Check className="size-3" />}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
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
            )}
        </div>
    );
}
