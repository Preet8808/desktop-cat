import { AnimationName, Personality } from "../core/types";
import { Movement } from "../physics/Movement";
import { PetStats } from "../core/PetStats";
import { Activity, PERSONALITY_WEIGHTS, RANDOM_QUIRK_CHANCE, weightedPick } from "./Personality";

export type FacingDirection = "left" | "right";

/** Total time of a jump arc, in seconds. */
const JUMP_DURATION = 0.8;
/** Peak height of a jump arc, in pixels (negative = upward). */
const JUMP_HEIGHT = 90;

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
  private pointerMovedAt = 0;
  private pointerResting = false;
  private restTimeLeft = 0;
  private followAnimation: AnimationName | null = null;
  /** Rest pose shown while idling during a `follow` activity. */
  private currentRestAnimation: AnimationName = "idle";
  private jumpCooldown = 0;
  private wanderTarget: { x: number; y: number } | null = null;
  private clickBurst = 0;
  private clickBurstResetAt = 0;
  /** Self-contained jump arc state (see the "jump" case in beginActivity). */
  private jumpActive = false;
  private jumpElapsed = 0;
  private jumpOffsetPx = 0;
  private paused = false; // true while user is dragging or a menu is open
  private reactionTimeLeft = 0;

  constructor(movement: Movement, stats: PetStats, personality: Personality, callbacks: BehaviorCallbacks) {
    this.movement = movement;
    this.stats = stats;
    this.personality = personality;
    this.callbacks = callbacks;
    this.pickNewActivity();
  }

  setPersonality(p: Personality): void {
    this.personality = p;
    this.pointerResting = false;
    this.wanderTarget = null;
    // If the cat was mid-follow, end that activity so the new personality's
    // weights take effect immediately instead of after the follow timer.
    if (this.currentActivity === "follow") {
      this.currentActivity = "idle";
      this.followAnimation = null;
      this.activityTimeLeft = 0;
    }
  }

  setScreenSize(w: number, h: number, margin = 40): void {
    this.screenWidth = w;
    this.screenHeight = h;
    this.screenMargin = margin;
  }

  /** Records the cursor position. This only updates a target - it never forces
   * the cat into follow mode; `follow` is chosen by the weighted activity picker. */
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
  }

  /** True when the cursor moved recently, i.e. there is something to follow. */
  private hasFreshPointer(): boolean {
    return this.pointerTarget !== null && performance.now() - this.pointerMovedAt < 1500;
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

    // Chasing the cursor is not something a cat does at night instead of
    // sleeping - it is a reaction to the user interacting with it right now.
    // So follow is never scaled down by the time-of-day/needs biases above;
    // it is only gated on whether the cursor is actually moving.
    if (!this.hasFreshPointer()) {
      base.follow = 0;
    } else {
      const age = performance.now() - this.pointerMovedAt;
      if (age < 400) {
        // Cursor is actively moving: the cat should come running. This
        // deliberately overrides every other activity so the app feels
        // responsive, then relaxes once the cursor settles.
        base.follow = 40;
      } else {
        base.follow *= 2;
      }
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
    // Any new activity cancels an in-flight jump arc so the cat does not
    // keep drifting upward after switching activities mid-jump.
    if (activity !== "jump") {
      this.jumpActive = false;
      this.jumpElapsed = 0;
      this.jumpOffsetPx = 0;
    }
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
        // A self-contained hop: rise then fall back to the same spot. Using
        // Movement.jump() here would send the cat to the bottom of the screen,
        // because gravity always resolves against the ground plane.
        this.jumpOffsetPx = 0;
        this.jumpElapsed = 0;
        this.jumpActive = true;
        this.movement.vy = 0;
        this.movement.isGrounded = true;
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
      case "follow":
        // Follow is chosen only when the pointer is fresh, but guard anyway so
        // a stale target can't leave the cat walking toward nothing.
        if (!this.pointerTarget) {
          this.currentActivity = "idle";
          this.callbacks.onAnimationChange("idle");
          this.activityTimeLeft = 1.0;
          break;
        }
        this.wanderTarget = null;
        this.pointerResting = false;
        this.followAnimation = null;
        this.restTimeLeft = 0;
        this.activityTimeLeft = 2.0 + Math.random() * 3;
        this.callbacks.onAnimationChange("idle");
        break;
    }
  }

  private stopHorizontalMovement(): void {
    this.movement.vx = 0;
  }

  /** Main per-frame update. dt in seconds. */
  update(dt: number): void {
    if (this.paused) return;

    if (this.reactionTimeLeft > 0) {
      this.reactionTimeLeft -= dt;
      this.movement.vx = 0;
      this.movement.vy = 0;
      this.movement.isGrounded = true;
      if (this.reactionTimeLeft <= 0) {
        this.activityTimeLeft = 1.0;
        this.currentActivity = "idle";
        this.callbacks.onAnimationChange("idle");
      }
      return;
    }

    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    this.updateJumpArc(dt);

    // `follow` is a normal, time-boxed activity rather than a permanent mode,
    // so the personality's other activities still get a chance to run.
    if (this.currentActivity === "follow" && this.pointerTarget) {
      this.updatePointerFollow(dt);
      this.activityTimeLeft -= dt;
      if (this.activityTimeLeft <= 0) this.pickNewActivity();
      return;
    }

    if (this.personality === "mischievous") {
      this.updateMischievous(dt);
      return;
    }

    // Horizontal movement is handled by the kinematic integrator (easing,
    // friction) - see the targetVx setup below.
    let targetVx = 0;
    if (this.currentActivity === "walk") {
      targetVx = (this.facing === "left" ? -1 : 1) * this.movement.maxWalkSpeed;
    } else if (this.currentActivity === "run") {
      targetVx = (this.facing === "left" ? -1 : 1) * this.movement.maxRunSpeed;
    }

    this.movement.update(dt, targetVx);

    // Walk/run also steer vertically toward the wander target, otherwise the
    // ground-plane physics pins the cat to a single line near the bottom of
    // the screen and it can never roam upward. Arriving at the target (in
    // either axis) ends the activity so the cat does not hover forever.
    if ((this.currentActivity === "walk" || this.currentActivity === "run") && this.wanderTarget) {
      const dx = this.wanderTarget.x - this.movement.x;
      const dy = this.wanderTarget.y - this.movement.y;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
        this.activityTimeLeft = 0;
      } else if (Math.abs(dy) > 8) {
        const climbSpeed = Math.min(
          Math.abs(this.movement.maxWalkSpeed * 1.2),
          Math.abs(dy) * 2.5,
        );
        this.movement.y += Math.sign(dy) * climbSpeed * dt;
      }
    }

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

    this.clampToScreen();

    this.activityTimeLeft -= dt;
    if (this.activityTimeLeft <= 0 && this.movement.isGrounded) {
      this.pickNewActivity();
    }
  }

  /**
 * Advances the jump arc and offsets the sprite position. The arc is a simple
 * parabola over JUMP_DURATION that returns to the launch point, so a jump
 * works from any height on screen instead of always landing on the floor.
 */
  private updateJumpArc(dt: number): void {
    if (!this.jumpActive) {
      if (this.jumpOffsetPx !== 0) {
        this.jumpOffsetPx = 0;
      }
      return;
    }
    this.jumpElapsed += dt;
    const t = this.jumpElapsed / JUMP_DURATION;
    if (t >= 1) {
      this.jumpActive = false;
      this.jumpElapsed = 0;
      this.jumpOffsetPx = 0;
      return;
    }
    this.jumpOffsetPx = -JUMP_HEIGHT * 4 * t * (1 - t);
  }

  /** Visual vertical offset from the current jump arc (negative = airborne). */
  get jumpOffset(): number {
    return this.jumpOffsetPx;
  }

  /** Keeps the cat inside the window no matter which activity moved it. */
  private clampToScreen(): void {
    const maxX = Math.max(this.screenMargin, this.screenWidth - this.screenMargin);
    const minY = 40;
    const maxY = Math.max(minY, this.screenHeight - 40);
    this.movement.x = Math.max(this.screenMargin, Math.min(maxX, this.movement.x));
    this.movement.y = Math.max(minY, Math.min(maxY, this.movement.y));
  }

  private updatePointerFollow(dt: number): void {
    const target = this.pointerTarget!;
    const dx = target.x - this.movement.x;
    const dy = target.y - this.movement.y;
    const distance = Math.hypot(dx, dy);
    const restDistance = this.personality === "lazy" ? 42 : 4;
    // Rest only once we have actually arrived, or once the cursor has been
    // still long enough that chasing it no longer makes sense. A single
    // frame where the cursor went quiet mid-approach must not abandon the
    // walk, otherwise a fast flick leaves the cat stranded part-way.
    const cursorQuiet = performance.now() - this.pointerMovedAt > 400;
    if (distance < restDistance || (cursorQuiet && !this.hasFreshPointer())) {
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
      this.jumpActive = true;
      this.jumpElapsed = 0;
      this.jumpOffsetPx = 0;
      this.callbacks.onAnimationChange("jump", true);
    }

    let animation: AnimationName;
    if (Math.abs(dy) > Math.abs(dx)) {
      animation = dy < 0 ? "walkUp" : "walkDown";
    } else {
      this.facing = dx < 0 ? "left" : "right";
      animation = this.facing === "left" ? "walkLeft" : "walkRight";
    }
    // currentActivity stays "follow" here - it owns the activity timer and must
    // not be overwritten by the transient walk direction.
    if (this.followAnimation !== animation) {
      this.followAnimation = animation;
      this.callbacks.onAnimationChange(animation);
    }

    this.clampToScreen();
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

    this.clampToScreen();

    this.activityTimeLeft -= dt;
    if (this.activityTimeLeft <= 0 && this.movement.isGrounded) {
      this.pickNewActivity();
    }
  }

  /**
   * Picks a resting pose for the cat to hold while the cursor is idle. This is
   * only ever called from the follow path, so it must NOT touch currentActivity
   * (the follow activity owns that timer) - it records the pose separately and
   * lets isSleeping report it for energy regen.
   */
  private chooseRestAnimation(): void {
    const options: { animation: AnimationName; duration: number; once?: boolean }[] = [
      { animation: "idle", duration: 2.5 + Math.random() * 3 },
      { animation: "sit", duration: 2.5 + Math.random() * 3 },
      { animation: "sleep", duration: 5 + Math.random() * 8 },
      { animation: "stretch", duration: 1.2, once: true },
    ];
    const choice = options[Math.floor(Math.random() * options.length)];
    this.currentRestAnimation = choice.animation;
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
    if (this.currentActivity === "sleep") return true;
    // While following, the cat can hold a sleeping rest pose without the
    // follow activity itself becoming "sleep".
    return this.currentActivity === "follow" && this.currentRestAnimation === "sleep";
  }

  get isActive(): boolean {
    // Note: `follow` is deliberately excluded - chasing the cursor is walking,
    // not running, so it uses the idle energy decay rate.
    return this.currentActivity === "run" || this.currentActivity === "jump";
  }

  finishReaction(): void {
    if (this.reactionTimeLeft > 0) {
      this.reactionTimeLeft = 0;
      this.currentActivity = "idle";
      this.activityTimeLeft = 1.0;
    }
  }

  // --- Reactions triggered by user interaction (interrupt current activity) ---

  reactToClick(): void {
    const now = performance.now();
    if (now - this.clickBurstResetAt > 2000) {
      this.clickBurst = 0;
      this.clickBurstResetAt = now;
    }
    this.clickBurst++;

    this.stopForReaction();
    this.reactionTimeLeft = 0.8;
    if (this.clickBurst >= 4) {
      this.callbacks.onAnimationChange("angry", true);
    } else {
      this.callbacks.onAnimationChange("lookAround", true);
    }
  }

  reactToDoubleClick(): void {
    this.stopForReaction();
    this.reactionTimeLeft = 1.2;
    this.callbacks.onAnimationChange("happy", true);
  }

  reactToDragStart(): void {
    this.reactionTimeLeft = 0;
    this.setPaused(true);
    this.callbacks.onAnimationChange("fall", true);
  }

  reactToDragEnd(): void {
    this.setPaused(false);
    // The cat is a free-floating desktop pet, not a grounded platformer
    // character. Ground it immediately at the dropped position instead of
    // letting gravity yank it down to the bottom of the screen.
    this.movement.isGrounded = true;
    this.movement.vy = 0;
    this.clampToScreen();
    this.pickNewActivity();
  }

  reactToPet(): void {
    this.stopForReaction();
    this.reactionTimeLeft = 2.0;
    this.callbacks.onAnimationChange("petted", true);
  }

  reactToFeed(): void {
    this.stopForReaction();
    this.reactionTimeLeft = 2.2;
    this.callbacks.onAnimationChange("eat", true);
  }

  private stopForReaction(): void {
    this.currentActivity = "idle";
    this.movement.vx = 0;
    this.movement.vy = 0;
  }
}
