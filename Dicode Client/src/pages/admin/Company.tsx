import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Building2,
  Upload,
  Save,
  Image as ImageIcon,
  Users,
  Plus,
  X,
  LayoutDashboard,
  Palette,
  Layers,
  Globe,
  Loader2,
  Trash2,
  Search,
  Check,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getOrganization, updateOrganization, getUsersByOrganization } from '@/lib/firestore';
import type { Organization, User } from '@/types';
import { Skeleton } from '@/components/shared/Skeleton';

const Company: React.FC = () => {
  const { user } = useAuth();
  const [logo, setLogo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [allEmployees, setAllEmployees] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState('');

  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pendingDeleteDepartments, setPendingDeleteDepartments] = useState<string[]>([]);
  const [deleteAction, setDeleteAction] = useState<'reassign' | 'delete_users'>('reassign');
  const [targetReassignDepartment, setTargetReassignDepartment] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Navigation State
  const [activeTab, setActiveTab] = useState('general');

  const NAV_ITEMS = [
    { id: 'general', label: 'Overview', icon: LayoutDashboard },
    { id: 'departments', label: 'Departments', icon: Layers },
    { id: 'branding', label: 'Branding', icon: Palette },
  ];

  // Load organization data on mount
  useEffect(() => {
    const loadData = async () => {
      if (!user?.organization) {
        setIsLoading(false);
        return;
      }

      try {
        const [org, employees] = await Promise.all([
          getOrganization(user.organization),
          getUsersByOrganization(user.organization),
        ]);

        if (org) {
          setOrganization(org);
          setDepartments(org.departments || []);

          // Load logo from organization settings if available
          if (org.settings.logo) {
            setLogo(org.settings.logo);
          }
        }

        setEmployeeCount(employees.length);
        setAllEmployees(employees);
      } catch (error) {
        console.error('[Company] Failed to load organization data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.organization]);

  // Calculate department counts
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEmployees.forEach(u => {
      if (u.department) {
        counts[u.department] = (counts[u.department] || 0) + 1;
      }
    });
    return counts;
  }, [allEmployees]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddDepartment = () => {
    if (newDepartment.trim() && !departments.includes(newDepartment.trim())) {
      setDepartments([...departments, newDepartment.trim()]);
      setNewDepartment('');
    }
  };

  const handleRemoveDepartment = (dept: string) => {
    setPendingDeleteDepartments([dept]);
    setShowDeleteModal(true);
    setTargetReassignDepartment('');
    setDeleteAction('reassign');
  };

  const handleBulkDelete = () => {
    setPendingDeleteDepartments(selectedDepartments);
    setShowDeleteModal(true);
    setTargetReassignDepartment('');
    setDeleteAction('reassign');
  };

  const handleConfirmDelete = async () => {
    if (!user?.organization || pendingDeleteDepartments.length === 0) return;

    // Validation
    if (deleteAction === 'reassign' && !targetReassignDepartment) {
      alert("Please select a department to reassign users to.");
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch('https://us-central1-dicode-software.cloudfunctions.net/api/delete-departments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId: user.organization,
          departments: pendingDeleteDepartments,
          action: deleteAction,
          targetDepartment: targetReassignDepartment
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete departments');
      }

      // Success: Update local state
      const updatedDepts = departments.filter(d => !pendingDeleteDepartments.includes(d));
      setDepartments(updatedDepts);
      setSelectedDepartments([]); // Clear selection

      // Update employee list locally (approximation)
      if (deleteAction === 'reassign') {
        setAllEmployees(prev => prev.map(emp => {
          if (emp.department && pendingDeleteDepartments.includes(emp.department)) {
            return { ...emp, department: targetReassignDepartment };
          }
          return emp;
        }));
      } else {
        // Remove locally if deleted
        setAllEmployees(prev => prev.filter(emp => !emp.department || !pendingDeleteDepartments.includes(emp.department)));
      }

      setShowDeleteModal(false);
      setPendingDeleteDepartments([]);

    } catch (error: any) {
      console.error('Delete failed:', error);
      alert(`Error: ${error.message} `);
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleDepartment = (dept: string) => {
    if (selectedDepartments.includes(dept)) {
      setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
    } else {
      setSelectedDepartments([...selectedDepartments, dept]);
    }
  };

  const toggleAllDepartments = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments([...departments]);
    }
  };

  const handleSave = async () => {
    if (!organization || !user?.organization) {
      alert('Organization not found');
      return;
    }

    setIsSaving(true);
    try {
      await updateOrganization(user.organization, {
        departments,
        settings: {
          ...organization.settings,
          ...(logo ? { logo } : {}),
        },
      });

      alert('Company settings saved successfully!');
    } catch (error) {
      console.error('[Company] Failed to save settings:', error);
      alert('Failed to save company settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (isLoading) {
    return (
      <div className="p-10 space-y-6">
        <Skeleton className="h-10 w-48 bg-white/5" />
        <div className="flex gap-8">
          <Skeleton className="w-64 h-96 bg-white/5 rounded-2xl" />
          <Skeleton className="flex-1 h-96 bg-white/5 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-white/60">Organization not found</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Building2 size={24} className="text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">{organization.name}</h3>
                <p className="text-sm text-white/60">Manage your organization profile</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {/* Organization Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white block">Organization Name</label>
                  <input
                    type="text"
                    value={organization.name}
                    disabled
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-white/40 focus:ring-2 focus:ring-white/15 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-white block">Industry</label>
                    <div className="relative">
                      <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={organization.industry || 'Technology'}
                        disabled
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-white block">Size</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={organization.size || 'Startup'}
                        disabled
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white block">Region</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={organization.region || 'Global'}
                      disabled
                      className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white block">URL Slug</label>
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white/60">
                    <span className="text-white/40">dicode.io/org/</span>
                    <span className="text-white font-medium">{organization.slug}</span>
                  </div>
                </div>
              </div>


            </div>

            <div className="pt-4 flex justify-end border-t border-white/10">
              <button disabled className="text-sm text-white/40 cursor-not-allowed">
                Need to change these details? Contact Support
              </button>
            </div>
          </div>
        );

      case 'branding':
        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Palette size={24} className="text-pink-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Brand Assets</h3>
                <p className="text-sm text-white/60">Manage your company logo and themes</p>
              </div>
            </div>

            <div className="p-8 rounded-2xl border border-white/10 bg-white/5">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="relative group">
                  {/* Logo Preview */}
                  <div className="w-40 h-40 rounded-2xl border-2 border-dashed border-white/20 flex items-center justify-center bg-black/20 overflow-hidden relative">
                    {logo ? (
                      <img
                        src={logo}
                        alt="Company Logo"
                        className="w-full h-full object-contain p-4"
                      />
                    ) : (
                      <div className="text-center p-4">
                        <ImageIcon size={32} className="mx-auto text-white/20 mb-2" />
                        <span className="text-xs text-white/40">No Logo</span>
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                      >
                        <Upload size={18} />
                      </button>
                      {logo && (
                        <button
                          onClick={handleRemoveLogo}
                          className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-500 transition-colors"
                        >
                          <X size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 text-center sm:text-left">
                  <div>
                    <h4 className="text-white font-medium mb-1">Company Logo</h4>
                    <p className="text-sm text-white/50">
                      This logo will appear on your dashboard, emails, and reports.
                      <br />Recommended size: 512x512px (PNG, SVG).
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
                    >
                      Upload New Logo
                    </button>
                    {logo && (
                      <button
                        onClick={handleRemoveLogo}
                        className="px-4 py-2 rounded-xl border border-white/10 text-white/60 font-medium text-sm hover:text-red-400 hover:bg-white/5 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                Save Changes
              </button>
            </div>
          </div>
        );

      case 'departments':
        const isAllSelected = departments.length > 0 && selectedDepartments.length === departments.length;
        const isSomeSelected = selectedDepartments.length > 0;

        return (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <Layers size={24} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white">Departments</h3>
                <p className="text-sm text-white/60">Organize your employees into groups</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Add Dept Input & Bulk Actions */}
              <div className="flex items-center gap-2">
                {isSomeSelected ? (
                  <div className="flex-1 flex items-center justify-between px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20 transition-all animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-blue-500 text-white">
                        <Check size={12} strokeWidth={3} />
                      </div>
                      <span className="text-sm font-medium text-blue-200">{selectedDepartments.length} selected</span>
                    </div>
                    <button
                      onClick={handleBulkDelete}
                      className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 size={14} />
                      Delete Selected
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                      <input
                        type="text"
                        value={newDepartment}
                        onChange={(e) => setNewDepartment(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddDepartment()}
                        placeholder="Add a new department..."
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      />
                    </div>
                    <button
                      onClick={handleAddDepartment}
                      disabled={!newDepartment.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium hover:bg-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                    >
                      <Plus size={18} />
                      Add
                    </button>
                  </>
                )}
              </div>

              {/* Dept List */}
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-4 py-3 border-b border-white/5 bg-white/5 text-xs font-semibold uppercase tracking-wider text-white/40">
                  <div className="col-span-1 flex items-center justify-center">
                    <button
                      onClick={toggleAllDepartments}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isAllSelected
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'border-white/20 hover:border-white/40'
                        }`}
                    >
                      {isAllSelected && <Check size={10} strokeWidth={3} />}
                    </button>
                  </div>
                  <div className="col-span-7">Department Name</div>
                  <div className="col-span-3 text-right">Members</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>

                <div className="divide-y divide-white/5">
                  {departments.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/5 mb-3">
                        <Layers size={20} className="text-white/20" />
                      </div>
                      <p className="text-sm text-white/40">No departments added yet.</p>
                    </div>
                  ) : (
                    departments.map((dept) => {
                      const isSelected = selectedDepartments.includes(dept);
                      return (
                        <div
                          key={dept}
                          className={`grid grid-cols-12 gap-4 px-4 py-3 items-center transition-colors ${isSelected ? 'bg-blue-500/5 hover:bg-blue-500/10' : 'hover:bg-white/5'
                            }`}
                        >
                          <div className="col-span-1 flex items-center justify-center">
                            <button
                              onClick={() => toggleDepartment(dept)}
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isSelected
                                ? 'bg-blue-500 border-blue-500 text-white'
                                : 'border-white/20 hover:border-white/40'
                                }`}
                            >
                              {isSelected && <Check size={10} strokeWidth={3} />}
                            </button>
                          </div>
                          <div className="col-span-7 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                              <Layers size={14} className="text-emerald-400" />
                            </div>
                            <span className={`text-sm font-medium ${isSelected ? 'text-blue-200' : 'text-white'}`}>{dept}</span>
                          </div>
                          <div className="col-span-3 text-right">
                            <span className="text-sm text-white/60">
                              {deptCounts[dept] || 0}
                            </span>
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <button
                              onClick={() => handleRemoveDepartment(dept)}
                              className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Remove Department"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="text-white p-6 md:p-10 min-h-[calc(100vh-140px)] flex flex-col">
      <div className="max-w-6xl mx-auto flex-1 flex flex-col w-full">
        <div className="flex flex-col lg:flex-row gap-8 flex-1">
          {/* Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-8 lg:sticky lg:top-0 h-fit">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50 px-3 mb-3">Organization</p>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                        } `}
                    >
                      <Icon size={18} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Divider (Desktop) */}
          <div className="hidden lg:block w-px bg-white/5 rounded-full self-stretch" />

          {/* Main Content */}
          <main className="flex-1 min-w-0 max-w-3xl flex flex-col">
            {renderContent()}
          </main>
        </div>
      </div>
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#1A1A1A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <AlertTriangle className="text-red-400" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-white mb-2">Delete Department{pendingDeleteDepartments.length > 1 ? 's' : ''}?</h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-6">
                    You are about to delete{' '}
                    <strong className="text-white">
                      {pendingDeleteDepartments.length > 1
                        ? `${pendingDeleteDepartments.length} departments`
                        : `"${pendingDeleteDepartments[0]}"`
                      }
                    </strong>
                    . This department contains employees. How would you like to handle their accounts?
                  </p>

                  <div className="space-y-4">
                    {/* Option 1: Reassign */}
                    <div
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${deleteAction === 'reassign'
                        ? 'bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      onClick={() => setDeleteAction('reassign')}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${deleteAction === 'reassign' ? 'border-blue-500' : 'border-white/40'
                          }`}>
                          {deleteAction === 'reassign' && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                        </div>
                        <span className={`font-medium ${deleteAction === 'reassign' ? 'text-blue-200' : 'text-white'}`}>
                          Reassign Users
                        </span>
                      </div>
                      <p className="text-sm text-white/50 pl-7">
                        Move all users in this department to another department. They will keep their accounts and data.
                      </p>

                      {deleteAction === 'reassign' && (
                        <div className="mt-4 pl-7">
                          <select
                            value={targetReassignDepartment}
                            onChange={(e) => setTargetReassignDepartment(e.target.value)}
                            className="w-full bg-[#0A0A0A] border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="">Select a department...</option>
                            {departments
                              .filter(d => !pendingDeleteDepartments.includes(d))
                              .map(d => (
                                <option key={d} value={d}>{d}</option>
                              ))
                            }
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Option 2: Delete Users */}
                    <div
                      className={`p-4 rounded-xl border transition-all cursor-pointer ${deleteAction === 'delete_users'
                        ? 'bg-red-500/10 border-red-500/50 ring-1 ring-red-500/50'
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                        }`}
                      onClick={() => setDeleteAction('delete_users')}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${deleteAction === 'delete_users' ? 'border-red-500' : 'border-white/40'
                          }`}>
                          {deleteAction === 'delete_users' && <div className="w-2 h-2 rounded-full bg-red-500" />}
                        </div>
                        <span className={`font-medium ${deleteAction === 'delete_users' ? 'text-red-200' : 'text-white'}`}>
                          Delete Accounts
                        </span>
                      </div>
                      <p className="text-sm text-white/50 pl-7">
                        Permanently delete all user accounts in this department. <span className="text-red-400 font-medium">This cannot be undone.</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setPendingDeleteDepartments([]);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting || (deleteAction === 'reassign' && !targetReassignDepartment)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Confirm Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Company;
