import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CurrencyContext = createContext(null);

const CACHE_KEY = 'bzead_exchange_rate';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour
const FALLBACK_EXCHANGE_RATE = 110; // GBP to INR fallback when API is unreachable

const getCachedRate = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { rate, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) return rate;
  } catch { /* ignore */ }
  return null;
};

const setCachedRate = (rate) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ rate, timestamp: Date.now() }));
  } catch { /* ignore */ }
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState(() => localStorage.getItem('bzead_currency') || 'GBP');
  const [exchangeRate, setExchangeRate] = useState(getCachedRate() || null); // GBP to INR
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchExchangeRate = useCallback(async () => {
    const cached = getCachedRate();
    if (cached) {
      setExchangeRate(cached);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('https://api.exchangerate-api.com/v4/latest/GBP');
      if (!res.ok) throw new Error(`Exchange rate API error: ${res.status}`);
      const data = await res.json();
      const rate = data.rates?.INR;
      if (!rate) throw new Error('INR rate not found in response');
      setExchangeRate(rate);
      setCachedRate(rate);
    } catch (err) {
      setError(err.message);
      // Fallback rate
      if (!exchangeRate) setExchangeRate(FALLBACK_EXCHANGE_RATE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  const toggleCurrency = () => {
    const next = currency === 'GBP' ? 'INR' : 'GBP';
    setCurrency(next);
    localStorage.setItem('bzead_currency', next);
  };

  const formatCurrency = useCallback((amount) => {
    const num = Number(amount) || 0;

    if (currency === 'GBP') {
      return '£' + num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    // Convert GBP → INR
    const converted = num * (exchangeRate || FALLBACK_EXCHANGE_RATE);
    return '₹' + converted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [currency, exchangeRate]);

  const convertAmount = useCallback((amount) => {
    const num = Number(amount) || 0;
    if (currency === 'GBP') return num;
    return num * (exchangeRate || FALLBACK_EXCHANGE_RATE);
  }, [currency, exchangeRate]);

  return (
    <CurrencyContext.Provider value={{
      currency,
      toggleCurrency,
      formatCurrency,
      convertAmount,
      exchangeRate,
      loading,
      error,
      refetchRate: fetchExchangeRate,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};
