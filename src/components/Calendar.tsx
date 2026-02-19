import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    activeDates?: string[]; // Array of 'yyyy-MM-dd' strings
}

export default function Calendar({ selectedDate, onDateSelect, activeDates = [] }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-brand-red" />
                    <span className="text-sm font-black text-brand-charcoal uppercase tracking-wider">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-charcoal transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-brand-charcoal transition-colors"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDays = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return (
            <div className="grid grid-cols-7 border-b border-slate-50">
                {days.map((day) => (
                    <div key={day} className="py-2 text-[10px] font-black text-slate-400 text-center uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, 'd');
                const cloneDay = day;
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, monthStart);
                const dayKey = format(day, 'yyyy-MM-dd');
                const hasActivity = activeDates.includes(dayKey);

                days.push(
                    <div
                        key={dayKey}
                        className={`relative py-3 flex flex-col items-center cursor-pointer transition-all hover:bg-slate-50 border-r border-b border-slate-50 last:border-r-0
                            ${!isCurrentMonth ? 'text-slate-200 pointer-events-none' : 'text-slate-600'}
                            ${isSelected ? 'bg-brand-red/5 !text-brand-red font-black' : ''}
                        `}
                        onClick={() => onDateSelect(cloneDay)}
                    >
                        <span className="text-xs font-bold z-10">{formattedDate}</span>
                        {hasActivity && <div className="absolute bottom-1 w-1.5 h-1.5 bg-brand-red rounded-full shadow-sm shadow-red/20 animate-pulse"></div>}
                        {isSelected && <div className="absolute top-0 left-0 w-full h-1 bg-brand-red rounded-t-full"></div>}
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="bg-white">{rows}</div>;
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden w-full max-w-[320px]">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
        </div>
    );
}
