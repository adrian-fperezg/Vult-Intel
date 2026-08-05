import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarViewProps {
  posts: any[];
  loading: boolean;
}

export default function CalendarView({ posts, loading }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getPostsForDay = (day: Date) =>
    posts.filter(p => p.scheduled_at && isSameDay(parseISO(p.scheduled_at), day));

  const STATUS_DOT: Record<string, string> = {
    scheduled: 'bg-violet-500', published: 'bg-emerald-500',
    draft: 'bg-slate-600', failed: 'bg-red-500',
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="max-w-5xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-[15px] font-semibold text-white">{format(currentMonth, 'MMMM yyyy')}</h2>
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
            >Today</button>
            <button
              onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
              className="p-1.5 rounded-md hover:bg-white/8 text-slate-500 hover:text-white transition-all"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-slate-600 uppercase tracking-widest py-2">{d}</div>
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
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayPosts.slice(0, 3).map(post => {
                    return (
                      <div key={post.id} className="flex items-center gap-1.5 py-0.5 px-1.5 rounded bg-white/[0.04]">
                        <div className={cn("size-1 rounded-full shrink-0", STATUS_DOT[post.status] || 'bg-slate-600')} />
                        <span className="text-[10px] text-slate-500 leading-tight line-clamp-1">{post.body}</span>
                      </div>
                    );
                  })}
                  {dayPosts.length > 3 && (
                    <p className="text-[10px] text-slate-700 px-1.5">+{dayPosts.length - 3} more</p>
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
