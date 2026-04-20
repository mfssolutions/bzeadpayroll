const round2 = (n) => Math.round(n * 100) / 100;

export const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const parts = String(dateStr).split('T')[0].split('-');
  if (parts.length !== 3) return String(dateStr);
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
};

export const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
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

export const calculatePayroll = (basicSalary, config = {}, daysPresent = null, workingDays = null) => {
  const basic = Number(basicSalary) || 0;
  const hraRate = (Number(config.hra_percentage) || 40) / 100;
  const saRate = (Number(config.special_allowance_percentage) || 15) / 100;
  const pfRate = (Number(config.pf_rate) || 12) / 100;
  const ptAmount = Number(config.professional_tax) || 200;
  const tdsThreshold = Number(config.tds_threshold) || 50000;
  const tdsRate = (Number(config.tds_rate) || 10) / 100;

  // Prorate based on attendance if data is available
  const ratio = (daysPresent !== null && workingDays !== null && workingDays > 0)
    ? daysPresent / workingDays
    : 1;

  const hra = round2(basic * hraRate * ratio);
  const specialAllowance = round2(basic * saRate * ratio);
  const proratedBasic = round2(basic * ratio);
  const grossEarnings = round2(proratedBasic + hra + specialAllowance);
  const pfDeduction = round2(proratedBasic * pfRate);
  const professionalTax = round2(ptAmount);
  const tds = round2(grossEarnings > tdsThreshold ? (grossEarnings - tdsThreshold) * tdsRate : 0);
  const totalDeductions = round2(pfDeduction + professionalTax + tds);
  const netSalary = round2(grossEarnings - totalDeductions);

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
