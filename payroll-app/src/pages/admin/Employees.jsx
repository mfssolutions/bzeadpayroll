import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../contexts/CurrencyContext';
import Modal from '../../components/ui/Modal';
import { useCompanySettings } from '../../hooks/useCompanySettings';

// ── Validation helpers ──
const NI_REGEX = /^[A-CEGHJ-PR-TW-Z]{2}\d{6}[A-D]$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSPORT_REGEX = /^[A-Z0-9]{6,20}$/i;
const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

// ── Reusable form components (defined outside to prevent re-mount on state change) ──
const InputField = ({ label, name, type = 'text', required, disabled, placeholder, maxLength, formData, onChange, errors, ...rest }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input
      type={type}
      name={name}
      value={formData[name]}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors ${
        errors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'
      } ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''}`}
      {...rest}
    />
    {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
  </div>
);

const SelectField = ({ label, name, options, required, placeholder = 'Select...', formData, onChange, errors }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <select
      name={name}
      value={formData[name]}
      onChange={onChange}
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors ${
        errors[name] ? 'border-red-400 bg-red-50' : 'border-gray-300'
      }`}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) =>
        typeof opt === 'string' ? (
          <option key={opt} value={opt}>{opt}</option>
        ) : (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        )
      )}
    </select>
    {errors[name] && <p className="mt-1 text-xs text-red-600">{errors[name]}</p>}
  </div>
);

const SectionHeader = ({ icon, title, description }) => (
  <div className="flex items-center gap-3 pb-3 mb-4 border-b border-gray-200">
    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <i className={`fas ${icon} text-red-600`}></i>
    </div>
    <div>
      <h4 className="text-base font-semibold text-gray-900">{title}</h4>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  </div>
);

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Internship', 'Contract', 'Freelance'];
const SALARY_BASIS_OPTIONS = ['Hourly', 'Weekly', 'Monthly'];
const SALARY_CYCLES = ['Last working day', '1st of month', '15th of month', '25th of month'];
const STARTER_DECLARATIONS = [
  { value: 'A', label: 'A — First job since 6 April (no P45)' },
  { value: 'B', label: 'B — Only job, but had another since 6 April' },
  { value: 'C', label: 'C — Have another job or pension' },
];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

const initialFormState = {
  // Section 1: Personal Details
  first_name: '',
  last_name: '',
  date_of_birth: '',
  gender: '',
  address_line1: '',
  address_line2: '',
  city: '',
  county: '',
  postcode: '',
  country: '',
  phone: '',
  personal_email: '',
  // Section 2: Employment & Pay
  department: '',
  designation: '',
  employment_type: '',
  salary_basis: 'Monthly',
  salary_amount: '',
  salary_cycle: '',
  bank_name: '',
  bank_account: '',
  sort_code: '',
  // Section 3: Compliance & Login
  joining_date: '',
  passport_no: '',
  ni_number: '',
  tax_code: '',
  starter_declaration: '',
  email: '',
  password: '',
};

const validateField = (name, value, formData, isNew) => {
  switch (name) {
    case 'first_name':
      if (!value.trim()) return 'First name is required';
      if (value.trim().length < 2) return 'Must be at least 2 characters';
      return '';
    case 'last_name':
      if (!value.trim()) return 'Last name is required';
      if (value.trim().length < 2) return 'Must be at least 2 characters';
      return '';
    case 'email':
      if (!value.trim()) return 'Login email is required';
      if (!EMAIL_REGEX.test(value)) return 'Enter a valid email address';
      return '';
    case 'password':
      if (isNew && (!value || value.length < 6)) return 'Password must be at least 6 characters';
      return '';
    case 'phone':
      if (value && !PHONE_REGEX.test(value)) return 'Enter a valid phone number';
      return '';
    case 'personal_email':
      if (value && !EMAIL_REGEX.test(value)) return 'Enter a valid email address';
      return '';
    case 'ni_number':
      if (value && !NI_REGEX.test(value.replace(/\s/g, ''))) return 'Invalid NI format (e.g. QQ123456A)';
      return '';
    case 'passport_no':
      if (value && !PASSPORT_REGEX.test(value)) return 'Invalid passport number format';
      return '';
    case 'salary_amount':
      if (value && (isNaN(Number(value)) || Number(value) < 0)) return 'Must be a positive number';
      return '';
    case 'sort_code':
      if (value && value.trim().length < 4) return 'Enter a valid bank routing/sort code';
      return '';
    case 'postcode':
      if (value && value.trim().length < 3) return 'Enter a valid postcode';
      return '';
    case 'tax_code':
      if (value && !/^[0-9]{1,4}[A-Z]{1,2}$|^(BR|D0|D1|NT|0T|K\d+)$/i.test(value)) return 'Enter a valid tax code (e.g. BR, 0T)';
      return '';
    default:
      return '';
  }
};

