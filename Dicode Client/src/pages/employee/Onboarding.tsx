import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/types';
import { Check, ArrowRight, LogOut, User, Shield, ClipboardCheck } from 'lucide-react';
import { getOrganization } from '@/lib/firestore';

interface Question {
  id: string;
  question: string;
  type: 'scale';
  minLabel: string;
  maxLabel: string;
}

const questions: Question[] = [
  {
    id: 'remote_work_comfort',
    question: 'I feel comfortable working remotely and have the tools I need to succeed.',
    type: 'scale',
    minLabel: 'Strongly disagree',
    maxLabel: 'Strongly agree',
  },
  {
    id: 'training_adequacy',
    question: 'I have received adequate training to perform my job effectively.',
    type: 'scale',
    minLabel: 'Strongly disagree',
    maxLabel: 'Strongly agree',
  },
  {
    id: 'tools_access',
    question: 'I have access to all the tools and resources I need to do my job.',
    type: 'scale',
    minLabel: 'Strongly disagree',
    maxLabel: 'Strongly agree',
  },
  {
    id: 'hybrid_model_satisfaction',
    question: 'I am satisfied with the current hybrid work model.',
    type: 'scale',
    minLabel: 'Strongly disagree',
    maxLabel: 'Strongly agree',
  },
  {
    id: 'team_support',
    question: 'I feel supported by my team and management.',
    type: 'scale',
    minLabel: 'Strongly disagree',
    maxLabel: 'Strongly agree',
  },
];

const STEPS = [
  { id: 1, title: 'Your Profile', shortTitle: 'Profile', description: 'Tell us about yourself so we can personalize your experience and connect you with the right resources.', icon: User },
  { id: 2, title: 'Privacy & Security', shortTitle: 'Privacy', description: 'Learn how your data is protected and understand our commitment to keeping your information confidential.', icon: Shield },
  { id: 3, title: 'Quick Assessment', shortTitle: 'Assessment', description: 'Complete a brief assessment to help us understand your current work experience and needs.', icon: ClipboardCheck },
];

