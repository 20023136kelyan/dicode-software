import React, { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, Check, Download, Loader2 } from 'lucide-react';
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

    if (!isOpen) return null;

    const resetModal = () => {
        setStep('upload');
        setParsedRows([]);
        setImportStats({ total: 0, success: 0, failed: 0 });
        setError(null);
    };

    const handleClose = () => {
        resetModal();
        onClose();
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

                // Update stats progressively could be added here
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

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-[#2A2A2A] border border-dark-border rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-dark-border">
                    <h2 className="text-xl font-semibold text-dark-text">Bulk Import Employees</h2>
                    <button onClick={handleClose} className="p-2 hover:bg-dark-bg rounded-lg transition-colors">
                        <X size={20} className="text-dark-text-muted" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="space-y-6">
                            <div
                                className="border-2 border-dashed border-dark-border rounded-xl p-12 flex flex-col items-center justify-center text-center hover:border-primary/50 hover:bg-dark-bg/50 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                                    <Upload size={32} className="text-primary" />
                                </div>
                                <h3 className="text-lg font-medium text-dark-text mb-2">Click to upload CSV</h3>
                                <p className="text-dark-text-muted mb-6">or drag and drop file here</p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                            </div>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <div className="flex items-start gap-3">
                                    <FileText className="text-blue-400 mt-1" size={20} />
                                    <div>
                                        <h4 className="font-medium text-blue-400 mb-1">CSV Format Guide</h4>
                                        <p className="text-sm text-dark-text-muted mb-3">
                                            Your CSV should include the following columns:
                                            <code className="bg-black/20 px-1 py-0.5 rounded mx-1">email</code>
                                            (required),
                                            <code className="bg-black/20 px-1 py-0.5 rounded mx-1">name</code>,
                                            <code className="bg-black/20 px-1 py-0.5 rounded mx-1">role</code>,
                                            <code className="bg-black/20 px-1 py-0.5 rounded mx-1">department</code>,
                                            <code className="bg-black/20 px-1 py-0.5 rounded mx-1">cohort</code>
                                        </p>
                                        <button
                                            onClick={downloadTemplate}
                                            className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                                        >
                                            <Download size={14} /> Download Template
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-medium text-dark-text">
                                    Preview ({parsedRows.filter(r => r.isValid).length} valid rows)
                                </h3>
                                <button
                                    onClick={resetModal}
                                    className="text-sm text-dark-text-muted hover:text-dark-text"
                                >
                                    Upload different file
                                </button>
                            </div>

                            <div className="border border-dark-border rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-dark-bg text-dark-text-muted uppercase text-xs">
                                        <tr>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3">Email</th>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Role</th>
                                            <th className="px-4 py-3">Dept</th>
                                            <th className="px-4 py-3">Cohort</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-dark-border">
                                        {parsedRows.map((row, idx) => (
                                            <tr key={idx} className={row.isValid ? 'bg-transparent' : 'bg-red-500/5'}>
                                                <td className="px-4 py-3">
                                                    {row.isValid ? (
                                                        <Check size={16} className="text-green-500" />
                                                    ) : (
                                                        <div className="group relative">
                                                            <AlertCircle size={16} className="text-red-500 cursor-help" />
                                                            <div className="absolute left-6 top-0 bg-dark-card border border-dark-border p-2 rounded shadow-lg z-10 w-48 hidden group-hover:block">
                                                                {row.errors.map((e, i) => <div key={i} className="text-xs text-red-400">{e}</div>)}
                                                            </div>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-dark-text">{row.email}</td>
                                                <td className="px-4 py-3 text-dark-text-muted">{row.name || '-'}</td>
                                                <td className="px-4 py-3 text-dark-text-muted capitalize">{row.role}</td>
                                                <td className="px-4 py-3 text-dark-text-muted">{row.department || '-'}</td>
                                                <td className="px-4 py-3 text-dark-text-muted">{row.cohort || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {step === 'importing' && (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 size={48} className="text-primary animate-spin mb-4" />
                            <h3 className="text-lg font-medium text-dark-text">Importing Employees...</h3>
                            <p className="text-dark-text-muted">Please wait while we create invitations.</p>
                        </div>
                    )}

                    {step === 'complete' && (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                                <Check size={32} className="text-green-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-dark-text mb-2">Import Complete</h3>
                            <p className="text-dark-text-muted mb-6">
                                Successfully invited {importStats.success} employees.
                                {importStats.failed > 0 && ` Failed to invite ${importStats.failed} employees.`}
                            </p>
                            <div className="flex justify-center gap-4">
                                <button onClick={handleClose} className="btn-primary px-8">
                                    Done
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step === 'preview' && (
                    <div className="p-6 border-t border-dark-border flex justify-end gap-3">
                        <button onClick={handleClose} className="btn-secondary">Cancel</button>
                        <button
                            onClick={processImports}
                            disabled={parsedRows.filter(r => r.isValid).length === 0}
                            className="btn-primary"
                        >
                            Import {parsedRows.filter(r => r.isValid).length} Employees
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BulkImportModal;
