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

const AssetLibrary = () => {
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCompetency, setSelectedCompetency] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('date-desc');
  const [previewVideo, setPreviewVideo] = useState<VideoAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      duration: video.duration || 0, // Use actual duration or 0 if not set
      competencies: video.metadata.tags || [],
      status: 'active',
      createdDate: createdAt,
      updatedDate: updatedAt,
      viewCount: video.metadata.usageCount || 0, // TODO: Implement proper video usage tracking (see firestore.ts TODO)
      totalQuestions: video.questions?.length || 0,
      questions: video.questions || [], // Pass actual questions from video
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
  }, [videos.length]); // Only run when videos array length changes (after initial load)

  // Control video playback when preview changes
  useEffect(() => {
    if (!previewVideo) return;
    const video = videoRef.current;
    if (!video) return;

    // Reset video to beginning when preview changes
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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="border-b border-dark-border/70 pb-8 mb-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-dark-text-muted">Content Library</p>
            <h1 className="mt-3 text-4xl font-semibold">Video Library</h1>
            <p className="mt-2 max-w-2xl text-sm text-dark-text-muted">
              View all video content from across all organizations
            </p>
            <div className="mt-4 flex flex-wrap gap-6 text-base text-dark-text-muted">
              <div>
                <span className="text-dark-text font-semibold text-xl">{videos.length}</span> total videos
              </div>
              <div>
                <span className="text-dark-text font-semibold text-xl">{videos.length}</span> new videos
              </div>
              <div>
                <span className="text-dark-text font-semibold text-xl">
                  {videos.filter((v) => v.viewCount > 0).length}
                </span>{' '}
                videos used
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8">

        {/* Search and Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-text-muted" />
              <input
                type="text"
                className="input w-full pl-10"
                placeholder="Search videos by title, description, or competencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Competency Filter */}
            <div className="flex items-center gap-2">
              <Filter size={16} className="text-dark-text-muted" />
              <select
                className="input"
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
              className="input"
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
                className="px-4 py-2 text-sm text-dark-text-muted hover:text-dark-text flex items-center gap-2 transition-colors"
              >
                <X size={16} />
                Clear Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-500/30 bg-red-500/10 text-red-200 rounded-lg">
          {error}
        </div>
      )}

      {isLoading && videos.length === 0 && (
        <div className="mb-6 p-4 border border-dark-border rounded-lg text-dark-text-muted">
          Loading your shared video library...
        </div>
      )}

      {/* Video Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredVideos.map((video) => (
          <div key={video.id} className="group cursor-pointer">
            {/* Thumbnail */}
            <div
              className="relative mb-3 aspect-video bg-gradient-to-br from-blue-primary to-blue-light rounded-xl overflow-hidden"
              onClick={() => setPreviewVideo(video)}
            >
              {video.thumbnail ? (
                <>
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-200" />
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/40">
                  <Video size={48} className="text-dark-text-muted" />
                </div>
              )}
              {video.duration > 0 && (
                <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 rounded text-xs text-white font-semibold">
                  {formatDuration(video.duration)}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="px-1">
              <h3
                className="text-sm font-semibold text-dark-text mb-1 line-clamp-2 group-hover:text-primary transition-colors"
                onClick={() => setPreviewVideo(video)}
              >
                {video.title}
              </h3>

              <p className="text-xs text-dark-text-muted line-clamp-2 mb-2">{video.description}</p>

              {/* Competencies */}
              <div className="flex flex-wrap gap-1 mb-2">
                {video.competencies.slice(0, 2).map((comp, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] rounded-full">
                    {comp}
                  </span>
                ))}
                {video.competencies.length > 2 && (
                  <span className="px-2 py-0.5 bg-dark-border/50 text-dark-text-muted text-[10px] rounded-full">
                    +{video.competencies.length - 2}
                  </span>
                )}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-3 text-[11px] text-dark-text-muted">
                {video.viewCount > 0 && (
                  <span>{video.viewCount} views</span>
                )}
                {video.totalQuestions > 0 && (
                  <span>• {video.totalQuestions} Q</span>
                )}
                <span>• {formatDate(video.updatedDate)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredVideos.length === 0 && !isLoading && (
        <div className="card text-center py-12">
          <div className="p-4 bg-dark-bg rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
            <FolderOpen size={40} className="text-dark-text-muted" />
          </div>
          <h3 className="text-xl font-semibold text-dark-text mb-2">No videos found</h3>
          <p className="text-dark-text-muted mb-6">
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
              className="btn-primary inline-flex items-center gap-2"
            >
              <X size={16} />
              Clear All
            </button>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewVideo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-dark-card w-full max-w-4xl rounded-lg shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 bg-dark-card border-b border-dark-border p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-dark-text">{previewVideo.title}</h2>
                <p className="text-sm text-dark-text-muted mt-1">{previewVideo.description}</p>
              </div>
              <button
                onClick={() => setPreviewVideo(null)}
                className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
              >
                <X size={20} className="text-dark-text" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
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
                <div>
                  <h3 className="text-sm font-semibold text-dark-text-muted mb-2">Competencies</h3>
                  <div className="flex flex-wrap gap-2">
                    {previewVideo.competencies.map((comp, idx) => (
                      <span key={idx} className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                        {comp}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-dark-text-muted mb-2">Metadata</h3>
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
                    <h3 className="text-xl font-semibold text-dark-text">Questions ({previewVideo.questions.length})</h3>
                  </div>
                  <div className="space-y-4">
                    {previewVideo.questions.map((question, idx) => (
                      <div key={question.id} className="card">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="px-2 py-1 bg-dark-bg text-dark-text-muted text-xs rounded">
                                {question.type}
                              </span>
                              {question.competency && (
                                <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded">
                                  {question.competency}
                                </span>
                              )}
                              {question.isRequired && (
                                <span className="px-2 py-1 bg-red-500/10 text-red-400 text-xs rounded">
                                  Required
                                </span>
                              )}
                            </div>
                            <h4 className="font-semibold text-dark-text mb-3">{question.statement}</h4>
                            {question.scaleType && question.scaleLabels && (
                              <div className="bg-dark-bg p-3 rounded-lg">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="text-dark-text-muted">{question.scaleLabels.low}</span>
                                  <span className="px-3 py-1 bg-primary/10 text-primary rounded">{question.scaleType}</span>
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
