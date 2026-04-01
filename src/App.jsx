import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const initialAuth = { email: '', password: '', username: '' };
const initialProfile = { name: '', age: '', gender: '', hobbies: '' };

export default function App() {
  const [session, setSession] = useState(null);
  const [mode, setMode] = useState('user');
  const [authForm, setAuthForm] = useState(initialAuth);
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
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    if (mode === 'admin') {
      fetchVirtualProfiles();
      fetchIncomingThreads();
      return;
    }

    fetchVirtualProfiles();
  }, [session, mode]);

  useEffect(() => {
    if (!selectedProfileId || !session?.user || mode !== 'user') return;
    fetchMessages(selectedProfileId);
  }, [selectedProfileId, session, mode]);

  async function signUp() {
    setLoading(true);
    setStatus('');

    const { error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
      options: {
        data: {
          username: authForm.username,
          role: mode,
        },
      },
    });

    setLoading(false);
    if (error) return setStatus(error.message);
    setStatus('Kayıt başarılı. E-postanı doğrula ve giriş yap.');
  }

  async function signIn() {
    setLoading(true);
    setStatus('');

    const { data, error } = await supabase.auth.signInWithPassword({
      email: authForm.email,
      password: authForm.password,
    });

    setLoading(false);

    if (error) return setStatus(error.message);

    const role = data.user?.user_metadata?.role || 'user';
    if (role !== mode) {
      await supabase.auth.signOut();
      return setStatus('Bu giriş tipi için yetkin yok.');
    }

    setStatus('Giriş başarılı.');
  }

  async function signOut() {
    await supabase.auth.signOut();
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
      .eq('member_id', session.user.id)
      .order('created_at', { ascending: true });

    if (error) return setStatus(error.message);
    setMessages(data || []);
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedProfileId) return;

    const { error } = await supabase.from('messages').insert({
      member_id: session.user.id,
      virtual_profile_id: selectedProfileId,
      sender_role: 'member',
      content: newMessage.trim(),
    });

    if (error) return setStatus(error.message);
    setNewMessage('');
    fetchMessages(selectedProfileId);
  }

  async function createVirtualProfile() {
    if (!profileForm.name || !profileForm.age || !profileForm.gender) {
      return setStatus('İsim, yaş ve cinsiyet zorunlu.');
    }

    const { error } = await supabase.from('virtual_profiles').insert({
      name: profileForm.name,
      age: Number(profileForm.age),
      gender: profileForm.gender,
      hobbies: profileForm.hobbies,
      created_by: session.user.id,
    });

    if (error) return setStatus(error.message);

    setProfileForm(initialProfile);
    setStatus('Sanal profil oluşturuldu.');
    fetchVirtualProfiles();
    fetchIncomingThreads();
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
    setStatus('Yanıt gönderildi.');
    fetchIncomingThreads();
  }

  const isAdmin = session?.user?.user_metadata?.role === 'admin';

  return (
    <div className="layout">
      <header>
        <h1>Flort Chat</h1>
        {!session && (
          <button className="linkish" onClick={() => setMode(mode === 'user' ? 'admin' : 'user')}>
            {mode === 'user' ? 'Admin girişi' : 'Kullanıcı girişi'}
          </button>
        )}
        {session && <button onClick={signOut}>Çıkış</button>}
      </header>

      {!session ? (
        <section className="card">
          <h2>{mode === 'admin' ? 'Admin giriş/kayıt' : 'Kullanıcı giriş/kayıt'}</h2>
          <input
            placeholder="Kullanıcı adı"
            value={authForm.username}
            onChange={(e) => setAuthForm((s) => ({ ...s, username: e.target.value }))}
          />
          <input
            placeholder="E-posta"
            value={authForm.email}
            onChange={(e) => setAuthForm((s) => ({ ...s, email: e.target.value }))}
          />
          <input
            placeholder="Şifre"
            type="password"
            value={authForm.password}
            onChange={(e) => setAuthForm((s) => ({ ...s, password: e.target.value }))}
          />
          <div className="row">
            <button disabled={loading} onClick={signIn}>Giriş yap</button>
            <button disabled={loading} onClick={signUp}>Kayıt ol</button>
          </div>
        </section>
      ) : isAdmin ? (
        <main className="admin-grid">
          <section className="card">
            <h3>Sanal Profil Oluştur</h3>
            <input
              placeholder="Ad"
              value={profileForm.name}
              onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))}
            />
            <input
              placeholder="Yaş"
              type="number"
              value={profileForm.age}
              onChange={(e) => setProfileForm((s) => ({ ...s, age: e.target.value }))}
            />
            <input
              placeholder="Cinsiyet"
              value={profileForm.gender}
              onChange={(e) => setProfileForm((s) => ({ ...s, gender: e.target.value }))}
            />
            <textarea
              placeholder="Hobiler"
              value={profileForm.hobbies}
              onChange={(e) => setProfileForm((s) => ({ ...s, hobbies: e.target.value }))}
            />
            <button onClick={createVirtualProfile}>Kaydet</button>
          </section>

          <section className="card">
            <h3>Mesajlara Cevap Penceresi</h3>
            <div className="thread-list">
              {incomingThreads.map((thread) => (
                <button
                  key={`${thread.member_id}-${thread.virtual_profile_id}`}
                  onClick={() => setSelectedThread(thread)}
                  className={
                    selectedThread?.member_id === thread.member_id &&
                    selectedThread?.virtual_profile_id === thread.virtual_profile_id
                      ? 'active'
                      : ''
                  }
                >
                  {thread.member_username} → {thread.virtual_name}
                </button>
              ))}
            </div>
            <textarea
              placeholder="Sanal profil cevabı"
              value={adminReply}
              onChange={(e) => setAdminReply(e.target.value)}
            />
            <button onClick={sendAdminReply}>Yanıt Gönder</button>
          </section>
        </main>
      ) : (
        <main className="user-grid">
          <aside className="card">
            <h3>Sanal Profiller</h3>
            {virtualProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={selectedProfileId === profile.id ? 'active' : ''}
              >
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
              <input
                placeholder="Mesaj yaz"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button onClick={sendMessage}>Gönder</button>
            </div>
          </section>
        </main>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
