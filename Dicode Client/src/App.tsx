import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import LoginPage from '@/pages/LoginPage';
import InviteAcceptPage from '@/pages/InviteAcceptPage';
import ChangePassword from '@/pages/ChangePassword';
import ResetPassword from '@/pages/ResetPassword';
import AdminLayout from '@/components/admin/AdminLayout';
import EmployeeLayout from '@/components/employee/EmployeeLayout';
import AdminDashboard from '@/pages/admin/Dashboard';
import AnalyticsTrend from '@/pages/admin/AnalyticsTrend';
import Account from '@/pages/admin/Account';
import AssetLibrary from '@/pages/admin/AssetLibrary';
import CampaignManagement from '@/pages/admin/CampaignManagement';
import EmployeeManagement from '@/pages/admin/EmployeeManagement';
import Company from '@/pages/admin/Company';
import AdminOnboarding from '@/pages/admin/Onboarding';
import EmployeeOnboarding from '@/pages/employee/Onboarding';
import EmployeeHome from '@/pages/employee/Home';
import EmployeeProfile from '@/pages/employee/Profile';
import VideoModule from '@/pages/employee/VideoModule';
import CampaignDetails from '@/pages/employee/CampaignDetails';
import PeerComparison from '@/pages/employee/PeerComparison';

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

      {/* Public Password Reset Route - accessible without authentication */}
      <Route path="/reset-password" element={<ResetPassword />} />

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
        <Route path="employees" element={<EmployeeManagement />} />
        <Route path="assets" element={<AssetLibrary />} />
        <Route path="company" element={<Company />} />
        <Route path="account" element={<Account />} />
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
        <Route path="profile" element={<EmployeeProfile />} />
        <Route path="campaign/:campaignId" element={<CampaignDetails />} />
        <Route path="module/:moduleId" element={<VideoModule />} />
        <Route path="comparison/:moduleId" element={<PeerComparison />} />
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
