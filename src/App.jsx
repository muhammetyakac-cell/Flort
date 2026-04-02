import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

const initialAuth = { username: '', password: '' };
const initialProfile = { name: '', age: '', city: '', gender: '', hobbies: '', photo_url: '' };
const initialMemberProfile = { age: '', hobbies: '', city: '', photo_url: '', status_emoji: '🙂' };

const NAME_SEEDS = [
  'Alara','Asya','Defne','Nehir','Derin','Lina','Mira','Arya','Ela','Ada','Duru','Elif','Zeynep','Eylül','İdil','İpek','Mina','Nisa','Sude','Su','Beren','Naz','Aylin','Yaren','Lara','Selin','Melis','Ayşe','Buse','Ceren','Yasemin','Sena','Gizem','Selen','Nehir','Yelda','Esila','İrem','Tuana','Merve','Hilal','Nisanur','Ece','Nazlı','Güneş','Ecrin','Hazal','Helin','Sıla','Berfin','Damla','Sinem','Yağmur','Derya','Pelin','Cansu','Gökçe','Deniz','Meryem','Beste','Aden','Alina','Maya','Sahara','Lavin','Lavinya','Rüya','Nehirsu','Miray','Sahra','Mina','Nehirnaz','Aysu','Melisa','Zümra','Ecrinsu','Asel','Rabia','Nursena','Pınar','Leman','Öykü','Çağla','Açelya','Irmak','Ahu','Nehircan','Beliz','Elvan','Ayça','Mislina','Mislinay','Aren','Arven','Helia','Hira','Yüsra','Elisa','Liya','Mona','Noa','Talia'
];
const NAME_SUFFIXES = ['', ' Nur', ' Su', ' Naz', ' Ada'];
const FEMALE_NAMES = Array.from(new Set(NAME_SEEDS.flatMap((seed) => NAME_SUFFIXES.map((s) => `${seed}${s}`)))).slice(0, 250);
const CITY_LIST = ['İstanbul','Ankara','İzmir','Bursa','Antalya','Eskişehir','Muğla','Mersin','Adana','Konya','Samsun','Trabzon','Gaziantep','Kayseri','Kocaeli','Tekirdağ','Çanakkale','Aydın','Balıkesir','Denizli','Sakarya','Hatay','Manisa','Edirne','Bolu','Kırklareli','Sinop','Rize','Giresun','Ordu'];
const QUICK_REPLIES = ['Merhaba! 🌸', 'Naber, günün nasıl geçti?', 'Fotoğrafın çok güzel 😍', 'Kahve içelim mi? ☕'];

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
  const [onlineProfiles, setOnlineProfiles] = useState({});
  const [typingLabel, setTypingLabel] = useState('');
  const [adminTypingByThread, setAdminTypingByThread] = useState({});
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const chatBoxRef = useRef(null);
  const adminChatBoxRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const selectedProfile = useMemo(
    () => virtualProfiles.find((p) => p.id === selectedProfileId) || null,
    [selectedProfileId, virtualProfiles]
  );

  const sortedProfiles = useMemo(() => {
    return [...virtualProfiles].sort((a, b) => {
      const unreadA = unreadByProfile[a.id] || 0;
      const unreadB = unreadByProfile[b.id] || 0;
      if (unreadA !== unreadB) return unreadB - unreadA;
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
  }, [virtualProfiles, unreadByProfile]);

  const loggedIn = !!memberSession || isAdmin;

  function threadKey(memberId, profileId) {
    return `${memberId}::${profileId}`;
  }

  function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  }

  function getRandomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildRandomVirtualProfile() {
    return {
      name: getRandomItem(FEMALE_NAMES),
      age: String(Math.floor(Math.random() * 14) + 20),
      city: getRandomItem(CITY_LIST),
      gender: 'Kadın',
      hobbies: getRandomItem(['Kahve, seyahat, müzik','Yoga, kitap, yürüyüş','Sinema, fotoğraf, dans','Pilates, moda, sanat','Doğa, kamp, paten']),
    };
  }

  function fillRandomVirtualProfile() {
    setProfileForm((prev) => ({ ...prev, ...buildRandomVirtualProfile() }));
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

  function getAudioUrl(content) {
    const clean = (content || '').trim();
    if (!clean) return null;
    if (clean.startsWith('audio:')) return clean.replace('audio:', '').trim();
    if (/^https?:\/\/.+\.(mp3|wav|m4a|ogg)(\?.*)?$/i.test(clean)) return clean;
    return null;
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

  useEffect(() => {
    if (!loggedIn) return;

    const presenceChannel = supabase.channel('virtual-profiles-presence', {
      config: { presence: { key: isAdmin ? `admin-${Date.now()}` : `member-${memberSession?.id || Date.now()}` } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const online = {};
        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            (entry.online_profiles || []).forEach((profileId) => {
              online[profileId] = true;
            });
          });
        });
        setOnlineProfiles(online);
      })
      .subscribe(async (state) => {
        if (state === 'SUBSCRIBED' && isAdmin) {
          await presenceChannel.track({
            role: 'admin',
            online_profiles: virtualProfiles.map((p) => p.id),
          });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [loggedIn, isAdmin, memberSession?.id, virtualProfiles]);

  useEffect(() => {
    if (!loggedIn) return;

    const typingChannel = supabase.channel('typing-indicators', {
      config: { presence: { key: isAdmin ? `typing-admin-${Date.now()}` : `typing-member-${memberSession?.id || Date.now()}` } },
    });

    typingChannel
      .on('presence', { event: 'sync' }, () => {
        const state = typingChannel.presenceState();
        let memberTyping = '';
        const adminTypingMap = {};

        Object.values(state).forEach((entries) => {
          entries.forEach((entry) => {
            if (entry.role === 'admin' && entry.typing && memberSession?.id === entry.member_id && selectedProfileId === entry.virtual_profile_id) {
              memberTyping = `${entry.display_name || 'Admin'} yazıyor...`;
            }

            if (entry.role === 'member' && entry.typing) {
              const key = threadKey(entry.member_id, entry.virtual_profile_id);
              adminTypingMap[key] = true;
            }
          });
        });

        setTypingLabel(memberTyping);
        setAdminTypingByThread(adminTypingMap);
      })
      .subscribe(async (state) => {
        if (state === 'SUBSCRIBED') {
          await typingChannel.track({ role: isAdmin ? 'admin' : 'member', typing: false });
        }
      });

    const stopTyping = () => {
      typingChannel.track({
        role: isAdmin ? 'admin' : 'member',
        typing: false,
        member_id: isAdmin ? selectedThread?.member_id : memberSession?.id,
        virtual_profile_id: isAdmin ? selectedThread?.virtual_profile_id : selectedProfileId,
        display_name: isAdmin ? (selectedThread?.virtual_name || 'Admin') : (memberSession?.username || 'Üye'),
      });
    };

    const typingText = isAdmin ? adminReply : newMessage;
    const memberId = isAdmin ? selectedThread?.member_id : memberSession?.id;
    const profileId = isAdmin ? selectedThread?.virtual_profile_id : selectedProfileId;

    if (memberId && profileId && typingText.trim()) {
      typingChannel.track({
        role: isAdmin ? 'admin' : 'member',
        typing: true,
        member_id: memberId,
        virtual_profile_id: profileId,
        display_name: isAdmin ? (selectedThread?.virtual_name || 'Admin') : (memberSession?.username || 'Üye'),
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(stopTyping, 1300);
    } else {
      stopTyping();
    }

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      supabase.removeChannel(typingChannel);
    };
  }, [loggedIn, isAdmin, newMessage, adminReply, selectedProfileId, selectedThread, memberSession]);

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
      status_emoji: data.status_emoji || '🙂',
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
      status_emoji: memberProfile.status_emoji,
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
    setTypingLabel('');
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

    await supabase
      .from('messages')
      .update({ seen_by_member: true })
      .eq('virtual_profile_id', profileId)
      .eq('member_id', memberSession.id)
      .eq('sender_role', 'virtual')
      .eq('seen_by_member', false);
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
      seen_by_member: true,
      seen_by_admin: false,
    });
    if (error) return setStatus(error.message);
    setNewMessage('');
    fetchMessages(selectedProfileId);
  }

  async function createVirtualProfile() {
    const auto = buildRandomVirtualProfile();
    const payload = {
      name: profileForm.name || auto.name,
      age: Number(profileForm.age || auto.age),
      city: profileForm.city || auto.city,
      gender: profileForm.gender || 'Kadın',
      hobbies: profileForm.hobbies || auto.hobbies,
      photo_url: profileForm.photo_url,
    };

    if (!payload.photo_url) return setStatus('Fotoğraf yükleyip Kaydet tuşuna bas. İsim/şehir/yaş otomatik üretilecek.');

    let { error } = await supabase.from('virtual_profiles').insert(payload);

    if (error?.message?.includes("Could not find the 'photo_url' column")) {
      const retry = await supabase.from('virtual_profiles').insert({
        name: payload.name,
        age: payload.age,
        city: payload.city,
        gender: payload.gender,
        hobbies: payload.hobbies,
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
    setStatus(`Sanal profil oluşturuldu: ${payload.name}, ${payload.city}`);
  }

  async function fetchIncomingThreads() {
    const { data, error } = await supabase
      .from('admin_threads')
      .select('*')
      .order('last_message_at', { ascending: false });
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

    await supabase
      .from('messages')
      .update({ seen_by_admin: true })
      .eq('member_id', memberId)
      .eq('virtual_profile_id', profileId)
      .eq('sender_role', 'member')
      .eq('seen_by_admin', false);
  }

  async function sendAdminReply() {
    if (!selectedThread || !adminReply.trim()) return;
    const { error } = await supabase.from('messages').insert({
      member_id: selectedThread.member_id,
      virtual_profile_id: selectedThread.virtual_profile_id,
      sender_role: 'virtual',
      content: adminReply.trim(),
      seen_by_member: false,
      seen_by_admin: true,
    });
    if (error) return setStatus(error.message);
    setAdminReply('');
    setAiSuggestions([]);
    fetchIncomingThreads();
    fetchThreadMessages(selectedThread.member_id, selectedThread.virtual_profile_id);
    setStatus('Yanıt gönderildi.');
  }

  async function fetchAiSuggestions() {
    if (!OPENAI_API_KEY) return setStatus('AI önerileri için VITE_OPENAI_API_KEY tanımla.');
    if (!selectedThread || !threadMessages.length) return;

    const lastMemberMessage = [...threadMessages].reverse().find((m) => m.sender_role === 'member')?.content;
    if (!lastMemberMessage) return;

    setLoadingSuggestions(true);
    setStatus('');

    const prompt = `Kullanıcı mesajı: "${lastMemberMessage}". Flört uygulaması için 3 kısa ve doğal Türkçe cevap öner.`;

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input: prompt,
      }),
    });

    setLoadingSuggestions(false);
    if (!res.ok) {
      const txt = await res.text();
      return setStatus(`AI önerisi alınamadı: ${txt}`);
    }

    const data = await res.json();
    const outText = data.output_text || '';
    const lines = outText
      .split('\n')
      .map((l) => l.replace(/^\d+[\).\-]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    setAiSuggestions(lines);
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
        <main className="dashboard admin-grid admin-dashboard">
          <section className="card">
            <h3>Sanal Profil Oluştur</h3>
            <input placeholder="Ad (boşsa otomatik)" value={profileForm.name} onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))} />
            <input placeholder="Yaş (boşsa otomatik)" type="number" value={profileForm.age} onChange={(e) => setProfileForm((s) => ({ ...s, age: e.target.value }))} />
            <input placeholder="Şehir (boşsa otomatik)" value={profileForm.city} onChange={(e) => setProfileForm((s) => ({ ...s, city: e.target.value }))} />
            <input placeholder="Cinsiyet" value={profileForm.gender} onChange={(e) => setProfileForm((s) => ({ ...s, gender: e.target.value }))} />
            <button type="button" onClick={fillRandomVirtualProfile}>Rastgele Kız Profili Üret (250 isim)</button>
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
            <button onClick={createVirtualProfile}>Kaydet (Foto + Otomatik İsim/Şehir/Yaş)</button>
          </section>

          <section className="card">
            <h3>Mesajlara Cevap Penceresi</h3>

            <div className="thread-queue">
              {incomingThreads.map((thread) => (
                <button
                  key={`${thread.member_id}-${thread.virtual_profile_id}`}
                  onClick={() => setSelectedThread(thread)}
                  className={`thread-item ${selectedThread?.member_id === thread.member_id && selectedThread?.virtual_profile_id === thread.virtual_profile_id ? 'active' : ''}`}
                >
                  <div>{thread.member_username} → {thread.virtual_name}</div>
                  {thread.last_message_content && <small>{thread.last_message_content}</small>}
                  {adminUnreadByThread[threadKey(thread.member_id, thread.virtual_profile_id)] > 0 && (
                    <small> • Yeni ({adminUnreadByThread[threadKey(thread.member_id, thread.virtual_profile_id)]})</small>
                  )}
                  {adminTypingByThread[threadKey(thread.member_id, thread.virtual_profile_id)] && <small> • yazıyor...</small>}
                </button>
              ))}
            </div>

            <h4>Seçilen Sohbet</h4>
            <div className="chat-box admin-chat-box" ref={adminChatBoxRef}>
              {threadMessages.map((msg) => {
                const audioUrl = getAudioUrl(msg.content);
                return (
                  <div key={msg.id} className={`msg ${msg.sender_role}`}>
                    <span>{msg.sender_role === 'member' ? selectedThread?.member_username : selectedThread?.virtual_name}</span>
                    {audioUrl ? <audio controls src={audioUrl} className="audio-player" /> : <p>{msg.content}</p>}
                    <small>
                      {formatTime(msg.created_at)}
                      {msg.sender_role === 'virtual' ? <span className={`ticks ${msg.seen_by_member ? 'seen' : ''}`}>✓✓</span> : ''}
                    </small>
                  </div>
                );
              })}
            </div>

            <div className="quick-replies">
              {QUICK_REPLIES.map((reply) => (
                <button key={reply} type="button" className="chip" onClick={() => setAdminReply((prev) => `${prev ? `${prev}\n` : ''}${reply}`)}>{reply}</button>
              ))}
              <button type="button" className="chip ai" onClick={fetchAiSuggestions} disabled={loadingSuggestions}>{loadingSuggestions ? 'AI düşünüyor...' : 'AI Önerisi Getir'}</button>
            </div>

            {!!aiSuggestions.length && (
              <div className="ai-suggestions">
                {aiSuggestions.map((suggestion) => (
                  <button key={suggestion} type="button" className="chip" onClick={() => setAdminReply(suggestion)}>{suggestion}</button>
                ))}
              </div>
            )}

            <textarea placeholder="Sanal profil cevabı" value={adminReply} onChange={(e) => setAdminReply(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdminReply(); } }} />
            <button onClick={sendAdminReply}>Yanıt Gönder</button>
          </section>
        </main>
      ) : (
        <main className="dashboard user-grid user-dashboard">
          <aside className="card">
            <h3>Sanal Profiller</h3>
            <div className="profile-list">
              {sortedProfiles.map((profile) => (
                <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={`profile-item ${selectedProfileId === profile.id ? 'active' : ''} ${unreadByProfile[profile.id] > 0 ? 'has-unread' : ''}`}>
                  <span className={`avatar-wrap ${unreadByProfile[profile.id] > 0 ? 'ringing' : ''}`}>
                    {profile.photo_url ? <img src={profile.photo_url} alt={profile.name} className="avatar" /> : <span className="avatar-fallback">{profile.name?.slice(0,1)}</span>}
                  </span>
                  <span className="profile-main">
                    <strong>{profile.name}</strong>
                    <small>{profile.city || 'Türkiye'}</small>
                  </span>
                  <span className={`online-dot ${onlineProfiles[profile.id] ? 'on' : ''}`} />
                  {unreadByProfile[profile.id] > 0 && <small>Yeni ({unreadByProfile[profile.id]})</small>}
                </button>
              ))}
            </div>
            {selectedProfile && (
              <div className="meta">
                {selectedProfile.photo_url && <img src={selectedProfile.photo_url} alt={selectedProfile.name} className="profile-photo" />}
                <p><strong>Yaş:</strong> {selectedProfile.age}</p>
                <p><strong>Cinsiyet:</strong> {selectedProfile.gender}</p>
                <p><strong>Şehir:</strong> {selectedProfile.city || '-'}</p>
                <p><strong>Hobiler:</strong> {selectedProfile.hobbies || '-'}</p>
              </div>
            )}
          </aside>
          <section className="card">
            <h3>Sohbet</h3>
            <div className="chat-box" ref={chatBoxRef}>
              {messages.map((msg) => {
                const audioUrl = getAudioUrl(msg.content);
                return (
                  <div key={msg.id} className={`msg ${msg.sender_role}`}>
                    <span>{msg.sender_role === 'member' ? 'Sen' : selectedProfile?.name}</span>
                    {audioUrl ? <audio controls src={audioUrl} className="audio-player" /> : <p>{msg.content}</p>}
                    <small>
                      {formatTime(msg.created_at)}
                      {msg.sender_role === 'member' ? <span className={`ticks ${msg.seen_by_admin ? 'seen' : ''}`}>✓✓</span> : ''}
                    </small>
                  </div>
                );
              })}
            </div>
            {typingLabel && <div className="typing-indicator">{typingLabel}</div>}
            <div className="row">
              <input placeholder="Mesaj yaz" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} />
              <button onClick={sendMessage}>Gönder</button>
            </div>
          </section>
          <section className="card">
            <h3>Kendi Profilin {memberProfile.status_emoji}</h3>
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
            <select value={memberProfile.status_emoji} onChange={(e) => setMemberProfile((s) => ({ ...s, status_emoji: e.target.value }))}>
              <option value="🙂">🙂 Normal</option>
              <option value="☕">☕ Kahve içiyor</option>
              <option value="💃">💃 Dans ediyor</option>
              <option value="🎧">🎧 Müzik dinliyor</option>
              <option value="🌙">🌙 Dinleniyor</option>
            </select>
            <button onClick={saveOwnProfile}>Profili Kaydet</button>
          </section>
        </main>
      )}

      {status && <p className="status">{status}</p>}
    </div>
  );
}
