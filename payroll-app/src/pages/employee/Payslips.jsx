import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import StatsCard from '../../components/ui/StatsCard';
import Modal from '../../components/ui/Modal';
import { MONTHS, convertNumberToWords, getYearRange } from '../../utils/helpers';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useCompanySettings } from '../../hooks/useCompanySettings';
import toast from 'react-hot-toast';

const Payslips = () => {
  const { profile } = useAuth();
  const { settings } = useCompanySettings();
  const { formatCurrency, currency } = useCurrency();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [payslipModal, setPayslipModal] = useState({ open: false, payslip: null });

  async function fetchPayslips() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payroll')
        .select('*')
        .eq('employee_id', profile.id)
        .eq('year', selectedYear)
        .order('generated_at', { ascending: false });

      if (error) throw error;
      setPayslips(data || []);
    } catch {
      toast.error('Failed to load payslips');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!profile?.id) return;
    const timer = setTimeout(() => { void fetchPayslips(); }, 0);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, selectedYear]);

  const latestPayslip = payslips[0];
  const totalEarnings = payslips.reduce((s, p) => s + Number(p.gross_earnings || 0), 0);
  const totalDeductions = payslips.reduce((s, p) => s + Number(p.total_deductions || 0), 0);
  const totalNet = payslips.reduce((s, p) => s + Number(p.net_salary || 0), 0);

  const viewPayslip = (p) => setPayslipModal({ open: true, payslip: p });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">My Payslips</h1>
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

      {/* Current Month Salary */}
      {latestPayslip && (
        <div className="bg-gradient-to-r from-red-600 to-red-800 rounded-xl p-6 text-white">
          <p className="text-sm opacity-80">Latest Payslip — {latestPayslip.month} {latestPayslip.year}</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(latestPayslip.net_salary)}</p>
        </div>
      )}

      {/* YTD Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatsCard title="Total Earnings" value={formatCurrency(totalEarnings)} icon="fa-arrow-up" color="green" />
        <StatsCard title="Total Deductions" value={formatCurrency(totalDeductions)} icon="fa-arrow-down" color="red" />
        <StatsCard title="Net Salary Received" value={formatCurrency(totalNet)} icon="fa-wallet" color="blue" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Month-Year</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Gross Earnings</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Total Deductions</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Net Salary</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">Loading...</td></tr>
              ) : payslips.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-8 text-gray-400">No payslips found</td></tr>
              ) : (
                payslips.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">{p.month} {p.year}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">{formatCurrency(p.gross_earnings)}</td>
                    <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(p.total_deductions)}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">{formatCurrency(p.net_salary)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        p.status === 'paid' ? 'bg-green-100 text-green-700' :
                        p.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => viewPayslip(p)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        <i className="fas fa-eye mr-1"></i>View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslip Modal */}
      <Modal isOpen={payslipModal.open} onClose={() => setPayslipModal({ open: false, payslip: null })} title="Payslip" size="lg">
        {payslipModal.payslip && (
          <div className="space-y-6" id="payslip-content">
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800">{settings.company_name || ''}</h2>
              <p className="text-gray-500">Payslip for {payslipModal.payslip.month} {payslipModal.payslip.year}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Employee ID:</span><br /><strong>{profile?.employee_id}</strong></div>
              <div><span className="text-gray-500">Name:</span><br /><strong>{profile?.first_name} {profile?.last_name}</strong></div>
              <div><span className="text-gray-500">Department:</span><br /><strong>{profile?.department}</strong></div>
              <div><span className="text-gray-500">Designation:</span><br /><strong>{profile?.designation}</strong></div>
              <div><span className="text-gray-500">NI Number:</span><br /><strong>{profile?.ni_number || 'N/A'}</strong></div>
              <div><span className="text-gray-500">Bank Account:</span><br /><strong>{profile?.bank_account || 'N/A'}</strong></div>
              <div><span className="text-gray-500">Month/Year:</span><br /><strong>{payslipModal.payslip.month} {payslipModal.payslip.year}</strong></div>
              <div><span className="text-gray-500">Status:</span><br /><strong>{payslipModal.payslip.status}</strong></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-green-700 mb-2 border-b pb-1">Earnings</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Basic Salary</span><span>{formatCurrency(payslipModal.payslip.basic_salary)}</span></div>
                  <div className="flex justify-between"><span>HRA</span><span>{formatCurrency(payslipModal.payslip.hra)}</span></div>
                  {Number(payslipModal.payslip.conveyance_allowance) > 0 && <div className="flex justify-between"><span>Conveyance Allowance</span><span>{formatCurrency(payslipModal.payslip.conveyance_allowance)}</span></div>}
                  {Number(payslipModal.payslip.medical_allowance) > 0 && <div className="flex justify-between"><span>Medical Allowance</span><span>{formatCurrency(payslipModal.payslip.medical_allowance)}</span></div>}
                  <div className="flex justify-between"><span>Special Allowance</span><span>{formatCurrency(payslipModal.payslip.special_allowance)}</span></div>
                  {Number(payslipModal.payslip.performance_bonus) > 0 && <div className="flex justify-between"><span>Performance Bonus</span><span>{formatCurrency(payslipModal.payslip.performance_bonus)}</span></div>}
                  {Number(payslipModal.payslip.festival_bonus) > 0 && <div className="flex justify-between"><span>Festival Bonus</span><span>{formatCurrency(payslipModal.payslip.festival_bonus)}</span></div>}
                  {Number(payslipModal.payslip.other_earnings) > 0 && <div className="flex justify-between"><span>Other Earnings</span><span>{formatCurrency(payslipModal.payslip.other_earnings)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Gross</span><span>{formatCurrency(payslipModal.payslip.gross_earnings)}</span></div>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-red-700 mb-2 border-b pb-1">Deductions</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>PF Deduction</span><span>{formatCurrency(payslipModal.payslip.pf_deduction)}</span></div>
                  <div className="flex justify-between"><span>Professional Tax</span><span>{formatCurrency(payslipModal.payslip.professional_tax)}</span></div>
                  {Number(payslipModal.payslip.tds) > 0 && <div className="flex justify-between"><span>TDS</span><span>{formatCurrency(payslipModal.payslip.tds)}</span></div>}
                  {Number(payslipModal.payslip.esic_deduction) > 0 && <div className="flex justify-between"><span>ESIC</span><span>{formatCurrency(payslipModal.payslip.esic_deduction)}</span></div>}
                  {Number(payslipModal.payslip.loan_deduction) > 0 && <div className="flex justify-between"><span>Loan Deduction</span><span>{formatCurrency(payslipModal.payslip.loan_deduction)}</span></div>}
                  {Number(payslipModal.payslip.other_deductions) > 0 && <div className="flex justify-between"><span>Other Deductions</span><span>{formatCurrency(payslipModal.payslip.other_deductions)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Total Deductions</span><span>{formatCurrency(payslipModal.payslip.total_deductions)}</span></div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 rounded-lg p-4 text-center">
              <span className="text-gray-600 text-sm">Net Salary</span>
              <p className="text-3xl font-bold text-green-700">{formatCurrency(payslipModal.payslip.net_salary)}</p>
              <p className="text-sm text-gray-500 mt-1">{currency === 'GBP' ? 'Pounds' : 'Rupees'} {convertNumberToWords(Math.floor(Number(payslipModal.payslip.net_salary)))} Only</p>
            </div>

            <div className="flex justify-between text-xs text-gray-400 border-t pt-2">
              <span>Working Days: {payslipModal.payslip.working_days} | Present: {payslipModal.payslip.days_present} | Absent: {payslipModal.payslip.working_days - payslipModal.payslip.days_present}</span>
              <span>Generated: {new Date(payslipModal.payslip.generated_at).toLocaleString()}</span>
            </div>

            <p className="text-center text-xs text-gray-400 border-t pt-2">This is a computer-generated document and does not require a signature.</p>

            <div className="flex justify-end no-print">
              <button onClick={() => window.print()} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm">
                <i className="fas fa-print mr-2"></i>Print
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Payslips;
