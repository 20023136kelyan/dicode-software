import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import OrganizationOnboarding, { OrganizationData } from '@/components/OrganizationOnboarding';
import { createOrganization, upsertUserProfile, createInvitation } from '@/lib/firestore';

const AdminOnboarding: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleComplete = async (data: OrganizationData) => {
    try {
      // Create organization with user as admin
      const organizationId = await createOrganization({
        name: data.organizationName,
        slug: data.slug,
        industry: data.industry,
        region: data.region,
        size: data.size,
        departments: data.departments,
        adminIds: [user.id],
        createdBy: user.id,
      });

      // Update user profile with organization and ensure admin role
      await upsertUserProfile(user.id, {
        role: 'admin', // Ensure the creator is an admin
        name: data.adminName.trim(),
        organization: organizationId,
        department: data.departments.length > 0 ? data.departments[0] : null,
        gender: data.adminGender || null,
        dateOfBirth: new Date(data.adminDateOfBirth),
        onboardingCompletedAt: new Date(),
      });

      // Create employee invitations
      if (data.employees.length > 0) {
        console.log(`[AdminOnboarding] Creating ${data.employees.length} invitation(s)...`);

        // Create invitations for all employees
        await Promise.all(
          data.employees.map((employee) =>
            createInvitation({
              organizationId,
              organizationName: data.organizationName,
              email: employee.email,
              role: employee.role || 'employee',
              department: employee.department,
              invitedBy: user.id,
              inviteeName: employee.name,
            })
          )
        );

        console.log('[AdminOnboarding] Invitations created successfully');
      }

      // Don't refresh user here - let the success screen show first
    } catch (error) {
      console.error('Failed to create organization:', error);
      throw error;
    }
  };

  const handleSuccess = async () => {
    // Refresh user data to load the new organization, then navigate
    await refreshUser();
    navigate('/admin/overview');
  };

  return (
    <OrganizationOnboarding
      onComplete={handleComplete}
      onSuccess={handleSuccess}
      userEmail={user.email}
      userName={user.name}
    />
  );
};

export default AdminOnboarding;
