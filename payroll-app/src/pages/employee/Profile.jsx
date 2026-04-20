import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';
import { useCurrency } from '../../contexts/CurrencyContext';
import toast from 'react-hot-toast';

const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;
const POSTCODE_MIN_LENGTH = 3;

const Profile = () => {
  const { user, profile } = useAuth();
  const { formatCurrency } = useCurrency();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErrors, setEditErrors] = useState({});
  const [editForm, setEditForm] = useState({
    phone: '', gender: '', date_of_birth: '',
    address_line1: '', address_line2: '', city: '', county: '', postcode: '', country: '',
    emergency_name: '', emergency_phone: '',
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
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        city: data.city || '',
        county: data.county || '',
        postcode: data.postcode || '',
        country: data.country || 'United Kingdom',
        emergency_name: data.emergency_name || '',
        emergency_phone: data.emergency_phone || '',
      });
    }
    setLoading(false);
  };

  const validateEditForm = () => {
    const errors = {};
    if (editForm.phone && !PHONE_REGEX.test(editForm.phone)) {
      errors.phone = 'Enter a valid phone number';
    }
    if (editForm.postcode && editForm.postcode.trim().length < POSTCODE_MIN_LENGTH) {
      errors.postcode = 'Enter a valid postcode';
    }
    if (editForm.emergency_phone && !PHONE_REGEX.test(editForm.emergency_phone)) {
      errors.emergency_phone = 'Enter a valid phone number';
    }
    if (editForm.date_of_birth) {
      const dob = new Date(editForm.date_of_birth);
      const today = new Date();
      if (dob >= today) errors.date_of_birth = 'Date of birth must be in the past';
      const age = today.getFullYear() - dob.getFullYear();
      if (age > 120) errors.date_of_birth = 'Enter a valid date of birth';
    }
    setEditErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    if (!validateEditForm()) {
      toast.error('Please fix the errors before saving');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.rpc('update_employee_profile_v2', {
        p_phone: editForm.phone || null,
        p_gender: editForm.gender || null,
        p_date_of_birth: editForm.date_of_birth || null,
        p_address_line1: editForm.address_line1 || null,
        p_address_line2: editForm.address_line2 || null,
        p_city: editForm.city || null,
        p_county: editForm.county || null,
        p_postcode: editForm.postcode || null,
        p_country: editForm.country || null,
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

  const buildAddress = () => {
    const parts = [
      employee?.address_line1,
      employee?.address_line2,
      employee?.city,
      employee?.county,
      employee?.postcode,
      employee?.country,
    ].filter(Boolean);
    // Fallback to legacy address field if structured fields are empty
    return parts.length > 0 ? parts.join(', ') : employee?.address || 'Not set';
  };

  const inputClass = (field) =>
    `w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent ${
      editErrors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300'
    }`;

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
              ['Personal Email', employee?.personal_email || 'Not set'],
              ['Phone', employee?.phone || 'Not set'],
              ['Gender', employee?.gender || 'Not set'],
              ['Date of Birth', employee?.date_of_birth ? formatDate(employee.date_of_birth) : 'Not set'],
              ['Address', buildAddress()],
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
              ['Employment Type', employee?.employment_type || 'Not set'],
              ['Joining Date', employee?.joining_date ? formatDate(employee.joining_date) : 'Not set'],
              ['Salary', formatCurrency(employee?.salary_amount || employee?.basic_salary)],
              ['Bank Name', employee?.bank_name || 'Not set'],
              ['Bank Account', employee?.bank_account || 'Not set'],
              ['Sort Code', employee?.sort_code || 'Not set'],
              ['NI Number', employee?.ni_number || 'Not set'],
              ['Tax Code', employee?.tax_code || 'Not set'],
              ['Passport No', employee?.passport_no || 'Not set'],
            ].map(([label, value]) => (
              <div key={label}>
                <label className="text-sm text-gray-500">{label}</label>
                <p className={`font-medium ${label === 'Salary' ? 'text-green-600' : 'text-gray-800'}`}>{value}</p>
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
        <button onClick={() => { setEditErrors({}); setEditModal(true); }} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          <i className="fas fa-edit mr-2"></i>Edit Profile
        </button>
        <button onClick={() => setPasswordModal(true)} className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
          <i className="fas fa-lock mr-2"></i>Change Password
        </button>
      </div>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title="Edit Profile" size="lg">
        <form onSubmit={handleEditProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input type="text" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                placeholder="+44 7700 900000" className={inputClass('phone')} />
              {editErrors.phone && <p className="mt-1 text-xs text-red-600">{editErrors.phone}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                className={inputClass('gender')}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })}
              className={inputClass('date_of_birth')} />
            {editErrors.date_of_birth && <p className="mt-1 text-xs text-red-600">{editErrors.date_of_birth}</p>}
          </div>

          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pt-2">
            <i className="fas fa-map-marker-alt text-red-500 text-xs"></i> Address
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 1</label>
              <input type="text" value={editForm.address_line1} onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })}
                placeholder="House number and street" className={inputClass('address_line1')} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address Line 2</label>
              <input type="text" value={editForm.address_line2} onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })}
                placeholder="Apartment, suite, etc. (optional)" className={inputClass('address_line2')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City / Town</label>
              <input type="text" value={editForm.city} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                className={inputClass('city')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
              <input type="text" value={editForm.county} onChange={(e) => setEditForm({ ...editForm, county: e.target.value })}
                className={inputClass('county')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postcode</label>
              <input type="text" value={editForm.postcode} onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                placeholder="e.g. SW1A 1AA / 670702" className={inputClass('postcode')} />
              {editErrors.postcode && <p className="mt-1 text-xs text-red-600">{editErrors.postcode}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <input type="text" value={editForm.country} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                className={inputClass('country')} />
            </div>
          </div>

          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 pt-2">
            <i className="fas fa-phone-alt text-red-500 text-xs"></i> Emergency Contact
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Name</label>
              <input type="text" value={editForm.emergency_name} onChange={(e) => setEditForm({ ...editForm, emergency_name: e.target.value })}
                className={inputClass('emergency_name')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
              <input type="text" value={editForm.emergency_phone} onChange={(e) => setEditForm({ ...editForm, emergency_phone: e.target.value })}
                placeholder="+44 7700 900000" className={inputClass('emergency_phone')} />
              {editErrors.emergency_phone && <p className="mt-1 text-xs text-red-600">{editErrors.emergency_phone}</p>}
            </div>
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
