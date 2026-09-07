import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
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

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingContainer text="Loading..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Protected routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          
          {/* Admin routes */}
          <Route
            path="/students"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teachers"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <TeachersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parents"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <ParentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/classes"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <ClassesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjects"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <SubjectsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Academic routes */}
          <Route
            path="/attendance"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin', 'teacher']}>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/scores"
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <ScoresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/broadsheets"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin', 'teacher']}>
                <BroadsheetsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/results"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin', 'parent']}>
                <ResultsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Finance routes */}
          <Route
            path="/payments"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin', 'parent']}>
                <PaymentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashbook"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <CashbookPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receipts"
            element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <ReceiptsPage />
              </ProtectedRoute>
            }
          />
          
          {/* Parent routes */}
          <Route
            path="/children"
            element={
              <ProtectedRoute allowedRoles={['parent']}>
                <ParentChildrenPage />
              </ProtectedRoute>
            }
          />
          
          {/* Super Admin routes */}
          <Route
            path="/settings"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
                <UsersPage />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}