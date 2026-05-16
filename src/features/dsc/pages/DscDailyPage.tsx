import { useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Lock, Unlock, Printer, RefreshCw } from 'lucide-react';
import { useBranch } from '../../../shared/hooks/useBranch';
import { useAuth } from '../../../shared/hooks/useAuth';
import { useDscDay, useCreateDscDay, useUpdateDscDay } from '../hooks/useDscDay';
import { useBatchUpsertInvoices } from '../hooks/useDscInvoices';
import { useBatchUpsertDrItems } from '../hooks/useDscDrItems';
import { useBatchUpsertOtsItems } from '../hooks/useDscOtsItems';
import { useBatchUpsertPurchases } from '../hooks/useDscPurchases';
import { useBatchUpsertExpenses } from '../hooks/useDscExpenses';
import { useBatchUpsertReturns } from '../hooks/useDscReturns';
import { useBatchUpsertCollections } from '../hooks/useDscCollections';
import { dscSyncService } from '../services/dscSyncService';
import { DscDayStatus } from '../components/DscDayStatus';
import { PurchasesSection } from '../components/sections/PurchasesSection';
import { InvoiceSectionA } from '../components/sections/InvoiceSectionA';
import { InvoiceSectionB } from '../components/sections/InvoiceSectionB';
import { DrSection } from '../components/sections/DrSection';
import { OtsSection } from '../components/sections/OtsSection';
import { ExpensesSection } from '../components/sections/ExpensesSection';
import { ReturnsSection } from '../components/sections/ReturnsSection';
import { ArSection } from '../components/sections/ArSection';
import { CollectionSection } from '../components/sections/CollectionSection';
import { CashDenomSection } from '../components/sections/CashDenomSection';
import { SiSummarySection } from '../components/sections/SiSummarySection';
import { DailySummarySection } from '../components/sections/DailySummarySection';
import { DscExportButton } from '../components/DscExportButton';

