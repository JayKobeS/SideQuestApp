import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Pomocnicza funkcja do bezpiecznego storage
const storage = {
  async getItem(key: string) {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string) {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  }
};

interface AuthContextData {
  isLoading: boolean;
  userToken: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState<string | null>(null);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const token = await storage.getItem('jwt_token');
        if (token) {
          setUserToken(token);
        }
      } catch {
        // Brak tokenu oznacza po prostu ekran logowania.
      } finally {
        setIsLoading(false);
      }
    };

    loadToken();
  }, []);

  const login = async (token: string) => {
    setIsLoading(true);
    await storage.setItem('jwt_token', token);
    setUserToken(token);
    setIsLoading(false);
  };

  const logout = async () => {
    setIsLoading(true);
    await storage.removeItem('jwt_token');
    setUserToken(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider value={{ isLoading, userToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
