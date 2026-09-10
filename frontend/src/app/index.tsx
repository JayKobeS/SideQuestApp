import { api } from '@/api/axios';
import { EarthGlobe, LocationItem } from '@/components/EarthGlobe';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { useLocation } from '@/context/LocationContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Scope = 'world' | 'country' | 'local';
type LibraryTab = 'quests' | 'daily' | 'medals';
type Quest = {
  id: number;
  template_id: number;
  title: string;
  description: string;
  category: string;
  status: string;
  xp_reward: number;
  medal: string | null;
  expires_at: string;
  daily_key: string | null;
  country_code: string | null;
  country: string | null;
  city: string | null;
  lat: number | null;
  lon: number | null;
  review_note?: string | null;
};
type Template = Omit<Quest, 'status' | 'expires_at' | 'daily_key' | 'template_id'>;
type Board = {
  quests: Quest[];
  capacities: Record<Scope, number>;
  daily_key: string;
  daily_reset_at: string;
};

const scopes: { key: Scope; label: string }[] = [
  { key: 'world', label: 'Świat' },
  { key: 'country', label: 'Kraj' },
  { key: 'local', label: 'Miasto' },
];
const scopeMeta: Record<Scope, { icon: string; duration: string }> = {
  world: { icon: '◎', duration: '6 miesięcy' },
  country: { icon: '⚑', duration: '30 dni' },
  local: { icon: '⌖', duration: '7 dni · 30 km' },
};
const statuses: Record<string, string> = {
  active: 'Aktywne',
  pending_review: 'W weryfikacji',
  approved: 'Ukończone',
  completed: 'Ukończone',
  rejected: 'Do poprawy',
  expired: 'Wygasło',
};
const medalNames: Record<string, string> = {
  bronze: 'Brąz', silver: 'Srebro', gold: 'Złoto', platinum: 'Platyna',
};
const medalColors: Record<string, string> = {
  bronze: '#a66b42', silver: '#718096', gold: '#ad841e', platinum: '#6752c9',
};
const occupiesSlot = (quest: Quest) => ['active', 'pending_review', 'rejected'].includes(quest.status);

function getErrorMessage(error: any) {
  const detail = error.response?.data?.detail;
  return typeof detail === 'string' ? detail : detail?.message || 'Coś poszło nie tak. Spróbuj ponownie.';
}

