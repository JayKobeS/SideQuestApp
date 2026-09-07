import { EarthGlobe, LocationItem } from '@/components/EarthGlobe';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const rollActionRef = useRef<((onFinish?: (item: LocationItem) => void) => LocationItem) | null>(null);
  const resumeActionRef = useRef<((onResetDone?: () => void) => void) | null>(null);
  const zoomActionRef = useRef<((direction: 'in' | 'out') => void) | null>(null); // <--- NOWA REFERENCJA

  const [selectedQuest, setSelectedQuest] = useState<LocationItem | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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
      <View style={styles.header} pointerEvents="box-none">
        <Text style={styles.title}>SideQuest</Text>
        <Text style={styles.subtitle}>Wylosuj swoją kolejną misję na globie</Text>
      </View>

      {/* Kontrolki Zooma po lewej */}
      <View style={styles.zoomControls} pointerEvents="box-none">
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
      <View style={styles.bottomControls} pointerEvents="box-none">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
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
  zoomButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: '#38bdf8',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
    shadowColor: '#38bdf8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
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
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    cursor: 'pointer',
  },
  okButton: {
    backgroundColor: '#059669',
    borderColor: '#34d399',
    shadowColor: '#059669',
    paddingHorizontal: 54,
  },
  buttonDisabled: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1d4ed8',
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
});