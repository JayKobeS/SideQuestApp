import AdminPointPickerDom from '@/components/AdminPointPickerDom';
import { StyleSheet, View } from 'react-native';

export type MapPoint = { lat: number; lon: number };

export function AdminPointPicker({ value, onChange }: { value: MapPoint | null; onChange: (point: MapPoint) => void }) {
  const handlePointChange = async (lat: number, lon: number) => {
    onChange({ lat, lon });
  };

  return (
    <View style={styles.container}>
      <AdminPointPickerDom
        valueLat={value?.lat ?? null}
        valueLon={value?.lon ?? null}
        onPointChange={handlePointChange}
        dom={{ containerStyle: styles.domContainer }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  domContainer: { flex: 1 },
});
