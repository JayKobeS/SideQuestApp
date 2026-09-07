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

  const handleLogin = async () => {
    if (email === '' || password === '') {
      setError('Wypełnij wszystkie pola');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // FastAPI zazwyczaj oczekuje 'username' i 'password' jako form-data przy logowaniu
      const formData = new URLSearchParams();
      formData.append('username', email); // Przekazujemy email jako username
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
      console.error(err);
      // Wyciągnięcie błędu zwracanego przez FastAPI (np. "Incorrect username or password")
      const errorMessage = err.response?.data?.detail || 'Błąd logowania. Sprawdź dane.';
      setError(typeof errorMessage === 'string' ? errorMessage : 'Wystąpił błąd');
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
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  }
});