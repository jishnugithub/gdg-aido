import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { ToastProvider } from '@/contexts/ToastContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { LocationProvider } from '@/contexts/LocationContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ActiveJobProvider, useActiveJob } from '@/contexts/ActiveJobContext';
import { Spinner } from '@/components/ui/Spinner';

import {
  LoginPage,
  VerifyOtpPage,
  RegisterPage,
  HomePage,
  SearchPage,
  ActiveRequestPage,
  MatchingPage,
  PassiveRequestPage,
  JobDetailPage,
  ChatPage,
  CompletionPage,
  PaymentPage,
  ReviewPage,
  DisputePage,
  ProfilePage,
  OtherProfilePage,
  HistoryPage,
  NotificationsPage,
  TaskDetailPage,
  ApplicationsPage,
  AdminPage,
  NotFoundPage,
} from '@/pages';

/**
 * Loading fallback component displayed while auth or active-job states initialize.
 */
const AppLoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#FFF8F5] flex flex-col items-center justify-center gap-3">
    <Spinner size="lg" className="text-primary" />
    <p className="text-xs font-semibold text-[#1A1D3E]/70 animate-pulse">
      Loading Aidmate...
    </p>
  </div>
);

/**
 * ProtectedRoute:
 * 1. Checks if the user is authenticated. If not, redirects to '/'.
 * 2. Checks Navigation Lock: If the user has an active locked job, they are strictly
 *    confined to `/job/:activeJobId/*` routes until completed/paid.
 */
interface ProtectedRouteProps {
  children: React.ReactElement;
  adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, loading: authLoading, isNewUser } = useAuth();
  const { isLocked, activeJob, loading: jobLoading } = useActiveJob();
  const location = useLocation();

  if (authLoading || jobLoading) {
    return <AppLoadingScreen />;
  }

  // Not signed in
  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // First time phone auth user who hasn't completed their user profile
  if (isNewUser && location.pathname !== '/register') {
    return <Navigate to="/register" replace />;
  }

  // Active Job Navigation Lock
  if (isLocked && activeJob) {
    const isAllowedJobRoute = location.pathname.startsWith(`/job/${activeJob.jobId}`);
    if (!isAllowedJobRoute) {
      return <Navigate to={`/job/${activeJob.jobId}`} replace />;
    }
  }

  return children;
};

/**
 * PublicRoute:
 * Route accessible to unauthenticated guests.
 * If user is already authenticated, redirects them to their active job (if locked) or /home.
 */
interface PublicRouteProps {
  children: React.ReactElement;
}

export const PublicRoute: React.FC<PublicRouteProps> = ({ children }) => {
  const { isAuthenticated, loading: authLoading, isNewUser } = useAuth();
  const { isLocked, activeJob, loading: jobLoading } = useActiveJob();
  const location = useLocation();

  if (authLoading || jobLoading) {
    return <AppLoadingScreen />;
  }

  if (isAuthenticated) {
    if (isNewUser) {
      return location.pathname === '/register' ? children : <Navigate to="/register" replace />;
    }

    if (isLocked && activeJob) {
      return <Navigate to={`/job/${activeJob.jobId}`} replace />;
    }

    return <Navigate to="/home" replace />;
  }

  return children;
};

/**
 * Main Application Component
 */
export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <LocationProvider>
          <NotificationProvider>
            <ActiveJobProvider>
              <BrowserRouter>
                <Routes>
                  {/* Public routes */}
                  <Route
                    path="/"
                    element={
                      <PublicRoute>
                        <LoginPage />
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/verify-otp"
                    element={
                      <PublicRoute>
                        <VerifyOtpPage />
                      </PublicRoute>
                    }
                  />
                  <Route
                    path="/register"
                    element={
                      <PublicRoute>
                        <RegisterPage />
                      </PublicRoute>
                    }
                  />

                  {/* Protected general routes */}
                  <Route
                    path="/home"
                    element={
                      <ProtectedRoute>
                        <HomePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/search"
                    element={
                      <ProtectedRoute>
                        <SearchPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Active Request workflow */}
                  <Route
                    path="/request/active"
                    element={
                      <ProtectedRoute>
                        <ActiveRequestPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/request/active/matching/:jobId"
                    element={
                      <ProtectedRoute>
                        <MatchingPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Passive Request workflow */}
                  <Route
                    path="/request/passive"
                    element={
                      <ProtectedRoute>
                        <PassiveRequestPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/task/:jobId"
                    element={
                      <ProtectedRoute>
                        <TaskDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/task/:jobId/applications"
                    element={
                      <ProtectedRoute>
                        <ApplicationsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Job Detail & Lifecycle Tracking */}
                  <Route
                    path="/job/:jobId"
                    element={
                      <ProtectedRoute>
                        <JobDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/job/:jobId/chat"
                    element={
                      <ProtectedRoute>
                        <ChatPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/job/:jobId/complete"
                    element={
                      <ProtectedRoute>
                        <CompletionPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/job/:jobId/payment"
                    element={
                      <ProtectedRoute>
                        <PaymentPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/job/:jobId/review"
                    element={
                      <ProtectedRoute>
                        <ReviewPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/job/:jobId/dispute"
                    element={
                      <ProtectedRoute>
                        <DisputePage />
                      </ProtectedRoute>
                    }
                  />

                  {/* User Profile & Account */}
                  <Route
                    path="/profile"
                    element={
                      <ProtectedRoute>
                        <ProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/profile/:userId"
                    element={
                      <ProtectedRoute>
                        <OtherProfilePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/history"
                    element={
                      <ProtectedRoute>
                        <HistoryPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute>
                        <NotificationsPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Administration Dashboard */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute adminOnly>
                        <AdminPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* 404 Catch-All */}
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </BrowserRouter>
            </ActiveJobProvider>
          </NotificationProvider>
        </LocationProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
