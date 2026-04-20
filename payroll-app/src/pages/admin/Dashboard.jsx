import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pie, Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import { useCurrency } from '../../contexts/CurrencyContext';

const Dashboard = () => {
  const { profile } = useAuth();
  const { formatCurrency } = useCurrency();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmployees: 0,
    presentToday: 0,
    presentPercentage: 0,
    pendingLeaves: 0,
    adminUsers: 0,
    monthlyPayroll: 0,
  });
  const [departmentData, setDepartmentData] = useState({ labels: [], data: [] });
  const [attendanceTrend, setAttendanceTrend] = useState({ labels: [], data: [] });
  const [recentEmployees, setRecentEmployees] = useState([]);
  const [recentLeaves, setRecentLeaves] = useState([]);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });
      const currentYear = new Date().getFullYear();

      const [
        employeesRes,
        presentRes,
        pendingLeavesRes,
        adminRes,
        payrollRes,
        deptRes,
        recentEmpRes,
        recentLeavesRes,
      ] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('attendance_date', today).eq('status', 'present'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('admin_users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payroll').select('net_salary').eq('month', currentMonth).eq('year', currentYear),
        supabase.from('employees').select('department').eq('status', 'active'),
        supabase.from('employees').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('leave_requests').select('*, employees(first_name, last_name)').order('created_at', { ascending: false }).limit(5),
      ]);

      const totalEmployees = employeesRes.count || 0;
      const presentToday = presentRes.count || 0;
      const presentPercentage = totalEmployees > 0 ? Math.round((presentToday / totalEmployees) * 100) : 0;
      const monthlyPayroll = (payrollRes.data || []).reduce((sum, p) => sum + Number(p.net_salary || 0), 0);

      setStats({
        totalEmployees,
        presentToday,
        presentPercentage,
        pendingLeaves: pendingLeavesRes.count || 0,
        adminUsers: adminRes.count || 0,
        monthlyPayroll,
      });

      // Department-wise data
      const deptCounts = {};
      (deptRes.data || []).forEach((emp) => {
        const dept = emp.department || 'Unassigned';
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });
      setDepartmentData({
        labels: Object.keys(deptCounts),
        data: Object.values(deptCounts),
      });

      // Attendance trend (last 7 days)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
      }

      const { data: trendData } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .in('attendance_date', last7Days)
        .eq('status', 'present');

      const trendCounts = {};
      last7Days.forEach((d) => (trendCounts[d] = 0));
      (trendData || []).forEach((a) => {
        if (trendCounts[a.attendance_date] !== undefined) {
          trendCounts[a.attendance_date]++;
        }
      });

      setAttendanceTrend({
        labels: last7Days.map((d) => {
          const date = new Date(d);
          return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        }),
        data: Object.values(trendCounts),
      });

      setRecentEmployees(recentEmpRes.data || []);
      setRecentLeaves(recentLeavesRes.data || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchDashboardData();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const handleLeaveAction = async (leave, action) => {
    try {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: action,
          approved_by: profile?.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', leave.id);

      if (error) throw error;

      // Update leave balance when approving
      if (action === 'approved') {
        const duration = Math.max(1, Math.ceil((new Date(leave.to_date) - new Date(leave.from_date)) / (1000 * 60 * 60 * 24)) + 1);
        const leaveFieldMap = {
          'Sick Leave': 'used_sick',
          'Casual Leave': 'used_casual',
          'Earned Leave': 'used_earned',
        };
        const field = leaveFieldMap[leave.leave_type];
        if (field) {
          const { data: balance, error: balError } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('employee_id', leave.employee_id)
            .single();

          if (!balError && balance) {
            await supabase
              .from('leave_balances')
              .update({ [field]: (balance[field] || 0) + duration })
              .eq('employee_id', leave.employee_id);
          }
        }
      }

      toast.success(`Leave request ${action}`);
      fetchDashboardData();
    } catch {
      toast.error(`Failed to ${action} leave request`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const pieChartData = {
    labels: departmentData.labels,
    datasets: [
      {
        data: departmentData.data,
        backgroundColor: ['#dc2626', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6'],
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const lineChartData = {
    labels: attendanceTrend.labels,
    datasets: [
      {
        label: 'Present',
        data: attendanceTrend.data,
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.1)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: '#dc2626',
      },
    ],
  };

  const statusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, {profile?.full_name || 'Admin'}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Employees"
          value={stats.totalEmployees}
          icon="fa-users"
          color="border-red-600"
        />
        <StatsCard
          title="Present Today"
          value={stats.presentToday}
          icon="fa-user-check"
          color="border-green-600"
          subtitle={`${stats.presentPercentage}% attendance`}
        />
        <StatsCard
          title="Pending Leaves"
          value={stats.pendingLeaves}
          icon="fa-clock"
          color="border-yellow-600"
        />
        <StatsCard
          title="Admin Users"
          value={stats.adminUsers}
          icon="fa-user-shield"
          color="border-purple-600"
        />
        <StatsCard
          title="Monthly Payroll"
          value={formatCurrency(stats.monthlyPayroll)}
          icon="fa-money-bill-wave"
          color="border-blue-600"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Department-wise Employees</h2>
          <div className="flex items-center justify-center" style={{ height: '300px' }}>
            <Pie
              data={pieChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                },
              }}
            />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Attendance Trend (Last 7 Days)</h2>
          <div style={{ height: '300px' }}>
            <Line
              data={lineChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: { beginAtZero: true, ticks: { stepSize: 1 } },
                },
                plugins: {
                  legend: { display: false },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Employees</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Employee ID</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEmployees.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-gray-500">No employees found</td>
                  </tr>
                ) : (
                  recentEmployees.map((emp, idx) => (
                    <tr key={emp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900">{emp.first_name} {emp.last_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.employee_id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.department || '—'}</td>
                      <td className="px-4 py-3 text-sm">{statusBadge(emp.status)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Leave Requests */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Recent Leave Requests</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-red-600 text-white">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Employee</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Leave Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {recentLeaves.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-6 text-center text-gray-500">No leave requests found</td>
                  </tr>
                ) : (
                  recentLeaves.map((leave, idx) => (
                    <tr key={leave.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {leave.employees?.first_name} {leave.employees?.last_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{leave.leave_type}</td>
                      <td className="px-4 py-3 text-sm">{statusBadge(leave.status)}</td>
                      <td className="px-4 py-3 text-sm">
                        {leave.status === 'pending' ? (
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleLeaveAction(leave, 'approved')}
                              className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleLeaveAction(leave, 'rejected')}
                              className="px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => navigate('/admin/employees')}
            className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors"
          >
            <i className="fas fa-user-plus text-lg"></i>
            <span className="font-medium">Add Employee</span>
          </button>
          <button
            onClick={() => navigate('/admin/attendance')}
            className="flex items-center gap-3 p-4 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors"
          >
            <i className="fas fa-clipboard-check text-lg"></i>
            <span className="font-medium">Mark Attendance</span>
          </button>
          <button
            onClick={() => navigate('/admin/leave-requests')}
            className="flex items-center gap-3 p-4 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <i className="fas fa-calendar-alt text-lg"></i>
            <span className="font-medium">Leave Requests</span>
          </button>
          <button
            onClick={() => navigate('/admin/payroll')}
            className="flex items-center gap-3 p-4 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <i className="fas fa-money-bill-wave text-lg"></i>
            <span className="font-medium">Process Payroll</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
