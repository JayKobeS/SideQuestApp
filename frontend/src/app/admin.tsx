import { api } from '@/api/axios';
import { countryName } from '@/constants/countries';
import { AdminPointPicker } from '@/components/AdminPointPicker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Role = 'user' | 'moderator' | 'admin' | 'owner';
type Category = 'daily' | 'local' | 'country' | 'world' | 'achievement';
type Difficulty = 'easy' | 'medium' | 'hard';
type QuestTemplate = { id: string; title: string; description: string; category: Category; difficulty: Difficulty; radius_km: number | null; lat: number | null; lon: number | null; country_code: string | null; is_active: boolean };
type PendingQuest = { id: string; title: string; description: string; submission_note: string | null };
type AdminUser = { id: string; username: string; email: string; role: Role };
type Profile = { role: Role };

const categoryLabels: Record<Category, string> = { daily: 'Dzienna', local: 'Lokalna', country: 'Krajowa', world: 'Światowa', achievement: 'Osiągnięcie' };
const difficultyLabels: Record<Difficulty, string> = { easy: 'Łatwa', medium: 'Średnia', hard: 'Trudna' };
const roleLabels: Record<Role, string> = { user: 'Użytkownik', moderator: 'Moderator', admin: 'Admin', owner: 'Owner' };

