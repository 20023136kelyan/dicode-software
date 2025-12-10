'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Users,
  Calendar,
  MapPin,
  Briefcase,
  Crown,
  Clock,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  X,
  Edit2,
  LayoutGrid,
  Trash2,
  AlertTriangle,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  Shield,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Globe,
  Filter,
} from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, writeBatch, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logActivity } from '@/lib/firestore';
import MainLayout from '@/components/Layout/MainLayout';
import type { Organization, User } from '@/lib/types';

type SortField = 'name' | 'industry' | 'region' | 'plan' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface Campaign {
  id: string;
  title: string;
  description: string;
  allowedOrganizations?: string[];
  metadata: {
    isPublished: boolean;
    createdAt: any;
    updatedAt: any;
  };
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// Helper to format dates
function formatDate(date: Date | string | number | undefined, long?: boolean): string {
  if (!date) return '—';
  const d = typeof date === 'object' && 'toDate' in date
    ? (date as any).toDate()
    : new Date(date);
  return d.toLocaleDateString('en-US', long ? {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  } : {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

// Helper to get subscription badge styles
function getSubscriptionStyles(plan?: string, status?: string) {
  if (status === 'expired') {
    return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Expired' };
  }
  if (status === 'trial') {
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Trial' };
  }
  switch (plan) {
    case 'enterprise':
      return { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Enterprise' };
    case 'professional':
      return { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Professional' };
    default:
      return { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Free' };
  }
}

// Helper to get size label
function getSizeLabel(size?: string): string {
  switch (size) {
    case 'enterprise': return '1000+ employees';
    case 'large': return '500-999 employees';
    case 'medium': return '100-499 employees';
    case 'small': return '1-99 employees';
    default: return '—';
  }
}

export default function ClientsPage() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'professional' | 'enterprise'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'trial' | 'expired'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Escape key handler for slide-over panel
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedOrg && !deleting) {
        setSelectedOrg(null);
      }
    };
    if (selectedOrg) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [selectedOrg, deleting]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [orgsSnapshot, campaignsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'organizations'), orderBy('name'))),
        getDocs(collection(db, 'campaigns'))
      ]);

      const orgs = orgsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Organization[];
      setOrganizations(orgs);

      const campaignsData = campaignsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Campaign[];
      setCampaigns(campaignsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrganizations = useMemo(() => {
    const filtered = organizations.filter(org => {
      const matchesSearch = !searchTerm ||
        org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.industry?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        org.region?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPlan = filterPlan === 'all' || org.subscription?.plan === filterPlan;
      const matchesStatus = filterStatus === 'all' || org.subscription?.status === filterStatus;
      return matchesSearch && matchesPlan && matchesStatus;
    });

    return filtered.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortField) {
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'industry':
          aVal = (a.industry || '').toLowerCase();
          bVal = (b.industry || '').toLowerCase();
          break;
        case 'region':
          aVal = (a.region || '').toLowerCase();
          bVal = (b.region || '').toLowerCase();
          break;
        case 'plan':
          const planOrder = { enterprise: 3, professional: 2, free: 1 };
          aVal = planOrder[a.subscription?.plan as keyof typeof planOrder] || 0;
          bVal = planOrder[b.subscription?.plan as keyof typeof planOrder] || 0;
          break;
        case 'createdAt':
          const getTime = (date: any) => {
            if (!date) return 0;
            if (typeof date === 'object' && 'toDate' in date) return date.toDate().getTime();
            return new Date(date).getTime();
          };
          aVal = getTime(a.metadata?.createdAt);
          bVal = getTime(b.metadata?.createdAt);
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [organizations, searchTerm, filterPlan, filterStatus, sortField, sortDirection]);

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
      return <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />;
    }
    return sortDirection === 'asc'
      ? <ChevronUp className="h-3.5 w-3.5 text-slate-600" />
      : <ChevronDown className="h-3.5 w-3.5 text-slate-600" />;
  };

  const stats = useMemo(() => {
    const total = organizations.length;
    const active = organizations.filter(o => o.subscription?.status === 'active').length;
    const trial = organizations.filter(o => o.subscription?.status === 'trial').length;
    const enterprise = organizations.filter(o => o.subscription?.plan === 'enterprise').length;
    return { total, active, trial, enterprise };
  }, [organizations]);

  // Get campaigns for selected organization
  const selectedOrgCampaigns = useMemo(() => {
    if (!selectedOrg) return [];
    return campaigns.filter(c => c.allowedOrganizations?.includes(selectedOrg.id));
  }, [selectedOrg, campaigns]);

  // Fetch admin users when organization is selected
  useEffect(() => {
    const fetchAdminUsers = async () => {
      if (!selectedOrg?.adminIds?.length) {
        setAdminUsers([]);
        return;
      }

      setLoadingAdmins(true);
      try {
        // Firestore 'in' query supports up to 10 items, so we may need to batch
        const adminIds = selectedOrg.adminIds;
        const users: AdminUser[] = [];

        // Batch in groups of 10
        for (let i = 0; i < adminIds.length; i += 10) {
          const batch = adminIds.slice(i, i + 10);
          const usersQuery = query(
            collection(db, 'users'),
            where(documentId(), 'in', batch)
          );
          const snapshot = await getDocs(usersQuery);
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            users.push({
              id: doc.id,
              name: data.name || 'Unknown',
              email: data.email || '',
              avatar: data.avatar,
            });
          });
        }

        setAdminUsers(users);
      } catch (error) {
        console.error('Failed to fetch admin users:', error);
        setAdminUsers([]);
      } finally {
        setLoadingAdmins(false);
      }
    };

    fetchAdminUsers();
  }, [selectedOrg]);

  // Delete organization and all related data
  const handleDeleteOrganization = async () => {
    if (!selectedOrg) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const batch = writeBatch(db);
      const orgId = selectedOrg.id;

      // 1. Delete all users belonging to this organization
      const usersSnapshot = await getDocs(
        query(collection(db, 'users'), where('organization', '==', orgId))
      );
      usersSnapshot.docs.forEach(userDoc => {
        batch.delete(userDoc.ref);
      });
      console.log(`Queued ${usersSnapshot.docs.length} users for deletion`);

      // 2. Delete all campaigns that have this org in allowedOrganizations
      // and also delete related campaign items, enrollments, progress, and responses
      const campaignsToDelete = campaigns.filter(c =>
        c.allowedOrganizations?.includes(orgId)
      );

      for (const campaign of campaignsToDelete) {
        // Delete campaign items
        const itemsSnapshot = await getDocs(
          query(collection(db, 'campaignItems'), where('campaignId', '==', campaign.id))
        );
        itemsSnapshot.docs.forEach(itemDoc => {
          batch.delete(itemDoc.ref);
        });

        // Delete campaign enrollments
        const enrollmentsSnapshot = await getDocs(
          query(collection(db, 'campaignEnrollments'), where('campaignId', '==', campaign.id))
        );
        enrollmentsSnapshot.docs.forEach(enrollDoc => {
          batch.delete(enrollDoc.ref);
        });

        // Delete campaign progress
        const progressSnapshot = await getDocs(
          query(collection(db, 'campaignProgress'), where('campaignId', '==', campaign.id))
        );
        progressSnapshot.docs.forEach(progressDoc => {
          batch.delete(progressDoc.ref);
        });

        // Delete campaign responses
        const responsesSnapshot = await getDocs(
          query(collection(db, 'campaignResponses'), where('campaignId', '==', campaign.id))
        );
        responsesSnapshot.docs.forEach(responseDoc => {
          batch.delete(responseDoc.ref);
        });

        // Delete the campaign itself
        batch.delete(doc(db, 'campaigns', campaign.id));
      }
      console.log(`Queued ${campaignsToDelete.length} campaigns for deletion`);

      // 3. Delete the organization document
      batch.delete(doc(db, 'organizations', orgId));

      // Commit all deletions
      await batch.commit();

      // Log activity
      if (user) {
        await logActivity({
          action: 'access_updated',
          userId: user.uid,
          userEmail: user.email || '',
          userName: user.displayName || undefined,
          resourceId: orgId,
          resourceName: selectedOrg.name,
          resourceType: 'access',
          metadata: {
            action: 'organization_deleted',
            usersDeleted: usersSnapshot.docs.length,
            campaignsDeleted: campaignsToDelete.length,
          },
        });
      }

      // Update local state
      setOrganizations(prev => prev.filter(o => o.id !== orgId));
      setCampaigns(prev => prev.filter(c => !c.allowedOrganizations?.includes(orgId)));
      setSelectedOrg(null);
      setShowDeleteConfirm(false);

      console.log(`Successfully deleted organization ${selectedOrg.name} and all related data`);
    } catch (error) {
      console.error('Failed to delete organization:', error);
      setDeleteError('Failed to delete organization. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                <Building2 className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-500">Total Clients</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{stats.active}</p>
                <p className="text-xs text-slate-500">Active</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{stats.trial}</p>
                <p className="text-xs text-slate-500">On Trial</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Crown className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-2xl font-semibold text-slate-900">{stats.enterprise}</p>
                <p className="text-xs text-slate-500">Enterprise</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search clients..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
            />
          </div>
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All Plans</option>
            <option value="free">Free</option>
            <option value="professional">Professional</option>
            <option value="enterprise">Enterprise</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-100"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="trial">Trial</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {/* Organizations List */}
        <div className="rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="divide-y divide-slate-100">
              {/* Table Header Skeleton */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50">
                {['w-24', 'w-16', 'w-16', 'w-14', 'w-20', 'w-8'].map((width, i) => (
                  <div key={i} className={`col-span-${i === 0 ? 4 : 2} ${i === 5 ? 'col-span-1' : ''}`}>
                    <div className={`h-3 ${width} bg-slate-200 rounded animate-pulse`} />
                  </div>
                ))}
              </div>
              {/* Row Skeletons */}
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 px-6 py-4 items-center">
                  <div className="col-span-4 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-slate-200 animate-pulse" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-slate-200 rounded animate-pulse" />
                      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                  </div>
                  <div className="col-span-2">
                    <div className="h-4 w-16 bg-slate-200 rounded animate-pulse" />
                  </div>
                  <div className="col-span-2">
                    <div className="h-6 w-16 bg-slate-200 rounded-full animate-pulse" />
                  </div>
                  <div className="col-span-1">
                    <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <div className="h-5 w-5 bg-slate-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredOrganizations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
                <Building2 className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-sm font-medium text-slate-900">No clients found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm ? 'Try adjusting your search or filters' : 'Add your first client to get started'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 bg-slate-50">
                <button
                  onClick={() => handleSort('name')}
                  className="col-span-4 flex items-center gap-1.5 hover:text-slate-700 transition text-left"
                >
                  Organization
                  <SortIcon field="name" />
                </button>
                <button
                  onClick={() => handleSort('industry')}
                  className="col-span-2 flex items-center gap-1.5 hover:text-slate-700 transition text-left"
                >
                  Industry
                  <SortIcon field="industry" />
                </button>
                <button
                  onClick={() => handleSort('region')}
                  className="col-span-2 flex items-center gap-1.5 hover:text-slate-700 transition text-left"
                >
                  Region
                  <SortIcon field="region" />
                </button>
                <button
                  onClick={() => handleSort('plan')}
                  className="col-span-2 flex items-center gap-1.5 hover:text-slate-700 transition text-left"
                >
                  Plan
                  <SortIcon field="plan" />
                </button>
                <button
                  onClick={() => handleSort('createdAt')}
                  className="col-span-2 flex items-center gap-1.5 hover:text-slate-700 transition text-left"
                >
                  Created
                  <SortIcon field="createdAt" />
                </button>
              </div>

              {/* Table Rows */}
              {filteredOrganizations.map((org) => {
                const subStyles = getSubscriptionStyles(org.subscription?.plan, org.subscription?.status);
                return (
                  <div
                    key={org.id}
                    onClick={() => setSelectedOrg(org)}
                    className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 transition cursor-pointer group"
                  >
                    {/* Organization */}
                    <div className="col-span-4 flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 text-sm font-semibold text-slate-600">
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{org.name}</p>
                        <p className="text-xs text-slate-500 truncate">
                          {org.departments?.length || 0} department{org.departments?.length !== 1 ? 's' : ''} · {getSizeLabel(org.size)}
                        </p>
                      </div>
                    </div>

                    {/* Industry */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Briefcase className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{org.industry || '—'}</span>
                      </div>
                    </div>

                    {/* Region */}
                    <div className="col-span-2">
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{org.region || '—'}</span>
                      </div>
                    </div>

                    {/* Plan */}
                    <div className="col-span-2">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ${subStyles.bg} ${subStyles.text}`}>
                        {subStyles.label}
                      </span>
                    </div>

                    {/* Created */}
                    <div className="col-span-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{formatDate(org.metadata?.createdAt)}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Results count */}
        {!loading && filteredOrganizations.length > 0 && (
          <p className="text-sm text-slate-500">
            Showing {filteredOrganizations.length} of {organizations.length} client{organizations.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Slide-over Panel */}
      <div
        className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${selectedOrg ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        onClick={() => setSelectedOrg(null)}
      />

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto transform transition-transform duration-300 ease-out ${selectedOrg ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {selectedOrg && (
          <>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                  style={{
                    background: selectedOrg.settings?.primaryColor
                      ? `linear-gradient(135deg, ${selectedOrg.settings.primaryColor}, ${selectedOrg.settings.secondaryColor || selectedOrg.settings.primaryColor})`
                      : 'linear-gradient(135deg, #475569, #1e293b)'
                  }}
                >
                  {selectedOrg.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedOrg.name}</h2>
                  <p className="text-sm text-slate-500">@{selectedOrg.slug}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrg(null)}
                className="p-2 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Subscription Badge */}
              {(() => {
                const subStyles = getSubscriptionStyles(selectedOrg.subscription?.plan, selectedOrg.subscription?.status);
                return (
                  <div className="flex items-center gap-2">
                    <span className={`rounded-md px-2.5 py-1 text-xs font-medium ${subStyles.bg} ${subStyles.text}`}>
                      {subStyles.label}
                    </span>
                    <span className="text-xs text-slate-500 capitalize">
                      {selectedOrg.subscription?.status || 'Active'}
                    </span>
                  </div>
                );
              })()}

              {/* Details */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Organization Details</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <Briefcase className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Industry</p>
                      <p className="text-sm font-medium text-slate-900">{selectedOrg.industry || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <MapPin className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Region</p>
                      <p className="text-sm font-medium text-slate-900">{selectedOrg.region || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <Users className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Company Size</p>
                      <p className="text-sm font-medium text-slate-900">{getSizeLabel(selectedOrg.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                      <Calendar className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Created</p>
                      <p className="text-sm font-medium text-slate-900">{formatDate(selectedOrg.metadata?.createdAt, true)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Departments */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Departments</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {selectedOrg.departments?.length || 0}
                  </span>
                </div>
                {selectedOrg.departments?.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedOrg.departments.map((dept, index) => (
                      <span
                        key={index}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                      >
                        {dept}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No departments configured</p>
                )}
              </div>

              {/* Assigned Campaigns */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Assigned Campaigns</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {selectedOrgCampaigns.length}
                  </span>
                </div>
                {selectedOrgCampaigns.length > 0 ? (
                  <div className="space-y-2">
                    {selectedOrgCampaigns.map((campaign) => (
                      <Link
                        key={campaign.id}
                        href={`/campaigns`}
                        className="flex items-center justify-between rounded-lg border border-slate-100 p-3 transition hover:bg-slate-50 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100">
                            <LayoutGrid className="h-4 w-4 text-sky-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{campaign.title}</p>
                            <p className="text-xs text-slate-500">
                              {campaign.metadata?.isPublished ? 'Published' : 'Draft'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                    <LayoutGrid className="mx-auto h-6 w-6 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">No campaigns assigned</p>
                    <Link
                      href="/access"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
                    >
                      Manage Access
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Branding */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Branding</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Primary Color</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-5 w-5 rounded border border-slate-200"
                        style={{ backgroundColor: selectedOrg.settings?.primaryColor || '#475569' }}
                      />
                      <span className="text-xs font-mono text-slate-600">
                        {selectedOrg.settings?.primaryColor || '#475569'}
                      </span>
                    </div>
                  </div>
                  {selectedOrg.settings?.secondaryColor && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-500">Secondary Color</span>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-5 w-5 rounded border border-slate-200"
                          style={{ backgroundColor: selectedOrg.settings.secondaryColor }}
                        />
                        <span className="text-xs font-mono text-slate-600">
                          {selectedOrg.settings.secondaryColor}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Administrators */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Administrators</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                  </span>
                </div>
                {loadingAdmins ? (
                  <div className="space-y-2">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5 animate-pulse">
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3.5 w-28 rounded bg-slate-200" />
                          <div className="h-3 w-40 rounded bg-slate-200" />
                        </div>
                        <div className="h-8 w-8 rounded-lg bg-slate-200" />
                      </div>
                    ))}
                  </div>
                ) : adminUsers.length > 0 ? (
                  <div className="space-y-2">
                    {adminUsers.map((admin) => (
                      <div
                        key={admin.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            src={admin.avatar}
                            name={admin.name}
                            email={admin.email}
                            className="h-8 w-8 text-xs shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{admin.name}</p>
                            <p className="text-xs text-slate-500 truncate">{admin.email}</p>
                          </div>
                        </div>
                        <a
                          href={`mailto:${admin.email || ''}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition shrink-0"
                          title={`Email ${admin.name}`}
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : selectedOrg.adminIds?.length > 0 ? (
                  // Fallback: show adminIds if user details couldn't be fetched
                  <div className="space-y-2">
                    {selectedOrg.adminIds.map((adminId, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar
                            email={adminId}
                            className="h-8 w-8 text-xs shrink-0"
                          />
                          <span className="text-sm text-slate-700 truncate min-w-0">{adminId}</span>
                        </div>
                        <a
                          href={`mailto:${adminId.includes('@') ? adminId : ''}`}
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition shrink-0"
                          title={`Email ${adminId}`}
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No administrators configured</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <Edit2 className="h-4 w-4" />
                  Edit Client
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {
        showDeleteConfirm && selectedOrg && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
              onClick={() => !deleting && setShowDeleteConfirm(false)}
            >
              <div
                className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
                    <AlertTriangle className="h-6 w-6 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Delete Organization</h3>
                    <p className="text-sm text-slate-500">This action cannot be undone</p>
                  </div>
                </div>

                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100">
                  <p className="text-sm text-slate-700 mb-3">
                    You are about to permanently delete <span className="font-semibold">{selectedOrg.name}</span>. This will also delete:
                  </p>
                  <ul className="text-sm text-slate-600 space-y-1.5">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      All users belonging to this organization
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      {selectedOrgCampaigns.length} campaign{selectedOrgCampaigns.length !== 1 ? 's' : ''} assigned to this organization
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      All campaign enrollments, progress, and responses
                    </li>
                  </ul>
                </div>

                {deleteError && (
                  <div className="mb-4 p-3 rounded-lg bg-rose-100 text-sm text-rose-700">
                    {deleteError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteOrganization}
                    disabled={deleting}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                  >
                    {deleting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Delete Organization
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )
      }
    </MainLayout >
  );
}
