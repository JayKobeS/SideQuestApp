import { EarthGlobe, LocationItem } from '@/components/EarthGlobe';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import { api } from '@/api/axios';
import { useLocation } from '@/context/LocationContext';
import { useEffect, useRef, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const TRAVEL_PROMPT_SEEN_KEY = 'sidequest.travel_prompt_seen';

async function hasSeenTravelPrompt() {
  if (Platform.OS === 'web') return localStorage.getItem(TRAVEL_PROMPT_SEEN_KEY) === '1';
  return (await SecureStore.getItemAsync(TRAVEL_PROMPT_SEEN_KEY)) === '1';
}

async function rememberTravelPrompt() {
  if (Platform.OS === 'web') {
    localStorage.setItem(TRAVEL_PROMPT_SEEN_KEY, '1');
  } else {
    await SecureStore.setItemAsync(TRAVEL_PROMPT_SEEN_KEY, '1');
  }
}

export default function HomeScreen() {
  const { location, status: locationStatus, requestLocation } = useLocation();
  const rollActionRef = useRef<((onFinish?: (item: LocationItem) => void) => LocationItem) | null>(null);
  const resumeActionRef = useRef<((onResetDone?: () => void) => void) | null>(null);
  const zoomActionRef = useRef<((direction: 'in' | 'out') => void) | null>(null); // <--- NOWA REFERENCJA

  const [selectedQuest, setSelectedQuest] = useState<LocationItem | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isTravelPromptOpen, setIsTravelPromptOpen] = useState(false);
  const [isSavingTravelMode, setIsSavingTravelMode] = useState(false);
  const [travelPromptError, setTravelPromptError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkWhetherUserIsAbroad = async () => {
      try {
        const profileResponse = await api.get<{ country_code?: string | null }>('/auth/me');
        const homeCountry = profileResponse.data.country_code?.toUpperCase();
        if (!homeCountry) return;

        // Lokalizacja jest pobierana tylko po to, aby porównać kraj konta
        // z krajem, w którym użytkownik rzeczywiście się znajduje.
        const currentLocation = await requestLocation();
        if (mounted && currentLocation && currentLocation.countryCode !== homeCountry && !(await hasSeenTravelPrompt())) {
          setIsTravelPromptOpen(true);
        }
      } catch {
        // Brak profilu/lokalizacji nie powinien blokować wejścia na globus.
      }
    };

    checkWhetherUserIsAbroad();
    return () => { mounted = false; };
  }, []);

  const chooseTravelMode = async (isAbroad: boolean) => {
    setIsSavingTravelMode(true);
    setTravelPromptError(null);
    try {
      if (isAbroad) {
        const currentLocation = location ?? await requestLocation();
        if (!currentLocation) {
          setTravelPromptError('Aby rozpocząć wyjazd, włącz lokalizację. Dzięki temu misja zostanie przypisana do odwiedzanego kraju.');
          return;
        }
      }
      await api.put('/auth/me/travel-mode', { is_abroad: isAbroad });
      await rememberTravelPrompt();
      setIsTravelPromptOpen(false);
    } catch (error: any) {
      setTravelPromptError(error.response?.data?.detail?.message || 'Nie udało się zapisać trybu. Spróbuj ponownie.');
    } finally {
      setIsSavingTravelMode(false);
    }
  };

  const handleRoll = () => {
    if (rollActionRef.current && !isRolling && !isResetting) {
      setIsRolling(true);
      setSelectedQuest(null);

      rollActionRef.current((finishedQuest) => {
        setSelectedQuest(finishedQuest);
        setIsRolling(false);
      });
    }
  };

  const handleConfirm = () => {
    if (resumeActionRef.current) {
      setIsResetting(true);
      
      resumeActionRef.current(() => {
        setIsResetting(false);
      });
    }
    setSelectedQuest(null);
  };

  return (
    <View style={styles.container}>
      {/* 3D Globus */}
      <EarthGlobe
        onRollTrigger={(fn) => {
          rollActionRef.current = fn;
        }}
        onResumeTrigger={(fn) => {
          resumeActionRef.current = fn;
        }}
        onZoomTrigger={(fn) => {
          zoomActionRef.current = fn; // <--- PRZEKAZANIE FUNKCJI ZOOMA
        }}
      />

      {/* Górny nagłówek */}
      <View style={[styles.header, styles.pointerEventsBoxNone]}>
        <Text style={styles.title}>SideQuest</Text>
        <Text style={styles.subtitle}>Wylosuj swoją kolejną misję na globie</Text>
      </View>

      {!location && (
        <View style={styles.locationNotice}>
          <Text style={styles.locationNoticeText}>{locationStatus === 'denied' ? 'Lokalizacja jest wyłączona — misje terenowe nie będą dostępne.' : 'Udostępnij lokalizację, aby dopasować misje do kraju.'}</Text>
          {locationStatus !== 'denied' && <TouchableOpacity onPress={requestLocation} disabled={locationStatus === 'loading'} style={styles.locationButton}><Text style={styles.locationButtonText}>{locationStatus === 'loading' ? 'SPRAWDZANIE...' : 'UDOSTĘPNIJ'}</Text></TouchableOpacity>}
        </View>
      )}

      <TouchableOpacity
        style={styles.profileButton}
        onPress={() => setIsProfileOpen(true)}
        activeOpacity={0.8}
        accessibilityLabel="Otwórz profil"
      >
        <View style={styles.profileAvatar}><Text style={styles.profileInitials}>SQ</Text></View>
        <View style={styles.profileStatus} />
      </TouchableOpacity>

      {/* Kontrolki Zooma po lewej */}
      <View style={[styles.zoomControls, styles.pointerEventsBoxNone]}>
        <TouchableOpacity 
          style={styles.zoomButton} 
          onPress={() => zoomActionRef.current?.('in')}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.zoomButton} 
          onPress={() => zoomActionRef.current?.('out')}
          activeOpacity={0.7}
        >
          <Text style={styles.zoomButtonText}>-</Text>
        </TouchableOpacity>
      </View>

      {/* Dolny panel z powiadomieniem i przyciskiem */}
      <View style={[styles.bottomControls, styles.pointerEventsBoxNone]}>
        {selectedQuest && !isRolling && (
          <View style={styles.notificationCard}>
            <Text style={styles.notificationLabel}>Wylosowany challenge:</Text>
            <Text style={styles.challengeTitle}>"{selectedQuest.title}"</Text>
            <Text style={styles.locationBadge}>
              {selectedQuest.country.toUpperCase()}
            </Text>
          </View>
        )}

        {selectedQuest && !isRolling ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.okButton]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>OKEJ</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, (isRolling || isResetting) && styles.buttonDisabled]}
            onPress={handleRoll}
            disabled={isRolling || isResetting}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {isRolling ? 'LOSOWANIE...' : (isResetting ? 'POWRÓT...' : 'ROLL QUEST')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <ProfileDrawer visible={isProfileOpen} onClose={() => setIsProfileOpen(false)} />

      <Modal transparent visible={isTravelPromptOpen} animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.travelOverlay}>
          <View style={styles.travelCard}>
            <Text style={styles.travelEyebrow}>TRYB MISJI</Text>
            <Text style={styles.travelTitle}>Jesteś na wyjeździe?</Text>
            <Text style={styles.travelDescription}>W domu losujesz misje z kraju ustawionego na koncie. Na wyjeździe odblokujesz misje światowe dla aktualnej lokalizacji.</Text>
            {travelPromptError && <Text style={styles.travelError}>{travelPromptError}</Text>}
            <TouchableOpacity style={[styles.travelButton, styles.travelYes, isSavingTravelMode && styles.buttonDisabled]} disabled={isSavingTravelMode} onPress={() => chooseTravelMode(true)}>
              <Text style={styles.travelYesText}>TAK, JESTEM NA WYJEŹDZIE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.travelButton, styles.travelNo, isSavingTravelMode && styles.buttonDisabled]} disabled={isSavingTravelMode} onPress={() => chooseTravelMode(false)}>
              {isSavingTravelMode ? <ActivityIndicator color="#cbd5e1" /> : <Text style={styles.travelNoText}>NIE, JESTEM W DOMU</Text>}
            </TouchableOpacity>
            <Text style={styles.travelHint}>Możesz aktywować wyjazd maksymalnie 3 razy w miesiącu.</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  pointerEventsBoxNone: { pointerEvents: 'box-none' },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 6,
  },
  zoomControls: {
    position: 'absolute',
    left: 16,
    top: '45%', // Wyśrodkowane w pionie
    gap: 16,
    zIndex: 15,
  },
  locationNotice: {
    position: 'absolute',
    top: 122,
    left: 18,
    right: 18,
    zIndex: 25,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.28)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationNoticeText: { flex: 1, color: '#cbd5e1', fontSize: 11, lineHeight: 15, marginRight: 10 },
  locationButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 9, backgroundColor: '#0369a1' },
  locationButtonText: { color: '#e0f2fe', fontSize: 9, fontWeight: '800', letterSpacing: 0.7 },
  profileButton: {
    position: 'absolute',
    top: 38,
    right: 28,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
    boxShadow: '0px 4px 10px rgba(56, 189, 248, 0.35)',
  },
  profileAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitials: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  profileStatus: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#34d399',
    borderWidth: 2,
    borderColor: '#020617',
  },
  zoomButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 4px 8px rgba(56, 189, 248, 0.3)',
  },
  zoomButtonText: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '400',
    marginTop: -2, // Poprawka centrowania znaków w React Native
  },
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  notificationCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 28,
    marginBottom: 18,
    alignItems: 'center',
    maxWidth: '90%',
    boxShadow: '0px 6px 16px rgba(56, 189, 248, 0.4)',
  },
  notificationLabel: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  challengeTitle: {
    fontSize: 22,
    color: '#ffffff',
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  locationBadge: {
    fontSize: 12,
    color: '#38bdf8',
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 6,
  },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#60a5fa',
    boxShadow: '0px 6px 14px rgba(37, 99, 235, 0.5)',
  },
  okButton: {
    backgroundColor: '#059669',
    borderColor: '#34d399',
    boxShadow: '0px 6px 14px rgba(5, 150, 105, 0.5)',
    paddingHorizontal: 54,
  },
  buttonDisabled: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1d4ed8',
    opacity: 0.7,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  travelOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(2, 6, 23, 0.78)' },
  travelCard: { borderRadius: 26, padding: 25, backgroundColor: '#0b1225', borderWidth: 1, borderColor: 'rgba(56, 189, 248, 0.38)', boxShadow: '0px 12px 25px rgba(0, 0, 0, 0.55)' },
  travelEyebrow: { color: '#7dd3fc', fontSize: 11, letterSpacing: 1.5, fontWeight: '800' },
  travelTitle: { marginTop: 10, color: '#f8fafc', fontSize: 26, fontWeight: '800' },
  travelDescription: { marginTop: 10, color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  travelError: { marginTop: 14, color: '#fca5a5', fontSize: 12, lineHeight: 18 },
  travelButton: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 14, paddingHorizontal: 14 },
  travelYes: { backgroundColor: '#0284c7', borderWidth: 1, borderColor: '#38bdf8' },
  travelNo: { backgroundColor: 'rgba(15, 23, 42, 0.9)', borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.34)', marginTop: 10 },
  travelYesText: { color: '#f0f9ff', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  travelNoText: { color: '#cbd5e1', fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  travelHint: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: 17 },
});
