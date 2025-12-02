'use client';

import { useState } from 'react';
import { ShotData, GenerationResult } from '@/lib/types';
import ShotPanel from './ShotPanel';
import SharedSettings from './SharedSettings';
import { generateVideo } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCardIcon, ExclamationTriangleIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';

interface GenerateFormProps {
  onGenerationStart: (taskId: string, shots: ShotData[]) => void;
  quality: string;
  model: string;
}

interface HiddenFields {
  character?: boolean;
  environment?: boolean;
  lighting?: boolean;
}

export default function GenerateForm({ onGenerationStart, quality, model }: GenerateFormProps) {
  const { getAuthToken, user } = useAuth();
  const [shots, setShots] = useState<ShotData[]>([
    { dialog: '', character: '', environment: '', lighting: '', camera: '' },
  ]);
  const [fieldsHiddenPerShot, setFieldsHiddenPerShot] = useState<HiddenFields[]>([{}]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'billing' | 'moderation' | 'generic'>('generic');

  const handleAddShot = () => {
    if (shots.length < 3) {
      setShots([...shots, { dialog: '' }]);
      setFieldsHiddenPerShot([...fieldsHiddenPerShot, {}]);
    }
  };

  const handleRemoveShot = (index: number) => {
    if (shots.length > 1) {
      setShots(shots.filter((_, i) => i !== index));
      setFieldsHiddenPerShot(fieldsHiddenPerShot.filter((_, i) => i !== index));
    }
  };

  const handleShotChange = (index: number, data: ShotData) => {
    const newShots = [...shots];
    newShots[index] = data;
    setShots(newShots);
  };

  const handleApplySharedSettings = (settings: { character: string; environment: string; lighting: string }) => {
    // Apply to all shots
    const newShots = shots.map(shot => ({
      ...shot,
      character: settings.character || shot.character,
      environment: settings.environment || shot.environment,
      lighting: settings.lighting || shot.lighting,
    }));
    setShots(newShots);

    // Hide fields on all shots
    const newHiddenFields = shots.map(() => ({
      character: !!settings.character,
      environment: !!settings.environment,
      lighting: !!settings.lighting,
    }));
    setFieldsHiddenPerShot(newHiddenFields);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorType('generic');
    setLoading(true);

    try {
      const token = await getAuthToken();
      const formData = new FormData();

      // Add shots data
      formData.append('shots', JSON.stringify(shots.map(s => ({
        character: s.character,
        environment: s.environment,
        lighting: s.lighting,
        camera: s.camera,
        dialog: s.dialog,
      }))));

      formData.append('quality', quality);
      formData.append('model', model);

      // Add image if present for shot 1
      if (shots[0]?.image) {
        formData.append('image_1', shots[0].image);
      }

      const result: GenerationResult = await generateVideo(formData);

      if (result.task_id) {
        onGenerationStart(result.task_id, shots);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to start generation';
      setError(errorMessage);

      // Detect error type
      const lowerError = errorMessage.toLowerCase();
      if (lowerError.includes('billing') || lowerError.includes('limit')) {
        setErrorType('billing');
      } else if (lowerError.includes('moderation')) {
        setErrorType('moderation');
      } else {
        setErrorType('generic');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <SharedSettings onApply={handleApplySharedSettings} />

      {shots.map((shot, index) => (
        <ShotPanel
          key={index}
          shotNumber={index + 1}
          data={shot}
          onChange={(data) => handleShotChange(index, data)}
          onRemove={index > 0 ? () => handleRemoveShot(index) : undefined}
          isFirst={index === 0}
          fieldsHidden={fieldsHiddenPerShot[index]}
        />
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
              Generating...
            </span>
          ) : (
            'Generate Videos'
          )}
        </button>
      </div>

      {error && errorType === 'billing' && (
        <div className="card rounded-2xl p-6 border-2 border-red-500/30 bg-red-500/5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <CreditCardIcon className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-400 mb-1">Billing Limit Reached</h3>
              <p className="text-sm text-red-300/90">
                Your OpenAI account has reached its billing limit
              </p>
            </div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-red-300 mb-2 text-sm">What this means:</h4>
            <ul className="list-disc list-inside text-xs text-red-200/80 space-y-1.5">
              <li>Your account has hit its spending limit</li>
              <li>You need to add or update your payment method</li>
              <li>You may need to increase your spending limits</li>
            </ul>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-yellow-300 mb-2 text-sm">How to Fix:</h4>
            <ol className="list-decimal list-inside text-xs text-yellow-200/80 space-y-1.5">
              <li>Visit your OpenAI billing settings</li>
              <li>Add or update your payment method</li>
              <li>Increase your spending limits if needed</li>
            </ol>
          </div>
          <div className="flex gap-3">
            <a
              href="https://platform.openai.com/account/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-sky-500/25"
            >
              Open Billing Settings
            </a>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl font-medium text-sm transition-all"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}

      {error && errorType === 'moderation' && (
        <div className="card rounded-2xl p-6 border-2 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-amber-400 mb-1">Content Moderation Issue</h3>
              <p className="text-sm text-amber-300/90">
                Your reference image likely triggered OpenAI's content moderation system.
              </p>
            </div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-amber-300 mb-2 text-sm">Why this happens:</h4>
            <ul className="list-disc list-inside text-xs text-amber-200/80 space-y-1.5">
              <li>Images with faces or people are automatically flagged</li>
              <li>Human subjects trigger strict moderation</li>
              <li>Even partial views of people can cause issues</li>
            </ul>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-emerald-300 mb-2 text-sm">Solution:</h4>
            <p className="text-xs text-emerald-200/80 mb-2">
              <strong>Remove the reference image</strong> and try again. Most video generations work perfectly without images!
            </p>
            <p className="text-xs text-emerald-200/80">
              If you need an image, use: landscapes, objects, buildings, abstract patterns (NO people)
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              const newShots = [...shots];
              if (newShots[0]) {
                newShots[0].image = null;
              }
              setShots(newShots);
            }}
            className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-red-500/25"
          >
            Go Back & Remove Image
          </button>
        </div>
      )}

      {error && errorType === 'generic' && (
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
            <p className="text-sm text-yellow-300/90 flex-1">Please sign in to generate videos</p>
          </div>
        </div>
      )}
    </form>
  );
}
