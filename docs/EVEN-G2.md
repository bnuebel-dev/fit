# Even Realities G2: Apps entwickeln (Rechercheergebnis)

Stand der Recherche: 17.10.2026. SDK 0.0.16, CLI 0.1.14, Simulator 0.9.5.

**Quellenlage:** Die offizielle Doku-Seite `hub.evenrealities.com` war aus der Cloud-Umgebung nicht erreichbar (Netzwerk-Policy). Grundlage sind deshalb die offiziell veröffentlichten npm-Pakete (README, Typdefinitionen, Changelogs), die offiziellen GitHub-Repos (`evenhub-templates`, `everything-evenhub`) und Community-Referenzen. Wo Quellen sich widersprechen, steht das unten ausdrücklich. Vor dem ersten Release gegen die Live-Doku und echte Hardware prüfen.

## 1. Kernidee

Eine G2-App ist eine **normale Web-App** (HTML/CSS/TypeScript, z. B. Vite). Sie läuft in einer WebView der Even-App auf dem Handy. Auf der Brille läuft kein eigener Code.

```
[Dein Server oder .ehpk-Paket] <-HTTPS-> [Even-App-WebView auf dem Handy] <-BLE-> [G2-Brille]
```

- Die Brille ist nur Display und Eingabegerät. Die WebView ruft über das SDK (`EvenAppBridge`) native Funktionen auf.
- Im Entwicklungsmodus lädt die Even-App die Dev-URL per QR-Code (Sideload). Für die Veröffentlichung wird die App als `.ehpk`-Paket gebündelt und im Even-Hub-Developer-Portal eingereicht (manuelles Review).
- Es gibt aktuell nur die Oberfläche „Plugins“. Widgets und KI-Skills sind laut Doku angekündigt, nicht verfügbar.

## 2. Hardware

| Eigenschaft | Wert |
|---|---|
| Display | 576 x 288 px pro Auge, 4-Bit-Graustufen (16 Stufen Grün). Schwarz = aus (durchsichtig) |
| Eingabe | Touchpads an beiden Brillenbügeln, optional R1-Ring. Gesten: Tippen, Doppeltippen, Wischen hoch/runter, Langdruck (SDK 0.0.14+) |
| Mikrofon | 4 Mikrofone in der Brille. PCM, 16 kHz, signed 16 Bit little-endian, mono |
| Kamera / Lautsprecher | Keine |
| Sensoren | IMU (Kopfbewegung). Kein GPS (Standort kommt vom Handy) |
| Verbindung | Bluetooth LE |

## 3. Toolchain

| Paket | Version | Zweck |
|---|---|---|
| `@evenrealities/even_hub_sdk` | 0.0.16 | Bridge, Container, Events. Benötigt Even-App >= 2.2.10, Node ^20 oder >=22 |
| `@evenrealities/evenhub-cli` | 0.1.14 | `evenhub init`, `qr`, `pack`, `login` (Alias `eh`) |
| `@evenrealities/evenhub-simulator` | 0.9.5 | Desktop-Simulator der Brille mit HTTP-Automations-API |
| `@evenrealities/pretext` | 0.1.4 | Pixelgenaue Textmessung (Zeilenumbruch, Höhe, Kürzen) wie die Firmware |
| `even-toolkit` (Community) | 1.7.7 | Komponenten, Icons, `useGlasses`-Hook, Pagination, Textmessung |

Offizielle Repos: `even-realities/evenhub-templates` (Vorlagen `minimal`, `asr`, `image`, `text-heavy`) und `even-realities/everything-evenhub` (13 Skills für Claude Code und Codex: quickstart, template, build-and-deploy, glasses-ui, handle-input, device-features, test-with-simulator, simulator-automation, font-measurement, background-state, sdk-reference, cli-reference, design-guidelines). Installation in Claude Code:

```
/plugin marketplace add even-realities/everything-evenhub
/plugin install everything-evenhub@everything-evenhub
```

Community: Discord (`discord.gg/Y4jHMCU4sv`), `nickustinov/even-g2-notes` (de-facto Referenz), `aleapc/even-hub-devguide` (Praxisfälle), `pangoleen/awesome-even-realities-g2` (Linkliste).

### Workflow

