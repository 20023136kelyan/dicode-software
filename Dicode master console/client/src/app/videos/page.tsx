'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import Modal from '@/components/Layout/Modal';
import UploadVideoModal from '@/components/UploadVideoModal';
import EditVideoModal from '@/components/EditVideoModal';
import BulkAccessModal from '@/components/BulkAccessModal';
import { Video } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useNotification } from '@/contexts/NotificationContext';
import {
  getAllVideos,
  deleteVideo as deleteVideoDoc,
  getCampaignsByVideo,
  updateVideo,
  logActivity,
  bulkUpdateVideoAccess,
  bulkDeleteVideos,
} from '@/lib/firestore';
import { deleteVideo as deleteVideoStorage } from '@/lib/storage';
import {
  Search,
  Sparkles,
  UploadCloud,
  LayoutGrid,
  List,
  Film,
  Lock,
  AlertTriangle,
  Trash2,
  Play,
  X,
  Clock,
  Calendar,
  Download,
  Tag,
  MessageSquareText,
  BarChart3,
  MessageCircle,
  Pencil,
  Shield,
} from 'lucide-react';
import { VideoCardSkeleton } from '@/components/ui/skeleton';

type ViewMode = 'grid' | 'list';
type SourceFilter = 'all' | 'generated' | 'uploaded';

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export default function VideosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { error: showError, success: showSuccess } = useNotification();

  // State
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Bulk Actions State
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [showBulkAccessModal, setShowBulkAccessModal] = useState(false);

  // Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [deleteModalState, setDeleteModalState] = useState<{
    isOpen: boolean;
    video: Video | null;
    campaigns: any[];
    loading: boolean;
  }>({
    isOpen: false,
    video: null,
    campaigns: [],
    loading: false,
  });

  const attemptedExtraction = useRef<Set<string>>(new Set());

  const filterSource = (searchParams.get('source') as SourceFilter) || 'all';
  const setFilterSource = (source: SourceFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', source);
    router.push(`/videos?${params.toString()}`);
  };

  const loadVideos = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const userVideos = await getAllVideos();
      setVideos(userVideos);
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      showError('Error', 'Failed to load videos');
    } finally {
      setLoading(false);
    }
  };

  // Initial Load
  useEffect(() => {
    loadVideos();
  }, [user]);

  // Duration Extraction
  useEffect(() => {
    if (videos.length === 0) return;

    const extractDuration = (video: Video) => {
      if (attemptedExtraction.current.has(video.id)) return;
      attemptedExtraction.current.add(video.id);

      const videoEl = document.createElement('video');
      videoEl.preload = 'metadata';
      videoEl.src = video.storageUrl;
      videoEl.onloadedmetadata = () => {
        const duration = videoEl.duration;
        if (duration && duration !== Infinity) {
          setVideos((prev) =>
            prev.map((v) => (v.id === video.id ? { ...v, duration } : v))
          );
          updateVideo(video.id, { duration }).catch((err) =>
            console.error('Failed to update video duration:', err)
          );
        }
        videoEl.remove();
      };
      videoEl.onerror = () => {
        console.warn('Failed to load metadata for video:', video.id);
        videoEl.remove();
      };
    };

    videos.forEach((video) => {
      if ((!video.duration || video.duration === 0) && video.storageUrl) {
        extractDuration(video);
      }
    });
  }, [videos]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!selectedVideo) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedVideo(null);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedVideo]);

  // Filtering
  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterSource === 'all' || video.source === filterSource;
    return matchesSearch && matchesFilter;
  });

  const generatedCount = videos.filter((video) => video.source === 'generated').length;
  const uploadedCount = videos.filter((video) => video.source === 'uploaded').length;

  // Selection Logic
  const toggleSelection = (videoId: string) => {
    const newSelection = new Set(selectedVideoIds);
    if (newSelection.has(videoId)) {
      newSelection.delete(videoId);
    } else {
      newSelection.add(videoId);
    }
    setSelectedVideoIds(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedVideoIds.size === filteredVideos.length) {
      setSelectedVideoIds(new Set());
    } else {
      setSelectedVideoIds(new Set(filteredVideos.map(v => v.id)));
    }
  };

  // Bulk Handlers
  const handleBulkAccessUpdate = async (allowedOrganizations: string[]) => {
    try {
      await bulkUpdateVideoAccess(Array.from(selectedVideoIds), allowedOrganizations);
      showSuccess('Success', 'Video access updated successfully');
      setSelectedVideoIds(new Set());
      setShowBulkAccessModal(false);
      await loadVideos();
    } catch (error) {
      console.error('Failed to update bulk access:', error);
      showError('Error', 'Failed to update video access');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedVideoIds.size} videos?`)) return;

    try {
      await bulkDeleteVideos(Array.from(selectedVideoIds));
      showSuccess('Success', 'Videos deleted successfully');
      setSelectedVideoIds(new Set());
      await loadVideos();
    } catch (error) {
      console.error('Failed to delete videos:', error);
      showError('Error', 'Failed to delete videos');
    }
  };

  // Individual Handlers
  const handleUploadSuccess = async () => {
    await loadVideos();
  };

  const handleEditSuccess = (updatedVideo: Video) => {
    setVideos((prev) =>
      prev.map((v) => (v.id === updatedVideo.id ? updatedVideo : v))
    );
    if (selectedVideo?.id === updatedVideo.id) {
      setSelectedVideo(updatedVideo);
    }
  };

  const handleEdit = (video: Video) => {
    setEditingVideo(video);
  };

  const handleDelete = async (video: Video) => {
    try {
      const campaigns = await getCampaignsByVideo(video.id);
      setDeleteModalState({
        isOpen: true,
        video,
        campaigns,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to check campaign usage:', error);
      setDeleteModalState({
        isOpen: true,
        video,
        campaigns: [],
        loading: false,
      });
    }
  };

  const handleConfirmDelete = async () => {
    const { video, campaigns } = deleteModalState;
    if (!video || !user) return;

    setDeleteModalState((prev) => ({ ...prev, loading: true }));

    try {
      await deleteVideoDoc(video.id, campaigns.length > 0);

      if (video.source === 'uploaded') {
        const pathMatch = video.storageUrl.match(/videos%2F[^?]+/);
        if (pathMatch) {
          const path = decodeURIComponent(pathMatch[0].replace(/%2F/g, '/'));
          await deleteVideoStorage(path);
        }
      }

      await logActivity({
        action: 'video_deleted',
        userId: user.uid,
        userEmail: user.email || '',
        userName: user.displayName || undefined,
        resourceId: video.id,
        resourceName: video.title,
        resourceType: 'video',
      });

      setVideos(videos.filter((v) => v.id !== video.id));
      setDeleteModalState({ isOpen: false, video: null, campaigns: [], loading: false });
      showSuccess('Video Deleted', 'The video has been successfully deleted.');
    } catch (error) {
      console.error('Failed to delete video:', error);
      showError('Delete Failed', error instanceof Error ? error.message : 'Failed to delete video');
      setDeleteModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 relative">
        {/* Bulk Action Toolbar */}
        {selectedVideoIds.size > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-6 py-3 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 border-r border-slate-100 pr-4">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                {selectedVideoIds.size}
              </span>
              <span className="text-sm font-medium text-slate-700">Selected</span>
            </div>

            <button
              onClick={() => setShowBulkAccessModal(true)}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              <Shield className="h-4 w-4" />
              Edit Access
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50 transition"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>

            <button
              onClick={() => setSelectedVideoIds(new Set())}
              className="ml-2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{videos.length}</p>
                <p className="text-xs text-slate-500">Total Videos</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{generatedCount}</p>
                <p className="text-xs text-slate-500">AI Generated</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-100 text-sky-600">
                <UploadCloud className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{uploadedCount}</p>
                <p className="text-xs text-slate-500">Uploaded</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              {(['all', 'generated', 'uploaded'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterSource(filter)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${filterSource === filter
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
                placeholder="Search videos..."
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
              />
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-white p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${viewMode === 'grid'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition ${viewMode === 'list'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:text-slate-600'
                  }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => router.push('/generate')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
            >
              <Sparkles className="h-4 w-4" />
              Generate
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <UploadCloud className="h-4 w-4" />
              Upload
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-4">
              <Film className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {videos.length === 0 ? 'No videos yet' : 'No matching videos'}
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm">
              {videos.length === 0
                ? 'Generate an AI video or upload one to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
            {videos.length === 0 && user && (
              <div className="flex items-center gap-2 mt-6">
                <button
                  onClick={() => router.push('/generate')}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                >
                  <Sparkles className="h-4 w-4" />
                  Generate Video
                </button>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  Upload
                </button>
              </div>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredVideos.map((video) => (
              <div
                key={video.id}
                className={`group relative rounded-xl border bg-white overflow-hidden transition hover:shadow-lg ${selectedVideoIds.has(video.id)
                  ? 'border-indigo-500 ring-1 ring-indigo-500'
                  : 'border-slate-200'
                  }`}
              >
                {/* Selection Checkbox Overlay */}
                <div className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    checked={selectedVideoIds.has(video.id)}
                    onChange={() => toggleSelection(video.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-5 w-5 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer shadow-sm"
                  />
                </div>


                {/* Thumbnail */}
                <div
                  className="relative aspect-video w-full bg-slate-100 cursor-pointer"
                  onClick={() => {
                    if (selectedVideoIds.size > 0) {
                      toggleSelection(video.id);
                    } else {
                      setSelectedVideo(video);
                    }
                  }}
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                      <Film className="h-10 w-10" />
                    </div>
                  )}

                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-900 opacity-0 transition-all group-hover:opacity-100 shadow-lg">
                      <Play className="h-5 w-5 ml-0.5" />
                    </div>
                  </div>

                  {/* Restricted Lock Icon */}
                  {video.allowedOrganizations && video.allowedOrganizations.length > 0 && (
                    <div className="absolute top-2 right-2 flex items-center justify-center h-6 w-6 rounded-full bg-slate-900/80 text-white backdrop-blur-sm z-10" title="Restricted Access">
                      <Lock className="h-3 w-3" />
                    </div>
                  )}

                  {/* Duration badge */}
                  {video.duration ? (
                    <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                      {formatDuration(video.duration)}
                    </div>
                  ) : null}

                  {/* Source badge */}
                  <div
                    className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-medium ${video.source === 'generated'
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-700 text-white'
                      }`}
                  >
                    {video.source === 'generated' ? 'AI' : 'Uploaded'}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3
                      className="text-sm font-semibold text-slate-900 line-clamp-1 cursor-pointer hover:text-slate-700"
                      onClick={() => {
                        if (selectedVideoIds.size > 0) {
                          toggleSelection(video.id);
                        } else {
                          setSelectedVideo(video);
                        }
                      }}
                    >
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(video);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-500"
                        title="Edit video"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(video);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-red-500"
                        title="Delete video"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {video.description && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{video.description}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {video.metadata.createdAt instanceof Date
                      ? video.metadata.createdAt.toLocaleDateString()
                      : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredVideos.length > 0 &&
                        selectedVideoIds.size === filteredVideos.length
                      }
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 w-24">
                    Preview
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Video
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Source
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVideos.map((video) => (
                  <tr
                    key={video.id}
                    onClick={() => toggleSelection(video.id)}
                    className={`cursor-pointer transition hover:bg-slate-50 ${selectedVideoIds.has(video.id)
                      ? 'bg-indigo-50/50 hover:bg-indigo-50'
                      : ''
                      }`}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedVideoIds.has(video.id)}
                        onChange={() => toggleSelection(video.id)}
                        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative h-12 w-20 overflow-hidden rounded-lg bg-slate-100">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt={video.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-slate-300">
                            <Film className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 line-clamp-1">{video.title}</p>
                        {video.allowedOrganizations && video.allowedOrganizations.length > 0 && (
                          <span title="Restricted Access">
                            <Lock className="h-3.5 w-3.5 text-slate-400" />
                          </span>
                        )}
                      </div>
                      {video.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{video.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${video.source === 'generated'
                          ? 'bg-violet-100 text-violet-700'
                          : 'bg-slate-100 text-slate-700'
                          }`}
                      >
                        {video.source === 'generated' ? (
                          <Sparkles className="h-3 w-3" />
                        ) : (
                          <UploadCloud className="h-3 w-3" />
                        )}
                        {video.source === 'generated' ? 'AI' : 'Uploaded'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-600 tabular-nums">
                      {video.duration ? formatDuration(video.duration) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-500">
                      {video.metadata.createdAt instanceof Date
                        ? video.metadata.createdAt.toLocaleDateString()
                        : ''}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(video);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-blue-500"
                          title="Edit video"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(video);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
                          title="Delete video"
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

        {/* Auth Warning */}
        {!user && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Please sign in to view and manage your library.</p>
          </div>
        )}

        {/* Modals */}
        {showBulkAccessModal && (
          <BulkAccessModal
            isOpen={showBulkAccessModal}
            onClose={() => setShowBulkAccessModal(false)}
            selectedCount={selectedVideoIds.size}
            onSave={handleBulkAccessUpdate}
          />
        )}

        <UploadVideoModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />

        <EditVideoModal
          isOpen={!!editingVideo}
          onClose={() => setEditingVideo(null)}
          video={editingVideo}
          onSuccess={handleEditSuccess}
        />

        <Modal
          isOpen={deleteModalState.isOpen}
          onClose={() =>
            setDeleteModalState({ ...deleteModalState, isOpen: false })
          }
          title={
            deleteModalState.campaigns.length > 0
              ? 'Video in Use'
              : 'Delete Video'
          }
          size="sm"
        >
          <div className="space-y-4">
            {deleteModalState.campaigns.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">
                      This video is used in {deleteModalState.campaigns.length}{' '}
                      campaign(s)
                    </p>
                    <ul className="mt-2 list-disc list-inside text-sm text-amber-800">
                      {deleteModalState.campaigns.map((c: any) => (
                        <li key={c.id}>{c.title}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600">
                Are you sure you want to delete{' '}
                <span className="font-medium text-slate-900">
                  "{deleteModalState.video?.title}"
                </span>
                ? This action cannot be undone.
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() =>
                  setDeleteModalState({ ...deleteModalState, isOpen: false })
                }
                className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteModalState.loading}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${deleteModalState.campaigns.length > 0
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {deleteModalState.loading
                  ? 'Deleting...'
                  : deleteModalState.campaigns.length > 0
                    ? 'Force Delete'
                    : 'Delete'}
              </button>
            </div>
          </div>
        </Modal>

        {/* Video Preview Modal - Light Mode Design */}
        {selectedVideo && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedVideo(null);
            }}
          >
            <div className="relative flex gap-4 w-full max-w-6xl mx-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Close Button - Floating */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute -top-12 right-0 p-2 rounded-full bg-white/90 hover:bg-white text-slate-500 hover:text-slate-700 shadow-lg transition-all"
              >
                <X className="h-5 w-5" />
              </button>

              {/* Main Content Card */}
              <div className="flex-1 min-w-0 bg-white rounded-2xl overflow-hidden shadow-2xl">
                {/* Video Container */}
                <div className="relative bg-slate-950 flex items-center justify-center min-h-[300px] max-h-[65vh]">
                  <video
                    src={selectedVideo.storageUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-[65vh]"
                  />

                  {/* Source Badge - Floating */}
                  <div
                    className={`absolute top-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg ${selectedVideo.source === 'generated'
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-700 text-white'
                      }`}
                  >
                    {selectedVideo.source === 'generated' ? (
                      <Sparkles className="h-3 w-3" />
                    ) : (
                      <UploadCloud className="h-3 w-3" />
                    )}
                    {selectedVideo.source === 'generated'
                      ? 'AI Generated'
                      : 'Uploaded'}
                  </div>
                </div>

                {/* Info Section */}
                <div className="p-6 space-y-4">
                  {/* Title & Actions Row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl font-semibold text-slate-900 truncate">
                        {selectedVideo.title}
                      </h2>
                      {selectedVideo.description && (
                        <p className="mt-1 text-sm text-slate-500 line-clamp-2">
                          {selectedVideo.description}
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          handleEdit(selectedVideo);
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <a
                        href={selectedVideo.storageUrl}
                        download={selectedVideo.title}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    </div>
                  </div>

                  {/* Metadata Pills */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-100">
                    {selectedVideo.duration ? (
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{formatDuration(selectedVideo.duration)}</span>
                      </div>
                    ) : null}

                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Calendar className="h-4 w-4 text-slate-400" />
                      <span>
                        {selectedVideo.metadata.createdAt instanceof Date
                          ? selectedVideo.metadata.createdAt.toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                          : '—'}
                      </span>
                    </div>

                    {selectedVideo.metadata.tags && selectedVideo.metadata.tags.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Tag className="h-4 w-4 text-slate-400" />
                        <div className="flex flex-wrap gap-1.5">
                          {selectedVideo.metadata.tags.slice(0, 3).map((tag, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full bg-slate-100 text-xs font-medium text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                          {selectedVideo.metadata.tags.length > 3 && (
                            <span className="text-xs text-slate-400">
                              +{selectedVideo.metadata.tags.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Questions Sidebar */}
              <div className="hidden lg:flex w-80 flex-shrink-0 flex-col bg-white rounded-2xl shadow-2xl overflow-hidden">
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
                  <div className="flex items-center gap-2">
                    <MessageSquareText className="h-5 w-5 text-slate-600" />
                    <h3 className="font-semibold text-slate-900">Questions</h3>
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                      {selectedVideo.questions?.length || 0}
                    </span>
                  </div>
                </div>

                {/* Questions List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {selectedVideo.questions && selectedVideo.questions.length > 0 ? (
                    selectedVideo.questions.map((question, index) => (
                      <div
                        key={question.id}
                        className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2"
                      >
                        {/* Question Number & Type */}
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                            {index + 1}
                          </span>
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${question.type === 'qualitative'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-blue-100 text-blue-700'
                              }`}
                          >
                            {question.type === 'qualitative' ? (
                              <MessageCircle className="h-3 w-3" />
                            ) : (
                              <BarChart3 className="h-3 w-3" />
                            )}
                            {question.type === 'qualitative'
                              ? 'Open-ended'
                              : question.type === 'behavioral-perception'
                                ? 'Perception'
                                : 'Intent'}
                          </span>
                          {question.isRequired && (
                            <span className="text-red-500 text-xs">*</span>
                          )}
                        </div>

                        {/* Question Statement */}
                        <p className="text-sm text-slate-700 leading-relaxed">
                          {question.statement}
                        </p>

                        {/* Scale Info for Quantitative */}
                        {question.type !== 'qualitative' && question.scaleType && (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-xs text-slate-400">
                              {question.scaleType} scale
                            </span>
                            {question.scaleLabels && (
                              <span className="text-xs text-slate-400">
                                ({question.scaleLabels.low} → {question.scaleLabels.high})
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                        <MessageSquareText className="h-6 w-6 text-slate-400" />
                      </div>
                      <p className="text-sm font-medium text-slate-600">No questions</p>
                      <p className="text-xs text-slate-400 mt-1">
                        This video has no questions attached
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
