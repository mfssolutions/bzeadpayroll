import { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import Modal from '../../components/ui/Modal';
import { formatDate, MONTHS } from '../../utils/helpers';
import { useCompanySettings } from '../../hooks/useCompanySettings';

const Attendance = () => {
  const { profile } = useAuth();
  const { settings } = useCompanySettings();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, halfday: 0, percentage: 0 });
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });

  // Mark attendance state
  const [markDate, setMarkDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    status: 'present',
    check_in: settings.work_start_time || '09:30',
    check_out: settings.work_end_time || '18:00',
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    fetchAttendanceData();
  }, [selectedDate]);

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_id, first_name, last_name')
        .eq('status', 'active')
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      toast.error('Failed to load employees');
    }
  };

  const fetchAttendanceData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch attendance for selected date
      const { data: records, error } = await supabase
        .from('attendance')
        .select('*, employees(employee_id, first_name, last_name)')
        .eq('attendance_date', selectedDate)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttendanceRecords(records || []);

      // Calculate stats
      const present = (records || []).filter((r) => r.status === 'present').length;
      const absent = (records || []).filter((r) => r.status === 'absent').length;
      const halfday = (records || []).filter((r) => r.status === 'halfday').length;
      const total = (records || []).length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      setStats({ present, absent, halfday, percentage });

      // Fetch monthly data for chart
      const dateObj = new Date(selectedDate);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
      const daysInMonth = new Date(year, month + 1, 0).getDate();

      const { data: monthlyData, error: monthErr } = await supabase
        .from('attendance')
        .select('attendance_date, status')
        .gte('attendance_date', firstDay)
        .lte('attendance_date', lastDay);

      if (monthErr) throw monthErr;

      // Group by day
      const labels = [];
      const presentArr = [];
      const absentArr = [];
      const halfdayArr = [];

      for (let d = 1; d <= daysInMonth; d++) {
        labels.push(d);
        const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const dayRecords = (monthlyData || []).filter((r) => r.attendance_date === dayStr);
        presentArr.push(dayRecords.filter((r) => r.status === 'present').length);
        absentArr.push(dayRecords.filter((r) => r.status === 'absent').length);
        halfdayArr.push(dayRecords.filter((r) => r.status === 'halfday').length);
      }

      setChartData({
        labels,
        datasets: [
          {
            label: 'Present',
            data: presentArr,
            backgroundColor: 'rgba(34, 197, 94, 0.7)',
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 1,
          },
          {
            label: 'Absent',
            data: absentArr,
            backgroundColor: 'rgba(239, 68, 68, 0.7)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
          },
          {
            label: 'Half Day',
            data: halfdayArr,
            backgroundColor: 'rgba(234, 179, 8, 0.7)',
            borderColor: 'rgb(234, 179, 8)',
            borderWidth: 1,
          },
        ],
      });
    } catch (error) {
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  const handleStatusChange = (status) => {
    let check_in = '';
    let check_out = '';
    if (status === 'present') {
      check_in = settings.work_start_time || '09:30';
      check_out = settings.work_end_time || '18:00';
    } else if (status === 'halfday') {
      check_in = settings.work_start_time || '09:30';
      check_out = settings.halfday_end_time || '13:30';
    }
    setFormData({ status, check_in, check_out });
  };

  const openMarkModal = () => {
    if (!selectedEmployee) {
      toast.error('Please select an employee');
      return;
    }
    setFormData({ status: 'present', check_in: settings.work_start_time || '09:30', check_out: settings.work_end_time || '18:00' });
    setShowModal(true);
  };

  const calculateTotalHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return 0;
    const [inH, inM] = checkIn.split(':').map(Number);
    const [outH, outM] = checkOut.split(':').map(Number);
    const diff = (outH * 60 + outM - (inH * 60 + inM)) / 60;
    return Math.max(0, Math.round(diff * 100) / 100);
  };

  const handleMarkAttendance = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const totalHours = calculateTotalHours(formData.check_in, formData.check_out);

      const { error } = await supabase
        .from('attendance')
        .upsert(
          {
            employee_id: selectedEmployee,
            attendance_date: markDate,
            status: formData.status,
            check_in: formData.check_in || null,
            check_out: formData.check_out || null,
            total_hours: totalHours,
            marked_by: profile.id,
          },
          { onConflict: 'employee_id,attendance_date' }
        );

      if (error) throw error;
      toast.success('Attendance marked successfully');
      setShowModal(false);
      setSelectedEmployee('');
      if (markDate === selectedDate) {
        fetchAttendanceData();
      }
    } catch (error) {
      toast.error('Failed to mark attendance');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this attendance record?')) return;
    try {
      const { error } = await supabase.from('attendance').delete().eq('id', id);
      if (error) throw error;
      toast.success('Attendance record deleted');
      fetchAttendanceData();
    } catch (error) {
      toast.error('Failed to delete record');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      halfday: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'halfday' ? 'Half Day' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const selectedDateObj = new Date(selectedDate);
  const chartTitle = `${MONTHS[selectedDateObj.getMonth()]} ${selectedDateObj.getFullYear()} - Attendance Overview`;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: chartTitle },
    },
    scales: {
      x: { title: { display: true, text: 'Day of Month' } },
      y: { beginAtZero: true, title: { display: true, text: 'Count' } },
    },
  };

  if (loading && attendanceRecords.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-500 mt-1">Track and manage employee attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Present Today" value={stats.present} icon="fa-user-check" color="border-green-600" />
        <StatsCard title="Absent Today" value={stats.absent} icon="fa-user-times" color="border-red-600" />
        <StatsCard title="Half Day" value={stats.halfday} icon="fa-user-clock" color="border-yellow-600" />
        <StatsCard title="Attendance %" value={`${stats.percentage}%`} icon="fa-chart-pie" color="border-blue-600" />
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <Bar data={chartData} options={chartOptions} />
      </div>

      {/* Mark Attendance */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <i className="fas fa-plus-circle text-red-600 mr-2"></i>Mark Attendance
        </h2>
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="w-full sm:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={markDate}
              onChange={(e) => setMarkDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="w-full sm:flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
            <select
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_id})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={openMarkModal}
            className="w-full sm:w-auto px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            <i className="fas fa-check-circle mr-2"></i>Mark Attendance
          </button>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            Attendance Records - {formatDate(selectedDate)}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Check Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-8 text-center text-gray-500">
                    No attendance records for this date
                  </td>
                </tr>
              ) : (
                attendanceRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">{record.employees?.employee_id}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {record.employees?.first_name} {record.employees?.last_name}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.check_in || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.check_out || '-'}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{record.total_hours ?? '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(record.id)}
                        className="text-red-600 hover:text-red-800 transition-colors"
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mark Attendance Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Mark Attendance">
        <form onSubmit={handleMarkAttendance} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            >
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="halfday">Half Day</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check In Time</label>
            <input
              type="time"
              value={formData.check_in}
              onChange={(e) => setFormData({ ...formData, check_in: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check Out Time</label>
            <input
              type="time"
              value={formData.check_out}
              onChange={(e) => setFormData({ ...formData, check_out: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Attendance;
