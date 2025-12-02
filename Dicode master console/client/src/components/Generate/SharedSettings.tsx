'use client';

import { useState } from 'react';
import AssetSelector from './AssetSelector';

interface SharedSettingsProps {
  onApply: (settings: { character: string; environment: string; lighting: string }) => void;
}

export default function SharedSettings({ onApply }: SharedSettingsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [character, setCharacter] = useState('');
  const [environment, setEnvironment] = useState('');
  const [lighting, setLighting] = useState('');
  const [applied, setApplied] = useState(false);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleApply = () => {
    onApply({ character, environment, lighting });
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <div className="card rounded-2xl p-6 mb-6 border border-sky-500/20 bg-sky-500/5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-200">Shared Settings</h3>
          <p className="text-xs text-gray-400 mt-0.5">Optional - Apply common settings to all shots</p>
        </div>
        <button
          type="button"
          onClick={handleToggle}
          className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 hover:border-sky-500/40 text-sky-300 rounded-xl text-sm font-medium transition-all"
        >
          {isExpanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {isExpanded && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleApply}
            className={`w-full px-6 py-3 rounded-xl font-semibold transition-all shadow-lg ${
              applied
                ? 'bg-emerald-500 text-white shadow-emerald-500/25'
                : 'btn-primary'
            }`}
          >
            {applied ? '✓ Applied!' : 'Apply to All Shots'}
          </button>

          <AssetSelector
            type="character"
            value={character}
            onChange={setCharacter}
            label="Character Description"
            placeholder="Describe the character(s) to use for all shots"
          />

          <AssetSelector
            type="environment"
            value={environment}
            onChange={setEnvironment}
            label="Environment Description"
            placeholder="Describe the environment to use for all shots"
          />

          <AssetSelector
            type="lighting"
            value={lighting}
            onChange={setLighting}
            label="Lighting"
            placeholder="Describe lighting to use for all shots"
          />
        </div>
      )}
    </div>
  );
}
