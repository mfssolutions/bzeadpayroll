import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (authUser) => {
    if (!authUser) {
      setUser(null);
      setProfile(null);
      setRole(null);
      return;
    }

    setUser(authUser);

    // Check admin_users first
    const { data: adminData, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('auth_uid', authUser.id)
      .single();

    if (adminData && !adminError) {
      setProfile(adminData);
      setRole('admin');
      // Update last_login
      await supabase
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('auth_uid', authUser.id);
      return;
    }

    // Check employee_credentials joined with employees
    const { data: empCredData, error: empCredError } = await supabase
      .from('employee_credentials')
      .select('*, employees(*)')
      .eq('auth_uid', authUser.id)
      .single();

    if (empCredData && !empCredError) {
      setProfile(empCredData.employees);
      setRole('employee');
      // Update last_login
      await supabase
        .from('employee_credentials')
        .update({ last_login: new Date().toISOString() })
        .eq('auth_uid', authUser.id);
      return;
    }

    // No profile found
    setProfile(null);
    setRole(null);
  };

  useEffect(() => {
    // Check existing session on mount
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true);
          await fetchUserProfile(session.user);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    await fetchUserProfile(data.user);
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setProfile(null);
    setRole(null);
  };

  const value = {
    user,
    profile,
    role,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
