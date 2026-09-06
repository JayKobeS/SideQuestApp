import { EarthGlobe, LocationItem } from '@/components/EarthGlobe';
import { useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const rollActionRef = useRef<((onFinish?: (item: LocationItem) => void) => LocationItem) | null>(null);
  const resumeActionRef = useRef<(() => void) | null>(null);

  const [selectedQuest, setSelectedQuest] = useState<LocationItem | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const handleRoll = () => {
    if (rollActionRef.current && !isRolling) {
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
      resumeActionRef.current();
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
      />

      {/* Górny nagłówek */}
      <View style={styles.header} pointerEvents="box-none">
        <Text style={styles.title}>SideQuest</Text>
        <Text style={styles.subtitle}>Wylosuj swoją kolejną misję na globie</Text>
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
            style={[styles.actionButton, isRolling && styles.buttonDisabled]}
            onPress={handleRoll}
            disabled={isRolling}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>
              {isRolling ? 'LOSOWANIE...' : 'ROLL QUEST'}
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