export default function AdminScreen() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [templates, setTemplates] = useState<QuestTemplate[]>([]);
  const [pendingQuests, setPendingQuests] = useState<PendingQuest[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('daily');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [xpReward, setXpReward] = useState('100');
  const [medal, setMedal] = useState('bronze');
  const [radius, setRadius] = useState('30');
  const [point, setPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [pointPickerOpen, setPointPickerOpen] = useState(false);
  const [draftPoint, setDraftPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadPanel = async () => {
    setLoading(true); setError('');
    try {
      const profile = await api.get<Profile>('/auth/me');
      setRole(profile.data.role);
      const requests: Promise<unknown>[] = [api.get<PendingQuest[]>('/admin/quests/pending').then((response) => setPendingQuests(response.data))];
      if (profile.data.role === 'admin' || profile.data.role === 'owner') requests.push(api.get<QuestTemplate[]>('/admin/quest-templates').then((response) => setTemplates(response.data)));
      if (profile.data.role === 'owner') requests.push(api.get<AdminUser[]>('/admin/users').then((response) => setUsers(response.data)));
      await Promise.all(requests);
    } catch (requestError: any) {
      setError(requestError.response?.status === 403 ? 'Nie masz uprawnień do tego panelu.' : 'Nie udało się pobrać danych panelu.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadPanel(); }, []);

  const createTemplate = async () => {
    if (title.trim().length < 3 || description.trim().length < 10) return setError('Tytuł musi mieć min. 3 znaki, a opis min. 10 znaków.');
    const localRadius = 30;
    if (!Number.isInteger(Number(xpReward)) || Number(xpReward) < 1 || Number(xpReward) > 100000) return setError('Podaj nagrodę EXP od 1 do 100000.');
    if (category === 'local' && (!Number.isInteger(localRadius) || localRadius < 1 || localRadius > 100)) return setError('Dla misji lokalnej podaj promień od 1 do 100 km.');
    setSaving(true); setError('');
    try {
      const response = await api.post<QuestTemplate>('/admin/quest-templates', { title: title.trim(), description: description.trim(), category, difficulty, xp_reward: Number(xpReward), medal: category === 'achievement' ? medal : null, lat: point?.lat ?? null, lon: point?.lon ?? null, radius_km: category === 'local' ? localRadius : null });
      setTemplates((current) => [response.data, ...current]);
      setTitle(''); setDescription(''); setCategory('daily'); setDifficulty('easy'); setRadius('30'); setPoint(null);
    } catch (requestError: any) { setError(typeof requestError.response?.data?.detail === 'string' ? requestError.response.data.detail : requestError.response?.data?.detail?.message || 'Nie udało się zapisać challenge’u.'); }
    finally { setSaving(false); }
  };

  const toggleTemplate = async (template: QuestTemplate) => {
    try {
      const response = await api.patch<QuestTemplate>(`/admin/quest-templates/${template.id}`, { is_active: !template.is_active });
      setTemplates((current) => current.map((item) => item.id === template.id ? response.data : item));
    } catch { Alert.alert('Nie udało się zmienić statusu misji.'); }
  };

  const reviewQuest = async (quest: PendingQuest, decision: 'approved' | 'rejected') => {
    try {
      await api.post(`/admin/quests/${quest.id}/review`, { decision });
      setPendingQuests((current) => current.filter((item) => item.id !== quest.id));
    } catch (requestError: any) { Alert.alert(requestError.response?.data?.detail || 'Nie udało się zweryfikować misji.'); }
  };

  const updateRole = async (user: AdminUser, nextRole: Role) => {
    try {
      const response = await api.patch<AdminUser>(`/admin/users/${user.id}/role`, { role: nextRole });
      setUsers((current) => current.map((item) => item.id === user.id ? response.data : item));
    } catch (requestError: any) { Alert.alert(requestError.response?.data?.detail || 'Nie udało się zmienić roli.'); }
  };

  const canManageTemplates = role === 'admin' || role === 'owner';
  const canReview = role === 'moderator' || role === 'admin' || role === 'owner';

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.backIcon}>‹</Text></TouchableOpacity><View><Text style={styles.eyebrow}>{role ? roleLabels[role].toUpperCase() : 'PANEL'}</Text><Text style={styles.headerTitle}>Zarządzanie</Text></View></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {loading ? <ActivityIndicator color="#38bdf8" style={styles.loader} /> : error !== '' ? <Text style={styles.error}>{error}</Text> : <>
        {canManageTemplates && <><Text style={styles.intro}>Twórz i zarządzaj pulą challenge’y.</Text><View style={styles.formCard}>
          <Text style={styles.formTitle}>NOWY CHALLENGE</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Tytuł misji" placeholderTextColor="#64748b" maxLength={100} />
          <TextInput style={[styles.input, styles.descriptionInput]} value={description} onChangeText={setDescription} placeholder="Opis — co użytkownik ma zrobić?" placeholderTextColor="#64748b" multiline textAlignVertical="top" maxLength={500} />
          <Text style={styles.fieldLabel}>TYP MISJI</Text><View style={styles.choiceRow}>{(Object.keys(categoryLabels) as Category[]).map((value) => <Choice key={value} label={categoryLabels[value]} active={category === value} onPress={() => setCategory(value)} />)}</View>
          <Text style={styles.fieldLabel}>TRUDNOŚĆ</Text><View style={styles.choiceRow}>{(Object.keys(difficultyLabels) as Difficulty[]).map((value) => <Choice key={value} label={difficultyLabels[value]} active={difficulty === value} onPress={() => setDifficulty(value)} />)}</View>
          <Text style={styles.fieldLabel}>NAGRODA EXP</Text><TextInput style={styles.input} value={xpReward} onChangeText={setXpReward} keyboardType="number-pad" />
          {category === 'achievement' && <View style={styles.choiceRow}>{[['bronze', 'Brąz'], ['silver', 'Srebro'], ['gold', 'Złoto'], ['platinum', 'Platyna']].map(([value, label]) => <Choice key={value} label={label} active={medal === value} onPress={() => setMedal(value)} />)}</View>}
          {category !== 'daily' && <><Text style={styles.fieldLabel}>PUNKT MISJI</Text><TouchableOpacity style={styles.pointButton} onPress={() => { setDraftPoint(point); setPointPickerOpen(true); }}><Text style={styles.pointButtonText}>{point ? `PUNKT: X ${point.lat.toFixed(5)} · Y ${point.lon.toFixed(5)}` : 'WYBIERZ PUNKT NA MAPIE'}</Text></TouchableOpacity><Text style={styles.inputHint}>Kraj zostanie ustalony automatycznie po wyborze punktu.</Text></>}
          {category === 'local' && <><Text style={styles.fieldLabel}>PROMIEŃ LOKALNY</Text><TextInput style={styles.input} value={radius} onChangeText={setRadius} placeholder="30" editable={false} placeholderTextColor="#64748b" keyboardType="number-pad" /><Text style={styles.inputHint}>Zadania w promieniu 30 km od aktualnej lokalizacji.</Text></>}
          {error !== '' && <Text style={styles.error}>{error}</Text>}<TouchableOpacity style={[styles.createButton, saving && styles.disabledButton]} onPress={createTemplate} disabled={saving}><Text style={styles.createButtonText}>{saving ? 'ZAPISYWANIE...' : 'DODAJ CHALLENGE'}</Text></TouchableOpacity>
        </View>
        <SectionTitle label="BIBLIOTEKA MISJI" count={templates.length} />
        {templates.map((template) => <View key={template.id} style={[styles.card, !template.is_active && styles.inactive]}><View style={styles.cardTop}><View style={styles.badges}><Text style={styles.categoryBadge}>{categoryLabels[template.category]}</Text><Text style={styles.difficultyBadge}>{difficultyLabels[template.difficulty]}</Text></View><TouchableOpacity onPress={() => toggleTemplate(template)} style={styles.statusButton}><Text style={styles.statusText}>{template.is_active ? 'AKTYWNA' : 'UKRYTA'}</Text></TouchableOpacity></View><Text style={styles.cardTitle}>{template.title}</Text><Text style={styles.cardDescription}>{template.description}</Text>{template.category !== 'daily' && <Text style={styles.coordinates}>KRAJ: {template.country_code ? countryName(template.country_code) : '—'}  X: {template.lat?.toFixed(5) ?? '—'}  Y: {template.lon?.toFixed(5) ?? '—'}</Text>}{template.category === 'local' && template.radius_km && <Text style={styles.radius}>PROMIEŃ: {template.radius_km} KM</Text>}</View>)}
        </>}

        {canReview && <><SectionTitle label="DO WERYFIKACJI" count={pendingQuests.length} />
          {pendingQuests.length === 0 ? <Text style={styles.empty}>Brak misji oczekujących na decyzję.</Text> : pendingQuests.map((quest) => <View key={quest.id} style={styles.card}><Text style={styles.cardTitle}>{quest.title}</Text><Text style={styles.cardDescription}>{quest.description}</Text>{quest.submission_note && <Text style={styles.note}>NOTATKA: {quest.submission_note}</Text>}<View style={styles.reviewActions}><TouchableOpacity onPress={() => reviewQuest(quest, 'approved')} style={[styles.reviewButton, styles.approveButton]}><Text style={styles.reviewText}>ZATWIERDŹ</Text></TouchableOpacity><TouchableOpacity onPress={() => reviewQuest(quest, 'rejected')} style={[styles.reviewButton, styles.rejectButton]}><Text style={styles.reviewText}>ODRZUĆ</Text></TouchableOpacity></View></View>)}
        </>}

        {role === 'owner' && <><SectionTitle label="ROLE UŻYTKOWNIKÓW" count={users.length} />
          {users.map((user) => <View key={user.id} style={styles.card}><View style={styles.userLine}><View><Text style={styles.cardTitle}>{user.username}</Text><Text style={styles.cardDescription}>{user.email}</Text></View><Text style={styles.roleBadge}>{roleLabels[user.role]}</Text></View>{user.role !== 'owner' && <View style={styles.roleActions}><RoleButton label="MOD" onPress={() => updateRole(user, 'moderator')} /><RoleButton label="ADMIN" onPress={() => updateRole(user, 'admin')} /><RoleButton label="USUŃ ROLĘ" danger onPress={() => updateRole(user, 'user')} /></View>}</View>)}
        </>}
      </>}
    </ScrollView>
    <Modal visible={pointPickerOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setPointPickerOpen(false)}>
      <View style={styles.pointPickerScreen}>
        <AdminPointPicker value={draftPoint} onChange={setDraftPoint} />
        <View style={styles.pointPickerActions}>
          <TouchableOpacity style={[styles.pointPickerButton, styles.cancelPointButton]} onPress={() => { setDraftPoint(point); setPointPickerOpen(false); }}><Text style={styles.cancelPointText}>ANULUJ</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.pointPickerButton, styles.confirmPointButton, !draftPoint && styles.disabledButton]} disabled={!draftPoint} onPress={() => { setPoint(draftPoint); setPointPickerOpen(false); }}><Text style={styles.confirmPointText}>WYBIERZ PUNKT</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </View>;
}

function Choice({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text></TouchableOpacity>; }
function SectionTitle({ label, count }: { label: string; count: number }) { return <View style={styles.listHeader}><Text style={styles.sectionTitle}>{label}</Text><Text style={styles.count}>{count}</Text></View>; }
function RoleButton({ label, danger, onPress }: { label: string; danger?: boolean; onPress: () => void }) { return <TouchableOpacity onPress={onPress} style={[styles.roleButton, danger && styles.roleButtonDanger]}><Text style={[styles.roleButtonText, danger && styles.roleButtonDangerText]}>{label}</Text></TouchableOpacity>; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' }, header: { minHeight: 94, paddingTop: 28, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: 'rgba(148, 163, 184, 0.14)' }, backButton: { width: 42, height: 42, marginRight: 13, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.9)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.33)' }, backIcon: { color: '#7dd3fc', fontSize: 30, lineHeight: 31 }, eyebrow: { color: '#facc15', fontSize: 10, letterSpacing: 1.4, fontWeight: '800' }, headerTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800', marginTop: 2 }, content: { padding: 20, paddingBottom: 42 }, intro: { color: '#94a3b8', fontSize: 13, marginBottom: 18 }, loader: { marginVertical: 44 },
  formCard: { padding: 17, borderRadius: 18, backgroundColor: '#0b1225', borderWidth: 1, borderColor: 'rgba(56,189,248,0.25)' }, formTitle: { color: '#7dd3fc', fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 15 }, input: { minHeight: 50, paddingHorizontal: 14, marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.26)', backgroundColor: 'rgba(2,6,23,0.58)', color: '#f8fafc', fontSize: 14 }, descriptionInput: { height: 104, paddingTop: 13 }, fieldLabel: { color: '#94a3b8', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 4, marginBottom: 8 }, choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 }, choice: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(148,163,184,0.25)' }, choiceActive: { backgroundColor: 'rgba(37,99,235,0.32)', borderColor: '#38bdf8' }, choiceText: { color: '#94a3b8', fontSize: 11, fontWeight: '700' }, choiceTextActive: { color: '#e0f2fe' }, inputHint: { color: '#64748b', fontSize: 11, marginTop: -6, marginBottom: 12 }, error: { color: '#fca5a5', fontSize: 12, lineHeight: 18, marginBottom: 12 }, createButton: { height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#2563eb', borderWidth: 1, borderColor: '#60a5fa' }, disabledButton: { opacity: 0.65 }, createButtonText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  pointButton: { minHeight: 50, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(56,189,248,0.5)', backgroundColor: 'rgba(14,116,144,0.2)', alignItems: 'center', justifyContent: 'center' }, pointButtonText: { color: '#bae6fd', fontSize: 11, fontWeight: '800', letterSpacing: 0.7, textAlign: 'center' }, pointPickerScreen: { flex: 1, backgroundColor: '#020617' }, pointPickerActions: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 26, backgroundColor: '#0b1225', borderTopWidth: 1, borderColor: 'rgba(148,163,184,0.2)' }, pointPickerButton: { flex: 1, minHeight: 52, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 1 }, cancelPointButton: { borderColor: 'rgba(148,163,184,0.4)', backgroundColor: 'rgba(15,23,42,0.9)' }, confirmPointButton: { borderColor: '#38bdf8', backgroundColor: '#0284c7' }, cancelPointText: { color: '#cbd5e1', fontSize: 11, fontWeight: '800' }, confirmPointText: { color: '#f0f9ff', fontSize: 11, fontWeight: '800' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 12 }, sectionTitle: { color: '#7dd3fc', fontSize: 11, fontWeight: '800', letterSpacing: 1.3 }, count: { color: '#0f172a', backgroundColor: '#7dd3fc', fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 }, card: { padding: 15, marginBottom: 10, borderRadius: 16, backgroundColor: 'rgba(15,23,42,0.78)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.14)' }, inactive: { opacity: 0.55 }, cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badges: { flexDirection: 'row', gap: 6 }, categoryBadge: { color: '#7dd3fc', backgroundColor: 'rgba(56,189,248,0.1)', fontSize: 9, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7 }, difficultyBadge: { color: '#cbd5e1', fontSize: 9, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 4 }, statusButton: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, backgroundColor: 'rgba(16,185,129,0.14)' }, statusText: { color: '#a7f3d0', fontSize: 9, fontWeight: '800' }, cardTitle: { color: '#f8fafc', fontSize: 15, fontWeight: '800', marginTop: 10 }, cardDescription: { color: '#94a3b8', fontSize: 12, lineHeight: 18, marginTop: 4 }, coordinates: { color: '#67e8f9', fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 10 }, radius: { color: '#67e8f9', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 10 }, empty: { color: '#64748b', textAlign: 'center', fontSize: 13, paddingVertical: 22 }, note: { color: '#cbd5e1', fontSize: 11, lineHeight: 16, marginTop: 10 }, reviewActions: { flexDirection: 'row', gap: 9, marginTop: 15 }, reviewButton: { flex: 1, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, approveButton: { backgroundColor: '#047857' }, rejectButton: { backgroundColor: '#991b1b' }, reviewText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.7 }, userLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, roleBadge: { color: '#fde68a', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }, roleActions: { flexDirection: 'row', gap: 8, marginTop: 14 }, roleButton: { flex: 1, minHeight: 37, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(37,99,235,0.28)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.4)' }, roleButtonDanger: { backgroundColor: 'rgba(153,27,27,0.20)', borderColor: 'rgba(252,165,165,0.32)' }, roleButtonText: { color: '#bfdbfe', fontSize: 9, fontWeight: '800' }, roleButtonDangerText: { color: '#fca5a5' },
});
