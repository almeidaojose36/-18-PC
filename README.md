# Why an $18 PC Can't Play a YouTube Video in 2026

An animated 3D explainer about the Dell Wyse 3040 thin client, built with Three.js.
The player runs the full narration script line by line: each line has its own camera
move, exploded view, labels and on-screen figures, synced to the narration audio.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Press play (or Space). ← / → jump between script lines; the scrubber has a tick per chapter.

URL options: `?clean=1` hides the controls (for screen capture), `?t=120` starts at a
time in seconds, `?cc=0` hides captions, `?mute=1` disables narration.

## What is where

| Path | What it is |
| :--- | :--- |
| `docs/script-and-blueprint.md` | The source script and dimensional blueprint |
| `src/script.json` | The script as data: chapters and lines (`o1` … `f5`) |
| `src/model.js` | Procedural Wyse 3040 assembly, 1 unit = 1 mm, one named group per part |
| `src/scenes.js` | Shot list: camera, explode state, labels and callouts for every line |
| `src/stage.js` | Studio, lighting, props and effects (die floorplan, packets, RAM grid) |
| `src/main.js` | Timeline, captions, HUD overlays, audio sync, controls |
| `public/audio/` | One narration MP3 per line plus `manifest.json` with durations |
| `models/dell_wyse_3040_assembly.obj` | Exported mesh (+ `.mtl`) for Blender or other tools |

## Changing things

- **Script wording:** edit `src/script.json`, then regenerate the affected lines:
  `npm run narration -- d8 d9`. Timing follows the new audio automatically.
- **A shot:** edit that line's entry in `src/scenes.js`.
- **The model:** edit `src/model.js`, then `npm run export-obj` to refresh the OBJ.

Narration uses the ElevenLabs API (`ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID`).
`npm run narration` only generates lines that have no audio yet; add `--force` to redo all.

## Model accuracy

The outer chassis (`101.6 × 101.6 × 27.94 mm`), PCB, heatsink, SoC package and die,
RAM, eMMC and M.2 2230 footprint use the dimensions from the blueprint. Port positions
along the front and rear edges, the small board components and the silicon floorplan
are plausible layouts, not measurements.
