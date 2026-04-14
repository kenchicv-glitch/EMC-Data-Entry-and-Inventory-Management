import { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertTriangle, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import type { ProductImportRow, ProductImportResult } from '../types/product';
import { downloadImportTemplate } from '../services/inventoryExportService';

type Step = 'upload' | 'preview' | 'result';

interface ProductImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (rows: ProductImportRow[]) => Promise<ProductImportResult>;
    isImporting: boolean;
}

async function parseExcelFile(file: File): Promise<ProductImportRow[]> {
    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws = wb.worksheets[0];

    const headers: string[] = [];
    ws.getRow(1).eachCell(cell => {
        // Normalize header: lowercase, replace non-alpha with underscore
        headers.push(String(cell.value ?? '').toLowerCase().replace(/[^a-z_]/g, '_').replace(/_+/g, '_'));
    });

    const rows: ProductImportRow[] = [];
    ws.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const obj: Record<string, unknown> = {};
        row.eachCell((cell, colNumber) => {
            const key = headers[colNumber - 1];
            if (key) obj[key] = cell.value;
        });
        if (obj['sku'] || obj['name']) {
            rows.push(obj as unknown as ProductImportRow);
        }
    });

    return rows;
}

export default function ProductImportModal({
    isOpen,
    onClose,
    onImport,
    isImporting,
}: ProductImportModalProps) {
    const [step, setStep] = useState<Step>('upload');
    const [rows, setRows] = useState<ProductImportRow[]>([]);
    const [fileName, setFileName] = useState('');
    const [result, setResult] = useState<ProductImportResult | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleClose = () => {
        setStep('upload');
        setRows([]);
        setFileName('');
        setResult(null);
        setParseError(null);
        onClose();
    };

    const handleFile = async (file: File) => {
        setParseError(null);
        try {
            const parsed = await parseExcelFile(file);
            if (parsed.length === 0) {
                setParseError('No data rows found. Make sure row 1 is the header and row 2+ has data.');
                return;
            }
            setRows(parsed);
            setFileName(file.name);
            setStep('preview');
        } catch (e) {
            setParseError(e instanceof Error ? e.message : 'Failed to parse file');
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleImport = async () => {
        const res = await onImport(rows);
        setResult(res);
        setStep('result');
    };

    const requiredFields: (keyof ProductImportRow)[] = ['sku', 'name', 'selling_price', 'buying_price'];
    const missingRequired = requiredFields.filter(f => !rows[0]?.[f]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-2xl bg-bg-surface border border-border-default rounded-2xl shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
                    <div className="flex items-center gap-3">
                        <FileSpreadsheet size={20} className="text-brand-red" />
                        <div>
                            <h2 className="text-base font-bold text-text-primary">Import Products</h2>
                            <p className="text-xs text-text-muted capitalize">
                                Step {step === 'upload' ? 1 : step === 'preview' ? 2 : 3} of 3 — {step}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="p-2 rounded-lg hover:bg-bg-subtle text-text-muted hover:text-text-primary transition-colors">
                        <X size={16} />
                    </button>
                </div>

                {/* Step 1: Upload */}
                {step === 'upload' && (
                    <div className="p-6 space-y-4">
                        <div
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
                                isDragging
                                    ? 'border-brand-red bg-brand-red/5'
                                    : 'border-border-default hover:border-brand-red/40 hover:bg-bg-subtle'
                            }`}
                        >
                            <Upload size={32} className="mx-auto mb-3 text-text-muted" />
                            <p className="text-sm font-semibold text-text-primary">
                                Drop your .xlsx file here or click to browse
                            </p>
                            <p className="text-xs text-text-muted mt-1">Supported: Excel (.xlsx)</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx"
                            className="hidden"
                            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
                        />
                        {parseError && (
                            <p className="text-sm text-red-500 flex items-center gap-2">
                                <AlertTriangle size={14} /> {parseError}
                            </p>
                        )}
                        <button
                            onClick={() => downloadImportTemplate()}
                            className="flex items-center gap-2 text-sm text-text-muted hover:text-brand-red transition-colors"
                        >
                            <Download size={14} />
                            Download import template
                        </button>
                    </div>
                )}

                {/* Step 2: Preview */}
                {step === 'preview' && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-text-primary">{fileName}</p>
                                <p className="text-xs text-text-muted">{rows.length} rows detected</p>
                            </div>
                            <button
                                onClick={() => setStep('upload')}
                                className="text-xs text-text-muted hover:text-text-primary transition-colors"
                            >
                                Change file
                            </button>
                        </div>

                        {missingRequired.length > 0 && (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-500 text-sm font-semibold">
                                <AlertTriangle size={14} />
                                Missing required columns: {missingRequired.join(', ')}
                            </div>
                        )}

                        {/* Preview table */}
                        <div className="overflow-x-auto rounded-xl border border-border-default max-h-64">
                            <table className="w-full text-xs border-collapse">
                                <thead>
                                    <tr className="bg-bg-subtle border-b border-border-default sticky top-0">
                                        {Object.keys(rows[0] ?? {}).map(h => (
                                            <th key={h} className="px-3 py-2 text-left font-black text-text-muted uppercase tracking-wide whitespace-nowrap">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.slice(0, 10).map((row, i) => (
                                        <tr key={i} className="border-b border-border-default/50">
                                            {Object.values(row).map((v, j) => (
                                                <td key={j} className="px-3 py-1.5 text-text-secondary whitespace-nowrap max-w-[150px] truncate">
                                                    {String(v ?? '')}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {rows.length > 10 && (
                            <p className="text-xs text-text-muted">Showing first 10 of {rows.length} rows</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setStep('upload')}
                                className="flex-1 px-4 py-2 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:bg-bg-subtle transition-all"
                            >
                                Back
                            </button>
                            <button
                                onClick={handleImport}
                                disabled={isImporting || missingRequired.length > 0}
                                className="flex-1 px-4 py-2 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                            >
                                {isImporting ? `Importing…` : `Import ${rows.length} products`}
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Result */}
                {step === 'result' && result && (
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-emerald-500/10 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-emerald-500">{result.created}</p>
                                <p className="text-[11px] font-black text-emerald-500/70 uppercase tracking-wider">Created</p>
                            </div>
                            <div className="bg-blue-500/10 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-blue-500">{result.updated}</p>
                                <p className="text-[11px] font-black text-blue-500/70 uppercase tracking-wider">Updated</p>
                            </div>
                            <div className="bg-red-500/10 rounded-xl p-4 text-center">
                                <p className="text-2xl font-black text-red-500">{result.errors.length}</p>
                                <p className="text-[11px] font-black text-red-500/70 uppercase tracking-wider">Errors</p>
                            </div>
                        </div>

                        {result.errors.length > 0 && (
                            <div className="rounded-xl border border-red-500/20 overflow-hidden">
                                <p className="px-4 py-2 text-xs font-black text-red-500 uppercase tracking-wider bg-red-500/5">
                                    Errors
                                </p>
                                <div className="overflow-y-auto max-h-40">
                                    {result.errors.map((e, i) => (
                                        <div key={i} className="flex items-start gap-3 px-4 py-2 border-t border-border-default/50 text-xs">
                                            <span className="text-text-muted shrink-0">Row {e.row}</span>
                                            <span className="font-mono text-text-secondary shrink-0">{e.sku}</span>
                                            <span className="text-red-500">{e.error}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={handleClose}
                            className="w-full px-4 py-2.5 rounded-xl bg-brand-red text-white text-sm font-bold hover:bg-brand-red/90 transition-all"
                        >
                            Done
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
