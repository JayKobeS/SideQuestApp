import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../../api/axios';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAuth } from '../../context/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth(); // Pobranie funkcji logującej z kontekstu
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);

  const handleLogin = async () => {
    if (email === '' || password === '') {
      setError('Wypełnij wszystkie pola');
      return;
    }

    setIsLoading(true);
    setError('');
    setShowRecovery(false);

    try {
      // FastAPI zazwyczaj oczekuje 'username' i 'password' jako form-data przy logowaniu
      const formData = new URLSearchParams();
      formData.append('username', email.trim().toLowerCase());
      formData.append('password', password);

      // UWAGA: Upewnij się, że '/auth/login' to poprawna ścieżka w Twoim backendzie
      const response = await api.post('/auth/login', formData.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        });

      // Zapisujemy token (FastAPI domyślnie zwraca { access_token: "..." })
      await login(response.data.access_token);
      
      // Przekierowanie do głównej części aplikacji po zalogowaniu
      router.replace('/'); 
    } catch (err: any) {
      // Wyciągnięcie błędu zwracanego przez FastAPI (np. "Incorrect username or password")
      if (!err.response) {
        setError('Nie można połączyć się z serwerem. Sprawdź połączenie z internetem lub adres API.');
        return;
      }
      const detail = err.response?.data?.detail;
      const code = typeof detail === 'object' ? detail?.code : undefined;
      const errorMessage = typeof detail === 'object' ? detail?.message : detail;
      if (code === 'PASSWORD_RESET_AVAILABLE') setShowRecovery(true);
      if (code === 'DATABASE_MIGRATION_REQUIRED') setError('Serwer wymaga aktualizacji bazy danych. Uruchom migracje backendu.');
      else if (code === 'INVALID_EMAIL_FORMAT') setError('Podaj poprawny adres e-mail.');
      else if (code === 'INVALID_CREDENTIALS') setError('Nieprawidłowy e-mail lub hasło.');
      else setError(typeof errorMessage === 'string' ? errorMessage : 'Błąd logowania. Sprawdź dane.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title} type="title">Logowanie</ThemedText>
      
      {error !== '' && (
        <ThemedText style={styles.errorText}>{error}</ThemedText>
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Hasło"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity 
        style={styles.button} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <ThemedText style={styles.buttonText}>Zaloguj się</ThemedText>
        )}
      </TouchableOpacity>

      <Link href="/(auth)/register" asChild>
        <TouchableOpacity style={styles.linkButton}>
          <ThemedText type="link">Nie masz konta? Zarejestruj się</ThemedText>
        </TouchableOpacity>
      </Link>

      {showRecovery && (
        <Link href="/(auth)/reset-password" asChild>
          <TouchableOpacity style={styles.recoveryButton}><ThemedText type="link">Nie pamiętasz hasła? Odzyskaj dostęp</ThemedText></TouchableOpacity>
        </Link>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    color: '#333',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#0a7ea4',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  linkButton: {
    alignItems: 'center',
  },
  recoveryButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  }
});
