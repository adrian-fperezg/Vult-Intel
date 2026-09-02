import { FileEdit, Clock, Pause, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

// ─── Single source of truth for post status styles ────────────────────────────
// Used by QueueView and CalendarView.

export const STATUS_STYLES: Record<string, {
  label: string; color: string; border: string; bg: string; dot: string; icon: any;
}> = {
  draft:      { label: 'Draft',      color: 'text-slate-400',   border: 'border-slate-500/20',   bg: 'bg-slate-500/5',   dot: 'bg-slate-500',   icon: FileEdit },
  scheduled:  { label: 'Queued',     color: 'text-blue-400',    border: 'border-blue-500/30',    bg: 'bg-blue-500/5',    dot: 'bg-blue-500',    icon: Clock },
  paused:     { label: 'Paused',     color: 'text-amber-400',   border: 'border-amber-500/30',   bg: 'bg-amber-500/5',   dot: 'bg-amber-500',   icon: Pause },
  publishing: { label: 'Publishing', color: 'text-purple-400',  border: 'border-purple-500/30',  bg: 'bg-purple-500/5',  dot: 'bg-purple-500',  icon: RefreshCw },
  published:  { label: 'Published',  color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', dot: 'bg-emerald-500', icon: CheckCircle2 },
  published_partial: { label: 'Partial', color: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/5', dot: 'bg-orange-500', icon: AlertCircle },
  failed:     { label: 'Failed',     color: 'text-red-400',     border: 'border-red-500/30',     bg: 'bg-red-500/5',     dot: 'bg-red-500',     icon: AlertCircle },
  other:      { label: 'Other',      color: 'text-slate-400',   border: 'border-slate-500/20',   bg: 'bg-slate-500/5',   dot: 'bg-slate-500',   icon: FileEdit },
};

export const KNOWN_STATUSES = ['failed', 'published_partial', 'publishing', 'paused', 'scheduled', 'draft', 'published'] as const;
export type KnownStatus = (typeof KNOWN_STATUSES)[number];

