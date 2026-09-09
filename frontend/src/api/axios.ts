import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const DEFAULT_API_URL = Platform.OS === 'web'
  ? 'http://localhost:8000'
  : expoHost
    ? `http://${expoHost}:8000`
    : Platform.OS === 'android'
      ? 'http://10.0.2.2:8000'
      : 'http://localhost:8000';

// On a physical device, set EXPO_PUBLIC_API_URL to the backend address
// reachable from that device (for example, http://192.168.1.20:8000).
const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL;

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(
  async (config) => {
    try {
      let token = null;
      if (Platform.OS === 'web') {
        token = localStorage.getItem('jwt_token');
      } else {
        token = await SecureStore.getItemAsync('jwt_token');
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Żądanie bez tokenu może nadal zakończyć się kontrolowanym 401.
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
