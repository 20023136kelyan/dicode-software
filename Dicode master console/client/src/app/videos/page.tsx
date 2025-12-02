'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MainLayout from '@/components/Layout/MainLayout';
import CollapsibleHero from '@/components/Layout/CollapsibleHero';
import Modal from '@/components/Layout/Modal';
import { Video, VideoUploadData } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useDropzone } from 'react-dropzone';
import { getAllVideos, createVideo, deleteVideo as deleteVideoDoc, getCampaignsByVideo, updateVideo } from '@/lib/firestore';
import { uploadVideo, generateVideoPath, deleteVideo as deleteVideoStorage } from '@/lib/storage';
import { Search, Sparkles, UploadCloud, LayoutGrid, Rows, Film, Lock, AlertTriangle } from 'lucide-react';
import { useRef } from 'react';

type ViewMode = 'grid' | 'list';

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

  const filterSource = (searchParams.get('source') as 'all' | 'generated' | 'uploaded') || 'all';
  const setFilterSource = (source: 'all' | 'generated' | 'uploaded') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('source', source);
    router.push(`/videos?${params.toString()}`);
  };
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadData, setUploadData] = useState<VideoUploadData>({
    file: null as any,
    title: '',
    description: '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
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
          // Update local state
          setVideos((prev) =>
            prev.map((v) => (v.id === video.id ? { ...v, duration } : v))
          );
          // Update Firestore
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'video/*': [] },
    multiple: false,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        setUploadData({ ...uploadData, file: acceptedFiles[0] });
      }
    },
  });

  const handleUpload = async () => {
    if (!user || !uploadData.file || !uploadData.title) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate storage path
      const storagePath = generateVideoPath(user.uid, uploadData.file.name);

      // Upload to Firebase Storage
      const downloadUrl = await uploadVideo(
        uploadData.file,
        storagePath,
        (progress) => setUploadProgress(progress)
      );

      // Create Firestore record
      const videoId = await createVideo(user.uid, {
        title: uploadData.title,
        description: uploadData.description,
        storageUrl: downloadUrl,
        source: 'uploaded',
        tags: uploadData.tags || [],
      });

      // Add to local state
      const newVideo: Video = {
        id: videoId,
        title: uploadData.title,
        description: uploadData.description,
        storageUrl: downloadUrl,
        source: 'uploaded',
        metadata: {
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: user.uid,
          tags: uploadData.tags || [],
        },
      };
      setVideos([newVideo, ...videos]);

      // Reset form
      setShowUploadModal(false);
      setUploadData({ file: null as any, title: '', description: '' });
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (video: Video) => {
    try {
      // Check if video is used in any campaigns
      const campaigns = await getCampaignsByVideo(video.id);
      setDeleteModalState({
        isOpen: true,
        video,
        campaigns,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to check campaign usage:', error);
      // Fallback to standard delete confirmation if check fails
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
    if (!video) return;

    setDeleteModalState((prev) => ({ ...prev, loading: true }));

    try {
      // Delete from Firestore (with force=true if in campaigns)
      await deleteVideoDoc(video.id, campaigns.length > 0);

      // Delete from Storage (only if uploaded, generated videos are managed by backend)
      if (video.source === 'uploaded') {
        const pathMatch = video.storageUrl.match(/videos%2F[^?]+/);
        if (pathMatch) {
          const path = decodeURIComponent(pathMatch[0].replace(/%2F/g, '/'));
          await deleteVideoStorage(path);
        }
      }

      // Remove from local state
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
      <div className="space-y-8 text-slate-900">
        <CollapsibleHero>
          <section className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-8 shadow-xl shadow-slate-100">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Video library</p>
                <h1 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl">
                  Every AI render, upload, and remix in one place.
                </h1>
                <p className="text-slate-600 max-w-2xl">
                  Organize your DiCode video outputs with the same polished system we use in the generation flow—clean
                  cards, rich metadata, and quick actions that keep teams in sync.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push('/generate')}
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_15px_45px_rgba(15,23,42,0.25)] transition hover:brightness-110"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate new video
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    <UploadCloud className="h-4 w-4" />
                    Upload video
                  </button>
                </div>
              </div>

              <div className="grid w-full max-w-xl gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                  <p className="text-3xl font-semibold text-slate-900">{videos.length}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Total</p>
                  <p className="mt-1 text-xs text-slate-500">library videos</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                  <p className="text-3xl font-semibold text-slate-900">{generatedCount}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Generated</p>
                  <p className="mt-1 text-xs text-slate-500">using Sora</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/90 p-4 text-center shadow-sm">
                  <p className="text-3xl font-semibold text-slate-900">{uploadedCount}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.35em] text-slate-400">Uploaded</p>
                  <p className="mt-1 text-xs text-slate-500">manual sources</p>
                </div>
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
                  placeholder="Search titles or descriptions..."
                  className="flex-1 border-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-1 py-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <LayoutGrid className="h-4 w-4" />
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                <Rows className="h-4 w-4" />
                List
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(['all', 'generated', 'uploaded'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setFilterSource(filter)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${filterSource === filter
                  ? 'bg-slate-900 text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)]'
                  : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-800'
                  }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          {loading ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 rounded-[32px] border border-slate-200 bg-white">
              <div className="h-10 w-10 rounded-full border-2 border-slate-200 border-t-slate-900 animate-spin" />
              <p className="text-sm text-slate-500">Fetching your videos…</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center rounded-[32px] border border-dashed border-slate-200 bg-white text-center p-12">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Film className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                {videos.length === 0 ? 'No videos yet' : 'Nothing matches your filters'}
              </h3>
              <p className="text-slate-500 max-w-md">
                {videos.length === 0
                  ? 'Generate a new piece or upload an existing asset to seed your library.'
                  : 'Try clearing your search, switching filters, or creating a new video.'}
              </p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filteredVideos.map((video) => (
                <div
                  key={video.id}
                  className="group flex flex-col gap-3"
                >
                  {/* Thumbnail Container */}
                  <div
                    className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-900/5 cursor-pointer"
                    onClick={() => setSelectedVideo(video)}
                  >
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : null}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      <span className="rounded-full bg-slate-900/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm">
                        Preview
                      </span>
                    </div>

                    {/* Duration Badge */}
                    {video.duration ? (
                      <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                        {formatDuration(video.duration)}
                      </div>
                    ) : null}
                  </div>

                  {/* Metadata Container */}
                  <div className="flex gap-3 items-start pr-2">
                    {/* Avatar / Icon Placeholder */}
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${video.source === 'generated' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'}`}>
                      {video.source === 'generated' ? <Sparkles className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
                    </div>

                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex justify-between items-start gap-2">
                        <h3
                          className="text-base font-semibold text-slate-900 line-clamp-2 leading-tight cursor-pointer group-hover:text-indigo-600 transition-colors"
                          onClick={() => setSelectedVideo(video)}
                        >
                          {video.title}
                        </h3>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(video);
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-red-500"
                          title="Delete video"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                        </button>
                      </div>

                      <div className="text-sm text-slate-600">
                        {video.source === 'generated' ? 'AI Generated' : 'Uploaded'} • {video.metadata.createdAt instanceof Date ? video.metadata.createdAt.toLocaleDateString() : ''}
                      </div>

                      {video.description && (
                        <p className="text-sm text-slate-500 line-clamp-2 mt-0.5">
                          {video.description}
                        </p>
                      )}

                      {video.metadata.tags && video.metadata.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {video.metadata.tags.slice(0, 3).map((tag) => (
                            <span
                              key={`${video.id}-${tag}`}
                              className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>) : (
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-6 py-4 w-20">Preview</th>
                    <th className="px-6 py-4">Video Details</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4 text-right">Duration</th>
                    <th className="px-6 py-4 text-right">Created</th>
                    <th className="px-6 py-4 text-right w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVideos.map((video) => (
                    <tr
                      key={video.id}
                      onClick={() => setSelectedVideo(video)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-6 py-4">
                        <div className="relative h-12 w-20 overflow-hidden rounded-lg bg-slate-100">
                          {video.thumbnailUrl ? (
                            <img
                              src={video.thumbnailUrl}
                              alt={video.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-400">
                              <Film className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-slate-900 line-clamp-1">{video.title}</div>
                          {video.description && (
                            <div className="text-xs text-slate-500 line-clamp-1 mt-0.5">{video.description}</div>
                          )}
                          {video.metadata.tags && video.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {video.metadata.tags.slice(0, 3).map((tag) => (
                                <span
                                  key={`${video.id}-list-${tag}`}
                                  className="inline-flex items-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                >
                                  {tag}
                                </span>
                              ))}
                              {video.metadata.tags.length > 3 && (
                                <span className="text-[10px] text-slate-400">+{video.metadata.tags.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${video.source === 'generated'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                          }`}>
                          {video.source === 'generated' ? <Sparkles className="h-3 w-3" /> : <UploadCloud className="h-3 w-3" />}
                          {video.source === 'generated' ? 'AI Generated' : 'Uploaded'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600 tabular-nums">
                        {video.duration ? formatDuration(video.duration) : '—'}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-500 tabular-nums">
                        {video.metadata.createdAt instanceof Date ? video.metadata.createdAt.toLocaleDateString() : ''}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(video);
                          }}
                          className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          title="Delete video"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!user && (
            <div className="flex items-center gap-3 rounded-[28px] border border-amber-200 bg-amber-50 p-4 text-amber-900">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Lock className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">
                Please sign in to view and manage your library.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Video"
        size="md"
      >
        <div className="space-y-5">
          <div
            {...getRootProps()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragActive ? 'border-slate-400 bg-slate-50' : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
              }`}
          >
            <input {...getInputProps()} />
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm">
              <UploadCloud className="h-5 w-5 text-slate-600" />
            </div>
            {uploadData.file ? (
              <p className="text-sm font-medium text-slate-700">{uploadData.file.name}</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">Drop your video here or click to browse.</p>
                <p className="text-xs text-slate-400">MP4, MOV, AVI supported</p>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Video title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={uploadData.title}
              onChange={(e) => setUploadData({ ...uploadData, title: e.target.value })}
              placeholder="Enter a descriptive title"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Description (optional)</label>
            <textarea
              value={uploadData.description}
              onChange={(e) => setUploadData({ ...uploadData, description: e.target.value })}
              placeholder="Describe the content or context of this video"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              rows={4}
            />
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Uploading…</span>
                <span className="font-semibold text-slate-900">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-slate-900 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!uploadData.file || !uploadData.title || uploading}
              className="flex-1 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(15,23,42,0.25)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading…' : 'Upload video'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalState.isOpen}
        onClose={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
        title={deleteModalState.campaigns.length > 0 ? "Warning: Video in Use" : "Delete Video"}
        size="sm"
      >
        <div className="space-y-4">
          {deleteModalState.campaigns.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-amber-900">
                    This video is used in {deleteModalState.campaigns.length} campaign(s)
                  </h4>
                  <p className="text-sm text-amber-800">
                    Deleting it will break the following campaigns:
                  </p>
                  <ul className="list-inside list-disc text-sm text-amber-800">
                    {deleteModalState.campaigns.map((c: any) => (
                      <li key={c.id}>{c.title}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-medium text-amber-900">
                    Please remove the video from these campaigns first, or proceed with caution.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-slate-600">
              Are you sure you want to delete <span className="font-semibold text-slate-900">"{deleteModalState.video?.title}"</span>? This action cannot be undone.
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setDeleteModalState({ ...deleteModalState, isOpen: false })}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              disabled={deleteModalState.loading}
              className={`flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-50 ${deleteModalState.campaigns.length > 0 ? 'bg-amber-600 shadow-amber-200' : 'bg-red-600 shadow-red-200'
                }`}
            >
              {deleteModalState.loading ? 'Deleting...' : deleteModalState.campaigns.length > 0 ? 'Force Delete' : 'Delete Video'}
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
          <div className="space-y-5">
            <video
              src={selectedVideo.storageUrl}
              controls
              className="w-full rounded-2xl border border-slate-200 bg-slate-900"
            />

            {selectedVideo.description && (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <h4 className="text-sm font-semibold text-slate-900 mb-1">Description</h4>
                <p className="text-sm text-slate-600">{selectedVideo.description}</p>
              </div>
            )}

            <div className="grid gap-4 rounded-2xl border border-slate-100 bg-white p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Source</p>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedVideo.source === 'generated' ? 'AI generated' : 'Uploaded'}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Created</p>
                <p className="text-sm font-semibold text-slate-900">
                  {selectedVideo.metadata.createdAt.toLocaleDateString()}
                </p>
              </div>
              {selectedVideo.duration ? (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Duration</p>
                  <p className="text-sm font-semibold text-slate-900">{formatDuration(selectedVideo.duration)}</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Duration</p>
                  <p className="text-sm font-semibold text-slate-900">—</p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
