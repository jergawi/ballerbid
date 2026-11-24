# BALLER BID source

`index.html` at the repo root is a single self-contained build. These are the files it is built from.

| File | What it holds |
|---|---|
| `app.js` | Core: state, networking (MQTT, host is the authority), auction engine, game sim, main views |
| `formats.js` | Auction formats (一般喊價 / 暗標 / 搶標) and 輪流提名. Every card still ends in `sell()` or `skipCard()` |
| `place.js` | Automatic roster placement after each sale |
| `bench.js` | 10-man bench roles (替補後衛 / 替補鋒線 / 第六人) and substitutions |
| `mis.js` | Mission cards |
| `season.js` | Season mode |
| `legend.js` | Legendary groups (三巨頭, 王朝) |
| `sfx.js` | Synthesised sound effects (Web Audio, no audio files) |
| `views2.js`, `views3.js` | Views for missions/season and for formats/bench/sound |
| `style4.css` | Styles |
| `*.json` | Player data (Basketball-Reference via sumitrodatta/bball-reference-datasets) |

Build: `npm i morphdom mqtt@5.16.1` then `python3 bundle2.py` → `dist2/index.html`.
