import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

const initialAuth = { username: '', password: '' };
const initialProfile = { name: '', age: '', gender: '', hobbies: '', photo_url: '' };
const initialMemberProfile = { age: '', hobbies: '', city: '', photo_url: '' };

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
  const [threadMessages, setThreadMessages] = useState([]);
  const [memberProfile, setMemberProfile] = useState(initialMemberProfile);
  const [unreadByProfile, setUnreadByProfile] = useState({});
  const [adminUnreadByThread, setAdminUnreadByThread] = useState({});
  const chatBoxRef = useRef(null);
  const adminChatBoxRef = useRef(null);

  const selectedProfile = useMemo(
    () => virtualProfiles.find((p) => p.id === selectedProfileId) || null,
    [selectedProfileId, virtualProfiles]
  );

  const loggedIn = !!memberSession || isAdmin;



  function threadKey(memberId, profileId) {
    return `${memberId}::${profileId}`;
  }

  function playNotificationSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.25);
    } catch {
      // Sessizce geç
    }
  }


  useEffect(() => {
    if (!loggedIn) return;
    fetchVirtualProfiles();
    if (isAdmin) fetchIncomingThreads();
  }, [loggedIn, isAdmin]);

  useEffect(() => {
    if (!memberSession || !selectedProfileId || isAdmin) return;
    fetchMessages(selectedProfileId);
  }, [memberSession, selectedProfileId, isAdmin]);




  useEffect(() => {
    if (!selectedProfileId || isAdmin) return;
    setUnreadByProfile((prev) => ({ ...prev, [selectedProfileId]: 0 }));
  }, [selectedProfileId, isAdmin]);


  useEffect(() => {
    if (!isAdmin || !selectedThread) return;
    const key = threadKey(selectedThread.member_id, selectedThread.virtual_profile_id);
    setAdminUnreadByThread((prev) => ({ ...prev, [key]: 0 }));
  }, [isAdmin, selectedThread]);

  useEffect(() => {
    if (!memberSession || isAdmin) return;
    if (!chatBoxRef.current) return;
    chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
  }, [messages, memberSession, isAdmin]);


  useEffect(() => {
    if (!isAdmin || !adminChatBoxRef.current) return;
    adminChatBoxRef.current.scrollTop = adminChatBoxRef.current.scrollHeight;
  }, [threadMessages, isAdmin]);

  useEffect(() => {
    if (!isAdmin || !selectedThread) return;
    fetchThreadMessages(selectedThread.member_id, selectedThread.virtual_profile_id);
  }, [isAdmin, selectedThread]);


  useEffect(() => {
    if (!memberSession || isAdmin) return;
    fetchOwnProfile();
  }, [memberSession, isAdmin]);



  useEffect(() => {
    if (!loggedIn) return;

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        if (isAdmin) {
          fetchIncomingThreads();
          const changed = payload.new || payload.old;
          if (!changed) return;

          const key = threadKey(changed.member_id, changed.virtual_profile_id);
          const selectedKey = selectedThread
            ? threadKey(selectedThread.member_id, selectedThread.virtual_profile_id)
            : null;

          if (selectedKey && key === selectedKey) {
            fetchThreadMessages(changed.member_id, changed.virtual_profile_id);
            setAdminUnreadByThread((prev) => ({ ...prev, [key]: 0 }));
          } else if (changed.sender_role === 'member') {
            setAdminUnreadByThread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
            playNotificationSound();
          }
          return;
        }

        if (!memberSession) return;
        const changed = payload.new || payload.old;
        if (!changed) return;

        if (changed.member_id !== memberSession.id) return;

        if (changed.sender_role === 'virtual') {
          playNotificationSound();
        }

        if (selectedProfileId && changed.virtual_profile_id === selectedProfileId) {
          fetchMessages(selectedProfileId);
          if (changed.sender_role === 'virtual') {
            setUnreadByProfile((prev) => ({ ...prev, [selectedProfileId]: 0 }));
          }
        } else if (changed.sender_role === 'virtual') {
          setUnreadByProfile((prev) => ({
            ...prev,
            [changed.virtual_profile_id]: (prev[changed.virtual_profile_id] || 0) + 1,
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loggedIn, isAdmin, memberSession, selectedProfileId, selectedThread]);

  async function uploadImage(file, folder) {
    if (!file) return null;
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, { upsert: true });
    if (uploadError) {
      setStatus(`Görsel yükleme hatası: ${uploadError.message}`);
      return null;
    }

    const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
    return data?.publicUrl || null;
  }

  async function fetchOwnProfile() {
    const { data, error } = await supabase
      .from('member_profiles')
      .select('*')
      .eq('member_id', memberSession.id)
      .maybeSingle();

    if (error) return setStatus(error.message);
    if (!data) return setMemberProfile(initialMemberProfile);

    setMemberProfile({
      age: data.age || '',
      hobbies: data.hobbies || '',
      city: data.city || '',
      photo_url: data.photo_url || '',
    });
  }

  async function saveOwnProfile() {
    if (!memberSession) return;

    const payload = {
      member_id: memberSession.id,
      age: memberProfile.age ? Number(memberProfile.age) : null,
      hobbies: memberProfile.hobbies,
      city: memberProfile.city,
      photo_url: memberProfile.photo_url,
    };

    const { error } = await supabase
      .from('member_profiles')
      .upsert(payload, { onConflict: 'member_id' });

    if (error) return setStatus(error.message);
    setStatus('Profil bilgilerin kaydedildi.');
  }

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
    setUnreadByProfile({});
    setAdminUnreadByThread({});
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
    let { error } = await supabase.from('virtual_profiles').insert({
      name: profileForm.name,
      age: Number(profileForm.age),
      gender: profileForm.gender,
      hobbies: profileForm.hobbies,
      photo_url: profileForm.photo_url,
    });

    if (error?.message?.includes("Could not find the 'photo_url' column")) {
      const retry = await supabase.from('virtual_profiles').insert({
        name: profileForm.name,
        age: Number(profileForm.age),
        gender: profileForm.gender,
        hobbies: profileForm.hobbies,
      });
      error = retry.error;
      if (!error) {
        setStatus("Profil kaydedildi. Fotoğraf kolonu henüz migration almadığı için görsel eklenmedi. SQL migration'ı tekrar çalıştır.");
      }
    }

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


  async function fetchThreadMessages(memberId, profileId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('member_id', memberId)
      .eq('virtual_profile_id', profileId)
      .order('created_at', { ascending: true });

    if (error) return setStatus(error.message);
    setThreadMessages(data || []);
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
    fetchThreadMessages(selectedThread.member_id, selectedThread.virtual_profile_id);
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
        <section className="auth-hero">
          <div className="auth-card">
            <div className="auth-badge">CHAT</div>
            <h2>{mode === 'admin' ? 'Admin Login' : 'Login / Register'}</h2>
            <input
              placeholder={mode === 'admin' ? 'Admin için kullanıcı adı kullanılmıyor' : 'Username...'}
              disabled={mode === 'admin'}
              value={mode === 'admin' ? '' : authForm.username}
              onChange={(e) => setAuthForm((st) => ({ ...st, username: e.target.value }))}
            />
            <input
              placeholder="Password..."
              type="password"
              value={authForm.password}
              onChange={(e) => setAuthForm((st) => ({ ...st, password: e.target.value }))}
            />
            <button disabled={loading} onClick={signIn}>Sign in</button>
            {mode !== 'admin' && <button disabled={loading} onClick={signUp}>Kayıt ol</button>}
            <small>{mode === 'admin' ? 'Admin şifresi ile giriş yap' : 'Hesabın yoksa kayıt ol'}</small>
          </div>

          <div className="auth-info">
            <h2>MESSENGER</h2>
            <p>
              Gerçek zamanlı sohbet, sanal profiller ve admin cevap penceresi ile modern bir chat deneyimi.
              Üye olarak giriş yapıp profilini oluşturabilir, adminin yanıtlarını anında görebilirsin.
            </p>
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
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file, 'virtual-profiles');
                if (url) setProfileForm((s) => ({ ...s, photo_url: url }));
              }}
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
                  className={selectedThread?.member_id === thread.member_id && selectedThread?.virtual_profile_id === thread.virtual_profile_id ? 'active' : ''}
                >
                  <div>{thread.member_username} → {thread.virtual_name}</div>
                  {thread.last_message_content && <small>{thread.last_message_content}</small>}
                  {adminUnreadByThread[threadKey(thread.member_id, thread.virtual_profile_id)] > 0 && (
                    <small> • Yeni ({adminUnreadByThread[threadKey(thread.member_id, thread.virtual_profile_id)]})</small>
                  )}
                </button>
              ))}
            </div>
            <div className="chat-box admin-chat-box" ref={adminChatBoxRef}>
              {threadMessages.map((msg) => (
                <div key={msg.id} className={`msg ${msg.sender_role}`}>
                  <span>{msg.sender_role === 'member' ? selectedThread?.member_username : selectedThread?.virtual_name}</span>
                  <p>{msg.content}</p>
                </div>
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
                {unreadByProfile[profile.id] > 0 && <small> • Yeni ({unreadByProfile[profile.id]})</small>}
              </button>
            ))}
            {selectedProfile && (
              <div className="meta">
                {selectedProfile.photo_url && <img src={selectedProfile.photo_url} alt={selectedProfile.name} className="profile-photo" />}
                <p><strong>Yaş:</strong> {selectedProfile.age}</p>
                <p><strong>Cinsiyet:</strong> {selectedProfile.gender}</p>
                <p><strong>Hobiler:</strong> {selectedProfile.hobbies || '-'}</p>
              </div>
            )}
          </aside>
          <section className="card">
            <h3>Sohbet</h3>
            <div className="chat-box" ref={chatBoxRef}>
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
          <section className="card">
            <h3>Kendi Profilin</h3>
            {memberProfile.photo_url && <img src={memberProfile.photo_url} alt="profil" className="profile-photo" />}
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadImage(file, 'members');
                if (url) setMemberProfile((s) => ({ ...s, photo_url: url }));
              }}
            />
            <input
              placeholder="Yaş"
              type="number"
              value={memberProfile.age}
              onChange={(e) => setMemberProfile((s) => ({ ...s, age: e.target.value }))}
            />
            <input
              placeholder="Şehir"
              value={memberProfile.city}
              onChange={(e) => setMemberProfile((s) => ({ ...s, city: e.target.value }))}
            />
            <textarea
              placeholder="Hobiler"
              value={memberProfile.hobbies}
              onChange={(e) => setMemberProfile((s) => ({ ...s, hobbies: e.target.value }))}
            />
            <button onClick={saveOwnProfile}>Profili Kaydet</button>
          </section>
        </main>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
