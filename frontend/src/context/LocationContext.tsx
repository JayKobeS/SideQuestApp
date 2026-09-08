import * as ExpoLocation from 'expo-location';
import { api } from '@/api/axios';
import { createContext, useContext, useMemo, useState } from 'react';

type LocationState = {
  latitude: number;
  longitude: number;
  countryCode: string;
};

type LocationContextData = {
  location: LocationState | null;
  status: 'idle' | 'loading' | 'granted' | 'denied' | 'error';
  requestLocation: () => Promise<LocationState | null>;
};

const LocationContext = createContext<LocationContextData>({} as LocationContextData);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [status, setStatus] = useState<LocationContextData['status']>('idle');

  const requestLocation = async () => {
    setStatus('loading');
    try {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setStatus('denied');
        return null;
      }
      const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      const countryResponse = await api.post<{ country_code: string }>('/auth/location-country', {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
      });
      const countryCode = countryResponse.data.country_code.toUpperCase();
      const result = { latitude: position.coords.latitude, longitude: position.coords.longitude, countryCode };
      setLocation(result);
      setStatus('granted');
      return result;
    } catch {
      setStatus('error');
      return null;
    }
  };

  const value = useMemo(() => ({ location, status, requestLocation }), [location, status]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export const useLocation = () => useContext(LocationContext);
