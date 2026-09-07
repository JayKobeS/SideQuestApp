import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const API_URL = 'http://localhost:8000'; 

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
    } catch (e) {
      console.error("Błąd interceptora podczas pobierania tokenu:", e);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);