import { PetStatsData, DEFAULT_STATS } from "./types";

/**
 * Owns the four core pet statistics and how they evolve over time.
 * All rates are expressed per real-world second so that offline elapsed
 * time (see applyElapsedTime) can be simulated cheaply without a loop.
 */
export class PetStats {
  data: PetStatsData;

  // Passive per-second drift while the app is running.
  private static readonly HUNGER_DECAY = 100 / (60 * 60 * 4); // empty over ~4h
  private static readonly HAPPINESS_DECAY = 100 / (60 * 60 * 6);
  private static readonly ENERGY_DECAY_IDLE = 100 / (60 * 60 * 8);
  private static readonly ENERGY_DECAY_ACTIVE = 100 / (60 * 45); // draining while running/playing
  private static readonly ENERGY_REGEN_SLEEP = 100 / (60 * 20); // refills over ~20 min sleeping
  private static readonly AFFECTION_DECAY = 100 / (60 * 60 * 24); // very slow

  constructor(initial: PetStatsData = { ...DEFAULT_STATS }) {
    this.data = { ...initial };
  }

  private clamp(v: number): number {
    return Math.max(0, Math.min(100, v));
  }

  /** Called every animation-loop tick with the elapsed seconds and current activity. */
  tick(dtSeconds: number, opts: { isActive: boolean; isSleeping: boolean }): void {
    this.data.hunger = this.clamp(this.data.hunger - PetStats.HUNGER_DECAY * dtSeconds);
    this.data.affection = this.clamp(this.data.affection - PetStats.AFFECTION_DECAY * dtSeconds);

    if (opts.isSleeping) {
      this.data.energy = this.clamp(this.data.energy + PetStats.ENERGY_REGEN_SLEEP * dtSeconds);
      // Happiness drifts down slowly while asleep (nothing new is happening).
      this.data.happiness = this.clamp(this.data.happiness - PetStats.HAPPINESS_DECAY * 0.3 * dtSeconds);
    } else {
      this.data.happiness = this.clamp(this.data.happiness - PetStats.HAPPINESS_DECAY * dtSeconds);
      const decay = opts.isActive ? PetStats.ENERGY_DECAY_ACTIVE : PetStats.ENERGY_DECAY_IDLE;
      this.data.energy = this.clamp(this.data.energy - decay * dtSeconds);
    }

    // Low hunger drags happiness down faster - a neglected cat gets grumpy.
    if (this.data.hunger < 20) {
      this.data.happiness = this.clamp(this.data.happiness - 0.02 * dtSeconds);
    }
  }

  /** Fast-forward stat decay for time elapsed while the app was closed. */
  applyElapsedTime(elapsedSeconds: number): void {
    // Cap so a multi-week gap doesn't require simulating an absurd loop -
    // stats simply bottom/top out, which is the correct end behavior anyway.
    const capped = Math.min(elapsedSeconds, 60 * 60 * 24 * 3);
    this.tick(capped, { isActive: false, isSleeping: false });
  }

  feed(amount = 30): void {
    this.data.hunger = this.clamp(this.data.hunger + amount);
    this.data.happiness = this.clamp(this.data.happiness + amount * 0.15);
  }

  pet(amount = 10): void {
    this.data.affection = this.clamp(this.data.affection + amount);
    this.data.happiness = this.clamp(this.data.happiness + amount * 0.5);
  }

  play(amount = 15): void {
    this.data.happiness = this.clamp(this.data.happiness + amount);
    this.data.energy = this.clamp(this.data.energy - amount * 0.6);
    this.data.affection = this.clamp(this.data.affection + amount * 0.2);
  }

  isHungry(): boolean {
    return this.data.hunger < 30;
  }

  isTired(): boolean {
    return this.data.energy < 25;
  }

  isUnhappy(): boolean {
    return this.data.happiness < 30;
  }
}
