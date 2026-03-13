import { useState, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface CalendarProps {
    selectedDate: Date;
    onDateSelect: (date: Date) => void;
    activeDates?: string[]; // Array of 'yyyy-MM-dd' strings
    rangeStart?: Date | null;
    rangeEnd?: Date | null;
}

export default function Calendar({ selectedDate, onDateSelect, activeDates = [], rangeStart, rangeEnd }: CalendarProps) {
    const [currentMonth, setCurrentMonth] = useState(() => {
        const d = new Date(selectedDate);
        return isNaN(d.getTime()) ? new Date() : d;
    });

    // Sync currentMonth when selectedDate changes (e.g. when modal opens with new date)
    useEffect(() => {
        const d = new Date(selectedDate);
        if (!isNaN(d.getTime())) {
            setCurrentMonth(startOfMonth(d));
        }
    }, [selectedDate]);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const renderHeader = () => {
        return (
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
                <div className="flex items-center gap-2">
                    <CalendarIcon size={16} className="text-brand-red" />
                    <span className="text-sm font-black text-text-primary uppercase tracking-wider">
                        {format(currentMonth, 'MMMM yyyy')}
                    </span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={prevMonth}
                        className="p-1.5 hover:bg-subtle rounded-lg text-text-muted hover:text-text-primary transition-colors"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        onClick={nextMonth}
                        className="p-1.5 hover:bg-subtle rounded-lg text-text-muted hover:text-text-primary transition-colors"
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
            <div className="grid grid-cols-7 border-b border-border-default/50">
                {days.map((day) => (
                    <div key={day} className="py-2 text-[10px] font-black text-text-muted text-center uppercase tracking-widest">
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
                const isCurrentMonth = isSameMonth(day, monthStart);
                const dayKey = format(day, 'yyyy-MM-dd');

                if (!isCurrentMonth) {
                    days.push(<div key={`empty-${dayKey}`} className="border-r border-b border-border-default/50 last:border-r-0"></div>);
                } else {
                    formattedDate = format(day, 'd');
                    const cloneDay = day;
                    const isSelected = isSameDay(day, selectedDate);
                    const hasActivity = activeDates.includes(dayKey);

                    // Range logic
                    const isInRange = rangeStart && rangeEnd && day >= rangeStart && day <= rangeEnd;
                    const isRangeStart = rangeStart && isSameDay(day, rangeStart);
                    const isRangeEnd = rangeEnd && isSameDay(day, rangeEnd);

                    days.push(
                        <div
                            key={dayKey}
                            className={`relative py-3 flex flex-col items-center cursor-pointer transition-all hover:bg-subtle border-r border-b border-border-default/50 last:border-r-0 text-text-secondary
                                ${isSelected || isRangeStart || isRangeEnd ? 'bg-brand-red !text-text-inverse font-black rounded-lg shadow-sm z-10' : ''}
                                ${isInRange && !isRangeStart && !isRangeEnd ? 'bg-danger-subtle !text-brand-red font-bold' : ''}
                            `}
                            onClick={() => onDateSelect(cloneDay)}
                        >
                            <span className="text-xs font-bold z-10">{formattedDate}</span>
                            {hasActivity && <div className={`absolute bottom-1 w-1.5 h-1.5 rounded-full shadow-sm animate-pulse ${isSelected || isRangeStart || isRangeEnd ? 'bg-text-inverse shadow-white/20' : 'bg-brand-red shadow-red/20'}`}></div>}
                        </div>
                    );
                }
                day = addDays(day, 1);
            }

            // Only push the row if it contains at least one day from the current month
            rows.push(
                <div className="grid grid-cols-7" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="bg-surface">{rows}</div>;
    };

    return (
        <div className="bg-surface rounded-3xl border border-border-default shadow-sm overflow-hidden w-full max-w-[320px]">
            {renderHeader()}
            {renderDays()}
            {renderCells()}
        </div>
    );
}
