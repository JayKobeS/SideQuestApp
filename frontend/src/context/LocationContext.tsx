import * as ExpoLocation from 'expo-location';
import { api } from '@/api/axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type LocationState = { latitude: number; longitude: number; countryCode: string };
type LocationContextData = {
  location: LocationState | null;
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'error';
  requestLocation: () => Promise<LocationState | null>;
};
const LocationContext = createContext<LocationContextData>({} as LocationContextData);
export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [status, setStatus] = useState<LocationContextData['status']>('idle');
  const watch = useRef<ExpoLocation.LocationSubscription | null>(null);
  const pending = useRef<Promise<LocationState | null> | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; watch.current?.remove(); watch.current = null; }; }, []);
  const requestLocation = useCallback((): Promise<LocationState | null> => {
    if (pending.current) return pending.current;
    const run = async () => {
      setStatus('loading');
      try {
        const currentPermission = await ExpoLocation.getForegroundPermissionsAsync();
        const permission = currentPermission.status === 'granted'
          ? currentPermission
          : await ExpoLocation.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') { if (alive.current) { setStatus('denied'); setLocation(null); } return null; }

        const lastKnown = await ExpoLocation.getLastKnownPositionAsync({
          maxAge: 6 * 60 * 60 * 1000,
          requiredAccuracy: 5000,
        });
        if (lastKnown && alive.current) {
          setLocation(current => ({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
            countryCode: current?.countryCode || '',
          }));
          setStatus('granted');
        }

        const position = await Promise.race([
          ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced }),
          new Promise<null>(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
        if (!position) {
          if (lastKnown) {
            return { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude, countryCode: location?.countryCode || '' };
          }
          if (alive.current) setStatus('error');
          return null;
        }
        let result = { latitude: position.coords.latitude, longitude: position.coords.longitude, countryCode: '' };
        // Show the avatar immediately, independently of reverse geocoding availability.
        if (alive.current) { setLocation(result); setStatus('granted'); }
        try {
          const response = await api.post<{ country_code: string }>('/auth/location-country', { lat: result.latitude, lon: result.longitude });
          result = { ...result, countryCode: response.data.country_code.toUpperCase() };
          if (alive.current) setLocation(result);
        } catch { /* Coordinates still work without the country service. */ }
        if (!watch.current && alive.current) {
          try {
            const subscription = await ExpoLocation.watchPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced, distanceInterval: 25, timeInterval: 15000 }, next => {
              if (alive.current) setLocation(current => ({ latitude: next.coords.latitude, longitude: next.coords.longitude, countryCode: current?.countryCode || '' }));
            });
            if (alive.current) watch.current = subscription; else subscription.remove();
          } catch { /* A single fresh position remains usable without a continuous watch. */ }
        }
        return result;
      } catch { if (alive.current) setStatus('error'); return null; }
    };
    pending.current = run().finally(() => { pending.current = null; });
    return pending.current;
  }, [location?.countryCode]);
  const value = useMemo(() => ({ location, status, requestLocation }), [location, status, requestLocation]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}
export const useLocation = () => useContext(LocationContext);
