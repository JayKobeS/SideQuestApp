export interface LocationItem {
  id: string;
  title: string;
  country: string;
  lat: number;
  lon: number;
}

export const QUEST_LOCATIONS: LocationItem[] = [
  { id: '1', title: 'Tajemnica Wawelu', country: 'Polska', lat: 50.0647, lon: 19.945 },
  { id: '2', title: 'Sekret Wieży', country: 'Francja', lat: 48.8584, lon: 2.2945 },
  { id: '3', title: 'Neonowy Pościg', country: 'Japonia', lat: 35.6762, lon: 139.6503 },
  { id: '4', title: 'Złote Wybrzeże', country: 'Stany Zjednoczone', lat: 37.7749, lon: -122.4194 },
  { id: '5', title: 'Piramidalna Zagadka', country: 'Egipt', lat: 29.9792, lon: 31.1342 },
  { id: '6', title: 'Tajemnica Amazonii', country: 'Brazylia', lat: -3.4653, lon: -62.2159 },
  { id: '7', title: 'Operowa Nuta', country: 'Australia', lat: -33.8568, lon: 151.2153 },
];
