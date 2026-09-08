import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../../api/axios';
import { ThemedText } from '../../components/themed-text';
import { ThemedView } from '../../components/themed-view';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const confirming = Boolean(token);

  const submit = async () => {
    setError(''); setMessage('');
    if (confirming && (password.length < 6 || password !== repeatPassword)) return setError('Hasła muszą być takie same i mieć co najmniej 6 znaków.');
    if (!confirming && !email.includes('@')) return setError('Podaj poprawny adres e-mail.');
    setLoading(true);
    try {
      if (confirming) {
        await api.post('/auth/password-reset/confirm', { token, new_password: password });
        setMessage('Hasło zostało zmienione. Możesz się zalogować.');
        setTimeout(() => router.replace('/(auth)/login'), 1200);
      } else {
        await api.post('/auth/password-reset/request', { email });
        setMessage('Jeśli konto istnieje, wysłaliśmy link do zmiany hasła.');
      }
    } catch (requestError: any) {
      const detail = requestError.response?.data?.detail;
      setError(typeof detail === 'object' ? detail.message : detail || 'Nie udało się wykonać operacji.');
    } finally { setLoading(false); }
  };

  return <ThemedView style={styles.container}>
    <ThemedText style={styles.title} type="title">{confirming ? 'Nowe hasło' : 'Odzyskaj dostęp'}</ThemedText>
    <ThemedText style={styles.description}>{confirming ? 'Ustaw nowe hasło do konta.' : 'Podaj e-mail. Otrzymasz bezpieczny link do zmiany hasła.'}</ThemedText>
    {error !== '' && <ThemedText style={styles.error}>{error}</ThemedText>}
    {message !== '' && <ThemedText style={styles.success}>{message}</ThemedText>}
    {!confirming && <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor="#888" keyboardType="email-address" autoCapitalize="none" />}
    {confirming && <><TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Nowe hasło" placeholderTextColor="#888" secureTextEntry /><TextInput style={styles.input} value={repeatPassword} onChangeText={setRepeatPassword} placeholder="Powtórz nowe hasło" placeholderTextColor="#888" secureTextEntry /></>}
    <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>{loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>{confirming ? 'ZAPISZ NOWE HASŁO' : 'WYŚLIJ LINK'}</ThemedText>}</TouchableOpacity>
  </ThemedView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 }, title: { textAlign: 'center', marginBottom: 10 }, description: { textAlign: 'center', marginBottom: 24, color: '#64748b' }, input: { height: 50, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, color: '#333', backgroundColor: '#fff' }, button: { backgroundColor: '#0a7ea4', height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center' }, buttonText: { color: '#fff', fontWeight: 'bold' }, error: { color: '#dc2626', textAlign: 'center', marginBottom: 14 }, success: { color: '#059669', textAlign: 'center', marginBottom: 14 },
});
