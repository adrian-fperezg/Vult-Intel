import { useState, useEffect } from 'react';
import { Users, Search, Filter, MoreVertical, Tag, Download, Instagram, Facebook, MessageCircle, ChevronDown, Check, Trash2, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { PulseContact } from '@/types/pulse';

type Platform = 'instagram' | 'facebook' | 'whatsapp';

interface Contact extends PulseContact {
    id: string;
    tags?: string[];
    status?: 'active' | 'unsubscribed';
    messagesReceived?: number;
}

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
    const { currentUser } = useAuth();
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [search, setSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [filterPlatform, setFilterPlatform] = useState<Platform | 'all'>('all');
    const [filterTag, setFilterTag] = useState<string>('all');

    useEffect(() => {
        if (!currentUser) return;
        const contactsRef = collection(db, 'customers', currentUser.uid, 'pulse_contacts');
        const unsub = onSnapshot(contactsRef, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Contact));
            data.sort((a, b) => new Date(b.lastInteraction?.toDate?.() || 0).getTime() - new Date(a.lastInteraction?.toDate?.() || 0).getTime());
            setContacts(data);
            setLoading(false);
        });
        return () => unsub();
    }, [currentUser]);

    const filtered = contacts.filter(c => {
        const matchSearch = (c.name || c.id).toLowerCase().includes(search.toLowerCase());
        const matchPlatform = filterPlatform === 'all' || c.platform === filterPlatform;
        const matchTag = filterTag === 'all' || (c.tags && c.tags.includes(filterTag));
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
                        {filtered.map(contact => (
                            <tr key={contact.id} className="border-b border-white/5 hover:bg-white/3 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => toggleSelect(contact.id)}
                                            className={cn(
                                                "size-4 rounded flex items-center justify-center border transition-all",
                                                selectedIds.has(contact.id) ? "bg-violet-500 border-violet-500" : "border-white/20 hover:border-white/40"
                                            )}
                                        >
                                            {selectedIds.has(contact.id) && <Check className="size-3 text-white" />}
                                        </button>
                                        <div className="size-9 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-sm shrink-0">
                                            {(contact.name || '?').charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-sm">{contact.name}</p>
                                            <p className="text-xs text-slate-500">{contact.platform}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-1.5">
                                        {PLATFORM_ICONS[contact.platform]}
                                        <span className="text-slate-300 text-sm capitalize">{contact.platform}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-wrap gap-1.5">
                                        {contact.tags && contact.tags.length > 0 ? (
                                            contact.tags.map(tag => (
                                                <span key={tag} className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", TAG_COLORS[tag] || 'bg-slate-500/15 text-slate-400')}>
                                                    {tag}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-slate-500">—</span>
                                        )}
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-400">
                                    {contact.lastInteraction?.toDate?.() ? contact.lastInteraction.toDate().toLocaleDateString() : 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn(
                                        "px-2 py-1 rounded-full text-xs font-medium border",
                                        contact.status === 'active' || !contact.status ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                                    )}>
                                        {(contact.status || 'active').charAt(0).toUpperCase() + (contact.status || 'active').slice(1)}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-white/5 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                        <MoreVertical className="size-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {filtered.length === 0 && !loading && (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                                <Users className="size-10 mb-3 opacity-30" />
                                <p className="font-semibold">No contacts found</p>
                                <p className="text-xs mt-1">Try adjusting your filters</p>
                            </div>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-3 border-t border-white/5 flex items-center justify-between">
                <p className="text-xs text-slate-500">{filtered.length} of {contacts.length} contacts</p>
                <p className="text-xs text-slate-600">{contacts.filter(c => c.status === 'active' || !c.status).length} active subscribers</p>
            </div>
        </div>
    );
}
