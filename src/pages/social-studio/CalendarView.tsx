import { useState, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';
import { useTranslation } from '@/contexts/TranslationContext';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { safeParseDate } from '@/utils/socialParsers';
import { STATUS_STYLES } from '@/constants/socialStatus';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CalendarViewProps {
  posts: any[];
  loading: boolean;
}

// ─── Status dot colors ────────────────────────────────────────────────────────
// Derived from STATUS_STYLES (single source of truth). Calendar uses 'scheduled'
// dot as violet instead of blue so it stands out on the white grid cells.
const STATUS_DOT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.dot])),
  scheduled: 'bg-violet-500', // override: calendar needs higher contrast than STATUS_STYLES blue
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarView({ posts, loading }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { language } = useSettings();
  const { t } = useTranslation();

  const appLocale = useMemo(() => language === 'es' ? es : enUS, [language]);

  // P1.6: show spinner while loading
  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="size-6 border-2 border-t-violet-500 border-white/10 rounded-full animate-spin" />
    </div>
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { locale: appLocale });
  const calEnd = endOfWeek(monthEnd, { locale: appLocale });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  // P1.1 + P1.6: safe date parsing; includes both scheduled and published posts.
  // parseISO converts UTC timestamps to local time. isSameDay compares in local time,
  // so a post at 23:30 UTC may appear on the previous local day if the user is behind UTC.
  // This is intentional — we show dates in the user's local timezone for usability.
  const getPostsForDay = (day: Date) =>
    posts.filter(p => {
      const d = safeParseDate(p.scheduled_at) ?? safeParseDate(p.published_at);
      return d ? isSameDay(d, day) : false;
    });

  // Day header dates — one full week so format() gives locale-correct names
  const dayHeaderDates = eachDayOfInterval({
    start: startOfWeek(new Date(), { locale: appLocale }),
    end: endOfWeek(new Date(), { locale: appLocale }),
  });

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          {/* P2.10 / F5: format with locale → "agosto 2026" in es, "August 2026" in en */}
          <h2 className="text-[15px] font-semibold text-white capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: appLocale })}
          </h2>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/5">
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}
              className="p-1.5 rounded-md hover:bg-white/8 text-slate-500 hover:text-white transition-all"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <button
              onClick={() => setCurrentMonth(new Date())}
              className="px-3 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:text-white hover:bg-white/8 transition-all"
            >
              {/* F5: i18n for "Today" button */}
              {t('calendar.today')}
            </button>
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="p-1.5 rounded-md hover:bg-white/8 text-slate-500 hover:text-white transition-all"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Day headers — locale-aware short names (e.g. "lun" in es, "Mon" in en) */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaderDates.map(d => (
            <div key={d.toISOString()} className="text-center text-[10px] font-semibold text-slate-600 uppercase tracking-widest py-2">
              {/* EEEEEE = narrow weekday (2 chars). Avoids .slice() to stay locale-correct. */}
              {format(d, 'EEEEEE', { locale: appLocale })}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 border border-white/5 rounded-xl overflow-hidden divide-x divide-y divide-white/5">
          {days.map(day => {
            const dayPosts = getPostsForDay(day);
            const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[90px] p-2 transition-colors",
                  !isCurrentMonth && "opacity-25",
                  today ? "bg-violet-500/5" : "bg-white/[0.015] hover:bg-white/[0.03]"
                )}
              >
                <div className={cn(
                  "text-[11px] font-semibold mb-2 size-5 flex items-center justify-center rounded-full leading-none",
                  today ? "bg-violet-500 text-white" : "text-slate-600"
                )}>
                  {format(day, 'd', { locale: appLocale })}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map(post => (
                    <div key={post.id} className="flex items-center gap-1.5 py-0.5 px-1.5 rounded bg-white/[0.04]">
                      <div className={cn("size-1 rounded-full shrink-0", STATUS_DOT[post.status] || 'bg-slate-600')} />
                      <span className="text-[10px] text-slate-500 leading-tight line-clamp-1">{post.body}</span>
                    </div>
                  ))}
                  {/* F5: i18n for "+N more" */}
                  {dayPosts.length > 3 && (
                    <p className="text-[10px] text-slate-700 px-1.5">
                      +{dayPosts.length - 3} {t('calendar.more')}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
