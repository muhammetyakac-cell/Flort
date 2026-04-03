import { useState } from 'react';
import { supabase } from '../supabase';

const initialAuth = { username: '', password: '' };

export function useAuth({ adminPassword, setStatus }) {
  const [mode, setMode] = useState('user');
  const [authForm, setAuthForm] = useState(initialAuth);
  const [loading, setLoading] = useState(false);
  const [memberSession, setMemberSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  async function signUp() {
    if (mode === 'admin') return setStatus('Admin kayıt olamaz.');
    if (!authForm.username || !authForm.password) return setStatus('Kullanıcı adı ve şifre zorunlu.');

    setLoading(true);
    setStatus('');

    const { error } = await supabase.from('members').insert({
      username: authForm.username.trim(),
      password: authForm.password,
    });

    setLoading(false);
    if (error) return setStatus(`Kayıt başarısız: ${error.message}`);
    setStatus('Kayıt başarılı. Giriş yapabilirsin.');
  }

  async function signIn() {
    setLoading(true);
    setStatus('');

    if (mode === 'admin') {
      if (!adminPassword) {
        setLoading(false);
        return setStatus('VITE_ADMIN_PASSWORD eksik.');
      }
      if (authForm.password !== adminPassword) {
        setLoading(false);
        return setStatus('Admin şifresi hatalı.');
      }
      setIsAdmin(true);
      setMemberSession(null);
      setLoading(false);
      return setStatus('Admin girişi başarılı.');
    }

    if (!authForm.username || !authForm.password) {
      setLoading(false);
      return setStatus('Kullanıcı adı ve şifre girmen gerekiyor.');
    }

    const { data, error } = await supabase
      .from('members')
      .select('id, username')
      .eq('username', authForm.username.trim())
      .eq('password', authForm.password)
      .single();

    setLoading(false);
    if (error || !data) return setStatus('Kullanıcı adı veya şifre hatalı.');

    setMemberSession(data);
    setIsAdmin(false);
    setStatus('Giriş başarılı.');
  }

  function signOut(onAfterSignOut) {
    setMemberSession(null);
    setIsAdmin(false);
    if (typeof onAfterSignOut === 'function') {
      onAfterSignOut();
    }
    setStatus('Çıkış yapıldı.');
  }

  return {
    mode,
    setMode,
    authForm,
    setAuthForm,
    loading,
    memberSession,
    isAdmin,
    signIn,
    signUp,
    signOut,
  };
}
