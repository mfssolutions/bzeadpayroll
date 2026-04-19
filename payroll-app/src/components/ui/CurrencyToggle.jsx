import { useCurrency } from '../../contexts/CurrencyContext';

const CurrencyToggle = () => {
  const { currency, toggleCurrency, exchangeRate, loading, error, refetchRate } = useCurrency();

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleCurrency}
        disabled={loading}
        className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 border ${
          currency === 'GBP'
            ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
            : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'
        } ${loading ? 'opacity-60 cursor-wait' : 'cursor-pointer'}`}
        title={exchangeRate ? `1 GBP = ${exchangeRate.toFixed(2)} INR` : 'Loading rate...'}
      >
        {loading && (
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
        )}
        <span>{currency === 'GBP' ? '£ GBP' : '₹ INR'}</span>
        <i className="fas fa-exchange-alt text-[10px]"></i>
      </button>
      {error && (
        <button
          onClick={refetchRate}
          className="text-red-500 hover:text-red-700 text-xs"
          title={`Error: ${error}. Click to retry.`}
        >
          <i className="fas fa-exclamation-triangle"></i>
        </button>
      )}
    </div>
  );
};

export default CurrencyToggle;
