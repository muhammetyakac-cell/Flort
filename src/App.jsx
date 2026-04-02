import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const initialAuth = { username: '', password: '' };
const initialProfile = { name: '', age: '', gender: '', hobbies: '' };
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

export default function App() {
  const [mode, setMode] = useState('user');
  const [authForm, setAuthForm] = useState(initialAuth);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const [virtualProfiles, setVirtualProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  const [profileForm, setProfileForm] = useState(initialProfile);
  const [incomingThreads, setIncomingThreads] = useState([]);
  const [selectedThread, setSelectedThread] = useState(null);
  const [adminReply, setAdminReply] = useState('');

  const selectedProfile = useMemo(
    () => virtualProfiles.find((p) => p.id === selectedProfileId) || null,
    [selectedProfileId, virtualProfiles]
  );

  useEffect(() => {
    if (!currentUser) return;
    fetchVirtualProfiles();
    if (currentUser.role === 'admin') fetchIncomingThreads();
  }, [currentUser]);

  useEffect(() => {
    if (!selectedProfileId || !currentUser || currentUser.role !== 'member') return;
    fetchMessages(selectedProfileId);
  }, [selectedProfileId, currentUser]);

  async function signUp() {
    if (!authForm.username || !authForm.password) return setStatus('Kullanıcı adı ve şifre zorunlu.');

    if (mode === 'admin') return setStatus('Admin kayıt olamaz.');

    setLoading(true);
    setStatus('');

    const { error } = await supabase.from('app_users').insert({
      username: authForm.username.trim(),
      password: authForm.password,
      role: 'member',
    });

    setLoading(false);
    if (error) return setStatus(error.message);
    setStatus('Kayıt başarılı.');
  }

  async function signIn() {
    setLoading(true);
    setStatus('');

    if (mode === 'admin') {
      if (!ADMIN_PASSWORD) {
        setLoading(false);
        return setStatus('VITE_ADMIN_PASSWORD eksik.');
      }
      if (authForm.password !== ADMIN_PASSWORD) {
        setLoading(false);
        return setStatus('Admin şifresi hatalı.');
      }

      const { data: existingAdmin } = await supabase
        .from('app_users')
        .select('*')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (!existingAdmin) {
        const { error: createError } = await supabase.from('app_users').insert({
          username: 'admin',
          password: ADMIN_PASSWORD,
          role: 'admin',
        });
        if (createError) {
          setLoading(false);
          return setStatus(`Admin hesabı oluşturulamadı: ${createError.message}`);
        }
      }

      const { data: adminUser, error: adminError } = await supabase
        .from('app_users')
        .select('*')
        .eq('role', 'admin')
        .eq('password', ADMIN_PASSWORD)
        .limit(1)
        .single();

      setLoading(false);
      if (adminError) return setStatus(adminError.message);
      setCurrentUser(adminUser);
      return setStatus('Admin girişi başarılı.');
    }

    if (!authForm.username || !authForm.password) {
      setLoading(false);
      return setStatus('Kullanıcı adı ve şifre zorunlu.');
    }

    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('username', authForm.username.trim())
      .eq('password', authForm.password)
      .eq('role', 'member')
      .limit(1)
      .single();

    setLoading(false);
    if (error) return setStatus('Kullanıcı adı veya şifre hatalı.');
    setCurrentUser(data);
    setStatus('Giriş başarılı.');
  }

  function signOut() {
    setCurrentUser(null);
    setSelectedProfileId(null);
    setMessages([]);
    setIncomingThreads([]);
    setSelectedThread(null);
    setStatus('Çıkış yapıldı.');
  }

  async function fetchVirtualProfiles() {
    const { data, error } = await supabase.from('virtual_profiles').select('*').order('created_at', { ascending: true });
    if (error) return setStatus(error.message);
    setVirtualProfiles(data || []);
    if (!selectedProfileId && data?.length) setSelectedProfileId(data[0].id);
  }

  async function fetchMessages(profileId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('virtual_profile_id', profileId)
      .eq('member_id', currentUser.id)
      .order('created_at', { ascending: true });

    if (error) return setStatus(error.message);
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedProfileId) return;

    const { error } = await supabase.from('messages').insert({
      member_id: currentUser.id,
      virtual_profile_id: selectedProfileId,
      sender_role: 'member',
      content: newMessage.trim(),
    });

    if (error) return setStatus(error.message);
    setNewMessage('');
    fetchMessages(selectedProfileId);
  }

  async function createVirtualProfile() {
    if (!profileForm.name || !profileForm.age || !profileForm.gender) return setStatus('İsim, yaş, cinsiyet zorunlu.');

    const { error } = await supabase.from('virtual_profiles').insert({
      name: profileForm.name,
      age: Number(profileForm.age),
      gender: profileForm.gender,
      hobbies: profileForm.hobbies,
      created_by: currentUser.id,
    });

    if (error) return setStatus(error.message);
    setProfileForm(initialProfile);
    fetchVirtualProfiles();
    fetchIncomingThreads();
    setStatus('Sanal profil oluşturuldu.');
  }

  async function fetchIncomingThreads() {
    const { data, error } = await supabase.from('admin_threads').select('*').order('last_message_at', { ascending: true });
    if (error) return setStatus(error.message);
    setIncomingThreads(data || []);
    if (!selectedThread && data?.length) setSelectedThread(data[0]);
  }

  async function sendAdminReply() {
    if (!selectedThread || !adminReply.trim()) return;

    const { error } = await supabase.from('messages').insert({
      member_id: selectedThread.member_id,
      virtual_profile_id: selectedThread.virtual_profile_id,
      sender_role: 'virtual',
      content: adminReply.trim(),
    });

    if (error) return setStatus(error.message);
    setAdminReply('');
    fetchIncomingThreads();
    setStatus('Yanıt gönderildi.');
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="layout">
      <header>
        <h1>Flort Chat</h1>
        {!currentUser && (
          <button className="linkish" onClick={() => setMode(mode === 'user' ? 'admin' : 'user')}>
            {mode === 'user' ? 'Admin girişi' : 'Kullanıcı girişi'}
          </button>
        )}
        {currentUser && <button onClick={signOut}>Çıkış</button>}
      </header>

      {!currentUser ? (
        <section className="card">
          <h2>{mode === 'admin' ? 'Admin girişi' : 'Kullanıcı giriş/kayıt'}</h2>
          <input
            placeholder={mode === 'admin' ? 'Admin için kullanıcı adı boş bırakılacak' : 'Kullanıcı adı'}
            value={mode === 'admin' ? '' : authForm.username}
            onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))}
            disabled={mode === 'admin'}
          />
          <input
            placeholder="Şifre"
            type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))}
          />
          <div className="row">
            <button disabled={loading} onClick={signIn}>Giriş yap</button>
            {mode !== 'admin' && <button disabled={loading} onClick={signUp}>Kayıt ol</button>}
          </div>
        </section>
      ) : isAdmin ? (
        <main className="admin-grid">
          <section className="card">
            <h3>Sanal Profil Oluştur</h3>
            <input placeholder="Ad" value={profileForm.name} onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))} />
            <input placeholder="Yaş" type="number" value={profileForm.age} onChange={(e) => setProfileForm((s) => ({ ...s, age: e.target.value }))} />
            <input placeholder="Cinsiyet" value={profileForm.gender} onChange={(e) => setProfileForm((s) => ({ ...s, gender: e.target.value }))} />
            <textarea placeholder="Hobiler" value={profileForm.hobbies} onChange={(e) => setProfileForm((s) => ({ ...s, hobbies: e.target.value }))} />
            <button onClick={createVirtualProfile}>Kaydet</button>
          </section>

          <section className="card">
            <h3>Mesajlara Cevap Penceresi</h3>
            <div className="thread-list">
              {incomingThreads.map((thread) => (
                <button key={`${thread.member_id}-${thread.virtual_profile_id}`} onClick={() => setSelectedThread(thread)}>
                  {thread.member_username} → {thread.virtual_name}
                </button>
              ))}
            </div>
            <textarea placeholder="Sanal profil cevabı" value={adminReply} onChange={(e) => setAdminReply(e.target.value)} />
            <button onClick={sendAdminReply}>Yanıt Gönder</button>
          </section>
        </main>
      ) : (
        <main className="user-grid">
          <aside className="card">
            <h3>Sanal Profiller</h3>
            {virtualProfiles.map((profile) => (
              <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={selectedProfileId === profile.id ? 'active' : ''}>
                {profile.name}
              </button>
            ))}
            {selectedProfile && (
              <div className="meta">
                <p><strong>Yaş:</strong> {selectedProfile.age}</p>
                <p><strong>Cinsiyet:</strong> {selectedProfile.gender}</p>
                <p><strong>Hobiler:</strong> {selectedProfile.hobbies || '-'}</p>
              </div>
            )}
          </aside>
          <section className="card">
            <h3>Sohbet</h3>
            <div className="chat-box">
              {messages.map((msg) => (
                <div key={msg.id} className={`msg ${msg.sender_role}`}>
                  <span>{msg.sender_role === 'member' ? 'Sen' : selectedProfile?.name}</span>
                  <p>{msg.content}</p>
                </div>
              ))}
            </div>
            <div className="row">
              <input placeholder="Mesaj yaz" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} />
              <button onClick={sendMessage}>Gönder</button>
            </div>
          </section>
        </main>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
