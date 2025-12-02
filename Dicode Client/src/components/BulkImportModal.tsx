import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, Check, Download, Loader2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { createInvitation, checkPendingInvitation, getOrganization } from '@/lib/firestore';
import type { UserRole } from '@/types';

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    cohorts: Array<{ id: string; name: string }>;
}

interface ParsedRow {
    email: string;
    name: string;
    role: UserRole;
    department: string;
    cohort: string;
    isValid: boolean;
    errors: string[];
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    cohorts
}) => {
    const { user } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'complete'>('upload');
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset after close animation
            setTimeout(() => {
                setStep('upload');
                setParsedRows([]);
                setImportStats({ total: 0, success: 0, failed: 0 });
                setError(null);
            }, 300);
        }
    }, [isOpen]);

    const resetModal = () => {
        setStep('upload');
        setParsedRows([]);
        setImportStats({ total: 0, success: 0, failed: 0 });
        setError(null);
    };

    const downloadTemplate = () => {
        const headers = ['email', 'name', 'role', 'department', 'cohort'];
        const example = ['john@example.com', 'John Doe', 'employee', 'Engineering', 'Cohort 1'];
        const csvContent = [headers.join(','), example.join(',')].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'employee_import_template.csv';
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const parseCSV = (text: string) => {
        const lines = text.split(/\r\n|\n/).filter(line => line.trim());
        if (lines.length < 2) {
            setError('File appears to be empty or missing headers');
            return;
        }

        const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
        const emailIdx = headers.indexOf('email');
        const nameIdx = headers.indexOf('name');
        const roleIdx = headers.indexOf('role');
        const deptIdx = headers.indexOf('department');
        const cohortIdx = headers.indexOf('cohort');

        if (emailIdx === -1) {
            setError('CSV must contain an "email" column');
            return;
        }

        const rows: ParsedRow[] = lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim());
            const email = cols[emailIdx] || '';
            const name = nameIdx !== -1 ? cols[nameIdx] : '';
            const roleStr = roleIdx !== -1 ? cols[roleIdx]?.toLowerCase() : 'employee';
            const department = deptIdx !== -1 ? cols[deptIdx] : '';
            const cohortName = cohortIdx !== -1 ? cols[cohortIdx] : '';

            const errors: string[] = [];
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email) errors.push('Missing email');
            else if (!emailRegex.test(email)) errors.push('Invalid email');

            const role: UserRole = (roleStr === 'admin' || roleStr === 'employee') ? roleStr : 'employee';

            return {
                email,
                name,
                role,
                department,
                cohort: cohortName,
                isValid: errors.length === 0,
                errors
            };
        });

        setParsedRows(rows);
        setStep('preview');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            setError('Please upload a valid CSV file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            parseCSV(text);
        };
        reader.readAsText(file);
    };

    const processImports = async () => {
        if (!user?.organization) return;

        setStep('importing');
        let successCount = 0;
        let failCount = 0;
        const validRows = parsedRows.filter(r => r.isValid);

        try {
            const org = await getOrganization(user.organization);
            if (!org) throw new Error('Organization not found');

            for (const row of validRows) {
                try {
                    // Check for existing invite
                    const existing = await checkPendingInvitation(row.email, user.organization);
                    if (existing) {
                        throw new Error('Already invited');
                    }

                    // Find cohort ID if name provided
                    let cohortIds: string[] | undefined;
                    if (row.cohort) {
                        const matchedCohort = cohorts.find(c => c.name.toLowerCase() === row.cohort.toLowerCase());
                        if (matchedCohort) cohortIds = [matchedCohort.id];
                    }

                    await createInvitation({
                        organizationId: user.organization,
                        organizationName: org.name,
                        email: row.email,
                        role: row.role,
                        department: row.department || undefined,
                        cohortIds,
                        invitedBy: user.id,
                        inviteeName: row.name || undefined,
                    });

                    successCount++;
                } catch (err) {
                    console.error(`Failed to import ${row.email}:`, err);
                    failCount++;
                }
            }

            setImportStats({
                total: validRows.length,
                success: successCount,
                failed: failCount
            });
            setStep('complete');
            if (successCount > 0) onSuccess();

        } catch (err) {
            console.error('Import failed:', err);
            setError('Import process failed. Please try again.');
            setStep('preview');
        }
    };

    const validCount = parsedRows.filter(r => r.isValid).length;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                onClick={onClose}
            />

            {/* Slide-over Panel */}
            <div
                className={`fixed right-0 top-0 bottom-0 w-full max-w-xl bg-dark-card border-l border-dark-border shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-out ${
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
            >
                {/* Header */}
                <div className="sticky top-0 bg-dark-card border-b border-dark-border px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <Upload className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-dark-text">Bulk Import</h2>
                            <p className="text-sm text-dark-text-muted">
                                {step === 'upload' && 'Upload a CSV file'}
                                {step === 'preview' && `${validCount} valid rows ready`}
                                {step === 'importing' && 'Processing...'}
                                {step === 'complete' && 'Import complete'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-dark-bg transition"
                    >
                        <X className="h-5 w-5 text-dark-text-muted" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div
                                className="border-2 border-dashed border-dark-border rounded-xl p-10 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-dark-bg/50 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Upload size={28} className="text-primary" />
                                </div>
                                <h3 className="text-base font-medium text-dark-text mb-2">Click to upload CSV</h3>
                                <p className="text-sm text-dark-text-muted">or drag and drop file here</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                                <div className="flex items-start gap-3">
                                    <FileText className="text-primary mt-0.5 flex-shrink-0" size={20} />
                                    <div>
                                        <h4 className="font-medium text-dark-text mb-2">CSV Format Guide</h4>
                                        <p className="text-sm text-dark-text-muted mb-3">
                                            Required columns:
                                        </p>
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            <code className="bg-dark-bg px-2 py-1 rounded text-xs text-primary">email *</code>
                                            <code className="bg-dark-bg px-2 py-1 rounded text-xs text-dark-text-muted">name</code>
                                            <code className="bg-dark-bg px-2 py-1 rounded text-xs text-dark-text-muted">role</code>
                                            <code className="bg-dark-bg px-2 py-1 rounded text-xs text-dark-text-muted">department</code>
                                            <code className="bg-dark-bg px-2 py-1 rounded text-xs text-dark-text-muted">cohort</code>
                                        </div>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                downloadTemplate();
                                            }}
                                            className="text-sm text-primary hover:text-primary/80 flex items-center gap-1.5 font-medium"
                                        >
                                            <Download size={14} /> Download Template
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle size={16} className="flex-shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                                        <Users size={16} className="text-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-dark-text">{validCount} valid rows</p>
                                        <p className="text-xs text-dark-text-muted">
                                            {parsedRows.length - validCount} with errors
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={resetModal}
                                    className="text-sm text-primary hover:text-primary/80"
                                >
                                    Upload different file
                                </button>
                            </div>

                            <div className="rounded-xl border border-dark-border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-dark-bg text-dark-text-muted uppercase text-xs">
                                            <tr>
                                                <th className="px-3 py-2.5 w-10"></th>
                                                <th className="px-3 py-2.5">Email</th>
                                                <th className="px-3 py-2.5">Name</th>
                                                <th className="px-3 py-2.5">Role</th>
                                                <th className="px-3 py-2.5">Dept</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-dark-border">
                                            {parsedRows.map((row, idx) => (
                                                <tr key={idx} className={row.isValid ? '' : 'bg-red-500/5'}>
                                                    <td className="px-3 py-2.5">
                                                        {row.isValid ? (
                                                            <Check size={14} className="text-emerald-500" />
                                                        ) : (
                                                            <div className="group relative">
                                                                <AlertCircle size={14} className="text-red-500 cursor-help" />
                                                                <div className="absolute left-5 top-0 bg-dark-card border border-dark-border p-2 rounded-lg shadow-lg z-10 w-40 hidden group-hover:block">
                                                                    {row.errors.map((e, i) => (
                                                                        <div key={i} className="text-xs text-red-400">{e}</div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2.5 text-dark-text text-xs">{row.email}</td>
                                                    <td className="px-3 py-2.5 text-dark-text-muted text-xs">{row.name || '-'}</td>
                                                    <td className="px-3 py-2.5 text-dark-text-muted text-xs capitalize">{row.role}</td>
                                                    <td className="px-3 py-2.5 text-dark-text-muted text-xs">{row.department || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-16">
                            <Loader2 size={48} className="text-primary animate-spin mb-4" />
                            <h3 className="text-lg font-medium text-dark-text">Importing Employees...</h3>
                            <p className="text-dark-text-muted text-sm">Please wait while we create invitations.</p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                <Check size={32} className="text-emerald-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-dark-text mb-2">Import Complete</h3>
                            <p className="text-dark-text-muted mb-6">
                                Successfully invited <span className="text-primary font-medium">{importStats.success}</span> employees.
                                {importStats.failed > 0 && (
                                    <span className="text-red-400"> Failed to invite {importStats.failed}.</span>
                                )}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-dark-border px-6 py-4 flex justify-end gap-3">
                    {step === 'upload' && (
                        <button onClick={onClose} className="btn-secondary">
                            Cancel
                        </button>
                    )}
                    {step === 'preview' && (
                        <>
                            <button onClick={onClose} className="btn-secondary">Cancel</button>
                            <button
                                onClick={processImports}
                                disabled={validCount === 0}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Upload size={16} />
                                Import {validCount} Employees
                            </button>
                        </>
                    )}
                    {step === 'complete' && (
                        <button onClick={onClose} className="btn-primary">
                            Done
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

export default BulkImportModal;
