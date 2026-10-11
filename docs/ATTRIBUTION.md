# Quellen und Lizenzen

Die App ist rein privat. Diese Datei hält die Herkunft der Daten fest, falls sich das ändert.

| Quelle | Verwendung | Lizenz |
|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | Übungen, Muskelzuordnung, englische Anleitungen, Bilder (per CDN geladen) | Unlicense (gemeinfrei) |
| [wger](https://github.com/wger-project/wger) (Fixtures `wger/exercises/fixtures`) | Deutsche Namen/Beschreibungen für Dubletten (als Suchbegriffe) und 94 zusätzliche Übungen | CC-BY-SA 3 / CC-BY-SA 4 / CC0 / CC-BY 4, je Eintrag; Autor meist „wger.de“ |
| Eigene Übersetzung | Deutsche Namen aller free-exercise-db-Übungen (`data/de-names.json`) | eigenes Werk |

Zuordnung wger → free-exercise-db: `data/wger-merge.json`. Einträge mit `source: "wger"` in `public/data/exercises.json` stammen aus wger und stehen unter der dortigen Lizenz (bei CC-BY-SA gilt Weitergabe unter gleichen Bedingungen).

Das Trainingswissen aus den Fitnesstrainer-B-Lizenz-Skripten (OTL) wird nur in eigenen Worten zusammengefasst; die PDFs sind urheberrechtlich geschützt und nicht Teil der App.
