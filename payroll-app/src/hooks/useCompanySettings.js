import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

let cachedSettings = null;
let cachedError = null;
let fetchPromise = null;

const fetchSettings = async () => {
  const { data, error } = await supabase
    .from('company_settings')
    .select('setting_key, setting_value, setting_type');

  if (error) return { settings: {}, error: error.message };

  const map = {};
  (data || []).forEach((s) => {
    if (s.setting_type === 'json') {
      try { map[s.setting_key] = JSON.parse(s.setting_value); } catch { map[s.setting_key] = s.setting_value; }
    } else if (s.setting_type === 'number') {
      map[s.setting_key] = Number(s.setting_value) || 0;
    } else {
      map[s.setting_key] = s.setting_value;
    }
  });
  return { settings: map, error: null };
};

export const useCompanySettings = () => {
  const [settings, setSettings] = useState(cachedSettings || {});
  const [loading, setLoading] = useState(!cachedSettings);
  const [settingsError, setSettingsError] = useState(cachedError);

  useEffect(() => {
    if (cachedSettings !== null) {
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchSettings();
    }

    fetchPromise.then(({ settings: data, error }) => {
      cachedSettings = data;
      cachedError = error;
      setSettings(data);
      setSettingsError(error);
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    fetchPromise = null;
    cachedSettings = null;
    cachedError = null;
    setLoading(true);
    const { settings: data, error } = await fetchSettings();
    cachedSettings = data;
    cachedError = error;
    setSettings(data);
    setSettingsError(error);
    setLoading(false);
  };

  return { settings, loading, settingsError, refresh };
};

export const getSettingValue = (settings, key, fallback) => {
  return settings[key] !== undefined ? settings[key] : fallback;
};
