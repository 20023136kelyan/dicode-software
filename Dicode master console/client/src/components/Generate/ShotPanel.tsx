'use client';

import { useState, useEffect } from 'react';
import { ShotData } from '@/lib/types';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import AssetSelector from './AssetSelector';

interface ShotPanelProps {
  shotNumber: number;
  data: ShotData;
  onChange: (data: ShotData) => void;
  onRemove?: () => void;
  isFirst: boolean;
  fieldsHidden?: { character?: boolean; environment?: boolean; lighting?: boolean };
  onFieldsHiddenChange?: (hidden: { character?: boolean; environment?: boolean; lighting?: boolean }) => void;
}

export default function ShotPanel({
  shotNumber,
  data,
  onChange,
  onRemove,
  isFirst,
  fieldsHidden = {},
  onFieldsHiddenChange
}: ShotPanelProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [expandedFields, setExpandedFields] = useState(false);
  const [showModerationWarning, setShowModerationWarning] = useState(false);

  const handleInputChange = (field: keyof ShotData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange({ ...data, image: file });

    // Create preview
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const toggleExpandedFields = () => {
    setExpandedFields(!expandedFields);
  };

  // Show expand button for Shot 1 only if fields are hidden
  const showExpandButtonShot1 = isFirst && (fieldsHidden.character || fieldsHidden.environment || fieldsHidden.lighting);

  // Show expand button for Shots 2+ always (they have hidden fields by default)
  const showExpandButtonOthers = !isFirst;

  return (
    <div className="rounded-2xl p-6 mb-4">
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm">
            {shotNumber}
          </div>
          <h3 className="text-lg font-semibold text-gray-200">Shot {shotNumber}</h3>
        </div>
        <div className="flex gap-2">
          {(showExpandButtonShot1 || showExpandButtonOthers) && (
            <button
              type="button"
              onClick={toggleExpandedFields}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                expandedFields
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
                  : 'bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 hover:border-sky-500/40 text-sky-300'
              }`}
            >
              {expandedFields
                ? (isFirst ? 'Hide Shared' : 'Hide Fields')
                : (isFirst ? 'Show Shared' : 'Show Fields')}
            </button>
          )}
          {!isFirst && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl border border-red-500/30 hover:border-red-500/40 text-xs font-medium transition-all text-red-300"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {isFirst && (
          <>
            {/* Grid layout for square card fields */}
            <div className="grid grid-cols-4 gap-4">
              {(!fieldsHidden.character || expandedFields) && (
                <AssetSelector
                  type="character"
                  value={data.character || ''}
                  onChange={(value) => handleInputChange('character', value)}
                  label="Character Description"
                  placeholder="Describe the character(s)"
                  required
                />
              )}

              {(!fieldsHidden.environment || expandedFields) && (
                <AssetSelector
                  type="environment"
                  value={data.environment || ''}
                  onChange={(value) => handleInputChange('environment', value)}
                  label="Environment Description"
                  placeholder="Describe the environment"
                  required
                />
              )}

              {(!fieldsHidden.lighting || expandedFields) && (
                <AssetSelector
                  type="lighting"
                  value={data.lighting || ''}
                  onChange={(value) => handleInputChange('lighting', value)}
                  label="Lighting"
                  placeholder="E.g., natural daylight, dramatic shadows"
                  required
                />
              )}

              <AssetSelector
                type="camera"
                value={data.camera || ''}
                onChange={(value) => handleInputChange('camera', value)}
                label="Camera Angle"
                placeholder="E.g., medium shot, low angle"
                required={isFirst}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Reference Image (optional)</label>
                <button
                  type="button"
                  onClick={() => setShowModerationWarning(!showModerationWarning)}
                  className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg text-xs font-medium text-amber-300 transition-all"
                  title="Content Moderation Warning"
                >
                  <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                  Warning
                </button>
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full px-4 py-2.5 bg-white/5 border-2 border-dashed border-white/10 hover:border-sky-500/50 rounded-xl file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:btn-primary file:text-sm file:font-medium text-gray-400 transition-all cursor-pointer"
              />
              {imagePreview && (
                <div className="mt-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-w-[200px] rounded-xl shadow-lg hover:scale-105 transition-transform border border-white/10"
                  />
                </div>
              )}

              {/* Content Moderation Warning - Collapsible */}
              {showModerationWarning && (
                <div className="mt-3 bg-amber-500/10 border-l-4 border-amber-500 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-amber-400" />
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-amber-300 mb-2">Content Moderation Warning</h4>
                      <p className="text-xs text-amber-200/80 mb-2">
                        Reference images frequently trigger OpenAI's content moderation system.
                      </p>
                      <p className="text-xs text-red-300 font-semibold mb-2">
                        <strong>DO NOT USE:</strong> Images with faces, people, or any human subjects - these will always trigger moderation.
                      </p>
                      <p className="text-xs text-emerald-300">
                        <strong>SAFE:</strong> Landscapes, objects, abstract patterns, buildings, nature (NO people or faces).
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!isFirst && (
          <>
            {expandedFields && (
              <>
                {/* Grid layout for square card fields */}
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <AssetSelector
                      type="character"
                      value={data.character || ''}
                      onChange={(value) => handleInputChange('character', value)}
                      label="Character Description (optional)"
                      placeholder="Leave empty to use Shot 1 description"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 italic">
                      If left empty, uses the same character from Shot 1. Only fill this if you want to change the character.
                    </p>
                  </div>

                  <div>
                    <AssetSelector
                      type="environment"
                      value={data.environment || ''}
                      onChange={(value) => handleInputChange('environment', value)}
                      label="Environment Description (optional)"
                      placeholder="Leave empty to use Shot 1 description"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 italic">
                      If left empty, uses the same environment from Shot 1. Only fill this if you want to change the environment.
                    </p>
                  </div>

                  <div>
                    <AssetSelector
                      type="lighting"
                      value={data.lighting || ''}
                      onChange={(value) => handleInputChange('lighting', value)}
                      label="Lighting (optional)"
                      placeholder="Leave empty to use Shot 1 lighting"
                    />
                    <p className="text-xs text-gray-400 mt-1.5 italic">
                      If left empty, uses the same lighting from Shot 1. Only fill this if you want to change the lighting.
                    </p>
                  </div>

                  <div>
                    <AssetSelector
                      type="camera"
                      value={data.camera || ''}
                      onChange={(value) => handleInputChange('camera', value)}
                      label="Camera Angle"
                      placeholder="E.g., medium shot, low angle"
                      required={isFirst}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Camera angle outside expanded fields for non-first shots */}
            {!expandedFields && (
              <AssetSelector
                type="camera"
                value={data.camera || ''}
                onChange={(value) => handleInputChange('camera', value)}
                label="Camera Angle"
                placeholder="E.g., medium shot, low angle"
                required={isFirst}
              />
            )}
          </>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-lg">
          <label className="block text-sm font-medium mb-2 text-gray-700">
            Dialog <span className="text-red-500">*</span>
          </label>
          <textarea
            value={data.dialog}
            onChange={(e) => handleInputChange('dialog', e.target.value)}
            className="w-full px-4 py-2.5 bg-white rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none min-h-[100px] text-gray-900 transition-all hover:bg-gray-50 placeholder-gray-400 resize-none"
            placeholder="What the character says"
            required
          />
        </div>
      </div>
    </div>
  );
}
