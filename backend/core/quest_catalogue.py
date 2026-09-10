"""Replaceable demo catalogue; no assignments are created by seeding."""
DESTINATIONS = [
    ('Paryż', 'FR', 48.8566, 2.3522), ('Rzym', 'IT', 41.9028, 12.4964),
    ('Lizbona', 'PT', 38.7223, -9.1393), ('Barcelona', 'ES', 41.3874, 2.1686),
    ('Londyn', 'GB', 51.5074, -0.1278), ('Praga', 'CZ', 50.0755, 14.4378),
    ('Wiedeń', 'AT', 48.2082, 16.3738), ('Berlin', 'DE', 52.52, 13.405),
    ('Tokio', 'JP', 35.6762, 139.6503), ('Kioto', 'JP', 35.0116, 135.7681),
    ('Seul', 'KR', 37.5665, 126.978), ('Bangkok', 'TH', 13.7563, 100.5018),
    ('Sydney', 'AU', -33.8688, 151.2093), ('Melbourne', 'AU', -37.8136, 144.9631),
    ('Nowy Jork', 'US', 40.7128, -74.006), ('San Francisco', 'US', 37.7749, -122.4194),
    ('Toronto', 'CA', 43.6532, -79.3832), ('Marrakesz', 'MA', 31.6295, -7.9811),
    ('Kraków', 'PL', 50.0647, 19.945), ('Kopenhaga', 'DK', 55.6761, 12.5683),
]
ACTIVITIES = [
    ('Miejski spacer', 'Przejdź pieszo trasę przez centrum'),
    ('Lokalny smak', 'Spróbuj lokalnej potrawy'),
    ('Ślad historii', 'Odwiedź publicznie dostępny zabytek'),
    ('Zielona przerwa', 'Odwiedź park i odkryj jego ścieżki'),
    ('Sztuka w podróży', 'Odwiedź muzeum lub galerię'),
    ('Architektura', 'Znajdź ciekawy budynek i poznaj jego historię'),
    ('Życie dzielnicy', 'Odwiedź dzielnicę poza głównym szlakiem'),
    ('Lokalny targ', 'Odwiedź targ lub lokalny sklep rzemieślniczy'),
    ('Panorama', 'Znajdź ogólnodostępny punkt z widokiem na miasto'),
    ('Kultura na żywo', 'Weź udział w lokalnym wydarzeniu kulturalnym'),
]
FOCUSES = [
    ('Fotoreportaż', 'Zrób trzy zdjęcia dokumentujące odkrycie.'),
    ('Dziennik', 'Zapisz krótką relację z wizyty.'),
    ('Pięć szczegółów', 'Zapisz pięć szczegółów, które przykuły Twoją uwagę.'),
    ('Pocztówka', 'Przygotuj własną pocztówkę z fotografią i opisem.'),
    ('Mini przewodnik', 'Opisz trasę i jedną wskazówkę dla kolejnego podróżnika.'),
]

def demo_templates():
    rows = []
    for city, code, lat, lon in DESTINATIONS:
        for title, action in ACTIVITIES:
            for focus, evidence in FOCUSES:
                rows.append(dict(title=f'{city}: {title} · {focus}', description=f'{action} w mieście {city}. {evidence}', category='world', difficulty='hard', xp_reward=600, city=city, country_code=code, lat=lat, lon=lon))
    daily = [('Kolor dnia', 'Znajdź i sfotografuj coś niebieskiego w swojej okolicy.'), ('Nieznany zakątek', 'Odwiedź dostępne miejsce, w którym jeszcze nie byłeś.'), ('Kwadrans na zewnątrz', 'Spędź 15 minut na świeżym powietrzu.'), ('Mały dobry gest', 'Zrób coś pomocnego dla innej osoby.'), ('Uważny spacer', 'Zauważ i zapisz trzy ciekawe szczegóły w otoczeniu.'), ('Chwila bez ekranu', 'Poświęć 20 minut na ulubioną aktywność bez telefonu.'), ('Nowa wiedza', 'Poznaj jedną ciekawostkę o swojej okolicy.'), ('Pocztówka dnia', 'Zrób zdjęcie, które najlepiej podsumowuje Twój dzień.')]
    for title, description in daily:
        rows.append(dict(title=title, description=description, category='daily', difficulty='easy', xp_reward=80))
    for category, xp in [('local', 180), ('country', 320)]:
        for title, action in ACTIVITIES:
            rows.append(dict(title=f'{title} — ' + ('blisko Ciebie' if category == 'local' else 'odkryj kraj'), description=action + ('. Wybierz miejsce w promieniu 30 km od punktu przydzielenia.' if category == 'local' else '. Wybierz miejsce w kraju, w którym przydzielono zadanie.'), category=category, difficulty='medium', xp_reward=xp, radius_km=30 if category == 'local' else None))
    for title, description, medal, xp, lat, lon in [
        ('Pierwsze 10 kilometrów', 'Ukończ pieszą trasę o długości 10 km, dostosowaną do swoich możliwości.', 'bronze', 1200, None, None),
        ('Półmaraton', 'Ukończ bieg na dystansie 21,0975 km.', 'silver', 3000, None, None),
        ('Mont Blanc', 'Zdobądź Mont Blanc w ramach przygotowanej wyprawy górskiej.', 'gold', 8000, 45.8326, 6.8652),
        ('Mount Everest', 'Zdobądź Mount Everest w ramach przygotowanej ekspedycji.', 'platinum', 20000, 27.9881, 86.925),
    ]:
        rows.append(dict(title=title, description=description, category='achievement', difficulty='hard', medal=medal, xp_reward=xp, lat=lat, lon=lon))
    return rows
