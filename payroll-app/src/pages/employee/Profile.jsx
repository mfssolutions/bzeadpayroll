import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import { formatCurrency, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, profile } = useAuth();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    phone: '', gender: '', date_of_birth: '', address: '', emergency_name: '', emergency_phone: '',
  });
  const [passwordForm, setPasswordForm] = useState({ new_password: '', confirm_password: '' });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('id', profile?.id)
      .single();

    if (!error && data) {
      setEmployee(data);
      setEditForm({
        phone: data.phone || '',
        gender: data.gender || '',
        date_of_birth: data.date_of_birth || '',
        address: data.address || '',
        emergency_name: data.emergency_name || '',
        emergency_phone: data.emergency_phone || '',
      });
    }
    setLoading(false);
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Use SECURITY DEFINER RPC — only allows safe fields
      // (prevents salary/status tampering from crafted API calls)
      const { error } = await supabase.rpc('update_employee_profile', {
        p_phone: editForm.phone || null,
        p_gender: editForm.gender || null,
        p_date_of_birth: editForm.date_of_birth || null,
        p_address: editForm.address || null,
        p_emergency_name: editForm.emergency_name || null,
        p_emergency_phone: editForm.emergency_phone || null,
      });

      if (error) throw error;
      toast.success('Profile updated successfully');
      setEditModal(false);
      fetchProfile();
    } catch (err) {
      toast.error('Error updating profile: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new_password });
      if (error) throw error;
      toast.success('Password changed successfully');
      setPasswordModal(false);
      setPasswordForm({ new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error('Error changing password: ' + err.message);
    } finally {
      setSaving(false);
    }
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
      <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>

      {/* Profile Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <i className="fas fa-user text-3xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold">{employee?.first_name} {employee?.last_name}</h2>
            <p className="opacity-80">{employee?.designation || 'Employee'}</p>
            <p className="text-sm opacity-70">{employee?.employee_id}</p>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-user mr-2 text-red-600"></i>Personal Information
          </h3>
          <div className="space-y-3">
            {[
              ['Full Name', `${employee?.first_name} ${employee?.last_name}`],
              ['Email', employee?.email],
              ['Phone', employee?.phone || 'Not set'],
              ['Gender', employee?.gender || 'Not set'],
              ['Date of Birth', employee?.date_of_birth ? formatDate(employee.date_of_birth) : 'Not set'],
              ['Address', employee?.address || 'Not set'],
            ].map(([label, value]) => (
              <div key={label}>
                <label className="text-sm text-gray-500">{label}</label>
                <p className="font-medium text-gray-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Employment */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-briefcase mr-2 text-red-600"></i>Employment & Banking
          </h3>
          <div className="space-y-3">
            {[
              ['Department', employee?.department || 'Not assigned'],
              ['Designation', employee?.designation || 'Not assigned'],
              ['Joining Date', employee?.joining_date ? formatDate(employee.joining_date) : 'Not set'],
              ['Basic Salary', formatCurrency(employee?.basic_salary)],
              ['Bank Account', employee?.bank_account || 'Not set'],
              ['PAN Number', employee?.pan_no || 'Not set'],
              ['PF Number', employee?.pf_no || 'Not set'],
            ].map(([label, value]) => (
              <div key={label}>
                <label className="text-sm text-gray-500">{label}</label>
                <p className={`font-medium ${label === 'Basic Salary' ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Emergency Contact */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          <i className="fas fa-phone-alt mr-2 text-red-600"></i>Emergency Contact
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-500">Contact Name</label>
            <p className="font-medium text-gray-800">{employee?.emergency_name || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm text-gray-500">Contact Phone</label>
            <p className="font-medium text-gray-800">{employee?.emergency_phone || 'Not set'}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-4">
        <button onClick={() => setEditModal(true)} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          <i className="fas fa-edit mr-2"></i>Edit Profile
        </button>
        <button onClick={() => setPasswordModal(true)} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          <i className="fas fa-lock mr-2"></i>Change Password
        </button>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Profile">
        <form onSubmit={handleEditProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
            <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent">
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" rows={3} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Name</label>
            <input type="text" value={editForm.emergency_name} onChange={(e) => setEditForm({ ...editForm, emergency_name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact Phone</label>
            <input type="text" value={editForm.emergency_phone} onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal isOpen={passwordModal} onClose={() => setPasswordModal(false)} title="Change Password">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" required minLength={6} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input type="password" value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent" required minLength={6} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setPasswordModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50">
              {saving ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Profile;
