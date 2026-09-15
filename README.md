# Desktop Cat 🐱

A cute animated 2D cat that lives on your desktop — transparent, borderless,
always-on-top, click-through where there's no cat, with autonomous behavior,
a personality system, and persistent pet stats (hunger, happiness, energy,
affection).

Built with **Tauri (Rust) + TypeScript + PixiJS**.

---

## 📥 Download Desktop Cat for Windows

You can download the Windows executable directly to run Desktop Cat on your PC:

1. Go to the [**Releases**](../../releases) tab of this repository.
2. Download either:
   - **Installer**: `Desktop Cat_0.1.1_x64-setup.exe` or `Desktop Cat_0.1.1_x64_en-US.msi` (Windows installer)
   - **Portable Version**: `Desktop Cat.exe` (Standalone portable executable, no install required — just double click and run!)
3. Run the application and enjoy your new desktop companion!

## Features & Interactions

- **Right-Click Menu**: Right-click on the cat to open the context menu with two primary actions:
  - **Feed it**: Gives the cat food! Plays the full 8-frame eating animation with a bowl, crumbs, and munching sound effects. Restores hunger and boosts affection.
  - **Pat it**: Pets the cat! Plays the 8-frame head-patting animation with gentle petting, purring, floating hearts, and sparkles. Boosts affection and happiness.
  - **Uninterrupted Animations**: A dedicated reaction lock ensures eating and petting animations play completely without being canceled by cursor movements.
- **Hotkeys & Controls**:
  - **Left-Click**: Cat looks around or reacts curiously.
  - **Double-Click**: Cat jumps for joy!
  - **Drag**: Pick up and reposition the cat anywhere on your desktop.
  - `Shift + S`: Open Settings (personality, size, speed, sounds).
  - `Shift + N`: Hide/Show the cat.
  - **System Tray**: Access Show, Hide, Settings, and Quit options from the taskbar tray.

---

## Project structure

```
desktop-cat/
├── src-tauri/                  Rust backend (window management, tray, save I/O)
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json         Transparent/frameless/always-on-top window config
├── src/                        Frontend (TypeScript)
│   ├── main.ts                 Wires everything together; the app's entry point
│   ├── core/
│   │   ├── types.ts            Shared types (Settings, SaveData, PetStatsData…)
│   │   ├── PetStats.ts         Hunger/happiness/energy/affection over time
│   │   └── SaveManager.ts      Load/save via Tauri fs (localStorage fallback)
│   ├── animation/
│   │   ├── SpriteGenerator.ts  Procedural placeholder sprite sheets (canvas)
│   │   └── AnimationSystem.ts  PixiJS AnimatedSprite wrapper, animation switching
│   ├── physics/
│   │   └── Movement.ts         Acceleration/friction + gravity/jump integrator
│   ├── behavior/
│   │   ├── Personality.ts      Per-personality activity weights
│   │   ├── BehaviorAI.ts       Autonomous state machine (the "AI")
│   ├── interaction/
│   │   └── InteractionManager.ts  Click / double-click / drag / right-click
│   ├── ui/
│   │   ├── ContextMenu.ts      Feed / Pet / Sleep / Stats / Settings / Quit
│   │   └── StatsPanel.ts
│   ├── settings/
│   │   └── SettingsWindow.ts
│   ├── audio/
│   │   └── AudioManager.ts
│   └── style.css
├── public/sounds/               Drop sound files here (see Audio below)
├── index.html
├── vite.config.ts
└── package.json
```

Nothing is a monolith: window/OS concerns live in Rust, and each frontend
concern (state, animation, physics, AI, interaction, UI, audio) is its own
module with a narrow interface, so you can change one without touching the
others.

## Requirements

- Node.js 18+
- Rust (stable) + Cargo — https://www.rust-lang.org/tools/install
- Platform build tools for Tauri: see https://tauri.app/v1/guides/getting-started/prerequisites
  (on Windows: MSVC Build Tools + WebView2; on macOS: Xcode Command Line Tools;
  on Linux: `webkit2gtk`, `libayatana-appindicator3`, etc.)

## Setup

```bash
npm install
```

## Development

Run the full desktop app (transparent window, always-on-top, tray icon, native drag):

```bash
npm run tauri:dev
```

This starts the Vite dev server and opens the Tauri window pointed at it, with
hot reload for the TypeScript/CSS.

You can also run just the frontend in a normal browser tab for quick UI
iteration (`npm run dev`) — the app detects the absence of `window.__TAURI__`
and falls back to in-page dragging and `localStorage` for saves, so it still
runs, just without real desktop transparency/click-through/always-on-top.