```bash
npx degit even-realities/evenhub-templates/minimal my-app   # oder: npm create vite + SDK installieren
cd my-app && npm install
npm run dev -- --host 0.0.0.0                  # Dev-Server im LAN
npx evenhub-simulator http://localhost:5173    # Simulator
npx evenhub qr --url http://<LAN-IP>:5173      # QR in der Even-App scannen (Developer Mode nötig)
npm run build && npx evenhub pack app.json dist -o meine-app.ehpk
```

Developer Mode in der Even-App: laut Community die App-Version im About-Screen 7-mal antippen (nicht aus offizieller Quelle bestätigt). Eine `.ehpk` lässt sich nicht lokal öffnen, sie wird über das Portal hochgeladen und dann in der Even-App gestartet.

## 4. app.json (Manifest)

```json
{
  "package_id": "com.example.fitglass",
  "edition": "202601",
  "name": "Fit Glass",
  "version": "0.1.0",
  "min_app_version": "2.2.10",
  "min_sdk_version": "0.0.16",
  "entrypoint": "index.html",
  "permissions": [
    { "name": "network", "desc": "Begründung für den Nutzer", "whitelist": ["https://api.example.com"] }
  ],
  "supported_languages": ["en", "de"]
}
```

- `package_id`: Reverse-Domain, nur Kleinbuchstaben und Ziffern, keine Bindestriche oder Unterstriche, mindestens 2 Segmente. `evenhub pack --check` prüft die Verfügbarkeit.
- `name` max. 20 Zeichen. `version` dreiteilig (`1.0.0`). `edition` exakt `"202601"`.
- `permissions` ist ein **Array von Objekten** (`name`, `desc` 1 bis 300 Zeichen, bei `network` zusätzlich `whitelist`). Gültige Namen: `network`, `location`, `g2-microphone`, `phone-microphone`, `album`, `camera`.
- `supported_languages`: `en, de, fr, es, it, zh, ja, ko` (eine Community-Quelle zu SDK 0.0.9 nennt nur `en, es`; aktuelle Skills nennen die acht Sprachen).
- CORS gilt voll. Die Netzwerk-Whitelist ersetzt keine `Access-Control-Allow-Origin`-Header. APIs ohne CORS brauchen einen eigenen Proxy (z. B. Cloudflare Worker).
- `min_app_version`: Das SDK deklariert 2.2.10. Bei Bildern auf SDK >= 0.0.12 war Even-App < 2.2.7 nachweislich defekt. Der CLI trägt beim Packen automatisch das SDK-Minimum ein.

## 5. Display-Modell

Kein CSS, kein DOM. Die Oberfläche besteht aus absolut positionierten **Containern** (Ursprung oben links).

- Pro Seite max. 12 Container: höchstens 8 Text/Listen und 4 Bilder. **Genau ein** Container mit `isEventCapture: 1`. `containerID` eindeutig, `containerName` eindeutig (max. 16 Zeichen).
- `zOrderIndex` (ab 0.0.12): entweder auf allen Containern einer Seite setzen (eindeutige Werte, größer = vorne) oder auf keinem.
- Rand: `borderWidth` 0 bis 5, `borderColor` 0 bis 15, `borderRadius` 0 bis 10, `paddingLength` 0 bis 32. **Keine Hintergrund- oder Füllfarbe.**

**Text-Container:** linksbündig, eine feste proportionale Firmware-Schrift (LVGL), Zeilenhöhe 27 px, keine Größen-, Fett- oder Ausrichtungsoptionen. Umbruch an Containerbreite, `\n` für Zeilenumbruch. Ca. 400 bis 500 Zeichen füllen den Bildschirm. Inhaltslimit: 1000 Zeichen bei `create` und `rebuild`, 2000 bei `textContainerUpgrade` (der Simulator begrenzt Text auf 999 Bytes). Helligkeit pro Container über `textColor` 0 bis 4 (ab 0.0.14). Fehlende Zeichen werden übersprungen oder als Platzhalter gezeichnet: kein Emoji, keine Wetter- und Technik-Symbole. Brauchbar sind Pfeile `▲▼▶◀`, Kreise `●○`, Blöcke `█▇▆▅▄▃▂▁`, Linien `━─│`. Umlaute und Latin-1 sind vorhanden. Festbreiten-Layouts gehen nur mit Vollbreiten-Zeichen (`　`).

