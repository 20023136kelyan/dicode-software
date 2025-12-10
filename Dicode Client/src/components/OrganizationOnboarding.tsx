import React, { useState } from 'react';
import { Check, X, Plus, ArrowRight, Pencil, LogOut } from 'lucide-react';

interface OrganizationOnboardingProps {
  onComplete: (data: OrganizationData) => Promise<void>;
  onSuccess?: () => void;
  onLogout?: () => void;
  userEmail: string;
  userName: string;
}

export interface EmployeeInvite {
  email: string;
  name: string;
  department?: string;
  role?: 'employee' | 'admin';
}

export interface OrganizationData {
  organizationName: string;
  slug: string;
  industry?: string;
  region?: string;
  size?: 'small' | 'medium' | 'large' | 'enterprise';
  departments: string[];
  employees: EmployeeInvite[];
  adminName: string;
  adminGender: 'male' | 'female' | 'other' | 'prefer-not-to-say' | '';
  adminDateOfBirth: string;
}

const INDUSTRIES = [
  'Technology',
  'Healthcare',
  'Finance',
  'Education',
  'Retail',
  'Manufacturing',
  'Professional Services',
  'Other',
];

const REGIONS = [
  'North America',
  'Europe',
  'Asia Pacific',
  'Latin America',
  'Middle East & Africa',
];

const COMPANY_SIZES = [
  { value: 'small', label: '1-50 employees' },
  { value: 'medium', label: '51-200 employees' },
  { value: 'large', label: '201-1000 employees' },
  { value: 'enterprise', label: '1000+ employees' },
];

const STEPS = [
  { id: 1, title: 'Organization', description: 'Company details' },
  { id: 2, title: 'Departments', description: 'Team structure' },
  { id: 3, title: 'Team', description: 'Invite members' },
  { id: 4, title: 'Review', description: 'Confirm details' },
];

