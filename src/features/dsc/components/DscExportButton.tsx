import { FileDown } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  dayId: string;
  date: string;
}

export function DscExportButton({ dayId, date }: Props) {
  const handleExport = async () => {
    toast.info('Excel export for daily view coming soon');
    // Future: call exportDscDayToExcel when full day data aggregation is ready
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-secondary text-[10px] font-black uppercase tracking-widest transition-all"
    >
      <FileDown size={14} /> Export
    </button>
  );
}