export default function DscDailyPage() {
  const { date } = useParams<{ date: string }>();
  const navigate = useNavigate();
  const { activeBranchId, currentBranchName } = useBranch();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const { data: day, isLoading } = useDscDay(date || '', activeBranchId || '');
  const createDay = useCreateDscDay();
  const updateDay = useUpdateDscDay();

  // Sync mutations
  const upsertInvoices = useBatchUpsertInvoices();
  const upsertDr = useBatchUpsertDrItems();
  const upsertOts = useBatchUpsertOtsItems();
  const upsertPurchases = useBatchUpsertPurchases();
  const upsertExpenses = useBatchUpsertExpenses();
  const upsertReturns = useBatchUpsertReturns();
  const upsertCollections = useBatchUpsertCollections();
  const hasAutoSynced = useRef(false);

  if (!date) return null;

  const dateObj = new Date(date + 'T00:00:00');
  const readOnly = day?.status === 'closed';

  const handleCreateDay = () => {
    if (!activeBranchId || !user) return;
    createDay.mutate({ date, branchId: activeBranchId, createdBy: user.id });
  };

  const handleToggleStatus = () => {
    if (!day) return;
    updateDay.mutate({
      id: day.id,
      updates: { status: day.status === 'open' ? 'closed' : 'open' },
    });
  };

  const handleSync = async () => {
    if (!activeBranchId || !day) return;
    
    try {
      const salesData = await dscSyncService.fetchSystemSales(date, activeBranchId);
      const purchaseData = await dscSyncService.fetchSystemPurchases(date, activeBranchId);
      const collectionData = await dscSyncService.fetchSystemCollections(date, activeBranchId);
      const refundData = await dscSyncService.fetchSystemRefunds(date, activeBranchId);
      const expenseData = await dscSyncService.fetchSystemExpenses(date, activeBranchId);
      
      if (salesData.invoicesA.length > 0) {
        const items = salesData.invoicesA.map((s: any) => ({
          series: 'A' as const,
          header_invoice_no: s.invoice_number || '',
          line_invoice_no: '',
          qty: s.quantity,
          description: s.description || 'Unknown Item',
          unit_price: s.quantity > 0 ? (s.total_price / s.quantity) : s.unit_price,
          is_cancelled: false,
          reference_id: s.id,
          sort_order: 0
        }));
        await upsertInvoices.mutateAsync({ dayId: day.id, series: 'A', items });
      }
      if (salesData.invoicesB.length > 0) {
        const items = salesData.invoicesB.map((s: any) => ({
          series: 'B' as const,
          header_invoice_no: s.invoice_number || '',
          line_invoice_no: '',
          qty: s.quantity,
          description: s.description || 'Unknown Item',
          unit_price: s.quantity > 0 ? (s.total_price / s.quantity) : s.unit_price,
          is_cancelled: false,
          reference_id: s.id,
          sort_order: 0
        }));
        await upsertInvoices.mutateAsync({ dayId: day.id, series: 'B', items });
      }

      // 2. Sync OTS
      if (salesData.otsItems.length > 0) {
        const items = salesData.otsItems.map((s: any) => ({
          qty: s.quantity,
          description: s.description || 'Unknown Item',
          unit_price: s.quantity > 0 ? (s.total_price / s.quantity) : s.unit_price,
          reference_id: s.id,
          sort_order: 0
        }));
        await upsertOts.mutateAsync({ dayId: day.id, items });
      }

      // 3. Sync DR
      if (salesData.drItems.length > 0) {
        const items = salesData.drItems.map((s: any) => ({
          account_name: s.customer_name || 'Walk-in',
          dr_number: s.invoice_number || '',
          qty: s.quantity,
          description: s.description || 'Unknown Item',
          unit_price: s.quantity > 0 ? (s.total_price / s.quantity) : s.unit_price,
          reference_id: s.id,
          sort_order: 0
        }));
        await upsertDr.mutateAsync({ dayId: day.id, items });
      }

      if (purchaseData.length > 0) {
        const items = purchaseData.map((p: any) => ({
          batch: 1 as 1,
          description: `${p.supplier || 'Unknown'} | ${p.invoice_number || 'NO-INV'} | ${p.description || 'System Purchase'} | ${p.quantity || 1} x ${p.unit_price || 0}`,
          amount: p.total_price || (p.quantity * p.unit_price),
          sort_order: 0,
          reference_id: p.id
        }));
        await upsertPurchases.mutateAsync({ dayId: day.id, items });
      }

      // 5. Sync Collections (Payments)
      if (collectionData.length > 0) {
        const items = collectionData.map((c: any) => ({
          collection_type: (c.payment_mode || 'Cash').toLowerCase() as any,
          reference: 'Synced from Systems',
          amount: c.amount,
          reference_id: c.id
        }));
        await upsertCollections.mutateAsync({ dayId: day.id, items });
      }

      // 6. Sync Returns/Refunds
      if (refundData.length > 0) {
        const items = refundData.map((r: any) => ({
          original_invoice_no: r.invoice_number,
          description: r.description,
          qty: r.quantity,
          unit_price: r.unit_price,
          amount: r.total_price,
          reason: r.reason,
          reference_id: r.id,
          sort_order: 0
        }));
        await upsertReturns.mutateAsync({ dayId: day.id, items });
      }

      // 7. Sync Expenses & Salaries
      if (expenseData.length > 0) {
        const items = expenseData.map((e: any) => ({
          description: e.description || e.category,
          amount: e.amount,
          category: (e.is_salary ? 'salary' : 'general') as 'salary' | 'general',
          reference_id: e.id,
          sort_order: 0
        }));
        await upsertExpenses.mutateAsync({ dayId: day.id, items });
      }

      console.log('Full Systems Sync completed successfully.');
    } catch (err) {
      console.error('Sync Error:', err);
    }
  };

  useEffect(() => {
    if (day && day.status === 'open' && !hasAutoSynced.current) {
      hasAutoSynced.current = true;
      handleSync();
    }
  }, [day?.id, day?.status]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-16 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!day) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-text-primary uppercase">No Record</h2>
          <p className="text-sm text-text-muted">
            No day record found for <span className="font-data font-bold">{date}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dsc')} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-secondary text-[10px] font-black uppercase tracking-widest transition-all">
            <ArrowLeft size={14} /> Back
          </button>
          <button onClick={handleCreateDay} disabled={createDay.isPending} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand-red text-white text-[10px] font-black uppercase tracking-widest hover:bg-brand-red-dark transition-colors shadow-red">
            Open This Day
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dsc')} className="p-2.5 rounded-xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-muted hover:text-text-primary transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-black text-text-primary font-data">{date}</h1>
              <span className="text-sm font-bold text-text-muted uppercase">{format(dateObj, 'EEEE')}</span>
              <DscDayStatus status={day.status} />
            </div>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-[10px] font-black text-text-muted uppercase tracking-widest">{currentBranchName}</p>
              <button
                onClick={handleSync}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-red-900/40 hover:bg-red-900/60 text-red-100 rounded-lg transition-colors border border-red-800/50"
                title="Force sync from system workspace"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Re-sync</span>
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleToggleStatus} disabled={updateDay.isPending} className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${
            day.status === 'open'
              ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100'
              : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
          }`}>
            {day.status === 'open' ? <><Lock size={14} /> Close Day</> : <><Unlock size={14} /> Reopen Day</>}
          </button>
          <DscExportButton dayId={day.id} date={date} />
          <button onClick={() => handlePrint()} className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-subtle hover:bg-bg-muted border border-border-default text-text-secondary text-[10px] font-black uppercase tracking-widest transition-all">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      {/* Printable content */}
      <div ref={printRef} className="print-container space-y-2">
        {/* Row 1: Purchases + Invoices */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <PurchasesSection dayId={day.id} />
          <InvoiceSectionA dayId={day.id} branchId={day.branch_id} readOnly={readOnly} />
          <InvoiceSectionB dayId={day.id} branchId={day.branch_id} readOnly={readOnly} />
        </div>

        {/* Row 2: DR + OTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <DrSection dayId={day.id} branchId={day.branch_id} readOnly={readOnly} />
          <OtsSection dayId={day.id} branchId={day.branch_id} readOnly={readOnly} />
        </div>

        {/* Row 3: Returns, Expenses, and AR (3-Column Row) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ReturnsSection dayId={day.id} readOnly={readOnly} />
          <ExpensesSection dayId={day.id} readOnly={readOnly} />
          <ArSection dayId={day.id} readOnly={readOnly} />
        </div>

        {/* Row 4: Collections & SI Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <CollectionSection dayId={day.id} readOnly={readOnly} />
          <SiSummarySection dayId={day.id} readOnly={readOnly} />
        </div>

        {/* Row 5: Cash Denom + Daily Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <CashDenomSection dayId={day.id} readOnly={readOnly} />
          <DailySummarySection dayId={day.id} />
        </div>
      </div>
    </div>
  );
}
