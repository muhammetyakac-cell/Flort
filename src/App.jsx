import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

const initialAuth = { username: '', password: '' };
const initialProfile = { name: '', age: '', gender: '', hobbies: '' };

export default function App() {
  const [mode, setMode] = useState('user');
  const [authForm, setAuthForm] = useState(initialAuth);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const [memberSession, setMemberSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

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

  const loggedIn = !!memberSession || isAdmin;

  useEffect(() => {
    if (!loggedIn) return;
    fetchVirtualProfiles();
    if (isAdmin) fetchIncomingThreads();
  }, [loggedIn, isAdmin]);

  useEffect(() => {
    if (!memberSession || !selectedProfileId || isAdmin) return;
    fetchMessages(selectedProfileId);
  }, [memberSession, selectedProfileId, isAdmin]);

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
      if (!ADMIN_PASSWORD) {
        setLoading(false);
        return setStatus('VITE_ADMIN_PASSWORD eksik.');
      }
      if (authForm.password !== ADMIN_PASSWORD) {
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

  function signOut() {
    setMemberSession(null);
    setIsAdmin(false);
    setSelectedProfileId(null);
    setMessages([]);
    setIncomingThreads([]);
    setSelectedThread(null);
    setStatus('Çıkış yapıldı.');
  }

  async function fetchVirtualProfiles() {
    const { data, error } = await supabase
      .from('virtual_profiles')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) return setStatus(error.message);
    setVirtualProfiles(data || []);
    if (!selectedProfileId && data?.length) setSelectedProfileId(data[0].id);
  }

  async function fetchMessages(profileId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('virtual_profile_id', profileId)
      .eq('member_id', memberSession.id)
      .order('created_at', { ascending: true });

    if (error) return setStatus(error.message);
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!memberSession || !selectedProfileId || !newMessage.trim()) return;

    const { data: memberExists } = await supabase
      .from('members')
      .select('id')
      .eq('id', memberSession.id)
      .maybeSingle();

    if (!memberExists) {
      return setStatus('Oturum üyeliği veritabanında bulunamadı. Lütfen çıkış yapıp tekrar giriş yap.');
    }

    const { error } = await supabase.from('messages').insert({
      member_id: memberSession.id,
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
    });
    if (error) return setStatus(error.message);
    setProfileForm(initialProfile);
    fetchVirtualProfiles();
    fetchIncomingThreads();
    setStatus('Sanal profil oluşturuldu.');
  }

  async function fetchIncomingThreads() {
    const { data, error } = await supabase
      .from('admin_threads')
      .select('*')
      .order('last_message_at', { ascending: true });
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

  return (
    <div className="layout">
      <header>
        <h1>Flort Chat</h1>
        {!loggedIn && (
          <button className="linkish" onClick={() => setMode(mode === 'user' ? 'admin' : 'user')}>
            {mode === 'user' ? 'Admin girişi' : 'Kullanıcı girişi'}
          </button>
        )}
        {loggedIn && <button onClick={signOut}>Çıkış</button>}
      </header>

      {!loggedIn ? (
        <section className="card">
          <h2>{mode === 'admin' ? 'Admin girişi' : 'Kullanıcı giriş/kayıt'}</h2>
          <input
            placeholder={mode === 'admin' ? 'Admin için kullanıcı adı kullanılmıyor' : 'Kullanıcı adı'}
            disabled={mode === 'admin'}
            value={mode === 'admin' ? '' : authForm.username}
            onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))}
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
                <button
                  key={`${thread.member_id}-${thread.virtual_profile_id}`}
                  onClick={() => setSelectedThread(thread)}
                  className={selectedThread?.member_id === thread.member_id && selectedThread?.virtual_profile_id === thread.virtual_profile_id ? 'active' : ''}
                >
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
