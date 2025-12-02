import React, { useState, useEffect, useMemo } from 'react';
import { UserPlus, FolderPlus, Search, Edit2, Trash2, X, Check, Copy, RefreshCw, Upload } from 'lucide-react';
import { Employee, Cohort, Invitation } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUsersByOrganization,
  getCohortsByOrganization,
  createCohort,
  // deleteCohort, // TODO: Uncomment when delete cohort UI is implemented
  addEmployeeToCohort,
  removeEmployeeFromCohort,
  updateUserCohorts,
  getOrganization,
  deleteUserProfile,
  getOrganizationInvitations,
  revokeInvitation,
  resendInvitation,
} from '@/lib/firestore';
import InviteModal from '@/components/InviteModal';
import BulkImportModal from '@/components/BulkImportModal';

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
};

const EmployeeManagement: React.FC = () => {
  const { user } = useAuth();

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
  const [groupBy, setGroupBy] = useState<'none' | 'department' | 'cohort' | 'status'>('none');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  const [newCohort, setNewCohort] = useState({
    name: '',
    description: '',
  });

  // Load data function
  const loadData = async () => {
    if (!user?.organization) {
      console.warn('[EmployeeManagement] No organization set for user');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Load organization to get departments
      const org = await getOrganization(user.organization);
      if (org) {
        setDepartments(org.departments);
      }

      // Load employees, cohorts, and invitations in parallel
      const [loadedEmployees, loadedCohorts, loadedInvitations] = await Promise.all([
        getUsersByOrganization(user.organization),
        getCohortsByOrganization(user.organization),
        getOrganizationInvitations(user.organization),
      ]);

      setEmployees(loadedEmployees);
      // Map cohorts to convert null to undefined for type compatibility
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

  // Load data on mount
  useEffect(() => {
    loadData();
  }, [user?.organization]);

  const searchValue = searchTerm.toLowerCase();

  // Helper function to get cohort names
  const getCohortNames = (cohortIds?: string[]) => {
    if (!cohortIds || cohortIds.length === 0) return 'Unassigned';
    const names = cohortIds
      .map((id) => cohorts.find((c) => c.id === id)?.name)
      .filter(Boolean);
    return names.length > 0 ? names.join(', ') : 'Unknown';
  };

  // Filter employees
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

    return matchesSearch && matchesCohort;
  });

  const peopleRows = useMemo<PeopleRow[]>(() => {
    const pendingInvitations = invitations.filter((inv) => inv.status === 'pending');

    const filteredInvitations = pendingInvitations.filter((invitation) => {
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

      return matchesSearch && matchesCohort;
    });

    return [
      ...filteredEmployees.map((employee) => ({
        kind: 'employee' as const,
        id: employee.id,
        name: employee.name,
        email: employee.email,
        role: 'Employee',
        department: employee.department || '—',
        cohortLabel: getCohortNames(employee.cohortIds),
        status: employee.status,
        employee,
      })),
      ...filteredInvitations.map((invitation) => {
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
        };
      }),
    ];
  }, [filteredEmployees, invitations, searchValue, selectedCohortFilter, cohorts]);

  const statusTokens: Record<PeopleRow['status'], { label: string; className: string }> = {
    active: { label: 'Active', className: 'border-dark-border/70 bg-dark-bg/60 text-dark-text' },
    inactive: { label: 'Inactive', className: 'border-dark-border/70 bg-dark-bg/60 text-dark-text' },
    invited: { label: 'Invited', className: 'border-dark-border/70 bg-dark-bg/60 text-dark-text' },
    expired: { label: 'Expired', className: 'border-dark-border/70 bg-dark-bg/60 text-dark-text' },
  };

  const handleInviteModalClose = async () => {
    setShowInviteModal(false);
    // Reload invitations to show the newly created one
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

  const handleResendInvite = async (invitationId: string) => {
    if (!window.confirm('Resend this invitation? This will generate a new invite link.')) {
      return;
    }

    try {
      await resendInvitation(invitationId);
      // Reload invitations
      if (user?.organization) {
        const loadedInvitations = await getOrganizationInvitations(user.organization);
        setInvitations(loadedInvitations);
      }
      alert('Invitation resent successfully!');
    } catch (error) {
      console.error('[EmployeeManagement] Failed to resend invitation:', error);
      alert('Failed to resend invitation. Please try again.');
    }
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!window.confirm('Revoke this invitation? The invite link will no longer work.')) {
      return;
    }

    try {
      await revokeInvitation(invitationId);
      // Remove from local state
      setInvitations(invitations.filter(inv => inv.id !== invitationId));
      alert('Invitation revoked successfully!');
    } catch (error) {
      console.error('[EmployeeManagement] Failed to revoke invitation:', error);
      alert('Failed to revoke invitation. Please try again.');
    }
  };

  const handleCreateCohort = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.organization) {
      console.error('[EmployeeManagement] Cannot create cohort without organization');
      return;
    }

    try {
      const cohortId = await createCohort(
        newCohort.name,
        newCohort.description || undefined,
        [],
        user.organization
      );

      // Add to local state
      const newCohortData: Cohort = {
        id: cohortId,
        name: newCohort.name,
        description: newCohort.description || undefined,
        employeeIds: [],
        organization: user.organization,
        createdAt: new Date(),
      };

      setCohorts([...cohorts, newCohortData]);
      setNewCohort({ name: '', description: '' });
      setShowCreateCohort(false);
    } catch (error) {
      console.error('[EmployeeManagement] Failed to create cohort:', error);
      alert('Failed to create cohort. Please try again.');
    }
  };

  const handleAssignToCohort = async (employeeId: string, cohortId: string | null) => {
    try {
      const employee = employees.find(emp => emp.id === employeeId);
      if (!employee) {
        alert('Employee not found');
        return;
      }

      // Get cohort name for confirmation message
      const cohortName = cohortId
        ? cohorts.find(c => c.id === cohortId)?.name || 'Unknown Cohort'
        : 'Unassigned';

      // Confirmation dialog
      const confirmMessage = cohortId
        ? `Assign ${employee.name} to "${cohortName}"?`
        : `Remove ${employee.name} from all cohorts?`;

      if (!window.confirm(confirmMessage)) {
        return;
      }

      const oldCohortIds = employee.cohortIds || [];

      // 1. Remove employee from all old cohorts
      await Promise.all(
        oldCohortIds.map(oldCohortId => removeEmployeeFromCohort(oldCohortId, employeeId))
      );

      // 2. Add employee to new cohort (if not null)
      let newCohortIds: string[] = [];
      if (cohortId) {
        await addEmployeeToCohort(cohortId, employeeId);
        newCohortIds = [cohortId];
      }

      // 3. Update user's cohortIds field
      await updateUserCohorts(employeeId, newCohortIds);

      // 4. Update local state for immediate UI feedback
      setEmployees(
        employees.map((emp) =>
          emp.id === employeeId ? { ...emp, cohortIds: newCohortIds.length > 0 ? newCohortIds : undefined } : emp
        )
      );

      // Update cohort employee lists in local state
      setCohorts(
        cohorts.map((cohort) => {
          if (cohortId && cohort.id === cohortId) {
            // Add to new cohort
            return {
              ...cohort,
              employeeIds: [...cohort.employeeIds.filter(id => id !== employeeId), employeeId],
            };
          }
          // Remove from all other cohorts
          return {
            ...cohort,
            employeeIds: cohort.employeeIds.filter((id) => id !== employeeId),
          };
        })
      );

      setShowAssignCohort(null);
      console.log('✅ Employee assigned to cohort:', { employeeId, cohortId });
    } catch (error) {
      console.error('❌ Failed to assign employee to cohort:', error);
      alert('Failed to assign employee to cohort. Please try again.');
    }
  };

  // Batch assignment handler
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
      // Process each employee
      for (const employee of selectedEmployees) {
        const oldCohortIds = employee.cohortIds || [];

        // Remove from old cohorts
        await Promise.all(
          oldCohortIds.map(oldCohortId => removeEmployeeFromCohort(oldCohortId, employee.id))
        );

        // Add to new cohort (if not null)
        let newCohortIds: string[] = [];
        if (cohortId) {
          await addEmployeeToCohort(cohortId, employee.id);
          newCohortIds = [cohortId];
        }

        // Update user's cohortIds field
        await updateUserCohorts(employee.id, newCohortIds);
      }

      // Update local state
      const selectedIds = new Set(selectedEmployees.map(e => e.id));
      setEmployees(
        employees.map((emp) => {
          if (selectedIds.has(emp.id)) {
            return { ...emp, cohortIds: cohortId ? [cohortId] : undefined };
          }
          return emp;
        })
      );

      // Update cohort employee lists in local state
      setCohorts(
        cohorts.map((cohort) => {
          if (cohortId && cohort.id === cohortId) {
            // Add all selected employees to new cohort
            const newEmployeeIds = [...cohort.employeeIds];
            selectedEmployees.forEach(emp => {
              if (!newEmployeeIds.includes(emp.id)) {
                newEmployeeIds.push(emp.id);
              }
            });
            return { ...cohort, employeeIds: newEmployeeIds };
          }
          // Remove all selected employees from other cohorts
          return {
            ...cohort,
            employeeIds: cohort.employeeIds.filter((id) => !selectedIds.has(id)),
          };
        })
      );

      setShowBatchAssignCohort(false);
      setSelectedEmployeeIds(new Set());
      console.log(`✅ Batch assigned ${selectedEmployees.length} employees to cohort:`, cohortId);
    } catch (error) {
      console.error('❌ Failed to batch assign employees to cohort:', error);
      alert('Failed to batch assign employees. Please try again.');
    }
  };

  // Selection helpers
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


  const handleDeleteEmployee = async (employeeId: string) => {
    if (!window.confirm('Are you sure you want to delete this employee? This will remove their profile but not their Firebase Auth account.')) {
      return;
    }

    try {
      // Remove employee from all cohorts first
      const employeeCohorts = cohorts.filter(c => c.employeeIds.includes(employeeId));
      await Promise.all(
        employeeCohorts.map(cohort => removeEmployeeFromCohort(cohort.id, employeeId))
      );

      // Delete user profile
      await deleteUserProfile(employeeId);

      // Update local state
      setEmployees(employees.filter((emp) => emp.id !== employeeId));
      setCohorts(
        cohorts.map((cohort) => ({
          ...cohort,
          employeeIds: cohort.employeeIds.filter((id) => id !== employeeId),
        }))
      );

      console.log('[EmployeeManagement] Employee deleted:', employeeId);
    } catch (error) {
      console.error('[EmployeeManagement] Failed to delete employee:', error);
      alert('Failed to delete employee. Please try again.');
    }
  };

  // TODO: Implement delete cohort UI before enabling this function
  // const handleDeleteCohort = async (cohortId: string) => {
  //   if (!window.confirm('Are you sure you want to delete this cohort? Employees will be unassigned.')) {
  //     return;
  //   }

  //   try {
  //     await deleteCohort(cohortId);

  //     // Update local state
  //     setCohorts(cohorts.filter((cohort) => cohort.id !== cohortId));
  //     setEmployees(
  //       employees.map((emp) =>
  //         emp.cohortIds?.includes(cohortId)
  //           ? { ...emp, cohortIds: emp.cohortIds.filter((id) => id !== cohortId) }
  //           : emp
  //       )
  //     );

  //     console.log('[EmployeeManagement] Cohort deleted:', cohortId);
  //   } catch (error) {
  //     console.error('[EmployeeManagement] Failed to delete cohort:', error);
  //     alert('Failed to delete cohort. Please try again.');
  //   }
  // };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-dark-text-muted">Loading employee data...</div>
      </div>
    );
  }

  if (!user?.organization) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-dark-text-muted">No organization found. Please complete onboarding first.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-dark-border/70 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="text-[11px] uppercase tracking-[0.4em] text-dark-text-muted">People Operations</p>
            <h1 className="mt-3 text-4xl font-semibold">Employee Management</h1>
            <p className="mt-2 max-w-2xl text-sm text-dark-text-muted">
              Create and manage employee accounts, cohorts, and invitations in a single workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-6 text-base text-dark-text-muted">
              <div>
                <span className="text-dark-text font-semibold text-xl">{employees.length}</span> employees
              </div>
              <div>
                <span className="text-dark-text font-semibold text-xl">{cohorts.length}</span> cohorts
              </div>
              <div>
                <span className="text-dark-text font-semibold text-xl">
                  {invitations.filter((inv) => inv.status === 'pending').length}
                </span>{' '}
                pending invites
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setShowBulkImportModal(true)}
              className="btn-secondary flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-[0.2em]"
            >
              <Upload size={18} />
              Import CSV
            </button>
            <button
              onClick={() => setShowCreateCohort(true)}
              className="btn-secondary flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-[0.2em]"
            >
              <FolderPlus size={18} />
              New Cohort
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-2 px-6 py-3 text-sm uppercase tracking-[0.2em]"
            >
              <UserPlus size={18} />
              Invite Employee
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold">People</h2>
            <p className="text-sm text-dark-text-muted">Employees and pending invitations</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-3 py-2 text-sm">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'none' | 'department' | 'cohort' | 'status')}
                className="w-full bg-transparent text-dark-text focus:outline-none"
              >
                <option value="none">No Grouping</option>
                <option value="department">Group by Department</option>
                <option value="cohort">Group by Cohort</option>
                <option value="status">Group by Status</option>
              </select>
            </div>
            <div className="rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-3 py-2 text-sm">
              <select
                value={selectedCohortFilter}
                onChange={(e) => setSelectedCohortFilter(e.target.value)}
                className="w-full bg-transparent text-dark-text focus:outline-none"
              >
                <option value="all">All Cohorts</option>
                <option value="unassigned">Unassigned</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center rounded-2xl border border-dark-border/70 bg-dark-bg/60 px-3 py-2">
              <Search size={16} className="text-dark-text-muted" />
              <input
                type="text"
                placeholder="Search people..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 bg-transparent pl-3 text-sm text-dark-text focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Batch Selection Toolbar */}
        {selectedEmployeeIds.size > 0 && (
          <div className="flex items-center justify-between gap-4 mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
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
            <div className="flex gap-2">
              <button
                onClick={() => setShowBatchAssignCohort(true)}
                className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
              >
                Assign to Cohort
              </button>
            </div>
          </div>
        )}

        <div className="hidden lg:grid lg:grid-cols-[40px_1.5fr_1.5fr_0.8fr_1fr_1fr_1.2fr] gap-4 text-xs uppercase tracking-[0.3em] text-dark-text-muted px-2 pb-3">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={filteredEmployees.length > 0 && selectedEmployeeIds.size === filteredEmployees.length}
              onChange={(e) => e.target.checked ? selectAllEmployees() : clearSelection()}
              className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
              title="Select all employees"
            />
          </div> {/* Checkbox column */}
          <span>Employee</span>

          <span>Email</span>
          <span>Role</span>
          <span>Department</span>
          <span>Cohort</span>
          <span className="text-right">Status</span>
        </div>

        <div>
          {peopleRows.length === 0 ? (
            <div className="text-center py-10 text-dark-text-muted">
              No people found
            </div>
          ) : groupBy === 'none' ? (
            peopleRows.map((row, index) => {
              const status = statusTokens[row.status];
              const isSelected = row.kind === 'employee' && selectedEmployeeIds.has(row.id);
              return (
                <div
                  key={`${row.kind}-${row.id}`}
                  className={`p-4 transition-colors ${index % 2 === 0 ? 'bg-white/5' : 'bg-white/[0.02]'
                    } hover:bg-white/10`}
                >
                  <div className="grid grid-cols-[40px_1.5fr_1.5fr_0.8fr_1fr_1fr_1.2fr] gap-4 items-center">
                    {/* Checkbox column */}
                    <div className="flex items-center justify-center">
                      {row.kind === 'employee' ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleEmployeeSelection(row.id)}
                          className="w-4 h-4 rounded border-dark-border bg-dark-bg checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
                        />
                      ) : (
                        <>
                          {/* Spacer for invitations */}
                          <div className="w-4 h-4" />
                        </>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-dark-text">{row.name}</p>
                      <p className="text-xs text-dark-text-muted">
                        {row.kind === 'invite' ? 'Pending invite' : 'Directory'}
                      </p>
                    </div>
                    <div className="text-sm text-dark-text break-all">{row.email}</div>
                    <div className="text-sm text-dark-text capitalize">{row.role}</div>
                    <div className="text-sm text-dark-text">{row.department}</div>
                    <div className="text-sm text-dark-text">{row.cohortLabel}</div>
                    <div className="flex items-center gap-2 justify-end">
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                      {row.kind === 'employee' ? (
                        <>
                          <button
                            onClick={() => setShowAssignCohort(row.employee!.id)}
                            className="p-2 rounded-lg hover:bg-dark-bg transition-colors"
                            title="Assign to cohort"
                          >
                            <Edit2 size={16} className="text-dark-text-muted" />
                          </button>
                          <button
                            onClick={() => handleDeleteEmployee(row.employee!.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Delete employee"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCopyInviteLink(row.invitation!.token)}
                            className="p-2 rounded-lg hover:bg-dark-bg transition-colors"
                            title="Copy invite link"
                          >
                            <Copy size={16} className="text-dark-text-muted" />
                          </button>
                          <button
                            onClick={() => handleResendInvite(row.invitation!.id)}
                            className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                            title="Resend invitation"
                          >
                            <RefreshCw size={16} className="text-blue-400" />
                          </button>
                          <button
                            onClick={() => handleRevokeInvite(row.invitation!.id)}
                            className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                            title="Revoke invitation"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            (() => {
              // Group rows based on selected grouping
              const grouped = peopleRows.reduce((acc, row) => {
                let key: string;
                if (groupBy === 'department') {
                  key = row.department || 'Unassigned';
                } else if (groupBy === 'cohort') {
                  key = row.cohortLabel;
                } else if (groupBy === 'status') {
                  key = statusTokens[row.status].label;
                } else {
                  key = 'All';
                }

                if (!acc[key]) {
                  acc[key] = [];
                }
                acc[key].push(row);
                return acc;
              }, {} as Record<string, PeopleRow[]>);

              return Object.entries(grouped).map(([groupName, groupRows]) => (
                <div key={groupName} className="mb-6">
                  <div className="px-2 py-3 bg-dark-bg/40">
                    <h3 className="font-semibold text-dark-text">
                      {groupName} <span className="text-sm text-dark-text-muted">({groupRows.length})</span>
                    </h3>
                  </div>
                  {groupRows.map((row, index) => {
                    const status = statusTokens[row.status];
                    return (
                      <div
                        key={`${row.kind}-${row.id}`}
                        className={`p-4 transition-colors ${index % 2 === 0 ? 'bg-white/5' : 'bg-white/[0.02]'
                          } hover:bg-white/10`}
                      >
                        <div className="grid grid-cols-[1.5fr_1.5fr_0.8fr_1fr_1fr_1.2fr] gap-4 items-center">
                          <div>
                            <p className="font-medium text-dark-text">{row.name}</p>
                            <p className="text-xs text-dark-text-muted">
                              {row.kind === 'invite' ? 'Pending invite' : 'Directory'}
                            </p>
                          </div>
                          <div className="text-sm text-dark-text break-all">{row.email}</div>
                          <div className="text-sm text-dark-text capitalize">{row.role}</div>
                          <div className="text-sm text-dark-text">{row.department}</div>
                          <div className="text-sm text-dark-text">{row.cohortLabel}</div>
                          <div className="flex items-center gap-2 justify-end">
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${status.className}`}>
                              {status.label}
                            </span>
                            {row.kind === 'employee' ? (
                              <>
                                <button
                                  onClick={() => setShowAssignCohort(row.employee!.id)}
                                  className="p-2 rounded-lg hover:bg-dark-bg transition-colors"
                                  title="Assign to cohort"
                                >
                                  <Edit2 size={16} className="text-dark-text-muted" />
                                </button>
                                <button
                                  onClick={() => handleDeleteEmployee(row.employee!.id)}
                                  className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                  title="Delete employee"
                                >
                                  <Trash2 size={16} className="text-red-500" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleCopyInviteLink(row.invitation!.token)}
                                  className="p-2 rounded-lg hover:bg-dark-bg transition-colors"
                                  title="Copy invite link"
                                >
                                  <Copy size={16} className="text-dark-text-muted" />
                                </button>
                                <button
                                  onClick={() => handleResendInvite(row.invitation!.id)}
                                  className="p-2 rounded-lg hover:bg-blue-500/10 transition-colors"
                                  title="Resend invitation"
                                >
                                  <RefreshCw size={16} className="text-blue-400" />
                                </button>
                                <button
                                  onClick={() => handleRevokeInvite(row.invitation!.id)}
                                  className="p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                                  title="Revoke invitation"
                                >
                                  <Trash2 size={16} className="text-red-500" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>
      </div>

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
          loadData(); // Reload data to show new invitations
        }}
        cohorts={cohorts}
      />

      {/* Create Cohort Modal */}
      {showCreateCohort && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create Cohort</h2>
              <button
                onClick={() => setShowCreateCohort(false)}
                className="p-1 hover:bg-dark-bg rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateCohort} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Cohort Name *
                </label>
                <input
                  type="text"
                  required
                  className="input w-full"
                  value={newCohort.name}
                  onChange={(e) => setNewCohort({ ...newCohort, name: e.target.value })}
                  placeholder="e.g., Q1 2024 Leadership Program"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-text mb-2">
                  Description (optional)
                </label>
                <textarea
                  className="input w-full min-h-[100px] resize-none"
                  value={newCohort.description}
                  onChange={(e) => setNewCohort({ ...newCohort, description: e.target.value })}
                  placeholder="Describe the purpose of this cohort..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateCohort(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <Check size={18} />
                  Create Cohort
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign to Cohort Modal */}
      {showAssignCohort && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Assign to Cohort</h2>
              <button
                onClick={() => setShowAssignCohort(null)}
                className="p-1 hover:bg-dark-bg rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleAssignToCohort(showAssignCohort, null)}
                className="w-full p-4 border border-dark-border rounded-lg hover:bg-dark-bg transition-colors text-left"
              >
                <div className="font-medium">Unassigned</div>
                <div className="text-sm text-dark-text-muted">Remove from all cohorts</div>
              </button>
              {cohorts.map((cohort) => (
                <button
                  key={cohort.id}
                  onClick={() => handleAssignToCohort(showAssignCohort, cohort.id)}
                  className="w-full p-4 border border-dark-border rounded-lg hover:bg-dark-bg transition-colors text-left"
                >
                  <div className="font-medium">{cohort.name}</div>
                  {cohort.description && (
                    <div className="text-sm text-dark-text-muted">{cohort.description}</div>
                  )}
                  <div className="text-xs text-dark-text-muted mt-1">
                    {cohort.employeeIds.length} employee{cohort.employeeIds.length !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-4">
              <button
                onClick={() => setShowAssignCohort(null)}
                className="w-full btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Assign Cohort Modal */}
      {showBatchAssignCohort && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Batch Assign to Cohort</h2>
              <button
                onClick={() => setShowBatchAssignCohort(false)}
                className="p-1 hover:bg-dark-bg rounded transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-sm text-dark-text-muted mb-4">
              Assign {selectedEmployeeIds.size} employee(s) to a cohort
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleBatchAssignToCohort(null)}
                className="w-full p-4 border border-dark-border rounded-lg hover:bg-dark-bg transition-colors text-left"
              >
                <div className="font-medium">Unassigned</div>
                <div className="text-sm text-dark-text-muted">Remove from all cohorts</div>
              </button>
              {cohorts.map((cohort) => (
                <button
                  key={cohort.id}
                  onClick={() => handleBatchAssignToCohort(cohort.id)}
                  className="w-full p-4 border border-dark-border rounded-lg hover:bg-dark-bg transition-colors text-left"
                >
                  <div className="font-medium">{cohort.name}</div>
                  {cohort.description && (
                    <div className="text-sm text-dark-text-muted">{cohort.description}</div>
                  )}
                  <div className="text-xs text-dark-text-muted mt-1">
                    {cohort.employeeIds.length} employee{cohort.employeeIds.length !== 1 ? 's' : ''}
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-4">
              <button
                onClick={() => setShowBatchAssignCohort(false)}
                className="w-full btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;

