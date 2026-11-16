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

## Export an MP4

```bash
npm run render -- --out out/video.mp4
```

Renders every frame in headless Chromium (1920×1080, 30 fps by default; `--fps`,
`--width`, `--height`, `--workers` to change) and mixes in the narration. Needs
`ffmpeg` on your PATH and a one-time `npx playwright install chromium`. If it runs
slower than a few frames per second, add `--headed`; on a machine with no GPU, add
`--software`. Finished 30-second chunks are kept in `out/.render`, so an
interrupted render resumes when you run the command again.

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

The exterior follows photos of the real unit: the diamond lattice over the top and
sides, the smooth front band with the power button on top, the round Dell logo and
port order on the front (headset, USB 2.0, USB 3.0), and the rear layout (DC in, two
DisplayPorts, stacked USB 2.0, Ethernet). Overall size, PCB, SoC package and die, RAM,
eMMC and M.2 2230 footprint use the blueprint dimensions. The lattice pitch, exact port
positions, small board components and the silicon floorplan are estimated, not measured.

The board follows teardown photos of both faces. The heatsink, SoC and eMMC are on the
face that points at the lid; the two RAM chips, the M.2 E-key slot and the clock battery
are on the underside you see when the base unclips. The teardown in Chapter 2 runs in
that order: base off, underside tour, two screws out, board lifted and flipped, heatsink
off. Component positions are read off the photos, so expect a millimetre or two of error.
