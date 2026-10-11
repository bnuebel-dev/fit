# Fit – Projektplan (Entwurf v2)

Gym-Tracker als **PWA für Android**, orientiert an GymRun, erweitert um Trainingswissen und einen Advisor.
Sprachen: **Deutsch** und **Englisch (en-US)**. Nutzung: **nur privat**.

## 1. Ziele

- Trainings schnell und offline loggen (Gewicht, Wiederholungen, RPE, Notizen, Supersätze)
- Routinen und Pläne selbst bauen oder vom Advisor erstellen lassen
- Übungen und **Geräte** mit Bildern und Zielmuskulatur, **abgedeckt wie in den Skript-PDFs**
- Fortschritt auswerten (Volumen, Rekorde, 1RM, Muskelverteilung)
- Trainingswissen aus den Skript-PDFs direkt in der App
- Advisor in drei Stufen: Regeln → Fortschritts-Hinweise → KI-Coach (OpenRouter)

Nicht-Ziele: Smartwatch, Lockscreen-Widget, Social-Funktionen, Accounts/Cloud-Sync, Veröffentlichung.

## 2. Technik

| Bereich | Wahl | Grund |
|---|---|---|
| Framework | React + TypeScript + Vite | Standard, schnell, gut für PWA |
| PWA | vite-plugin-pwa (Workbox) | Installierbar, Offline-Cache |
| Daten lokal | IndexedDB über Dexie | Strukturiert, offline, Export/Import |
| UI | Tailwind CSS | Schnell, mobil-first |
| i18n | i18next (de, en-US) | UI-Texte und Übungsnamen |
| Diagramme | Recharts oder uPlot | Statistik |
| Tests | Vitest + Playwright | Logik, Oberfläche, Abdeckung |

Alle Daten bleiben auf dem Gerät. Backup per JSON-Export/-Import (später GymRun-CSV-Import, falls verfügbar).

## 3. Screens (an GymRun angelehnt)

Untere Navigation: **Training · Statistik · Verlauf · Körper · Mehr**

- **Training:** Routinenliste (Farbe, Wochentag, Notiz) → laufendes Training mit abhakbaren Übungen, Sätze mit Gewicht/Wdh/RPE, Vorwerte vom letzten Mal, Supersätze, Notizen, Rekord-Anzeige
- **Pausentimer:** Vollbild, ±10 s, nächster Satz sichtbar, Vibration am Ende
- **Statistik:** Zeitraum (Woche/1 M/3 M/…), Muskelgrafik mit Anteilen, Verlaufsdiagramm, Tabelle (Summe/Max/Min/Ø/Trend)
- **Verlauf:** Kalender und Liste vergangener Trainings
- **Körper:** Körpermaße, Basisdaten, Fotobuch
- **Mehr:** Übungs-/Gerätedatenbank, 1RM-Tabelle, Hantelscheiben-Rechner, Stoppuhr, Wissen, Advisor, Einstellungen (Sprache, Einheiten kg/lb, Backup)

## 4. Datenmodell (Entwurf)

```
Exercise     id, source ("fedb" | "wger" | "custom"), name{de,en}, category,
             equipment[], machine?, level, mechanic, force,
             primaryMuscles[], secondaryMuscles[],
             instructions{de,en}, images[], favorite, sourceRefs[]
Machine      id, name{de,en}, type (machine | cable | free | bodyweight | cardio)
Routine      id, name, color, weekday?, note, items[] (exerciseId, targetSets,
             targetReps, restSec, supersetGroup?)
Workout      id, routineId?, startedAt, endedAt, note
SetLog       id, workoutId, exerciseId, order, weight, reps, rpe?, note?,
             type (warmup | normal | drop | failure), done
BodyEntry    id, date, type (measurements | basic | photo), values{}
Settings     language, units, restDefault, myGym{machines[]}, advisor{apiKey?, model?}
```

Muskel-IDs entsprechen denen von free-exercise-db (17 Gruppen), damit Datenbank, Grafik und Statistik zusammenpassen.

