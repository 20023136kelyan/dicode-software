import React, { useState } from 'react';
import { MapPin, Briefcase, UserPlus, Mail, X, User, Users } from 'lucide-react';

interface OrganizationOnboardingProps {
  onComplete: (data: OrganizationData) => Promise<void>;
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
  {
    id: 1,
    title: 'Organization',
    description: 'Identity & admin profile',
  },
  {
    id: 2,
    title: 'Departments',
    description: 'Map the teams that matter',
  },
  {
    id: 3,
    title: 'Team members',
    description: 'Invite collaborators (optional)',
  },
];

const OrganizationOnboarding: React.FC<OrganizationOnboardingProps> = ({
  onComplete,
  userEmail,
  userName,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Auto-generate slug from organization name
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
      departments: formData.departments.filter(d => d !== dept),
    });
  };

  const handleAddEmployee = () => {
    if (newEmployee.email.trim() && !formData.employees.some(e => e.email === newEmployee.email.trim())) {
      setFormData({
        ...formData,
        employees: [...formData.employees, {
          email: newEmployee.email.trim(),
          name: newEmployee.name.trim() || newEmployee.email.split('@')[0],
          department: newEmployee.department,
          role: newEmployee.role || 'employee',
        }],
      });
      setNewEmployee({ email: '', name: '', department: undefined, role: 'employee' });
    }
  };

  const handleRemoveEmployee = (email: string) => {
    setFormData({
      ...formData,
      employees: formData.employees.filter(e => e.email !== email),
    });
  };

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    try {
      await onComplete(formData);
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
  const canSubmit = canProceedToStep3; // Employees are optional
  const mainColumnClass = step === 1 ? 'xl:col-span-12' : 'xl:col-span-8';

  const renderStepContent = () => {
    if (step === 1) {
  return (
        <div className="space-y-10">
          <div className="flex flex-wrap items-start justify-between gap-6 border-b border-dark-border/60 pb-6">
              <div>
              <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
                Step 01 • Organization Profile
              </p>
              <h2 className="mt-3 text-3xl font-semibold text-dark-text">
                Set the tone for your workspace
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-dark-text-muted">
                Name your organization, secure its slug, and share the context we use to
                personalize analytics across the DiCode suite.
              </p>
            </div>
            <div className="rounded-2xl border border-dark-border/70 bg-dark-bg/70 px-5 py-4 text-right">
              <p className="text-[10px] uppercase tracking-[0.4em] text-dark-text-muted">
                Slug preview
              </p>
              <p className="mt-1 max-w-[180px] truncate text-sm font-semibold text-dark-text">
                dicode.com/{formData.slug || 'your-org'}
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="max-w-xl">
                <label className="text-sm font-semibold text-dark-text">
                  Organization Name *
                </label>
                <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                <input
                  type="text"
                  value={formData.organizationName}
                  onChange={(e) => handleOrganizationNameChange(e.target.value)}
                  placeholder="Acme Corporation"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                  autoFocus
                />
                </div>
              </div>

              <div className="max-w-xl">
                <label className="text-sm font-semibold text-dark-text">
                  Organization URL
                </label>
                <div className="mt-2 flex items-center gap-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                  <span className="text-sm text-dark-text-muted">dicode.com/</span>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                      })
                    }
                    placeholder="acme-corp"
                    className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                  />
                </div>
                <p className="mt-2 text-xs text-dark-text-muted">
                  The slug keeps your workspace URL consistent across every DiCode surface.
                </p>
              </div>
              </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="max-w-sm">
                <label className="text-sm font-semibold text-dark-text">
                    <div className="flex items-center gap-2">
                      <Briefcase size={16} />
                      Industry
                    </div>
                  </label>
                  <select
                    value={formData.industry || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, industry: e.target.value || undefined })
                  }
                  className="input mt-2 w-full"
                  >
                    <option value="">Select industry</option>
                    {INDUSTRIES.map((industry) => (
                    <option key={industry} value={industry}>
                      {industry}
                    </option>
                    ))}
                  </select>
                </div>

              <div className="max-w-sm">
                <label className="text-sm font-semibold text-dark-text">
                    <div className="flex items-center gap-2">
                      <MapPin size={16} />
                      Region
                    </div>
                  </label>
                  <select
                    value={formData.region || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, region: e.target.value || undefined })
                  }
                  className="input mt-2 w-full"
                  >
                    <option value="">Select region</option>
                    {REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                    ))}
                  </select>
              </div>

              <div className="max-w-sm">
                <label className="text-sm font-semibold text-dark-text">
                  <div className="flex items-center gap-2">
                    <Users size={16} />
                    Company Size
                  </div>
                </label>
                <select
                  value={formData.size || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      size: (e.target.value as OrganizationData['size']) || undefined,
                    })
                  }
                  className="input mt-2 w-full"
                >
                  <option value="">Select company size</option>
                  {COMPANY_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border-t border-dark-border/60 pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-3 text-primary">
                  <User size={18} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-dark-text-muted">
                    Admin profile
                  </p>
                  <p className="text-base font-semibold text-dark-text">Tell us about you</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="max-w-sm">
                  <label className="text-sm font-semibold text-dark-text">
                        Full Name *
                    </label>
                  <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                    <input
                      type="text"
                      value={formData.adminName}
                      onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                      placeholder="John Doe"
                      className="w-full bg-transparent text-dark-text placeholder:text-dark-text-muted focus:outline-none"
                    />
                  </div>
                  </div>

                <div className="max-w-sm">
                  <label className="text-sm font-semibold text-dark-text">
                          Gender *
                      </label>
                  <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
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
                      className="w-full bg-transparent text-dark-text focus:outline-none"
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer-not-to-say">Prefer not to say</option>
                      </select>
                  </div>
                    </div>

                <div className="max-w-sm">
                  <label className="text-sm font-semibold text-dark-text">
                          Date of Birth *
                      </label>
                  <div className="mt-2 rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-4 py-3">
                      <input
                        type="date"
                        value={formData.adminDateOfBirth}
                      onChange={(e) =>
                        setFormData({ ...formData, adminDateOfBirth: e.target.value })
                      }
                      className="w-full bg-transparent text-dark-text focus:outline-none"
                        max={new Date().toISOString().split('T')[0]}
                      />
                  </div>
                    </div>
                  </div>
                </div>
              </div>

          <div className="flex justify-end border-t border-dark-border/70 pt-6">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!canProceedToStep2}
              className="btn-primary px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
                >
              Continue to departments
                </button>
              </div>
            </div>
      );
    }

    if (step === 2) {
      return (
        <div className="space-y-10">
          <div className="border-b border-dark-border/60 pb-6">
            <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
              Step 02 • Departments
            </p>
            <h2 className="mt-3 text-3xl font-semibold text-dark-text">
              Map the teams that drive your programs
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-dark-text-muted">
              Add the departments you report on today. You can always extend or reorder them later—we
              just need at least one to anchor dashboards.
            </p>
          </div>

          <div className="space-y-4 rounded-2xl border border-dark-border/70 bg-dark-bg/60 p-6">
            <label className="text-sm font-semibold text-dark-text">Add Departments *</label>
            <p className="text-xs text-dark-text-muted">
              Keep names short and clear. Press enter to add multiple in a row.
                </p>
            <div className="flex gap-3">
                  <input
                    type="text"
                    value={departmentInput}
                    onChange={(e) => setDepartmentInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddDepartment()}
                placeholder="e.g., Growth Marketing, Sales Enablement"
                    className="input flex-1"
                  />
              <button type="button" onClick={handleAddDepartment} className="btn-secondary px-5">
                    Add
                  </button>
                </div>
              </div>

          <div className="flex items-center justify-between border-t border-dark-border/70 pt-6">
                <button
                  type="button"
                  onClick={() => setStep(1)}
              className="btn-secondary px-6"
                  disabled={isSubmitting}
                >
              Back to organization
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={!canProceedToStep3}
              className="btn-primary px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
                >
              Continue to team
                </button>
              </div>
            </div>
      );
    }

    return (
      <div className="space-y-10">
        <div className="border-b border-dark-border/60 pb-6">
          <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
            Step 03 • Team Members
          </p>
          <h2 className="mt-3 text-3xl font-semibold text-dark-text">Draft optional invites</h2>
          <p className="mt-2 max-w-3xl text-sm text-dark-text-muted">
            Invite your core collaborators now or skip this step for later. We'll stage the invites so
            you can send them once organization setup completes.
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-dark-border/70 bg-dark-bg/60 p-6">
          <label className="text-sm font-semibold text-dark-text">
                    Add Team Members (Optional)
                </label>
          <p className="text-xs text-dark-text-muted">
            Include at least an email. We'll prefill missing names from the address automatically.
                </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <input
                        type="email"
                        value={newEmployee.email}
                        onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                        placeholder="email@company.com"
                        className="input w-full"
                      />
                      <input
                        type="text"
                        value={newEmployee.name}
                        onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
              placeholder="Full name (optional)"
                        className="input w-full"
                      />
                    </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <select
                      value={newEmployee.role || 'employee'}
              onChange={(e) =>
                setNewEmployee({
                  ...newEmployee,
                  role: e.target.value as 'employee' | 'admin',
                })
              }
                      className="input w-full"
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                    <select
                      value={newEmployee.department || ''}
              onChange={(e) =>
                setNewEmployee({ ...newEmployee, department: e.target.value || undefined })
              }
                      className="input w-full"
                    >
                      <option value="">Select department (optional)</option>
                      {formData.departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleAddEmployee}
                      disabled={!newEmployee.email.trim()}
              className="btn-secondary flex items-center gap-2 px-5"
                    >
                      <UserPlus size={18} />
              Add to queue
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-dark-border/70 pt-6">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-secondary px-6"
            disabled={isSubmitting}
          >
            Back to departments
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className="btn-primary px-8 py-3 text-sm font-semibold uppercase tracking-[0.3em]"
          >
            {isSubmitting ? 'Creating...' : 'Complete setup'}
                    </button>
                  </div>
      </div>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-dark-bg">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-primary/10 blur-[180px]" />
        <div className="absolute top-40 -left-10 h-[360px] w-[360px] rounded-full bg-blue-primary/10 blur-[200px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-8 py-12">
        <header className="rounded-[32px] p-10">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
                DiCode Control Room
              </p>
              <h1 className="mt-4 text-4xl font-semibold text-dark-text">
                Launch your organization workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm text-dark-text-muted">
                Follow the guided flow to set up DiCode for your company. Everything here is optimized
                for desktop so you can work with as much screen real estate as you need.
              </p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <div className="flex items-center gap-4">
              {STEPS.map((stepMeta, index) => (
                <div key={stepMeta.id} className="flex-1">
                  <div
                    className={`h-1.5 rounded-full ${
                      index + 1 <= step ? 'bg-primary' : 'bg-dark-border/60'
                    }`}
                  />
                </div>
              ))}
            </div>
          </div>
        </header>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-12 grid gap-8 xl:grid-cols-12">
          <section className={mainColumnClass}>
            <div className="rounded-[28px] border border-dark-border/70 bg-dark-card/80 p-8 shadow-[0_15px_60px_rgba(0,0,0,0.35)]">
              {renderStepContent()}
              </div>
          </section>

          {step > 1 && (
            <aside className="xl:col-span-4">
              <div className="space-y-6 rounded-3xl border border-dark-border/70 bg-dark-card/70 p-6">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
                      Departments added
                    </p>
                    <span className="text-xs text-dark-text-muted">
                      {formData.departments.length} total
                    </span>
                  </div>
                  {formData.departments.length > 0 ? (
                    <div className="mt-4 space-y-2">
                      {formData.departments.map((dept, index) => (
                        <div
                          key={dept}
                          className="flex items-center gap-3 rounded-2xl border border-dark-border/60 bg-dark-bg/40 px-4 py-3"
                        >
                          <span className="text-[11px] font-semibold text-dark-text-muted">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="truncate text-sm font-semibold text-dark-text flex-1">
                            {dept}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDepartment(dept)}
                            className="rounded-full p-1 text-dark-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-dark-text-muted">
                      Add departments to populate this list.
                    </p>
                  )}
                </div>

                <div className="border-t border-dark-border/60 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.4em] text-dark-text-muted">
                      Team members
                    </p>
                    <span className="text-xs text-dark-text-muted">
                      {formData.employees.length} queued
                    </span>
                  </div>
                  {formData.employees.length > 0 ? (
                    <div className="custom-scrollbar mt-4 max-h-60 space-y-3 overflow-y-auto pr-1">
                    {formData.employees.map((employee) => (
                      <div
                        key={employee.email}
                          className="flex items-center gap-3 rounded-2xl border border-dark-border/60 bg-dark-bg/40 px-3 py-3"
                      >
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Mail size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-dark-text">{employee.name}</p>
                            <p className="truncate text-xs text-dark-text-muted">{employee.email}</p>
                          </div>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-[0.3em] ${
                              employee.role === 'admin'
                                ? 'bg-purple-500/20 text-purple-200'
                                : 'bg-blue-500/20 text-blue-200'
                            }`}
                          >
                            {employee.role || 'employee'}
                          </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmployee(employee.email)}
                            className="ml-2 rounded-full p-1.5 text-dark-text-muted transition-colors hover:bg-red-500/10 hover:text-red-400"
                        >
                            <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  ) : (
                    <p className="mt-3 text-xs text-dark-text-muted">
                      Invite your collaborators to see them here.
                    </p>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>

        <div className="mt-12 text-center text-xs text-dark-text-muted">
          Setting up as <span className="text-dark-text font-semibold">{userName || 'Admin'}</span>
          <span className="mx-2 text-dark-text-muted">•</span>
          <span>{userEmail}</span>
        </div>
      </div>
    </div>
  );
};

export default OrganizationOnboarding;
