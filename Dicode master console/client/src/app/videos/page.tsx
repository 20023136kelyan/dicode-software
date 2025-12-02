'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import Modal from '@/components/Layout/Modal';
import UploadVideoModal from '@/components/UploadVideoModal';
import { Video } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { getAllVideos, deleteVideo as deleteVideoDoc, getCampaignsByVideo, updateVideo, logActivity } from '@/lib/firestore';
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
} from 'lucide-react';

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
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const filterSource = (searchParams.get('source') as SourceFilter) || 'all';
  const setFilterSource = (source: SourceFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', source);
    router.push(`/videos?${params.toString()}`);
  };

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
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

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchVideos = async () => {
      try {
        const userVideos = await getAllVideos();
        setVideos(userVideos);
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, [user]);

  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterSource === 'all' || video.source === filterSource;
    return matchesSearch && matchesFilter;
  });

  const generatedCount = videos.filter((video) => video.source === 'generated').length;
  const uploadedCount = videos.filter((video) => video.source === 'uploaded').length;

  const handleUploadSuccess = async (videoId: string) => {
    // Refresh videos list
    try {
      const updatedVideos = await getAllVideos();
      setVideos(updatedVideos);
    } catch (error) {
      console.error('Failed to refresh videos:', error);
    }
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
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert(`Failed to delete video: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDeleteModalState((prev) => ({ ...prev, loading: false }));
    }
  };

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Video Library</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage your AI-generated and uploaded videos
                </p>
          </div>
          <div className="flex items-center gap-2">
                  <button
                    onClick={() => router.push('/generate')}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
                  >
                    <Sparkles className="h-4 w-4" />
              Generate
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <UploadCloud className="h-4 w-4" />
              Upload
                  </button>
                </div>
              </div>

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
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    filterSource === filter
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
            </div>
          </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
            <p className="mt-4 text-sm text-slate-500">Loading videos...</p>
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                className="group rounded-xl border border-slate-200 bg-white overflow-hidden transition hover:border-slate-300 hover:shadow-md"
                >
                {/* Thumbnail */}
                  <div
                  className="relative aspect-video w-full bg-slate-100 cursor-pointer"
                    onClick={() => setSelectedVideo(video)}
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

                  {/* Duration badge */}
                    {video.duration ? (
                      <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                        {formatDuration(video.duration)}
                      </div>
                    ) : null}

                  {/* Source badge */}
                  <div className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    video.source === 'generated'
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-700 text-white'
                  }`}>
                    {video.source === 'generated' ? 'AI' : 'Uploaded'}
                  </div>
                    </div>

                {/* Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                        <h3
                      className="text-sm font-semibold text-slate-900 line-clamp-1 cursor-pointer hover:text-slate-700"
                          onClick={() => setSelectedVideo(video)}
                        >
                          {video.title}
                        </h3>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(video);
                          }}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-slate-400 opacity-0 transition hover:bg-slate-100 hover:text-red-500 group-hover:opacity-100"
                        >
                      <Trash2 className="h-4 w-4" />
                        </button>
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
                      onClick={() => setSelectedVideo(video)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
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
                      <p className="text-sm font-medium text-slate-900 line-clamp-1">{video.title}</p>
                          {video.description && (
                        <p className="text-xs text-slate-500 line-clamp-1">{video.description}</p>
                      )}
                      </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        video.source === 'generated'
                          ? 'bg-violet-100 text-violet-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                          {video.source === 'generated' ? <Sparkles className="h-3 w-3" /> : <UploadCloud className="h-3 w-3" />}
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
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(video);
                          }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
                        >
                        <Trash2 className="h-4 w-4" />
                        </button>
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
      </div>

      {/* Upload Modal */}
      <UploadVideoModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
        title={deleteModalState.campaigns.length > 0 ? 'Video in Use' : 'Delete Video'}
        size="sm"
      >
        <div className="space-y-4">
          {deleteModalState.campaigns.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900">
                    This video is used in {deleteModalState.campaigns.length} campaign(s)
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
              Are you sure you want to delete <span className="font-medium text-slate-900">"{deleteModalState.video?.title}"</span>? This action cannot be undone.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
              className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteModalState.loading}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 ${
                deleteModalState.campaigns.length > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-red-600 hover:bg-red-700'
                }`}
            >
              {deleteModalState.loading ? 'Deleting...' : deleteModalState.campaigns.length > 0 ? 'Force Delete' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Video Preview Modal */}
      {selectedVideo && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedVideo(null)}
          title={selectedVideo.title}
          size="lg"
        >
          <div className="space-y-4">
            <video
              src={selectedVideo.storageUrl}
              controls
              autoPlay
              className="w-full rounded-lg bg-black"
            />

            {selectedVideo.description && (
                <p className="text-sm text-slate-600">{selectedVideo.description}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Source</p>
                <p className="text-sm font-medium text-slate-900">
                  {selectedVideo.source === 'generated' ? 'AI Generated' : 'Uploaded'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Created</p>
                <p className="text-sm font-medium text-slate-900">
                  {selectedVideo.metadata.createdAt instanceof Date
                    ? selectedVideo.metadata.createdAt.toLocaleDateString()
                    : ''}
                </p>
              </div>
                <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Duration</p>
                <p className="text-sm font-medium text-slate-900">
                  {selectedVideo.duration ? formatDuration(selectedVideo.duration) : '—'}
                </p>
                </div>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