const Employees = () => {
  const { settings } = useCompanySettings();
  const { formatCurrency } = useCurrency();
  const departments = settings.departments || [];
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState(initialFormState);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState(1);
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', action: null });

  const closeConfirmModal = () => setConfirmModal({ open: false, message: '', action: null });
  const runConfirm = () => { confirmModal.action?.(); closeConfirmModal(); };

  async function fetchEmployees() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEmployees(data || []);
    } catch {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchEmployees();
    }, 0);

    return () => clearTimeout(timer);
  }, []);

  const openAddModal = () => {
    setEditingEmployee(null);
    setFormData({ ...initialFormState, country: settings.default_country || '', tax_code: settings.default_tax_code || '' });
    setErrors({});
    setActiveSection(1);
    setShowModal(true);
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      date_of_birth: emp.date_of_birth || '',
      gender: emp.gender || '',
      address_line1: emp.address_line1 || '',
      address_line2: emp.address_line2 || '',
      city: emp.city || '',
      county: emp.county || '',
      postcode: emp.postcode || '',
      country: emp.country || '',
      phone: emp.phone || '',
      personal_email: emp.personal_email || '',
      department: emp.department || '',
      designation: emp.designation || '',
      employment_type: emp.employment_type || '',
      salary_basis: emp.salary_basis || 'Monthly',
      salary_amount: emp.salary_amount || '',
      salary_cycle: emp.salary_cycle || '',
      bank_name: emp.bank_name || '',
      bank_account: emp.bank_account || '',
      sort_code: emp.sort_code || '',
      joining_date: emp.joining_date || '',
      passport_no: emp.passport_no || '',
      ni_number: emp.ni_number || '',
      tax_code: emp.tax_code || '',
      starter_declaration: emp.starter_declaration || '',
      email: emp.email || '',
      password: '',
    });
    setErrors({});
    setActiveSection(1);
    setShowModal(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    const err = validateField(name, value, formData, !editingEmployee);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const validateSection = (section) => {
    const sectionErrors = {};
    const isNew = !editingEmployee;

    if (section === 1) {
      ['first_name', 'last_name', 'phone', 'personal_email', 'postcode'].forEach((f) => {
        const err = validateField(f, formData[f], formData, isNew);
        if (err) sectionErrors[f] = err;
      });
    } else if (section === 2) {
      ['salary_amount', 'sort_code'].forEach((f) => {
        const err = validateField(f, formData[f], formData, isNew);
        if (err) sectionErrors[f] = err;
      });
    } else if (section === 3) {
      ['email', 'ni_number', 'passport_no', 'tax_code'].forEach((f) => {
        const err = validateField(f, formData[f], formData, isNew);
        if (err) sectionErrors[f] = err;
      });
      if (isNew) {
        const passErr = validateField('password', formData.password, formData, isNew);
        if (passErr) sectionErrors.password = passErr;
      }
    }

    setErrors((prev) => ({ ...prev, ...sectionErrors }));
    return Object.keys(sectionErrors).length === 0;
  };

  const validateAllSections = () => {
    const allErrors = {};
    const isNew = !editingEmployee;
    const allFields = ['first_name', 'last_name', 'phone', 'personal_email', 'postcode',
      'salary_amount', 'sort_code', 'email', 'ni_number', 'passport_no', 'tax_code'];
    if (isNew) allFields.push('password');

    allFields.forEach((f) => {
      const err = validateField(f, formData[f], formData, isNew);
      if (err) allErrors[f] = err;
    });

    setErrors(allErrors);
    return Object.keys(allErrors).length === 0;
  };

  const handleNext = () => {
    if (validateSection(activeSection)) {
      setActiveSection((s) => Math.min(s + 1, 3));
    }
  };

  const handlePrev = () => {
    setActiveSection((s) => Math.max(s - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateAllSections()) {
      const s1Fields = ['first_name', 'last_name', 'phone', 'personal_email', 'postcode'];
      const s2Fields = ['salary_amount', 'sort_code'];
      const s3Fields = ['email', 'ni_number', 'passport_no', 'tax_code', 'password'];

      const allErrors = {};
      const isNew = !editingEmployee;
      [...s1Fields, ...s2Fields, ...s3Fields].forEach((f) => {
        if (f === 'password' && !isNew) return;
        const err = validateField(f, formData[f], formData, isNew);
        if (err) allErrors[f] = err;
      });

      if (s1Fields.some((f) => allErrors[f])) setActiveSection(1);
      else if (s2Fields.some((f) => allErrors[f])) setActiveSection(2);
      else setActiveSection(3);

      toast.error('Please fix the errors before submitting');
      return;
    }

    try {
      setSubmitting(true);

      if (editingEmployee) {
        const { password: _password, email: _email, ...updateFields } = formData;
        const salaryNum = Number(updateFields.salary_amount) || 0;
        const { error } = await supabase
          .from('employees')
          .update({
            ...updateFields,
            salary_amount: salaryNum,
            basic_salary: salaryNum,
            ni_number: updateFields.ni_number ? updateFields.ni_number.replace(/\s/g, '').toUpperCase() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingEmployee.id);

        if (error) throw error;
        toast.success('Employee updated successfully');
      } else {
        const { data: result, error } = await supabase.rpc('admin_create_employee_v2', {
          p_first_name: formData.first_name.trim(),
          p_last_name: formData.last_name.trim(),
          p_email: formData.email.trim(),
          p_password: formData.password,
          p_phone: formData.phone || null,
          p_personal_email: formData.personal_email || null,
          p_date_of_birth: formData.date_of_birth || null,
          p_gender: formData.gender || null,
          p_address_line1: formData.address_line1 || null,
          p_address_line2: formData.address_line2 || null,
          p_city: formData.city || null,
          p_county: formData.county || null,
          p_postcode: formData.postcode || null,
          p_country: formData.country || null,
          p_department: formData.department || null,
          p_designation: formData.designation || null,
          p_employment_type: formData.employment_type || null,
          p_salary_basis: formData.salary_basis || null,
          p_salary_amount: Number(formData.salary_amount) || 0,
          p_salary_cycle: formData.salary_cycle || null,
          p_bank_name: formData.bank_name || null,
          p_bank_account: formData.bank_account || null,
          p_sort_code: formData.sort_code || null,
          p_joining_date: formData.joining_date || null,
          p_passport_no: formData.passport_no || null,
          p_ni_number: formData.ni_number ? formData.ni_number.replace(/\s/g, '').toUpperCase() : null,
          p_tax_code: formData.tax_code || null,
          p_starter_declaration: formData.starter_declaration || null,
        });

        if (error) throw error;
        toast.success(`Employee ${result.employee_id} created successfully`);
      }

      setShowModal(false);
      fetchEmployees();
    } catch (error) {
      const msg = error?.message || (editingEmployee ? 'Failed to update employee' : 'Failed to add employee');
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (emp) => {
    setConfirmModal({
      open: true,
      message: `Are you sure you want to delete ${emp.first_name} ${emp.last_name}?`,
      action: () => doDelete(emp),
    });
  };

  const doDelete = async (emp) => {
    try {
      const { error } = await supabase.from('employees').delete().eq('id', emp.id);
      if (error) throw error;
      toast.success('Employee deleted successfully');
      fetchEmployees();
    } catch {
      toast.error('Failed to delete employee');
    }
  };

  const handleToggleStatus = async (emp) => {
    const newStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      const { error } = await supabase
        .from('employees')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', emp.id);

      if (error) throw error;
      toast.success(`Employee ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchEmployees();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      emp.first_name?.toLowerCase().includes(q) ||
      emp.last_name?.toLowerCase().includes(q) ||
      emp.employee_id?.toLowerCase().includes(q) ||
      emp.department?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500 text-sm">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees Management</h1>
          <p className="text-gray-500 mt-1">{employees.length} total employees</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <i className="fas fa-plus"></i>
            Add Employee
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            placeholder="Search by name, employee ID, department, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-red-600 text-white">
                <th className="px-4 py-3 text-left text-sm font-semibold">ID</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Employee</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Department</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Designation</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Salary</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Type</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    {searchQuery ? 'No employees match your search' : 'No employees found. Click "Add Employee" to get started.'}
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => (
                  <tr key={emp.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">{emp.employee_id}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{emp.first_name} {emp.last_name}</div>
                      <div className="text-xs text-gray-500">{emp.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.department || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.designation || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                      {formatCurrency(emp.salary_amount || emp.basic_salary || 0)}
                      {emp.salary_basis && <span className="text-xs text-gray-400 ml-1">/{emp.salary_basis?.toLowerCase()}</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.employment_type || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(emp)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                          emp.status === 'active'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {emp.status === 'active' ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(emp)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add/Edit Employee Modal ── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingEmployee ? 'Edit Employee' : 'Add New Employee'}
        size="4xl"
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[
            { num: 1, label: 'Personal Details', icon: 'fa-user' },
            { num: 2, label: 'Employment & Pay', icon: 'fa-briefcase' },
            { num: 3, label: 'Compliance & Login', icon: 'fa-shield-alt' },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveSection(step.num)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeSection === step.num
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <i className={`fas ${step.icon} text-xs`}></i>
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.num}</span>
              </button>
              {i < 2 && <i className="fas fa-chevron-right text-gray-300 mx-1"></i>}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ═════ SECTION 1: Personal Details ═════ */}
          {activeSection === 1 && (
            <div className="animate-fade-in">
              <SectionHeader
                icon="fa-user"
                title="Personal Details"
                description="Employee's personal and contact information"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InputField formData={formData} onChange={handleChange} errors={errors} label="First Name" name="first_name" required maxLength={100} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Last Name" name="last_name" required maxLength={100} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Date of Birth" name="date_of_birth" type="date" />
                <SelectField formData={formData} onChange={handleChange} errors={errors} label="Gender" name="gender" options={GENDERS} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Phone" name="phone" type="tel" maxLength={20} placeholder="+44 7700 900000" />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Personal Email" name="personal_email" type="email" placeholder="personal@example.com" />
              </div>

              <div className="mt-5 mb-2">
                <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-map-marker-alt text-red-500 text-xs"></i> Full Address
                </h5>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="sm:col-span-2 lg:col-span-3">
                  <InputField formData={formData} onChange={handleChange} errors={errors} label="Address Line 1" name="address_line1" placeholder="House number and street" maxLength={200} />
                </div>
                <div className="sm:col-span-2 lg:col-span-3">
                  <InputField formData={formData} onChange={handleChange} errors={errors} label="Address Line 2" name="address_line2" placeholder="Apartment, suite, etc. (optional)" maxLength={200} />
                </div>
                <InputField formData={formData} onChange={handleChange} errors={errors} label="City / Town" name="city" maxLength={100} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="County" name="county" maxLength={100} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Postcode" name="postcode" maxLength={15} placeholder="e.g. SW1A 1AA / 670702" />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Country" name="country" maxLength={100} />
              </div>
            </div>
          )}

          {/* ═════ SECTION 2: Employment & Pay ═════ */}
          {activeSection === 2 && (
            <div className="animate-fade-in">
              <SectionHeader
                icon="fa-briefcase"
                title="Employment & Pay"
                description="Department, role, salary structure and bank details"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SelectField formData={formData} onChange={handleChange} errors={errors} label="Department" name="department" options={departments} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Designation / Job Title" name="designation" maxLength={100} />
                <SelectField formData={formData} onChange={handleChange} errors={errors} label="Employment Type" name="employment_type" options={EMPLOYMENT_TYPES} />
              </div>

              <div className="mt-5 mb-2">
                <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-pound-sign text-red-500 text-xs"></i> Salary Details
                </h5>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <SelectField formData={formData} onChange={handleChange} errors={errors} label="Salary Basis" name="salary_basis" options={SALARY_BASIS_OPTIONS} />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Salary Amount (£)" name="salary_amount" type="number" min="0" step="0.01" placeholder="0.00" />
                {formData.salary_basis === 'Monthly' && (
                  <SelectField formData={formData} onChange={handleChange} errors={errors} label="Salary Disbursal Day" name="salary_cycle" options={SALARY_CYCLES} />
                )}
              </div>

              <div className="mt-5 mb-2">
                <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-university text-red-500 text-xs"></i> Bank Account Details
                </h5>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Bank Name" name="bank_name" maxLength={100} placeholder="e.g. Barclays" />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Account Number" name="bank_account" maxLength={50} placeholder="12345678" />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Sort Code / IFSC / SWIFT" name="sort_code" maxLength={20} placeholder="e.g. 12-34-56 / FDRL0002" />
              </div>
            </div>
          )}

          {/* ═════ SECTION 3: Compliance & Login ═════ */}
          {activeSection === 3 && (
            <div className="animate-fade-in">
              <SectionHeader
                icon="fa-shield-alt"
                title="Compliance & Login"
                description="HMRC compliance details (Tax Code, NI, Starter Declaration) and login credentials"
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Date of Joining" name="joining_date" type="date" />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="Passport Number" name="passport_no" maxLength={20} placeholder="e.g. 123456789" />
                <InputField formData={formData} onChange={handleChange} errors={errors} label="National Insurance (NI) Number" name="ni_number" maxLength={13} placeholder="QQ 12 34 56 A" />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Code <span className="text-gray-400 text-xs">(from P45 or HMRC)</span>
                  </label>
                  <input
                    type="text"
                    name="tax_code"
                    value={formData.tax_code}
                    onChange={handleChange}
                    maxLength={10}
                    placeholder="Enter tax code"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors ${
                      errors.tax_code ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  />
                  <p className="mt-1 text-xs text-gray-400">Leave blank to use company default tax code from settings.</p>
                  {errors.tax_code && <p className="mt-1 text-xs text-red-600">{errors.tax_code}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Starter Declaration <span className="text-gray-400 text-xs">(HMRC Starter Checklist)</span>
                  </label>
                  <select
                    name="starter_declaration"
                    value={formData.starter_declaration}
                    onChange={handleChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-colors ${
                      errors.starter_declaration ? 'border-red-400 bg-red-50' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select declaration...</option>
                    {STARTER_DECLARATIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Required for new employees without a P45 from previous employer</p>
                  {errors.starter_declaration && <p className="mt-1 text-xs text-red-600">{errors.starter_declaration}</p>}
                </div>
              </div>

              <div className="mt-5 mb-2">
                <h5 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <i className="fas fa-lock text-red-500 text-xs"></i> Login Credentials
                </h5>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  formData={formData}
                  onChange={handleChange}
                  errors={errors}
                  label="Login Email"
                  name="email"
                  type="email"
                  required
                  disabled={!!editingEmployee}
                  placeholder="employee@company.com"
                />
                {!editingEmployee && (
                  <InputField
                    formData={formData}
                    onChange={handleChange}
                    errors={errors}
                    label="Login Password"
                    name="password"
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    minLength={6}
                  />
                )}
              </div>
            </div>
          )}

          {/* ── Navigation & Submit ── */}
          <div className="flex items-center justify-between pt-5 mt-5 border-t border-gray-200">
            <div>
              {activeSection > 1 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <i className="fas fa-arrow-left mr-2"></i> Previous
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              {activeSection < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Next <i className="fas fa-arrow-right ml-2"></i>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <i className="fas fa-spinner fa-spin"></i>
                      {editingEmployee ? 'Updating...' : 'Creating...'}
                    </span>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2"></i>
                      {editingEmployee ? 'Update Employee' : 'Create Employee'}
                    </>
                  )}
                </button>
              )}
            </div>
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

export default Employees;
