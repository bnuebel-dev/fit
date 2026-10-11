# Fit

Gym-Tracker als **PWA für Android** (Deutsch/Englisch), angelehnt an GymRun, mit Übungsdatenbank, Statistik und geplant einem Advisor.
Alle Daten bleiben lokal auf dem Gerät (IndexedDB), Backup per JSON-Export.

## Entwickeln

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests (Vitest)
npm run build      # Produktions-Build inkl. Service Worker
node e2e/smoke.mjs # Ende-zu-Ende-Test in Chromium (benötigt vorherigen Build)
```

Übungsdaten neu bauen (Quellen siehe `docs/PLAN.md`):

```bash
node scripts/build-exercises.mjs --fedb <free-exercise-db/dist/exercises.json> --wger <wger/wger/exercises/fixtures>
```

Plan und Stand: [`docs/PLAN.md`](docs/PLAN.md). Quellen und Lizenzen der Übungsdaten: [`docs/ATTRIBUTION.md`](docs/ATTRIBUTION.md).
