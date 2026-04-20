import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import { formatDate, MONTHS, getDaysInMonth, getYearRange } from '../../utils/helpers';
import { Bar } from 'react-chartjs-2';

const Attendance = () => {
  const { profile } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);

  async function fetchAttendance() {
    setLoading(true);
    const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
    const monthStr = String(selectedMonth).padStart(2, '0');
    const startDate = `${selectedYear}-${monthStr}-01`;
    const endDate = `${selectedYear}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', profile.id)
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('attendance_date', { ascending: true });

    setAttendance(data || []);
    setLoading(false);
  }

  useEffect(() => {
    if (!profile?.id) return;
    const timer = setTimeout(() => { void fetchAttendance(); }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, selectedMonth, selectedYear]);

  const attMap = {};
  attendance.forEach((a) => { attMap[a.attendance_date] = a; });

  const daysInMonth = getDaysInMonth(selectedMonth, selectedYear);
  const allDays = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayOfWeek = new Date(dateStr).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const record = attMap[dateStr];
    allDays.push({ date: dateStr, day: d, dayName: new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' }), isWeekend, record });
  }

  const presentCount = attendance.filter((a) => a.status === 'present').length;
  const absentCount = attendance.filter((a) => a.status === 'absent').length;
  const halfdayCount = attendance.filter((a) => a.status === 'halfday').length;

  // Working days = weekdays in month
  const workingDays = allDays.filter((d) => !d.isWeekend).length;
  const attendancePct = workingDays > 0 ? ((presentCount + halfdayCount * 0.5) / workingDays * 100).toFixed(1) : 0;
  const totalHours = attendance.reduce((s, a) => s + (Number(a.total_hours) || 0), 0);
  const avgHours = presentCount > 0 ? (totalHours / presentCount).toFixed(1) : '0.0';

  const chartData = {
    labels: ['Present', 'Absent', 'Half Day'],
    datasets: [{
      label: 'Days',
      data: [presentCount, absentCount, halfdayCount],
      backgroundColor: ['#22c55e', '#dc2626', '#eab308'],
      borderRadius: 8,
    }],
  };

  const getStatusBadge = (day) => {
    if (day.isWeekend) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Weekend</span>;
    if (!day.record) return <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">Not Marked</span>;
    const colors = {
      present: 'bg-green-100 text-green-700',
      absent: 'bg-red-100 text-red-700',
      halfday: 'bg-yellow-100 text-yellow-700',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[day.record.status]}`}>{day.record.status === 'halfday' ? 'Half Day' : day.record.status.charAt(0).toUpperCase() + day.record.status.slice(1)}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">My Attendance</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
          >
            {getYearRange().map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatsCard title="Present" value={presentCount} icon="fa-check-circle" color="green" />
        <StatsCard title="Absent" value={absentCount} icon="fa-times-circle" color="red" />
        <StatsCard title="Half Day" value={halfdayCount} icon="fa-adjust" color="yellow" />
        <StatsCard title="Working Days" value={workingDays} icon="fa-calendar" color="blue" />
        <StatsCard title="Attendance %" value={`${attendancePct}%`} icon="fa-chart-pie" color="purple" />
        <StatsCard title="Avg Hours/Day" value={avgHours} icon="fa-clock" color="red" />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Monthly Overview</h3>
        <div className="max-w-md mx-auto">
          <Bar data={chartData} options={{ plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Day</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Check In</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Check Out</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Total Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : (
                allDays.map((day) => (
                  <tr key={day.date} className={`${day.isWeekend ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{formatDate(day.date)}</td>
                    <td className={`px-4 py-3 text-sm ${day.isWeekend ? 'text-red-500 font-medium' : 'text-gray-600'}`}>{day.dayName}</td>
                    <td className="px-4 py-3 text-center">{getStatusBadge(day)}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{day.record?.check_in || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{day.record?.check_out || '-'}</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-600">{day.record?.total_hours ? `${day.record.total_hours}h` : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Attendance;
