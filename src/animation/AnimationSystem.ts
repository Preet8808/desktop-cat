import * as PIXI from "pixi.js";
import { AnimationName } from "../core/types";
import { ANIMATION_NAMES } from "./SpriteGenerator";

interface LoadedAnimation {
  textures: PIXI.Texture[];
  fps: number;
  loop: boolean;
}

const FPS_BY_ANIMATION: Partial<Record<AnimationName, number>> = {
  idle: 6,
  sleep: 6,
  sit: 6,
  walkLeft: 8,
  walkRight: 8,
  walkUp: 8,
  walkDown: 8,
  runLeft: 12,
  runRight: 12,
  jump: 10,
  fall: 10,
  stretch: 8,
  lookAround: 8,
  happy: 8,
  angry: 8,
  eat: 5,
  play: 10,
  petted: 5,
};

const NON_LOOPING: Set<AnimationName> = new Set([
  "jump",
  "fall",
  "stretch",
  "lookAround",
  "happy",
  "angry",
  "eat",
  "petted",
]);

const ATLAS_FRAME_SIZE = 32;
const ATLAS_COLUMNS = 11;

interface AtlasAnimation {
  row: number;
  frames: number;
}

const ATLAS_ANIMATIONS: Record<AnimationName, AtlasAnimation> = {
  // The first atlas row contains turn poses, not an idle loop. Keep the cat
  // front-facing while stationary so it does not appear to rotate in place.
  idle: { row: 0, frames: 1 },
  walkLeft: { row: 7, frames: 8 },
  walkRight: { row: 6, frames: 8 },
  walkUp: { row: 8, frames: 8 },
  walkDown: { row: 9, frames: 8 },
  runLeft: { row: 7, frames: 8 },
  runRight: { row: 6, frames: 8 },
  jump: { row: 10, frames: 6 },
  fall: { row: 11, frames: 6 },
  sit: { row: 1, frames: 1 },
  // The rest row contains directional variants; do not cycle them while resting.
  sleep: { row: 12, frames: 1 },
  stretch: { row: 18, frames: 2 },
  lookAround: { row: 2, frames: 8 },
  happy: { row: 32, frames: 4 },
  angry: { row: 41, frames: 2 },
  eat: { row: 20, frames: 8 },
  play: { row: 39, frames: 10 },
  petted: { row: 43, frames: 8 },
};

/**
 * Wraps a PIXI.AnimatedSprite and manages loading / switching between named
 * animations. The animation names remain independent from the packed artwork
 * so behavior code does not need to know about atlas coordinates.
 */
export class AnimationSystem {
  readonly sprite: PIXI.AnimatedSprite;
  private animations = new Map<AnimationName, LoadedAnimation>();
  private current: AnimationName = "idle";
  private onCompleteCallback: (() => void) | null = null;

  private constructor(sprite: PIXI.AnimatedSprite, animations: Map<AnimationName, LoadedAnimation>) {
    this.sprite = sprite;
    this.animations = animations;
  }

  static async create(): Promise<AnimationSystem> {
    const animations = new Map<AnimationName, LoadedAnimation>();
    const atlas = (await PIXI.Assets.load("/sprites/cat.png")) as PIXI.Texture;
    const baseTexture = atlas.baseTexture;

    for (const name of ANIMATION_NAMES) {
      const { row, frames: frameCount } = ATLAS_ANIMATIONS[name];
      const textures: PIXI.Texture[] = [];
      for (let i = 0; i < frameCount; i++) {
        textures.push(
          new PIXI.Texture(
            baseTexture,
            new PIXI.Rectangle(i * ATLAS_FRAME_SIZE, row * ATLAS_FRAME_SIZE, ATLAS_FRAME_SIZE, ATLAS_FRAME_SIZE)
          )
        );
      }
      animations.set(name, {
        textures,
        fps: FPS_BY_ANIMATION[name] ?? 6,
        loop: !NON_LOOPING.has(name),
      });
    }

    const idle = animations.get("idle")!;
    const sprite = new PIXI.AnimatedSprite(idle.textures);
    sprite.tint = 0xffffff;
    sprite.anchor.set(0.5, 0.75);
    sprite.animationSpeed = idle.fps / 60;
    sprite.play();

    return new AnimationSystem(sprite, animations);
  }

  get currentAnimation(): AnimationName {
    return this.current;
  }

  /** Switch animation. No-op if already playing it (unless force=true, e.g. to restart a reaction). */
  play(name: AnimationName, force = false): void {
    if (name === this.current && !force) return;
    const anim = this.animations.get(name);
    if (!anim) return;

    this.onCompleteCallback = null;
    this.current = name;
    this.sprite.textures = anim.textures;
    this.sprite.animationSpeed = anim.fps / 60;
    this.sprite.loop = anim.loop;
    this.sprite.gotoAndPlay(0);

    this.sprite.onComplete = anim.loop
      ? undefined
      : () => {
          this.onCompleteCallback?.();
          this.onCompleteCallback = null;
        };
  }

  /** Play a one-shot animation, then invoke callback (used to chain back to idle/walk). */
  playOnce(name: AnimationName, onComplete: () => void): void {
    this.play(name, true);
    this.onCompleteCallback = onComplete;
  }
}
