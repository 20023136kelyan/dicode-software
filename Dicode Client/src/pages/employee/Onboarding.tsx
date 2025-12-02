import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import type { User as UserType } from '@/types';
import { ChevronLeft, Check } from 'lucide-react';
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
  {
    id: 1,
    title: 'Profile',
    description: 'Complete your profile',
  },
  {
    id: 2,
    title: 'Privacy',
    description: 'Privacy & confidentiality',
  },
  {
    id: 3,
    title: 'Assessment',
    description: 'Initial assessment',
  },
];

export default function EmployeeOnboarding() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleBack = () => {
    if (currentStep === 3 && currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    } else if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      if (currentStep === 3) {
        setCurrentQuestionIndex(0);
      }
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

      // Refresh user data to load the updated profile
      await refreshUser();

      // Navigate to root - routing logic will redirect to correct page based on updated user state
      navigate('/', { replace: true });
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
        <div className="space-y-6">
          <div className="rounded-2xl border border-dark-border/70 bg-dark-bg/60 overflow-hidden divide-y divide-dark-border/70">
            <div className="px-4 py-4">
              <label className="text-xs font-semibold text-dark-text-muted uppercase tracking-wider">
                Full Name *
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => handleProfileChange('name', e.target.value)}
                placeholder="Enter your full name"
                className="mt-2 w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                autoFocus
              />
            </div>

            <div className="px-4 py-4">
              <label className="text-xs font-semibold text-dark-text-muted uppercase tracking-wider">
                Date of Birth *
              </label>
              <input
                type="date"
                value={profileData.dateOfBirth}
                onChange={(e) => handleProfileChange('dateOfBirth', e.target.value)}
                max={getTodayDate()}
                className="mt-2 w-full bg-transparent text-dark-text focus:outline-none"
              />
            </div>

            <div className="px-4 py-4">
              <label className="text-xs font-semibold text-dark-text-muted uppercase tracking-wider">
                Gender *
              </label>
              <select
                value={profileData.gender}
                onChange={(e) => handleProfileChange('gender', e.target.value)}
                className="mt-2 w-full bg-transparent text-dark-text focus:outline-none"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </div>
          </div>

          {/* Organization Information Card */}
          {(user?.role || organizationName || user?.department) && (
            <div className="rounded-2xl bg-dark-bg/60 p-6">
              <p className="text-sm text-dark-text-muted">
                You are joining as{' '}
                {user?.role && (
                  <span className="text-dark-text font-semibold">{user.role}</span>
                )}
                {organizationName && (
                  <>
                    {' '}at{' '}
                    <span className="text-dark-text font-semibold">{organizationName}</span>
                  </>
                )}
                {user?.department && (
                  <>
                    {' '}in the{' '}
                    <span className="text-dark-text font-semibold">{user.department}</span>
                    {' '}department
                  </>
                )}
                .
              </p>
            </div>
          )}
        </div>
      );
    }

    if (currentStep === 2) {
      return (
        <div>
          <div className="space-y-6">
            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-primary">
                How your data is used
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-dark-text">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>Your individual responses will remain confidential</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>Data will be analyzed in aggregate to identify trends and patterns</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>Results will inform organizational decisions and improvements</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  <span>Your personal information is protected and secure</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-dark-border/70 bg-dark-bg/60 p-6">
              <p className="text-sm text-dark-text-muted">
                If you have any questions or concerns about this assessment, please contact:{' '}
                <a
                  href="mailto:assessment-ethics@beiersdorf.com"
                  className="font-semibold text-primary hover:underline"
                >
                  assessment-ethics@beiersdorf.com
                </a>
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center gap-3">
          {questions.map((question, index) => {
            const isAnswered = responses[question.id] !== undefined;
            const isCurrent = index === currentQuestionIndex;

            return (
              <div
                key={index}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${
                  isAnswered
                    ? 'bg-primary text-dark-bg'
                    : isCurrent
                    ? 'border-2 border-primary text-primary bg-dark-bg/60'
                    : 'border-2 border-dark-border/60 text-dark-text-muted bg-dark-bg/60'
                }`}
              >
                {isAnswered ? (
                  <Check size={20} />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <p className="text-xl text-dark-text leading-relaxed">
            {questions[currentQuestionIndex].question}
          </p>

          <div className="space-y-2">
            <div className="flex border border-dark-border/70 rounded-full overflow-hidden bg-dark-bg/60">
              {[1, 2, 3, 4, 5].map((value, index) => (
                <button
                  key={value}
                  onClick={() => handleResponse(questions[currentQuestionIndex].id, value)}
                  className={`flex-1 py-3 text-xl font-semibold transition-all relative ${
                    responses[questions[currentQuestionIndex].id] === value
                      ? 'bg-primary/20 text-primary'
                      : 'text-dark-text hover:bg-primary/10'
                  } ${
                    index !== 4 ? 'border-r border-dark-border/70' : ''
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 text-xs uppercase tracking-[0.3em] text-dark-text-muted">
              <span className="text-left">{questions[currentQuestionIndex].minLabel}</span>
              <span className="col-span-3"></span>
              <span className="text-right">{questions[currentQuestionIndex].maxLabel}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen bg-dark-bg flex flex-col">
      <div className="mx-auto max-w-5xl px-8 py-6 flex-1 flex flex-col">
        {/* Header */}
        <header className="rounded-[32px] p-6">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  className="text-dark-text hover:text-primary transition-colors"
                  disabled={isSubmitting}
                >
                  <ChevronLeft size={32} />
                </button>
              )}
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
                  Onboarding step {currentStep}
                </p>
                <h1 className="mt-4 text-4xl font-semibold text-dark-text">
                  {STEPS[currentStep - 1].description}
                </h1>
              </div>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="mt-8 flex items-center gap-4">
            {STEPS.map((stepMeta, index) => (
              <div key={stepMeta.id} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-all ${
                    currentStep === 3
                      ? 'bg-dark-border/30'
                      : index + 1 <= currentStep
                      ? 'bg-primary'
                      : 'bg-dark-border/60'
                  }`}
                />
              </div>
            ))}
          </div>
        </header>

        {/* Main Content */}
        <div className="mt-6 flex-1">
          <div className="p-6">
            {renderStepContent()}
          </div>
        </div>

        {/* Fixed Continue Button */}
        <div className="w-full py-6 bg-dark-bg">
          <div className="mx-auto max-w-5xl px-8">
            {currentStep === 1 && (
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!isProfileComplete()}
                className="btn-primary w-full px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
              >
                Continue
              </button>
            )}
            {currentStep === 2 && (
              <button
                onClick={() => setCurrentStep(3)}
                className="btn-primary w-full px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
              >
                Continue
              </button>
            )}
            {currentStep === 3 && (
              <>
                {currentQuestionIndex < questions.length - 1 ? (
                  <button
                    onClick={handleNext}
                    disabled={!responses[questions[currentQuestionIndex].id]}
                    className="btn-primary w-full px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
                  >
                    Continue
                  </button>
                ) : (
                  <button
                    onClick={handleSubmit}
                    disabled={!responses[questions[currentQuestionIndex].id] || isSubmitting}
                    className="btn-primary w-full px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
                  >
                    {isSubmitting ? 'Completing...' : 'Complete setup'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Fixed at bottom */}
      <div className="w-full py-4 text-center text-xs text-dark-text-muted bg-dark-bg">
        <div className="mx-auto max-w-5xl px-8">
          Onboarding as <span className="text-dark-text font-semibold">{user?.name || 'Employee'}</span>
          <span className="mx-2 text-dark-text-muted">•</span>
          <span>{user?.email}</span>
        </div>
      </div>
    </div>
  );
}