**Listen-Container:** native Firmware-Liste, 1 bis 20 Einträge, je max. 64 Zeichen, Scrollen und Markierung macht die Firmware. Einträge lassen sich nicht einzeln aktualisieren (nur `rebuild`), kein Styling pro Eintrag, Zeilenhöhe 40 px.

**Bild-Container:** Breite 20 bis 288, Höhe 20 bis 144, 4-Bit-Graustufen. Nach dem Anlegen leerer Platzhalter, Inhalt kommt per `updateImageRawData`. Nie zwei Bild-Updates gleichzeitig senden. Bilddaten dürfen nicht schon beim `createStartUpPageContainer` mitkommen (erst Seite anlegen, ca. 100 ms warten, dann Bild senden). Canvas-PNGs (24-Bit RGBA) werden teils stillschweigend abgelehnt, 16-Farben-indiziertes PNG (z. B. `upng-js`) ist der bewährte Weg. Für Bild-Apps braucht man einen unsichtbaren Vollbild-Text-Container (Inhalt ein Leerzeichen) als Event-Fänger hinter dem Bild.

## 6. Lebenszyklus und API-Überblick

```ts
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
const bridge = await waitForEvenAppBridge();
```

| Zweck | Aufruf |
|---|---|
| Erste Seite (genau 1x pro Sitzung) | `createStartUpPageContainer({containerTotalNum, textObject, listObject, imageObject, menuObject})` liefert 0 ok, 1 invalid, 2 oversize, 3 out of memory |
| Seite wechseln (Layout ändern, flackert kurz) | `rebuildPageContainer(...)` |
| Text ohne Flackern ändern | `textContainerUpgrade({containerID, containerName, content, contentOffset, contentLength, textColor})` |
| Bild setzen | `updateImageRawData({containerID, containerName, imageData})` mit Ergebnis `success`, `imageException`, `imageSizeInvalid`, `imageToGray4Failed`, `sendFailed` |
| Beenden | `shutDownPageContainer(0)` sofort, `shutDownPageContainer(1)` System-Dialog |
| Mikrofon | `audioControl(true, AudioInputSource.Glasses/Phone)`, Daten als `event.audioEvent.audioPcm` |
| Bewegung | `imuControl(true, ImuReportPace.P500)`, Daten in `event.sysEvent.imuData` |
| Standort (Handy) | `getAppLocation`, `startAppLocationUpdates`, `onAppLocationChanged` |
| Handy-Album/-Kamera | `pickImageFromAlbum()`, `captureImageFromCamera()` |
| Gerät / Nutzer | `getDeviceInfo()` (Modell, Akku, Trägt-Status), `onDeviceStatusChanged`, `getUserInfo()` |
| Speicher | `setLocalStorage(key, value)`, `getLocalStorage(key)` |
| Start-Quelle | `onLaunchSource` (`appMenu` oder `glassesMenu`) |
| Kontextmenü auf der Brille | `menuObject.menuItems` (max. 10, Name max. 32 UTF-8-Bytes), Klick als `menuItemClickEvent` |

Persistenz: **Nur** `bridge.setLocalStorage/getLocalStorage` ist verlässlich. Browser-`localStorage` und IndexedDB überleben Neustarts in der WebView nicht zuverlässig. Es gibt kein Löschen (leeren String schreiben). Muster: Beim Start alles in eine `Map` laden, synchron lesen, im Hintergrund schreiben und Schreibzugriffe entprellen.

## 7. Eingaben

Alle Events kommen über `bridge.onEvenHubEvent(cb)`. Nur der Container mit `isEventCapture: 1` bekommt Eingaben.

| Geste | Textcontainer aktiv | Listencontainer aktiv |
|---|---|---|
| Tippen | `sysEvent`, `eventType` fehlt (= 0) | `listEvent` mit `currentSelectItemIndex`/`Name` |
| Doppeltippen | `sysEvent`, `eventType` 3 | `sysEvent`, 3 |
| Wischen hoch/runter | `textEvent`, 1 (Anfang erreicht) bzw. 2 (Ende erreicht) | Firmware scrollt selbst, nur Grenz-Events |
| Langdruck / Loslassen | `sysEvent` 9 / 10 | `sysEvent` 9 / 10 |
| Vorder-/Hintergrund | `sysEvent` 4 (Enter), 5 (Exit), 6 (abnormal), 7 (System-Exit) | dito |

