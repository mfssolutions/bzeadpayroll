import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'company', label: 'Company', icon: 'fa-building' },
  { id: 'payroll', label: 'Payroll', icon: 'fa-coins' },
  { id: 'leave', label: 'Leave', icon: 'fa-calendar' },
  { id: 'notification', label: 'Notifications', icon: 'fa-bell' },
  { id: 'security', label: 'Security', icon: 'fa-shield-alt' },
];

const Settings = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('company_settings')
      .select('*');

    if (!error && data) {
      const map = {};
      data.forEach((s) => {
        map[s.setting_key] = s.setting_value;
      });
      setSettings(map);
    }
    setLoading(false);
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const saveSectionSettings = async (keys) => {
    setSaving(true);
    try {
      for (const key of keys) {
        await supabase
          .from('company_settings')
          .upsert(
            { setting_key: key, setting_value: settings[key] || '' },
            { onConflict: 'setting_key' }
          );
      }
      toast.success('Settings saved successfully');
    } catch (err) {
      toast.error('Error saving settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderInput = (key, label, type = 'text') => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {type === 'textarea' ? (
        <textarea
          value={settings[key] || ''}
          onChange={(e) => updateSetting(key, e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
          rows={3}
        />
      ) : type === 'checkbox' ? (
        <label className="inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={settings[key] === '1' || settings[key] === 'true'}
            onChange={(e) => updateSetting(key, e.target.checked ? '1' : '0')}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          <span className="ml-3 text-sm text-gray-600">{label}</span>
        </label>
      ) : (
        <input
          type={type}
          value={settings[key] || ''}
          onChange={(e) => updateSetting(key, e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      )}
    </div>
  );

  const renderCompany = () => {
    const keys = ['company_name', 'company_email', 'company_phone', 'company_website', 'gst_number', 'pan_number', 'company_address', 'departments'];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderInput('company_name', 'Company Name')}
          {renderInput('company_email', 'Company Email', 'email')}
          {renderInput('company_phone', 'Company Phone')}
          {renderInput('company_website', 'Company Website')}
          {renderInput('gst_number', 'GST Number')}
          {renderInput('pan_number', 'PAN Number')}
        </div>
        {renderInput('company_address', 'Company Address', 'textarea')}
        {renderInput('departments', 'Departments (JSON array, e.g. ["Engineering","HR"])')}
        <div className="flex justify-end pt-2">
          <button onClick={() => saveSectionSettings(keys)} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Company Settings'}
          </button>
        </div>
      </div>
    );
  };

  const renderPayroll = () => {
    const keys = ['pf_rate', 'esi_rate', 'professional_tax', 'salary_day', 'hra_percentage', 'special_allowance_percentage', 'tds_threshold', 'tds_rate', 'work_start_time', 'work_end_time', 'halfday_end_time'];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderInput('pf_rate', 'PF Rate (%)', 'number')}
          {renderInput('esi_rate', 'ESI Rate (%)', 'number')}
          {renderInput('professional_tax', 'Professional Tax (₹)', 'number')}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary Day</label>
            <select
              value={settings.salary_day || '1'}
              onChange={(e) => updateSetting('salary_day', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {renderInput('hra_percentage', 'HRA Percentage (%)', 'number')}
          {renderInput('special_allowance_percentage', 'Special Allowance (%)', 'number')}
          {renderInput('tds_threshold', 'TDS Threshold (₹)', 'number')}
          {renderInput('tds_rate', 'TDS Rate (%)', 'number')}
          {renderInput('work_start_time', 'Work Start Time')}
          {renderInput('work_end_time', 'Work End Time')}
          {renderInput('halfday_end_time', 'Half Day End Time')}
        </div>
        <div className="flex justify-end pt-2">
          <button onClick={() => saveSectionSettings(keys)} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Payroll Settings'}
          </button>
        </div>
      </div>
    );
  };

  const renderLeave = () => {
    const keys = ['sick_leave_default', 'casual_leave_default', 'earned_leave_default', 'max_continuous_leave', 'leave_approval_required', 'leave_types'];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderInput('sick_leave_default', 'Sick Leave (days/year)', 'number')}
          {renderInput('casual_leave_default', 'Casual Leave (days/year)', 'number')}
          {renderInput('earned_leave_default', 'Earned Leave (days/year)', 'number')}
          {renderInput('max_continuous_leave', 'Max Continuous Leave (days)', 'number')}
        </div>
        {renderInput('leave_approval_required', 'Leave Approval Required', 'checkbox')}
        {renderInput('leave_types', 'Leave Types (JSON array, e.g. [\"Sick Leave\",\"Casual Leave\"])')}
        <div className="flex justify-end pt-2">
          <button onClick={() => saveSectionSettings(keys)} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Leave Settings'}
          </button>
        </div>
      </div>
    );
  };

  const renderNotification = () => {
    const keys = ['email_notifications', 'salary_slip_email', 'leave_request_email', 'attendance_reminder'];
    return (
      <div className="space-y-4">
        {renderInput('email_notifications', 'Email Notifications', 'checkbox')}
        {renderInput('salary_slip_email', 'Salary Slip Email', 'checkbox')}
        {renderInput('leave_request_email', 'Leave Request Email', 'checkbox')}
        {renderInput('attendance_reminder', 'Attendance Reminder', 'checkbox')}
        <div className="flex justify-end pt-2">
          <button onClick={() => saveSectionSettings(keys)} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Notification Settings'}
          </button>
        </div>
      </div>
    );
  };

  const renderSecurity = () => {
    const keys = ['session_timeout', 'password_expiry_days', 'max_login_attempts', 'two_factor_auth'];
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderInput('session_timeout', 'Session Timeout (minutes)', 'number')}
          {renderInput('password_expiry_days', 'Password Expiry (days)', 'number')}
          {renderInput('max_login_attempts', 'Max Login Attempts', 'number')}
        </div>
        {renderInput('two_factor_auth', 'Two-Factor Authentication', 'checkbox')}
        <div className="flex justify-end pt-2">
          <button onClick={() => saveSectionSettings(keys)} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Security Settings'}
          </button>
        </div>
      </div>
    );
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
      <h1 className="text-2xl font-bold text-gray-800">Settings</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex overflow-x-auto border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-red-600 text-red-600 bg-red-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <i className={`fas ${tab.icon}`}></i>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'company' && renderCompany()}
          {activeTab === 'payroll' && renderPayroll()}
          {activeTab === 'leave' && renderLeave()}
          {activeTab === 'notification' && renderNotification()}
          {activeTab === 'security' && renderSecurity()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
