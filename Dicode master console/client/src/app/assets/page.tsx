'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import MainLayout from '@/components/Layout/MainLayout';
import { Asset, AssetPromptMetadata, AssetType } from '@/lib/types';
import { getAssetsByUser, createAsset, updateAsset, deleteAsset, logActivity } from '@/lib/firestore';
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
  List,
  User,
  MapPin,
  Lightbulb,
  Video,
} from 'lucide-react';
import { AssetCardSkeleton } from '@/components/ui/skeleton';

const getTypeColor = (type: AssetType) => {
  switch (type) {
    case 'character': return 'bg-purple-100 text-purple-700';
    case 'environment': return 'bg-emerald-100 text-emerald-700';
    case 'lighting': return 'bg-amber-100 text-amber-700';
    case 'camera': return 'bg-sky-100 text-sky-700';
  }
};

const getTypeIcon = (type: AssetType) => {
  switch (type) {
    case 'character': return User;
    case 'environment': return MapPin;
    case 'lighting': return Lightbulb;
    case 'camera': return Video;
  }
};

const getTypeLabel = (type: AssetType) => {
  switch (type) {
    case 'character': return 'Character';
    case 'environment': return 'Environment';
    case 'lighting': return 'Lighting';
    case 'camera': return 'Camera';
  }
};

export default function AssetsPage() {
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();
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
    if (!user) return;

    const assetToDelete = assets.find(a => a.id === assetId);

    try {
      await deleteAsset(assetId);
      setAssets(assets.filter(a => a.id !== assetId));

      if (assetToDelete) {
        await logActivity({
          action: 'asset_deleted',
          userId: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || undefined,
          resourceId: assetId,
          resourceName: assetToDelete.name,
          resourceType: 'asset',
        });
      }
      showSuccess('Asset Deleted', 'The asset has been successfully deleted.');
    } catch (error) {
      console.error('Error deleting asset:', error);
      showError('Delete Failed', 'Failed to delete asset. Please try again.');
    }
  };

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = searchQuery === '' ||
      asset.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const assetsByType = {
    character: assets.filter(a => a.type === 'character'),
    environment: assets.filter(a => a.type === 'environment'),
    lighting: assets.filter(a => a.type === 'lighting'),
    camera: assets.filter(a => a.type === 'camera'),
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{assets.length}</p>
                <p className="text-xs text-slate-500">Total Assets</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{assetsByType.character.length}</p>
                <p className="text-xs text-slate-500">Characters</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{assetsByType.environment.length}</p>
                <p className="text-xs text-slate-500">Environments</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                <Lightbulb className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{assetsByType.lighting.length + assetsByType.camera.length}</p>
                <p className="text-xs text-slate-500">Lighting & Camera</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {(['all', 'character', 'environment', 'lighting', 'camera'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedType(filter)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    selectedType === filter
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search assets..."
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                />
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                  viewMode === 'grid'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                  viewMode === 'list'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* New Asset Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              New Asset
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <AssetCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredAssets.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-4">
              <Palette className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {assets.length === 0 ? 'No assets yet' : 'No matching assets'}
              </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
                {assets.length === 0
                ? 'Create reusable characters, lighting setups, and camera moves.'
                : 'Try adjusting your search or filters.'}
              </p>
            {assets.length === 0 && user && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Create Asset
              </button>
            )}
            </div>
          ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset) => {
              const TypeIcon = getTypeIcon(asset.type);
              return (
                <div
                  key={asset.id}
                  className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getTypeColor(asset.type)}`}>
                      <TypeIcon className="h-3 w-3" />
                      {getTypeLabel(asset.type)}
                      </span>
                    <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => setEditingAsset(asset)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-semibold text-slate-900 line-clamp-1 mb-1">
                    {asset.name}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-3 mb-4">
                    {asset.description}
                  </p>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-3 border-t border-slate-100">
                    <span>
                      {asset.metadata.createdAt instanceof Date
                        ? asset.metadata.createdAt.toLocaleDateString()
                        : asset.metadata.createdAt && typeof (asset.metadata.createdAt as any).toDate === 'function'
                          ? (asset.metadata.createdAt as any).toDate().toLocaleDateString()
                          : ''}
                    </span>
                    {asset.metadata.usageCount ? (
                      <span>{asset.metadata.usageCount} uses</span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            </div>
          ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Asset
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Usage
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3 w-20"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                {filteredAssets.map((asset) => {
                  const TypeIcon = getTypeIcon(asset.type);
                  return (
                    <tr key={asset.id} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-slate-900">{asset.name}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{asset.description}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${getTypeColor(asset.type)}`}>
                          <TypeIcon className="h-3 w-3" />
                          {getTypeLabel(asset.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {asset.metadata.usageCount ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-slate-500">
                        {asset.metadata.createdAt instanceof Date
                          ? asset.metadata.createdAt.toLocaleDateString()
                          : asset.metadata.createdAt && typeof (asset.metadata.createdAt as any).toDate === 'function'
                            ? (asset.metadata.createdAt as any).toDate().toLocaleDateString()
                            : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingAsset(asset)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
          )}
      </div>

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
                await logActivity({
                  action: 'asset_updated',
                  userId: user.uid,
                  userEmail: user.email || '',
                  userName: user.displayName || undefined,
                  resourceId: editingAsset.id,
                  resourceName: data.name,
                  resourceType: 'asset',
                });
                } else {
                const newAssetId = await createAsset(user.uid, data);
                await logActivity({
                  action: 'asset_created',
                  userId: user.uid,
                  userEmail: user.email || '',
                  userName: user.displayName || undefined,
                  resourceId: newAssetId,
                  resourceName: data.name,
                  resourceType: 'asset',
                });
                }
                await loadAssets();
                setShowCreateModal(false);
                setEditingAsset(null);
                showSuccess('Asset Saved', editingAsset ? 'Asset has been updated.' : 'New asset has been created.');
              } catch (error) {
                console.error('Error saving asset:', error);
                showError('Save Failed', 'Failed to save asset. Please try again.');
              }
            }}
          />
        )}
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
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              {asset ? 'Edit Asset' : 'New Asset'}
              </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Type</label>
              <div className="grid grid-cols-4 gap-2">
                {(['character', 'environment', 'lighting', 'camera'] as AssetType[]).map((t) => {
                  const TypeIcon = getTypeIcon(t);
                  return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition ${
                        type === t
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                  >
                      <TypeIcon className="h-5 w-5" />
                      <span className="text-xs font-medium">{getTypeLabel(t)}</span>
                  </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Hero protagonist, Neon office..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Description / Prompt</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed prompt that will inform Sora about this asset..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
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
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name || !description}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : asset ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
