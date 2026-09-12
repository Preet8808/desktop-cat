import { AnimationName, Personality } from "../core/types";
import { Movement } from "../physics/Movement";
import { PetStats } from "../core/PetStats";
import { Activity, PERSONALITY_WEIGHTS, RANDOM_QUIRK_CHANCE, weightedPick } from "./Personality";

export type FacingDirection = "left" | "right";

interface BehaviorCallbacks {
  onAnimationChange: (anim: AnimationName, once?: boolean) => void;
}

/**
 * Decides what the cat does moment to moment: picks an "activity" weighted
 * by personality, runs it via Movement + AnimationSystem callbacks, then
 * picks the next one. External interaction (click/drag/feed/pet) can
 * interrupt at any time via the public react* methods.
 */
export class BehaviorAI {
  private movement: Movement;
  private stats: PetStats;
  private callbacks: BehaviorCallbacks;
  private personality: Personality;

  private facing: FacingDirection = "right";
  private activityTimeLeft = 0;
  private currentActivity: Activity = "idle";
  private screenWidth = 800;
  private screenHeight = 600;
  private screenMargin = 40;
  private pointerTarget: { x: number; y: number } | null = null;
  private pointerMode = false;
  private pointerMovedAt = 0;
  private pointerResting = false;
  private restTimeLeft = 0;
  private followAnimation: AnimationName | null = null;
  private jumpCooldown = 0;
  private wanderTarget: { x: number; y: number } | null = null;
  private clickBurst = 0;
  private clickBurstResetAt = 0;
  private paused = false; // true while user is dragging or a menu is open

  constructor(movement: Movement, stats: PetStats, personality: Personality, callbacks: BehaviorCallbacks) {
    this.movement = movement;
    this.stats = stats;
    this.personality = personality;
    this.callbacks = callbacks;
    this.pickNewActivity();
  }

  setPersonality(p: Personality): void {
    this.personality = p;
    this.pointerMode = p !== "mischievous" && this.pointerTarget !== null;
    this.pointerResting = false;
    this.wanderTarget = null;
  }

  setScreenSize(w: number, h: number, margin = 40): void {
    this.screenWidth = w;
    this.screenHeight = h;
    this.screenMargin = margin;
  }

