import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Mail,
  Building2,
  Calendar,
  Clock,
  Users,
  Edit2,
  Trash2,
  UserCircle,
} from 'lucide-react';
import { Employee, Cohort } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUsersByOrganization,
  getCohortsByOrganization,
  deleteUserProfile,
  addEmployeeToCohort,
  removeEmployeeFromCohort,
  updateUserCohorts,
} from '@/lib/firebase';

const EmployeeDetail: React.FC = () => {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [employeeCohorts, setEmployeeCohorts] = useState<Cohort[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignCohort, setShowAssignCohort] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');

  useEffect(() => {
    const loadData = async () => {
      if (!user?.organization || !employeeId) return;

      try {
        setIsLoading(true);
        const [employees, loadedCohorts] = await Promise.all([
          getUsersByOrganization(user.organization),
          getCohortsByOrganization(user.organization),
        ]);

        const foundEmployee = employees.find((e) => e.id === employeeId);
        setEmployee(foundEmployee || null);
        setCohorts(loadedCohorts);

        if (foundEmployee?.cohortIds) {
          const empCohorts = loadedCohorts.filter((c) =>
            foundEmployee.cohortIds?.includes(c.id)
          );
          setEmployeeCohorts(empCohorts);
        }
      } catch (error) {
        console.error('Failed to load employee data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.organization, employeeId]);

  const handleDeleteEmployee = async () => {
    if (!employee) return;
    if (!window.confirm(`Are you sure you want to delete ${employee.name}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Remove from all cohorts first
      for (const cohort of employeeCohorts) {
        await removeEmployeeFromCohort(cohort.id, employee.id);
      }
      await deleteUserProfile(employee.id);
      navigate('/admin/employees');
    } catch (error) {
      console.error('Failed to delete employee:', error);
      alert('Failed to delete employee. Please try again.');
    }
  };

  const handleAssignCohort = async () => {
    if (!employee || !selectedCohortId) return;

    try {
      // Remove from current cohorts
      for (const cohort of employeeCohorts) {
        await removeEmployeeFromCohort(cohort.id, employee.id);
      }

      // Add to new cohort if selected
      const newCohortIds: string[] = [];
      if (selectedCohortId !== 'none') {
        await addEmployeeToCohort(selectedCohortId, employee.id);
        newCohortIds.push(selectedCohortId);
      }

      await updateUserCohorts(employee.id, newCohortIds);

      // Update local state
      const newCohorts = cohorts.filter((c) => newCohortIds.includes(c.id));
      setEmployeeCohorts(newCohorts);
      setEmployee({ ...employee, cohortIds: newCohortIds.length > 0 ? newCohortIds : undefined });
      setShowAssignCohort(false);
      setSelectedCohortId('');
    } catch (error) {
      console.error('Failed to assign cohort:', error);
      alert('Failed to assign cohort. Please try again.');
    }
  };

  const formatDate = (date: Date | string | number | undefined) => {
    if (!date) return 'N/A';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate('/admin/employees')}
          className="flex items-center gap-2 text-sm text-dark-text-muted hover:text-dark-text transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Employees
        </button>
        <div className="card p-12 text-center">
          <UserCircle className="h-16 w-16 text-dark-text-muted mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold text-dark-text mb-2">Employee Not Found</h2>
          <p className="text-dark-text-muted">The employee you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/admin/employees')}
        className="flex items-center gap-2 text-sm text-dark-text-muted hover:text-dark-text transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employees
      </button>

      {/* Header Card */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 text-2xl font-bold text-primary">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-dark-text">{employee.name}</h1>
              <div className="flex items-center gap-4 mt-1">
                <div className="flex items-center gap-1.5 text-sm text-dark-text-muted">
                  <Mail className="h-4 w-4" />
                  {employee.email}
                </div>
                {employee.department && (
                  <div className="flex items-center gap-1.5 text-sm text-dark-text-muted">
                    <Building2 className="h-4 w-4" />
                    {employee.department}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                employee.status === 'active'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-dark-text-muted/10 text-dark-text-muted'
              }`}
            >
              {employee.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <button
              onClick={handleDeleteEmployee}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 text-red-400 transition hover:bg-red-500/10"
              title="Delete employee"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details Card */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-dark-text mb-4">Employee Details</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-2 border-b border-dark-border">
              <span className="text-sm text-dark-text-muted">Role</span>
              <span className="text-sm font-medium text-dark-text capitalize">{employee.role}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-border">
              <span className="text-sm text-dark-text-muted">Department</span>
              <span className="text-sm font-medium text-dark-text">{employee.department || 'Not assigned'}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-border">
              <span className="text-sm text-dark-text-muted">Gender</span>
              <span className="text-sm font-medium text-dark-text capitalize">
                {employee.gender?.replace('-', ' ') || 'Not specified'}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-dark-border">
              <span className="text-sm text-dark-text-muted">Date of Birth</span>
              <span className="text-sm font-medium text-dark-text">{formatDate(employee.dateOfBirth)}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-dark-text-muted">Member Since</span>
              <span className="text-sm font-medium text-dark-text">{formatDate(employee.createdAt)}</span>
            </div>
          </div>
        </div>

        {/* Cohort Card */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-dark-text">Cohort Assignment</h2>
            <button
              onClick={() => {
                setSelectedCohortId(employeeCohorts[0]?.id || 'none');
                setShowAssignCohort(true);
              }}
              className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </button>
          </div>

          {showAssignCohort ? (
            <div className="space-y-4">
              <select
                value={selectedCohortId}
                onChange={(e) => setSelectedCohortId(e.target.value)}
                className="w-full h-10 rounded-lg border border-dark-border bg-dark-bg px-3 text-sm text-dark-text focus:border-primary focus:outline-none"
              >
                <option value="none">No cohort</option>
                {cohorts.map((cohort) => (
                  <option key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAssignCohort}
                  className="btn-primary text-sm"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAssignCohort(false)}
                  className="btn-secondary text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : employeeCohorts.length > 0 ? (
            <div className="space-y-3">
              {employeeCohorts.map((cohort) => (
                <div
                  key={cohort.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-dark-bg"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-dark-text">{cohort.name}</p>
                    {cohort.description && (
                      <p className="text-xs text-dark-text-muted">{cohort.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-dark-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-sm text-dark-text-muted">Not assigned to any cohort</p>
              <button
                onClick={() => {
                  setSelectedCohortId('');
                  setShowAssignCohort(true);
                }}
                className="mt-3 text-sm text-primary hover:text-primary/80 transition"
              >
                Assign to cohort
              </button>
            </div>
          )}
        </div>

        {/* Activity Card */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold text-dark-text mb-4">Activity</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg bg-dark-bg">
              <div className="flex items-center gap-2 text-dark-text-muted mb-2">
                <Calendar className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Joined</span>
              </div>
              <p className="text-lg font-semibold text-dark-text">{formatDate(employee.createdAt)}</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-bg">
              <div className="flex items-center gap-2 text-dark-text-muted mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Last Login</span>
              </div>
              <p className="text-lg font-semibold text-dark-text">
                {employee.lastLogin ? formatDate(employee.lastLogin) : 'Never'}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-dark-bg">
              <div className="flex items-center gap-2 text-dark-text-muted mb-2">
                <Users className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Cohorts</span>
              </div>
              <p className="text-lg font-semibold text-dark-text">{employeeCohorts.length}</p>
            </div>
            <div className="p-4 rounded-lg bg-dark-bg">
              <div className="flex items-center gap-2 text-dark-text-muted mb-2">
                <Building2 className="h-4 w-4" />
                <span className="text-xs uppercase tracking-wide">Department</span>
              </div>
              <p className="text-lg font-semibold text-dark-text">{employee.department || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetail;

