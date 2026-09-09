import React from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';

import { useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import Layout from './components/layout/Layout';

import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

import StudentsPage from './pages/StudentsPage';
import TeachersPage from './pages/TeachersPage';
import ParentsPage from './pages/ParentsPage';
import ClassesPage from './pages/ClassesPage';
import SubjectsPage from './pages/SubjectsPage';
import SessionsPage from './pages/SessionsPage';

import AttendancePage from './pages/AttendancePage';
import ScoresPage from './pages/ScoresPage';
import BroadsheetsPage from './pages/BroadsheetsPage';
import ResultsPage from './pages/ResultsPage';

import PaymentsPage from './pages/PaymentsPage';
import CashbookPage from './pages/CashbookPage';
import ReceiptsPage from './pages/ReceiptsPage';

import SettingsPage from './pages/SettingsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import UsersPage from './pages/UsersPage';

import ProfilePage from './pages/ProfilePage';
import ParentChildrenPage from './pages/ParentChildrenPage';

import { LoadingContainer } from './components/ui/Spinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingContainer text="Loading..." />;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  /*
   * A user can have multiple assigned roles.
   *
   * Example:
   * roles: ['admin', 'teacher', 'parent']
   *
   * Route access should therefore check ALL assigned roles,
   * not only the user's primary role.
   */
  const userRoles = user.roles?.length
    ? user.roles
    : [user.role];

  if (
    allowedRoles &&
    !userRoles.some((role) =>
      allowedRoles.includes(role)
    )
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>

        {/* Public routes */}
        <Route
          path="/"
          element={<LandingPage />}
        />

        <Route
          path="/login"
          element={<LoginPage />}
        />

        {/* Protected application routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Dashboard */}
          <Route
            path="/dashboard"
            element={<DashboardPage />}
          />

          {/* Profile */}
          <Route
            path="/profile"
            element={<ProfilePage />}
          />

          {/* =========================
              ADMIN / SUPER ADMIN
              ========================= */}

          <Route
            path="/students"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'super_admin']}
              >
                <StudentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teachers"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'super_admin']}
              >
                <TeachersPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/parents"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'super_admin']}
              >
                <ParentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/classes"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'super_admin']}
              >
                <ClassesPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/subjects"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'super_admin']}
              >
                <SubjectsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/sessions"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'super_admin']}
              >
                <SessionsPage />
              </ProtectedRoute>
            }
          />

          {/* =========================
              ATTENDANCE
              ========================= */}

          <Route
            path="/attendance"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'admin',
                  'super_admin',
                  'teacher',
                ]}
              >
                <AttendancePage />
              </ProtectedRoute>
            }
          />

          {/* =========================
              TEACHER
              ========================= */}

          <Route
            path="/scores"
            element={
              <ProtectedRoute
                allowedRoles={['teacher']}
              >
                <ScoresPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/broadsheets"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'admin',
                  'super_admin',
                  'teacher',
                ]}
              >
                <BroadsheetsPage />
              </ProtectedRoute>
            }
          />

          {/* =========================
              RESULTS
              ========================= */}

          <Route
            path="/results"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'admin',
                  'super_admin',
                  'parent',
                ]}
              >
                <ResultsPage />
              </ProtectedRoute>
            }
          />

          {/* =========================
              FINANCE
              ========================= */}

          <Route
            path="/payments"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'admin',
                  'super_admin',
                  'parent',
                ]}
              >
                <PaymentsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cashbook"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'admin',
                  'super_admin',
                ]}
              >
                <CashbookPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/receipts"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'admin',
                  'super_admin',
                ]}
              >
                <ReceiptsPage />
              </ProtectedRoute>
            }
          />

          {/* =========================
              PARENT
              ========================= */}

          <Route
            path="/children"
            element={
              <ProtectedRoute
                allowedRoles={['parent']}
              >
                <ParentChildrenPage />
              </ProtectedRoute>
            }
          />

          {/* =========================
              SUPER ADMIN
              ========================= */}

          <Route
            path="/settings"
            element={
              <ProtectedRoute
                allowedRoles={['super_admin']}
              >
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'super_admin',
                  'admin',
                ]}
              >
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute
                allowedRoles={[
                  'super_admin',
                  'admin',
                ]}
              >
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Fallback */}
        <Route
          path="*"
          element={
            <Navigate
              to="/dashboard"
              replace
            />
          }
        />

      </Routes>
    </ToastProvider>
  );
}