export default function EmployeeOnboarding() {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [organizationName, setOrganizationName] = useState<string>('');

  // Step 1: Profile data
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    gender: '' as UserType['gender'] | '',
    dateOfBirth: '',
  });

  // Step 3: Assessment responses
  const [responses, setResponses] = useState<Record<string, number>>({});

  // Fetch organization name
  useEffect(() => {
    const fetchOrganization = async () => {
      if (user?.organization) {
        try {
          const org = await getOrganization(user.organization);
          if (org) {
            setOrganizationName(org.name);
          }
        } catch (error) {
          console.error('Error fetching organization:', error);
        }
      }
    };
    fetchOrganization();
  }, [user?.organization]);

  const handleProfileChange = (field: string, value: string) => {
    setProfileData((prev) => ({ ...prev, [field]: value }));
  };

  const isProfileComplete = () => {
    return (
      profileData.name.trim() !== '' &&
      profileData.gender !== '' &&
      profileData.dateOfBirth !== ''
    );
  };

  const handleResponse = (questionId: string, value: number) => {
    setResponses((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleNext = () => {
    if (currentStep === 3 && currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) return;

    setIsSubmitting(true);
    try {
      // Save assessment responses
      await setDoc(doc(db, 'assessmentResponses', user.id), {
        userId: user.id,
        responses,
        completedAt: new Date().toISOString(),
      });

      // Update user profile
      await updateDoc(doc(db, 'users', user.id), {
        name: profileData.name,
        gender: profileData.gender,
        dateOfBirth: profileData.dateOfBirth,
        onboardingCompletedAt: new Date().toISOString(),
      });

      setIsSubmitting(false);
      setIsSuccess(true);

      // Wait for success animation, then navigate
      setTimeout(async () => {
        await refreshUser();
        navigate('/', { replace: true });
      }, 2500);
    } catch (error) {
      console.error('Error completing onboarding:', error);
      setIsSubmitting(false);
    }
  };

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const renderStepContent = () => {
    if (currentStep === 1) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="mb-8 lg:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              Step 1 of 3
            </div>
            <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-dark-text">
              Complete your profile
            </h1>
            <p className="mt-2 lg:mt-3 text-base lg:text-lg text-dark-text-muted">
              Tell us a bit about yourself to personalize your experience.
            </p>
          </div>

          <div className="space-y-10 lg:space-y-14">
            <section>
              <h2 className="mb-6 lg:mb-8 text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                Personal Information
              </h2>

              <div className="space-y-6 lg:space-y-8">
                <div className="grid grid-cols-1 gap-6 lg:gap-8">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-text">
                      Full Name <span className="text-white/40">*</span>
                    </label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => handleProfileChange('name', e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text placeholder:text-dark-text-muted/40 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-text">
                      Date of Birth <span className="text-white/40">*</span>
                    </label>
                    <input
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => handleProfileChange('dateOfBirth', e.target.value)}
                      max={getTodayDate()}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-dark-text">
                      Gender <span className="text-white/40">*</span>
                    </label>
                    <select
                      value={profileData.gender}
                      onChange={(e) => handleProfileChange('gender', e.target.value)}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non-binary">Non-binary</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* Organization Information - Hide for applicants */}
            {(organizationName || user?.department) && user?.role !== 'applicant' && (
              <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                  Your Workplace
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {organizationName && (
                    <div>
                      <div className="text-xs text-dark-text-muted mb-1">Organization</div>
                      <div className="text-dark-text font-medium">{organizationName}</div>
                    </div>
                  )}
                  {user?.department && (
                    <div>
                      <div className="text-xs text-dark-text-muted mb-1">Department</div>
                      <div className="text-dark-text font-medium">{user.department}</div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <div className="mt-8 lg:mt-12 flex justify-end">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              disabled={!isProfileComplete()}
              className="group flex w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
          <div className="mb-8 lg:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/60">
              <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
              Step 2 of 3
            </div>
            <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-dark-text">
              Privacy & Confidentiality
            </h1>
            <p className="mt-2 lg:mt-3 text-base lg:text-lg text-dark-text-muted">
              Understanding how your data will be used.
            </p>
          </div>

          <div className="space-y-6 lg:space-y-8">
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-6 lg:p-8">
              <h2 className="mb-4 lg:mb-6 text-sm font-semibold uppercase tracking-widest text-white/60">
                How your data is used
              </h2>
              <ul className="space-y-3 lg:space-y-4">
                {[
                  'Your individual responses will remain confidential',
                  'Data will be analyzed in aggregate to identify trends and patterns',
                  'Results will inform organizational decisions and improvements',
                  'Your personal information is protected and secure',
                ].map((item, index) => (
                  <li key={index} className="flex items-start gap-3 lg:gap-4">
                    <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-white/30" />
                    <span className="text-sm lg:text-base text-dark-text">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6">
              <p className="text-sm text-dark-text-muted">
                If you have any questions or concerns about this assessment, please contact:{' '}
                <a
                  href="mailto:support@di-code.de"
                  className="font-semibold text-white hover:underline"
                >
                  support@di-code.de
                </a>
              </p>
            </section>
          </div>

          <div className="mt-8 lg:mt-12 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="w-full sm:w-auto rounded-lg px-5 py-3 text-sm font-medium text-dark-text-muted transition-colors hover:text-dark-text"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="group flex w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500/90"
            >
              Continue
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      );
    }

    // Step 3: Assessment
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="mb-8 lg:mb-12">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/60">
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
            Step 3 of 3
          </div>
          <h1 className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-dark-text">
            Initial Assessment
          </h1>
          <p className="mt-2 lg:mt-3 text-base lg:text-lg text-dark-text-muted">
            Help us understand your current workplace experience.
          </p>
        </div>

        {/* Question Progress */}
        <div className="mb-8 lg:mb-10 flex items-center justify-center gap-2 lg:gap-3">
          {questions.map((question, index) => {
            const isAnswered = responses[question.id] !== undefined;
            const isCurrent = index === currentQuestionIndex;

            return (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`h-8 w-8 lg:h-10 lg:w-10 rounded-full flex items-center justify-center font-semibold text-sm lg:text-base transition-all ${isAnswered
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                    : isCurrent
                      ? 'border-2 border-white/50 text-white bg-white/10'
                      : 'border-2 border-white/20 text-dark-text-muted bg-white/5'
                  }`}
              >
                {isAnswered ? <Check size={16} className="lg:w-[18px] lg:h-[18px]" /> : <span>{index + 1}</span>}
              </button>
            );
          })}
        </div>

        {/* Question Card */}
        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-6 lg:p-8">
          <div className="mb-2 text-xs font-medium text-dark-text-muted uppercase tracking-widest">
            Question {currentQuestionIndex + 1} of {questions.length}
          </div>
          <p className="text-lg sm:text-xl lg:text-2xl text-dark-text leading-relaxed mb-6 lg:mb-8">
            {questions[currentQuestionIndex].question}
          </p>

          <div className="space-y-3 lg:space-y-4">
            <div className="flex rounded-xl border border-white/10 overflow-hidden bg-white/5">
              {[1, 2, 3, 4, 5].map((value, index) => (
                <button
                  key={value}
                  onClick={() => handleResponse(questions[currentQuestionIndex].id, value)}
                  className={`flex-1 py-3 lg:py-4 text-lg lg:text-xl font-semibold transition-all ${responses[questions[currentQuestionIndex].id] === value
                      ? 'bg-white text-black'
                      : 'text-dark-text hover:bg-white/5'
                    } ${index !== 4 ? 'border-r border-white/10' : ''}`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] sm:text-xs text-dark-text-muted uppercase tracking-widest px-1 lg:px-2">
              <span>{questions[currentQuestionIndex].minLabel}</span>
              <span>{questions[currentQuestionIndex].maxLabel}</span>
            </div>
          </div>
        </section>

        <div className="mt-8 lg:mt-12 flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => {
              if (currentQuestionIndex > 0) {
                setCurrentQuestionIndex(currentQuestionIndex - 1);
              } else {
                setCurrentStep(2);
              }
            }}
            className="w-full sm:w-auto rounded-lg px-5 py-3 text-sm font-medium text-dark-text-muted transition-colors hover:text-dark-text"
          >
            Back
          </button>

          {currentQuestionIndex < questions.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!responses[questions[currentQuestionIndex].id]}
              className="group flex w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Question
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!responses[questions[currentQuestionIndex].id] || isSubmitting}
              className="group flex w-full sm:w-auto items-center justify-center gap-3 rounded-lg bg-blue-500 px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-blue-500/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Completing...
                </>
              ) : (
                <>
                  Complete Setup
                  <Check size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0b]">
      {/* Mobile Header - Only visible on mobile/tablet */}
      <header className="fixed left-0 right-0 top-0 z-50 lg:hidden bg-[#0a0a0b] border-b border-white/10">
        {/* Top bar with logo and sign out */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/dicode_logo.png" alt="DiCode" className="h-7 w-auto" />
            <span className="text-lg font-semibold text-white">DiCode</span>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, index) => {
              const isActive = currentStep === s.id;
              const isComplete = currentStep > s.id;

              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (isComplete || isActive) setCurrentStep(s.id);
                  }}
                  disabled={currentStep < s.id}
                  className="flex-1 flex flex-col items-center"
                >
                  {/* Step indicator bar */}
                  <div className="w-full flex items-center gap-1">
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-all ${isComplete
                          ? 'bg-emerald-500'
                          : isActive
                            ? 'bg-white'
                            : 'bg-white/10'
                        }`}
                    />
                    {index < STEPS.length - 1 && (
                      <div className="w-1" />
                    )}
                  </div>
                  {/* Step label */}
                  <div
                    className={`mt-2 text-xs font-medium transition-colors ${isActive ? 'text-white' : isComplete ? 'text-white/60' : 'text-white/30'
                      }`}
                  >
                    {s.shortTitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Desktop Sidebar - Dark gradient style */}
      <aside className="fixed left-0 top-0 hidden h-screen w-[420px] flex-col lg:flex overflow-hidden">
        {/* Near-black background with subtle gradient accents */}
        <div className="absolute inset-0 bg-[#030305]" />
        <div className="absolute -top-1/3 -left-1/4 w-[60%] h-[60%] bg-blue-500/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
        <div className="absolute inset-0 border-r border-white/[0.03]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-8 py-8">
          {/* Logo & Title */}
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <img src="/dicode_logo.png" alt="DiCode" className="h-10 w-auto" />
              <div>
                <div className="text-xl font-semibold text-white">DiCode</div>
                <div className="mt-0.5 text-sm text-white/40">Employee Setup</div>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <nav className="flex-1">
            <ul className="relative space-y-2">
              {STEPS.map((s, index) => {
                const isActive = currentStep === s.id;
                const isComplete = currentStep > s.id;
                const isPending = currentStep < s.id;
                const StepIcon = s.icon;
                const isLast = index === STEPS.length - 1;
                const nextIsActive = index < STEPS.length - 1 && currentStep === STEPS[index + 1].id;

                return (
                  <li key={s.id} className="relative">
                    {/* Connector line to next step - hidden if current or next step is active */}
                    {!isLast && !isActive && !nextIsActive && (
                      <div className="absolute left-8 top-[4rem] bottom-[-0.5rem] w-px border-l-2 border-dashed border-white/15" />
                    )}

                    <button
                      onClick={() => {
                        if (isComplete || isActive) setCurrentStep(s.id);
                      }}
                      disabled={isPending}
                      className={`group flex w-full items-start gap-4 rounded-xl p-3 text-left transition-all ${isPending ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white/5'
                        } ${isActive ? 'bg-white/10' : ''}`}
                    >
                      {/* Icon */}
                      <div className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0 transition-all ${isComplete
                          ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                          : isActive
                            ? 'bg-white text-black'
                            : 'bg-white/[0.08] border border-white/10 text-white/40'
                        }`}>
                        {isComplete ? (
                          <Check size={18} strokeWidth={2.5} />
                        ) : (
                          <StepIcon size={18} />
                        )}
                      </div>

                      {/* Label & Description */}
                      <div className="flex-1 pt-0.5">
                        <div
                          className={`font-semibold transition-all ${isActive
                              ? 'text-white'
                              : isComplete
                                ? 'text-white/80'
                                : 'text-white/40'
                            }`}
                        >
                          {s.title}
                        </div>
                        <p className={`mt-1 text-sm leading-relaxed ${isActive ? 'text-white/60' : 'text-white/30'
                          }`}>
                          {s.description}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Decorative geometric shapes */}
          <div className="relative h-32 mt-4">
            <svg className="absolute bottom-0 left-0 w-full h-full opacity-20" viewBox="0 0 400 120" fill="none">
              {/* Hexagon pattern */}
              <path d="M60 80 L80 68 L100 80 L100 104 L80 116 L60 104 Z" stroke="white" strokeWidth="1" fill="none" />
              <path d="M100 80 L120 68 L140 80 L140 104 L120 116 L100 104 Z" stroke="white" strokeWidth="1" fill="none" />
              <path d="M80 56 L100 44 L120 56 L120 80 L100 92 L80 80 Z" stroke="white" strokeWidth="1" fill="none" />
              <path d="M140 80 L160 68 L180 80 L180 104 L160 116 L140 104 Z" stroke="white" strokeWidth="1" fill="none" />
              <path d="M120 56 L140 44 L160 56 L160 80 L140 92 L120 80 Z" stroke="white" strokeWidth="1" fill="none" />
              {/* Diamond accents */}
              <path d="M200 90 L210 80 L220 90 L210 100 Z" stroke="white" strokeWidth="1" fill="none" />
              <path d="M230 70 L240 60 L250 70 L240 80 Z" stroke="white" strokeWidth="1" fill="none" />
            </svg>
          </div>

          {/* User Info & Sign Out */}
          <div className="border-t border-white/10 pt-5 space-y-3">
            <div>
              <div className="text-xs text-white/40 uppercase tracking-wider">Signed in as</div>
              <div className="mt-1 truncate text-sm font-medium text-white/80">{user?.email}</div>
            </div>
            <button
              onClick={() => logout()}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 pt-28 lg:pt-0 lg:ml-[420px]">

        {/* Success Screen */}
        {isSuccess && (
          <div className="relative flex min-h-screen items-center justify-center px-6 sm:px-8 lg:px-16 py-8 lg:py-16">
            <div className="text-center">
              {/* Animated checkmark circle */}
              <div className="relative mx-auto mb-6 lg:mb-8 h-24 w-24 lg:h-32 lg:w-32">
                {/* Outer ring animation */}
                <svg className="absolute inset-0 h-full w-full animate-[spin_3s_linear_infinite]" viewBox="0 0 128 128">
                  <circle
                    cx="64"
                    cy="64"
                    r="60"
                    fill="none"
                    stroke="url(#gradient)"
                    strokeWidth="2"
                    strokeDasharray="80 300"
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.1" />
                      <stop offset="50%" stopColor="#10b981" stopOpacity="1" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Success circle */}
                <div
                  className="absolute inset-4 flex items-center justify-center rounded-full bg-emerald-500 shadow-2xl shadow-emerald-500/30"
                  style={{
                    animation: 'scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                  }}
                >
                  {/* Checkmark */}
                  <svg
                    className="h-8 w-8 lg:h-12 lg:w-12 text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      strokeDasharray: 30,
                      strokeDashoffset: 30,
                      animation: 'drawCheck 0.5s ease-out 0.3s forwards',
                    }}
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>

              <h1
                className="text-2xl lg:text-3xl font-semibold text-dark-text"
                style={{
                  opacity: 0,
                  animation: 'fadeInUp 0.5s ease-out 0.5s forwards',
                }}
              >
                Setup complete!
              </h1>
              <p
                className="mt-2 lg:mt-3 text-base lg:text-lg text-dark-text-muted"
                style={{
                  opacity: 0,
                  animation: 'fadeInUp 0.5s ease-out 0.7s forwards',
                }}
              >
                Welcome to {organizationName || 'DiCode'}
              </p>
              <p
                className="mt-4 lg:mt-6 text-sm text-dark-text-muted/60"
                style={{
                  opacity: 0,
                  animation: 'fadeInUp 0.5s ease-out 0.9s forwards',
                }}
              >
                Redirecting to your dashboard...
              </p>

              {/* Custom keyframes */}
              <style>{`
                @keyframes scaleIn {
                  0% { transform: scale(0); opacity: 0; }
                  100% { transform: scale(1); opacity: 1; }
                }
                @keyframes drawCheck {
                  to { stroke-dashoffset: 0; }
                }
                @keyframes fadeInUp {
                  0% { opacity: 0; transform: translateY(10px); }
                  100% { opacity: 1; transform: translateY(0); }
                }
              `}</style>
            </div>
          </div>
        )}

        {!isSuccess && (
          <div className="relative min-h-screen px-4 sm:px-6 lg:px-16 py-6 lg:py-16">
            <div className="mx-auto max-w-2xl">{renderStepContent()}</div>
          </div>
        )}
      </main>
    </div>
  );
}