`sysEvent.eventSource` unterscheidet rechten Bügel (1), Ring (2) und linken Bügel (3).

**Die größte Falle:** Protobuf lässt Nullwerte weg. Ein einfacher Tipp (`CLICK_EVENT = 0`) hat **kein** `eventType`-Feld, ebenso Listenindex 0. Immer `?? 0` verwenden, aber den Default innerhalb der jeweiligen Event-Hülle auflösen (sonst löst jedes Scroll- oder Audio-Event den Tipp-Handler aus). Weitere Praxispunkte: Wisch-Events feuern gehäuft, 300 ms Cooldown einbauen. Die Firmware sendet Sys-Events teils doppelt (50 bis 100 ms Abstand), deduplizieren.

**Review-Pflicht (Einreichung):** Doppeltippen auf der Startseite muss `shutDownPageContainer(1)` aufrufen, sonst wird die App abgelehnt. Auf allen anderen Seiten bedeutet Doppeltippen „zurück“. Der Exit-Dialog vertauscht die Vordergrund-Events (Enter beim Erscheinen, Exit bei „Nein“, SystemExit bei „Ja“) und kann auf manchen Ständen den Bildkanal blockieren. Ein Flag setzen, nicht vor Bestätigung aufräumen, und den Dialog bevorzugt über einen Menüeintrag „Beenden“ erreichen.

## 8. Performance und Grenzen

Gemessen auf Firmware 2.2.7.14 (eine Messreihe, nicht als Spezifikation lesen):

| Aufruf | Dauer |
|---|---|
| `textContainerUpgrade` | ca. 83 ms |
| `rebuildPageContainer` | ca. 165 ms, unabhängig von der Containerzahl |
| `updateImageRawData` | ca. 104 ms fix plus ca. 4 ms pro KB |

Folgerungen: Anzahl der Aufrufe zählt, nicht die Größe. Für 1 bis 2 Texte `textContainerUpgrade`, für mehr ein `rebuild`. Maximal ca. 9 Bilder pro Sekunde, realistisch 5 bis 7. Animationen also nur grob, rundenbasiert denken. **Alle Bridge-Aufrufe seriell mit await**, mit Timeout (ein hängender BLE-Hop kann ca. 30 s blockieren). Kein Standort-Await vor dem ersten Zeichnen (Fix dauert ca. 3 s).

Hintergrund: Läuft die App nicht im Vordergrund, werden Zeichenaufrufe verworfen, Timer laufen aber weiter. Auf `FOREGROUND_EXIT/ENTER` Timer pausieren und neu zeichnen. Es gibt keinen geplanten Start oder Push für Drittanbieter-Apps (Erinnerungen brauchen eine Handy-Companion-App, die Benachrichtigungen an die Even-App weiterreicht).

Nicht vorhanden: Audioausgabe, Kamera auf der Brille, freies Pixelzeichnen, Schriftwahl, Ausrichtung, Hintergrundfarbe, Animationen, programmatisches Scrollen, direkter BLE-Zugriff.

## 9. Offene Widersprüche der Quellen (vor dem Bau klären)

1. **Containerzahl:** Offiziell bis 12 (8 Text/Liste plus 4 Bild). Eine ältere Community-Quelle (SDK 0.0.9) fand mehr als 4 unzuverlässig. Auf Hardware prüfen.
2. **Bildgröße:** Offiziell bis 288 x 144. Dieselbe ältere Quelle fand über ca. 200 x 100 fehlerhaft. Der Simulator erzwingt keine Hardware-Limits.
3. **`setBackgroundState` / `onBackgroundRestore`:** Der offizielle Skill `background-state` beschreibt sie (WebView-Migration beim Wechsel des Handys in den Hintergrund). Im veröffentlichten SDK 0.0.16 sind sie **nicht** enthalten. Vermutlich kommen sie mit einer späteren Version. Bis dahin Zustand selbst über `setLocalStorage` sichern.
4. **Simulator gegen Hardware:** Ältere Quelle: Tipps kommen auf Hardware als `sysEvent`, im Simulator als `textEvent`. Der Simulator wurde seither angepasst (0.9.x sendet Tipp, Doppeltipp, Langdruck als Sys-Events). Beide Pfade abfangen.
5. **Plattform:** Eine Quelle nennt nur iPhone (Flutter-WebView), der offizielle Skill erwähnt auch Android (Chromium). Vor dem Bau klären, welches Handy und welche Even-App-Version vorhanden ist.
6. **Veröffentlichung:** Eine Quelle nennt das Portal als „noch nicht verfügbar“, aktuelle Quellen beschreiben Upload, Beta-Tester und Review. Aktueller Stand im Portal prüfen.

