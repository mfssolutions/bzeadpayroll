import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

let cachedSettings = null;
let fetchPromise = null;

const fetchSettings = async () => {
  const { data, error } = await supabase
    .from('company_settings')
    .select('setting_key, setting_value, setting_type');

  if (error) return {};

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
  return map;
};

export const useCompanySettings = () => {
  const [settings, setSettings] = useState(cachedSettings || {});
  const [loading, setLoading] = useState(!cachedSettings);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      setLoading(false);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = fetchSettings();
    }

    fetchPromise.then((data) => {
      cachedSettings = data;
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const refresh = async () => {
    fetchPromise = null;
    cachedSettings = null;
    setLoading(true);
    const data = await fetchSettings();
    cachedSettings = data;
    setSettings(data);
    setLoading(false);
  };

  return { settings, loading, refresh };
};

export const getSettingValue = (settings, key, fallback) => {
  return settings[key] !== undefined ? settings[key] : fallback;
};
