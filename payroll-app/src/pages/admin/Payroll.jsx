import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import StatsCard from '../../components/ui/StatsCard';
import Modal from '../../components/ui/Modal';
import { MONTHS, calculatePayroll, getYearRange } from '../../utils/helpers';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import toast from 'react-hot-toast';
import { Bar } from 'react-chartjs-2';

const Payroll = () => {
  const { settings } = useCompanySettings();
  const { formatCurrency } = useCurrency();
  const [payrolls, setPayrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [processMonth, setProcessMonth] = useState(MONTHS[new Date().getMonth()]);
  const [processYear, setProcessYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState(false);
  const [payslipModal, setPayslipModal] = useState({ open: false, payroll: null, employee: null });
  const [confirmModal, setConfirmModal] = useState({ open: false, message: '', action: null });

  const closeConfirmModal = () => setConfirmModal({ open: false, message: '', action: null });
  const runConfirm = () => { confirmModal.action?.(); closeConfirmModal(); };

  async function fetchPayrolls() {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll')
      .select('*, employees(first_name, last_name, employee_id, department, designation, bank_account, ni_number)')
      .eq('year', selectedYear)
      .order('generated_at', { ascending: false });

    if (!error) setPayrolls(data || []);
    setLoading(false);
  }

  useEffect(() => {
    const timer = setTimeout(() => { void fetchPayrolls(); }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear]);

  const processPayroll = async () => {
    setConfirmModal({
      open: true,
      message: `Process payroll for ${processMonth} ${processYear} for all active employees?`,
      action: () => doProcessPayroll(),
    });
  };

  const doProcessPayroll = async () => {
    setProcessing(true);
    try {
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active');

      if (empError) throw empError;

      // Calculate working days (weekdays) in the selected month
      const monthIndex = MONTHS.indexOf(processMonth);
      const daysInMonth = new Date(processYear, monthIndex + 1, 0).getDate();
      let workingDaysCount = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(processYear, monthIndex, d).getDay();
        if (day !== 0 && day !== 6) workingDaysCount++;
      }

      // Fetch attendance for all employees in this month
      const monthStr = String(monthIndex + 1).padStart(2, '0');
      const startDate = `${processYear}-${monthStr}-01`;
      const endDate = `${processYear}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
      const { data: attendanceData } = await supabase
        .from('attendance')
        .select('employee_id, status')
        .gte('attendance_date', startDate)
        .lte('attendance_date', endDate);

      const attendanceMap = {};
      (attendanceData || []).forEach((a) => {
        if (!attendanceMap[a.employee_id]) attendanceMap[a.employee_id] = 0;
        if (a.status === 'present') attendanceMap[a.employee_id] += 1;
        else if (a.status === 'halfday') attendanceMap[a.employee_id] += 0.5;
      });

      for (const emp of employees) {
        const daysPresent = attendanceMap[emp.id] ?? 0;
        const calc = calculatePayroll(emp.basic_salary, settings, daysPresent, workingDaysCount);

        const { error } = await supabase
          .from('payroll')
          .upsert({
            employee_id: emp.id,
            month: processMonth,
            year: processYear,
            basic_salary: emp.basic_salary,
            hra: calc.hra,
            special_allowance: calc.specialAllowance,
            conveyance_allowance: 0,
            medical_allowance: 0,
            performance_bonus: 0,
            festival_bonus: 0,
            other_earnings: 0,
            bonus: 0,
            gross_earnings: calc.grossEarnings,
            pf_deduction: calc.pfDeduction,
            professional_tax: calc.professionalTax,
            tds: calc.tds,
            esic_deduction: 0,
            loan_deduction: 0,
            other_deductions: 0,
            total_deductions: calc.totalDeductions,
            net_salary: calc.netSalary,
            working_days: workingDaysCount,
            days_present: daysPresent,
            status: 'draft',
          }, { onConflict: 'employee_id,month,year' });

        if (error) throw error;
      }

      toast.success(`Payroll processed for ${employees.length} employees`);
      fetchPayrolls();
    } catch (err) {
      toast.error('Error processing payroll: ' + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const updateStatus = async (id, status) => {
    const { error } = await supabase
      .from('payroll')
      .update({ status })
      .eq('id', id);

    if (error) {
      toast.error('Error updating status');
    } else {
      toast.success(`Status updated to ${status}`);
      fetchPayrolls();
    }
  };

  const deletePayroll = (id) => {
    setConfirmModal({
      open: true,
      message: 'Delete this payroll record?',
      action: () => doDeletePayroll(id),
    });
  };

  const doDeletePayroll = async (id) => {
    const { error } = await supabase.from('payroll').delete().eq('id', id);
    if (error) {
      toast.error('Error deleting payroll');
    } else {
      toast.success('Payroll record deleted');
      fetchPayrolls();
    }
  };

  const viewPayslip = (p) => {
    setPayslipModal({ open: true, payroll: p, employee: p.employees });
  };

  const totalGross = payrolls.reduce((s, p) => s + Number(p.gross_earnings || 0), 0);
  const totalDeductions = payrolls.reduce((s, p) => s + Number(p.total_deductions || 0), 0);
  const totalNet = payrolls.reduce((s, p) => s + Number(p.net_salary || 0), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Payroll Management</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600">Year:</label>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard title="Total Gross Earnings" value={formatCurrency(totalGross)} icon="fa-money-bill-wave" color="blue" />
        <StatsCard title="Total Deductions" value={formatCurrency(totalDeductions)} icon="fa-minus-circle" color="red" />
        <StatsCard title="Total Net Salary" value={formatCurrency(totalNet)} icon="fa-wallet" color="green" />
      </div>

      {/* Process Payroll */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          <i className="fas fa-cogs mr-2 text-red-600"></i>Process Payroll
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Month</label>
            <select
              value={processMonth}
              onChange={(e) => setProcessMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Year</label>
            <input
              type="number"
              value={processYear}
              onChange={(e) => setProcessYear(Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={processPayroll}
            disabled={processing}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {processing ? (
              <><i className="fas fa-spinner fa-spin mr-2"></i>Processing...</>
            ) : (
              <><i className="fas fa-play mr-2"></i>Process Payroll</>
            )}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Employee ID</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Employee</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Department</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Month-Year</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Gross</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Deductions</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Net Salary</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="9" className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : payrolls.length === 0 ? (
                <tr><td colSpan="9" className="text-center py-8 text-gray-400">No payroll records found</td></tr>
              ) : (
                payrolls.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{p.employees?.employee_id}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.employees?.first_name} {p.employees?.last_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.employees?.department}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{p.month} {p.year}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-gray-800">{formatCurrency(p.gross_earnings)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(p.total_deductions)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(p.net_salary)}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={p.status}
                        onChange={(e) => updateStatus(p.id, e.target.value)}
                        className={`text-xs font-medium rounded-full px-3 py-1 border-0 cursor-pointer ${
                          p.status === 'paid' ? 'bg-green-100 text-green-700' :
                          p.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        <option value="draft">Draft</option>
                        <option value="approved">Approved</option>
                        <option value="paid">Paid</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => viewPayslip(p)} className="text-blue-600 hover:text-blue-800" title="View Payslip">
                          <i className="fas fa-eye"></i>
                        </button>
                        <button onClick={() => deletePayroll(p.id)} className="text-red-600 hover:text-red-800" title="Delete">
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

      {/* Payslip Modal */}
      <Modal isOpen={payslipModal.open} onClose={() => setPayslipModal({ open: false, payroll: null, employee: null })} title="Payslip" size="lg">
        {payslipModal.payroll && payslipModal.employee && (
          <div className="space-y-6" id="payslip-content">
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800">{settings.company_name || ''}</h2>
              <p className="text-gray-500">Payslip for {payslipModal.payroll.month} {payslipModal.payroll.year}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Employee ID:</span><br /><strong>{payslipModal.employee.employee_id}</strong></div>
              <div><span className="text-gray-500">Name:</span><br /><strong>{payslipModal.employee.first_name} {payslipModal.employee.last_name}</strong></div>
              <div><span className="text-gray-500">Department:</span><br /><strong>{payslipModal.employee.department}</strong></div>
              <div><span className="text-gray-500">Designation:</span><br /><strong>{payslipModal.employee.designation}</strong></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-green-700 mb-2 border-b pb-1">Earnings</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(payslipModal.payroll.basic_salary)}</span></div>
                  <div className="flex justify-between"><span>HRA</span><span>{formatCurrency(payslipModal.payroll.hra)}</span></div>
                  <div className="flex justify-between"><span>Special Allowance</span><span>{formatCurrency(payslipModal.payroll.special_allowance)}</span></div>
                  {Number(payslipModal.payroll.bonus) > 0 && (
                    <div className="flex justify-between"><span>Bonus</span><span>{formatCurrency(payslipModal.payroll.bonus)}</span></div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Gross</span><span>{formatCurrency(payslipModal.payroll.gross_earnings)}</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-red-700 mb-2 border-b pb-1">Deductions</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>PF Deduction</span><span>{formatCurrency(payslipModal.payroll.pf_deduction)}</span></div>
                  <div className="flex justify-between"><span>Professional Tax</span><span>{formatCurrency(payslipModal.payroll.professional_tax)}</span></div>
                  {Number(payslipModal.payroll.tds) > 0 && (
                    <div className="flex justify-between"><span>TDS</span><span>{formatCurrency(payslipModal.payroll.tds)}</span></div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Deductions</span><span>{formatCurrency(payslipModal.payroll.total_deductions)}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 text-center">
              <span className="text-gray-600 text-sm">Net Salary</span>
              <p className="text-3xl font-bold text-green-700">{formatCurrency(payslipModal.payroll.net_salary)}</p>
            </div>

            <div className="flex justify-between text-xs text-gray-400 border-t pt-2">
              <span>Working Days: {payslipModal.payroll.working_days} | Present: {payslipModal.payroll.days_present}</span>
              <span>Status: {payslipModal.payroll.status}</span>
            </div>

            <div className="flex justify-end no-print">
              <button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
                <i className="fas fa-print mr-2"></i>Print
              </button>
            </div>
          </div>
        )}
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

export default Payroll;
