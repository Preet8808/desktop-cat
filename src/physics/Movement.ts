export interface MovementConfig {
  maxWalkSpeed: number; // px/s
  maxRunSpeed: number; // px/s
  acceleration: number; // px/s^2
  friction: number; // px/s^2, applied when no target velocity
  gravity: number; // px/s^2
  jumpVelocity: number; // px/s (negative = up)
  groundY: number; // y coordinate treated as "the floor" (bottom of screen or a surface)
}

export const DEFAULT_MOVEMENT: MovementConfig = {
  maxWalkSpeed: 60,
  maxRunSpeed: 160,
  acceleration: 220,
  friction: 260,
  gravity: 900,
  jumpVelocity: -420,
  groundY: 0, // set at runtime to window height
};

/**
 * Simple 2D kinematic body: horizontal velocity eases toward a target speed
 * (acceleration/deceleration, never teleporting), vertical velocity is a
 * standard gravity + jump-impulse integrator with ground collision.
 */
export class Movement {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  isGrounded = true;
  private config: MovementConfig;

  constructor(x: number, y: number, config: MovementConfig = { ...DEFAULT_MOVEMENT }) {
    this.x = x;
    this.y = y;
    this.config = config;
  }

  setGroundY(y: number): void {
    this.config.groundY = y;
    if (this.isGrounded) this.y = y;
  }

  setConfig(partial: Partial<MovementConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /** targetVx: desired horizontal speed (signed, 0 = decelerate to a stop). */
  update(dt: number, targetVx: number): void {
    const { acceleration, friction, gravity, groundY } = this.config;

    // Horizontal: ease toward target speed rather than snapping to it.
    if (targetVx !== 0) {
      const diff = targetVx - this.vx;
      const step = Math.sign(diff) * Math.min(Math.abs(diff), acceleration * dt);
      this.vx += step;
    } else if (this.vx !== 0) {
      const step = Math.sign(this.vx) * Math.min(Math.abs(this.vx), friction * dt);
      this.vx -= step;
    }
    this.x += this.vx * dt;

    // Vertical: gravity integrator with a flat ground plane.
    if (!this.isGrounded) {
      this.vy += gravity * dt;
      this.y += this.vy * dt;
      if (this.y >= groundY) {
        this.y = groundY;
        this.vy = 0;
        this.isGrounded = true;
      }
    }
  }

  jump(): void {
    if (!this.isGrounded) return;
    this.vy = this.config.jumpVelocity;
    this.isGrounded = false;
  }

  get speed(): number {
    return Math.abs(this.vx);
  }

  get maxWalkSpeed(): number {
    return this.config.maxWalkSpeed;
  }

  get maxRunSpeed(): number {
    return this.config.maxRunSpeed;
  }
}
