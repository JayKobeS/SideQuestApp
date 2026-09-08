import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface LocationItem {
  id: string;
  title: string;
  country: string;
  lat: number;
  lon: number;
}

export const QUEST_LOCATIONS: LocationItem[] = [
  { id: '1', title: 'Tajemnica Wawelu', country: 'Polska', lat: 50.0647, lon: 19.945 },
  { id: '2', title: 'Sekret Wieży', country: 'Francja', lat: 48.8584, lon: 2.2945 },
  { id: '3', title: 'Neonowy Pościg', country: 'Japonia', lat: 35.6762, lon: 139.6503 },
  { id: '4', title: 'Złote Wybrzeże', country: 'USA', lat: 37.7749, lon: -122.4194 },
  { id: '5', title: 'Piramidalna Zagadka', country: 'Egipt', lat: 29.9792, lon: 31.1342 },
  { id: '6', title: 'Tajemnica Amazonii', country: 'Brazylia', lat: -3.4653, lon: -62.2159 },
  { id: '7', title: 'Operowa Nuta', country: 'Australia', lat: -33.8568, lon: 151.2153 },
];
const absoluteFill = { position: 'absolute' as const, top: 0, right: 0, bottom: 0, left: 0 };

interface EarthGlobeProps {
  onRollTrigger?: (rollFn: (onFinish?: (item: LocationItem) => void) => LocationItem) => void;
  onResumeTrigger?: (resumeFn: (onResetDone?: () => void) => void) => void;
  onZoomTrigger?: (zoomFn: (direction: 'in' | 'out') => void) => void;
}

/**
 * MapLibre GL JS renders to a browser <canvas> via WebGL and has no React Native
 * (iOS/Android) binding, so it only ships in EarthGlobe.web.tsx. This file is the
 * native counterpart Metro picks up on iOS/Android — it keeps the roll/resume
 * contract working (so index.tsx never has to branch on platform) but skips the
 * map visual. Swap in @maplibre/maplibre-react-native here if native support is needed later.
 */
export function EarthGlobe({ onRollTrigger, onResumeTrigger, onZoomTrigger }: EarthGlobeProps) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (onRollTrigger) {
      onRollTrigger((onFinish) => {
        const randomIndex = Math.floor(Math.random() * QUEST_LOCATIONS.length);
        const selected = QUEST_LOCATIONS[randomIndex];
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => onFinish?.(selected), 600);
        return selected;
      });
    }

    if (onResumeTrigger) {
      onResumeTrigger((onResetDone) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        onResetDone?.();
      });
    }

    onZoomTrigger?.(() => {});

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onRollTrigger, onResumeTrigger]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Globus dostępny w wersji web</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...absoluteFill,
    backgroundColor: '#020617',
    zIndex: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#475569',
    fontSize: 13,
  },
});