function deadline(quest: Quest) {
  if (quest.category === 'achievement') return 'Bez terminu';
  return `do ${new Date(quest.expires_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { location, status: locationStatus, requestLocation } = useLocation();
  const rollMapRef = useRef<((item: LocationItem) => void) | null>(null);
  const resumeMapRef = useRef<(() => void) | null>(null);
  const locateMapRef = useRef<(() => void) | null>(null);
  const zoomMapRef = useRef<((direction: 'in' | 'out') => void) | null>(null);
  const busyRef = useRef(false);
  const pendingResultRef = useRef<Quest | null>(null);

  const [scope, setScope] = useState<Scope>('world');
  const [board, setBoard] = useState<Board | null>(null);
  const [medals, setMedals] = useState<Template[]>([]);
  const [profile, setProfile] = useState({ username: '', level: 1, xp: 0 });
  const [profileOpen, setProfileOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>('quests');
  const [detail, setDetail] = useState<Quest | null>(null);
  const [rolledQuest, setRolledQuest] = useState<Quest | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapAnimating, setMapAnimating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [boardResponse, profileResponse, medalResponse] = await Promise.all([
      api.get<Board>('/quests/board'),
      api.get('/auth/me'),
      api.get<Template[]>('/quests/achievements'),
    ]);
    setBoard(boardResponse.data);
    setProfile(profileResponse.data);
    setMedals(medalResponse.data);
  }, []);

  useEffect(() => {
    refresh().catch(error => setError(getErrorMessage(error))).finally(() => setLoading(false));
    void requestLocation();
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        refresh().catch(() => undefined);
        void requestLocation();
      }
    });
    return () => listener.remove();
  }, [refresh, requestLocation]);

  useEffect(() => {
    if (!board) return;
    const delay = Math.max(1000, Math.min(60000, new Date(board.daily_reset_at).getTime() - Date.now() + 100));
    const timer = setTimeout(() => refresh().catch(() => undefined), delay);
    return () => clearTimeout(timer);
  }, [board, refresh]);

  const perform = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setMessage(null);
    try { await action(); } catch (caught) { setError(getErrorMessage(caught)); }
    finally { busyRef.current = false; setBusy(false); }
  };

  const quests = board?.quests || [];
  const scopeQuests = quests.filter(quest => quest.category === scope && occupiesSlot(quest));
  const dailyQuests = quests.filter(quest => quest.category === 'daily' && quest.daily_key === board?.daily_key);
  const capacity = board?.capacities[scope] || { world: 4, country: 5, local: 3 }[scope];
  const hasFreeSlot = scopeQuests.length < capacity;

  const roll = () => perform(async () => {
    let point = location;
    if (scope !== 'world') point = await requestLocation();
    if (scope !== 'world' && !point) {
      setError(locationStatus === 'denied'
        ? 'Lokalizacja jest zablokowana. Włącz ją w ustawieniach telefonu.'
        : 'Nie udało się ustalić lokalizacji. Sprawdź GPS i spróbuj ponownie.');
      return;
    }
    const response = await api.post<Quest>('/quests/explore', {
      category: scope,
      location: point ? { lat: point.latitude, lon: point.longitude } : null,
    });
    const quest = response.data;
    setBoard(current => current ? { ...current, quests: [quest, ...current.quests] } : current);
    if (quest.lat !== null && quest.lon !== null && !mapLoading) {
      pendingResultRef.current = quest;
      setMapAnimating(true);
      rollMapRef.current?.({
        id: String(quest.id),
        title: quest.title,
        country: quest.country || quest.country_code || '',
        lat: quest.lat,
        lon: quest.lon,
      });
    } else setRolledQuest(quest);
    await refresh();
  });

  const returnToGlobe = () => {
    setRolledQuest(null);
    if (mapAnimating) return;
    setMapAnimating(true);
    resumeMapRef.current?.();
  };

  const changeScope = (next: Scope) => {
    if (mapAnimating) return;
    if (rolledQuest) {
      setRolledQuest(null);
      setMapAnimating(true);
      resumeMapRef.current?.();
    }
    setScope(next);
    setError(null);
  };

  const openLibrary = (tab: LibraryTab) => {
    setLibraryTab(tab);
    setLibraryOpen(true);
    setError(null);
    setMessage(null);
  };

  const openDetail = (quest: Quest) => {
    setNote('');
    setDetail(quest);
    setLibraryOpen(false);
  };

  const submit = () => perform(async () => {
    if (!detail) return;
    await api.post(`/quests/${detail.id}/submit`, { note: note.trim() || null });
    setDetail(null);
    await refresh();
  });

  const claimMedal = (template: Template) => perform(async () => {
    const response = await api.post<Quest>(`/quests/achievements/${template.id}/claim`);
    setDetail(response.data);
    setLibraryOpen(false);
    await refresh();
  });

  const questRow = (quest: Quest) => (
    <Pressable key={quest.id} onPress={() => openDetail(quest)} style={({ pressed }) => [styles.questRow, pressed && styles.pressed]}>
      <View style={styles.questNumber}><Text style={styles.questNumberText}>{scopeMeta[(quest.category === 'achievement' ? 'world' : quest.category) as Scope]?.icon || '•'}</Text></View>
      <View style={styles.questCopy}>
        <Text style={styles.questTitle} numberOfLines={1}>{quest.title}</Text>
        <Text style={styles.questMeta}>{statuses[quest.status]} · {deadline(quest)}</Text>
      </View>
      <Text style={styles.xp}>+{quest.xp_reward}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <EarthGlobe
        userLocation={location}
        avatarLabel={profile.username}
        onLoadingChange={setMapLoading}
        onRollTrigger={callback => { rollMapRef.current = callback; }}
        onResumeTrigger={callback => { resumeMapRef.current = callback; }}
        onLocateTrigger={callback => { locateMapRef.current = callback; }}
        onZoomTrigger={callback => { zoomMapRef.current = callback; }}
        onRollFinished={() => {
          setMapAnimating(false);
          setRolledQuest(pendingResultRef.current);
          pendingResultRef.current = null;
        }}
        onResetFinished={() => setMapAnimating(false)}
      />

      <View style={[styles.top, { top: Math.max(insets.top, 12) + 4 }]} pointerEvents="box-none">
        <Text style={styles.logo}>sidequest<Text style={styles.logoDot}>.</Text></Text>
        <View style={styles.scopeIsland}>
          {scopes.map(item => (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: scope === item.key }}
              onPress={() => changeScope(item.key)}
              style={[styles.scopeButton, scope === item.key && styles.scopeActive]}
            >
              <Text style={[styles.scopeLabel, scope === item.key && styles.scopeLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.mapTools}>
        <Pressable accessibilityLabel="Przybliż mapę" onPress={() => zoomMapRef.current?.('in')} style={styles.mapTool}><Text style={styles.mapToolText}>+</Text></Pressable>
        <Pressable accessibilityLabel="Oddal mapę" onPress={() => zoomMapRef.current?.('out')} style={styles.mapTool}><Text style={styles.mapToolText}>−</Text></Pressable>
        <Pressable
          accessibilityLabel="Pokaż moją lokalizację"
          onPress={() => perform(async () => {
            const point = await requestLocation();
            if (point) locateMapRef.current?.();
            else setError('Nie udało się pobrać lokalizacji. Sprawdź GPS i uprawnienia.');
          })}
          style={[styles.mapTool, styles.locationTool]}
        ><Text style={styles.locationToolText}>⌖</Text></Pressable>
      </View>

      {error && (
        <View style={[styles.errorToast, { bottom: Math.max(insets.bottom, 10) + 104 }]}>
          <Text style={styles.errorText}>{error}</Text>
          {locationStatus === 'denied' && <Pressable onPress={() => Linking.openSettings()}><Text style={styles.settingsLink}>Ustawienia</Text></Pressable>}
          <Pressable accessibilityLabel="Zamknij komunikat" onPress={() => setError(null)}><Text style={styles.dismiss}>×</Text></Pressable>
        </View>
      )}

      {message && (
        <Pressable onPress={() => setMessage(null)} style={[styles.infoToast, { bottom: Math.max(insets.bottom, 10) + 104 }]}>
          <Text style={styles.infoText}>{message}</Text><Text style={styles.dismiss}>×</Text>
        </Pressable>
      )}

      {rolledQuest && (
        <View style={[styles.resultCard, { bottom: Math.max(insets.bottom, 10) + 105 }]}>
          <View style={styles.resultIcon}><Text style={styles.resultIconText}>✦</Text></View>
          <Pressable style={styles.questCopy} onPress={() => openDetail(rolledQuest)}>
            <Text style={styles.resultCaption}>WYLOSOWANO</Text>
            <Text style={styles.resultTitle} numberOfLines={1}>{rolledQuest.title}</Text>
            <Text style={styles.resultMeta}>{deadline(rolledQuest)} · +{rolledQuest.xp_reward} EXP</Text>
          </Pressable>
          <Pressable accessibilityLabel="Wróć do globu" onPress={returnToGlobe} style={styles.resultClose}><Text style={styles.resultCloseText}>×</Text></Pressable>
        </View>
      )}

      <View style={[styles.bottomIsland, { bottom: Math.max(insets.bottom, 10) }]}>
        <Pressable accessibilityLabel="Znajomi" onPress={() => setMessage('Znajomi pojawią się tutaj w kolejnym etapie.')} style={styles.bottomAction}>
          <Text style={styles.bottomIcon}>♙</Text><Text style={styles.bottomLabel}>Znajomi</Text>
        </Pressable>
        <Pressable accessibilityLabel="Osiągnięcia" onPress={() => openLibrary('medals')} style={styles.bottomAction}>
          <Text style={styles.bottomIcon}>✦</Text><Text style={styles.bottomLabel}>Osiągnięcia</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`Wylosuj jedno zadanie: ${scope}`}
          disabled={busy || loading || mapLoading || mapAnimating || !!rolledQuest || !hasFreeSlot}
          onPress={roll}
          style={[styles.rollButton, (busy || loading || mapLoading || mapAnimating || !!rolledQuest || !hasFreeSlot) && styles.disabled]}
        >
          {busy || mapAnimating ? <ActivityIndicator color="#fff" /> : <><Text style={styles.rollIcon}>✦</Text><Text style={styles.rollText}>{hasFreeSlot ? 'ROLL' : 'PEŁNE'}</Text></>}
        </Pressable>
        <Pressable accessibilityLabel="Moje zadania" onPress={() => openLibrary('quests')} style={styles.bottomAction}>
          <View><Text style={styles.bottomIcon}>☰</Text>{scopeQuests.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{scopeQuests.length}</Text></View>}</View>
          <Text style={styles.bottomLabel}>Zadania</Text>
        </Pressable>
        <Pressable accessibilityLabel="Otwórz profil" onPress={() => setProfileOpen(true)} style={styles.bottomAction}>
          <View style={styles.navAvatar}><Text style={styles.navAvatarText}>{(profile.username || 'TY').slice(0, 2).toUpperCase()}</Text></View>
          <Text style={styles.bottomLabel}>Profil</Text>
        </Pressable>
      </View>

      {!location && locationStatus !== 'loading' && (
        <Pressable onPress={() => locationStatus === 'denied' ? Linking.openSettings() : requestLocation()} style={[styles.locationHint, { bottom: Math.max(insets.bottom, 10) + 92 }]}>
          <Text style={styles.locationHintText}>⌖  Włącz lokalizację</Text>
        </Pressable>
      )}

      <ProfileDrawer visible={profileOpen} onClose={() => { setProfileOpen(false); refresh().catch(() => undefined); }} />

      <Modal visible={libraryOpen} transparent animationType="slide" onRequestClose={() => setLibraryOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.librarySheet, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Twoje wyzwania</Text>
              <Pressable accessibilityLabel="Zamknij listę" onPress={() => setLibraryOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <View style={styles.libraryTabs}>
              {([
                ['quests', 'Zadania'], ['daily', 'Dzienne'], ['medals', 'Medale'],
              ] as [LibraryTab, string][]).map(([key, label]) => (
                <Pressable key={key} onPress={() => setLibraryTab(key)} style={[styles.libraryTab, libraryTab === key && styles.libraryTabActive]}>
                  <Text style={[styles.libraryTabText, libraryTab === key && styles.libraryTabTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView contentContainerStyle={styles.libraryContent} showsVerticalScrollIndicator={false}>
              {libraryTab === 'quests' && (
                <>
                  <View style={styles.listIntro}><Text style={styles.listTitle}>{scopeMeta[scope].icon}  {scopes.find(item => item.key === scope)?.label}</Text><Text style={styles.listCount}>{scopeQuests.length}/{capacity}</Text></View>
                  <Text style={styles.listSubtitle}>{scopeMeta[scope].duration} na wykonanie · losujesz po jednym</Text>
                  {scopeQuests.length ? scopeQuests.map(questRow) : <Text style={styles.emptyText}>Nie masz jeszcze zadań w tej kategorii.</Text>}
                </>
              )}
              {libraryTab === 'daily' && (
                <>
                  <View style={styles.listIntro}><Text style={styles.listTitle}>◷  Dzisiejsze</Text><Text style={styles.listCount}>{dailyQuests.length}/3</Text></View>
                  <Text style={styles.listSubtitle}>Nowy zestaw codziennie o 06:00 czasu polskiego</Text>
                  {dailyQuests.map(questRow)}
                </>
              )}
              {libraryTab === 'medals' && (
                <>
                  <View style={styles.listIntro}><Text style={styles.listTitle}>✦  Osiągnięcia</Text><Text style={styles.listCount}>{medals.length}</Text></View>
                  <Text style={styles.listSubtitle}>Największe wyzwania i nagrody EXP</Text>
                  {medals.map(template => {
                    const assigned = quests.find(quest => quest.template_id === template.id);
                    return (
                      <Pressable key={template.id} onPress={() => assigned ? openDetail(assigned) : claimMedal(template)} style={styles.questRow}>
                        <View style={[styles.medalDot, { backgroundColor: medalColors[template.medal || 'bronze'] }]} />
                        <View style={styles.questCopy}><Text style={styles.questTitle}>{template.title}</Text><Text style={styles.questMeta}>{medalNames[template.medal || 'bronze']} · {assigned ? statuses[assigned.status] : 'Podejmij'}</Text></View>
                        <Text style={styles.xp}>+{template.xp_reward}</Text><Text style={styles.chevron}>›</Text>
                      </Pressable>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detail} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.detailSheet, { paddingBottom: Math.max(insets.bottom, 22) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.detailStatus}>{detail ? statuses[detail.status] : ''}</Text>
              <Pressable accessibilityLabel="Zamknij szczegóły" onPress={() => setDetail(null)} style={styles.closeButton}><Text style={styles.closeText}>×</Text></Pressable>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.detailTitle}>{detail?.title}</Text>
              <Text style={styles.detailDescription}>{detail?.description}</Text>
              <Text style={styles.detailReward}>+{detail?.xp_reward} EXP · {detail && deadline(detail)}</Text>
              {detail?.review_note && <Text style={styles.reviewNote}>Uwagi: {detail.review_note}</Text>}
              {detail && ['active', 'rejected'].includes(detail.status) && (
                <>
                  <TextInput
                    accessibilityLabel="Opis wykonania zadania"
                    value={note}
                    onChangeText={setNote}
                    placeholder="Krótko opisz wykonanie…"
                    placeholderTextColor="#9b94a2"
                    multiline
                    maxLength={1000}
                    style={styles.noteInput}
                  />
                  <Pressable disabled={busy} onPress={submit} style={[styles.submitButton, busy && styles.disabled]}>
                    {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Zgłoś wykonanie</Text>}
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050816' },
  top: { position: 'absolute', left: 16, right: 16, alignItems: 'center', gap: 10 },
  logo: { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -1.4 },
  logoDot: { color: '#8974e8' },
  scopeIsland: { flexDirection: 'row', width: '100%', maxWidth: 320, height: 42, padding: 4, borderRadius: 23, backgroundColor: 'rgba(247,245,240,.94)', boxShadow: '0 6px 18px rgba(0,0,0,.16)' },
  scopeButton: { flex: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  scopeActive: { backgroundColor: '#6550ce' },
  scopeLabel: { color: '#77717f', fontSize: 12, fontWeight: '600' },
  scopeLabelActive: { color: '#fff' },
  mapTools: { position: 'absolute', right: 16, top: '42%', gap: 8 },
  mapTool: { width: 40, height: 40, borderRadius: 21, backgroundColor: 'rgba(247,245,240,.94)', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,.16)' },
  mapToolText: { color: '#34303a', fontSize: 21 },
  locationTool: { backgroundColor: '#6550ce' },
  locationToolText: { color: '#fff', fontSize: 21 },
  bottomIsland: { position: 'absolute', left: 8, right: 8, alignSelf: 'center', maxWidth: 430, height: 76, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 5, borderRadius: 28, backgroundColor: 'rgba(247,245,240,.97)', boxShadow: '0 10px 30px rgba(0,0,0,.24)' },
  bottomAction: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 3 },
  bottomIcon: { color: '#77717f', fontSize: 18 },
  bottomLabel: { color: '#77717f', fontSize: 8, fontWeight: '600' },
  navAvatar: { width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e5dffa' },
  navAvatarText: { color: '#6550ce', fontSize: 8, fontWeight: '800' },
  badge: { position: 'absolute', top: -5, right: -10, minWidth: 16, height: 16, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6550ce' },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  rollButton: { width: 88, height: 60, marginHorizontal: 2, borderRadius: 31, borderWidth: 4, borderColor: '#ded6fa', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6550ce', transform: [{ translateY: -6 }], boxShadow: '0 8px 18px rgba(101,80,206,.32)' },
  rollIcon: { color: '#fff', fontSize: 15 },
  rollText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  disabled: { opacity: .48 },
  pressed: { opacity: .72 },
  resultCard: { position: 'absolute', left: 16, right: 16, alignSelf: 'center', maxWidth: 430, minHeight: 80, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 24, backgroundColor: 'rgba(247,245,240,.97)', boxShadow: '0 10px 28px rgba(0,0,0,.22)' },
  resultIcon: { width: 42, height: 42, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8e2fa' },
  resultIconText: { color: '#6550ce', fontSize: 19 },
  resultCaption: { color: '#8c8493', fontSize: 7, fontWeight: '700', letterSpacing: 1.3 },
  resultTitle: { color: '#2f2935', fontSize: 15, fontWeight: '700', marginTop: 3 },
  resultMeta: { color: '#827a87', fontSize: 9, marginTop: 3 },
  resultClose: { width: 34, height: 34, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e9e5ed' },
  resultCloseText: { color: '#6f6677', fontSize: 22, marginTop: -2 },
  errorToast: { position: 'absolute', left: 16, right: 16, alignSelf: 'center', maxWidth: 430, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 19, backgroundColor: 'rgba(63,27,43,.96)' },
  errorText: { flex: 1, color: '#fce7ef', fontSize: 10, lineHeight: 14 },
  infoToast: { position: 'absolute', left: 16, right: 16, alignSelf: 'center', maxWidth: 430, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderRadius: 19, backgroundColor: 'rgba(33,28,48,.96)' },
  infoText: { flex: 1, color: '#f3efff', fontSize: 10 },
  settingsLink: { color: '#fff', fontSize: 10, fontWeight: '700' },
  dismiss: { color: '#fff', fontSize: 19 },
  locationHint: { position: 'absolute', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(11,14,26,.8)' },
  locationHintText: { color: '#e4ddfa', fontSize: 9, fontWeight: '600' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(6,7,16,.46)' },
  librarySheet: { width: '100%', maxWidth: 560, height: '72%', alignSelf: 'center', paddingHorizontal: 18, paddingTop: 9, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#f5f3ef' },
  detailSheet: { width: '100%', maxWidth: 560, maxHeight: '82%', alignSelf: 'center', paddingHorizontal: 22, paddingTop: 9, borderTopLeftRadius: 32, borderTopRightRadius: 32, backgroundColor: '#f5f3ef' },
  sheetHandle: { width: 32, height: 4, borderRadius: 3, alignSelf: 'center', backgroundColor: '#d8d2dc', marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sheetTitle: { color: '#302a36', fontSize: 24, fontWeight: '700', letterSpacing: -.7 },
  closeButton: { width: 40, height: 40, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e8e3ea' },
  closeText: { color: '#756c7a', fontSize: 24, marginTop: -2 },
  libraryTabs: { flexDirection: 'row', marginTop: 15, padding: 4, borderRadius: 21, backgroundColor: '#e8e4eb' },
  libraryTab: { flex: 1, minHeight: 37, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  libraryTabActive: { backgroundColor: '#fff' },
  libraryTabText: { color: '#837a88', fontSize: 11, fontWeight: '600' },
  libraryTabTextActive: { color: '#4c4059' },
  libraryContent: { paddingTop: 20, paddingBottom: 30 },
  listIntro: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listTitle: { color: '#342e3a', fontSize: 17, fontWeight: '700' },
  listCount: { color: '#6550ce', fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 13, backgroundColor: '#e7e1f7' },
  listSubtitle: { color: '#8c8491', fontSize: 10, marginTop: 5, marginBottom: 14 },
  questRow: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, borderRadius: 20, backgroundColor: '#fff' },
  questNumber: { width: 38, height: 38, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ece7f8' },
  questNumberText: { color: '#6550ce', fontSize: 16 },
  medalDot: { width: 12, height: 12, borderRadius: 7, marginHorizontal: 13 },
  questCopy: { flex: 1, minWidth: 0 },
  questTitle: { color: '#342e3a', fontSize: 13, fontWeight: '600' },
  questMeta: { color: '#8c8491', fontSize: 9, marginTop: 4 },
  xp: { color: '#6550ce', fontSize: 9, fontWeight: '700' },
  chevron: { color: '#aaa2ae', fontSize: 22 },
  emptyText: { color: '#8c8491', fontSize: 12, textAlign: 'center', paddingVertical: 42 },
  detailStatus: { color: '#6550ce', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  detailTitle: { color: '#302a36', fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -.7, marginTop: 14 },
  detailDescription: { color: '#7e7584', fontSize: 14, lineHeight: 22, marginTop: 14 },
  detailReward: { color: '#6550ce', fontSize: 11, fontWeight: '700', marginTop: 16 },
  reviewNote: { color: '#8b4c5c', fontSize: 12, lineHeight: 18, marginTop: 18 },
  noteInput: { minHeight: 100, textAlignVertical: 'top', padding: 15, marginTop: 22, borderRadius: 18, backgroundColor: '#fff', color: '#302a36', fontSize: 13 },
  submitButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', marginTop: 12, borderRadius: 25, backgroundColor: '#6550ce' },
  submitText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
