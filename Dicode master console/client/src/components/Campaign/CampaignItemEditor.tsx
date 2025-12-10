'use client';

import { useState } from 'react';
import { CampaignItem, Video, QuestionFormData, Question, QuestionRole, QuestionType } from '@/lib/types';
import QuestionBuilder from '../Questions/QuestionBuilder';
import Modal from '../Layout/Modal';
import { validateQuestionSet } from '@/lib/questionValidation';
import { useCompetencies } from '@/hooks/useCompetencies';
import { useNotification } from '@/contexts/NotificationContext';
import { normalizeQuestionSet } from '@/lib/questionDefaults';

interface CampaignItemEditorProps {
  item: CampaignItem;
  video: Video | null;
  onUpdate: (questions: Question[]) => void;
  onRemove: () => void;
  itemNumber: number;
  onSelectVideo: () => void;
}

const deriveRoleFromType = (type: QuestionType): QuestionRole => {
  switch (type) {
    case 'behavioral-perception':
      return 'perception';
    case 'behavioral-intent':
      return 'intent';
    case 'qualitative':
    default:
      return 'qualitative';
  }
};

export default function CampaignItemEditor({
  item,
  video,
  onUpdate,
  onRemove,
  itemNumber,
  onSelectVideo,
}: CampaignItemEditorProps) {
  const { competencies } = useCompetencies();
  const { warning: showWarning } = useNotification();
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState<QuestionFormData[]>([]);

  const handleOpenEditor = () => {
    // Convert existing questions to form data (or use empty array if questions undefined)
    const formData = (item.questions || []).map(q => ({
      role: q.role ?? deriveRoleFromType(q.type),
      type: q.type,
      statement: q.statement,
      scaleType: q.scaleType,
      scaleLabels: q.scaleLabels,
      competency: q.competency,
      competencyId: q.competencyId,
      skillId: q.skillId,
      isRequired: q.isRequired,
    }));
    setDraftQuestions(normalizeQuestionSet(formData as QuestionFormData[]));
    setShowQuestionEditor(true);
  };

  const handleSaveQuestions = () => {
    const errors = validateQuestionSet(draftQuestions);
    if (errors.length > 0) {
      showWarning('Validation Errors', 'Please fix validation errors before saving:\n' + errors.join('\n'));
      return;
    }

    // Convert to Question objects with IDs
    const questions: Question[] = draftQuestions.map((q, index) => ({
      id: `q${itemNumber}-${index}`,
      ...q,
    }));

    onUpdate(questions);
    setShowQuestionEditor(false);
  };

  return (
    <>
      <div className="card rounded-2xl p-6">
        <div className="flex items-start gap-4">
          {/* Drag Handle */}
          <div className="w-8 h-8 rounded-lg bg-sky-500 flex items-center justify-center text-white font-bold text-sm cursor-grab active:cursor-grabbing">
            {itemNumber}
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Video Info */}
            {video ? (
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-lg font-semibold text-gray-200">{video.title}</h4>
                  <div className="px-2 py-1 bg-sky-500/20 border border-sky-500/30 rounded-lg">
                    <span className="text-xs font-medium text-sky-300">
                      {video.source === 'generated' ? 'Generated' : 'Uploaded'}
                    </span>
                  </div>
                </div>
                {video.description && (
                  <p className="text-sm text-gray-400">{video.description}</p>
                )}
                <button
                  onClick={onSelectVideo}
                  className="mt-2 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  Change Video
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <button
                  onClick={onSelectVideo}
                  className="px-4 py-2 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 hover:border-sky-500/40 rounded-xl text-sm font-medium transition-all text-sky-300"
                >
                  Select Video
                </button>
              </div>
            )}

            {/* Questions */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-sm font-semibold text-gray-300">
                  Questions ({(item.questions || []).length}/3)
                </h5>
                <button
                  onClick={handleOpenEditor}
                  className="text-xs px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/30 hover:border-sky-500/40 rounded-lg transition-all text-sky-300"
                >
                  Edit Questions
                </button>
              </div>

              {(item.questions || []).length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">
                  No questions yet. Click "Edit Questions" to add.
                </p>
              ) : (
                <div className="space-y-2">
                  {(item.questions || []).map((q, index) => (
                    <div key={q.id} className="text-xs bg-white/5 rounded-lg p-3">
                      <p className="text-gray-400 mb-1">
                        Q{index + 1}: {q.type === 'behavioral-perception' ? 'Perception' : q.type === 'behavioral-intent' ? 'Intent' : 'Qualitative'}
                      </p>
                      <p className="text-gray-300">{q.statement}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <button
            onClick={onRemove}
            className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-xl border border-red-500/30 hover:border-red-500/40 text-xs font-medium transition-all text-red-300"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Question Editor Modal */}
      <Modal
        isOpen={showQuestionEditor}
        onClose={() => setShowQuestionEditor(false)}
        title={`Edit Questions - Video ${itemNumber}`}
        size="xl"
      >
        <div className="space-y-6">
          <QuestionBuilder
            questions={draftQuestions}
            onChange={setDraftQuestions}
            competencyOptions={competencies}
          />

          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              onClick={() => setShowQuestionEditor(false)}
              className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-gray-300 font-medium transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveQuestions}
              className="flex-1 px-4 py-2.5 btn-primary rounded-xl font-medium transition-all"
            >
              Save Questions
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