## 10. Bezug zur Fit-App in diesem Repo

Fit ist ein Gym-Tracker (React, Dexie/IndexedDB, Capacitor). Für die Brille ist das ein naheliegender Fall: ein „Live-Training“-Begleiter.

- Referenzen: `Alireza29675/hevy-g2` (Satz-Anzeige, ein Tipp = Satz fertig, Supersatz-Reihenfolge, Zähl-Timer), `fabioglimb/even-workout` (Routinenliste, Pausentimer, Fortschrittsbalken, Verlauf), `r-castelo/G2_Gym_App`.
- Datenfluss: Die G2-App ist eine eigene Web-App und kann **nicht** auf die IndexedDB der Fit-PWA zugreifen (eigene Origin, eigener Speicher). Optionen: Routinen per JSON-Export/Import in den Bridge-Speicher laden (offline, einfach), oder gemeinsamer Backend-Dienst (mehr Aufwand, Datenschutz-Abwägung, da Fit bewusst lokal bleibt). Empfehlung: erst Export/Import.
- Vorschlag Bildschirme: Routinenliste (Listen-Container) → Übung/Satz mit Zielgewicht und Wiederholungen plus Vorwert (Text, 2 Container) → Pausentimer per `textContainerUpgrade` jede Sekunde → Zusammenfassung. Tippen = Satz erledigt, Wischen = Gewicht/Wiederholungen anpassen, Doppeltippen = zurück bzw. auf Startseite Exit-Dialog.
- Rückweg: Ergebnisse im Bridge-Speicher sammeln und in Fit per Import übernehmen.
- Übungsbilder und Muskelgrafiken eignen sich wegen der 16 Grünstufen und der niedrigen Bildrate nur als kleine Piktogramme (z. B. 96 x 96, vorab auf 4 Bit gerastert).

## 11. Empfohlene Projektstruktur für die Umsetzung

```
g2/
  app.json
  index.html            # Phone-WebView: Einrichtung, Routinen importieren, Verlauf
  src/
    main.ts             # Bridge, Start, Eventrouter, Lebenszyklus
    glasses/            # Layouts je Bildschirm (reine Funktionen: Zustand -> Container)
    state/              # Reiner Zustandsautomat, ohne SDK testbar (vitest)
    storage.ts          # Map-Cache über setLocalStorage mit Entprellen
    events.ts           # parseEvent: ?? 0, Dedupe, Cooldown, Quellen (sys/text/list)
  tests/
```

Grundsätze: ein serieller Render-Kanal (Queue mit Timeout), `createStartUpPageContainer` exakt einmal (Flag auch bei Fehlschlag setzen), Rückgabewerte prüfen, Layouts mit `@evenrealities/pretext` vermessen, Logik vom Rendering trennen, Simulator-Automations-API (`--automation-port`, Screenshot 576x288) für Tests nutzen, vor jedem Release auf echter Hardware prüfen.

## Quellen

- npm: `@evenrealities/even_hub_sdk`, `@evenrealities/evenhub-cli`, `@evenrealities/evenhub-simulator`, `@evenrealities/pretext` (README, Typen, Changelogs)
- github.com/even-realities/evenhub-templates, github.com/even-realities/everything-evenhub (Skills)
- github.com/nickustinov/even-g2-notes, github.com/aleapc/even-hub-devguide
- github.com/pangoleen/awesome-even-realities-g2, github.com/Alireza29675/hevy-g2, github.com/fabioglimb/even-workout, github.com/fabioglimb/even-toolkit
- Nicht erreichbar, aber maßgeblich: hub.evenrealities.com/docs