## Building an installer/executable

```bash
npm run tauri:build
```

Produces a native installer/bundle under `src-tauri/target/release/bundle/`
(`.msi`/`.exe` on Windows, `.app`/`.dmg` on macOS, `.deb`/`.AppImage` on Linux).

### App icons

The config references `src-tauri/icons/*` which aren't included in this
scaffold. Generate them from a single source image with:

```bash
npx tauri icon path/to/source-icon.png
```

## How the transparent, click-through window works

- `tauri.conf.json` creates one window covering the primary monitor:
  `transparent: true`, `decorations: false`, `alwaysOnTop: true`,
  `skipTaskbar: true`.
- On startup (`src-tauri/src/main.rs`), the window is resized to the primary
  monitor and immediately set fully click-through
  (`set_ignore_cursor_events(true)`), so mouse events pass to whatever is
  underneath.
- `InteractionManager` listens for `pointerover`/`pointerout` on the cat
  sprite itself and calls the `set_click_through` Tauri command to flip that
  flag off only while the cursor is actually over the cat — everywhere else
  on the transparent canvas remains click-through.
- Dragging the cat calls Tauri's native `startDragging()` on pointerdown, so
  the OS handles the drag exactly like a native window move.

## Sprite artwork

The app uses `public/sprites/cat.png`, a 352x1696 pixel-art atlas from the
attached 16x16 cat pack. It has an 11-column grid of 32x32 cells; each row is
one animation sequence. `AnimationSystem.ts` maps the app's animation names to
the pack's labeled rows and crops those cells into PixiJS textures at startup.
The source Aseprite files are suitable for creating additional variants, while
the exported PNG is the format used by the app.

To add another variant, export it with the same 11-column, 32px-cell layout,
place it under `public/sprites/`, and update the atlas path and row mapping in
`AnimationSystem.ts`. Behavior, movement, and UI code only call named
animations, so they do not need to change.

## Adding a new animation

1. Add the name to the `AnimationName` union in `src/core/types.ts`.
2. Add a row and frame count for it in `ATLAS_ANIMATIONS` in
  `AnimationSystem.ts`.
3. Optionally add an entry to `FPS_BY_ANIMATION` / `NON_LOOPING` in
   `AnimationSystem.ts`.
4. Call `behavior`'s `onAnimationChange` callback (or trigger it from
   `BehaviorAI`) with the new name wherever it should play.

## Adding a new behavior/activity

1. Add the activity name to the `Activity` type in `behavior/Personality.ts`
   and give it a weight per personality in `PERSONALITY_WEIGHTS`.
2. Handle it in `BehaviorAI.beginActivity()` — set the animation, movement
  target.
3. That's it — the weighted random picker in `pickNewActivity()` will start
   selecting it automatically, biased by personality, current stats, and time
   of day.

## Adding a new cat / multiple pets

`main.ts` currently constructs one `AnimationSystem` + `Movement` +
`BehaviorAI` + save slot. To support more than one cat, wrap that
construction in a small `Pet` class keyed by an id, keep a
`Map<string, Pet>`, and give `SaveManager` a save-file-per-id (e.g.
`pet-save-<id>.json`, requested from a modified `get_save_path` Rust command
that takes an id argument).

## Audio

Sound is **off by default** because no sound files ship with this scaffold.
Drop MP3s into `public/sounds/` named exactly as in `AudioManager.ts`
(`meow.mp3`, `purr.mp3`, `happy.mp3`, `eating.mp3`, `jump.mp3`) and enable
"Sound" in Settings — no code changes required. Missing files fail silently.

## Performance notes

- The whole app runs off a single PixiJS ticker; there are no additional
  `setInterval` polling loops for animation or physics.
- `Movement`, `PetStats`, and `BehaviorAI` are cheap, allocation-free per
  frame (no per-tick object creation) so idle CPU stays low.
- Sprite textures are generated once at startup and reused for the life of
  the app — animations only ever swap which pre-built texture array plays.
- Autosave runs every 30s on a plain `setInterval`, plus once on window close.

## Persisted data

Saved (via Tauri's fs API to the OS app-data directory, e.g.
`%APPDATA%/desktop-cat/pet-save.json` on Windows or
`~/Library/Application Support/com.desktopcat.app/` on macOS):
cat name, personality, all four stats, last screen position, all settings,
and a last-active timestamp used to fast-forward stat decay after the app
was closed. A missing or corrupted save file falls back to sensible
defaults rather than crashing.
