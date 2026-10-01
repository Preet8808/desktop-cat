import { invoke } from "@tauri-apps/api/tauri";
import { SaveData, DEFAULT_SETTINGS, DEFAULT_STATS, Personality, Settings } from "./types";

const LOCAL_STORAGE_FALLBACK_KEY = "desktop-cat-save";

/**
 * Persists pet state to disk via the Rust backend (app data dir), with a
 * localStorage fallback so the app still works when run as a plain web page
 * during frontend-only development (`npm run dev` without `tauri dev`).
 */
export class SaveManager {
  private savePath: string | null = null;
  private hasTauri: boolean;

  constructor() {
    this.hasTauri = typeof (window as any).__TAURI__ !== "undefined";
  }

  private async resolvePath(): Promise<string> {
    if (!this.savePath) {
      this.savePath = await invoke<string>("get_save_path");
    }
    return this.savePath;
  }

  async load(): Promise<SaveData> {
    let raw = "";
    try {
      if (this.hasTauri) {
        const path = await this.resolvePath();
        raw = await invoke<string>("read_save_file", { path });
      } else {
        raw = localStorage.getItem(LOCAL_STORAGE_FALLBACK_KEY) ?? "";
      }
    } catch (err) {
      console.warn("Save read failed, falling back to defaults:", err);
      raw = "";
    }

    if (!raw) {
      return this.defaultSave();
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      return this.sanitize(parsed);
    } catch (err) {
      console.warn("Save file was corrupted, resetting to defaults:", err);
      return this.defaultSave();
    }
  }

  async save(data: SaveData): Promise<void> {
    const payload = JSON.stringify(data);
    try {
      if (this.hasTauri) {
        const path = await this.resolvePath();
        await invoke("write_save_file", { path, contents: payload });
      } else {
        localStorage.setItem(LOCAL_STORAGE_FALLBACK_KEY, payload);
      }
    } catch (err) {
      console.error("Failed to persist save data:", err);
    }
  }

  private defaultSave(): SaveData {
    return {
      name: DEFAULT_SETTINGS.catName,
      personality: DEFAULT_SETTINGS.personality,
      stats: { ...DEFAULT_STATS },
      position: { x: 200, y: 400 },
      settings: { ...DEFAULT_SETTINGS },
      lastActiveTimestamp: Date.now(),
      mode: "roaming",
      bongoPosition: { x: 200, y: 300 },
    };
  }

  /** Fill in any missing/invalid fields from a partially-corrupted save. */
  private sanitize(partial: Partial<SaveData>): SaveData {
    const fallback = this.defaultSave();
    const personality = this.validPersonality(partial.personality) ? partial.personality : fallback.personality;
    const savedSettings: Partial<Settings> = partial.settings ?? {};
    const settingsPersonality = this.validPersonality(savedSettings.personality)
      ? savedSettings.personality
      : personality;
    return {
      name: typeof partial.name === "string" && partial.name.trim() ? partial.name : fallback.name,
      personality,
      stats: {
        hunger: this.numInRange(partial.stats?.hunger, fallback.stats.hunger, 0, 100),
        happiness: this.numInRange(partial.stats?.happiness, fallback.stats.happiness, 0, 100),
        energy: this.numInRange(partial.stats?.energy, fallback.stats.energy, 0, 100),
        affection: this.numInRange(partial.stats?.affection, fallback.stats.affection, 0, 100),
      },
      position: {
        x: this.numInRange(partial.position?.x, fallback.position.x, -4000, 8000),
        y: this.numInRange(partial.position?.y, fallback.position.y, -4000, 8000),
      },
      settings: {
        ...fallback.settings,
        // Validate every field individually - spreading raw savedSettings would
        // let corrupt values (NaN, wrong type) overwrite the validated fallback.
        catName: typeof savedSettings.catName === "string" && savedSettings.catName.trim()
          ? savedSettings.catName
          : fallback.settings.catName,
        catSize: this.numInRange(savedSettings.catSize, fallback.settings.catSize, 0.25, 4),
        bongoSize: this.numInRange(savedSettings.bongoSize, fallback.settings.bongoSize, 0.35, 2.5),
        movementSpeed: this.numInRange(savedSettings.movementSpeed, fallback.settings.movementSpeed, 0.25, 3),
        soundEnabled: typeof savedSettings.soundEnabled === "boolean"
          ? savedSettings.soundEnabled
          : fallback.settings.soundEnabled,
        speechEnabled: typeof savedSettings.speechEnabled === "boolean"
          ? savedSettings.speechEnabled
          : fallback.settings.speechEnabled,
        alwaysOnTop: typeof savedSettings.alwaysOnTop === "boolean"
          ? savedSettings.alwaysOnTop
          : fallback.settings.alwaysOnTop,
        startWithComputer: typeof savedSettings.startWithComputer === "boolean"
          ? savedSettings.startWithComputer
          : fallback.settings.startWithComputer,
        personality: settingsPersonality,
      },
      lastActiveTimestamp: this.numOr(partial.lastActiveTimestamp, Date.now()),
      mode: partial.mode === "bongo" ? "bongo" : "roaming",
      bongoPosition: {
        x: this.numOr(partial.bongoPosition?.x, 200),
        y: this.numOr(partial.bongoPosition?.y, 300),
      },
    };
  }

  private validPersonality(value: unknown): value is Personality {
    return value === "lazy" || value === "playful" || value === "energetic" || value === "mischievous";
  }

  private numOr(v: unknown, fallback: number): number {
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
  }

  /** Like numOr, but also constrains the result to a sane range. */
  private numInRange(v: unknown, fallback: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, this.numOr(v, fallback)));
  }
}
