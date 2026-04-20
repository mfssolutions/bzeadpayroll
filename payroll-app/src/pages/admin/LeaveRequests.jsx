import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import Modal from '../../components/ui/Modal';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import { formatDate } from '../../utils/helpers';

const TABS = [
  { key: 'all', label: 'All Requests' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const LeaveRequests = () => {
  const { profile } = useAuth();
  const { settings } = useCompanySettings();
  const [loading, setLoading] = useState(true);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', action: null });

  const closeConfirmModal = () => setConfirmModal({ open: false, message: '', action: null });
  const runConfirm = () => { confirmModal.action?.(); closeConfirmModal(); };

  async function fetchLeaveRequests() {
    try {
      setLoading(true);

      // Fetch stats counts
      const [pendingRes, approvedRes, rejectedRes] = await Promise.all([
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);

      setStats({
        pending: pendingRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
      });

      // Fetch leave requests with employee data
      let query = supabase
        .from('leave_requests')
        .select('*, employees(first_name, last_name, employee_id, department)')
        .order('created_at', { ascending: false });

      if (activeTab !== 'all') {
        query = query.eq('status', activeTab);
      }

      const { data, error } = await query;
      if (error) throw error;
      setLeaveRequests(data || []);
    } catch {
      toast.error('Failed to load leave requests');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => { void fetchLeaveRequests(); }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const calculateDuration = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 0;
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diff = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const handleApprove = (request) => {
    setConfirmModal({
      open: true,
      message: 'Are you sure you want to approve this leave request?',
      action: () => doApprove(request),
    });
  };

  const doApprove = async (request) => {
    try {
      setSubmitting(true);
      const duration = calculateDuration(request.from_date, request.to_date);

      // Update leave request status
      const { error: updateError } = await supabase
        .from('leave_requests')
        .update({
          status: 'approved',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      // Update leave balances — map leave type to balance column dynamically
      const leaveTypes = Array.isArray(settings.leave_types) ? settings.leave_types : ['Sick Leave', 'Casual Leave', 'Earned Leave'];
      const balanceFields = ['used_sick', 'used_casual', 'used_earned'];
      const leaveFieldMap = {};
      leaveTypes.forEach((type, i) => {
        if (i < balanceFields.length) leaveFieldMap[type] = balanceFields[i];
      });
      const field = leaveFieldMap[request.leave_type];
      if (!field) {
        toast.error(`Cannot update balance: unknown leave type "${request.leave_type}"`);
        return;
      }

      // Get current balance
      const { data: balance, error: balError } = await supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', request.employee_id)
        .single();

      if (balError) throw balError;

      const { error: balUpdateError } = await supabase
        .from('leave_balances')
        .update({ [field]: (balance[field] || 0) + duration })
        .eq('employee_id', request.employee_id);

      if (balUpdateError) throw balUpdateError;

      toast.success('Leave request approved');
      fetchLeaveRequests();
    } catch {
      toast.error('Failed to approve leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const openRejectModal = (id) => {
    setRejectingId(id);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    try {
      setSubmitting(true);
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason.trim(),
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', rejectingId);

      if (error) throw error;
      toast.success('Leave request rejected');
      setShowRejectModal(false);
      fetchLeaveRequests();
    } catch {
      toast.error('Failed to reject leave request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      open: true,
      message: 'Are you sure you want to delete this leave request?',
      action: () => doDelete(id),
    });
  };

  const doDelete = async (id) => {
    try {
      // Find the request to check if it was approved (need to restore balance)
      const request = leaveRequests.find((r) => r.id === id);
      if (request && request.status === 'approved') {
        const duration = calculateDuration(request.from_date, request.to_date);
        const leaveTypes = Array.isArray(settings.leave_types) ? settings.leave_types : ['Sick Leave', 'Casual Leave', 'Earned Leave'];
        const balanceFields = ['used_sick', 'used_casual', 'used_earned'];
        const leaveFieldMap = {};
        leaveTypes.forEach((type, i) => {
          if (i < balanceFields.length) leaveFieldMap[type] = balanceFields[i];
        });
        const field = leaveFieldMap[request.leave_type];
        if (field) {
          const { data: balance } = await supabase
            .from('leave_balances')
            .select('*')
            .eq('employee_id', request.employee_id)
            .single();

          if (balance) {
            await supabase
              .from('leave_balances')
              .update({ [field]: Math.max(0, (balance[field] || 0) - duration) })
              .eq('employee_id', request.employee_id);
          }
        }
      }

      const { error } = await supabase.from('leave_requests').delete().eq('id', id);
      if (error) throw error;
      toast.success('Leave request deleted');
      fetchLeaveRequests();
    } catch {
      toast.error('Failed to delete leave request');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading && leaveRequests.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Leave Requests</h1>
        <p className="text-gray-500 mt-1">Manage employee leave requests</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatsCard
          title="Pending"
          value={stats.pending}
          icon="fa-clock"
          color="border-yellow-600"
          onClick={() => setActiveTab('pending')}
        />
        <StatsCard
          title="Approved"
          value={stats.approved}
          icon="fa-check-circle"
          color="border-green-600"
          onClick={() => setActiveTab('approved')}
        />
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          icon="fa-times-circle"
          color="border-red-600"
          onClick={() => setActiveTab('rejected')}
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leave Requests Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leave Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">From - To</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {leaveRequests.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-gray-500">
                    No leave requests found
                  </td>
                </tr>
              ) : (
                leaveRequests.map((req) => {
                  const duration = calculateDuration(req.from_date, req.to_date);
                  return (
                    <tr key={req.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">#{req.id}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="text-gray-900">
                          {req.employees?.first_name} {req.employees?.last_name}
                        </div>
                        <div className="text-gray-400 text-xs">{req.employees?.employee_id}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.employees?.department || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{req.leave_type}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(req.from_date)} - {formatDate(req.to_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{duration} day{duration !== 1 ? 's' : ''}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <span title={req.reason}>
                          {req.reason && req.reason.length > 40
                            ? req.reason.substring(0, 40) + '...'
                            : req.reason || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(req.status)}</td>
                      <td className="px-6 py-4">
                        {req.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(req)}
                              disabled={submitting}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <i className="fas fa-check mr-1"></i>Approve
                            </button>
                            <button
                              onClick={() => openRejectModal(req.id)}
                              disabled={submitting}
                              className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                            >
                              <i className="fas fa-times mr-1"></i>Reject
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDelete(req.id)}
                            className="text-red-600 hover:text-red-800 transition-colors"
                            title="Delete"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Leave Request">
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Enter reason for rejection..."
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {submitting ? 'Rejecting...' : 'Reject Request'}
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
