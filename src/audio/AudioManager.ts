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
  private audioCtx: AudioContext | null = null;

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  private getAudioContext(): AudioContext | null {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
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
      audio.play().catch(() => {
        // External file missing or blocked -> use cute procedural synthesizer fallback
        this.synthAudio(name, volume);
      });
    } catch {
      this.synthAudio(name, volume);
    }
  }

  private synthAudio(name: SoundName, volume: number): void {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (name === "eating") {
        for (let i = 0; i < 4; i++) {
          const osc = ctx.createOscillator();
          const nibbleGain = ctx.createGain();
          osc.type = "triangle";
          const t = now + i * 0.22;
          osc.frequency.setValueAtTime(450 + (i % 2) * 80, t);
          osc.frequency.exponentialRampToValueAtTime(180, t + 0.08);
          nibbleGain.gain.setValueAtTime(volume * 0.2, t);
          nibbleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(nibbleGain);
          nibbleGain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.12);
        }
      } else if (name === "happy" || name === "purr") {
        const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const t = now + idx * 0.08;
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t);
          noteGain.gain.setValueAtTime(volume * 0.12, t);
          noteGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(noteGain);
          noteGain.connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.35);
        });
      } else if (name === "meow") {
        const osc = ctx.createOscillator();
        const meowGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(550, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
        meowGain.gain.setValueAtTime(volume * 0.2, now);
        meowGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.connect(meowGain);
        meowGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (name === "jump") {
        const osc = ctx.createOscillator();
        const jumpGain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.15);
        jumpGain.gain.setValueAtTime(volume * 0.18, now);
        jumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(jumpGain);
        jumpGain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
      }
    } catch {
      // Audio synth is best-effort
    }
  }
}
