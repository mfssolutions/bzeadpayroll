import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import CurrencyToggle from '../ui/CurrencyToggle';

const navLinks = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: 'fa-tachometer-alt' },
  { path: '/admin/employees', label: 'Employees', icon: 'fa-users' },
  { path: '/admin/attendance', label: 'Attendance', icon: 'fa-calendar-check' },
  { path: '/admin/leave-requests', label: 'Leave Requests', icon: 'fa-envelope-open-text' },
  { path: '/admin/payroll', label: 'Payroll', icon: 'fa-coins' },
  { path: '/admin/profile', label: 'Profile', icon: 'fa-user-circle' },
];

const pageTitles = {
  '/admin/dashboard': 'Dashboard',
  '/admin/employees': 'Employees',
  '/admin/attendance': 'Attendance',
  '/admin/leave-requests': 'Leave Requests',
  '/admin/payroll': 'Payroll',
  '/admin/profile': 'Profile',
  '/admin/settings': 'Settings',
};

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const { user, profile, role, signOut } = useAuth();
  const { settings } = useCompanySettings();
  const location = useLocation();
  const navigate = useNavigate();

  const pageTitle = pageTitles[location.pathname] || 'Admin';
  const adminName = profile?.full_name || user?.email || 'Admin';

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
    await signOut();
    navigate('/auth/admin-login');
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
            <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
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
                <p className="text-sm font-medium text-gray-900 truncate">{adminName}</p>
                <p className="text-xs text-gray-500 capitalize">{role || 'Admin'}</p>
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
                Welcome, {adminName}
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
                    <Link
                      to="/admin/profile"
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fas fa-user-circle w-4"></i>
                      <span>Profile</span>
                    </Link>
                    <Link
                      to="/admin/settings"
                      className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <i className="fas fa-cog w-4"></i>
                      <span>Settings</span>
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
