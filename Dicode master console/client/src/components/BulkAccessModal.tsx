import { useState, useEffect } from 'react';
import { X, Building2, Check, AlertTriangle, Globe } from 'lucide-react';
import type { Organization } from '@/lib/types';
import { getAllOrganizations } from '@/lib/firestore';

interface BulkAccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedCount: number;
    onSave: (allowedOrganizations: string[]) => Promise<void>;
}

export default function BulkAccessModal({
    isOpen,
    onClose,
    selectedCount,
    onSave,
}: BulkAccessModalProps) {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [accessType, setAccessType] = useState<'global' | 'specific'>('global');
    const [selectedOrgId, setSelectedOrgId] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            loadOrganizations();
            setAccessType('global');
            setSelectedOrgId('');
        }
    }, [isOpen]);

    const loadOrganizations = async () => {
        setLoading(true);
        try {
            const orgs = await getAllOrganizations();
            setOrganizations(orgs);
        } catch (error) {
            console.error('Failed to load organizations:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const allowedOrganizations = accessType === 'global' ? [] : [selectedOrgId];
            await onSave(allowedOrganizations);
            onClose();
        } catch (error) {
            console.error('Failed to save bulk access:', error);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                    <h2 className="text-lg font-semibold text-slate-900">
                        Edit Access for {selectedCount} Videos
                    </h2>
                    <button
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                        <div className="flex gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                            <p className="text-sm text-amber-900">
                                This will overwrite the existing access settings for all <strong>{selectedCount} selected videos</strong>.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-sm font-medium text-slate-700 block">Visibility</label>

                        {/* Global Option */}
                        <button
                            onClick={() => setAccessType('global')}
                            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${accessType === 'global'
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <div
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${accessType === 'global'
                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}
                            >
                                {accessType === 'global' && <Check className="h-3 w-3" />}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 font-medium text-slate-900">
                                    <Globe className="h-4 w-4 text-slate-500" />
                                    Global Access
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Visible to all organizations and users.
                                </p>
                            </div>
                        </button>

                        {/* Specific Option */}
                        <button
                            onClick={() => setAccessType('specific')}
                            className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${accessType === 'specific'
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <div
                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${accessType === 'specific'
                                        ? 'border-emerald-500 bg-emerald-500 text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}
                            >
                                {accessType === 'specific' && <Check className="h-3 w-3" />}
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 font-medium text-slate-900">
                                    <Building2 className="h-4 w-4 text-slate-500" />
                                    Specific Organization
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Restricted to a single organization.
                                </p>

                                {accessType === 'specific' && (
                                    <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <select
                                            value={selectedOrgId}
                                            onChange={(e) => setSelectedOrgId(e.target.value)}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        >
                                            <option value="" disabled>Select Organization...</option>
                                            {organizations.map((org) => (
                                                <option key={org.id} value={org.id}>
                                                    {org.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>
                        </button>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || (accessType === 'specific' && !selectedOrgId)}
                        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Updating...' : 'Update Access'}
                    </button>
                </div>
            </div>
        </div>
    );
}
