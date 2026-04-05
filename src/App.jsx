import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './hooks/useAuth';
import { buildHourlyPresenceMap } from './utils/presence';

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;
const ADMIN_PASSWORD2 = import.meta.env.VITE_ADMIN_PASSWORD2;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

const initialProfile = { name: '', age: '', city: '', gender: '', hobbies: '', photo_url: '' };
const initialMemberProfile = { age: '', hobbies: '', city: '', photo_url: '', status_emoji: '🙂' };

const NAME_SEEDS = [
  'Alara','Asya','Defne','Nehir','Derin','Lina','Mira','Arya','Ela','Ada','Duru','Elif','Zeynep','Eylül','İdil','İpek','Mina','Nisa','Sude','Su','Beren','Naz','Aylin','Yaren','Lara','Selin','Melis','Ayşe','Buse','Ceren','Yasemin','Sena','Gizem','Selen','Nehir','Yelda','Esila','İrem','Tuana','Merve','Hilal','Nisanur','Ece','Nazlı','Güneş','Ecrin','Hazal','Helin','Sıla','Berfin','Damla','Sinem','Yağmur','Derya','Pelin','Cansu','Gökçe','Deniz','Meryem','Beste','Aden','Alina','Maya','Sahara','Lavin','Lavinya','Rüya','Nehirsu','Miray','Sahra','Mina','Nehirnaz','Aysu','Melisa','Zümra','Ecrinsu','Asel','Rabia','Nursena','Pınar','Leman','Öykü','Çağla','Açelya','Irmak','Ahu','Nehircan','Beliz','Elvan','Ayça','Mislina','Mislinay','Aren','Arven','Helia','Hira','Yüsra','Elisa','Liya','Mona','Noa','Talia'
];
const NAME_SUFFIXES = ['', ' Nur', ' Su', ' Naz', ' Ada'];
const FEMALE_NAMES = Array.from(new Set(NAME_SEEDS.flatMap((seed) => NAME_SUFFIXES.map((s) => `${seed}${s}`)))).slice(0, 250);
const CITY_LIST = ['İstanbul','Ankara','İzmir','Bursa','Antalya','Eskişehir','Muğla','Mersin','Adana','Konya','Samsun','Trabzon','Gaziantep','Kayseri','Kocaeli','Tekirdağ','Çanakkale','Aydın','Balıkesir','Denizli','Sakarya','Hatay','Manisa','Edirne','Bolu','Kırklareli','Sinop','Rize','Giresun','Ordu'];
const QUICK_REPLIES = ['Merhaba! 🌸', 'Naber, günün nasıl geçti?', 'Fotoğrafın çok güzel 😍', 'Kahve içelim mi? ☕'];
const THREAD_TAGS = ['sicak_lead', 'soguk', 'takip_edilecek'];
const BULK_TEMPLATES = ['Merhaba! 👋', 'Naber, günün nasıl?', 'Müsaitsen yaz ✨'];

