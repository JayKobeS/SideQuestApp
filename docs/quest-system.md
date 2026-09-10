# System zadań i nowy ekran odkrywania

## Reguły

- Dzienne: trzy identyczne zadania dla wszystkich kont. Doba zadaniowa trwa od 06:00 do 06:00 w `Europe/Warsaw`, z uwzględnieniem czasu letniego. Zestaw dnia jest zapisany w bazie; edycja katalogu nie zmienia już opublikowanego zestawu. Przydział odbywa się przy odczycie API, bez wymagania crona.
- Świat: cztery sloty, sześć miesięcy kalendarzowych od przydziału, losowanie z całego katalogu bez wymagania GPS ani trybu wyjazdowego.
- Kraj: pięć slotów, 30 dni, kraj aktualnej lokalizacji potwierdzony na serwerze. Kraj konta nie ogranicza wyboru.
- Miasto (`local` w API): trzy sloty, siedem dni. Punkty katalogowe są filtrowane według odległości do 30 km; zadania ogólne są przypięte do współrzędnych przydziału.
- Sloty są przypisane do konta i kategorii. Zmiana kraju lub miasta nie kasuje wcześniejszych przydziałów i nie dodaje nowych slotów. Późniejsze uzupełnienie korzysta z nowej lokalizacji.
- Każde naciśnięcie `ROLL` przydziela dokładnie jedno zadanie do wolnego slotu. Nie można wymienić aktywnego zadania. Zadania w weryfikacji nadal zajmują slot, nawet po terminie, jeśli zostały zgłoszone przed nim. Odrzucone zgłoszenie można poprawić przed upływem terminu. Zatwierdzenie albo wygaśnięcie uwalnia slot. W pierwszej kolejności wybierane są niewidziane szablony; po wyczerpaniu puli możliwe są powtórki historyczne.
- Osiągnięcia: brąz / srebro / złoto / platyna, pojedynczy przydział danego osiągnięcia na konto, bez terminu w UI. Techniczny termin zgodny z dotychczasowym schematem: rok 9999.
- EXP przyznaje tylko zatwierdzenie przez moderatora. Operacja blokuje rekordy zadania i użytkownika. Kolejna próba zatwierdzenia nie nalicza nagrody. Poziom = `1 + floor(EXP / 1000)`.
- Weryfikacja wykonania pozostaje dotychczasowym przepływem moderatora; nie ma automatycznego potwierdzania zdjęć, tras ani zdobycia szczytu.

## API

Wszystkie poniższe endpointy wymagają zalogowania.

| Endpoint | Odpowiedź / działanie |
| --- | --- |
| `GET /quests/board` | Zadania konta, pojemności slotów, klucz dnia, czas następnego resetu, promień lokalny |
| `GET /quests/daily` | Lista trzech zadań; **zmiana kontraktu z pojedynczego obiektu** |
| `POST /quests/explore` | Jedno nowo wylosowane zadanie. Body: `category`, opcjonalna `location: {lat, lon}`; lokalizacja wymagana dla `country` i `local` |
| `GET /quests/achievements` | Katalog aktywnych osiągnięć |
| `POST /quests/achievements/{template_id}/claim` | Podejmuje wyzwanie lub zwraca istniejący przydział |
| `GET /quests/me` | Historia i bieżące zadania konta |
| `POST /quests/{quest_id}/submit` | Zgłasza wykonanie; body: opcjonalne `note` |
| `POST /admin/quests/{quest_id}/review` | Zatwierdza / odrzuca; zatwierdzenie nalicza EXP |

Szablony i przydziały mają nowe pola `xp_reward` i `medal`. Panel administratora pozwala ustawić obie wartości. `POST /quests/{id}/complete` pozostaje zgodnym wstecznie aliasem zgłoszenia do weryfikacji.

## Baza i uruchomienie

Nowa migracja: `l5f9c2e7a3b0`, następująca po `k4e8b1d6f2a9`. Dodaje pola nagród, zapis wspólnego dnia i indeks slotów. Zastępuje ograniczenie jednego zadania na dzień ograniczeniem użytkownik + dzień + szablon. Stare zadania dzienne pozostają w historii; aktywne zadania ze starej rotacji zostają wygaszone.

Migracja zawiera 1000 przykładowych zadań światowych (20 miast × 10 aktywności × 5 form relacji), osiem dziennych, dziesięć krajowych, dziesięć lokalnych i cztery osiągnięcia. Istniejące tytuły w danej kategorii nie są duplikowane. Katalog można później zastąpić treściami autorskimi przez panel/API. Źródło: `backend/core/quest_catalogue.py`.

Dla istniejącej bazy na rewizji `k4e8b1d6f2a9` uruchom z katalogu backendu, po ustawieniu `DATABASE_URL`:

```sh
alembic current
alembic upgrade head
```

Konfiguracja Docker Compose wykonuje migracje przed startem backendu. **Uwaga dotycząca wcześniejszego kodu repozytorium:** starsza migracja `k4e8b1d6f2a9` resetuje tabele. Jeśli baza jest na starszej rewizji, przejrzyj tamtą migrację przed uruchomieniem całego łańcucha. Nowa migracja nie resetuje kont.

W środowisku wykonania tej zmiany nie było działającego PostgreSQL ani Dockera. Nowej migracji nie zastosowano do właściwej bazy aplikacji. Testy serwisu używają odizolowanej bazy SQLite; nie weryfikują blokad współbieżnych transakcji PostgreSQL.

## Weryfikacja

- TypeScript: `cd frontend && npx tsc --noEmit`.
- Reguły i serwis: z katalogu backendu `python -m unittest discover -s tests -v` (zainstaluj `requirements.txt` i testowe `aiosqlite`).
- Eksport Expo dla przeglądarki i Androida.
- `frontend/tests/ui-smoke.cjs`: test przeglądarki z jawnymi atrapami API. Sprawdza przypisanie, lot mapy, zachowanie awatara po losowaniu i powrocie, zgłoszenie dzienne, medale oraz przełączniki zakresów. Wymaga eksportu web do `.test-artifacts/web`, Playwright i Chrome. Uruchamiaj z katalogu głównego projektu. `PLAYWRIGHT_MODULE` pozwala wskazać zewnętrzną instalację Playwright.

Ekran nie uzależnia zadań od dostępności mapy. Niedostępna mapa ma przycisk ponowienia. Awatar korzysta z aktualnej lokalizacji i obserwuje jej zmiany, a przydział kraju/miasta pobiera świeżą pozycję. Animacje mapy oraz kart respektują ograniczenie ruchu.
