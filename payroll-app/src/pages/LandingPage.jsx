import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-700 to-red-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full mb-4">
            <i className="fa-solid fa-money-check-alt text-white text-3xl"></i>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">BEAUZEAD LTD</h1>
          <p className="text-red-100 text-lg">Payroll &amp; Record Management System</p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Admin Portal */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <i className="fa-solid fa-user-shield text-white text-2xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Admin Portal</h2>
            <p className="text-red-100 mb-6">Manage employees, payroll, attendance &amp; more</p>
            <Link
              to="/auth/admin-login"
              className="inline-block w-full bg-white text-red-700 font-semibold py-3 px-6 rounded-lg hover:scale-105 transition-transform duration-200"
            >
              Login
            </Link>
          </div>

          {/* Employee Portal */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-4">
              <i className="fa-solid fa-user-tie text-white text-2xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Employee Portal</h2>
            <p className="text-red-100 mb-6">View payslips, attendance, apply for leaves</p>
            <Link
              to="/auth/employee-login"
              className="inline-block w-full bg-white text-red-700 font-semibold py-3 px-6 rounded-lg hover:scale-105 transition-transform duration-200"
            >
              Login
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-red-200 text-sm">
          &copy; {new Date().getFullYear()} BEAUZEAD LTD. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
