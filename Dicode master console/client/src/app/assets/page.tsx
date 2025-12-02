'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/Layout/MainLayout';
import CollapsibleHero from '@/components/Layout/CollapsibleHero';
import { Asset, AssetPromptMetadata, AssetType } from '@/lib/types';
import { getAssetsByUser, createAsset, updateAsset, deleteAsset } from '@/lib/firestore';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  X,
  Sparkles,
  Palette,
  Trees,
  SunMedium,
  Camera,
  LayoutGrid,
  Rows,
} from 'lucide-react';

// Helper functions at module level
const getTypeColor = (type: AssetType) => {
  switch (type) {
    case 'character': return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'environment': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'lighting': return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'camera': return 'bg-sky-100 text-sky-700 border-sky-200';
  }
};

const getTypeLabel = (type: AssetType) => {
  switch (type) {
    case 'character': return 'Character';
    case 'environment': return 'Environment';
    case 'lighting': return 'Lighting';
    case 'camera': return 'Camera Angle';
  }
};

export default function AssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user, selectedType]);

  const loadAssets = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const type = selectedType === 'all' ? undefined : selectedType;
      const data = await getAssetsByUser(user.uid, type);
      setAssets(data);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      await deleteAsset(assetId);
      setAssets(assets.filter(a => a.id !== assetId));
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchQuery === '' ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const assetsByType = {
    character: filteredAssets.filter(a => a.type === 'character'),
    environment: filteredAssets.filter(a => a.type === 'environment'),
    lighting: filteredAssets.filter(a => a.type === 'lighting'),
    camera: filteredAssets.filter(a => a.type === 'camera'),
  };

  interface StatCardProps {
    value: number;
    label: string;
    sublabel: string;
  }

  function StatCard({ value, label, sublabel }: StatCardProps) {
    return (
      <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
        <p className="text-3xl font-semibold text-slate-900">{value}</p>
        <p className="mt-2 text-[0.65rem] uppercase tracking-[0.25em] text-slate-400 leading-tight break-words whitespace-normal">
          {label}
        </p>
        <p className="mt-1 text-xs text-slate-500 break-words whitespace-normal">{sublabel}</p>
      </div>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-8 text-slate-900">
        <CollapsibleHero>
          <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-xl shadow-slate-100">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Asset store</p>
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                  Keep your characters, lighting, and camera setups synced across campaigns.
                </h1>
                <p className="text-slate-600 max-w-2xl">
                  Curate the prompts and visual ingredients that make your DiCode programs feel on brand. The refreshed
                  asset hub mirrors the new video and campaigns design for a seamless workflow.
                </p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] transition hover:brightness-110"
                >
                  <Sparkles className="h-4 w-4" />
                  Create new asset
                </button>
              </div>
              <div className="grid w-full max-w-xl gap-4 grid-cols-2 sm:grid-cols-2">
                <StatCard label="Total" sublabel="assets" value={assets.length} />
                <StatCard label="Characters" sublabel="talent briefs" value={assetsByType.character.length} />
                <StatCard label="Scenes" sublabel="environments" value={assetsByType.environment.length} />
                <StatCard
                  label="Lighting / Cam"
                  sublabel="setups"
                  value={assetsByType.lighting.length + assetsByType.camera.length}
                />
              </div>
            </div>
          </section>
        </CollapsibleHero>

        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-5 py-3">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search assets by name or description…"
                  className="flex-1 border-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" />
              Add asset
            </button>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-1 py-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${viewMode === 'grid' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Rows className="h-4 w-4" />
                List
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {([
              { value: 'all', label: `All (${assets.length})` },
              { value: 'character', label: `Characters (${assetsByType.character.length})` },
              { value: 'environment', label: `Environments (${assetsByType.environment.length})` },
              { value: 'lighting', label: `Lighting (${assetsByType.lighting.length})` },
              { value: 'camera', label: `Camera (${assetsByType.camera.length})` },
            ] as const).map((filter) => (
              <button
                key={filter.value}
                onClick={() => setSelectedType(filter.value)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${selectedType === filter.value
                    ? 'bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)]'
                    : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {loading ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 rounded-[32px] border border-slate-200 bg-white">
              <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
              <p className="text-sm text-slate-500">Loading your asset kits…</p>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white text-center p-12">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Palette className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                {assets.length === 0 ? 'No assets yet' : 'No matches for your filters'}
              </h3>
              <p className="text-slate-500 max-w-md">
                {assets.length === 0
                  ? 'Create reusable characters, lighting setups, and camera moves to keep campaigns consistent.'
                  : 'Try adjusting your search terms or switching categories.'}
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] transition hover:brightness-110"
              >
                <Sparkles className="h-4 w-4" />
                Create asset
              </button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${getTypeColor(asset.type)}`}>
                        {asset.type === 'character' && <Sparkles className="h-3.5 w-3.5" />}
                        {asset.type === 'environment' && <Trees className="h-3.5 w-3.5" />}
                        {asset.type === 'lighting' && <SunMedium className="h-3.5 w-3.5" />}
                        {asset.type === 'camera' && <Camera className="h-3.5 w-3.5" />}
                      </span>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900 line-clamp-1">{asset.name}</h3>
                      {asset.metadata.usageCount ? (
                        <p className="text-xs text-slate-400">{asset.metadata.usageCount} uses</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setEditingAsset(asset)}
                        className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="rounded-full border border-red-100 p-2 text-red-500 transition hover:border-red-200 hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500 line-clamp-4">{asset.description}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                    <span>
                      Created {asset.metadata.createdAt instanceof Date
                        ? asset.metadata.createdAt.toLocaleDateString()
                        : asset.metadata.createdAt && typeof (asset.metadata.createdAt as any).toDate === 'function'
                          ? (asset.metadata.createdAt as any).toDate().toLocaleDateString()
                          : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      {asset.type === 'character' && <Sparkles className="h-3.5 w-3.5" />}
                      {asset.type === 'environment' && <Trees className="h-3.5 w-3.5" />}
                      {asset.type === 'lighting' && <SunMedium className="h-3.5 w-3.5" />}
                      {asset.type === 'camera' && <Camera className="h-3.5 w-3.5" />}
                      {getTypeLabel(asset.type)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4">Type</th>
                    <th className="px-6 py-4 text-center">Usage</th>
                    <th className="px-6 py-4 text-right">Created</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="transition hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{asset.name}</div>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{asset.description}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center justify-center rounded-full border px-3 py-1 text-xs font-semibold ${getTypeColor(asset.type)}`}>
                          {asset.type === 'character' && <Sparkles className="h-3.5 w-3.5" />}
                          {asset.type === 'environment' && <Trees className="h-3.5 w-3.5" />}
                          {asset.type === 'lighting' && <SunMedium className="h-3.5 w-3.5" />}
                          {asset.type === 'camera' && <Camera className="h-3.5 w-3.5" />}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-slate-600 tabular-nums">
                        {asset.metadata.usageCount ?? 0}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 tabular-nums">
                        {asset.metadata.createdAt instanceof Date
                          ? asset.metadata.createdAt.toLocaleDateString()
                          : asset.metadata.createdAt && typeof (asset.metadata.createdAt as any).toDate === 'function'
                            ? (asset.metadata.createdAt as any).toDate().toLocaleDateString()
                            : ''}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => setEditingAsset(asset)}
                            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="rounded-full border border-red-100 p-2 text-red-500 transition hover:border-red-200 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Create/Edit Modal */}
        {(showCreateModal || editingAsset) && (
          <AssetModal
            asset={editingAsset}
            onClose={() => {
              setShowCreateModal(false);
              setEditingAsset(null);
            }}
            onSave={async (data) => {
              if (!user) return;

              try {
                if (editingAsset) {
                  await updateAsset(editingAsset.id, data);
                } else {
                  await createAsset(user.uid, data);
                }
                await loadAssets();
                setShowCreateModal(false);
                setEditingAsset(null);
              } catch (error) {
                console.error('Error saving asset:', error);
                alert('Failed to save asset');
              }
            }}
          />
        )}
      </div>
    </MainLayout>
  );
}

interface AssetModalProps {
  asset: Asset | null;
  onClose: () => void;
  onSave: (data: {
    type: AssetType;
    name: string;
    description: string;
    tags?: string[];
    promptMetadata?: AssetPromptMetadata;
  }) => Promise<void>;
}

function AssetModal({ asset, onClose, onSave }: AssetModalProps) {
  const [type, setType] = useState<AssetType>(asset?.type || 'character');
  const [name, setName] = useState(asset?.name || '');
  const [description, setDescription] = useState(asset?.description || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ type, name, description });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
                {asset ? 'Edit asset' : 'New asset'}
              </p>
              <h2 className="text-xl font-semibold text-slate-900">
                {asset ? 'Update existing asset' : 'Create reusable component'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div>
              <label className="text-sm font-medium text-slate-700">Asset type</label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {(['character', 'environment', 'lighting', 'camera'] as AssetType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${type === t ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'
                      }`}
                  >
                    {getTypeLabel(t)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Asset name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Hero protagonist, Neon office, Soft key light…"
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Description / prompt</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed prompt that will inform Sora about this asset."
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                rows={4}
                required
              />
              <p className="mt-1 text-xs text-slate-400">
                These prompts keep your renders consistent across teams.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !description}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : asset ? 'Update asset' : 'Create asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