export default function App() {
  const [status, setStatus] = useState('');

  const {
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
  } = useAuth({ adminPasswords: [ADMIN_PASSWORD, ADMIN_PASSWORD2], setStatus });

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
  const [adminDrawerOpen, setAdminDrawerOpen] = useState(true);
  const [selectedThreadKeys, setSelectedThreadKeys] = useState({});
  const [bulkTemplate, setBulkTemplate] = useState(BULK_TEMPLATES[0]);
  const [notificationSoundEnabled, setNotificationSoundEnabled] = useState(true);
  const [engagementInsights, setEngagementInsights] = useState({ topHours: [], topProfiles: [] });
  const [adminStats, setAdminStats] = useState({
    totalMessagesToday: 0,
    memberMessagesToday: 0,
    adminRepliesToday: 0,
    respondedThreadsToday: 0,
    newMembersToday: 0,
    activeThreadsToday: 0,
    avgResponseMinToday: 0,
  });
  const [statsRange, setStatsRange] = useState('daily');
  const [adminTab, setAdminTab] = useState('chat');
  const [quickFactsText, setQuickFactsText] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('all');
  const [profileSearch, setProfileSearch] = useState('');
  const [discoverSort, setDiscoverSort] = useState('match');
  const [likedProfiles, setLikedProfiles] = useState({});
  const [heartedProfiles, setHeartedProfiles] = useState({});
  const [wavedProfiles, setWavedProfiles] = useState({});
  const [userView, setUserView] = useState('discover');
  const [registeredMembers, setRegisteredMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedMemberProfile, setSelectedMemberProfile] = useState(null);
  const [presenceHourBucket, setPresenceHourBucket] = useState(new Date().toISOString().slice(0, 13));
  const chatBoxRef = useRef(null);
  const adminChatBoxRef = useRef(null);
  const profileListRef = useRef(null);
  const threadQueueRef = useRef(null);
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

  const profileById = useMemo(() => Object.fromEntries(virtualProfiles.map((p) => [p.id, p])), [virtualProfiles]);
  const displayOnlineProfiles = useMemo(
    () => buildHourlyPresenceMap(virtualProfiles, presenceHourBucket, onlineProfiles),
    [virtualProfiles, presenceHourBucket, onlineProfiles]
  );
  const selectedThreadProfile = useMemo(() => (selectedThread ? profileById[selectedThread.virtual_profile_id] : null), [selectedThread, profileById]);
  const sortedIncomingThreads = useMemo(() => {
    return [...incomingThreads].sort((a, b) => {
      const waitA = a.last_sender_role === 'member' ? 1 : 0;
      const waitB = b.last_sender_role === 'member' ? 1 : 0;
      if (waitA !== waitB) return waitB - waitA;
      return new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0);
    });
  }, [incomingThreads]);

  const slaStats = useMemo(() => {
    const waiting = incomingThreads.filter((t) => t.last_sender_role === 'member' || (adminUnreadByThread[threadKey(t.member_id, t.virtual_profile_id)] || 0) > 0);
    const now = Date.now();
    const avgWaitMin = waiting.length
      ? waiting.reduce((acc, t) => {
        const ts = t.last_message_at || t.created_at;
        const diff = ts ? (now - new Date(ts).getTime()) / 60000 : 0;
        return acc + Math.max(diff, 0);
      }, 0) / waiting.length
      : 0;
    return {
      waitingCount: waiting.length,
      avgWaitMin,
      lastReplyMin: selectedThread?.last_message_at ? (now - new Date(selectedThread.last_message_at).getTime()) / 60000 : 0,
    };
  }, [incomingThreads, selectedThread, adminUnreadByThread]);

  const interestScore = useMemo(() => {
    if (!selectedProfile?.hobbies || !memberProfile?.hobbies) return 0;
    const a = new Set(selectedProfile.hobbies.toLowerCase().split(',').map((x) => x.trim()).filter(Boolean));
    const b = new Set(memberProfile.hobbies.toLowerCase().split(',').map((x) => x.trim()).filter(Boolean));
    if (!a.size || !b.size) return 0;
    let common = 0;
    a.forEach((item) => { if (b.has(item)) common += 1; });
    return Math.round((common / Math.max(a.size, b.size)) * 100);
  }, [selectedProfile, memberProfile]);

  const discoverProfiles = useMemo(() => {
    const filtered = sortedProfiles.filter((profile) => {
      const cityOk = cityFilter ? (profile.city || '').toLowerCase().includes(cityFilter.toLowerCase()) : true;
      const genderOk = genderFilter === 'all' ? true : (profile.gender || '').toLowerCase() === genderFilter.toLowerCase();
      const text = `${profile.name || ''} ${profile.city || ''} ${profile.hobbies || ''}`.toLowerCase();
      const searchOk = profileSearch ? text.includes(profileSearch.toLowerCase()) : true;
      return cityOk && genderOk && searchOk;
    });
    const score = (profile) => {
      const a = new Set((profile.hobbies || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean));
      const b = new Set((memberProfile.hobbies || '').toLowerCase().split(',').map((x) => x.trim()).filter(Boolean));
      if (!a.size || !b.size) return 0;
      let common = 0;
      a.forEach((item) => { if (b.has(item)) common += 1; });
      return Math.round((common / Math.max(a.size, b.size)) * 100);
    };

    return filtered.sort((p1, p2) => {
      if (discoverSort === 'newest') return new Date(p2.created_at || 0) - new Date(p1.created_at || 0);
      if (discoverSort === 'age_asc') return Number(p1.age || 0) - Number(p2.age || 0);
      if (discoverSort === 'online') return Number(!!displayOnlineProfiles[p2.id]) - Number(!!displayOnlineProfiles[p1.id]);
      return score(p2) - score(p1);
    });
  }, [sortedProfiles, cityFilter, genderFilter, profileSearch, memberProfile.hobbies, discoverSort, displayOnlineProfiles]);

  function threadKey(memberId, profileId) {
    return `${memberId}::${profileId}`;
  }

  async function selectRows(table, buildQuery) {
    const query = buildQuery(supabase.from(table).select('*'));
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async function insertRows(table, payload) {
    const { data, error } = await supabase.from(table).insert(payload).select();
    if (error) throw error;
    return data || [];
  }

  async function updateRows(table, payload, buildQuery) {
    const query = buildQuery(supabase.from(table).update(payload));
    const { data, error } = await query.select();
    if (error) throw error;
    return data || [];
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
    if (!notificationSoundEnabled) return;
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
    const saved = window.localStorage.getItem('admin_notification_sound_enabled');
    if (saved === null) return;
    setNotificationSoundEnabled(saved === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('admin_notification_sound_enabled', String(notificationSoundEnabled));
  }, [notificationSoundEnabled]);

  function getAudioUrl(content) {
    const clean = (content || '').trim();
    if (!clean) return null;
    if (clean.startsWith('audio:')) return clean.replace('audio:', '').trim();
    if (/^https?:\/\/.+\.(mp3|wav|m4a|ogg)(\?.*)?$/i.test(clean)) return clean;
    return null;
  }

  function autoResizeTextarea(el, maxHeight = 220) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }

  useEffect(() => {
    if (!loggedIn) return;
    fetchVirtualProfiles();
    if (isAdmin) fetchIncomingThreads();
  }, [loggedIn, isAdmin]);

  useEffect(() => {
    if (!memberSession || !selectedProfileId || isAdmin || userView !== 'chat') return;
    fetchMessages(selectedProfileId);
  }, [memberSession, selectedProfileId, isAdmin, userView]);

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
    if (!profileListRef.current) return;
    profileListRef.current.scrollTop = 0;
  }, [unreadByProfile]);

  useEffect(() => {
    if (!threadQueueRef.current || !isAdmin) return;
    threadQueueRef.current.scrollTop = 0;
  }, [incomingThreads, isAdmin]);

  useEffect(() => {
    if (!isAdmin || selectedThread || !sortedIncomingThreads.length) return;
    setSelectedThread(sortedIncomingThreads[0]);
  }, [isAdmin, selectedThread, sortedIncomingThreads]);

  useEffect(() => {
    if (!isAdmin || !selectedThread) return;
    fetchThreadMessages(selectedThread.member_id, selectedThread.virtual_profile_id);
    fetchQuickFacts(selectedThread.member_id, selectedThread.virtual_profile_id);
    fetchMemberProfile(selectedThread.member_id);
  }, [isAdmin, selectedThread]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchEngagementInsights();
  }, [isAdmin, incomingThreads, virtualProfiles]);

  useEffect(() => {
    if (!isAdmin || adminTab !== 'stats') return;
    fetchAdminStats();
  }, [isAdmin, adminTab, incomingThreads, threadMessages, statsRange]);

  useEffect(() => {
    if (!isAdmin || adminTab !== 'settings') return;
    fetchRegisteredMembers();
  }, [isAdmin, adminTab]);

  useEffect(() => {
    if (!memberSession || isAdmin) return;
    fetchOwnProfile();
  }, [memberSession, isAdmin]);

  useEffect(() => {
    if (!memberSession || isAdmin) return;
    setUserView('discover');
  }, [memberSession, isAdmin]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceHourBucket(new Date().toISOString().slice(0, 13));
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!isAdmin) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAdmin]);

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

  function handleSignOut() {
    signOut(() => {
      setSelectedProfileId(null);
      setMessages([]);
      setIncomingThreads([]);
      setSelectedThread(null);
      setUnreadByProfile({});
      setAdminUnreadByThread({});
      setTypingLabel('');
      setUserView('discover');
    });
  }

  async function fetchVirtualProfiles() {
    try {
      const data = await selectRows('virtual_profiles', (q) => q.order('created_at', { ascending: true }));
      setVirtualProfiles(data || []);
      if (!selectedProfileId && data?.length) setSelectedProfileId(data[0].id);
    } catch (error) {
      setStatus(error.message);
    }
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
      .update({ seen_by_member: true, seen_by_member_at: new Date().toISOString() })
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

    const slashCommands = {
      '/selam': 'Selam 👋',
      '/kahve': 'Kahve içelim mi? ☕',
    };
    const normalizedMessage = slashCommands[newMessage.trim().toLowerCase()] || newMessage.trim();

    const { error } = await supabase.from('messages').insert({
      member_id: memberSession.id,
      virtual_profile_id: selectedProfileId,
      sender_role: 'member',
      content: normalizedMessage,
      seen_by_member: true,
      seen_by_admin: false,
    });
    if (error) return setStatus(error.message);
    recordEngagement('member_message', memberSession.id, selectedProfileId, { source: 'chat_input' });
    setNewMessage('');
    fetchMessages(selectedProfileId);
  }

  async function sendReaction(profileId, reactionType) {
    if (!memberSession || !profileId) return;
    const templates = {
      heart: '💘 Kalp gönderdim.',
      wave: '👋 Selam, sana el salladım.',
      like: '👍 Profilini beğendim.',
    };
    const content = templates[reactionType];
    if (!content) return;

    const { error } = await supabase.from('messages').insert({
      member_id: memberSession.id,
      virtual_profile_id: profileId,
      sender_role: 'member',
      content,
      seen_by_member: true,
      seen_by_admin: false,
    });
    if (error) return setStatus(error.message);
    recordEngagement('member_message', memberSession.id, profileId, { source: `reaction_${reactionType}` });
    setStatus('Etkileşim mesajı gönderildi.');
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
    try {
      const data = await selectRows('admin_threads', (q) => q.order('last_message_at', { ascending: false }));
      setIncomingThreads(data || []);
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function recordEngagement(eventType, memberId, virtualProfileId, meta = {}) {
    try {
      await supabase.from('engagement_events').insert({
        event_type: eventType,
        member_id: memberId,
        virtual_profile_id: virtualProfileId,
        meta,
      });
    } catch {
      // tablo kurulmamışsa akışı bozma
    }
  }

  async function fetchEngagementInsights() {
    if (!isAdmin) return;
    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();
    let rows = [];

    const events = await supabase
      .from('engagement_events')
      .select('created_at, virtual_profile_id, event_type')
      .eq('event_type', 'member_message')
      .gte('created_at', since);

    if (!events.error && events.data?.length) {
      rows = events.data;
    } else {
      const fallback = await supabase
        .from('messages')
        .select('created_at, virtual_profile_id, sender_role')
        .eq('sender_role', 'member')
        .gte('created_at', since);
      rows = (fallback.data || []).map((r) => ({ ...r, event_type: 'member_message' }));
    }

    const hourMap = new Map();
    const profileMap = new Map();
    rows.forEach((row) => {
      const d = new Date(row.created_at);
      const h = Number.isNaN(d.getTime()) ? 0 : d.getHours();
      hourMap.set(h, (hourMap.get(h) || 0) + 1);
      profileMap.set(row.virtual_profile_id, (profileMap.get(row.virtual_profile_id) || 0) + 1);
    });

    const topHours = [...hourMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => ({ label: `${String(hour).padStart(2, '0')}:00`, count }));

    const topProfiles = [...profileMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([profileId, count]) => ({
        name: profileById[profileId]?.name || 'Bilinmeyen Profil',
        count,
      }));

    setEngagementInsights({ topHours, topProfiles });
  }

  async function fetchAdminStats() {
    if (!isAdmin) return;
    const start = new Date();
    if (statsRange === 'daily') {
      start.setHours(0, 0, 0, 0);
    } else if (statsRange === 'weekly') {
      start.setDate(start.getDate() - 7);
    } else {
      start.setMonth(start.getMonth() - 1);
    }
    const startIso = start.toISOString();

    const [{ data: todayMessages, error: msgErr }, { data: todayMembers, error: memberErr }] = await Promise.all([
      supabase
        .from('messages')
        .select('member_id, virtual_profile_id, sender_role, created_at')
        .gte('created_at', startIso),
      supabase
        .from('members')
        .select('id, created_at')
        .gte('created_at', startIso),
    ]);

    if (msgErr || memberErr) {
      setStatus(msgErr?.message || memberErr?.message || 'Stats alınamadı.');
      return;
    }

    const messages = todayMessages || [];
    const memberMessages = messages.filter((m) => m.sender_role === 'member');
    const adminReplies = messages.filter((m) => m.sender_role === 'virtual');

    const activeThreadKeys = new Set(messages.map((m) => `${m.member_id}::${m.virtual_profile_id}`));
    const respondedThreadKeys = new Set();
    const responseMinutes = [];

    const grouped = new Map();
    messages.forEach((m) => {
      const key = `${m.member_id}::${m.virtual_profile_id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(m);
    });

    grouped.forEach((rows, key) => {
      rows.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      let lastMemberTs = null;
      rows.forEach((row) => {
        if (row.sender_role === 'member') {
          lastMemberTs = row.created_at;
        } else if (row.sender_role === 'virtual' && lastMemberTs) {
          respondedThreadKeys.add(key);
          const diffMin = (new Date(row.created_at).getTime() - new Date(lastMemberTs).getTime()) / 60000;
          if (diffMin >= 0) responseMinutes.push(diffMin);
          lastMemberTs = null;
        }
      });
    });

    const avgResponseMinToday = responseMinutes.length
      ? responseMinutes.reduce((a, b) => a + b, 0) / responseMinutes.length
      : 0;

    setAdminStats({
      totalMessagesToday: messages.length,
      memberMessagesToday: memberMessages.length,
      adminRepliesToday: adminReplies.length,
      respondedThreadsToday: respondedThreadKeys.size,
      newMembersToday: (todayMembers || []).length,
      activeThreadsToday: activeThreadKeys.size,
      avgResponseMinToday,
    });
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
      .update({ seen_by_admin: true, seen_by_admin_at: new Date().toISOString() })
      .eq('member_id', memberId)
      .eq('virtual_profile_id', profileId)
      .eq('sender_role', 'member')
      .eq('seen_by_admin', false);
  }

  async function fetchQuickFacts(memberId, profileId) {
    const { data, error } = await supabase
      .from('thread_quick_facts')
      .select('notes')
      .eq('member_id', memberId)
      .eq('virtual_profile_id', profileId)
      .maybeSingle();
    if (error) return;
    setQuickFactsText(data?.notes || '');
  }

  async function fetchMemberProfile(memberId) {
    const { data, error } = await supabase
      .from('member_profiles')
      .select('age, hobbies, city, photo_url, status_emoji')
      .eq('member_id', memberId)
      .maybeSingle();
    if (error) return setSelectedMemberProfile(null);
    setSelectedMemberProfile(data || null);
  }

  async function saveQuickFacts() {
    if (!selectedThread) return;
    const { error } = await supabase
      .from('thread_quick_facts')
      .upsert({
        member_id: selectedThread.member_id,
        virtual_profile_id: selectedThread.virtual_profile_id,
        notes: quickFactsText,
      }, { onConflict: 'member_id,virtual_profile_id' });
    if (error) return setStatus(error.message);
    setStatus('Quick Facts kaydedildi.');
  }

  async function fetchRegisteredMembers() {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('members')
      .select('id, username, created_at')
      .order('created_at', { ascending: false });
    setLoadingMembers(false);
    if (error) return setStatus(error.message);
    setRegisteredMembers(data || []);
  }

  async function deleteMember(memberId) {
    const { error } = await supabase.from('members').delete().eq('id', memberId);
    if (error) return setStatus(error.message);
    setRegisteredMembers((prev) => prev.filter((m) => m.id !== memberId));
    setStatus('Kullanıcı silindi.');
  }

  function openChatWithProfile(profileId) {
    setSelectedProfileId(profileId);
    setUserView('chat');
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
    recordEngagement('admin_reply', selectedThread.member_id, selectedThread.virtual_profile_id, { source: 'admin_reply' });
    setAdminReply('');
    setAiSuggestions([]);
    fetchIncomingThreads();
    fetchThreadMessages(selectedThread.member_id, selectedThread.virtual_profile_id);
    fetchEngagementInsights();
    setStatus('Yanıt gönderildi.');
  }

  async function updateSelectedThreadTag(tag) {
    if (!selectedThread) return;
    try {
      await updateRows(
        'admin_threads',
        { status_tag: tag },
        (q) => q.eq('member_id', selectedThread.member_id).eq('virtual_profile_id', selectedThread.virtual_profile_id)
      );
      await insertRows('thread_events', {
        member_id: selectedThread.member_id,
        virtual_profile_id: selectedThread.virtual_profile_id,
        event_type: 'status_change',
        meta: { status_tag: tag },
      });
    } catch (error) {
      return setStatus(error.message);
    }
    setSelectedThread((prev) => (prev ? { ...prev, status_tag: tag } : prev));
    fetchIncomingThreads();
  }

  async function sendBulkTemplate() {
    const selectedKeys = Object.keys(selectedThreadKeys).filter((k) => selectedThreadKeys[k]);
    if (!selectedKeys.length) return setStatus('Önce en az bir thread seç.');
    if (!bulkTemplate.trim()) return;

    const rows = selectedKeys.map((key) => {
      const [member_id, virtual_profile_id] = key.split('::');
      return {
        member_id,
        virtual_profile_id,
        sender_role: 'virtual',
        content: bulkTemplate,
        seen_by_member: false,
        seen_by_admin: true,
      };
    });

    try {
      await insertRows('messages', rows);
      await insertRows('thread_events', rows.map((row) => ({
        member_id: row.member_id,
        virtual_profile_id: row.virtual_profile_id,
        event_type: 'bulk_sent',
        meta: { template: bulkTemplate },
      })));
    } catch (error) {
      return setStatus(error.message);
    }
    setSelectedThreadKeys({});
    setStatus(`${rows.length} thread için bulk mesaj gönderildi.`);
    fetchIncomingThreads();
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
    <div className={`layout ${isAdmin ? 'layout-admin' : ''}`}>
      <header className={`topbar ${isAdmin ? 'topbar-admin' : ''}`}>
        <h1 className="brand"><span className="brand-icon">✦</span> Flort Chat</h1>
        <div className="topbar-actions">
          {isAdmin && loggedIn && (
            <div className="admin-nav-pills">
              <button type="button" className={`nav-pill ${adminTab === 'chat' ? 'active' : ''}`} onClick={() => setAdminTab('chat')}>Chat</button>
              <button type="button" className={`nav-pill ${adminTab === 'stats' ? 'active' : ''}`} onClick={() => setAdminTab('stats')}>Stats</button>
              <button type="button" className={`nav-pill ${adminTab === 'settings' ? 'active' : ''}`} onClick={() => setAdminTab('settings')}>Settings</button>
            </div>
          )}
          {!loggedIn && (
            <button className="linkish" onClick={() => setMode(mode === 'user' ? 'admin' : 'user')}>
              {mode === 'user' ? 'Admin girişi' : 'Kullanıcı girişi'}
            </button>
          )}
          {loggedIn && <button onClick={handleSignOut}>Çıkış</button>}
        </div>
      </header>

      {loggedIn && !isAdmin && (
        <section className="user-nav-strip card">
          <button type="button" onClick={() => setUserView('discover')}>Keşfet</button>
          <button type="button" onClick={() => setUserView('chat')}>Mesaj Kutusu</button>
          <span className="mini-stat">👍 {Object.values(likedProfiles).filter(Boolean).length}</span>
          <span className="mini-stat">💘 {Object.values(heartedProfiles).filter(Boolean).length}</span>
          <span className="mini-stat">👋 {Object.values(wavedProfiles).filter(Boolean).length}</span>
        </section>
      )}

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
        <main className="admin-modern compact-shell admin-ops">
          <aside className="admin-left card">
            {selectedThread && (
              <div className="meta selected-profile-meta left-profile-meta">
                <h4>Aktif Konuşan Kullanıcı</h4>
                {selectedMemberProfile?.photo_url && <img src={selectedMemberProfile.photo_url} alt={selectedThread.member_username} className="profile-photo" />}
                <p><strong>Kullanıcı Adı:</strong> {selectedThread.member_username}</p>
                <p><strong>Yaş:</strong> {selectedMemberProfile?.age || '-'}</p>
                <p><strong>Şehir:</strong> {selectedMemberProfile?.city || '-'}</p>
                <p><strong>Hobiler:</strong> {selectedMemberProfile?.hobbies || '-'}</p>
                <p><strong>Durum:</strong> {selectedMemberProfile?.status_emoji || '🙂'}</p>
              </div>
            )}

            <div className="panel-title-row panel-head">
              <h3>Mesaj Bekleyen Thread'ler</h3>
            </div>
            <div className="thread-queue modern-thread-queue" ref={threadQueueRef}>
              {sortedIncomingThreads.map((thread) => {
                const threadProfile = profileById[thread.virtual_profile_id];
                const waitingReply = thread.last_sender_role === 'member';
                return (
                  <button
                    key={`${thread.member_id}-${thread.virtual_profile_id}`}
                    onClick={() => setSelectedThread(thread)}
                    className={`thread-item modern ${selectedThread?.member_id === thread.member_id && selectedThread?.virtual_profile_id === thread.virtual_profile_id ? 'active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedThreadKeys[threadKey(thread.member_id, thread.virtual_profile_id)]}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        setSelectedThreadKeys((prev) => ({
                          ...prev,
                          [threadKey(thread.member_id, thread.virtual_profile_id)]: e.target.checked,
                        }))
                      }
                    />
                    <span className="thread-avatar-wrap">
                      {threadProfile?.photo_url ? (
                        <img src={threadProfile.photo_url} alt={thread.virtual_name} className="thread-avatar" />
                      ) : (
                        <span className="thread-avatar-fallback">{thread.virtual_name?.slice(0, 1)}</span>
                      )}
                    </span>
                    <span className="thread-copy">
                      <strong>{thread.member_username} → {thread.virtual_name}</strong>
                      {thread.last_message_content && <small>{thread.last_message_content}</small>}
                      {waitingReply && <small className="pending-badge">Cevap bekliyor</small>}
                      {adminTypingByThread[threadKey(thread.member_id, thread.virtual_profile_id)] && <small>• yazıyor...</small>}
                    </span>
                    {adminUnreadByThread[threadKey(thread.member_id, thread.virtual_profile_id)] > 0 && (
                      <span className="unread-pill">{adminUnreadByThread[threadKey(thread.member_id, thread.virtual_profile_id)]}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="meta">
              <h4>SLA Paneli</h4>
              <p><strong>Cevaplanmamış thread:</strong> {slaStats.waitingCount}</p>
              <p><strong>Ort. bekleme süresi:</strong> {slaStats.avgWaitMin > 0 && slaStats.avgWaitMin < 1 ? '<1 dk' : `${slaStats.avgWaitMin.toFixed(1)} dk`}</p>
            </div>

            <div className="meta">
              <h4>Engagement (7 Gün)</h4>
              <p><strong>Yoğun saatler:</strong></p>
              <ul className="insight-list">
                {engagementInsights.topHours.map((h) => (
                  <li key={h.label}>{h.label} → {h.count} mesaj</li>
                ))}
              </ul>
              <p><strong>İlgi gören profiller:</strong></p>
              <ul className="insight-list">
                {engagementInsights.topProfiles.map((p) => (
                  <li key={p.name}>{p.name} → {p.count} etkileşim</li>
                ))}
              </ul>
            </div>

            <div className="meta">
              <h4>Bulk Aksiyon</h4>
              <select value={bulkTemplate} onChange={(e) => setBulkTemplate(e.target.value)}>
                {BULK_TEMPLATES.map((tpl) => (
                  <option key={tpl} value={tpl}>{tpl}</option>
                ))}
              </select>
              <button onClick={sendBulkTemplate}>Seçili thread’lere template gönder</button>
            </div>
          </aside>

          <section className="admin-center card">
            {adminTab === 'chat' && (
              <>
                <div className="chat-header admin-center-head">
                  <div>
                    <h3>{selectedThread?.virtual_name || 'Sohbet seç'}</h3>
                    <small>{selectedThreadProfile && onlineProfiles[selectedThreadProfile.id] ? 'Online' : 'Offline'}</small>
                  </div>
                  <select value={selectedThread?.status_tag || 'takip_edilecek'} onChange={(e) => updateSelectedThreadTag(e.target.value)} style={{ width: 'auto' }}>
                    {THREAD_TAGS.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                  <button type="button" className="drawer-toggle" onClick={() => setAdminDrawerOpen((v) => !v)}>
                    {adminDrawerOpen ? 'Paneli Gizle' : 'Paneli Aç'}
                  </button>
                </div>

                <div className="chat-box admin-chat-box" ref={adminChatBoxRef}>
                  {threadMessages.map((msg) => {
                    const audioUrl = getAudioUrl(msg.content);
                    return (
                      <div key={msg.id} className={`msg ${msg.sender_role}`}>
                        <span>{msg.sender_role === 'member' ? selectedThread?.member_username : selectedThread?.virtual_name}</span>
                        {audioUrl ? <audio controls src={audioUrl} className="audio-player" /> : <p>{msg.content}</p>}
                        <small>
                          {formatTime(msg.created_at)}
                          {msg.sender_role === 'virtual' ? <span className={`ticks ${msg.seen_by_member ? 'seen' : ''}`} title={msg.seen_by_member_at ? `Görüldü: ${formatTime(msg.seen_by_member_at)}` : `Teslim: ${formatTime(msg.created_at)}`}>✓✓</span> : ''}
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

                <textarea
                  className="grow-textarea"
                  placeholder="Sanal profil cevabı"
                  value={adminReply}
                  onChange={(e) => {
                    setAdminReply(e.target.value);
                    autoResizeTextarea(e.target, 260);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAdminReply(); } }}
                />
                <button onClick={sendAdminReply}>Yanıt Gönder</button>
              </>
            )}

            {adminTab === 'stats' && (
              <div className="stats-dashboard">
                <h3>Stats Dashboard ({statsRange === 'daily' ? 'Günlük' : statsRange === 'weekly' ? 'Haftalık' : 'Aylık'})</h3>
                <div className="stats-range-switch">
                  <button type="button" className={statsRange === 'daily' ? 'active' : ''} onClick={() => setStatsRange('daily')}>Günlük</button>
                  <button type="button" className={statsRange === 'weekly' ? 'active' : ''} onClick={() => setStatsRange('weekly')}>Haftalık</button>
                  <button type="button" className={statsRange === 'monthly' ? 'active' : ''} onClick={() => setStatsRange('monthly')}>Aylık</button>
                </div>
                <div className="stats-grid">
                  <div className="meta stat-card"><small>Toplam Mesaj</small><strong>{adminStats.totalMessagesToday}</strong></div>
                  <div className="meta stat-card"><small>Üye Mesajı</small><strong>{adminStats.memberMessagesToday}</strong></div>
                  <div className="meta stat-card"><small>Admin Cevabı</small><strong>{adminStats.adminRepliesToday}</strong></div>
                  <div className="meta stat-card"><small>Cevaplanan Thread</small><strong>{adminStats.respondedThreadsToday}</strong></div>
                  <div className="meta stat-card"><small>Yeni Üye Kaydı</small><strong>{adminStats.newMembersToday}</strong></div>
                  <div className="meta stat-card"><small>Aktif Thread</small><strong>{adminStats.activeThreadsToday}</strong></div>
                  <div className="meta stat-card"><small>Ort. Cevap Süresi</small><strong>{adminStats.avgResponseMinToday.toFixed(1)} dk</strong></div>
                </div>

                <div className="stats-lists">
                  <div className="meta">
                    <p><strong>Yoğun Saatler</strong></p>
                    <ul className="insight-list">
                      {engagementInsights.topHours.map((h) => <li key={h.label}>{h.label} → {h.count}</li>)}
                    </ul>
                  </div>
                  <div className="meta">
                    <p><strong>En Çok İlgi Gören Profiller</strong></p>
                    <ul className="insight-list">
                      {engagementInsights.topProfiles.map((p) => <li key={p.name}>{p.name} → {p.count}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {adminTab === 'settings' && (
              <div className="settings-page">
                <div className="meta">
                  <h3>Settings</h3>
                  <label className="toggle-row">
                    <span>Bildirim sesi</span>
                    <input
                      type="checkbox"
                      checked={notificationSoundEnabled}
                      onChange={(e) => setNotificationSoundEnabled(e.target.checked)}
                    />
                  </label>
                </div>

                <div className="meta">
                  <div className="panel-title-row panel-divider">
                    <h3>Sanal Profil Oluştur</h3>
                    <button type="button" className="icon-dice" onClick={fillRandomVirtualProfile} aria-label="Rastgele üret">🎲</button>
                  </div>

                  <label className="floating-field">
                    <input placeholder=" " value={profileForm.name} onChange={(e) => setProfileForm((s) => ({ ...s, name: e.target.value }))} />
                    <span>Ad (boşsa otomatik)</span>
                  </label>
                  <label className="floating-field">
                    <input placeholder=" " type="number" value={profileForm.age} onChange={(e) => setProfileForm((s) => ({ ...s, age: e.target.value }))} />
                    <span>Yaş (boşsa otomatik)</span>
                  </label>
                  <label className="floating-field">
                    <input placeholder=" " value={profileForm.city} onChange={(e) => setProfileForm((s) => ({ ...s, city: e.target.value }))} />
                    <span>Şehir (boşsa otomatik)</span>
                  </label>
                  <label className="floating-field">
                    <input placeholder=" " value={profileForm.gender} onChange={(e) => setProfileForm((s) => ({ ...s, gender: e.target.value }))} />
                    <span>Cinsiyet</span>
                  </label>
                  <label className="floating-field">
                    <textarea placeholder=" " value={profileForm.hobbies} onChange={(e) => setProfileForm((s) => ({ ...s, hobbies: e.target.value }))} />
                    <span>Hobiler</span>
                  </label>

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
                  {profileForm.photo_url && <img src={profileForm.photo_url} alt="Önizleme" className="upload-preview" />}

                  <button onClick={createVirtualProfile}>Kaydet (Foto + Otomatik İsim/Şehir/Yaş)</button>
                </div>

                <div className="meta">
                  <h3>Kayıt Olan Kullanıcılar</h3>
                  {loadingMembers ? (
                    <p>Yükleniyor...</p>
                  ) : (
                    <div className="member-list">
                      {registeredMembers.map((member) => (
                        <div key={member.id} className="member-row">
                          <div>
                            <strong>{member.username}</strong>
                            <small>{new Date(member.created_at).toLocaleString('tr-TR')}</small>
                          </div>
                          <button type="button" className="danger-btn" onClick={() => deleteMember(member.id)}>Sil</button>
                        </div>
                      ))}
                      {!registeredMembers.length && <p>Kayıtlı kullanıcı yok.</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          {adminDrawerOpen && adminTab === 'chat' && (
            <aside className="admin-right card drawer-panel">
              {selectedThreadProfile && (
                <div className="meta selected-profile-meta">
                  <h4>Seçili Profil Bilgileri</h4>
                  {selectedThreadProfile.photo_url && <img src={selectedThreadProfile.photo_url} alt={selectedThreadProfile.name} className="profile-photo" />}
                  <p><strong>Ad:</strong> {selectedThreadProfile.name}</p>
                  <p><strong>Yaş:</strong> {selectedThreadProfile.age}</p>
                  <p><strong>Şehir:</strong> {selectedThreadProfile.city || '-'}</p>
                  <p><strong>Hobiler:</strong> {selectedThreadProfile.hobbies || '-'}</p>
                </div>
              )}

              <div className="meta">
                <h4>Quick Facts</h4>
                <textarea
                  placeholder="Kullanıcı hakkında önemli notlar (şehir, iş, sınırlar, tercih vb.)"
                  value={quickFactsText}
                  onChange={(e) => setQuickFactsText(e.target.value)}
                />
                <button onClick={saveQuickFacts}>Quick Facts Kaydet</button>
              </div>

            </aside>
          )}
        </main>
      ) : userView === 'discover' ? (
        <main className="dashboard compact-shell discover-shell">
          <section className="card discover-hero">
            <h2>Discover 2026 ✨</h2>
            <p>Şehir, cinsiyet ve ilgi alanlarına göre profilleri keşfet. Hızlı aksiyonlarla sohbet başlat.</p>
            <div className="discover-filters">
              <input placeholder="Şehir ara" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
              <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)}>
                <option value="all">Tümü</option>
                <option value="Kadın">Kadın</option>
                <option value="Erkek">Erkek</option>
              </select>
              <input placeholder="İsim / hobi ara" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} />
              <select value={discoverSort} onChange={(e) => setDiscoverSort(e.target.value)}>
                <option value="match">Uyuma Göre</option>
                <option value="online">Online</option>
                <option value="newest">Yeni Eklenen</option>
                <option value="age_asc">Yaş (Artan)</option>
              </select>
              <button type="button" onClick={() => setUserView('chat')}>Mesaj Kutuma Git</button>
            </div>
            <div className="discover-meta-row">
              <span className="mini-pill">{discoverProfiles.length} profil bulundu</span>
              <span className="mini-pill">Trend: kısa mesaj + hızlı etkileşim</span>
            </div>
          </section>

          <section className="discover-grid">
            {discoverProfiles.map((profile) => (
              <article key={profile.id} className="card discover-card">
                <div className="discover-topline">
                  <span className={`online-dot ${displayOnlineProfiles[profile.id] ? 'on' : ''}`} />
                  <span>{displayOnlineProfiles[profile.id] ? 'Online' : 'Offline'}</span>
                  <span className="verified-pill">✔ doğrulandı</span>
                </div>
                {profile.photo_url ? <img src={profile.photo_url} alt={profile.name} className="discover-photo" /> : <div className="discover-photo-fallback">{profile.name?.slice(0, 1)}</div>}
                <h3>{profile.name}, {profile.age}</h3>
                <p>{profile.city || 'Türkiye'} • {profile.gender || '-'}</p>
                <small className="discover-hobbies">{profile.hobbies || 'Hobi bilgisi yok.'}</small>
                <div className="discover-actions">
                  <button type="button" onClick={() => { setHeartedProfiles((s) => ({ ...s, [profile.id]: !s[profile.id] })); sendReaction(profile.id, 'heart'); }}>{heartedProfiles[profile.id] ? '💘 Kalp Atıldı' : '💘 Kalp At'}</button>
                  <button type="button" onClick={() => { setWavedProfiles((s) => ({ ...s, [profile.id]: !s[profile.id] })); sendReaction(profile.id, 'wave'); }}>{wavedProfiles[profile.id] ? '👋 El Sallandı' : '👋 El Salla'}</button>
                  <button type="button" onClick={() => { setLikedProfiles((s) => ({ ...s, [profile.id]: !s[profile.id] })); sendReaction(profile.id, 'like'); }}>{likedProfiles[profile.id] ? '👍 Beğenildi' : '👍 Beğen'}</button>
                  <button type="button" className="cta-message" onClick={() => openChatWithProfile(profile.id)}>Mesaj At</button>
                </div>
              </article>
            ))}
          </section>
        </main>
      ) : (
        <main className="dashboard user-grid user-dashboard user-chat-layout compact-shell">
          <aside className="card">
            <h3>Sohbetler</h3>
            <div className="profile-list" ref={profileListRef}>
              {sortedProfiles.map((profile) => (
                <button key={profile.id} onClick={() => setSelectedProfileId(profile.id)} className={`profile-item ${selectedProfileId === profile.id ? 'active' : ''} ${unreadByProfile[profile.id] > 0 ? 'has-unread' : ''}`}>
                  <span className={`avatar-wrap ${unreadByProfile[profile.id] > 0 ? 'ringing' : ''}`}>
                    {profile.photo_url ? <img src={profile.photo_url} alt={profile.name} className="avatar" /> : <span className="avatar-fallback">{profile.name?.slice(0,1)}</span>}
                  </span>
                  <span className="profile-main">
                    <strong>{profile.name}</strong>
                    <small>{profile.city || 'Türkiye'}</small>
                  </span>
                  <span className={`online-dot ${displayOnlineProfiles[profile.id] ? 'on' : ''}`} />
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
                <p><strong>Ortak ilgi skoru:</strong> %{interestScore}</p>
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
                      {msg.sender_role === 'member' ? <span className={`ticks ${msg.seen_by_admin ? 'seen' : ''}`} title={msg.seen_by_admin_at ? `Görüldü: ${formatTime(msg.seen_by_admin_at)}` : `Teslim: ${formatTime(msg.created_at)}`}>✓✓</span> : ''}
                    </small>
                  </div>
                );
              })}
            </div>
            {typingLabel && <div className="typing-indicator">{typingLabel}</div>}
            <div className="row">
              <textarea
                className="grow-textarea"
                placeholder="Mesaj yaz"
                value={newMessage}
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  autoResizeTextarea(e.target, 220);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
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
