# Fit

Gym-Tracker als **PWA für Android** (Deutsch/Englisch), angelehnt an GymRun, mit Übungsdatenbank, Statistik, Wissensbereich und Advisor.
Alle Daten bleiben lokal auf dem Gerät (IndexedDB), Backup per JSON-Export. Die App läuft komplett offline.

## Funktionen

- **Training:** Routinen, Live-Training mit Vorwerten, Supersätze, Aufwärm-/Drop-/Versagenssätze, RPE, Pausentimer, Rekorde
- **Übungen:** 977 Übungen mit deutschen Namen, Muskelgrafik, Bildern, Geräteübungen aus dem Skript, eigene Übungen
- **Statistik und Verlauf**, Körperdaten, Backup
- **Advisor:** regelbasierter Planer (Stufe 1), Fortschrittshinweise aus dem Logbuch (Stufe 2), KI-Coach über OpenRouter (Stufe 3, eigener Schlüssel)
- **Wissen:** 16 Artikel und ein Glossar, dazu Rechner für 1RM, Kraftlevel, Energie/Makros/BMI, Trainingspuls und Hantelscheiben

## Auf dem Handy installieren

1. In GitHub unter **Settings → Pages → Source** „GitHub Actions“ wählen und den Branch nach `main` mergen. Der Workflow `.github/workflows/deploy.yml` baut und veröffentlicht die App.
2. Die Adresse `https://<benutzer>.github.io/fit/` in **Chrome auf Android** öffnen.
3. Menü ⋮ → **„App installieren“** (oder „Zum Startbildschirm hinzufügen“). Danach startet die App wie eine normale App und funktioniert offline.

Hinweis: GitHub Pages ist bei privaten Repositories nur mit bezahltem Tarif verfügbar, und die Seite ist dann öffentlich erreichbar. Alternativ geht jeder statische Host (Cloudflare Pages, Netlify); gebaut wird mit `npm run build`, das Ergebnis liegt in `dist/`.

## Entwickeln

```bash
npm install
npm run dev        # Entwicklungsserver
npm run check      # Typprüfung und Unit-Tests
npm run e2e        # Build und Ende-zu-Ende-Tests in Chromium (inkl. Offline-Test)
npm run build      # Produktions-Build inkl. Service Worker
```

Für einen Unterpfad (z. B. GitHub Pages) mit `VITE_BASE=/fit/ npm run build` bauen.

Übungsdaten neu bauen (Quellen siehe `docs/PLAN.md`):

```bash
node scripts/build-exercises.mjs --fedb <free-exercise-db/dist/exercises.json> --wger <wger/wger/exercises/fixtures>
```

Plan und Stand: [`docs/PLAN.md`](docs/PLAN.md). Quellen und Lizenzen: [`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md).
