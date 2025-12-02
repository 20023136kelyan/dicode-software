import { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderOpen,
  Search,
  Eye,
  Calendar,
  Video,
  Filter,
  X,
  HelpCircle,
  LayoutGrid,
  List,
  Film,
  Play,
} from 'lucide-react';
import { getAllVideos } from '@/lib/firestore';
import type { Video as FirestoreVideo, Question } from '@/types';

interface VideoAsset {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail?: string;
  duration: number; // in seconds
  competencies: string[];
  status: 'active' | 'draft' | 'archived';
  createdDate: Date;
  updatedDate: Date;
  viewCount: number;
  totalQuestions: number; // Count of questions on the video
  questions: Question[]; // Actual questions from video
}

type ViewMode = 'grid' | 'list';

const AssetLibrary = () => {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompetency, setSelectedCompetency] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [previewVideo, setPreviewVideo] = useState<VideoAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Utility to get video duration from URL
  const getVideoDuration = async (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = videoUrl;

      video.onloadedmetadata = () => {
        resolve(Math.round(video.duration));
      };

      video.onerror = () => {
        reject(new Error('Failed to load video metadata'));
      };
    });
  };

  const mapFirestoreVideo = (video: FirestoreVideo): VideoAsset => {
    const createdAt = video.metadata.createdAt ? new Date(video.metadata.createdAt) : new Date();
    const updatedAt = video.metadata.updatedAt ? new Date(video.metadata.updatedAt) : createdAt;
    return {
      id: video.id,
      title: video.title,
      description: video.description || 'No description provided.',
      videoUrl: video.storageUrl,
      thumbnail: video.thumbnailUrl,
      duration: video.duration || 0,
      competencies: video.metadata.tags || [],
      status: 'active',
      createdDate: createdAt,
      updatedDate: updatedAt,
      viewCount: video.metadata.usageCount || 0,
      totalQuestions: video.questions?.length || 0,
      questions: video.questions || [],
    };
  };

  useEffect(() => {
    let isMounted = true;

    const loadVideos = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getAllVideos();
        if (isMounted) {
          setVideos(data.map(mapFirestoreVideo));
        }
      } catch (err) {
        console.error('Failed to load videos', err);
        if (isMounted) {
          setError('Unable to load the video library right now.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadVideos();

    return () => {
      isMounted = false;
    };
  }, []);

  // Calculate missing durations as fallback
  useEffect(() => {
    const calculateMissingDurations = async () => {
      const videosNeedingDuration = videos.filter(v => !v.duration || v.duration === 0);

      if (videosNeedingDuration.length === 0) return;

      console.log(`📊 Calculating duration for ${videosNeedingDuration.length} videos...`);

      for (const video of videosNeedingDuration) {
        try {
          const duration = await getVideoDuration(video.videoUrl);
          setVideos(prev =>
            prev.map(v => v.id === video.id ? { ...v, duration } : v)
          );
          console.log(`✅ Duration calculated for "${video.title}": ${duration}s`);
        } catch (err) {
          console.warn(`⚠️ Failed to calculate duration for "${video.title}":`, err);
        }
      }
    };

    calculateMissingDurations();
  }, [videos.length]);

  // Control video playback when preview changes
  useEffect(() => {
    if (!previewVideo) return;
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = 0;
  }, [previewVideo?.id]);

  const allCompetencies = useMemo(
    () =>
      Array.from(new Set(videos.flatMap((video) => video.competencies))).sort(),
    [videos]
  );

  const filteredVideos = useMemo(() => {
    return videos
      .filter((video) => {
        const matchesSearch =
          video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          video.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          video.competencies.some((comp) => comp.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesCompetency =
          selectedCompetency === 'all' || video.competencies.includes(selectedCompetency);

        return matchesSearch && matchesCompetency;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return b.updatedDate.getTime() - a.updatedDate.getTime();
        } else if (sortBy === 'date-asc') {
          return a.updatedDate.getTime() - b.updatedDate.getTime();
        } else if (sortBy === 'views-desc') {
          return b.viewCount - a.viewCount;
        } else if (sortBy === 'views-asc') {
          return a.viewCount - b.viewCount;
        } else if (sortBy === 'title-asc') {
          return a.title.localeCompare(b.title);
        } else if (sortBy === 'title-desc') {
          return b.title.localeCompare(a.title);
        }
        return 0;
      });
  }, [videos, searchQuery, selectedCompetency, sortBy]);

  // Check if any filters are active
  const hasActiveFilters = selectedCompetency !== 'all' || sortBy !== 'date-desc';

  // Clear all filters
  const clearFilters = () => {
    setSelectedCompetency('all');
    setSortBy('date-desc');
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const inUseCount = videos.filter((v) => v.viewCount > 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-dark-text">Asset Library</h1>
          <p className="text-sm text-dark-text-muted mt-1">
            Browse and preview your shared video collection
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dark-bg text-dark-text-muted">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">{videos.length}</p>
              <p className="text-xs text-dark-text-muted">Total Videos</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">{inUseCount}</p>
              <p className="text-xs text-dark-text-muted">In Use</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-dark-text">
                {videos.reduce((acc, v) => acc + v.totalQuestions, 0)}
              </p>
              <p className="text-xs text-dark-text-muted">Questions</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {/* Competency Filter */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-dark-text-muted" />
            <select
              className="h-9 rounded-lg border border-dark-border bg-dark-card px-3 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={selectedCompetency}
              onChange={(e) => setSelectedCompetency(e.target.value)}
            >
              <option value="all">All Competencies</option>
              {allCompetencies.map((comp) => (
                <option key={comp} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By */}
          <select
            className="h-9 rounded-lg border border-dark-border bg-dark-card px-3 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="views-desc">Most Viewed</option>
            <option value="views-asc">Least Viewed</option>
            <option value="title-asc">Title (A-Z)</option>
            <option value="title-desc">Title (Z-A)</option>
          </select>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-9 px-3 text-sm text-dark-text-muted hover:text-dark-text flex items-center gap-2 transition-colors"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
            <input
              type="text"
              className="h-9 w-64 rounded-lg border border-dark-border bg-dark-card pl-9 pr-4 text-sm text-dark-text placeholder:text-dark-text-muted transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-dark-border bg-dark-card p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                viewMode === 'grid'
                  ? 'bg-dark-bg text-dark-text'
                  : 'text-dark-text-muted hover:text-dark-text'
              }`}
              title="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                viewMode === 'list'
                  ? 'bg-dark-bg text-dark-text'
                  : 'text-dark-text-muted hover:text-dark-text'
              }`}
              title="List view"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/20">
            <X className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {isLoading && videos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="h-8 w-8 rounded-full border-2 border-dark-border border-t-primary animate-spin" />
          <p className="mt-4 text-sm text-dark-text-muted">Loading videos...</p>
        </div>
      )}

      {/* Content */}
      {!isLoading && filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-dark-border bg-dark-card py-20 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-dark-bg text-dark-text-muted mb-4">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-dark-text">
            {videos.length === 0 ? 'No videos yet' : 'No matching videos'}
          </h3>
          <p className="mt-1 text-sm text-dark-text-muted max-w-sm">
            {searchQuery || hasActiveFilters
              ? 'Try adjusting your search or filters'
              : 'No active videos available in the system'}
          </p>
          {(searchQuery || hasActiveFilters) && (
            <button
              onClick={() => {
                setSearchQuery('');
                clearFilters();
              }}
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
            >
              <X size={16} />
              Clear All
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="group rounded-xl border border-dark-border bg-dark-card overflow-hidden transition hover:border-dark-border/80 hover:shadow-lg"
            >
              {/* Thumbnail */}
              <div
                className="relative aspect-video bg-dark-bg cursor-pointer"
                onClick={() => setPreviewVideo(video)}
              >
                {video.thumbnail ? (
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-dark-text-muted">
                    <Video className="h-10 w-10" />
                  </div>
                )}
                
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all group-hover:bg-black/20">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-dark-bg opacity-0 transition-all group-hover:opacity-100 shadow-lg">
                    <Play className="h-5 w-5 ml-0.5" />
                  </div>
                </div>

                {/* Duration badge */}
                {video.duration > 0 && (
                  <div className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
                    {formatDuration(video.duration)}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <h3
                  className="text-sm font-semibold text-dark-text line-clamp-1 cursor-pointer hover:text-primary transition-colors mb-1"
                  onClick={() => setPreviewVideo(video)}
                >
                  {video.title}
                </h3>

                <p className="text-xs text-dark-text-muted line-clamp-2 mb-3">{video.description}</p>

                {/* Competencies */}
                {video.competencies.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {video.competencies.slice(0, 2).map((comp, idx) => (
                      <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full font-medium">
                        {comp}
                      </span>
                    ))}
                    {video.competencies.length > 2 && (
                      <span className="px-2 py-0.5 bg-dark-bg text-dark-text-muted text-[10px] rounded-full">
                        +{video.competencies.length - 2}
                      </span>
                    )}
                  </div>
                )}

                {/* Meta info */}
                <div className="flex items-center gap-3 text-[11px] text-dark-text-muted">
                  {video.totalQuestions > 0 && (
                    <span>{video.totalQuestions} Q</span>
                  )}
                  <span>{formatDate(video.updatedDate)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-bg">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted w-24">
                  Preview
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                  Video
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                  Tags
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                  Duration
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                  Questions
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-dark-text-muted">
                  Updated
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-border">
              {filteredVideos.map((video) => (
                <tr
                  key={video.id}
                  onClick={() => setPreviewVideo(video)}
                  className="cursor-pointer transition hover:bg-dark-bg/50"
                >
                  <td className="px-4 py-3">
                    <div className="relative h-12 w-20 overflow-hidden rounded-lg bg-dark-bg">
                      {video.thumbnail ? (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-dark-text-muted">
                          <Video className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-dark-text line-clamp-1">{video.title}</p>
                    {video.description && (
                      <p className="text-xs text-dark-text-muted line-clamp-1">{video.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {video.competencies.slice(0, 2).map((comp, idx) => (
                        <span key={idx} className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {comp}
                        </span>
                      ))}
                      {video.competencies.length > 2 && (
                        <span className="inline-flex items-center rounded-md bg-dark-bg px-2 py-0.5 text-xs text-dark-text-muted">
                          +{video.competencies.length - 2}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-dark-text tabular-nums">
                    {video.duration > 0 ? formatDuration(video.duration) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-dark-text">
                    {video.totalQuestions > 0 ? video.totalQuestions : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-dark-text-muted">
                    {formatDate(video.updatedDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card w-full max-w-4xl rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto border border-dark-border">
            {/* Header */}
            <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold text-dark-text">{previewVideo.title}</h2>
                <p className="text-sm text-dark-text-muted mt-1">{previewVideo.description}</p>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors"
              >
                <X size={20} className="text-dark-text" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
                <video
                  ref={videoRef}
                  key={previewVideo.videoUrl}
                  src={previewVideo.videoUrl}
                  controls
                  className="w-full h-full"
                  poster={previewVideo.thumbnail}
                >
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Video Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-dark-border bg-dark-bg p-4">
                  <h3 className="text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-3">Competencies</h3>
                  <div className="flex flex-wrap gap-2">
                    {previewVideo.competencies.length > 0 ? (
                      previewVideo.competencies.map((comp, idx) => (
                        <span key={idx} className="px-3 py-1.5 bg-primary/10 text-primary text-sm rounded-lg font-medium">
                          {comp}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-dark-text-muted">No competencies tagged</span>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-dark-border bg-dark-bg p-4">
                  <h3 className="text-xs font-semibold text-dark-text-muted uppercase tracking-wider mb-3">Metadata</h3>
                  <div className="space-y-2 text-sm text-dark-text">
                    <div className="flex items-center gap-2">
                      <Calendar size={16} className="text-dark-text-muted" />
                      <span>Updated: {formatDate(previewVideo.updatedDate)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye size={16} className="text-dark-text-muted" />
                      <span>{previewVideo.viewCount} views</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Questions Section */}
              {previewVideo.questions.length > 0 && (
                <div className="border-t border-dark-border pt-6">
                  <div className="flex items-center gap-2 mb-4">
                    <HelpCircle size={20} className="text-primary" />
                    <h3 className="text-lg font-semibold text-dark-text">Questions ({previewVideo.questions.length})</h3>
                  </div>
                  <div className="space-y-3">
                    {previewVideo.questions.map((question, idx) => (
                      <div key={question.id} className="rounded-xl border border-dark-border bg-dark-bg p-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 bg-dark-card text-dark-text-muted text-xs rounded-md">
                                {question.type}
                              </span>
                              {question.competency && (
                                <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-md">
                                  {question.competency}
                                </span>
                              )}
                              {question.isRequired && (
                                <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded-md">
                                  Required
                                </span>
                              )}
                            </div>
                            <h4 className="font-medium text-dark-text mb-3">{question.statement}</h4>
                            {question.scaleType && question.scaleLabels && (
                              <div className="bg-dark-card p-3 rounded-lg">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-dark-text-muted">{question.scaleLabels.low}</span>
                                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-md text-xs">{question.scaleType}</span>
                                  <span className="text-dark-text-muted">{question.scaleLabels.high}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetLibrary;
