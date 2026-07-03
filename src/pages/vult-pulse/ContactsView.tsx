import { useState } from 'react';
import { Users, Search, Filter, MoreVertical, Tag, Download, Instagram, Facebook, MessageCircle, ChevronDown, Check, Trash2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

type Platform = 'instagram' | 'facebook' | 'whatsapp';

interface Contact {
    id: string;
    name: string;
    handle: string;
    platform: Platform;
    tags: string[];
    lastActive: string;
    subscribedDate: string;
    status: 'active' | 'unsubscribed';
    messagesReceived: number;
}

const MOCK_CONTACTS: Contact[] = [
    { id: '1', name: 'Sofia Martínez', handle: '@sofia.mkt', platform: 'instagram', tags: ['Lead', 'Hot'], lastActive: '2 min ago', subscribedDate: 'Jul 1, 2026', status: 'active', messagesReceived: 12 },
    { id: '2', name: 'Carlos Herrera', handle: '@c.herrera', platform: 'facebook', tags: ['Customer'], lastActive: '1h ago', subscribedDate: 'Jun 29, 2026', status: 'active', messagesReceived: 7 },
    { id: '3', name: 'Ana López', handle: '@analopez_', platform: 'instagram', tags: ['Lead'], lastActive: '3h ago', subscribedDate: 'Jun 28, 2026', status: 'active', messagesReceived: 5 },
    { id: '4', name: 'Diego Ruiz', handle: '@diegoruiz', platform: 'whatsapp', tags: ['VIP', 'Customer'], lastActive: 'Yesterday', subscribedDate: 'Jun 25, 2026', status: 'active', messagesReceived: 21 },
    { id: '5', name: 'Laura Gómez', handle: '@lauragomez', platform: 'instagram', tags: ['Lead', 'Cold'], lastActive: '2d ago', subscribedDate: 'Jun 22, 2026', status: 'active', messagesReceived: 3 },
    { id: '6', name: 'Marcos Vidal', handle: '@marcosvidal', platform: 'facebook', tags: [], lastActive: '5d ago', subscribedDate: 'Jun 18, 2026', status: 'unsubscribed', messagesReceived: 8 },
    { id: '7', name: 'Isabel Torres', handle: '@isabelto', platform: 'instagram', tags: ['Hot', 'VIP'], lastActive: '10 min ago', subscribedDate: 'Jul 2, 2026', status: 'active', messagesReceived: 4 },
    { id: '8', name: 'Javier Mora', handle: '@javiermora_', platform: 'whatsapp', tags: ['Lead'], lastActive: '4h ago', subscribedDate: 'Jun 30, 2026', status: 'active', messagesReceived: 9 },
    { id: '9', name: 'Valentina Cruz', handle: '@vcruz', platform: 'instagram', tags: ['Customer'], lastActive: '1d ago', subscribedDate: 'Jun 26, 2026', status: 'active', messagesReceived: 15 },
    { id: '10', name: 'Rodrigo Pérez', handle: '@rperez', platform: 'facebook', tags: ['Cold'], lastActive: '6d ago', subscribedDate: 'Jun 15, 2026', status: 'active', messagesReceived: 2 },
];

const TAG_COLORS: Record<string, string> = {
    'Lead':       'bg-blue-500/15 text-blue-400 border-blue-500/20',
    'Customer':   'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    'Hot':        'bg-red-500/15 text-red-400 border-red-500/20',
    'Cold':       'bg-slate-500/15 text-slate-400 border-slate-500/20',
    'VIP':        'bg-amber-500/15 text-amber-400 border-amber-500/20',
};

const PLATFORM_ICONS: Record<Platform, React.ReactNode> = {
    instagram: <Instagram className="size-3.5 text-pink-400" />,
    facebook:  <Facebook className="size-3.5 text-blue-400" />,
    whatsapp:  <MessageCircle className="size-3.5 text-emerald-400" />,
};

const PLATFORM_LABELS: Record<Platform, string> = {
    instagram: 'Instagram',
    facebook:  'Facebook',
    whatsapp:  'WhatsApp',
};

const ALL_TAGS = ['Lead', 'Customer', 'Hot', 'Cold', 'VIP'];

export default function ContactsView() {
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
    const [filterTag, setFilterTag] = useState<string>('all');

    const filtered = MOCK_CONTACTS.filter(c => {
        const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.handle.toLowerCase().includes(search.toLowerCase());
        const matchPlatform = filterPlatform === 'all' || c.platform === filterPlatform;
        const matchTag = filterTag === 'all' || c.tags.includes(filterTag);
        return matchSearch && matchPlatform && matchTag;
    });

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedIds(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(c => c.id)));
    };

    const allSelected = selectedIds.size === filtered.length && filtered.length > 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Toolbar */}
            <div className="shrink-0 px-6 py-4 border-b border-white/5 flex flex-wrap items-center gap-3">
                {/* Search */}
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Search contacts..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/8 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500/50 focus:bg-violet-500/5 transition-all"
                    />
                </div>

                {/* Platform Filter */}
                <div className="flex items-center gap-1">
                    {(['all', 'instagram', 'facebook', 'whatsapp'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setFilterPlatform(p)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize",
                                filterPlatform === p
                                    ? "bg-violet-500/20 border border-violet-500/30 text-violet-300"
                                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                            )}
                        >
                            {p === 'all' ? 'All' : PLATFORM_LABELS[p]}
                        </button>
                    ))}
                </div>

                {/* Tag Filter */}
                <select
                    value={filterTag}
                    onChange={e => setFilterTag(e.target.value)}
                    className="bg-white/5 border border-white/8 text-slate-400 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-violet-500/40 appearance-none"
                >
                    <option value="all">All Tags</option>
                    {ALL_TAGS.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                </select>

                <div className="ml-auto flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">{selectedIds.size} selected</span>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 text-violet-400 rounded-lg text-xs font-semibold hover:bg-violet-500/20 transition-all">
                                <Send className="size-3" /> Broadcast
                            </button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-xs font-semibold hover:bg-red-500/20 transition-all">
                                <Trash2 className="size-3" /> Remove
                            </button>
                        </div>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-400 border border-white/8 rounded-lg text-xs font-semibold hover:text-white hover:bg-white/5 transition-all">
                        <Download className="size-3" /> Export
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[#0d1117] border-b border-white/5 z-10">
                        <tr>
                            <th className="px-6 py-3 text-left">
                                <button
                                    onClick={toggleAll}
                                    className={cn(
                                        "size-4 rounded flex items-center justify-center border transition-all",
                                        allSelected ? "bg-violet-500 border-violet-500" : "border-white/20 bg-transparent"
                                    )}
                                >
                                    {allSelected && <Check className="size-3 text-white" />}
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Contact</th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Platform</th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Tags</th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Messages</th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Last Active</th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Subscribed</th>
                            <th className="px-4 py-3 text-left text-xs text-slate-500 font-semibold uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(contact => {
                            const isSelected = selectedIds.has(contact.id);
                            return (
                                <tr
                                    key={contact.id}
                                    className={cn(
                                        "border-b border-white/4 transition-colors group",
                                        isSelected ? "bg-violet-500/5" : "hover:bg-white/2"
                                    )}
                                >
                                    <td className="px-6 py-3.5">
                                        <button
                                            onClick={() => toggleSelect(contact.id)}
                                            className={cn(
                                                "size-4 rounded flex items-center justify-center border transition-all",
                                                isSelected ? "bg-violet-500 border-violet-500" : "border-white/20 bg-transparent"
                                            )}
                                        >
                                            {isSelected && <Check className="size-3 text-white" />}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="size-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                {contact.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-white font-medium text-sm">{contact.name}</p>
                                                <p className="text-slate-500 text-xs">{contact.handle}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex items-center gap-1.5">
                                            {PLATFORM_ICONS[contact.platform]}
                                            <span className="text-slate-400 text-xs">{PLATFORM_LABELS[contact.platform]}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <div className="flex flex-wrap gap-1">
                                            {contact.tags.map(tag => (
                                                <span key={tag} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", TAG_COLORS[tag] || 'bg-slate-500/10 text-slate-400 border-slate-500/20')}>
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3.5 text-slate-400 text-sm">{contact.messagesReceived}</td>
                                    <td className="px-4 py-3.5 text-slate-400 text-xs">{contact.lastActive}</td>
                                    <td className="px-4 py-3.5 text-slate-500 text-xs">{contact.subscribedDate}</td>
                                    <td className="px-4 py-3.5">
                                        <span className={cn(
                                            "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                            contact.status === 'active'
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                : "bg-slate-500/10 text-slate-500 border border-slate-500/20"
                                        )}>
                                            {contact.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3.5">
                                        <button className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-300 transition-all">
                                            <MoreVertical className="size-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                        <Users className="size-10 mb-3 opacity-30" />
                        <p className="font-semibold">No contacts found</p>
                        <p className="text-xs mt-1">Try adjusting your filters</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs text-slate-500">{filtered.length} of {MOCK_CONTACTS.length} contacts</p>
                <p className="text-xs text-slate-600">{MOCK_CONTACTS.filter(c => c.status === 'active').length} active subscribers</p>
            </div>
        </div>
    );
}
