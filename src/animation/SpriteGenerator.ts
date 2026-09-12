import { AnimationName } from "../core/types";

/**
 * Draws a simple, cute, frame-by-frame placeholder cat using canvas 2D
 * primitives and returns it as a PixiJS-ready sprite sheet (one row per
 * animation, N frames per row). This exists purely so the project runs and
 * looks charming with zero external assets. Replace with real sprite sheets
 * by swapping AnimationSystem's texture source - see README "Replacing
 * sprites".
 */

const FRAME_SIZE = 64;
const BODY_COLOR = "#f4a259";
const BODY_SHADE = "#d98a3d";
const BELLY_COLOR = "#fff3e0";
const EYE_COLOR = "#2b2b2b";

export interface FrameSpec {
  frames: number;
  draw: (ctx: CanvasRenderingContext2D, frame: number, t: number) => void;
}

function baseCat(ctx: CanvasRenderingContext2D, opts: {
  bodyOffsetY?: number;
  earWiggle?: number;
  tailAngle?: number;
  eyeState?: "open" | "closed" | "happy" | "angry";
  mouthOpen?: boolean;
  squash?: number;
} = {}) {
  const { bodyOffsetY = 0, tailAngle = 0, eyeState = "open", mouthOpen = false, squash = 1 } = opts;
  const cx = FRAME_SIZE / 2;
  const cy = FRAME_SIZE / 2 + bodyOffsetY;

  ctx.save();
  ctx.translate(cx, cy);

  // Tail
  ctx.save();
  ctx.rotate(tailAngle);
  ctx.strokeStyle = BODY_SHADE;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(14, 6);
  ctx.quadraticCurveTo(28, 0, 26, -14);
  ctx.stroke();
  ctx.restore();

  // Body (squash/stretch for jump/land/idle breathing)
  ctx.save();
  ctx.scale(1, squash);
  ctx.fillStyle = BODY_COLOR;
  ctx.beginPath();
  ctx.ellipse(0, 6, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BELLY_COLOR;
  ctx.beginPath();
  ctx.ellipse(0, 10, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Head
  ctx.fillStyle = BODY_COLOR;
  ctx.beginPath();
  ctx.arc(0, -10, 13, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = BODY_COLOR;
  ctx.beginPath();
  ctx.moveTo(-11, -16);
  ctx.lineTo(-16, -28);
  ctx.lineTo(-3, -20);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(11, -16);
  ctx.lineTo(16, -28);
  ctx.lineTo(3, -20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#ffd7c2";
  ctx.beginPath();
  ctx.moveTo(-9, -17);
  ctx.lineTo(-12, -24);
  ctx.lineTo(-5, -19);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, -17);
  ctx.lineTo(12, -24);
  ctx.lineTo(5, -19);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = EYE_COLOR;
  if (eyeState === "open") {
    ctx.beginPath();
    ctx.arc(-5, -10, 2.2, 0, Math.PI * 2);
    ctx.arc(5, -10, 2.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (eyeState === "closed") {
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-7, -10);
    ctx.lineTo(-3, -10);
    ctx.moveTo(3, -10);
    ctx.lineTo(7, -10);
    ctx.stroke();
  } else if (eyeState === "happy") {
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(-5, -9, 3, Math.PI, 0);
    ctx.arc(5, -9, 3, Math.PI, 0);
    ctx.stroke();
  } else if (eyeState === "angry") {
    ctx.strokeStyle = EYE_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -13);
    ctx.lineTo(-2, -10);
    ctx.moveTo(8, -13);
    ctx.lineTo(2, -10);
    ctx.stroke();
  }

  // Nose + mouth
  ctx.fillStyle = "#e07a5f";
  ctx.beginPath();
  ctx.moveTo(-1.5, -6);
  ctx.lineTo(1.5, -6);
  ctx.lineTo(0, -4);
  ctx.closePath();
  ctx.fill();

  if (mouthOpen) {
    ctx.fillStyle = "#7a2e2e";
    ctx.beginPath();
    ctx.ellipse(0, -2, 3, 3, 0, 0, Math.PI);
    ctx.fill();
  }

  // Whiskers
  ctx.strokeStyle = "rgba(60,40,20,0.5)";
  ctx.lineWidth = 1;
  [-1, 1].forEach((side) => {
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(side * 8, -6 + i * 2);
      ctx.lineTo(side * 16, -8 + i * 3);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function legs(ctx: CanvasRenderingContext2D, phase: number, lifted = false) {
  const cx = FRAME_SIZE / 2;
  const cy = FRAME_SIZE / 2;
  ctx.fillStyle = BODY_SHADE;
  const swing = Math.sin(phase) * 4;
  [-8, 8].forEach((x, i) => {
    const dy = lifted ? -3 : 0;
    ctx.beginPath();
    ctx.ellipse(cx + x + (i === 0 ? swing : -swing), cy + 16 + dy, 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

const SPECS: Record<AnimationName, FrameSpec> = {
  idle: {
    frames: 4,
    draw: (ctx, f) => {
      const breathe = Math.sin((f / 4) * Math.PI * 2) * 0.03;
      baseCat(ctx, { squash: 1 + breathe, eyeState: "open" });
      legs(ctx, 0);
    },
  },
  walkLeft: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2;
      baseCat(ctx, { bodyOffsetY: Math.abs(Math.sin(phase)) * -2, tailAngle: Math.sin(phase) * 0.2 });
      legs(ctx, phase);
    },
  },
  walkRight: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2;
      baseCat(ctx, { bodyOffsetY: Math.abs(Math.sin(phase)) * -2, tailAngle: -Math.sin(phase) * 0.2 });
      legs(ctx, phase);
    },
  },
  walkUp: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2;
      baseCat(ctx, { bodyOffsetY: Math.abs(Math.sin(phase)) * -2, tailAngle: Math.sin(phase) * 0.2 });
      legs(ctx, phase);
    },
  },
  walkDown: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2;
      baseCat(ctx, { bodyOffsetY: Math.abs(Math.sin(phase)) * -2, tailAngle: -Math.sin(phase) * 0.2 });
      legs(ctx, phase);
    },
  },
  runLeft: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2 * 1.6;
      baseCat(ctx, { bodyOffsetY: Math.abs(Math.sin(phase)) * -4, tailAngle: Math.sin(phase) * 0.4, squash: 0.95 });
      legs(ctx, phase, true);
    },
  },
  runRight: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2 * 1.6;
      baseCat(ctx, { bodyOffsetY: Math.abs(Math.sin(phase)) * -4, tailAngle: -Math.sin(phase) * 0.4, squash: 0.95 });
      legs(ctx, phase, true);
    },
  },
  jump: {
    frames: 4,
    draw: (ctx, f) => {
      const squash = [0.8, 1.15, 1.1, 0.95][f];
      baseCat(ctx, { squash, bodyOffsetY: -f * 2, eyeState: "happy" });
      legs(ctx, 0, true);
    },
  },
  fall: {
    frames: 3,
    draw: (ctx, f) => {
      baseCat(ctx, { squash: 1.05, bodyOffsetY: f, eyeState: "open" });
      legs(ctx, 0, true);
    },
  },
  sit: {
    frames: 2,
    draw: (ctx, f) => {
      baseCat(ctx, { squash: 1.08 + f * 0.01, bodyOffsetY: 4, eyeState: "open" });
      legs(ctx, 0);
    },
  },
  sleep: {
    frames: 3,
    draw: (ctx, f) => {
      const breathe = Math.sin((f / 3) * Math.PI * 2) * 0.05;
      baseCat(ctx, { squash: 1.1 + breathe, bodyOffsetY: 8, eyeState: "closed" });
    },
  },
  stretch: {
    frames: 4,
    draw: (ctx, f) => {
      const stretch = [1, 0.85, 0.85, 1][f];
      baseCat(ctx, { squash: stretch, bodyOffsetY: f === 1 || f === 2 ? 6 : 0, eyeState: "closed" });
      legs(ctx, 0, true);
    },
  },
  lookAround: {
    frames: 4,
    draw: (ctx, f) => {
      const offsets = [-3, 0, 3, 0];
      ctx.save();
      ctx.translate(offsets[f], 0);
      baseCat(ctx, { eyeState: "open" });
      legs(ctx, 0);
      ctx.restore();
    },
  },
  happy: {
    frames: 4,
    draw: (ctx, f) => {
      baseCat(ctx, { bodyOffsetY: -Math.abs(Math.sin((f / 4) * Math.PI * 2)) * 4, eyeState: "happy", tailAngle: Math.sin(f) * 0.3 });
      legs(ctx, f, true);
    },
  },
  angry: {
    frames: 3,
    draw: (ctx, f) => {
      const shake = (f % 2 === 0 ? -1 : 1) * 1.5;
      ctx.save();
      ctx.translate(shake, 0);
      baseCat(ctx, { eyeState: "angry", squash: 0.97 });
      legs(ctx, 0);
      ctx.restore();
    },
  },
  eat: {
    frames: 4,
    draw: (ctx, f) => {
      baseCat(ctx, { bodyOffsetY: 4, mouthOpen: f % 2 === 0, eyeState: "open" });
      legs(ctx, 0);
    },
  },
  play: {
    frames: 6,
    draw: (ctx, f) => {
      const phase = (f / 6) * Math.PI * 2;
      baseCat(ctx, { bodyOffsetY: -Math.abs(Math.sin(phase)) * 6, eyeState: "happy", tailAngle: Math.sin(phase) * 0.5 });
      legs(ctx, phase, true);
    },
  },
  petted: {
    frames: 3,
    draw: (ctx, f) => {
      const squish = [1, 0.9, 1][f];
      baseCat(ctx, { squash: squish, eyeState: "happy", bodyOffsetY: 3 });
      legs(ctx, 0);
    },
  },
};

export const ANIMATION_NAMES = Object.keys(SPECS) as AnimationName[];

/** Renders every animation as its own canvas strip (frames laid out horizontally). */
export function generateSpriteSheet(name: AnimationName): { canvas: HTMLCanvasElement; frameCount: number; frameSize: number } {
  const spec = SPECS[name];
  const canvas = document.createElement("canvas");
  canvas.width = FRAME_SIZE * spec.frames;
  canvas.height = FRAME_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;

  for (let f = 0; f < spec.frames; f++) {
    ctx.save();
    ctx.translate(f * FRAME_SIZE, 0);
    spec.draw(ctx, f, f / spec.frames);
    ctx.restore();
  }

  return { canvas, frameCount: spec.frames, frameSize: FRAME_SIZE };
}
