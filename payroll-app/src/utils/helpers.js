export const formatCurrency = (amount, currency = 'GBP') => {
  const num = Number(amount) || 0;
  if (currency === 'INR') {
    return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${minutes}`;
};

export const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

export const getMonthName = (monthNum) => {
  return MONTHS[monthNum - 1] || '';
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// DEPARTMENTS removed — now fetched from company_settings via useCompanySettings hook

export const getYearRange = () => {
  const currentYear = new Date().getFullYear();
  return [currentYear - 1, currentYear, currentYear + 1];
};

export const generateEmployeeId = (companyCode, existingCount) => {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);
  const seq = String((existingCount || 0) + 1).padStart(4, '0');
  return `${companyCode || 'BZD'}${mm}${yy}${seq}`;
};

export const convertNumberToWords = (num) => {
  if (num === 0) return 'Zero';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n) => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numToWords(n % 100) : '');
    return '';
  };

  const abs = Math.abs(Math.floor(num));
  let result = '';

  if (abs >= 1000000) {
    result += numToWords(Math.floor(abs / 1000000)) + ' Million ';
  }
  if (abs >= 1000) {
    result += numToWords(Math.floor((abs % 1000000) / 1000)) + ' Thousand ';
  }
  if (abs % 1000 > 0) {
    result += numToWords(abs % 1000);
  }

  result = result.trim();
  if (num < 0) result = 'Minus ' + result;

  return result || 'Zero';
};

export const calculatePayroll = (basicSalary, config = {}) => {
  const basic = Number(basicSalary) || 0;
  const hraRate = (Number(config.hra_percentage) || 40) / 100;
  const saRate = (Number(config.special_allowance_percentage) || 15) / 100;
  const pfRate = (Number(config.pf_rate) || 12) / 100;
  const ptAmount = Number(config.professional_tax) || 200;
  const tdsThreshold = Number(config.tds_threshold) || 50000;
  const tdsRate = (Number(config.tds_rate) || 10) / 100;

  const hra = basic * hraRate;
  const specialAllowance = basic * saRate;
  const grossEarnings = basic + hra + specialAllowance;
  const pfDeduction = basic * pfRate;
  const professionalTax = ptAmount;
  const tds = grossEarnings > tdsThreshold ? (grossEarnings - tdsThreshold) * tdsRate : 0;
  const totalDeductions = pfDeduction + professionalTax + tds;
  const netSalary = grossEarnings - totalDeductions;

  return {
    hra,
    specialAllowance,
    grossEarnings,
    pfDeduction,
    professionalTax,
    tds,
    totalDeductions,
    netSalary,
  };
};
