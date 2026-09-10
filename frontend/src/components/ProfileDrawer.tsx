import { api } from '@/api/axios';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
  useWindowDimensions,
} from 'react-native';

type Quest = {
  id: string;
  title: string;
  country: string;
  is_completed: boolean;
};

type Profile = {
  username: string;
  email: string;
  level: number;
  xp: number;
  role: 'user' | 'moderator' | 'admin' | 'owner';
  quests: Quest[];
};
type ProfileScreen = 'profile' | 'settings' | 'email' | 'password';

interface ProfileDrawerProps {
  visible: boolean;
  onClose: () => void;
}

const emptyProfile: Profile = {
  username: 'Ładowanie…',
  email: '',
  level: 1,
  xp: 0,
  role: 'user',
  quests: [],
};

export function ProfileDrawer({ visible, onClose }: ProfileDrawerProps) {
  const { logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 32, 430);
  const animation = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(false);
  const [screen, setScreen] = useState<ProfileScreen>('profile');
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    Animated.timing(animation, {
      toValue: visible ? 1 : 0,
      duration: visible ? 300 : 200,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [animation, visible]);

  useEffect(() => {
    if (!visible) return;

    let mounted = true;
    setLoading(true);
    api.get<Profile>('/auth/me')
      .then((response) => {
        if (mounted) setProfile({ ...emptyProfile, ...response.data, quests: response.data.quests ?? [] });
      })
      .catch(() => {
        // Profil pozostaje użyteczny także gdy API jest chwilowo niedostępne.
        if (mounted) setProfile((current) => current);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      setScreen('profile');
      setFeedback(null);
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
    }
  }, [visible]);

  const completedCount = profile.quests.filter((quest) => quest.is_completed).length;
  const countriesCount = new Set(profile.quests.map((quest) => quest.country)).size;
  const initials = profile.username.slice(0, 2).toUpperCase();

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const openAdminPanel = () => {
    onClose();
    router.push('/admin');
  };

  const getErrorMessage = (error: any) => error.response?.data?.detail || 'Nie udało się zapisać zmian. Spróbuj ponownie.';

  const handleEmailUpdate = async () => {
    if (!newEmail.includes('@') || !currentPassword) {
      setFeedback({ type: 'error', text: 'Podaj poprawny e-mail i aktualne hasło.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await api.put('/auth/me/email', { email: newEmail.trim(), current_password: currentPassword });
      setProfile((current) => ({ ...current, email: newEmail.trim() }));
      setCurrentPassword('');
      setFeedback({ type: 'success', text: 'Adres e-mail został zmieniony.' });
    } catch (error) {
      setFeedback({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = async () => {
    if (!currentPassword || newPassword.length < 6) {
      setFeedback({ type: 'error', text: 'Podaj aktualne hasło i nowe hasło (min. 6 znaków).' });
      return;
    }
    if (newPassword !== repeatPassword) {
      setFeedback({ type: 'error', text: 'Nowe hasła nie są takie same.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      await api.put('/auth/me/password', { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setRepeatPassword('');
      setFeedback({ type: 'success', text: 'Hasło zostało zmienione.' });
    } catch (error) {
      setFeedback({ type: 'error', text: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.overlay, { pointerEvents: visible ? 'auto' : 'none' }]}>
      <Animated.View style={[styles.backdrop, { opacity: animation.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel="Zamknij profil" />
      </Animated.View>

      <Animated.View style={[styles.modal, {
        width: cardWidth,
        opacity: animation,
        transform: [
          { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [42, 0] }) },
          { scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
        ],
      }]}>
        <View style={styles.topGlow} />
        <View style={styles.drawerHeader}>
          <Text style={styles.sectionLabel}>{screen === 'profile' ? 'TWÓJ PROFIL' : 'USTAWIENIA'}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} accessibilityLabel="Zamknij panel profilu">
            <Text style={styles.closeButtonText}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {screen === 'profile' ? <>
          <View style={styles.identityRow}>
            <View style={styles.avatarLarge}><Text style={styles.avatarLargeText}>{initials}</Text></View>
            <View style={styles.identityText}>
              <Text style={styles.username}>{profile.username}</Text>
              <Text style={styles.email}>{profile.email || 'Gotowy na kolejną misję'}</Text>
              <View style={styles.levelBadge}><Text style={styles.levelText}>POZIOM {profile.level}</Text></View>
            </View>
          </View>

          <View style={styles.xpCard}>
            <View style={styles.xpHeading}><Text style={styles.xpLabel}>DOŚWIADCZENIE</Text><Text style={styles.xpValue}>{profile.xp} XP</Text></View>
            <View style={styles.progressTrack}><View style={[styles.progressBar, { width: `${(profile.xp % 1000) / 10}%` }]} /></View>
            <Text style={styles.xpHint}>{1000 - (profile.xp % 1000)} XP do następnego poziomu</Text>
          </View>

          <Text style={styles.sectionLabel}>TWOJE STATYSTYKI</Text>
          <View style={styles.statsRow}>
            <Stat value={String(completedCount)} label="UKOŃCZONE" />
            <Stat value={String(countriesCount)} label="KRAJE" />
            <Stat value={String(profile.quests.length)} label="MISJE" />
          </View>

          <Text style={[styles.sectionLabel, styles.missionsLabel]}>OSTATNIE MISJE</Text>
          {loading ? <ActivityIndicator color="#6550ce" style={styles.loader} /> : profile.quests.length === 0 ? (
            <View style={styles.emptyState}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>Twoja mapa czeka</Text><Text style={styles.emptyDescription}>Wylosuj pierwszą misję na globie, aby rozpocząć przygodę.</Text></View>
          ) : profile.quests.slice(0, 3).map((quest) => (
            <View key={quest.id} style={styles.questRow}>
              <View style={[styles.questDot, quest.is_completed && styles.questDotDone]} />
              <View style={styles.questInfo}><Text style={styles.questTitle}>{quest.title}</Text><Text style={styles.questCountry}>{quest.country}</Text></View>
              <Text style={[styles.questStatus, quest.is_completed && styles.questStatusDone]}>{quest.is_completed ? 'UKOŃCZONA' : 'AKTYWNA'}</Text>
            </View>
          ))}

          <TouchableOpacity style={styles.settingsButton} activeOpacity={0.8} onPress={() => { setScreen('settings'); setFeedback(null); }}>
            <Text style={styles.settingsButtonText}>USTAWIENIA KONTA</Text><Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          {(profile.role === 'moderator' || profile.role === 'admin' || profile.role === 'owner') && (
            <TouchableOpacity style={styles.adminButton} activeOpacity={0.8} onPress={openAdminPanel}>
              <Text style={styles.adminButtonText}>PANEL ADMINA</Text><Text style={styles.arrow}>›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.8}>
            <Text style={styles.logoutButtonText}>WYLOGUJ SIĘ</Text>
          </TouchableOpacity>
          </> : <AccountSettings
            screen={screen}
            email={profile.email}
            newEmail={newEmail}
            currentPassword={currentPassword}
            newPassword={newPassword}
            repeatPassword={repeatPassword}
            saving={saving}
            feedback={feedback}
            onBack={() => { setScreen('profile'); setFeedback(null); }}
            onScreenChange={(nextScreen) => { setScreen(nextScreen); setFeedback(null); }}
            onNewEmailChange={setNewEmail}
            onCurrentPasswordChange={setCurrentPassword}
            onNewPasswordChange={setNewPassword}
            onRepeatPasswordChange={setRepeatPassword}
            onEmailSubmit={handleEmailUpdate}
            onPasswordSubmit={handlePasswordUpdate}
          />}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

interface AccountSettingsProps {
  screen: Exclude<ProfileScreen, 'profile'>;
  email: string; newEmail: string; currentPassword: string; newPassword: string; repeatPassword: string;
  saving: boolean; feedback: { type: 'error' | 'success'; text: string } | null;
  onBack: () => void; onScreenChange: (screen: Exclude<ProfileScreen, 'profile'>) => void;
  onNewEmailChange: (value: string) => void; onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void; onRepeatPasswordChange: (value: string) => void;
  onEmailSubmit: () => void; onPasswordSubmit: () => void;
}

function AccountSettings(props: AccountSettingsProps) {
  const isMenu = props.screen === 'settings';
  const isEmail = props.screen === 'email';
  return <View style={styles.settingsContent}>
    <TouchableOpacity onPress={props.onBack} style={styles.backButton}><Text style={styles.backArrow}>‹</Text><Text style={styles.backText}>WRÓĆ DO PROFILU</Text></TouchableOpacity>
    {isMenu ? <>
      <Text style={styles.settingsTitle}>Ustawienia konta</Text>
      <Text style={styles.settingsDescription}>Zarządzaj danymi używanymi do logowania.</Text>
      <TouchableOpacity style={styles.settingOption} onPress={() => props.onScreenChange('email')}><View><Text style={styles.settingOptionTitle}>Zmień adres e-mail</Text><Text style={styles.settingOptionSub}>{props.email || 'Brak adresu e-mail'}</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingOption} onPress={() => props.onScreenChange('password')}><View><Text style={styles.settingOptionTitle}>Zmień hasło</Text><Text style={styles.settingOptionSub}>Ustaw nowe, bezpieczne hasło</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>
    </> : <>
      <Text style={styles.settingsTitle}>{isEmail ? 'Zmień adres e-mail' : 'Zmień hasło'}</Text>
      <Text style={styles.settingsDescription}>{isEmail ? 'Potwierdź zmianę aktualnym hasłem.' : 'Dla bezpieczeństwa podaj aktualne hasło.'}</Text>
      {isEmail && <TextInput style={styles.input} value={props.newEmail} onChangeText={props.onNewEmailChange} placeholder="Nowy adres e-mail" placeholderTextColor="#887c91" keyboardType="email-address" autoCapitalize="none" />}
      <TextInput style={styles.input} value={props.currentPassword} onChangeText={props.onCurrentPasswordChange} placeholder="Aktualne hasło" placeholderTextColor="#887c91" secureTextEntry />
      {!isEmail && <><TextInput style={styles.input} value={props.newPassword} onChangeText={props.onNewPasswordChange} placeholder="Nowe hasło (min. 6 znaków)" placeholderTextColor="#887c91" secureTextEntry /><TextInput style={styles.input} value={props.repeatPassword} onChangeText={props.onRepeatPasswordChange} placeholder="Powtórz nowe hasło" placeholderTextColor="#887c91" secureTextEntry /></>}
      {props.feedback && <Text style={[styles.feedback, props.feedback.type === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>{props.feedback.text}</Text>}
      <TouchableOpacity style={[styles.saveButton, props.saving && styles.saveButtonDisabled]} onPress={isEmail ? props.onEmailSubmit : props.onPasswordSubmit} disabled={props.saving}><Text style={styles.saveButtonText}>{props.saving ? 'ZAPISYWANIE...' : 'ZAPISZ ZMIANY'}</Text></TouchableOpacity>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(2, 6, 23, 0.76)' },
  modal: { maxHeight: '84%', backgroundColor: '#f5f3ef', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.3)', borderRadius: 30, boxShadow: '0px 14px 28px rgba(30, 20, 50, 0.18)', overflow: 'hidden' },
  topGlow: { position: 'absolute', width: 360, height: 220, right: -110, top: -125, borderRadius: 180, backgroundColor: 'rgba(37, 99, 235, 0.22)' },
  drawerHeader: { height: 84, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: 'rgba(148, 163, 184, 0.13)' },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.25)' }, closeButtonText: { color: '#4c405a', fontSize: 28, lineHeight: 30, fontWeight: '300' },
  content: { padding: 24, paddingBottom: 36 }, sectionLabel: { color: '#7561c4', fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  identityRow: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 24 }, avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#6550ce', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#7561c4', boxShadow: '0px 0px 14px rgba(101, 80, 206, 0.15)' }, avatarLargeText: { color: '#fff', fontSize: 25, fontWeight: '800', letterSpacing: 1 }, identityText: { marginLeft: 15, flex: 1 }, username: { color: '#302938', fontSize: 23, fontWeight: '800' }, email: { color: '#817589', fontSize: 12, marginTop: 3 }, levelBadge: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(56, 189, 248, 0.13)' }, levelText: { color: '#7561c4', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  xpCard: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.22)', borderRadius: 16, padding: 16, marginBottom: 28 }, xpHeading: { flexDirection: 'row', justifyContent: 'space-between' }, xpLabel: { color: '#817589', fontSize: 11, fontWeight: '700', letterSpacing: 1 }, xpValue: { color: '#302938', fontSize: 12, fontWeight: '800' }, progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden', backgroundColor: '#e6e0ee', marginTop: 12 }, progressBar: { height: '100%', minWidth: 4, backgroundColor: '#6550ce', borderRadius: 4 }, xpHint: { color: '#887c91', fontSize: 11, marginTop: 9 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 }, stat: { flex: 1, paddingVertical: 15, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.12)' }, statValue: { color: '#302938', fontSize: 24, fontWeight: '800' }, statLabel: { color: '#887c91', fontSize: 9, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 },
  missionsLabel: { marginTop: 28 }, loader: { marginVertical: 32 }, emptyState: { paddingVertical: 27, paddingHorizontal: 18, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, marginTop: 12 }, emptyIcon: { color: '#6550ce', fontSize: 24, marginBottom: 6 }, emptyTitle: { color: '#4c405a', fontSize: 15, fontWeight: '700' }, emptyDescription: { color: '#887c91', textAlign: 'center', fontSize: 12, lineHeight: 18, marginTop: 6 },
  questRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' }, questDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#6550ce', marginRight: 11 }, questDotDone: { backgroundColor: '#34d399' }, questInfo: { flex: 1 }, questTitle: { color: '#4c405a', fontSize: 13, fontWeight: '700' }, questCountry: { color: '#887c91', fontSize: 11, marginTop: 2 }, questStatus: { color: '#7561c4', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 }, questStatusDone: { color: '#6ee7b7' },
  settingsButton: { minHeight: 52, marginTop: 28, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.24)', borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, settingsButtonText: { color: '#74647f', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 }, arrow: { color: '#7561c4', fontSize: 23 }, logoutButton: { alignItems: 'center', paddingVertical: 18, marginTop: 7 }, logoutButtonText: { color: '#fca5a5', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  adminButton: { minHeight: 52, marginTop: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: 'rgba(250, 204, 21, 0.42)', borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(234, 179, 8, 0.08)' }, adminButtonText: { color: '#fde68a', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  settingsContent: { minHeight: 410, paddingTop: 4 }, backButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', marginBottom: 26 }, backArrow: { color: '#7561c4', fontSize: 28, lineHeight: 22, marginRight: 7 }, backText: { color: '#7561c4', fontSize: 11, fontWeight: '800', letterSpacing: 1 }, settingsTitle: { color: '#302938', fontSize: 25, fontWeight: '800' }, settingsDescription: { color: '#817589', fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 25 }, settingOption: { minHeight: 76, marginBottom: 12, paddingHorizontal: 17, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.2)', borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff' }, settingOptionTitle: { color: '#4c405a', fontSize: 14, fontWeight: '700' }, settingOptionSub: { color: '#887c91', fontSize: 11, marginTop: 5 }, input: { height: 52, paddingHorizontal: 15, marginBottom: 12, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.3)', backgroundColor: 'rgba(2, 6, 23, 0.48)', color: '#302938', fontSize: 14 }, feedback: { marginBottom: 13, fontSize: 12, lineHeight: 18 }, feedbackError: { color: '#fca5a5' }, feedbackSuccess: { color: '#6ee7b7' }, saveButton: { minHeight: 52, marginTop: 8, borderRadius: 14, backgroundColor: '#6550ce', borderWidth: 1, borderColor: '#60a5fa', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 0px 10px rgba(37, 99, 235, 0.4)' }, saveButtonDisabled: { opacity: 0.65 }, saveButtonText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
});
