import EarthGlobeDom, { type EarthGlobeDomRef } from '@/components/EarthGlobeDom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, Pressable } from 'react-native';
import type { LocationItem } from './globeData';

export type { LocationItem } from './globeData';

interface EarthGlobeProps {
  userLocation?: { latitude: number; longitude: number } | null;
  avatarLabel?: string;
  onRollTrigger?: (roll: (item: LocationItem) => void) => void;
  onLocateTrigger?: (locate: () => void) => void;
  onResumeTrigger?: (resume: () => void) => void;
  onZoomTrigger?: (zoom: (direction: 'in' | 'out') => void) => void;
  onRollFinished?: (item: LocationItem) => void;
  onResetFinished?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function EarthGlobe({ userLocation, avatarLabel, onLocateTrigger, onRollTrigger, onResumeTrigger, onZoomTrigger, onRollFinished, onResetFinished, onLoadingChange }: EarthGlobeProps) {
  const globeRef = useRef<EarthGlobeDomRef>(null);
  const [isReady, setIsReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const handleReady = useCallback(async () => {
    setIsReady(true);
    setFailed(false);
    onLoadingChange?.(false);
  }, [onLoadingChange]);

  const handleRollFinished = useCallback(async (item: LocationItem) => {
    onRollFinished?.(item);
  }, [onRollFinished]);

  const handleResetFinished = useCallback(async () => {
    onResetFinished?.();
  }, [onResetFinished]);

  useEffect(() => {
    onLoadingChange?.(true);
  }, []);

  useEffect(() => {
    onRollTrigger?.((item) => globeRef.current?.roll(item));
    onLocateTrigger?.(() => globeRef.current?.locate());
    onResumeTrigger?.(() => globeRef.current?.resume());
    onZoomTrigger?.((direction) => globeRef.current?.zoom(direction));
  }, [onResumeTrigger, onRollTrigger, onZoomTrigger, onLocateTrigger]);

  return (
    <View style={styles.container}>
      <EarthGlobeDom
        key={attempt}
        onError={async () => setFailed(true)}
        ref={globeRef}
        onReady={handleReady}
        onRollFinished={handleRollFinished}
        onResetFinished={handleResetFinished}
        userLocation={userLocation}
        avatarLabel={avatarLabel}
        dom={{ containerStyle: styles.domContainer }}
      />
      {!isReady && (
        <View style={styles.loadingOverlay}>
          {failed ? <Pressable onPress={() => { setFailed(false); setAttempt(value => value + 1); }} style={styles.retry}><Text style={styles.loadingLabel}>Mapa jest niedostępna. Dotknij, aby ponowić.</Text></Pressable> : <><ActivityIndicator color="#c4b7ff" /><Text style={styles.loadingLabel}>Przygotowuję mapę…</Text></>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#020617', zIndex: 0 },
  domContainer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  loadingOverlay: { position: 'absolute', top: '28%', right: 70, left: 24, zIndex: 5, alignItems: 'center', justifyContent: 'center', gap: 12 },
  retry: { padding: 16, borderRadius: 22, backgroundColor: '#292239' },
  loadingLogo: { color: '#f8fafc', fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  loadingLogoAccent: { color: '#28c7eb' },
  loadingSpinner: { marginTop: 48, transform: [{ scale: 1.5 }] },
  loadingLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginTop: 22 },
});
