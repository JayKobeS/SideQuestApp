import EarthGlobeDom, { type EarthGlobeDomRef } from '@/components/EarthGlobeDom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { LocationItem } from './globeData';

export type { LocationItem } from './globeData';

interface EarthGlobeProps {
  onRollTrigger?: (roll: () => void) => void;
  onResumeTrigger?: (resume: () => void) => void;
  onZoomTrigger?: (zoom: (direction: 'in' | 'out') => void) => void;
  onRollFinished?: (item: LocationItem) => void;
  onResetFinished?: () => void;
  onLoadingChange?: (isLoading: boolean) => void;
}

export function EarthGlobe({ onRollTrigger, onResumeTrigger, onZoomTrigger, onRollFinished, onResetFinished, onLoadingChange }: EarthGlobeProps) {
  const globeRef = useRef<EarthGlobeDomRef>(null);
  const [isReady, setIsReady] = useState(false);

  const handleReady = useCallback(async () => {
    setIsReady(true);
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
    onRollTrigger?.(() => globeRef.current?.roll());
    onResumeTrigger?.(() => globeRef.current?.resume());
    onZoomTrigger?.((direction) => globeRef.current?.zoom(direction));
  }, [onResumeTrigger, onRollTrigger, onZoomTrigger]);

  return (
    <View style={styles.container}>
      <EarthGlobeDom
        ref={globeRef}
        onReady={handleReady}
        onRollFinished={handleRollFinished}
        onResetFinished={handleResetFinished}
        dom={{ containerStyle: styles.domContainer }}
      />
      {!isReady && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingLogo}><Text style={styles.loadingLogoAccent}>SIDE</Text>QUEST</Text>
          <ActivityIndicator size="large" color="#38d7f5" style={styles.loadingSpinner} />
          <Text style={styles.loadingLabel}>ŁADOWANIE MAPY...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#020617', zIndex: 0 },
  domContainer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#07111f' },
  loadingLogo: { color: '#f8fafc', fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  loadingLogoAccent: { color: '#28c7eb' },
  loadingSpinner: { marginTop: 48, transform: [{ scale: 1.5 }] },
  loadingLabel: { color: '#e2e8f0', fontSize: 13, fontWeight: '600', letterSpacing: 1, marginTop: 22 },
});
