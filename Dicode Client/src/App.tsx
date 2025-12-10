import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import InviteAcceptPage from '@/pages/InviteAcceptPage';
import ChangePassword from '@/pages/ChangePassword';
import ResetPassword from '@/pages/ResetPassword';
import ForgotPassword from '@/pages/ForgotPassword';
import AdminLayout from '@/components/admin/AdminLayout';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import AnalyticsTrend from '@/pages/admin/AnalyticsTrend';
import Account from '@/pages/admin/Account';
import AssetLibrary from '@/pages/admin/AssetLibrary';
import CampaignManagement from '@/pages/admin/CampaignManagement';
import EmployeeManagement from '@/pages/admin/EmployeeManagement';
import EmployeeDetail from '@/pages/admin/EmployeeDetail';
import Company from '@/pages/admin/Company';
import AdminOnboarding from '@/pages/admin/Onboarding';
import Help from '@/pages/admin/Help';
import EmployeeOnboarding from '@/pages/employee/Onboarding';
import EmployeeHome from '@/pages/employee/Home';
import EmployeeLearn from '@/pages/employee/Learn';
import AllCompetencies from '@/pages/employee/AllCompetencies';
import CompetencyDetail from '@/pages/employee/CompetencyDetail';
import EmployeeRank from '@/pages/employee/Rank';
import EmployeeProfile from '@/pages/employee/Profile';
import VideoModule from '@/pages/employee/VideoModule';
import DesktopCampaignPlayer from '@/pages/employee/DesktopCampaignPlayer';
import CampaignDetails from '@/pages/employee/CampaignDetails';
import AdminCampaignDetails from '@/pages/admin/CampaignDetails';
import PeerComparison from '@/pages/employee/PeerComparison';
import MobilePeerComparison from '@/pages/employee/MobilePeerComparison';
import EmployeeAnalytics from '@/pages/employee/Analytics';
import EmployeePractice from '@/pages/employee/Practice';
import EditProfile from '@/pages/employee/EditProfile';
import NotificationSettings from '@/pages/employee/NotificationSettings';
import HelpCenter from '@/pages/employee/HelpCenter';
import PrivacyPolicy from '@/pages/employee/PrivacyPolicy';
import Security from '@/pages/employee/Security';
import Badges from '@/pages/employee/Badges';

// Responsive wrapper for PeerComparison - shows mobile version on small screens
function ResponsivePeerComparison() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile ? <MobilePeerComparison /> : <PeerComparison />;
}

// Responsive wrapper for VideoModule - shows desktop player on large screens
function ResponsiveVideoModule() {
  const [isMobile, setIsMobile] = React.useState(window.innerWidth < 1024);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile ? <VideoModule /> : <DesktopCampaignPlayer />;
}

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'admin' | 'employee' }) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text">
        Checking permissions...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/employee'} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg text-dark-text">
        Loading your workspace...
      </div>
    );
  }

  // Check if user needs to change password (highest priority)
  const needsPasswordChange = user?.requirePasswordChange === true;

  // Check if admin needs onboarding
  const adminNeedsOnboarding = user?.role === 'admin' && !user?.organization;

  // Check if employee needs onboarding
  const employeeNeedsOnboarding = user?.role === 'employee' && !user?.onboardingCompletedAt;

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            needsPasswordChange ? (
              <Navigate to="/change-password" replace />
            ) : adminNeedsOnboarding ? (
              <Navigate to="/admin/onboarding" replace />
            ) : employeeNeedsOnboarding ? (
              <Navigate to="/employee/onboarding" replace />
            ) : (
              <Navigate to={user?.role === 'admin' ? '/admin' : '/employee'} replace />
            )
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Public Invite Accept Route - accessible without authentication */}
      <Route path="/invite/:token" element={<InviteAcceptPage />} />

      {/* Public Password Reset Routes - accessible without authentication */}
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />

      {/* Change Password Route - accessible to authenticated users */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Admin Onboarding Route - accessible without organization */}
      <Route
        path="/admin/onboarding"
        element={
          <ProtectedRoute requiredRole="admin">
            <AdminOnboarding />
          </ProtectedRoute>
        }
      />

      {/* Employee Onboarding Route - accessible without completed onboarding */}
      <Route
        path="/employee/onboarding"
        element={
          <ProtectedRoute requiredRole="employee">
            <EmployeeOnboarding />
          </ProtectedRoute>
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          needsPasswordChange ? (
            <Navigate to="/change-password" replace />
          ) : adminNeedsOnboarding ? (
            <Navigate to="/admin/onboarding" replace />
          ) : (
            <ProtectedRoute requiredRole="admin">
              <AdminLayout />
            </ProtectedRoute>
          )
        }
      >
        <Route index element={<Navigate to="/admin/overview" replace />} />
        <Route path="overview" element={<AdminDashboard />} />
        <Route path="analytics" element={<AnalyticsTrend />} />
        <Route path="analytics/:tab" element={<AnalyticsTrend />} />
        <Route path="campaigns" element={<CampaignManagement />} />
        <Route path="campaigns/:campaignId" element={<AdminCampaignDetails />} />
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="employees/:employeeId" element={<EmployeeDetail />} />
        <Route path="assets" element={<AssetLibrary />} />
        <Route path="company" element={<Company />} />
        <Route path="account" element={<Account />} />
        <Route path="help" element={<Help />} />
      </Route>

      {/* Employee Routes */}
      <Route
        path="/employee"
        element={
          needsPasswordChange ? (
            <Navigate to="/change-password" replace />
          ) : employeeNeedsOnboarding ? (
            <Navigate to="/employee/onboarding" replace />
          ) : (
            <ProtectedRoute requiredRole="employee">
              <EmployeeLayout />
            </ProtectedRoute>
          )
        }
      >
        <Route index element={<Navigate to="/employee/home" replace />} />
        <Route path="home" element={<EmployeeHome />} />
        <Route path="learn" element={<EmployeeLearn />} />
        <Route path="learn/competencies" element={<AllCompetencies />} />
        <Route path="learn/competency/:competencyName" element={<CompetencyDetail />} />
        <Route path="rank" element={<EmployeeRank />} />
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="campaign/:campaignId" element={<CampaignDetails />} />
        <Route path="module/:moduleId" element={<ResponsiveVideoModule />} />
        <Route path="comparison/:moduleId" element={<ResponsivePeerComparison />} />
        <Route path="analytics" element={<EmployeeAnalytics />} />
        <Route path="comparison" element={<ResponsivePeerComparison />} />
        <Route path="practice" element={<EmployeePractice />} />
        <Route path="practice/*" element={<EmployeePractice />} />
        <Route path="edit-profile" element={<EditProfile />} />
        <Route path="notifications" element={<NotificationSettings />} />
        <Route path="help" element={<HelpCenter />} />
        <Route path="privacy" element={<PrivacyPolicy />} />
        <Route path="security" element={<Security />} />
        <Route path="badges" element={<Badges />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            needsPasswordChange ? (
              <Navigate to="/change-password" replace />
            ) : adminNeedsOnboarding ? (
              <Navigate to="/admin/onboarding" replace />
            ) : employeeNeedsOnboarding ? (
              <Navigate to="/employee/onboarding" replace />
            ) : (
              <Navigate to={user?.role === 'admin' ? '/admin' : '/employee'} replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
