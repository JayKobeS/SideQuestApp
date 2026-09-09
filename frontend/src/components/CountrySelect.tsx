import { COUNTRY_CODES, countryName } from '@/constants/countries';
import { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface CountrySelectProps {
  value: string | null;
  onChange: (countryCode: string | null) => void;
  required?: boolean;
}

export function CountrySelect({ value, onChange, required = false }: CountrySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const countries = useMemo(() => COUNTRY_CODES
    .filter((code) => `${countryName(code)} ${code}`.toLocaleLowerCase('pl').includes(query.toLocaleLowerCase('pl')))
    .sort((first, second) => countryName(first).localeCompare(countryName(second), 'pl')), [query]);
  const choose = (code: string | null) => { onChange(code); setQuery(''); setOpen(false); };

  return <>
    <TouchableOpacity onPress={() => setOpen(true)} style={styles.trigger} activeOpacity={0.8}>
      <View><Text style={styles.value}>{value ? countryName(value) : 'Wybierz kraj'}</Text></View><Text style={styles.arrow}>⌄</Text>
    </TouchableOpacity>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}><View style={styles.modal}>
        <View style={styles.header}><Text style={styles.title}>Wybierz kraj</Text><TouchableOpacity onPress={() => setOpen(false)}><Text style={styles.close}>×</Text></TouchableOpacity></View>
        <TextInput value={query} onChangeText={setQuery} placeholder="Szukaj kraju" placeholderTextColor="#64748b" style={styles.search} autoFocus />
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {!required && <TouchableOpacity onPress={() => choose(null)} style={styles.option}><Text style={styles.optionName}>Dowolny kraj</Text></TouchableOpacity>}
          {countries.map((code) => <TouchableOpacity key={code} onPress={() => choose(code)} style={[styles.option, value === code && styles.optionSelected]}><Text style={styles.optionName}>{countryName(code)}</Text></TouchableOpacity>)}
        </ScrollView>
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minHeight: 52, marginBottom: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(148,163,184,0.26)', backgroundColor: 'rgba(2,6,23,0.58)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, value: { color: '#f8fafc', fontSize: 14 }, code: { color: '#64748b', fontSize: 10, marginTop: 2, fontWeight: '700', letterSpacing: 0.7 }, arrow: { color: '#7dd3fc', fontSize: 22 },
  backdrop: { flex: 1, backgroundColor: 'rgba(2,6,23,0.76)', alignItems: 'center', justifyContent: 'center', padding: 18 }, modal: { width: '100%', maxWidth: 440, maxHeight: '78%', borderRadius: 22, overflow: 'hidden', backgroundColor: '#0b1225', borderWidth: 1, borderColor: 'rgba(56,189,248,0.34)' }, header: { height: 62, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: 'rgba(148,163,184,0.12)' }, title: { color: '#f8fafc', fontSize: 17, fontWeight: '800' }, close: { color: '#cbd5e1', fontSize: 28 }, search: { height: 46, margin: 14, paddingHorizontal: 13, borderRadius: 11, backgroundColor: '#020617', color: '#f8fafc', borderWidth: 1, borderColor: 'rgba(148,163,184,0.2)' }, list: { paddingHorizontal: 14, paddingBottom: 16 }, option: { minHeight: 48, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: 'rgba(148,163,184,0.1)' }, optionSelected: { backgroundColor: 'rgba(37,99,235,0.24)' }, optionName: { color: '#e2e8f0', fontSize: 14 }, optionCode: { color: '#7dd3fc', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
});