## 5. Übungs- und Gerätedatenbank

### Quellen (Stand der Recherche)

| Quelle | Umfang | Sprachen | Lizenz | Rolle |
|---|---|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | 876 Übungen, je 2 Bilder; 67× „machine“, 81× Kabel | nur Englisch | Unlicense (gemeinfrei) | **Basis** inkl. Bilder und Muskelzuordnung |
| [wger](https://github.com/wger-project/wger) (Fixtures `exercises/fixtures`) | 872 Übungen, 2.429 Übersetzungen | **214× Deutsch**, mit Geräte-Begriffen (Beinpresse, Butterfly, Hackenschmidt, Long-Pulley …) | CC-BY-SA 3/4, teils CC0/CC-BY 4, pro Eintrag | **Deutsche Namen/Texte**, Abgleich per Name |
| eigene Einträge | nach Bedarf | de + en | – | Lücken, Geräte aus den PDFs |

Weitere geprüfte Quellen wurden verworfen (Lizenz unklar oder Weitergabe-Einschränkungen).

Da die App privat bleibt, ist die Kombination der Quellen unkritisch. Trotzdem legen wir `docs/ATTRIBUTION.md` an (Quelle, Lizenz, Autor je Datensatz), damit eine spätere Veröffentlichung nicht an der Herkunft scheitert.

### Vorgehen

1. Beide Datensätze importieren und per normalisiertem Namen/Übersetzung abgleichen
2. Deutsche Namen und Anleitungen: wger zuerst, Rest in eigenen Worten (Übersetzungsdatei `exercises.de.json`), Fallback Englisch
3. **Abdeckungsprüfung** (siehe unten) und fehlende Geräte als eigene Einträge ergänzen
4. Bilder: erst Größe prüfen; Variante A mitliefern, Variante B lazy laden und im Service Worker cachen („Alle herunterladen“ optional). Bildlizenzen von wger pro Bild prüfen, free-exercise-db-Bilder sind frei.
5. Muskelgrafik (SVG, Vorder-/Rückansicht, 17 Zonen) zeichnen wir selbst

### Abdeckung „wie in den PDFs“

Die PDFs enthalten keinen Übungskatalog, nennen aber Übungen und Geräte als Beispiele, vor allem Modul 6 (je Muskel „Bei welcher Übung wird er beansprucht?“) und Modul 9 (Fokus auf Geräteübungen).

- Aus allen PDFs wird eine **Referenzliste** aller genannten Übungen/Geräte erzeugt (`docs/pdf-coverage.csv`)
- Jeder Eintrag wird einer Übung der Datenbank zugeordnet oder als eigener Eintrag angelegt
- Beispiele aus den PDFs: Beinpresse, Beinstrecker, Beinbeuger, Bauchmaschine, Schulterdrückmaschine, Brustpresse, Butterfly(-maschine), Latzug, Kabelzug (Trizepsdrücken mit Seil), Langhantelrudern, Ausfallschritte, Bizeps-Curls, Kniebeuge, Bankdrücken, Schrägbankdrücken, Dips, Überkopfdrücken, Kreuzheben (auch rumänisch), Wadenheben
- Bekannte Lücken in free-exercise-db: sitzende Rudermaschine, Hüft-Abduktoren/-Adduktoren-Maschine, „Pec Deck“-Benennung
- **Automatischer Test:** Für jeden Muskel aus Modul 6 gibt es mindestens eine Geräte- und eine Freihantelübung, und jeder Eintrag der Referenzliste ist in der Datenbank auffindbar
- Einstellung „Mein Studio“: Geräte auswählen, die vorhanden sind; Filter und Advisor berücksichtigen das

## 6. Wissensbereich (aus den Skript-PDFs)

Wir fassen die Inhalte **in eigenen Worten** zusammen (kurz, strukturiert, als Markdown in `src/content/{de,en}/`) und nennen die Quellen.

| Modul | In der App |
|---|---|
| 5, 6 Bewegungsapparat, Anatomie | Muskel-Detailseiten, Zielmuskulatur, Übungszuordnung |
| 7 Trainingslehre | Superkompensation, Progression, Hypertrophie, Kraftrichtwerte |
| 8 Motorische Eigenschaften | Kraft, Ausdauer, Beweglichkeit, Verletzungen |
| 9 Trainingsplanung | **Regelwerk des Advisors** (Muscle and Strength Pyramid) |
| 10 Ernährung | Kalorien-, Eiweiß-, BMI-Rechner, Artikel |
| 11 Praxis | Onboarding-Fragebogen, Aufbau einer Einheit, Aufwärmen |
| Glossar | Begriffs-Popups (RPE, Deload, 1RM …) |

Modul 3 fehlt im Upload und wird bei Bedarf nachgereicht.

## 7. Advisor

**Stufe 1 – Planer (regelbasiert, offline).** Fragebogen (Ziel, Erfahrung, Tage/Woche, Geräte im Studio, Einschränkungen, Zeit) → Split-Vorschlag (Ganzkörper, Oben/Unten, Push/Pull/Legs) mit Übungsauswahl (Fokus Geräte, Grundübungen als Ergänzung), Sätzen, Wdh-Bereichen, Pausen. Regeln nach Modul 9. Jeder Vorschlag erklärt sein „Warum“.

**Stufe 2 – Fortschritts-Hinweise (regelbasiert, offline).** Doppelte Progression, Plateau-Erkennung, Volumen je Muskelgruppe und Woche, Deload-Vorschlag.

**Stufe 3 – KI-Coach über OpenRouter.** Freier Chat mit Zugriff auf einen Auszug der eigenen Trainingsdaten.
- API-Schlüssel: Da die App privat bleibt, trägt der Nutzer den **eigenen OpenRouter-Schlüssel in den Einstellungen** ein; er wird nur lokal gespeichert (kein Backend nötig). Hinweis: Wer Zugriff auf das Gerät oder den Browser-Speicher hat, kann ihn lesen; ein Ausgabenlimit im OpenRouter-Konto setzen.
- Es gehen nur Daten raus, die der Nutzer freigibt. Hinweis, dass der Coach keine medizinische Beratung ist.
- Modellwahl in den Einstellungen.

## 8. Mehrsprachigkeit

- UI: i18next, `de.json` und `en.json`
- Übungen: Englisch aus der Quelle, Deutsch aus wger/eigener Übersetzung, Fallback Englisch
- Wissensartikel: je Sprache eine Markdown-Datei
- Einheiten kg/lb, Datums- und Zahlenformat folgen der Sprache

## 9. Meilensteine

1. **Gerüst:** Projekt, PWA, Navigation, i18n, Datenbank-Schema, Export/Import
2. **Kern-Tracking:** Routinen, Live-Training, Sätze, Vorwerte, Pausentimer, Verlauf
3. **Übungs-/Gerätedatenbank:** Import, Abgleich, Abdeckungstest, Suche/Filter, eigene Übungen, Bilder, Muskelgrafik
4. **Statistik:** Diagramme, Rekorde, 1RM, Muskelverteilung
5. **Wissen:** Artikel, Glossar-Popups, Rechner (BMI, Kalorien, Eiweiß, Hantelscheiben)
6. **Advisor Stufe 1 und 2**
7. **Körperdaten und Fotobuch**
8. **Advisor Stufe 3 (OpenRouter)**
9. **Feinschliff:** Dark Mode, Barrierefreiheit, Performance, Tests

## 10. Offene Fragen

- Bilder komplett offline mitliefern oder bei Bedarf laden (Größe prüfen)?
- Gibt es eine Geräteliste oder Fotos aus deinem Studio für „Mein Studio“?
- Gibt es einen GymRun-Export (CSV) zum Übernehmen der Historie?
- Verletzungen/Einschränkungen, die der Planer immer berücksichtigen soll?
- Modul 3 des Skripts nachreichen?
