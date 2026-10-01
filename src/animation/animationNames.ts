import { AnimationName } from "../core/types";

/**
 * Single source of truth for the animation names supported by the sprite
 * atlas. The atlas itself is a static asset (public/sprites/cat.png) and the
 * frame layout lives in AnimationSystem.
 *
 * Note: this file used to contain a full procedural sprite generator
 * (generateSpriteSheet) that drew every frame on a canvas at runtime. Nothing
 * called it once the static atlas was introduced, so it was removed along with
 * the ~300 lines of drawing helpers it depended on.
 */
export const ANIMATION_NAMES = [
  "idle",
  "walkLeft",
  "walkRight",
  "walkUp",
  "walkDown",
  "runLeft",
  "runRight",
  "sit",
  "sleep",
  "stretch",
  "jump",
  "fall",
  "lookAround",
  "happy",
  "angry",
  "eat",
  "petted",
] as const satisfies readonly AnimationName[];

export type AnimationNameList = typeof ANIMATION_NAMES;