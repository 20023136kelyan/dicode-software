import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  FolderPlus,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Copy,
  RefreshCw,
  Upload,
  Users,
  Clock,
  Building2,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Mail,
  AlertTriangle,
  Send,
  Loader2,
  MoreVertical,
  Shield,
  Plus,
} from 'lucide-react';
import { Employee, Cohort, Invitation, UserRole } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUsersByOrganization,
  getCohortsByOrganization,
  createCohort,
  addEmployeeToCohort,
  removeEmployeeFromCohort,
  updateUserCohorts,
  getOrganization,
  getOrganizationInvitations,
  revokeInvitation,
  resendInvitation,
  upsertUserProfile,
} from '@/lib/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import InviteModal from '@/components/InviteModal';
import BulkImportModal from '@/components/BulkImportModal';
import CohortPanel from '@/components/CohortPanel';
import { EmployeeTableSkeleton } from '@/components/shared/Skeleton';

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
  confirmVariant?: 'danger' | 'primary';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  confirmVariant = 'primary',
  isLoading = false,
  icon,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4 mb-4">
          {icon && (
            <div className={`flex-shrink-0 p-2 rounded-lg ${confirmVariant === 'danger' ? 'bg-red-500/10' : 'bg-primary/10'}`}>
              {icon}
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-dark-text">{title}</h2>
            <p className="mt-2 text-sm text-dark-text-muted">{message}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 h-10 rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center justify-center gap-2 ${confirmVariant === 'danger'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-primary text-white hover:bg-primary/90'
              }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

type PeopleRow = {
  kind: 'employee' | 'invite';
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  cohortLabel: string;
  status: 'active' | 'inactive' | 'invited' | 'expired';
  employee?: Employee;
  invitation?: Invitation;
  createdAt?: Date | string | number;
};

type SortField = 'name' | 'email' | 'department' | 'cohort' | 'status';
type SortDirection = 'asc' | 'desc';

const EmployeeManagement: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const [showAssignCohort, setShowAssignCohort] = useState<string | null>(null);
  const [showBatchAssignCohort, setShowBatchAssignCohort] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCohortFilter, setSelectedCohortFilter] = useState<string>('all');
  const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    type: 'resend' | 'revoke' | 'delete' | null;
    invitation?: Invitation;
    employee?: Employee;
  }>({ type: null });
  const [isProcessing, setIsProcessing] = useState(false);

  // Actions menu state
  const [openActionsMenu, setOpenActionsMenu] = useState<string | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  // Role change modal state
  const [showRoleModal, setShowRoleModal] = useState<{ employee: Employee } | null>(null);
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);

  // Department change modal state
  const [showDeptModal, setShowDeptModal] = useState<{ employee: Employee } | null>(null);
  const [isCreatingDept, setIsCreatingDept] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [isUpdatingDept, setIsUpdatingDept] = useState(false);

  // Close actions menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target as Node)) {
        setOpenActionsMenu(null);
      }
    };
    if (openActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openActionsMenu]);

  // Handle role change
  const handleRoleChange = async (employeeId: string, newRole: UserRole) => {
    if (!showRoleModal) return;
    setIsUpdatingRole(true);
    try {
      await upsertUserProfile(employeeId, { role: newRole });
      // Update local state
      setEmployees(prev => prev.map(emp =>
        emp.id === employeeId ? { ...emp, role: newRole } : emp
      ));
      setShowRoleModal(null);
    } catch (error) {
      console.error('Failed to update role:', error);
    } finally {
      setIsUpdatingRole(false);
    }
  };

  // Handle department change
  const handleDeptChange = async (employeeId: string, dept: string | null) => {
    if (!showDeptModal) return;
    setIsUpdatingDept(true);
    try {
      await upsertUserProfile(employeeId, { department: dept });
      // Update local state
      setEmployees(prev => prev.map(emp =>
        emp.id === employeeId ? { ...emp, department: dept || undefined } : emp
      ));
      setShowDeptModal(null);
      setIsCreatingDept(false);
      setNewDepartment('');
    } catch (error) {
      console.error('Failed to update department:', error);
    } finally {
      setIsUpdatingDept(false);
    }
  };

  // Load data function
  const loadData = async () => {
    if (!user?.organization) {
      console.warn('[EmployeeManagement] No organization set for user');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      const org = await getOrganization(user.organization);
      if (org) {
        setDepartments(org.departments);
      }

      const [loadedEmployees, loadedCohorts, loadedInvitations] = await Promise.all([
        getUsersByOrganization(user.organization),
        getCohortsByOrganization(user.organization),
        getOrganizationInvitations(user.organization),
      ]);

      setEmployees(loadedEmployees);
      setCohorts(loadedCohorts.map(c => ({
        ...c,
        description: c.description || undefined,
        organization: c.organization || undefined,
      })));
      setInvitations(loadedInvitations);
    } catch (error) {
      console.error('[EmployeeManagement] Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.organization]);

  const searchValue = searchTerm.toLowerCase();

  const getCohortNames = (cohortIds?: string[]) => {
    if (!cohortIds || cohortIds.length === 0) return 'Unassigned';
    const names = cohortIds
      .map((id) => cohorts.find((c) => c.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Unknown';
  };

  // Create a set of emails with pending invitations for filtering
  const pendingInviteEmailsSet = useMemo(() => {
    return new Set(
      invitations.filter(inv => inv.status === 'pending').map(inv => inv.email.toLowerCase())
    );
  }, [invitations]);

  // Helper to determine effective status for employees
  const getEffectiveStatus = (employee: Employee): PeopleRow['status'] => {
    // Current logged-in user is always shown with their actual status
    if (employee.id === user?.id) {
      return employee.status;
    }

    const hasPendingInvite = pendingInviteEmailsSet.has(employee.email.toLowerCase());

    // If they have a pending invitation, they haven't accepted yet
    if (hasPendingInvite) {
      return 'invited';
    }

    // If no pending invite, trust the stored status
    return employee.status;
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch =
      employee.name.toLowerCase().includes(searchValue) ||
      employee.email.toLowerCase().includes(searchValue) ||
      employee.department?.toLowerCase().includes(searchValue);

    const matchesCohort = selectedCohortFilter === 'all'
      ? true
      : selectedCohortFilter === 'unassigned'
        ? !employee.cohortIds || employee.cohortIds.length === 0
        : employee.cohortIds?.includes(selectedCohortFilter);

    const matchesDepartment = selectedDepartmentFilter === 'all'
      ? true
      : employee.department === selectedDepartmentFilter;

    const effectiveStatus = getEffectiveStatus(employee);

    const matchesStatus = selectedStatusFilter === 'all'
      ? true
      : effectiveStatus === selectedStatusFilter;

    return matchesSearch && matchesCohort && matchesDepartment && matchesStatus;
  });

  const peopleRows = useMemo<PeopleRow[]>(() => {
    // Create a map of pending invitations by email for quick lookup
    const pendingInvitesByEmail = new Map<string, Invitation>();
    invitations.forEach(inv => {
      if (inv.status === 'pending') {
        pendingInvitesByEmail.set(inv.email.toLowerCase(), inv);
      }
    });

    // Get all employee emails
    const employeeEmails = new Set(employees.map(emp => emp.email.toLowerCase()));

    // Build employee rows using the helper function for status
    const employeeRows: PeopleRow[] = filteredEmployees.map((employee) => {
      const pendingInvite = pendingInvitesByEmail.get(employee.email.toLowerCase());
      const effectiveStatus = getEffectiveStatus(employee);

      return {
        kind: 'employee' as const,
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: employee.role === 'admin' ? 'Admin' : 'Employee',
        department: employee.department || '—',
        cohortLabel: getCohortNames(employee.cohortIds),
        status: effectiveStatus,
        employee,
        invitation: pendingInvite, // Attach the pending invite if exists
        createdAt: employee.createdAt,
      };
    });

    // Only show standalone invitations where no user account exists yet
    const standaloneInvitations = invitations.filter((inv) =>
      inv.status === 'pending' && !employeeEmails.has(inv.email.toLowerCase())
    );

    const filteredInvitations = standaloneInvitations.filter((invitation) => {
      const inviteeName = invitation.metadata?.inviteeName?.toLowerCase() || '';
      const matchesSearch =
        invitation.email.toLowerCase().includes(searchValue) ||
        inviteeName.includes(searchValue) ||
        invitation.department?.toLowerCase().includes(searchValue);

      const matchesCohort = selectedCohortFilter === 'all'
        ? true
        : selectedCohortFilter === 'unassigned'
          ? !invitation.cohortIds || invitation.cohortIds.length === 0
          : invitation.cohortIds?.includes(selectedCohortFilter);

      const matchesDepartment = selectedDepartmentFilter === 'all'
        ? true
        : invitation.department === selectedDepartmentFilter;

      const matchesStatus = selectedStatusFilter === 'all' || selectedStatusFilter === 'invited';

      return matchesSearch && matchesCohort && matchesDepartment && matchesStatus;
    });

    const inviteRows: PeopleRow[] = filteredInvitations.map((invitation) => {
      const inviteStatus: PeopleRow['status'] = invitation.status === 'expired' ? 'expired' : 'invited';
      return {
        kind: 'invite' as const,
        id: invitation.id,
        name: invitation.metadata?.inviteeName || invitation.email,
        email: invitation.email,
        role: invitation.role === 'admin' ? 'Admin' : 'Employee',
        department: invitation.department || '—',
        cohortLabel: getCohortNames(invitation.cohortIds),
        status: inviteStatus,
        invitation,
        createdAt: invitation.createdAt,
      };
    });

    const rows: PeopleRow[] = [...employeeRows, ...inviteRows];

    // Sort rows
    return rows.sort((a, b) => {
      let aVal: string = '';
      let bVal: string = '';

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'email':
          aVal = a.email.toLowerCase();
          bVal = b.email.toLowerCase();
          break;
        case 'department':
          aVal = a.department.toLowerCase();
          bVal = b.department.toLowerCase();
          break;
        case 'cohort':
          aVal = a.cohortLabel.toLowerCase();
          bVal = b.cohortLabel.toLowerCase();
          break;
        case 'status':
          const statusOrder = { active: 4, invited: 3, inactive: 2, expired: 1 };
          return sortDirection === 'asc'
            ? statusOrder[a.status] - statusOrder[b.status]
            : statusOrder[b.status] - statusOrder[a.status];
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredEmployees, invitations, searchValue, selectedCohortFilter, selectedDepartmentFilter, selectedStatusFilter, cohorts, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-3.5 w-3.5 text-dark-text-muted/50" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-dark-text" />
      : <ChevronDown className="h-3.5 w-3.5 text-dark-text" />;
  };

  const getStatusStyles = (status: PeopleRow['status']) => {
    switch (status) {
      case 'active':
        return { bg: 'bg-emerald-500/10', text: 'text-emerald-400', label: 'Active' };
      case 'invited':
        return { bg: 'bg-amber-500/10', text: 'text-amber-400', label: 'Invited' };
      case 'inactive':
        return { bg: 'bg-slate-500/10', text: 'text-slate-400', label: 'Inactive' };
      case 'expired':
        return { bg: 'bg-red-500/10', text: 'text-red-400', label: 'Expired' };
      default:
        return { bg: 'bg-dark-bg', text: 'text-dark-text-muted', label: status };
    }
  };

  // Stats
  const stats = useMemo(() => {
    // Create a set of emails with pending invitations
    const pendingInviteEmails = new Set(
      invitations.filter(inv => inv.status === 'pending').map(inv => inv.email.toLowerCase())
    );

    const total = employees.length;

    // Count active members (those without pending invites)
    const active = employees.filter(e => {
      const hasPendingInvite = pendingInviteEmails.has(e.email.toLowerCase());
      return e.status === 'active' && !hasPendingInvite;
    }).length;

    // Count pending invitations
    const pending = invitations.filter(inv => inv.status === 'pending').length;

    const cohortCount = cohorts.length;
    return { total, active, pending, cohortCount };
  }, [employees, invitations, cohorts]);

  const handleInviteModalClose = async () => {
    setShowInviteModal(false);
    if (user?.organization) {
      const loadedInvitations = await getOrganizationInvitations(user.organization);
      setInvitations(loadedInvitations);
    }
  };

  const handleCopyInviteLink = async (token: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Invite link copied to clipboard!');
    } catch (err) {
      console.error('[EmployeeManagement] Failed to copy link:', err);
      alert('Failed to copy link. Please try again.');
    }
  };

  // Open resend confirmation modal
  const openResendModal = (invitation: Invitation) => {
    setConfirmModal({ type: 'resend', invitation });
  };

  // Open revoke confirmation modal
  const openRevokeModal = (invitation: Invitation) => {
    setConfirmModal({ type: 'revoke', invitation });
  };

  // Open delete employee confirmation modal
  const openDeleteModal = (employee: Employee) => {
    setConfirmModal({ type: 'delete', employee });
  };

  // Close confirmation modal
  const closeConfirmModal = () => {
    setConfirmModal({ type: null });
    setIsProcessing(false);
  };

  // Handle resend invitation (generates new token and sends new email)
  const handleResendInvite = async () => {
    if (!confirmModal.invitation) return;

    setIsProcessing(true);
    try {
      // 1. Update the invitation with a new token in Firestore
      await resendInvitation(confirmModal.invitation.id);

      // 2. Send a new password reset email using the Cloud Function
      const requestPasswordReset = httpsCallable(functions, 'requestPasswordReset');
      await requestPasswordReset({ email: confirmModal.invitation.email });

      // 3. Reload invitations
      if (user?.organization) {
        const loadedInvitations = await getOrganizationInvitations(user.organization);
        setInvitations(loadedInvitations);
      }

      closeConfirmModal();
      alert('Invitation resent successfully! A new email has been sent.');
    } catch (error) {
      console.error('[EmployeeManagement] Failed to resend invitation:', error);
      alert('Failed to resend invitation. Please try again.');
      setIsProcessing(false);
    }
  };

  // Handle revoke invitation
  const handleRevokeInvite = async () => {
    if (!confirmModal.invitation) return;

    setIsProcessing(true);
    try {
      await revokeInvitation(confirmModal.invitation.id);
      setInvitations(invitations.filter(inv => inv.id !== confirmModal.invitation!.id));
      closeConfirmModal();
      alert('Invitation revoked successfully!');
    } catch (error) {
      console.error('[EmployeeManagement] Failed to revoke invitation:', error);
      alert('Failed to revoke invitation. Please try again.');
      setIsProcessing(false);
    }
  };

  // Handle delete employee
  const handleDeleteEmployeeConfirm = async () => {
    if (!confirmModal.employee) return;

    setIsProcessing(true);
    try {
      const employeeId = confirmModal.employee.id;
      const employeeEmail = confirmModal.employee.email;

      // Remove from cohorts first
      const employeeCohorts = cohorts.filter(c => c.employeeIds.includes(employeeId));
      await Promise.all(
        employeeCohorts.map(cohort => removeEmployeeFromCohort(cohort.id, employeeId))
      );

      // Delete Firebase Auth account and Firestore document using Cloud Function
      const deleteEmployeeAccount = httpsCallable(functions, 'deleteEmployeeAccount');
      await deleteEmployeeAccount({ userId: employeeId, email: employeeEmail });

      // Update local state
      setEmployees(employees.filter((emp) => emp.id !== employeeId));
      setCohorts(
        cohorts.map((cohort) => ({
          ...cohort,
          employeeIds: cohort.employeeIds.filter((id) => id !== employeeId),
        }))
      );

      closeConfirmModal();
      alert('Employee deleted successfully!');
    } catch (error) {
      console.error('[EmployeeManagement] Failed to delete employee:', error);
      alert('Failed to delete employee. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleCreateCohort = async (data: { name: string; description: string }) => {
    if (!user?.organization) {
      throw new Error('Cannot create cohort without organization');
    }

    const cohortId = await createCohort(
      data.name,
      data.description || undefined,
      [],
      user.organization
    );

    const newCohortData: Cohort = {
      id: cohortId,
      name: data.name,
      description: data.description || undefined,
      employeeIds: [],
      organization: user.organization,
      createdAt: new Date(),
    };

    setCohorts([...cohorts, newCohortData]);
  };

  const handleAssignToCohort = async (employeeId: string, cohortId: string | null) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        alert('Employee not found');
        return;
      }

      const cohortName = cohortId
        ? cohorts.find(c => c.id === cohortId)?.name || 'Unknown Cohort'
        : 'Unassigned';

      const confirmMessage = cohortId
        ? `Assign ${employee.name} to "${cohortName}"?`
        : `Remove ${employee.name} from all cohorts?`;

      if (!window.confirm(confirmMessage)) {
        return;
      }

      const oldCohortIds = employee.cohortIds || [];

      await Promise.all(
        oldCohortIds.map(oldCohortId => removeEmployeeFromCohort(oldCohortId, employeeId))
      );

      let newCohortIds: string[] = [];
      if (cohortId) {
        await addEmployeeToCohort(cohortId, employeeId);
        newCohortIds = [cohortId];
      }

      await updateUserCohorts(employeeId, newCohortIds);

      setEmployees(
        employees.map((emp) =>
          emp.id === employeeId ? { ...emp, cohortIds: newCohortIds.length > 0 ? newCohortIds : undefined } : emp
        )
      );

      setCohorts(
        cohorts.map((cohort) => {
          if (cohortId && cohort.id === cohortId) {
            return {
              ...cohort,
              employeeIds: [...cohort.employeeIds.filter(id => id !== employeeId), employeeId],
            };
          }
          return {
            ...cohort,
            employeeIds: cohort.employeeIds.filter((id) => id !== employeeId),
          };
        })
      );

      setShowAssignCohort(null);
    } catch (error) {
      console.error('❌ Failed to assign employee to cohort:', error);
      alert('Failed to assign employee to cohort. Please try again.');
    }
  };

  const handleBatchAssignToCohort = async (cohortId: string | null) => {
    const selectedEmployees = employees.filter(emp => selectedEmployeeIds.has(emp.id));

    if (selectedEmployees.length === 0) {
      alert('No employees selected');
      return;
    }

    const cohortName = cohortId
      ? cohorts.find(c => c.id === cohortId)?.name || 'Unknown Cohort'
      : 'Unassigned';

    const confirmMessage = cohortId
      ? `Assign ${selectedEmployees.length} employee(s) to "${cohortName}"?`
      : `Remove ${selectedEmployees.length} employee(s) from all cohorts?`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      for (const employee of selectedEmployees) {
        const oldCohortIds = employee.cohortIds || [];

        await Promise.all(
          oldCohortIds.map(oldCohortId => removeEmployeeFromCohort(oldCohortId, employee.id))
        );

        let newCohortIds: string[] = [];
        if (cohortId) {
          await addEmployeeToCohort(cohortId, employee.id);
          newCohortIds = [cohortId];
        }

        await updateUserCohorts(employee.id, newCohortIds);
      }

      const selectedIds = new Set(selectedEmployees.map(e => e.id));
      setEmployees(
        employees.map((emp) => {
          if (selectedIds.has(emp.id)) {
            return { ...emp, cohortIds: cohortId ? [cohortId] : undefined };
          }
          return emp;
        })
      );

      setCohorts(
        cohorts.map((cohort) => {
          if (cohortId && cohort.id === cohortId) {
            const newEmployeeIds = [...cohort.employeeIds];
            selectedEmployees.forEach(emp => {
              if (!newEmployeeIds.includes(emp.id)) {
                newEmployeeIds.push(emp.id);
              }
            });
            return { ...cohort, employeeIds: newEmployeeIds };
          }
          return {
            ...cohort,
            employeeIds: cohort.employeeIds.filter((id) => !selectedIds.has(id)),
          };
        })
      );

      setShowBatchAssignCohort(false);
      setSelectedEmployeeIds(new Set());
    } catch (error) {
      console.error('❌ Failed to batch assign employees to cohort:', error);
      alert('Failed to batch assign employees. Please try again.');
    }
  };

  const toggleEmployeeSelection = (employeeId: string) => {
    const newSelection = new Set(selectedEmployeeIds);
    if (newSelection.has(employeeId)) {
      newSelection.delete(employeeId);
    } else {
      newSelection.add(employeeId);
    }
    setSelectedEmployeeIds(newSelection);
  };

  const selectAllEmployees = () => {
    const employeeIds = filteredEmployees.map(emp => emp.id);
    setSelectedEmployeeIds(new Set(employeeIds));
  };

  const clearSelection = () => {
    setSelectedEmployeeIds(new Set());
  };


  if (isLoading) {
    return (
      <div className="space-y-6">
        <EmployeeTableSkeleton />
      </div>
    );
  }

  if (!user?.organization) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-dark-text-muted">No organization found. Please complete onboarding first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-dark-border bg-dark-card px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-dark-bg">
              <Users className="h-4 w-4 text-dark-text-muted" />
            </div>
            <div>
              <p className="text-xl font-semibold text-dark-text">{stats.total}</p>
              <p className="text-[11px] text-dark-text-muted">Total Employees</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Check className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-dark-text">{stats.active}</p>
              <p className="text-[11px] text-dark-text-muted">Active</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-semibold text-dark-text">{stats.pending}</p>
              <p className="text-[11px] text-dark-text-muted">Pending Invites</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-dark-border bg-dark-card px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xl font-semibold text-dark-text">{stats.cohortCount}</p>
              <p className="text-[11px] text-dark-text-muted">Cohorts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dark-text-muted" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search employees..."
            className="h-10 w-full rounded-lg border border-dark-border bg-dark-card pl-10 pr-4 text-sm text-dark-text placeholder:text-dark-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={selectedDepartmentFilter}
          onChange={(e) => setSelectedDepartmentFilter(e.target.value)}
          className="h-10 rounded-full border border-dark-border bg-dark-card px-4 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept} value={dept}>{dept}</option>
          ))}
        </select>
        <select
          value={selectedCohortFilter}
          onChange={(e) => setSelectedCohortFilter(e.target.value)}
          className="h-10 rounded-full border border-dark-border bg-dark-card px-4 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Cohorts</option>
          <option value="unassigned">Unassigned</option>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>{cohort.name}</option>
          ))}
        </select>
        <select
          value={selectedStatusFilter}
          onChange={(e) => setSelectedStatusFilter(e.target.value)}
          className="h-10 rounded-full border border-dark-border bg-dark-card px-4 text-sm text-dark-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="inactive">Inactive</option>
        </select>

        {/* Action Buttons */}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => setShowBulkImportModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-4 py-2 text-sm font-medium text-dark-text transition hover:bg-dark-bg"
          >
            <Upload size={16} />
            Import
          </button>
          <button
            onClick={() => setShowCreateCohort(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-dark-border bg-dark-card px-4 py-2 text-sm font-medium text-dark-text transition hover:bg-dark-bg"
          >
            <FolderPlus size={16} />
            Cohort
          </button>
          <button
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary/90"
          >
            <UserPlus size={16} />
            Invite
          </button>
        </div>
      </div>

      {/* Batch Selection Toolbar */}
      {selectedEmployeeIds.size > 0 && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-dark-text">
              {selectedEmployeeIds.size} employee(s) selected
            </span>
            <button
              onClick={clearSelection}
              className="text-sm text-dark-text-muted hover:text-dark-text transition-colors"
            >
              Clear selection
            </button>
          </div>
          <button
            onClick={() => setShowBatchAssignCohort(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary/90"
          >
            Assign to Cohort
          </button>
        </div>
      )}

      {/* Employee Table */}
      <div className="rounded-xl border border-dark-border bg-dark-card">
        {peopleRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-dark-bg">
              <Users className="h-7 w-7 text-dark-text-muted" />
            </div>
            <h3 className="text-sm font-medium text-dark-text">No employees found</h3>
            <p className="mt-1 text-sm text-dark-text-muted">
              {searchTerm ? 'Try adjusting your search or filters' : 'Invite your first team member to get started'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90"
              >
                <UserPlus size={16} />
                Invite Employee
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-dark-border">
            {/* Table Header */}
            <div className="grid grid-cols-[40px_2fr_2fr_1.5fr_1.5fr_100px_100px] gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wide text-dark-text-muted bg-dark-bg">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length}
                  onChange={(e) => e.target.checked ? selectAllEmployees() : clearSelection()}
                  className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-primary checked:border-primary cursor-pointer"
                  title="Select all employees"
                />
              </div>
              <button
                onClick={() => handleSort('name')}
                className="flex items-center gap-1.5 hover:text-dark-text transition text-left"
              >
                Employee
                <SortIcon field="name" />
              </button>
              <button
                onClick={() => handleSort('email')}
                className="flex items-center gap-1.5 hover:text-dark-text transition text-left"
              >
                Email
                <SortIcon field="email" />
              </button>
              <button
                onClick={() => handleSort('department')}
                className="flex items-center gap-1.5 hover:text-dark-text transition text-left"
              >
                Department
                <SortIcon field="department" />
              </button>
              <button
                onClick={() => handleSort('cohort')}
                className="flex items-center gap-1.5 hover:text-dark-text transition text-left"
              >
                Cohort
                <SortIcon field="cohort" />
              </button>
              <button
                onClick={() => handleSort('status')}
                className="flex items-center gap-1.5 hover:text-dark-text transition text-left"
              >
                Status
                <SortIcon field="status" />
              </button>
              <div className="text-right">Actions</div>
            </div>

            {/* Table Rows */}
            {peopleRows.map((row) => {
              const statusStyles = getStatusStyles(row.status);
              const isSelected = row.kind === 'employee' && selectedEmployeeIds.has(row.id);
              return (
                <div
                  key={`${row.kind}-${row.id}`}
                  className="grid grid-cols-[40px_2fr_2fr_1.5fr_1.5fr_100px_100px] gap-4 px-6 py-4 items-center hover:bg-dark-bg/50 transition cursor-pointer group"
                  onClick={() => {
                    if (row.kind === 'employee') {
                      navigate(`/admin/employees/${row.id}`);
                    } else if (row.kind === 'invite' && row.invitation) {
                      openResendModal(row.invitation);
                    }
                  }}
                >
                  {/* Checkbox */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {row.kind === 'employee' ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleEmployeeSelection(row.id)}
                        className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-primary checked:border-primary cursor-pointer"
                      />
                    ) : (
                      <div className="w-4 h-4" />
                    )}
                  </div>

                  {/* Employee */}
                  <div>
                    <p className="text-sm font-medium text-dark-text truncate">{row.name}</p>
                    <p className="text-xs text-dark-text-muted truncate">
                      {row.kind === 'invite' ? 'Pending invite' : row.role}
                    </p>
                  </div>

                  {/* Email */}
                  <div>
                    <div className="flex items-center gap-1.5 text-sm text-dark-text-muted">
                      <Mail className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{row.email}</span>
                    </div>
                  </div>

                  {/* Department */}
                  <div>
                    <span className="text-sm text-dark-text truncate">{row.department}</span>
                  </div>

                  {/* Cohort */}
                  <div>
                    <span className="text-sm text-dark-text truncate">{row.cohortLabel}</span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${statusStyles.bg} ${statusStyles.text}`}>
                      {statusStyles.label}
                    </span>
                  </div>

                  {/* Actions - 3 dots menu */}
                  <div className="flex items-center justify-end relative" ref={openActionsMenu === row.id ? actionsMenuRef : null}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenActionsMenu(openActionsMenu === row.id ? null : row.id);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/5 hover:text-white"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>

                    {/* Dropdown Menu */}
                    {openActionsMenu === row.id && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-dark-card border border-dark-border rounded-xl shadow-xl z-50 py-2 px-1 animate-zoom-in">
                        {row.kind === 'employee' && (
                          <>
                            {/* Show invite actions for employees with pending invitations */}
                            {row.status === 'invited' && row.invitation && (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCopyInviteLink(row.invitation!.token); setOpenActionsMenu(null); }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                                >
                                  <Copy className="h-4 w-4" />
                                  Copy invite link
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openResendModal(row.invitation!); setOpenActionsMenu(null); }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                  Resend invitation
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); openRevokeModal(row.invitation!); setOpenActionsMenu(null); }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-amber-400 hover:bg-amber-500/10 transition"
                                >
                                  <X className="h-4 w-4" />
                                  Revoke invitation
                                </button>
                                <div className="my-1 border-t border-dark-border mx-2" />
                              </>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowAssignCohort(row.employee!.id); setOpenActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                            >
                              <Users className="h-4 w-4" />
                              Assign to cohort
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowDeptModal({ employee: row.employee! }); setOpenActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                            >
                              <Building2 className="h-4 w-4" />
                              Change department
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowRoleModal({ employee: row.employee! }); setOpenActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                            >
                              <Shield className="h-4 w-4" />
                              Change role
                            </button>
                            {/* Only show delete for non-current user */}
                            {row.employee!.id !== user?.id && (
                              <>
                                <div className="my-1 border-t border-dark-border mx-2" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); openDeleteModal(row.employee!); setOpenActionsMenu(null); }}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete employee
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {row.kind === 'invite' && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopyInviteLink(row.invitation!.token); setOpenActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                            >
                              <Copy className="h-4 w-4" />
                              Copy invite link
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); openResendModal(row.invitation!); setOpenActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-white/70 hover:bg-white/5 hover:text-white transition"
                            >
                              <RefreshCw className="h-4 w-4" />
                              Resend invitation
                            </button>
                            <div className="my-1 border-t border-dark-border mx-2" />
                            <button
                              onClick={(e) => { e.stopPropagation(); openRevokeModal(row.invitation!); setOpenActionsMenu(null); }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                              Revoke invitation
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Results count */}
      {peopleRows.length > 0 && (
        <p className="text-sm text-dark-text-muted">
          Showing {peopleRows.length} of {employees.length + invitations.filter(i => i.status === 'pending').length} people
        </p>
      )}

      {/* Invite Modal */}
      <InviteModal
        isOpen={showInviteModal}
        onClose={handleInviteModalClose}
        departments={departments}
        cohorts={cohorts.map(c => ({ id: c.id, name: c.name }))}
      />

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        onSuccess={() => {
          setShowBulkImportModal(false);
          loadData();
        }}
        cohorts={cohorts}
      />

      {/* Create Cohort Panel */}
      <CohortPanel
        isOpen={showCreateCohort}
        onClose={() => setShowCreateCohort(false)}
        onSubmit={handleCreateCohort}
      />

      {/* Assign to Cohort Modal */}
      {showAssignCohort && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">Assign to Cohort</h2>
              <button
                onClick={() => setShowAssignCohort(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <button
                onClick={() => handleAssignToCohort(showAssignCohort, null)}
                className="w-full p-4 border border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left"
              >
                <div className="font-medium text-dark-text">Unassigned</div>
                <div className="text-sm text-dark-text-muted">Remove from all cohorts</div>
              </button>
              {cohorts.map((cohort) => (
                <button
                  key={cohort.id}
                  onClick={() => handleAssignToCohort(showAssignCohort, cohort.id)}
                  className="w-full p-4 border border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left"
                >
                  <div className="font-medium text-dark-text">{cohort.name}</div>
                  {cohort.description && (
                    <div className="text-sm text-dark-text-muted">{cohort.description}</div>
                  )}
                  <div className="text-xs text-dark-text-muted mt-1">
                    {cohort.employeeIds.length} employee{cohort.employeeIds.length !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-4 mt-4 border-t border-dark-border">
              <button
                onClick={() => setShowAssignCohort(null)}
                className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Assign Cohort Modal */}
      {showBatchAssignCohort && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">Batch Assign to Cohort</h2>
              <button
                onClick={() => setShowBatchAssignCohort(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>
            <p className="text-sm text-dark-text-muted mb-4">
              Assign {selectedEmployeeIds.size} employee(s) to a cohort
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              <button
                onClick={() => handleBatchAssignToCohort(null)}
                className="w-full p-4 border border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left"
              >
                <div className="font-medium text-dark-text">Unassigned</div>
                <div className="text-sm text-dark-text-muted">Remove from all cohorts</div>
              </button>
              {cohorts.map((cohort) => (
                <button
                  key={cohort.id}
                  onClick={() => handleBatchAssignToCohort(cohort.id)}
                  className="w-full p-4 border border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left"
                >
                  <div className="font-medium text-dark-text">{cohort.name}</div>
                  {cohort.description && (
                    <div className="text-sm text-dark-text-muted">{cohort.description}</div>
                  )}
                  <div className="text-xs text-dark-text-muted mt-1">
                    {cohort.employeeIds.length} employee{cohort.employeeIds.length !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-4 mt-4 border-t border-dark-border">
              <button
                onClick={() => setShowBatchAssignCohort(false)}
                className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resend Invitation Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.type === 'resend'}
        onClose={closeConfirmModal}
        onConfirm={handleResendInvite}
        title="Resend Invitation"
        message={`This will generate a new invite link and send a fresh email to ${confirmModal.invitation?.email || 'this employee'}. The previous link will no longer work.`}
        confirmText="Resend Invitation"
        confirmVariant="primary"
        isLoading={isProcessing}
        icon={<Send className="h-5 w-5 text-primary" />}
      />

      {/* Revoke Invitation Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.type === 'revoke'}
        onClose={closeConfirmModal}
        onConfirm={handleRevokeInvite}
        title="Revoke Invitation"
        message={`Are you sure you want to revoke the invitation for ${confirmModal.invitation?.email || 'this employee'}? They will no longer be able to join using the invite link. You can send a new invitation later if needed.`}
        confirmText="Revoke Invitation"
        confirmVariant="danger"
        isLoading={isProcessing}
        icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
      />

      {/* Delete Employee Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModal.type === 'delete'}
        onClose={closeConfirmModal}
        onConfirm={handleDeleteEmployeeConfirm}
        title="Delete Employee"
        message={`Are you sure you want to delete ${confirmModal.employee?.name || 'this employee'}? This will remove their profile and cohort assignments. This action cannot be undone.`}
        confirmText="Delete Employee"
        confirmVariant="danger"
        isLoading={isProcessing}
        icon={<AlertTriangle className="h-5 w-5 text-red-400" />}
      />

      {/* Role Change Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-zoom-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">Change Role</h2>
              <button
                onClick={() => setShowRoleModal(null)}
                disabled={isUpdatingRole}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors disabled:opacity-50"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>
            <p className="text-sm text-dark-text-muted mb-4">
              Select a new role for <span className="text-dark-text font-medium">{showRoleModal.employee.name}</span>
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleRoleChange(showRoleModal.employee.id, 'employee')}
                disabled={isUpdatingRole}
                className={`w-full p-4 border rounded-xl transition-colors text-left ${
                  showRoleModal.employee.role === 'employee'
                    ? 'border-primary bg-primary/10'
                    : 'border-dark-border hover:bg-dark-bg'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">Employee</div>
                    <div className="text-sm text-dark-text-muted">Standard access to campaigns and learning content</div>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleRoleChange(showRoleModal.employee.id, 'admin')}
                disabled={isUpdatingRole || showRoleModal.employee.id === user?.id}
                className={`w-full p-4 border rounded-xl transition-colors text-left ${
                  showRoleModal.employee.role === 'admin'
                    ? 'border-primary bg-primary/10'
                    : 'border-dark-border hover:bg-dark-bg'
                } disabled:opacity-50`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="font-medium text-dark-text">Admin</div>
                    <div className="text-sm text-dark-text-muted">Full access to manage employees, campaigns, and settings</div>
                  </div>
                </div>
                {showRoleModal.employee.id === user?.id && (
                  <p className="text-xs text-amber-400 mt-2">You cannot change your own role</p>
                )}
              </button>
            </div>
            <div className="pt-4 mt-4 border-t border-dark-border">
              <button
                onClick={() => setShowRoleModal(null)}
                disabled={isUpdatingRole}
                className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department Change Modal */}
      {showDeptModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-dark-card border border-dark-border rounded-2xl p-6 w-full max-w-md shadow-2xl animate-zoom-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-dark-text">
                {isCreatingDept ? 'Create New Department' : 'Change Department'}
              </h2>
              <button
                onClick={() => { setShowDeptModal(null); setIsCreatingDept(false); setNewDepartment(''); }}
                disabled={isUpdatingDept}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-dark-bg transition-colors disabled:opacity-50"
              >
                <X size={18} className="text-dark-text-muted" />
              </button>
            </div>

            {isCreatingDept ? (
              <>
                <p className="text-sm text-dark-text-muted mb-4">
                  Create a new department and assign {showDeptModal.employee.name} to it:
                </p>
                <input
                  type="text"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  placeholder="Department name"
                  className="w-full h-10 rounded-xl border border-dark-border bg-dark-bg px-4 text-sm text-dark-text placeholder-dark-text-muted focus:border-primary focus:outline-none mb-4"
                  autoFocus
                />
                <div className="flex gap-3 pt-4 border-t border-dark-border">
                  <button
                    onClick={() => { setIsCreatingDept(false); setNewDepartment(''); }}
                    disabled={isUpdatingDept}
                    className="flex-1 h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => handleDeptChange(showDeptModal.employee.id, newDepartment.trim())}
                    disabled={!newDepartment.trim() || isUpdatingDept}
                    className="flex-1 h-10 rounded-lg bg-primary text-white text-sm font-medium transition hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isUpdatingDept ? 'Saving...' : 'Create & Assign'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-dark-text-muted mb-4">
                  Select a department for <span className="text-dark-text font-medium">{showDeptModal.employee.name}</span>
                </p>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {/* Create New Option */}
                  <button
                    onClick={() => { setIsCreatingDept(true); setNewDepartment(''); }}
                    className="w-full p-4 border border-dashed border-dark-border rounded-xl hover:bg-dark-bg transition-colors text-left flex items-center gap-3"
                  >
                    <Plus size={16} className="text-dark-text-muted" />
                    <div className="font-medium text-dark-text">Create new department</div>
                  </button>

                  {/* No Department Option */}
                  <button
                    onClick={() => handleDeptChange(showDeptModal.employee.id, null)}
                    disabled={isUpdatingDept}
                    className={`w-full p-4 border rounded-xl transition-colors text-left ${
                      !showDeptModal.employee.department
                        ? 'border-primary bg-primary/10'
                        : 'border-dark-border hover:bg-dark-bg'
                    } disabled:opacity-50`}
                  >
                    <div className="font-medium text-dark-text">Unassigned</div>
                    <div className="text-sm text-dark-text-muted">Remove from department</div>
                  </button>

                  {/* Existing Departments */}
                  {departments.map((dept) => (
                    <button
                      key={dept}
                      onClick={() => handleDeptChange(showDeptModal.employee.id, dept)}
                      disabled={isUpdatingDept}
                      className={`w-full p-4 border rounded-xl transition-colors text-left ${
                        showDeptModal.employee.department === dept
                          ? 'border-primary bg-primary/10'
                          : 'border-dark-border hover:bg-dark-bg'
                      } disabled:opacity-50`}
                    >
                      <div className="font-medium text-dark-text">{dept}</div>
                    </button>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t border-dark-border">
                  <button
                    onClick={() => setShowDeptModal(null)}
                    disabled={isUpdatingDept}
                    className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg text-sm font-medium text-dark-text transition hover:bg-dark-card disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Action Floating Bar */}
      {selectedEmployeeIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-dark-border bg-dark-card px-5 py-3 shadow-2xl animate-zoom-in">
          <div className="flex items-center gap-2.5 border-r border-dark-border pr-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {selectedEmployeeIds.size}
            </span>
            <span className="text-sm font-medium text-dark-text">selected</span>
          </div>

          <button
            onClick={() => {
              // Open bulk cohort assign - for now use single select modal with first selected
              const firstId = Array.from(selectedEmployeeIds)[0];
              setShowAssignCohort(firstId);
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
          >
            <Users className="h-4 w-4" />
            Assign Cohort
          </button>

          <button
            onClick={() => {
              const firstId = Array.from(selectedEmployeeIds)[0];
              const emp = employees.find(e => e.id === firstId);
              if (emp) setShowDeptModal({ employee: emp });
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
          >
            <Building2 className="h-4 w-4" />
            Department
          </button>

          <button
            onClick={() => {
              const firstId = Array.from(selectedEmployeeIds)[0];
              const emp = employees.find(e => e.id === firstId);
              if (emp) setShowRoleModal({ employee: emp });
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition"
          >
            <Shield className="h-4 w-4" />
            Role
          </button>

          <div className="h-5 w-px bg-dark-border" />

          <button
            onClick={() => {
              // Only delete if none of the selected is the current user
              const ids = Array.from(selectedEmployeeIds);
              if (ids.includes(user?.id || '')) {
                alert('You cannot delete yourself');
                return;
              }
              const firstId = ids[0];
              const emp = employees.find(e => e.id === firstId);
              if (emp) openDeleteModal(emp);
            }}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>

          <button
            onClick={() => setSelectedEmployeeIds(new Set())}
            className="ml-1 rounded-lg p-1.5 text-white/40 hover:bg-white/5 hover:text-white/70 transition"
            title="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
