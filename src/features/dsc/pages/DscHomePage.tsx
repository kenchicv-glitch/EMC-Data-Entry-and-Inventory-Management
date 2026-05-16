import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, List, CalendarDays, BarChart3 } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useDscDaysForMonth, useCreateDscDay } from '../hooks/useDscDay';
import { DscDayStatus } from '../components/DscDayStatus';

export default function DscHomePage() {
  const navigate = useNavigate();
  const { activeBranchId } = useBranch();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1;

  const { data: days = [], isLoading } = useDscDaysForMonth(year, month, activeBranchId || '');
  const createDay = useCreateDscDay();

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const firstDayOfWeek = getDay(startOfMonth(currentMonth)); // 0=Sun
  const blanks = (firstDayOfWeek + 6) % 7; // shift to Mon start

  const getDayRecord = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return days.find((d) => d.date === dateStr);
  };

  const handleDayClick = (date: Date) => {
    navigate(`/dsc/${format(date, 'yyyy-MM-dd')}`);
  };

  const handleOpenToday = () => {
    if (!activeBranchId || !user) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const existing = days.find((d) => d.date === today);
    if (existing) {
      navigate(`/dsc/${today}`);
    } else {
      createDay.mutate(
        { date: today, branchId: activeBranchId, createdBy: user.id },
        { onSuccess: () => navigate(`/dsc/${today}`) }
      );
    }
  };

  const isToday = (date: Date) => format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-text-primary uppercase tracking-tight">Daily Sales & Collection</h1>
          <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">EMC3 DSC Workspace</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dsc/summary')} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-secondary hover:text-text-primary transition-all text-[10px] font-black uppercase tracking-widest">
            <BarChart3 size={14} /> Monthly Summary
          </button>
          <button onClick={handleOpenToday} disabled={createDay.isPending} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors shadow-red">
            <Plus size={14} /> Open Today
          </button>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bento-card p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-2 rounded-xl hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-lg font-black text-text-primary uppercase tracking-tight">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-2 rounded-xl hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="flex items-center gap-1 bg-bg-subtle rounded-xl p-1">
            <button onClick={() => setViewMode('calendar')} className={`p-2 rounded-lg transition-colors ${viewMode === 'calendar' ? 'bg-bg-surface shadow-sm text-text-primary' : 'text-text-muted'}`}>
              <CalendarDays size={16} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-bg-surface shadow-sm text-text-primary' : 'text-text-muted'}`}>
              <List size={16} />
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="skeleton h-64 rounded-xl" />
        ) : viewMode === 'calendar' ? (
          /* Calendar Grid */
          <div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="text-center text-[10px] font-black text-text-muted uppercase tracking-widest py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: blanks }).map((_, i) => <div key={`blank-${i}`} />)}
              {daysInMonth.map((date) => {
                const record = getDayRecord(date);
                const today = isToday(date);
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => handleDayClick(date)}
                    className={`relative p-2 rounded-xl text-left transition-all hover:bg-bg-subtle border min-h-[70px] ${
                      today ? 'border-brand-red bg-brand-red/5' : record ? 'border-border-default bg-bg-surface' : 'border-transparent'
                    }`}
                  >
                    <span className={`text-sm font-bold ${today ? 'text-brand-red' : 'text-text-primary'}`}>
                      {format(date, 'd')}
                    </span>
                    {record && (
                      <div className="mt-1">
                        <DscDayStatus status={record.status} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {days.length === 0 ? (
              <p className="text-center text-text-muted text-sm py-8">No days recorded for this month.</p>
            ) : (
              days.map((day) => (
                <button
                  key={day.id}
                  onClick={() => navigate(`/dsc/${day.date}`)}
                  className="w-full flex items-center justify-between p-4 rounded-xl bg-bg-surface border border-border-default hover:border-brand-red/30 hover:bg-bg-subtle transition-all"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black text-text-primary font-data">{day.date}</span>
                    <span className="text-xs text-text-muted font-bold">
                      {format(new Date(day.date + 'T00:00:00'), 'EEEE')}
                    </span>
                  </div>
                  <DscDayStatus status={day.status} />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
