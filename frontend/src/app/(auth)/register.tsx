import { Link, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../../api/axios';
import { CountrySelect } from '../../components/CountrySelect';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';
import { useAuth } from '../../context/AuthContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginRequiredMessage, setLoginRequiredMessage] = useState<string | null>(null);
  const submissionInProgress = useRef(false);

  const signInWithRegisteredCredentials = async () => {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email.trim().toLowerCase());
      formData.append('password', password);
      const response = await api.post('/auth/login', formData.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      await login(response.data.access_token);
      router.replace('/');
      return true;
    } catch {
      return false;
    }
  };

  // Walidacja lokalna
  const validate = () => {
    if (!email.includes('@')) {
      setError('Podaj poprawny adres email.');
      return false;
    }
    if (username.length < 3) {
      setError('Nazwa użytkownika musi mieć min. 3 znaki.');
      return false;
    }
    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.');
      return false;
    }
    if (!countryCode) {
      setError('Wybierz kraj.');
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (submissionInProgress.current || isLoading) return;
    setError('');
    if (!validate()) return;

    submissionInProgress.current = true;
    setIsLoading(true);
    
    try {
      await api.post('/auth/register', {
        email: email,
        username: username,
        password: password,
        country_code: countryCode,
        });

      // Konto właśnie powstało — przechodzimy do aplikacji bez dodatkowego ekranu logowania.
      if (!(await signInWithRegisteredCredentials())) {
        setLoginRequiredMessage('Konto zostało utworzone. Zaloguj się, aby przejść do aplikacji.');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail;
      if (typeof errorMessage === 'string' && errorMessage.includes('już istnieje')) {
        // Gdy odpowiedź rejestracji zginęła po zapisie po stronie serwera,
        // dane są poprawne i można od razu zalogować nowo utworzone konto.
        if (!(await signInWithRegisteredCredentials())) {
          setLoginRequiredMessage('To konto już istnieje. Przejdź do logowania.');
        }
      } else {
        setError(typeof errorMessage === 'string' ? errorMessage : 'Nie udało się utworzyć konta. Sprawdź połączenie i spróbuj ponownie.');
      }
    } finally {
      submissionInProgress.current = false;
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title} type="title">Rejestracja</ThemedText>

      {loginRequiredMessage ? (
        <>
          <ThemedText style={styles.errorText}>{loginRequiredMessage}</ThemedText>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <ThemedText style={styles.buttonText}>PRZEJDŹ DO LOGOWANIA</ThemedText>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {error !== '' && <ThemedText style={styles.errorText}>{error}</ThemedText>}
          <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#888" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Nazwa użytkownika" placeholderTextColor="#888" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextInput style={styles.input} placeholder="Hasło" placeholderTextColor="#888" value={password} onChangeText={setPassword} secureTextEntry />
          <CountrySelect value={countryCode} onChange={setCountryCode} required />
          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={isLoading}>
            {isLoading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Zarejestruj się</ThemedText>}
          </TouchableOpacity>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.linkButton}><ThemedText type="link">Masz już konto? Zaloguj się</ThemedText></TouchableOpacity>
          </Link>
        </>
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
  errorText: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  }
});