const OrganizationOnboarding: React.FC<OrganizationOnboardingProps> = ({
  onComplete,
  onSuccess,
  onLogout,
  userEmail,
  userName,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<OrganizationData>({
    organizationName: '',
    slug: '',
    industry: undefined,
    region: undefined,
    size: undefined,
    departments: [],
    employees: [],
    adminName: userName || '',
    adminGender: '' as 'male' | 'female' | 'other' | 'prefer-not-to-say',
    adminDateOfBirth: '',
  });

  const [departmentInput, setDepartmentInput] = useState('');
  const [newEmployee, setNewEmployee] = useState<EmployeeInvite>({
    email: '',
    name: '',
    department: undefined,
    role: 'employee',
  });

  const handleOrganizationNameChange = (name: string) => {
    setFormData({
      ...formData,
      organizationName: name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    });
  };

  const handleAddDepartment = () => {
    if (departmentInput.trim() && !formData.departments.includes(departmentInput.trim())) {
      setFormData({
        ...formData,
        departments: [...formData.departments, departmentInput.trim()],
      });
      setDepartmentInput('');
    }
  };

  const handleRemoveDepartment = (dept: string) => {
    setFormData({
      ...formData,
      departments: formData.departments.filter((d) => d !== dept),
    });
  };

  const handleAddEmployee = () => {
    if (newEmployee.email.trim() && !formData.employees.some((e) => e.email === newEmployee.email.trim())) {
      setFormData({
        ...formData,
        employees: [
          ...formData.employees,
          {
          email: newEmployee.email.trim(),
          name: newEmployee.name.trim() || newEmployee.email.split('@')[0],
          department: newEmployee.department,
          role: newEmployee.role || 'employee',
          },
        ],
      });
      setNewEmployee({ email: '', name: '', department: undefined, role: 'employee' });
    }
  };

  const handleRemoveEmployee = (email: string) => {
    setFormData({
      ...formData,
      employees: formData.employees.filter((e) => e.email !== email),
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await onComplete(formData);
      setIsSubmitting(false);
      setIsSuccess(true);
      // Wait for success animation, then trigger navigation
      setTimeout(() => {
        onSuccess?.();
      }, 2500);
    } catch (err) {
      setError((err as Error).message || 'Failed to create organization');
      setIsSubmitting(false);
    }
  };

  const canProceedToStep2 =
    formData.organizationName.trim().length > 0 &&
    formData.slug.trim().length > 0 &&
    formData.adminName.trim().length > 0 &&
    formData.adminGender !== '' &&
    formData.adminDateOfBirth.trim().length > 0;
  const canProceedToStep3 = canProceedToStep2 && formData.departments.length > 0;
  const canSubmit = canProceedToStep3;

  return (
    <div className="flex min-h-screen">
      {/* Left Sidebar */}
      <aside className="fixed left-0 top-0 flex h-screen w-80 flex-col bg-[#0a0a0b] px-8 py-10">
        {/* Logo */}
        <div className="mb-16">
          <div className="flex items-center gap-3">
            <img src="/dicode_logo.png" alt="DiCode" className="h-9 w-auto" />
              <div>
              <div className="text-xl font-semibold text-white">DiCode</div>
              <div className="mt-0.5 text-sm text-white/40">Onboarding</div>
            </div>
          </div>
        </div>

        {/* Progress Steps */}
        <nav className="flex-1">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-3 top-6 bottom-6 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />
            
            <ul className="relative space-y-1">
              {STEPS.map((s) => {
                const isActive = step === s.id;
                const isComplete = step > s.id;
                const isPending = step < s.id;

                return (
                  <li key={s.id}>
                    <button
                      onClick={() => {
                        if (isComplete || isActive) setStep(s.id);
                      }}
                      disabled={isPending}
                      className={`group flex w-full items-start gap-5 rounded-xl px-0 py-4 text-left transition-all ${
                        isPending ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      {/* Dot */}
                      <div className="relative z-10 flex h-6 w-6 items-center justify-center flex-shrink-0">
                        <div className="absolute inset-0 rounded-full bg-[#0a0a0b]" />
                        
                        {isComplete ? (
                          <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                            <Check size={12} strokeWidth={3} className="text-white" />
                          </div>
                        ) : isActive ? (
                          <div className="relative flex h-6 w-6 items-center justify-center">
                            <div className="absolute inset-0 rounded-full bg-[#0a0a0b]" />
                            <div className="absolute inset-0 rounded-full border-2 border-primary/40" />
                            <div 
                              className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"
                              style={{ animationDuration: '1.2s' }}
                            />
                            <div className="relative h-2.5 w-2.5 rounded-full bg-primary shadow-lg shadow-primary/50" />
                          </div>
                        ) : (
                          <div className="relative h-3 w-3 rounded-full border-2 border-white/20 bg-[#0a0a0b]" />
                        )}
                      </div>

                      {/* Label */}
                      <div className="pt-0.5">
                        <div
                          className={`transition-all ${
                            isActive
                              ? 'text-lg font-semibold text-white'
                              : isComplete
                                ? 'text-sm font-medium text-white/80'
                                : 'text-sm font-medium text-white/30'
                          }`}
                        >
                          {s.title}
                        </div>
                        <div className={`mt-0.5 text-xs ${isActive ? 'text-white/50' : 'text-white/20'}`}>
                          {s.description}
            </div>
            </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* User Info & Sign Out */}
        <div className="border-t border-white/10 pt-6 space-y-4">
          <div>
            <div className="text-xs text-white/40">Signed in as</div>
            <div className="mt-1 truncate text-sm font-medium text-white/80">{userEmail}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
            >
              <LogOut size={16} />
              Sign out
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-80 flex-1 bg-dark-bg">
        {/* Decorative gradient */}
        <div className="pointer-events-none fixed right-0 top-0 h-[600px] w-[600px] opacity-30">
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/20 via-transparent to-transparent blur-3xl" />
        </div>

        {/* Success Screen */}
        {isSuccess && (
          <div className="relative flex min-h-screen items-center justify-center px-16 py-16">
            <div className="text-center">
              {/* Animated checkmark circle */}
              <div className="relative mx-auto mb-8 h-32 w-32">
                {/* Outer ring animation */}
                <svg className="absolute inset-0 h-32 w-32 animate-[spin_3s_linear_infinite]" viewBox="0 0 128 128">
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
                    className="h-12 w-12 text-white" 
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
                className="text-3xl font-semibold text-dark-text"
                style={{
                  opacity: 0,
                  animation: 'fadeInUp 0.5s ease-out 0.5s forwards',
                }}
              >
                Workspace created!
              </h1>
              <p 
                className="mt-3 text-lg text-dark-text-muted"
                style={{
                  opacity: 0,
                  animation: 'fadeInUp 0.5s ease-out 0.7s forwards',
                }}
              >
                Welcome to {formData.organizationName}
              </p>
              <p 
                className="mt-6 text-sm text-dark-text-muted/60"
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
        <div className="relative min-h-screen px-16 py-16">
          <div className="mx-auto max-w-2xl">
            {error && (
              <div className="mb-8 flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3">
                <div className="h-2 w-2 rounded-full bg-red-500" />
                <span className="text-sm text-red-400">{error}</span>
              </div>
            )}

            {/* Step 1: Organization */}
            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-12">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Step 1 of 4
                  </div>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-dark-text">
                    Organization details
                  </h1>
                  <p className="mt-3 text-lg text-dark-text-muted">
                    Set up your workspace identity and profile.
                  </p>
                </div>

                <div className="space-y-14">
                  {/* Company Section */}
                  <section>
                    <h2 className="mb-8 text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                      Company
                    </h2>

          <div className="space-y-8">
                      <div className="grid grid-cols-2 gap-8">
                        <div className="group">
                          <label className="mb-2 block text-sm font-medium text-dark-text">
                            Organization Name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => handleOrganizationNameChange(e.target.value)}
                  placeholder="Acme Corporation"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text placeholder:text-dark-text-muted/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                  autoFocus
                />
                </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark-text">
                            Workspace URL
                </label>
                          <div className="flex items-center rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                            <span className="text-dark-text-muted/60">dicode.com/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                              placeholder="acme"
                              className="flex-1 bg-transparent text-dark-text placeholder:text-dark-text-muted/40 focus:outline-none"
                  />
                </div>
              </div>
              </div>

                      <div className="grid grid-cols-3 gap-6">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark-text">Industry</label>
                  <select
                    value={formData.industry || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value || undefined })
                  }
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                            <option value="">Select</option>
                    {INDUSTRIES.map((industry) => (
                              <option key={industry} value={industry}>{industry}</option>
                    ))}
                  </select>
                </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark-text">Region</label>
                  <select
                    value={formData.region || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, region: e.target.value || undefined })
                  }
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                  >
                            <option value="">Select</option>
                    {REGIONS.map((region) => (
                              <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
              </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-dark-text">Size</label>
                <select
                  value={formData.size || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      size: (e.target.value as OrganizationData['size']) || undefined,
                    })
                  }
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                >
                            <option value="">Select</option>
                  {COMPANY_SIZES.map((size) => (
                              <option key={size.value} value={size.value}>{size.label}</option>
                  ))}
                </select>
              </div>
            </div>
                </div>
                  </section>

                  {/* Admin Profile Section */}
                  <section>
                    <h2 className="mb-8 text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                      Administrator Profile
                    </h2>
                    
                    <div className="grid grid-cols-3 gap-6">
                <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">
                          Full Name <span className="text-primary">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      placeholder="John Doe"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text placeholder:text-dark-text-muted/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                    />
                  </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">
                          Gender <span className="text-primary">*</span>
                      </label>
                      <select
                        value={formData.adminGender}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          adminGender: e.target.value as
                            | 'male'
                            | 'female'
                            | 'other'
                            | 'prefer-not-to-say'
                            | '',
                        })
                      }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                      >
                          <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                  </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">
                          Date of Birth <span className="text-primary">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.adminDateOfBirth}
                      onChange={(e) =>
                        setFormData({ ...formData, adminDateOfBirth: e.target.value })
                      }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                        max={new Date().toISOString().split('T')[0]}
                      />
                  </div>
                    </div>
                  </section>
              </div>

                <div className="mt-12 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
                    className="group flex items-center gap-3 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Continue
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
            )}

            {/* Step 2: Departments */}
            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-12">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Step 2 of 4
                  </div>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-dark-text">
                    Define departments
                  </h1>
                  <p className="mt-3 text-lg text-dark-text-muted">
                    Add the teams within your organization. At least one required.
            </p>
          </div>

                <section>
                  <div className="flex gap-4">
                  <input
                    type="text"
                    value={departmentInput}
                    onChange={(e) => setDepartmentInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddDepartment()}
                      placeholder="Enter department name"
                      className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text placeholder:text-dark-text-muted/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleAddDepartment}
                      disabled={!departmentInput.trim()}
                      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={16} />
                    Add
                  </button>
                </div>

                  {formData.departments.length > 0 ? (
                    <div className="mt-8 space-y-2">
                      {formData.departments.map((dept, index) => (
                        <div
                          key={dept}
                          className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-5 py-4 transition-all hover:border-white/10"
                        >
                          <div className="flex items-center gap-4">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/5 text-xs font-medium text-dark-text-muted">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <span className="font-medium text-dark-text">{dept}</span>
              </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDepartment(dept)}
                            className="rounded-md p-2 text-dark-text-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 py-16 text-center">
                      <div className="mb-3 rounded-full bg-white/5 p-4">
                        <Plus size={24} className="text-dark-text-muted" />
                      </div>
                      <p className="text-dark-text-muted">No departments added yet</p>
                      <p className="mt-1 text-sm text-dark-text-muted/60">Add your first department above</p>
              </div>
                  )}
                </section>

                <div className="mt-12 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                    className="rounded-lg px-5 py-3 text-sm font-medium text-dark-text-muted transition-colors hover:text-dark-text"
                >
                    Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3}
                    className="group flex items-center gap-3 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Continue
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
            )}

            {/* Step 3: Team */}
            {step === 3 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-12">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Step 3 of 4
                  </div>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-dark-text">
                    Invite team members
                  </h1>
                  <p className="mt-3 text-lg text-dark-text-muted">
                    Add collaborators to your workspace. This step is optional.
          </p>
        </div>

                <section>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">Email Address</label>
                      <input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                          placeholder="colleague@company.com"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text placeholder:text-dark-text-muted/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                          autoFocus
                      />
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">Full Name</label>
                      <input
                        type="text"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                          placeholder="Optional"
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text placeholder:text-dark-text-muted/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all"
                      />
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">Role</label>
                    <select
                      value={newEmployee.role || 'employee'}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  role: e.target.value as 'employee' | 'admin',
                })
              }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-dark-text">Department</label>
                    <select
                      value={newEmployee.department || ''}
              onChange={(e) =>
                setNewEmployee({ ...newEmployee, department: e.target.value || undefined })
              }
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-dark-text focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                          <option value="">Select</option>
                      {formData.departments.map((dept) => (
                            <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>
                    </div>
                    <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={handleAddEmployee}
                      disabled={!newEmployee.email.trim()}
                        className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus size={16} />
                        Add to list
            </button>
          </div>
        </div>

                  {formData.employees.length > 0 && (
                    <div className="mt-10 border-t border-white/10 pt-10">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                        Pending Invitations ({formData.employees.length})
                      </h3>
                      <div className="space-y-2">
                    {formData.employees.map((employee) => (
                      <div
                        key={employee.email}
                            className="group flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-5 py-4 transition-all hover:border-white/10"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-3">
                                <span className="font-medium text-dark-text">{employee.name}</span>
                                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  employee.role === 'admin' 
                                    ? 'bg-purple-500/10 text-purple-400' 
                                    : 'bg-blue-500/10 text-blue-400'
                                }`}>
                                  {employee.role === 'admin' ? 'Admin' : 'Employee'}
                          </span>
                              </div>
                              <div className="mt-1 text-sm text-dark-text-muted">{employee.email}</div>
                            </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(employee.email)}
                              className="rounded-md p-2 text-dark-text-muted opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
                        >
                              <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                    </div>
                  )}
                </section>

                <div className="mt-12 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStep(2)}
                    className="rounded-lg px-5 py-3 text-sm font-medium text-dark-text-muted transition-colors hover:text-dark-text"
          >
                    Back
          </button>
          <button
            type="button"
                    onClick={() => setStep(4)}
                    disabled={!canSubmit}
                    className="group flex items-center gap-3 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </div>
      </div>
            )}

            {/* Step 4: Review */}
            {step === 4 && (
              <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="mb-12">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    Step 4 of 4
      </div>
                  <h1 className="mt-4 text-4xl font-semibold tracking-tight text-dark-text">
                    Review & confirm
              </h1>
                  <p className="mt-3 text-lg text-dark-text-muted">
                    Please verify all details before creating your workspace.
              </p>
          </div>

                <div className="space-y-8">
                  {/* Organization Section */}
                  <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                        Organization
                      </h2>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-dark-text-muted mb-1">Organization Name</div>
                        <div className="text-dark-text font-medium">{formData.organizationName}</div>
            </div>
                      <div>
                        <div className="text-xs text-dark-text-muted mb-1">Workspace URL</div>
                        <div className="text-dark-text font-medium">dicode.com/{formData.slug}</div>
          </div>
                      {formData.industry && (
                        <div>
                          <div className="text-xs text-dark-text-muted mb-1">Industry</div>
                          <div className="text-dark-text font-medium">{formData.industry}</div>
          </div>
        )}
                      {formData.region && (
                        <div>
                          <div className="text-xs text-dark-text-muted mb-1">Region</div>
                          <div className="text-dark-text font-medium">{formData.region}</div>
          </div>
        )}
                      {formData.size && (
                        <div>
                          <div className="text-xs text-dark-text-muted mb-1">Company Size</div>
                          <div className="text-dark-text font-medium">
                            {COMPANY_SIZES.find(s => s.value === formData.size)?.label}
                          </div>
                        </div>
                      )}
              </div>
          </section>

                  {/* Administrator Section */}
                  <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                        Administrator
                      </h2>
                      <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                <div>
                        <div className="text-xs text-dark-text-muted mb-1">Full Name</div>
                        <div className="text-dark-text font-medium">{formData.adminName}</div>
                  </div>
                      <div>
                        <div className="text-xs text-dark-text-muted mb-1">Gender</div>
                        <div className="text-dark-text font-medium capitalize">
                          {formData.adminGender === 'prefer-not-to-say' ? 'Prefer not to say' : formData.adminGender}
                        </div>
                      </div>
                <div>
                        <div className="text-xs text-dark-text-muted mb-1">Date of Birth</div>
                        <div className="text-dark-text font-medium">
                          {new Date(formData.adminDateOfBirth).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Departments Section */}
                  <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                        Departments ({formData.departments.length})
                      </h2>
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Pencil size={12} />
                        Edit
                      </button>
                  </div>
                    <div className="flex flex-wrap gap-2">
                      {formData.departments.map((dept) => (
                        <span
                          key={dept}
                          className="rounded-full bg-white/5 px-4 py-2 text-sm font-medium text-dark-text"
                        >
                            {dept}
                          </span>
                      ))}
                    </div>
                  </section>

                  {/* Team Members Section */}
                  <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-sm font-semibold uppercase tracking-widest text-dark-text-muted">
                        Team Invitations ({formData.employees.length})
                      </h2>
                          <button
                            type="button"
                        onClick={() => setStep(3)}
                        className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                        <Pencil size={12} />
                        Edit
                          </button>
                  </div>
                  {formData.employees.length > 0 ? (
                      <div className="space-y-3">
                    {formData.employees.map((employee) => (
                      <div
                        key={employee.email}
                            className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3"
                      >
                            <div>
                              <div className="font-medium text-dark-text">{employee.name}</div>
                              <div className="text-sm text-dark-text-muted">{employee.email}</div>
                          </div>
                            <div className="flex items-center gap-3">
                              {employee.department && (
                                <span className="text-xs text-dark-text-muted">{employee.department}</span>
                              )}
                              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              employee.role === 'admin'
                                  ? 'bg-purple-500/10 text-purple-400' 
                                  : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {employee.role === 'admin' ? 'Admin' : 'Employee'}
                          </span>
                          </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-dark-text-muted text-sm">No team members invited yet. You can invite them later.</p>
                    )}
                  </section>
                  </div>

                <div className="mt-12 flex items-center justify-between">
                        <button
                          type="button"
                    onClick={() => setStep(3)}
                    disabled={isSubmitting}
                    className="rounded-lg px-5 py-3 text-sm font-medium text-dark-text-muted transition-colors hover:text-dark-text"
                        >
                    Back
                        </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!canSubmit || isSubmitting}
                    className="group flex items-center gap-3 rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Creating workspace...
                      </>
                    ) : (
                      <>
                        Create workspace
                        <Check size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
          )}
        </div>
        </div>
        )}
      </main>
    </div>
  );
};

export default OrganizationOnboarding;
