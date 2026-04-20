import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import CurrencyToggle from '../ui/CurrencyToggle';
import toast from 'react-hot-toast';

const navLinks = [
  { path: '/employee/dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt' },
  { path: '/employee/profile', label: 'My Profile', icon: 'fa-user-circle' },
  { path: '/employee/attendance', label: 'My Attendance', icon: 'fa-calendar-check' },
  { path: '/employee/leave-requests', label: 'Leave Requests', icon: 'fa-envelope-open-text' },
  { path: '/employee/payslips', label: 'My Payslips', icon: 'fa-file-invoice-dollar' },
];

const pageTitles = {
  '/employee/dashboard': 'Dashboard',
  '/employee/profile': 'My Profile',
  '/employee/attendance': 'My Attendance',
  '/employee/leave-requests': 'Leave Requests',
  '/employee/payslips': 'My Payslips',
};

const EmployeeLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const { settings, settingsError } = useCompanySettings();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = pageTitles[location.pathname] || 'Employee';
  const employeeName = profile?.full_name || user?.email || 'Employee';
  const employeeId = profile?.employee_id || '';
  const designation = profile?.designation || 'Employee';

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownOpen && !e.target.closest('.user-dropdown')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      toast.error('Logout failed');
    }
    navigate('/auth/employee-login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-2xl font-bold text-red-600">{settings.company_name || 'Payroll System'}</h1>
            <p className="text-sm text-gray-500 mt-1">Employee Portal</p>
          </div>

          {/* Nav links */}
          <nav className="flex-1 py-4 px-3 overflow-y-auto">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-colors ${
                    isActive
                      ? 'bg-red-50 text-red-600 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <i className={`fas ${link.icon} w-5 text-center`}></i>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <i className="fas fa-user text-red-600"></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{employeeName}</p>
                <p className="text-xs text-gray-500">{designation}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:ml-72">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-red-600 text-white shadow-md">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                  onClick={() => setSidebarOpen((prev) => !prev)}
                className="lg:hidden p-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <i className="fas fa-bars text-lg"></i>
              </button>
              <h2 className="text-lg font-semibold">{pageTitle}</h2>
            </div>

            <div className="flex items-center gap-4">
              <CurrencyToggle />
              <span className="hidden sm:block text-sm text-red-100">
                Welcome, {employeeName}
              </span>
              <div className="relative user-dropdown">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-red-700 transition-colors"
                >
                  <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <i className="fas fa-user text-sm"></i>
                  </div>
                  <i className="fas fa-chevron-down text-xs"></i>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 text-gray-700">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{employeeName}</p>
                      {employeeId && (
                        <p className="text-xs text-gray-500">ID: {employeeId}</p>
                      )}
                    </div>
                    <Link
                      to="/employee/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fas fa-user-circle w-4"></i>
                      <span>Profile</span>
                    </Link>
                    <hr className="my-1 border-gray-100" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <i className="fas fa-sign-out-alt w-4"></i>
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6">
          {settingsError && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg text-sm">
              <i className="fas fa-exclamation-triangle mr-2"></i>Company settings could not be loaded.
            </div>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default EmployeeLayout;