  setPointerTarget(x: number, y: number): void {
    const targetX = Math.max(this.screenMargin, Math.min(this.screenWidth - this.screenMargin, x));
    const targetY = Math.max(40, Math.min(this.screenHeight - 40, y));
    if (
      !this.pointerTarget ||
      Math.abs(this.pointerTarget.x - targetX) > 1 ||
      Math.abs(this.pointerTarget.y - targetY) > 1
    ) {
      this.pointerMovedAt = performance.now();
    }
    this.pointerTarget = { x: targetX, y: targetY };
    this.pointerMode = this.personality !== "mischievous";
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.movement.vx = 0;
    }
  }

  private isNight(): boolean {
    const hour = new Date().getHours();
    return hour >= 22 || hour < 7;
  }

  private isDaytimeActive(): boolean {
    const hour = new Date().getHours();
    return hour >= 8 && hour < 20;
  }

  private biasedWeights(): Record<Activity, number> {
    const base = { ...PERSONALITY_WEIGHTS[this.personality] };

    // Needs-driven bias: a tired cat sleeps more, a stir-crazy cat plays more.
    if (this.stats.isTired()) {
      base.sleep *= 4;
      base.run *= 0.2;
      base.jump *= 0.2;
    }
    if (this.stats.isUnhappy()) {
      base.lookAround *= 1.5;
    }
    if (this.stats.isHungry()) {
      base.idle *= 1.5;
      base.sit *= 1.3;
    }

    // Time-of-day bias.
    if (this.isNight()) {
      base.sleep *= 3;
      base.sit *= 1.5;
      base.run *= 0.3;
      base.jump *= 0.4;
    } else if (this.isDaytimeActive()) {
      base.walk *= 1.4;
      base.run *= 1.2;
    }

    return base;
  }

  private pickNewActivity(): void {
    // Occasional personality quirk overrides the normal weighted choice.
    if (Math.random() < RANDOM_QUIRK_CHANCE[this.personality]) {
      this.currentActivity = weightedPick({ jump: 1, lookAround: 1, stretch: 1, run: 1 } as Record<Activity, number>);
    } else {
      this.currentActivity = weightedPick(this.biasedWeights());
    }
    this.activityTimeLeft = 1.5 + Math.random() * 4;
    this.beginActivity(this.currentActivity);
  }

  private beginActivity(activity: Activity): void {
    switch (activity) {
      case "idle":
        this.stopHorizontalMovement();
        this.callbacks.onAnimationChange("idle");
        break;
      case "walk":
        this.facing = Math.random() < 0.5 ? "left" : "right";
        this.chooseWanderTarget();
        this.callbacks.onAnimationChange(this.facing === "left" ? "walkLeft" : "walkRight");
        break;
      case "run":
        this.facing = Math.random() < 0.5 ? "left" : "right";
        this.chooseWanderTarget();
        this.callbacks.onAnimationChange(this.facing === "left" ? "runLeft" : "runRight");
        break;
      case "sit":
        this.stopHorizontalMovement();
        this.callbacks.onAnimationChange("sit");
        break;
      case "sleep":
        this.stopHorizontalMovement();
        this.callbacks.onAnimationChange("sleep");
        this.activityTimeLeft = 8 + Math.random() * 20;
        break;
      case "jump":
        this.movement.jump();
        this.callbacks.onAnimationChange("jump", true);
        this.activityTimeLeft = 0.8;
        break;
      case "lookAround":
        this.stopHorizontalMovement();
        this.callbacks.onAnimationChange("lookAround");
        break;
      case "stretch":
        this.stopHorizontalMovement();
        this.callbacks.onAnimationChange("stretch", true);
        this.activityTimeLeft = 1.2;
        break;
    }
  }

  private stopHorizontalMovement(): void {
    this.movement.vx = 0;
  }

  /** Main per-frame update. dt in seconds. */
  update(dt: number): void {
    if (this.paused) return;
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    if (this.pointerMode && this.pointerTarget) {
      this.updatePointerFollow(dt);
      return;
    }

    if (this.personality === "mischievous") {
      this.updateMischievous(dt);
      return;
    }

    let targetVx = 0;
    if (this.currentActivity === "walk") {
      targetVx = (this.facing === "left" ? -1 : 1) * this.movement.maxWalkSpeed;
    } else if (this.currentActivity === "run") {
      targetVx = (this.facing === "left" ? -1 : 1) * this.movement.maxRunSpeed;
    }

    this.movement.update(dt, targetVx);

    // Bounce off screen edges by flipping facing + animation.
    if (this.movement.x < this.screenMargin && this.facing === "left") {
      this.facing = "right";
      this.movement.vx = Math.abs(this.movement.vx);
      this.reapplyDirectionalAnimation();
    } else if (this.movement.x > this.screenWidth - this.screenMargin && this.facing === "right") {
      this.facing = "left";
      this.movement.vx = -Math.abs(this.movement.vx);
      this.reapplyDirectionalAnimation();
    }

    this.activityTimeLeft -= dt;
    if (this.activityTimeLeft <= 0 && this.movement.isGrounded) {
      this.pickNewActivity();
    }
  }

  private updatePointerFollow(dt: number): void {
    const target = this.pointerTarget!;
    const dx = target.x - this.movement.x;
    const dy = target.y - this.movement.y;
    const distance = Math.hypot(dx, dy);
    const pointerIsMoving = performance.now() - this.pointerMovedAt < 180;

    const restDistance = this.personality === "lazy" ? 42 : 4;
    if (!pointerIsMoving || distance < restDistance) {
      this.movement.vx = 0;
      this.movement.vy = 0;
      this.movement.isGrounded = true;
      this.restTimeLeft -= dt;
      this.followAnimation = null;
      if (!this.pointerResting || this.restTimeLeft <= 0) {
        this.pointerResting = true;
        this.chooseRestAnimation();
      }
      return;
    }

    this.pointerResting = false;
    const followMultiplier = this.personality === "lazy" ? 1.1 : this.personality === "energetic" ? 4.5 : 3;
    const minimumSpeed = this.personality === "lazy" ? 70 : this.personality === "energetic" ? 260 : 180;
    const step = Math.min(distance, Math.max(minimumSpeed, this.movement.maxWalkSpeed * followMultiplier) * dt);
    this.movement.x += (dx / distance) * step;
    this.movement.y += (dy / distance) * step;
    this.movement.vx = 0;
    this.movement.vy = 0;
    this.movement.isGrounded = true;

    if (this.personality === "energetic" && distance < 90 && this.jumpCooldown <= 0) {
      this.jumpCooldown = 1.4;
      this.followAnimation = null;
      this.callbacks.onAnimationChange("jump", true);
    }

    let animation: AnimationName;
    if (Math.abs(dy) > Math.abs(dx)) {
      animation = dy < 0 ? "walkUp" : "walkDown";
    } else {
      this.facing = dx < 0 ? "left" : "right";
      animation = this.facing === "left" ? "walkLeft" : "walkRight";
    }
    if (this.currentActivity !== "walk" || this.followAnimation !== animation) {
      this.currentActivity = "walk";
      this.followAnimation = animation;
      this.callbacks.onAnimationChange(animation);
    }
  }

  private chooseWanderTarget(): void {
    this.wanderTarget = {
      x: this.screenMargin + Math.random() * Math.max(1, this.screenWidth - this.screenMargin * 2),
      y: 40 + Math.random() * Math.max(1, this.screenHeight - 80),
    };
  }

  private updateMischievous(dt: number): void {
    if (this.currentActivity === "walk" || this.currentActivity === "run") {
      if (!this.wanderTarget) this.chooseWanderTarget();
      const target = this.wanderTarget!;
      const dx = target.x - this.movement.x;
      const dy = target.y - this.movement.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 8) {
        this.activityTimeLeft = 0;
      } else {
        const speed = this.currentActivity === "run" ? this.movement.maxRunSpeed : this.movement.maxWalkSpeed;
        const step = Math.min(distance, speed * dt);
        this.movement.x += (dx / distance) * step;
        this.movement.y += (dy / distance) * step;
        this.movement.isGrounded = true;
        if (Math.abs(dx) > Math.abs(dy)) {
          this.facing = dx < 0 ? "left" : "right";
          this.callbacks.onAnimationChange(this.facing === "left" ? "walkLeft" : "walkRight");
        } else {
          this.callbacks.onAnimationChange(dy < 0 ? "walkUp" : "walkDown");
        }
      }
    } else {
      this.movement.update(dt, 0);
    }

    this.keepMischievousOnScreen();

    this.activityTimeLeft -= dt;
    if (this.activityTimeLeft <= 0 && this.movement.isGrounded) {
      this.pickNewActivity();
    }
  }

  private keepMischievousOnScreen(): void {
    const horizontalLimit = Math.max(this.screenMargin, this.screenWidth - this.screenMargin);
    const verticalLimit = Math.max(40, this.screenHeight - 40);
    this.movement.x = Math.max(this.screenMargin, Math.min(horizontalLimit, this.movement.x));
    this.movement.y = Math.max(40, Math.min(verticalLimit, this.movement.y));
  }

  private chooseRestAnimation(): void {
    const options: { animation: AnimationName; duration: number; once?: boolean }[] = [
      { animation: "idle", duration: 2.5 + Math.random() * 3 },
      { animation: "sit", duration: 2.5 + Math.random() * 3 },
      { animation: "sleep", duration: 5 + Math.random() * 8 },
      { animation: "stretch", duration: 1.2, once: true },
    ];
    const choice = options[Math.floor(Math.random() * options.length)];
    this.currentActivity = choice.animation === "sleep" ? "sleep" : choice.animation === "stretch" ? "stretch" : "sit";
    this.restTimeLeft = choice.duration;
    if (choice.once) {
      this.callbacks.onAnimationChange(choice.animation, true);
    } else {
      this.callbacks.onAnimationChange(choice.animation);
    }
  }

  private reapplyDirectionalAnimation(): void {
    if (this.currentActivity === "walk") {
      this.callbacks.onAnimationChange(this.facing === "left" ? "walkLeft" : "walkRight", true);
    } else if (this.currentActivity === "run") {
      this.callbacks.onAnimationChange(this.facing === "left" ? "runLeft" : "runRight", true);
    }
  }

  get isSleeping(): boolean {
    return this.currentActivity === "sleep";
  }

  get isActive(): boolean {
    return this.currentActivity === "run" || this.currentActivity === "jump";
  }

  // --- Reactions triggered by user interaction (interrupt current activity) ---

  reactToClick(): void {
    const now = performance.now();
    if (now - this.clickBurstResetAt > 2000) {
      this.clickBurst = 0;
      this.clickBurstResetAt = now;
    }
    this.clickBurst++;

    if (this.clickBurst >= 4) {
      this.callbacks.onAnimationChange("angry", true);
    } else {
      this.callbacks.onAnimationChange("lookAround", true);
    }
    this.stopForReaction();
    this.activityTimeLeft = 1.0;
  }

  reactToDoubleClick(): void {
    this.callbacks.onAnimationChange("happy", true);
    this.stopForReaction();
    this.activityTimeLeft = 1.5;
  }

  reactToDragStart(): void {
    this.setPaused(true);
    this.callbacks.onAnimationChange("fall", true);
  }

  reactToDragEnd(): void {
    this.setPaused(false);
    this.movement.isGrounded = false; // let gravity settle it onto the ground plane
    this.pickNewActivity();
  }

  reactToPet(): void {
    this.callbacks.onAnimationChange("petted", true);
    this.stopForReaction();
    this.activityTimeLeft = 1.5;
  }

  reactToFeed(): void {
    this.callbacks.onAnimationChange("eat", true);
    this.stopForReaction();
    this.activityTimeLeft = 1.5;
  }

  private stopForReaction(): void {
    this.currentActivity = "idle";
    this.movement.vx = 0;
  }
}
