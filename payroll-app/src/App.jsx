import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

// Lazy load pages
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminLogin = lazy(() => import('./pages/auth/AdminLogin'));
const EmployeeLogin = lazy(() => import('./pages/auth/EmployeeLogin'));

// Admin pages
const AdminLayout = lazy(() => import('./components/layout/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminEmployees = lazy(() => import('./pages/admin/Employees'));
const AdminAttendance = lazy(() => import('./pages/admin/Attendance'));
const AdminLeaveRequests = lazy(() => import('./pages/admin/LeaveRequests'));
const AdminPayroll = lazy(() => import('./pages/admin/Payroll'));
const AdminProfile = lazy(() => import('./pages/admin/Profile'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));

// Employee pages
const EmployeeLayout = lazy(() => import('./components/layout/EmployeeLayout'));
const EmployeeDashboard = lazy(() => import('./pages/employee/Dashboard'));
const EmployeeProfile = lazy(() => import('./pages/employee/Profile'));
const EmployeeAttendance = lazy(() => import('./pages/employee/Attendance'));
const EmployeeLeaveRequests = lazy(() => import('./pages/employee/LeaveRequests'));
const EmployeePayslips = lazy(() => import('./pages/employee/Payslips'));

const LoadingSpinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children, requiredRole }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  if (!user) {
    const loginPath = requiredRole === 'admin' ? '/auth/admin-login' : '/auth/employee-login';
    return <Navigate to={loginPath} replace />;
  }

  if (requiredRole && role !== requiredRole) {
    const redirectPath = role === 'admin' ? '/admin/dashboard' : '/employee/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return children;
};

const App = () => {
  return (
    <AuthProvider>
      <CurrencyProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth/admin-login" element={<AdminLogin />} />
            <Route path="/auth/employee-login" element={<EmployeeLogin />} />

            {/* Admin routes */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="employees" element={<AdminEmployees />} />
              <Route path="attendance" element={<AdminAttendance />} />
              <Route path="leave-requests" element={<AdminLeaveRequests />} />
              <Route path="payroll" element={<AdminPayroll />} />
              <Route path="profile" element={<AdminProfile />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>

            {/* Employee routes */}
            <Route
              path="/employee/*"
              element={
                <ProtectedRoute requiredRole="employee">
                  <EmployeeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<EmployeeDashboard />} />
              <Route path="profile" element={<EmployeeProfile />} />
              <Route path="attendance" element={<EmployeeAttendance />} />
              <Route path="leave-requests" element={<EmployeeLeaveRequests />} />
              <Route path="payslips" element={<EmployeePayslips />} />
            </Route>

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      </CurrencyProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            iconTheme: { primary: '#dc2626', secondary: '#fff' },
          },
        }}
      />
    </AuthProvider>
  );
};

export default App;
