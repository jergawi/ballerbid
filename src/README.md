# BALLER BID source

`index.html` at the repo root is a single self-contained build made from these files. There is no server: one
player's device (the host) runs the game and the others sync through public MQTT relays, end-to-end encrypted.

## Main program (one shared global scope, joined in this order by `bundle2.py`)

| File | What it holds |
|---|---|
| `core.js` | Data loading, positions, chemistry, game state and the auction engine (`apply`, timers) |
| *game modules* | see below; they sit between `core.js` and the rest |
| `sim.js` | Matchup model: team strength, tactics, takeovers, box scores, series |
| `net.js` | Online play: encryption + compression, both relays at once, state sync, resend, host hand-over |
| `flow.js` | Dispatch, local / vs-computer modes, phase transitions, sound and vibration cues, update check |
| `views.js` | Screens: home, lobby, auction, lineup |
| `playback.js` | Game-by-game text play-by-play and the results screen |
| `events.js` | Taps, inputs, drag-and-drop and their action handlers |

## Game modules

| File | What it holds |
|---|---|
| `formats.js` | Auction formats (一般喊價 / 暗標 / 搶標) and 輪流提名. Every card still ends in `sell()` or `skipCard()` |
| `place.js` | Automatic roster placement after each sale (also scores rosters for the AI) |
| `cards.js` | Ability cards (能力卡) |
| `bot.js` | AI opponents: card valuation from public information only, bidding styles, nominations, timing |
| `tactics.js` | Offence/defence systems, fit and counters |
| `phase.js` | Career phase badges and the 攻守貢獻 rating |
| `bench.js` | 10-man bench roles and substitutions |
| `mis.js`, `season.js`, `legend.js` | Missions, season mode, legendary groups |
| `sfx.js` | Synthesised UI sounds (Web Audio, no audio files) |
| `views2.js`, `views3.js`, `log.js` | Views for missions/season/formats, the game log export |
| `style4.css` | Styles |
| `*.json` | Player data (Basketball-Reference via sumitrodatta/bball-reference-datasets) |

## Build and checks

```
npm install          # eslint, prettier, morphdom, mqtt
npm run build        # → dist2/index.html (production, with CSP) and dist2/test.html (for local tests)
npm run check        # prettier --check on the sources + eslint on the bundled script
npm run format       # reformat the sources
```
