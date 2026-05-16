import { useDscPurchases } from '../../hooks/useDscPurchases';
import { useDscInvoices } from '../../hooks/useDscInvoices';
import { useDscDrItems } from '../../hooks/useDscDrItems';
import { useDscOtsItems } from '../../hooks/useDscOtsItems';
import { useDscSalary } from '../../hooks/useDscSalary';
import { useDscAr } from '../../hooks/useDscAr';
import { useDscCollections } from '../../hooks/useDscCollections';
import { useDscCashDenom } from '../../hooks/useDscCashDenom';
import { useDscExpenses } from '../../hooks/useDscExpenses';

interface Props { dayId: string; }

export function DailySummarySection({ dayId }: Props) {
  const { data: purchases = [] } = useDscPurchases(dayId);
  const { data: invoicesA = [] } = useDscInvoices(dayId, 'A');
  const { data: invoicesB = [] } = useDscInvoices(dayId, 'B');
  const { data: drItems = [] } = useDscDrItems(dayId);
  const { data: otsItems = [] } = useDscOtsItems(dayId);
  const { data: salaryEntries = [] } = useDscSalary(dayId);
  const { data: arEntries = [] } = useDscAr(dayId);
  const { data: collections = [] } = useDscCollections(dayId);
  const { data: cashDenoms = [] } = useDscCashDenom(dayId);
  const { data: expenseEntries = [] } = useDscExpenses(dayId);

  const totalP1 = purchases.filter((p) => p.batch === 1).reduce((s, p) => s + Number(p.amount), 0);
  const totalP2 = purchases.filter((p) => p.batch === 2).reduce((s, p) => s + Number(p.amount), 0);
  const totalP3 = purchases.filter((p) => p.batch === 3).reduce((s, p) => s + Number(p.amount), 0);
  const totalInvA = invoicesA.filter((i) => !i.is_cancelled).reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const totalInvB = invoicesB.filter((i) => !i.is_cancelled).reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const totalDr = drItems.reduce((s, d) => s + Number(d.qty) * Number(d.unit_price), 0);
  const totalOts = otsItems.reduce((s, o) => s + Number(o.qty) * Number(o.unit_price), 0);
  const totalSalary = expenseEntries.filter(e => e.category === 'salary').reduce((s, e) => s + Number(e.amount), 0);
  const totalGeneralExpenses = expenseEntries.filter(e => e.category === 'general').reduce((s, e) => s + Number(e.amount), 0);
  const totalAllExpenses = totalSalary + totalGeneralExpenses;
  const totalArCash = arEntries.filter((a) => a.ar_type === 'cash').reduce((s, a) => s + Number(a.amount), 0);
  const totalArGcash = arEntries.filter((a) => a.ar_type === 'gcash').reduce((s, a) => s + Number(a.amount), 0);
  const totalArDr = arEntries.filter((a) => a.ar_type === 'dr').reduce((s, a) => s + Number(a.amount), 0);
  const totalAr2 = arEntries.filter((a) => a.ar_type === 'ar2').reduce((s, a) => s + Number(a.amount), 0);
  const totalCollections = collections.reduce((s, c) => s + Number(c.amount), 0);
  const totalCashOnHand = cashDenoms.reduce((s, d) => s + Number(d.denomination) * d.count, 0);

  const totalSales = totalInvA + totalInvB + totalDr + totalOts;
  const netSales = totalSales - totalArDr;
  const cashColl = collections.filter((c) => c.collection_type.toLowerCase().includes('cash')).reduce((s, c) => s + Number(c.amount), 0);
  const expectedCash = cashColl - totalAllExpenses;
  const unrecordedShort = totalCashOnHand - expectedCash;

  const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

  const sections = [
    {
      title: 'Purchases',
      impact: 'negative', // Cash flow reduction
      rows: [
        ['Total Purchases 1', totalP1],
        ['Total Purchases 2', totalP2],
        ['Total Purchases 3', totalP3],
      ]
    },
    {
      title: 'Sales Breakdown',
      impact: 'positive', // Revenue generation
      rows: [
        ['Invoice A Total', totalInvA],
        ['Invoice B Total', totalInvB],
        ['DR Total', totalDr],
        ['OTS Total', totalOts],
        ['Total Sales', totalSales],
      ]
    },
    {
      title: 'Disbursements',
      impact: 'negative', // Direct cash out
      rows: [
        ['Total Salary', totalSalary],
        ['Gen. Expenses', totalGeneralExpenses],
        ['Total Expenses', totalAllExpenses],
      ]
    },
    {
      title: 'Receivables (AR)',
      impact: 'negative', // Offsets (non-cash sales)
      rows: [
        ['AR Cash', totalArCash],
        ['AR GCash', totalArGcash],
        ['AR / DR', totalArDr],
        ['AR2', totalAr2],
      ]
    },
    {
      title: 'Cash Reconciliation',
      impact: 'manual', // Logic controlled below
      rows: [
        ['Net Sales', netSales],
        ['Total Collections', totalCollections],
        ['Cash on Hand', totalCashOnHand],
        ['Unrecorded / (Short)', unrecordedShort],
      ]
    }
  ];

  return (
    <div className="bento-card p-2.5 space-y-3">
      <h3 className="text-xs font-black text-text-primary uppercase tracking-wider">Daily Summary Audit</h3>
      
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1">
            <h4 className="text-[9px] font-black text-brand-red uppercase tracking-[0.2em] mb-1.5 opacity-80 border-b border-brand-red/10 pb-1">
              {section.title}
            </h4>
            <div className="grid grid-cols-1 gap-y-0.5">
              {section.rows.map(([label, value]) => {
                let colorClass = 'text-text-primary';
                if (section.impact === 'positive') colorClass = 'text-emerald-500';
                else if (section.impact === 'negative') colorClass = 'text-brand-red';
                else if (section.impact === 'manual') {
                  // Final reconciliation logic
                  if (label === 'Unrecorded / (Short)') {
                    colorClass = Number(value) < 0 ? 'text-brand-red' : 'text-emerald-500';
                  } else {
                    colorClass = 'text-emerald-500';
                  }
                }

                return (
                  <div key={label as string} className="flex items-center justify-between py-0.5 group">
                    <span className="text-[10px] font-bold text-text-secondary uppercase group-hover:text-text-primary transition-colors">{label}</span>
                    <span className={`text-[10px] font-data font-bold ${colorClass}`}>
                      {fmt(Number(value))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
