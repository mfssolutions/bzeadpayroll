import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import toast from 'react-hot-toast';

const LeaveRequests = () => {
  const { profile } = useAuth();
  const { settings } = useCompanySettings();
  const LEAVE_TYPES = settings.leave_types || ['Sick Leave', 'Casual Leave', 'Earned Leave'];
  const [requests, setRequests] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyModal, setApplyModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({
    leave_type: 'Sick Leave', from_date: '', to_date: '', reason: '',
  });
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', action: null });

  const closeConfirmModal = () => setConfirmModal({ open: false, message: '', action: null });
  const runConfirm = () => { confirmModal.action?.(); closeConfirmModal(); };

  async function fetchRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('employee_id', profile.id)
      .order('created_at', { ascending: false });

    if (!error) setRequests(data || []);
    setLoading(false);
  }

  async function fetchLeaveBalance() {
    try {
      const { data, error } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', profile.id)
        .eq('year', new Date().getFullYear())
        .single();

      if (error) throw error;
      setLeaveBalance(data);
    } catch {
      toast.error('Failed to load leave balance');
    }
  }

  useEffect(() => {
    if (!profile?.id) return;
    const timer = setTimeout(() => {
      void fetchRequests();
      void fetchLeaveBalance();
    }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const calculateDuration = (from, to) => {
    if (!from || !to) return 0;
    const diff = new Date(to) - new Date(from);
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return days < 1 ? 0 : days;
  };

  const handleApply = async (e) => {
    e.preventDefault();
    if (new Date(form.from_date) > new Date(form.to_date)) {
      toast.error('From date cannot be after To date');
      return;
    }
    const duration = calculateDuration(form.from_date, form.to_date);
    if (duration < 1) {
      toast.error('Invalid date range');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('leave_requests')
        .insert({
          employee_id: profile.id,
          leave_type: form.leave_type,
          from_date: form.from_date,
          to_date: form.to_date,
          duration,
          reason: form.reason,
          status: 'pending',
        });

      if (error) throw error;
      toast.success('Leave request submitted');
      setApplyModal(false);
      setForm({ leave_type: 'Sick Leave', from_date: '', to_date: '', reason: '' });
      fetchRequests();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRequest = (id) => {
    setConfirmModal({
      open: true,
      message: 'Delete this leave request?',
      action: () => doDeleteRequest(id),
    });
  };

  const doDeleteRequest = async (id) => {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id);
    if (error) {
      toast.error('Error deleting request');
    } else {
      toast.success('Request deleted');
      fetchRequests();
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);
  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const approvedCount = requests.filter((r) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r) => r.status === 'rejected').length;

  const statusBadge = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status]}`}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Leave Requests</h1>
        <button onClick={() => setApplyModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          <i className="fas fa-plus mr-2"></i>Apply Leave
        </button>
      </div>

      {/* Leave Balance */}
      {leaveBalance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Sick Leave</p>
                <p className="text-xl font-bold text-red-600">{leaveBalance.sick_leave - leaveBalance.used_sick} <span className="text-sm font-normal text-gray-400">/ {leaveBalance.sick_leave}</span></p>
              </div>
              <i className="fas fa-thermometer-half text-2xl text-red-200"></i>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Casual Leave</p>
                <p className="text-xl font-bold text-orange-600">{leaveBalance.casual_leave - leaveBalance.used_casual} <span className="text-sm font-normal text-gray-400">/ {leaveBalance.casual_leave}</span></p>
              </div>
              <i className="fas fa-umbrella-beach text-2xl text-orange-200"></i>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-500">Earned Leave</p>
                <p className="text-xl font-bold text-yellow-600">{leaveBalance.earned_leave - leaveBalance.used_earned} <span className="text-sm font-normal text-gray-400">/ {leaveBalance.earned_leave}</span></p>
              </div>
              <i className="fas fa-star text-2xl text-yellow-200"></i>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatsCard title="Pending" value={pendingCount} icon="fa-clock" color="yellow" onClick={() => setFilter('pending')} />
        <StatsCard title="Approved" value={approvedCount} icon="fa-check-circle" color="green" onClick={() => setFilter('approved')} />
        <StatsCard title="Rejected" value={rejectedCount} icon="fa-times-circle" color="red" onClick={() => setFilter('rejected')} />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'pending', 'approved', 'rejected'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === f ? 'bg-red-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">#</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Leave Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">From</th>
                <th className="px-4 py-3 text-left text-sm font-medium">To</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Days</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Reason</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="8" className="text-center py-8 text-gray-400">No leave requests found</td></tr>
              ) : (
                filtered.map((r, i) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">#{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{r.leave_type}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(r.from_date)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(r.to_date)}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium text-gray-800">{r.duration}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{r.reason}</td>
                    <td className="px-4 py-3 text-center">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-center">
                      {r.status === 'pending' && (
                        <button onClick={() => deleteRequest(r.id)} className="text-red-600 hover:text-red-800 text-sm" title="Cancel">
                          <i className="fas fa-trash"></i>
                        </button>
                      )}
                      {r.status === 'rejected' && r.rejection_reason && (
                        <span className="text-xs text-gray-500" title={r.rejection_reason}>
                          <i className="fas fa-info-circle"></i>
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      <Modal isOpen={applyModal} onClose={() => setApplyModal(false)} title="Apply for Leave">
        <form onSubmit={handleApply} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
            <select
              value={form.leave_type}
              onChange={(e) => setForm({ ...form, leave_type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" required />
            </div>
          </div>
          {form.from_date && form.to_date && (
            <p className="text-sm text-gray-500">Duration: <strong>{calculateDuration(form.from_date, form.to_date)} day(s)</strong></p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
              rows={3} required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setApplyModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Modal */}
      <Modal isOpen={confirmModal.open} onClose={closeConfirmModal} title="Confirm" size="sm">
        <p className="text-gray-700 mb-6">{confirmModal.message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={closeConfirmModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
          <button onClick={runConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Confirm</button>
        </div>
      </Modal>
    </div>
  );
};

export default LeaveRequests;
