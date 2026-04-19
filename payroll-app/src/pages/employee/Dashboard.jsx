import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import { formatCurrency, MONTHS } from '../../utils/helpers';
import { Doughnut, Line } from 'react-chartjs-2';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState({ salary: 0, presentDays: 0, availableLeaves: 0, pendingLeaves: 0 });
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    if (profile?.id) fetchDashboardData();
  }, [profile]);

  const fetchDashboardData = async () => {
    setLoading(true);

    // Basic salary
    const salary = Number(profile?.basic_salary) || 0;

    // Present days this month
    const monthStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const monthEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${new Date(currentYear, currentMonth, 0).getDate()}`;

    const { data: attData } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', profile.id)
      .gte('attendance_date', monthStart)
      .lte('attendance_date', monthEnd)
      .eq('status', 'present');

    const presentDays = attData?.length || 0;

    // Leave balance
    const { data: lbData } = await supabase
      .from('leave_balances')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('year', currentYear)
      .single();

    const availableLeaves = lbData
      ? (lbData.sick_leave - lbData.used_sick) + (lbData.casual_leave - lbData.used_casual) + (lbData.earned_leave - lbData.used_earned)
      : 0;

    setLeaveBalance(lbData);

    // Pending leaves
    const { count: pendingCount } = await supabase
      .from('leave_requests')
      .select('*', { count: 'exact', head: true })
      .eq('employee_id', profile.id)
      .eq('status', 'pending');

    setStats({ salary, presentDays, availableLeaves, pendingLeaves: pendingCount || 0 });

    // Attendance trend (last 7 days)
    const trend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const { data: dayAtt } = await supabase
        .from('attendance')
        .select('status')
        .eq('employee_id', profile.id)
        .eq('attendance_date', dateStr)
        .single();

      trend.push({
        date: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }),
        value: dayAtt?.status === 'present' ? 1 : dayAtt?.status === 'halfday' ? 0.5 : 0,
      });
    }
    setAttendanceTrend(trend);
    setLoading(false);
  };

  const leaveChartData = leaveBalance ? {
    labels: ['Sick Leave', 'Casual Leave', 'Earned Leave'],
    datasets: [{
      data: [
        leaveBalance.sick_leave - leaveBalance.used_sick,
        leaveBalance.casual_leave - leaveBalance.used_casual,
        leaveBalance.earned_leave - leaveBalance.used_earned,
      ],
      backgroundColor: ['#dc2626', '#f97316', '#eab308'],
      borderWidth: 0,
    }],
  } : null;

  const attendanceChartData = {
    labels: attendanceTrend.map((t) => t.date),
    datasets: [{
      label: 'Attendance',
      data: attendanceTrend.map((t) => t.value),
      borderColor: '#dc2626',
      backgroundColor: 'rgba(220, 38, 38, 0.1)',
      fill: true,
      tension: 0.3,
    }],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">Welcome back, {profile?.first_name}! 👋</h1>
        <p className="opacity-80 mt-1">{MONTHS[currentMonth - 1]} {currentYear}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard title="Basic Salary" value={formatCurrency(stats.salary)} icon="fa-money-bill-wave" color="red" />
        <StatsCard title="Present Days" value={stats.presentDays} subtitle="This month" icon="fa-calendar-check" color="green" />
        <StatsCard title="Available Leaves" value={stats.availableLeaves} icon="fa-umbrella-beach" color="yellow" />
        <StatsCard title="Pending Leaves" value={stats.pendingLeaves} icon="fa-clock" color="blue" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Leave Balance Overview</h3>
          <div className="max-w-xs mx-auto">
            {leaveChartData && <Doughnut data={leaveChartData} options={{ plugins: { legend: { position: 'bottom' } } }} />}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Attendance Progress (Last 7 Days)</h3>
          <Line
            data={attendanceChartData}
            options={{
              scales: { y: { min: 0, max: 1, ticks: { stepSize: 0.5, callback: (v) => v === 1 ? 'Present' : v === 0.5 ? 'Half' : 'Absent' } } },
              plugins: { legend: { display: false } },
            }}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/employee/attendance" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <i className="fas fa-calendar-check text-2xl text-red-600 mb-2"></i>
          <p className="text-sm font-medium text-gray-700">View Attendance</p>
        </Link>
        <Link to="/employee/leave-requests" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <i className="fas fa-paper-plane text-2xl text-orange-600 mb-2"></i>
          <p className="text-sm font-medium text-gray-700">Apply Leave</p>
        </Link>
        <Link to="/employee/payslips" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <i className="fas fa-file-invoice-dollar text-2xl text-green-600 mb-2"></i>
          <p className="text-sm font-medium text-gray-700">My Payslips</p>
        </Link>
        <Link to="/employee/profile" className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center hover:shadow-md transition-shadow">
          <i className="fas fa-user-edit text-2xl text-blue-600 mb-2"></i>
          <p className="text-sm font-medium text-gray-700">Update Profile</p>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
