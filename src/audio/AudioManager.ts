export type SoundName = "meow" | "purr" | "happy" | "eating" | "jump";

/**
 * Thin wrapper around HTMLAudioElement. No sound files ship with the
 * placeholder build (silently no-ops if a file is missing), so sound is
 * disabled by default in Settings. Drop real files into /public/sounds/
 * named exactly as in SOUND_FILES to enable them - no code changes needed.
 */
const SOUND_FILES: Record<SoundName, string> = {
  meow: "sounds/meow.mp3",
  purr: "sounds/purr.mp3",
  happy: "sounds/happy.mp3",
  eating: "sounds/eating.mp3",
  jump: "sounds/jump.mp3",
};

export class AudioManager {
  private enabled = false;
  private cache = new Map<SoundName, HTMLAudioElement>();

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  play(name: SoundName, volume = 0.6): void {
    if (!this.enabled) return;
    try {
      let audio = this.cache.get(name);
      if (!audio) {
        audio = new Audio(SOUND_FILES[name]);
        this.cache.set(name, audio);
      }
      audio.currentTime = 0;
      audio.volume = volume;
      // Missing asset files reject the play() promise; swallow quietly.
      void audio.play().catch(() => {});
    } catch {
      // No-op: audio is a nice-to-have, never block gameplay on it.
    }
  }
}
