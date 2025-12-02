'use client';

import { useState, useEffect } from 'react';
import MainLayout from '@/components/Layout/MainLayout';
import { COMPETENCIES, CompetencyDefinition, SkillDefinition } from '@/lib/competencies';
import {
  getCompetencies,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  initializeCompetencies,
  subscribeToCompetencies,
} from '@/lib/firestore';
import {
  Settings,
  Layers,
  Sparkles,
  CheckCircle,
  Plus,
  Pencil,
  Trash2,
  X,
  ChevronRight,
  ChevronDown,
  Save,
  AlertTriangle,
  Info,
  Wand2,
  FileCheck,
  GripVertical,
} from 'lucide-react';

type SettingsSection = 'competencies' | 'question-generator' | 'question-evaluator';

interface EditingCompetency {
  id: string;
  name: string;
  description: string;
  skills: SkillDefinition[];
  isNew?: boolean;
}

export default function MainSettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('competencies');
  const [competencies, setCompetencies] = useState<CompetencyDefinition[]>([]);
  const [competenciesLoading, setCompetenciesLoading] = useState(true);
  const [savingCompetency, setSavingCompetency] = useState(false);
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);
  
  // Slide-over state
  const [showCompetencyPanel, setShowCompetencyPanel] = useState(false);
  const [editingCompetency, setEditingCompetency] = useState<EditingCompetency | null>(null);
  const [showSkillPanel, setShowSkillPanel] = useState(false);
  const [editingSkill, setEditingSkill] = useState<{ competencyId: string; skill: SkillDefinition; isNew?: boolean } | null>(null);
  
  // System prompts state
  const [generatorPrompt, setGeneratorPrompt] = useState('');
  const [evaluatorPrompt, setEvaluatorPrompt] = useState('');
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [savingPrompts, setSavingPrompts] = useState(false);
  const [showPromptConfirmModal, setShowPromptConfirmModal] = useState<'generator' | 'evaluator' | null>(null);

  // Load competencies from Firestore with real-time updates
  useEffect(() => {
    const initAndSubscribe = async () => {
      setCompetenciesLoading(true);
      
      // Initialize with defaults if empty
      await initializeCompetencies(COMPETENCIES);
      
      // Subscribe to real-time updates
      const unsubscribe = subscribeToCompetencies((data) => {
        setCompetencies(data);
        setCompetenciesLoading(false);
      });

      return unsubscribe;
    };

    const unsubscribePromise = initAndSubscribe();

    return () => {
      unsubscribePromise.then(unsubscribe => unsubscribe?.());
    };
  }, []);

  // Load system prompts (mock - in real app would fetch from Firestore)
  useEffect(() => {
    // Simulated loading of prompts
    setTimeout(() => {
      setGeneratorPrompt(`You write DI Code Framework assessment questions for short workplace videos.

Each scenario is tagged with a competency and a skill. We always ask exactly three questions:
• Q1: Behavioral PERCEPTION (Likert 1–7 about what the leader did in the video)
• Q2: Behavioral INTENT (Likert 1–7 about what the respondent would do in a similar situation)
• Q3: Qualitative reflection (open text about one concrete action)

GLOBAL RULES (apply to every role):
• Focus on observable leader behavior (things you could literally see/hear).
• Use concrete verbs: ask, invite, acknowledge, check for bias, follow up, etc.
• One behavior per question. No double-barreled wording ("do X and Y").
• Do NOT use moral/evaluative labels ("good leader", "effective", "ideal", "right thing").
• Avoid vague environment words ("warm/positive atmosphere", "inclusive climate", "engaging environment", "build trust", "create psychological safety") unless tied to a single concrete action.
• Questions should be ~12–30 words and in plain English.
• Higher numbers on Likert scales must always mean "more of the desired behavior".`);

      setEvaluatorPrompt(`You validate DI Code assessment questions. Check whether the provided text fits its role (perception, intent, qualitative) and follows DI Code guidance:
• Perception: statement about what the leader did; Likert-friendly; no question mark.
• Intent: statement about what the respondent would do; Likert-friendly; includes the "Different people would respond…" preface before the statement if missing suggest adding; no question mark.
• Qualitative: open-ended question inviting reflection (should end with a question mark).

Also check for: scenario anchoring, concrete behavior, avoiding double-barreled or moralizing language. Flag issues if the question:
• Uses vague environment/feeling words ("warm/engaging atmosphere", "positive climate", "build trust") instead of a single observable action.
• Uses moral/evaluative labels ("good leader", "effective", "ideal response").
• Combines multiple behaviors/outcomes in one sentence ("participation and connection and trust").
• For perception/intent, fails to describe a specific action taken by the leader/respondent.`);
      
      setPromptsLoading(false);
    }, 500);
  }, []);

  const sections = [
    { id: 'competencies' as const, label: 'Competencies & Skills', icon: Layers },
    { id: 'question-generator' as const, label: 'Question Generator', icon: Wand2 },
    { id: 'question-evaluator' as const, label: 'Question Evaluator', icon: FileCheck },
  ];

  const handleAddCompetency = () => {
    setEditingCompetency({
      id: `comp-${Date.now()}`,
      name: '',
      description: '',
      skills: [],
      isNew: true,
    });
    setShowCompetencyPanel(true);
  };

  const handleEditCompetency = (competency: CompetencyDefinition) => {
    setEditingCompetency({
      ...competency,
      skills: [...competency.skills],
    });
    setShowCompetencyPanel(true);
  };

  const handleSaveCompetency = async () => {
    if (!editingCompetency) return;
    
    setSavingCompetency(true);
    try {
      if (editingCompetency.isNew) {
        await createCompetency({
          name: editingCompetency.name,
          description: editingCompetency.description,
          skills: editingCompetency.skills,
        });
      } else {
        await updateCompetency(editingCompetency.id, {
          name: editingCompetency.name,
          description: editingCompetency.description,
          skills: editingCompetency.skills,
        });
      }
      setShowCompetencyPanel(false);
      setEditingCompetency(null);
    } catch (error) {
      console.error('Failed to save competency:', error);
      alert('Failed to save competency. Please try again.');
    } finally {
      setSavingCompetency(false);
    }
  };

  const handleDeleteCompetency = async (id: string) => {
    if (confirm('Are you sure you want to delete this competency? This action cannot be undone.')) {
      try {
        await deleteCompetency(id);
      } catch (error) {
        console.error('Failed to delete competency:', error);
        alert('Failed to delete competency. Please try again.');
      }
    }
  };

  const handleAddSkill = (competencyId: string) => {
    setEditingSkill({
      competencyId,
      skill: {
        id: `skill-${Date.now()}`,
        name: '',
        description: '',
      },
      isNew: true,
    });
    setShowSkillPanel(true);
  };

  const handleEditSkill = (competencyId: string, skill: SkillDefinition) => {
    setEditingSkill({
      competencyId,
      skill: { ...skill },
    });
    setShowSkillPanel(true);
  };

  const handleSaveSkill = async () => {
    if (!editingSkill) return;
    
    if (editingCompetency) {
      // Editing within the competency panel - just update local state
      // Changes will be saved when the competency is saved
      if (editingSkill.isNew) {
        setEditingCompetency({
          ...editingCompetency,
          skills: [...editingCompetency.skills, editingSkill.skill],
        });
      } else {
        setEditingCompetency({
          ...editingCompetency,
          skills: editingCompetency.skills.map(s =>
            s.id === editingSkill.skill.id ? editingSkill.skill : s
          ),
        });
      }
    } else {
      // Editing directly from the list - save to Firestore immediately
      const competency = competencies.find(c => c.id === editingSkill.competencyId);
      if (competency) {
        let updatedSkills: SkillDefinition[];
        if (editingSkill.isNew) {
          updatedSkills = [...competency.skills, editingSkill.skill];
        } else {
          updatedSkills = competency.skills.map(s =>
            s.id === editingSkill.skill.id ? editingSkill.skill : s
          );
        }
        
        try {
          await updateCompetency(editingSkill.competencyId, { skills: updatedSkills });
        } catch (error) {
          console.error('Failed to save skill:', error);
          alert('Failed to save skill. Please try again.');
          return;
        }
      }
    }
    setShowSkillPanel(false);
    setEditingSkill(null);
  };

  const handleDeleteSkill = async (competencyId: string, skillId: string) => {
    if (editingCompetency) {
      // Editing within the competency panel - just update local state
      setEditingCompetency({
        ...editingCompetency,
        skills: editingCompetency.skills.filter(s => s.id !== skillId),
      });
    } else {
      // Deleting directly from the list - save to Firestore immediately
      const competency = competencies.find(c => c.id === competencyId);
      if (competency) {
        const updatedSkills = competency.skills.filter(s => s.id !== skillId);
        try {
          await updateCompetency(competencyId, { skills: updatedSkills });
        } catch (error) {
          console.error('Failed to delete skill:', error);
          alert('Failed to delete skill. Please try again.');
        }
      }
    }
  };

  const handleSavePrompts = async () => {
    setSavingPrompts(true);
    // Simulate saving to backend
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSavingPrompts(false);
    setShowPromptConfirmModal(null);
    // Show success toast or notification
  };

  return (
    <MainLayout>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50/50 p-6">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
                <Settings className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-slate-900">Main Settings</h1>
            </div>
            <p className="text-sm text-slate-500">
              Configure competencies, skills, and AI system prompts
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Sidebar Navigation */}
            <nav className="w-full shrink-0 lg:w-64">
              <div className="rounded-xl border border-slate-200 bg-white p-1.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                        isActive
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {section.label}
                    </button>
                  );
                })}
              </div>

              {/* Info Box */}
              <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-4">
                <div className="flex gap-3">
                  <Info className="h-5 w-5 shrink-0 text-sky-600" />
                  <div>
                    <p className="text-sm font-medium text-sky-900">About Settings</p>
                    <p className="mt-1 text-xs text-sky-700">
                      Changes to competencies and prompts will affect all future campaigns and video assessments.
                    </p>
                  </div>
                </div>
              </div>
            </nav>

            {/* Content Area */}
            <div className="flex-1">
              {/* Competencies Section */}
              {activeSection === 'competencies' && (
                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">Competencies & Skills</h2>
                      <p className="text-sm text-slate-500">
                        Manage the behavioral competencies and skills used in campaigns
                      </p>
                    </div>
                    <button
                      onClick={handleAddCompetency}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4" />
                      Add Competency
                    </button>
                  </div>

                  {/* Competencies List */}
                  <div className="space-y-3">
                    {competenciesLoading ? (
                      // Loading skeleton
                      Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-slate-200" />
                            <div className="flex-1">
                              <div className="h-4 w-48 rounded bg-slate-200 mb-2" />
                              <div className="h-3 w-64 rounded bg-slate-200" />
                            </div>
                            <div className="h-6 w-16 rounded-full bg-slate-200" />
                          </div>
                        </div>
                      ))
                    ) : competencies.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                        <Layers className="mx-auto h-10 w-10 text-slate-400" />
                        <h3 className="mt-3 text-sm font-semibold text-slate-900">No competencies</h3>
                        <p className="mt-1 text-xs text-slate-500">Get started by adding your first competency</p>
                        <button
                          onClick={handleAddCompetency}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                        >
                          <Plus className="h-4 w-4" />
                          Add Competency
                        </button>
                      </div>
                    ) : competencies.map((competency) => {
                      const isExpanded = expandedCompetency === competency.id;
                      return (
                        <div
                          key={competency.id}
                          className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                        >
                          {/* Competency Header */}
                          <div className="flex items-center gap-3 p-4">
                            <button
                              onClick={() => setExpandedCompetency(isExpanded ? null : competency.id)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-slate-900">
                                {competency.name}
                              </h3>
                              <p className="text-xs text-slate-500 truncate">
                                {competency.description}
                              </p>
                            </div>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                              {competency.skills.length} skills
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditCompetency(competency)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCompetency(competency.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Skills List */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 bg-slate-50 p-4">
                              <div className="space-y-2">
                                {competency.skills.map((skill) => (
                                  <div
                                    key={skill.id}
                                    className="flex items-center gap-3 rounded-lg bg-white border border-slate-200 p-3"
                                  >
                                    <GripVertical className="h-4 w-4 text-slate-300" />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-slate-900">
                                        {skill.name}
                                      </p>
                                      <p className="text-xs text-slate-500 truncate">
                                        {skill.description}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => handleEditSkill(competency.id, skill)}
                                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSkill(competency.id, skill.id)}
                                        className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                                <button
                                  onClick={() => handleAddSkill(competency.id)}
                                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 transition hover:border-slate-400 hover:text-slate-700"
                                >
                                  <Plus className="h-4 w-4" />
                                  Add Skill
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Question Generator Section */}
              {activeSection === 'question-generator' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Question Generator System Prompt</h2>
                    <p className="text-sm text-slate-500">
                      Configure the AI instructions for generating assessment questions
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                        <Wand2 className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">System Prompt</h3>
                        <p className="text-xs text-slate-500">
                          This prompt instructs the AI how to generate questions for videos
                        </p>
                      </div>
                    </div>

                    {promptsLoading ? (
                      <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
                    ) : (
                      <textarea
                        value={generatorPrompt}
                        onChange={(e) => setGeneratorPrompt(e.target.value)}
                        className="h-96 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                        placeholder="Enter the system prompt for question generation..."
                      />
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Changes will affect all future question generation
                      </div>
                      <button
                        onClick={() => setShowPromptConfirmModal('generator')}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Tips */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <h4 className="text-sm font-semibold text-amber-900">Tips for effective prompts</h4>
                    <ul className="mt-2 space-y-1 text-xs text-amber-800">
                      <li>• Be specific about question structure and format</li>
                      <li>• Include examples of good and bad questions</li>
                      <li>• Define the Likert scale expectations clearly</li>
                      <li>• Specify behaviors to avoid (moralizing, double-barreled)</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Question Evaluator Section */}
              {activeSection === 'question-evaluator' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Question Evaluator System Prompt</h2>
                    <p className="text-sm text-slate-500">
                      Configure the AI instructions for validating and rating questions
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="mb-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                        <FileCheck className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">Validation Criteria</h3>
                        <p className="text-xs text-slate-500">
                          This prompt defines how questions are evaluated for quality
                        </p>
                      </div>
                    </div>

                    {promptsLoading ? (
                      <div className="h-64 animate-pulse rounded-lg bg-slate-100" />
                    ) : (
                      <textarea
                        value={evaluatorPrompt}
                        onChange={(e) => setEvaluatorPrompt(e.target.value)}
                        className="h-96 w-full rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm text-slate-700 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                        placeholder="Enter the system prompt for question validation..."
                      />
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Changes will affect all future question validation
                      </div>
                      <button
                        onClick={() => setShowPromptConfirmModal('evaluator')}
                        className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                      >
                        <Save className="h-4 w-4" />
                        Save Changes
                      </button>
                    </div>
                  </div>

                  {/* Rating Criteria Info */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <h4 className="text-sm font-semibold text-slate-900 mb-3">Current Rating Criteria</h4>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg bg-emerald-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-4 w-4 text-emerald-600" />
                          <span className="text-xs font-semibold text-emerald-900">OK</span>
                        </div>
                        <p className="text-xs text-emerald-700">
                          Question meets all criteria and is ready for use
                        </p>
                      </div>
                      <div className="rounded-lg bg-amber-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                          <span className="text-xs font-semibold text-amber-900">Warning</span>
                        </div>
                        <p className="text-xs text-amber-700">
                          Minor issues that should be reviewed
                        </p>
                      </div>
                      <div className="rounded-lg bg-rose-50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <X className="h-4 w-4 text-rose-600" />
                          <span className="text-xs font-semibold text-rose-900">Error</span>
                        </div>
                        <p className="text-xs text-rose-700">
                          Critical issues that must be fixed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Competency Slide-over Panel */}
      {showCompetencyPanel && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => {
              setShowCompetencyPanel(false);
              setEditingCompetency(null);
            }}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-white shadow-2xl animate-in slide-in-from-right-full duration-300 ease-out">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingCompetency?.isNew ? 'Add Competency' : 'Edit Competency'}
                </h2>
                <button
                  onClick={() => {
                    setShowCompetencyPanel(false);
                    setEditingCompetency(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Competency Name
                    </label>
                    <input
                      type="text"
                      value={editingCompetency?.name || ''}
                      onChange={(e) =>
                        setEditingCompetency(prev => prev ? { ...prev, name: e.target.value } : null)
                      }
                      placeholder="e.g., Foster Psychological Safety"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Description
                    </label>
                    <textarea
                      value={editingCompetency?.description || ''}
                      onChange={(e) =>
                        setEditingCompetency(prev => prev ? { ...prev, description: e.target.value } : null)
                      }
                      placeholder="Describe what this competency means..."
                      rows={3}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  {/* Skills */}
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        Skills ({editingCompetency?.skills.length || 0})
                      </label>
                      <button
                        onClick={() => {
                          if (editingCompetency) {
                            setEditingSkill({
                              competencyId: editingCompetency.id,
                              skill: {
                                id: `skill-${Date.now()}`,
                                name: '',
                                description: '',
                              },
                              isNew: true,
                            });
                            setShowSkillPanel(true);
                          }
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add Skill
                      </button>
                    </div>
                    <div className="space-y-2">
                      {editingCompetency?.skills.map((skill) => (
                        <div
                          key={skill.id}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900">{skill.name}</p>
                            <p className="text-xs text-slate-500 truncate">{skill.description}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingSkill({
                                  competencyId: editingCompetency.id,
                                  skill: { ...skill },
                                });
                                setShowSkillPanel(true);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSkill(editingCompetency.id, skill.id)}
                              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition hover:bg-rose-100 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!editingCompetency?.skills || editingCompetency.skills.length === 0) && (
                        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center">
                          <p className="text-sm text-slate-500">No skills added yet</p>
                          <p className="text-xs text-slate-400">Click "Add Skill" to get started</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowCompetencyPanel(false);
                      setEditingCompetency(null);
                    }}
                    disabled={savingCompetency}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCompetency}
                    disabled={!editingCompetency?.name || savingCompetency}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {savingCompetency ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Saving...
                      </>
                    ) : (
                      editingCompetency?.isNew ? 'Add Competency' : 'Save Changes'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Skill Slide-over Panel */}
      {showSkillPanel && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => {
              setShowSkillPanel(false);
              setEditingSkill(null);
            }}
          />
          <div className="fixed inset-y-0 right-0 z-[60] w-full max-w-md bg-white shadow-2xl animate-in slide-in-from-right-full duration-300 ease-out">
            <div className="flex h-full flex-col">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {editingSkill?.isNew ? 'Add Skill' : 'Edit Skill'}
                </h2>
                <button
                  onClick={() => {
                    setShowSkillPanel(false);
                    setEditingSkill(null);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Skill Name
                    </label>
                    <input
                      type="text"
                      value={editingSkill?.skill.name || ''}
                      onChange={(e) =>
                        setEditingSkill(prev =>
                          prev ? { ...prev, skill: { ...prev.skill, name: e.target.value } } : null
                        )
                      }
                      placeholder="e.g., Mitigate Bias"
                      className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Description
                    </label>
                    <textarea
                      value={editingSkill?.skill.description || ''}
                      onChange={(e) =>
                        setEditingSkill(prev =>
                          prev ? { ...prev, skill: { ...prev.skill, description: e.target.value } } : null
                        )
                      }
                      placeholder="Describe what this skill means..."
                      rows={4}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-200 px-6 py-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowSkillPanel(false);
                      setEditingSkill(null);
                    }}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSkill}
                    disabled={!editingSkill?.skill.name}
                    className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                  >
                    {editingSkill?.isNew ? 'Add Skill' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Prompt Save Confirmation Modal */}
      {showPromptConfirmModal && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowPromptConfirmModal(null)}
          />
          <div className="fixed left-1/2 top-1/2 z-[80] w-full max-w-md -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              {/* Icon */}
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-7 w-7 text-amber-600" />
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  Confirm Prompt Changes
                </h3>
                <p className="mt-2 text-sm text-slate-500">
                  You are about to update the{' '}
                  <span className="font-medium text-slate-700">
                    {showPromptConfirmModal === 'generator' ? 'Question Generator' : 'Question Evaluator'}
                  </span>{' '}
                  system prompt. This change will affect all future{' '}
                  {showPromptConfirmModal === 'generator' ? 'question generation' : 'question validation'}.
                </p>
              </div>

              {/* Warning Box */}
              <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-800">
                  <strong>Warning:</strong> Changes to system prompts can significantly impact the quality and consistency of AI-generated content. Make sure you have tested your changes before saving.
                </p>
              </div>

              {/* Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowPromptConfirmModal(null)}
                  disabled={savingPrompts}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSavePrompts}
                  disabled={savingPrompts}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {savingPrompts ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Confirm & Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </MainLayout>
  );
}

