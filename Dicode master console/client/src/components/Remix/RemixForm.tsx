'use client';

import { useState } from 'react';
import { RemixShotData, GenerationResult } from '@/lib/types';
import { remixVideo } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface RemixFormProps {
  onRemixStart: (taskId: string, shots: any[]) => void;
  quality: string;
  model: string;
}

export default function RemixForm({ onRemixStart }: RemixFormProps) {
  const { user } = useAuth();
  const [videoId, setVideoId] = useState('');
  const [shots, setShots] = useState<RemixShotData[]>([{ dialog: '' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddShot = () => {
    if (shots.length < 3) {
      setShots([...shots, { dialog: '' }]);
    }
  };

  const handleRemoveShot = (index: number) => {
    if (shots.length > 1) {
      setShots(shots.filter((_, i) => i !== index));
    }
  };

  const handleShotChange = (index: number, field: keyof RemixShotData, value: string) => {
    const newShots = [...shots];
    newShots[index] = { ...newShots[index], [field]: value };
    setShots(newShots);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result: GenerationResult = await remixVideo({
        video_id: videoId,
        shots,
      });

      if (result.task_id) {
        onRemixStart(result.task_id, shots);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to start remix');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="card rounded-2xl p-6">
        <label className="block text-sm font-medium mb-2 text-gray-300">
          Source Video ID <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={videoId}
          onChange={(e) => setVideoId(e.target.value)}
          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-gray-200 transition-all hover:bg-white/8 placeholder-gray-500"
          placeholder="Enter video ID to remix"
          required
        />
      </div>

      {shots.map((shot, index) => (
        <div key={index} className="card rounded-2xl p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
                {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-gray-200">Shot {index + 1}</h3>
            </div>
            {index > 0 && (
              <button
                type="button"
                onClick={() => handleRemoveShot(index)}
                className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl border border-red-500/30 hover:border-red-500/40 text-xs font-medium transition-all text-red-300"
              >
                Remove
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Dialog <span className="text-red-400">*</span>
              </label>
              <textarea
                value={shot.dialog}
                onChange={(e) => handleShotChange(index, 'dialog', e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none min-h-[100px] text-gray-200 transition-all hover:bg-white/8 placeholder-gray-500"
                placeholder="New dialog for this shot"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-gray-300">
                Description Override (optional)
              </label>
              <input
                type="text"
                value={shot.description || ''}
                onChange={(e) => handleShotChange(index, 'description', e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none text-gray-200 transition-all hover:bg-white/8 placeholder-gray-500"
                placeholder="Override original description"
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex gap-4">
        {shots.length < 3 && (
          <button
            type="button"
            onClick={handleAddShot}
            className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 hover:border-white/20 transition-all text-gray-300 hover:text-gray-200 font-medium"
          >
            Add Shot ({shots.length}/3)
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !user}
          className="flex-1 btn-primary px-6 py-3 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Remixing...
            </span>
          ) : (
            'Remix Video'
          )}
        </button>
      </div>

      {error && (
        <div className="card rounded-2xl p-4 border-2 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <XMarkIcon className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-sm text-red-300/90 flex-1">{error}</p>
          </div>
        </div>
      )}

      {!user && (
        <div className="card rounded-2xl p-4 border-2 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
              <LockClosedIcon className="w-5 h-5 text-gray-400" />
            </div>
            <p className="text-sm text-yellow-300/90 flex-1">Please sign in to remix videos</p>
          </div>
        </div>
      )}
    </form>
  );
}
