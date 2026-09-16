import * as PIXI from "pixi.js";
import { invoke } from "@tauri-apps/api/tauri";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { KEY_MAP } from "./keyMap";

export interface BongoCatCallbacks {
  onRightClick: (x: number, y: number) => void;
  onPositionChange: (x: number, y: number) => void;
  onScaleChange?: (scale: number) => void;
}

export class BongoCat {
  public container: PIXI.Container;
  private baseSprite: PIXI.Sprite;
  private keyHighlight: PIXI.Graphics;
  private pawUpSprite: PIXI.Sprite;
  private pawDownSprite: PIXI.Sprite;
  private mouseContainer: PIXI.Container;
  private mouseArmSprite: PIXI.Sprite;
  private mouseLeftSprite: PIXI.Sprite;
  private mouseRightSprite: PIXI.Sprite;

  private callbacks: BongoCatCallbacks;
  private keyReleaseTimer: number | null = null;
  private mouseLeftTimer: number | null = null;
  private mouseRightTimer: number | null = null;
  private pressedKeys = new Set<string>();
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  private hasTauri: boolean;
  private unlistenKey: UnlistenFn | null = null;
  private unlistenMouse: UnlistenFn | null = null;

  // Mouse kinematics state
  private curMouseX = 205.0;
  private curMouseY = 335.0;
  private targetMouseX = 205.0;
  private targetMouseY = 335.0;
  private animFrameId: number | null = null;

  private constructor(
    container: PIXI.Container,
    sprites: {
      base: PIXI.Sprite;
      keyHighlight: PIXI.Graphics;
      pawUp: PIXI.Sprite;
      pawDown: PIXI.Sprite;
      mouseContainer: PIXI.Container;
      mouseArm: PIXI.Sprite;
      mouseLeft: PIXI.Sprite;
      mouseRight: PIXI.Sprite;
    },
    callbacks: BongoCatCallbacks,
    initialX: number,
    initialY: number,
    initialScale = 1.0
  ) {
    this.container = container;
    this.baseSprite = sprites.base;
    this.keyHighlight = sprites.keyHighlight;
    this.pawUpSprite = sprites.pawUp;
    this.pawDownSprite = sprites.pawDown;
    this.mouseContainer = sprites.mouseContainer;
    this.mouseArmSprite = sprites.mouseArm;
    this.mouseLeftSprite = sprites.mouseLeft;
    this.mouseRightSprite = sprites.mouseRight;
    this.callbacks = callbacks;
    this.hasTauri = typeof (window as any).__TAURI__ !== "undefined";

    this.setScale(initialScale);
    this.container.x = initialX;
    this.container.y = initialY;

    this.setupInteractions();
  }

  static async create(
    callbacks: BongoCatCallbacks,
    initialX = 200,
    initialY = 300,
    initialScale = 1.0
  ): Promise<BongoCat> {
    const baseTex = await PIXI.Assets.load("/sprites/bongo/bongo_base.png");
    const pawUpTex = await PIXI.Assets.load("/sprites/bongo/paw_up.png");
    const pawDownTex = await PIXI.Assets.load("/sprites/bongo/paw_down.png");
    const mouseArmTex = await PIXI.Assets.load("/sprites/bongo/mouse_arm.png");
    const mouseLeftTex = await PIXI.Assets.load("/sprites/bongo/mouse_click_left.png");
    const mouseRightTex = await PIXI.Assets.load("/sprites/bongo/mouse_click_right.png");

    const container = new PIXI.Container();

    const baseSprite = new PIXI.Sprite(baseTex);
    const keyHighlight = new PIXI.Graphics();
    const pawUpSprite = new PIXI.Sprite(pawUpTex);
    const pawDownSprite = new PIXI.Sprite(pawDownTex);

    const mouseContainer = new PIXI.Container();
    const mouseArmSprite = new PIXI.Sprite(mouseArmTex);
    const mouseLeftSprite = new PIXI.Sprite(mouseLeftTex);
    const mouseRightSprite = new PIXI.Sprite(mouseRightTex);

    pawDownSprite.visible = false;
    mouseLeftSprite.visible = false;
    mouseRightSprite.visible = false;

    // Mouse container hierarchy: arm/paw/mouse base -> left/right click overlays
    mouseContainer.addChild(mouseArmSprite);
    mouseContainer.addChild(mouseLeftSprite);
    mouseContainer.addChild(mouseRightSprite);

    // Shoulder pivot in 870x469 coordinate space
    mouseContainer.pivot.set(268, 145);
    mouseContainer.position.set(268, 145);

    // Layer order: base -> key highlight -> moving mouse container -> paw up -> paw down
    container.addChild(baseSprite);
    container.addChild(keyHighlight);
    container.addChild(mouseContainer);
    container.addChild(pawUpSprite);
    container.addChild(pawDownSprite);

    return new BongoCat(
      container,
      {
        base: baseSprite,
        keyHighlight,
        pawUp: pawUpSprite,
        pawDown: pawDownSprite,
        mouseContainer,
        mouseArm: mouseArmSprite,
        mouseLeft: mouseLeftSprite,
        mouseRight: mouseRightSprite,
      },
      callbacks,
      initialX,
      initialY,
      initialScale
    );
  }

  public activate(): void {
    this.container.visible = true;
    if (this.hasTauri) {
      void invoke("set_bongo_active", { active: true }).catch(() => {});
      this.attachTauriListeners();
    }
    this.attachWindowFallbackListeners();
    this.startMouseLoop();
  }

  public deactivate(): void {
    this.container.visible = false;
    if (this.hasTauri) {
      void invoke("set_bongo_active", { active: false }).catch(() => {});
    }
    this.cleanupListeners();
    this.stopMouseLoop();
  }

  public getBounds(): PIXI.Rectangle {
    return this.container.getBounds();
  }

  public getPosition(): { x: number; y: number } {
    return { x: this.container.x, y: this.container.y };
  }

  public setPosition(x: number, y: number): void {
    this.container.x = x;
    this.container.y = y;
  }

  public setScale(scaleMultiplier: number): void {
    const clamped = Math.max(0.35, Math.min(2.5, scaleMultiplier));
    this.container.scale.set(0.48 * clamped);
  }

  public getScale(): number {
    return Math.round((this.container.scale.x / 0.48) * 100) / 100;
  }

  public onKeyPress(keyName: string, down: boolean): void {
    const raw = (keyName || "").toUpperCase().trim();
    const normKey =
      raw === " " || raw === "SPACE"
        ? "SPACE"
        : KEY_MAP[raw]
        ? raw
        : raw.length === 1 && raw >= "A" && raw <= "Z"
        ? raw
        : KEY_MAP[raw.replace(/^KEY_?/, "")]
        ? raw.replace(/^KEY_?/, "")
        : "SPACE";

    if (down) {
      this.pressedKeys.add(normKey);
      this.applyKeyPress(normKey);

      if (this.keyReleaseTimer) {
        window.clearTimeout(this.keyReleaseTimer);
      }
      // Auto-lift paw after 135ms if key-up is missed or held
      this.keyReleaseTimer = window.setTimeout(() => {
        this.pressedKeys.clear();
        this.pawDownSprite.visible = false;
        this.pawUpSprite.visible = true;
        this.keyHighlight.clear();
        this.keyReleaseTimer = null;
      }, 135);
    } else {
      this.pressedKeys.delete(normKey);
      if (this.pressedKeys.size > 0) {
        // Still have keys held down: shift paw to the most recent key
        const lastKey = Array.from(this.pressedKeys).pop()!;
        this.applyKeyPress(lastKey);
      } else {
        if (this.keyReleaseTimer) {
          window.clearTimeout(this.keyReleaseTimer);
          this.keyReleaseTimer = null;
        }
        this.pawDownSprite.visible = false;
        this.pawUpSprite.visible = true;
        this.keyHighlight.clear();
      }
    }
  }

  private applyKeyPress(key: string): void {
    const keyGeom = KEY_MAP[key] || KEY_MAP["SPACE"];
    if (!keyGeom) return;

    // Highlight the exact key with glowing perspective polygon
    this.keyHighlight.clear();
    this.keyHighlight.lineStyle(2.5, 0x38bdf8, 0.95);
    this.keyHighlight.beginFill(0x0284c7, 0.6);
    this.keyHighlight.drawPolygon([
      keyGeom.quad[0], keyGeom.quad[1],
      keyGeom.quad[2], keyGeom.quad[3],
      keyGeom.quad[4], keyGeom.quad[5],
      keyGeom.quad[6], keyGeom.quad[7],
    ]);
    this.keyHighlight.endFill();

    // Accurate inverse kinematics:
    // Shoulder translates organically with target key
    const targetX = keyGeom.center[0];
    const targetY = keyGeom.center[1];
    const shoulderX = 592.0 + (targetX - 522.0) * 0.40;
    const shoulderY = 258.0 + (targetY - 342.0) * 0.35;

    const dx = targetX - shoulderX;
    const dy = targetY - shoulderY;
    const targetAngle = Math.atan2(dy, dx);

    // Rest angle (~2.265 rad / 129.8 deg) and rest arm length (~109.3 px)
    const restAngle = Math.atan2(342.0 - 258.0, 522.0 - 592.0);
    const restDist = Math.hypot(522.0 - 592.0, 342.0 - 258.0);
    const dist = Math.hypot(dx, dy);

    const rot = targetAngle - restAngle;
    const scale = Math.max(0.65, Math.min(1.45, dist / restDist));

    this.pawDownSprite.pivot.set(592, 258);
    this.pawDownSprite.position.set(shoulderX, shoulderY);
    this.pawDownSprite.rotation = rot;
    this.pawDownSprite.scale.set(scale);

    this.pawDownSprite.visible = true;
    this.pawUpSprite.visible = false;
  }

  public onMouseClick(button: "left" | "right", down: boolean): void {
    if (button === "left") {
      if (this.mouseLeftTimer) window.clearTimeout(this.mouseLeftTimer);
      if (down) {
        this.mouseLeftSprite.visible = true;
        this.mouseLeftTimer = window.setTimeout(() => {
          this.mouseLeftSprite.visible = false;
          this.mouseLeftTimer = null;
        }, 130);
      } else {
        // Keep visible for at least 60ms so fast clicks are perceptible
        this.mouseLeftTimer = window.setTimeout(() => {
          this.mouseLeftSprite.visible = false;
          this.mouseLeftTimer = null;
        }, 60);
      }
    } else if (button === "right") {
      if (this.mouseRightTimer) window.clearTimeout(this.mouseRightTimer);
      if (down) {
        this.mouseRightSprite.visible = true;
        this.mouseRightTimer = window.setTimeout(() => {
          this.mouseRightSprite.visible = false;
          this.mouseRightTimer = null;
        }, 130);
      } else {
        this.mouseRightTimer = window.setTimeout(() => {
          this.mouseRightSprite.visible = false;
          this.mouseRightTimer = null;
        }, 60);
      }
    }
  }

  public setCursorPosition(screenX: number, screenY: number): void {
    const sw = window.screen?.width || window.innerWidth || 1920;
    const sh = window.screen?.height || window.innerHeight || 1080;
    const u = Math.max(0, Math.min(1, screenX / sw));
    const v = Math.max(0, Math.min(1, screenY / sh));
    const nu = u - 0.5;
    const nv = v - 0.5;

    // Gentle, natural slide range across the mousepad:
    // Left-right moves along the perspective axis of the mousepad (~±18px)
    // Forward-back moves along the depth axis (~±12px)
    this.targetMouseX = 205.0 + nu * 36.0 - nv * 8.0;
    this.targetMouseY = 335.0 + nu * 8.0 + nv * 24.0;
  }

  private updateMouseTransform(): void {
    const dx = this.targetMouseX - this.curMouseX;
    const dy = this.targetMouseY - this.curMouseY;

    if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) {
      // Smooth natural easing
      this.curMouseX += dx * 0.22;
      this.curMouseY += dy * 0.22;

      // Small organic shoulder translation following arm motion
      const shoulderX = 268.0 + (this.curMouseX - 205.0) * 0.15;
      const shoulderY = 145.0 + (this.curMouseY - 335.0) * 0.12;

      const vx = this.curMouseX - shoulderX;
      const vy = this.curMouseY - shoulderY;

      const dist = Math.hypot(vx, vy);
      const angle = Math.atan2(vy, vx);

      const restDist = 200.1724;
      const restAngle = 1.94364;

      // Damped rotation so mouse stays upright and natural
      const rot = (angle - restAngle) * 0.50;
      const scaleY = 1.0 + (dist / restDist - 1.0) * 0.50;
      const scaleX = 1.0;

      this.mouseContainer.pivot.set(268, 145);
      this.mouseContainer.position.set(shoulderX, shoulderY);
      this.mouseContainer.rotation = rot;
      this.mouseContainer.scale.set(scaleX, scaleY);
    }
  }

  private startMouseLoop(): void {
    if (this.animFrameId) return;
    const loop = () => {
      this.updateMouseTransform();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopMouseLoop(): void {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private setupInteractions(): void {
    this.container.eventMode = "static";
    this.container.cursor = "grab";

    let lastRightClickTime = 0;
    const triggerRightClick = (screenX: number, screenY: number) => {
      const now = performance.now();
      if (now - lastRightClickTime < 300) return;
      lastRightClickTime = now;
      this.callbacks.onRightClick(screenX, screenY);
    };

    this.container.on("pointerdown", (e: PIXI.FederatedPointerEvent) => {
      if (e.button === 2) return; // handled by right click
      this.dragging = true;
      this.container.cursor = "grabbing";
      this.dragOffset = {
        x: e.global.x - this.container.x,
        y: e.global.y - this.container.y,
      };
    });

    this.container.on("rightclick", (e: PIXI.FederatedPointerEvent) => {
      e.preventDefault?.();
      triggerRightClick(e.global.x, e.global.y);
    });

    this.container.on("rightup", (e: PIXI.FederatedPointerEvent) => {
      e.preventDefault?.();
      triggerRightClick(e.global.x, e.global.y);
    });

    window.addEventListener("pointermove", (e) => {
      if (!this.dragging) return;
      const bounds = this.getBounds();
      const currentWidth = bounds.width;
      const currentHeight = bounds.height;
      const nx = Math.max(0, Math.min(window.innerWidth - currentWidth, e.clientX - this.dragOffset.x));
      const ny = Math.max(0, Math.min(window.innerHeight - currentHeight, e.clientY - this.dragOffset.y));
      this.container.x = nx;
      this.container.y = ny;
      this.callbacks.onPositionChange(nx, ny);
    });

    window.addEventListener("pointerup", () => {
      if (this.dragging) {
        this.dragging = false;
        this.container.cursor = "grab";
      }
    });

    // Scroll wheel on Bongo Cat directly adjusts size smoothly
    window.addEventListener(
      "wheel",
      (e) => {
        if (!this.container.visible) return;
        const bounds = this.getBounds();
        if (
          e.clientX >= bounds.x &&
          e.clientX <= bounds.x + bounds.width &&
          e.clientY >= bounds.y &&
          e.clientY <= bounds.y + bounds.height
        ) {
          e.preventDefault();
          const step = e.deltaY < 0 ? 0.05 : -0.05;
          const current = this.getScale();
          const next = Math.max(0.35, Math.min(2.2, Math.round((current + step) * 20) / 20));
          this.setScale(next);
          this.callbacks.onScaleChange?.(next);
        }
      },
      { passive: false }
    );

    // Native contextmenu fallback
    window.addEventListener("contextmenu", (e) => {
      if (!this.container.visible) return;
      const bounds = this.getBounds();
      if (
        e.clientX >= bounds.x &&
        e.clientX <= bounds.x + bounds.width &&
        e.clientY >= bounds.y &&
        e.clientY <= bounds.y + bounds.height
      ) {
        e.preventDefault();
        triggerRightClick(e.clientX, e.clientY);
      }
    });
  }

  private attachTauriListeners(): void {
    this.cleanupListeners();
    listen<[string, boolean]>("bongo-key-event", (event) => {
      if (!this.container.visible) return;
      const [keyName, isDown] = event.payload;
      this.onKeyPress(keyName, isDown);
    }).then((unlisten) => {
      this.unlistenKey = unlisten;
    }).catch(() => {});

    listen<[string, boolean]>("bongo-mouse-event", (event) => {
      if (!this.container.visible) return;
      const [btn, down] = event.payload;
      if (btn === "left" || btn === "right") {
        this.onMouseClick(btn, down);
      }
    }).then((unlisten) => {
      this.unlistenMouse = unlisten;
    }).catch(() => {});
  }

  private attachWindowFallbackListeners(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("mousedown", this.handleMouseDown);
    window.addEventListener("mouseup", this.handleMouseUp);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (!this.container.visible || this.hasTauri) return;
    this.onKeyPress(e.key, true);
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (!this.container.visible || this.hasTauri) return;
    this.onKeyPress(e.key, false);
  };

  private handleMouseDown = (e: MouseEvent): void => {
    if (!this.container.visible || this.hasTauri) return;
    if (e.button === 0) this.onMouseClick("left", true);
    else if (e.button === 2) this.onMouseClick("right", true);
  };

  private handleMouseUp = (e: MouseEvent): void => {
    if (!this.container.visible || this.hasTauri) return;
    if (e.button === 0) this.onMouseClick("left", false);
    else if (e.button === 2) this.onMouseClick("right", false);
  };

  private cleanupListeners(): void {
    if (this.keyReleaseTimer) {
      window.clearTimeout(this.keyReleaseTimer);
      this.keyReleaseTimer = null;
    }
    if (this.mouseLeftTimer) {
      window.clearTimeout(this.mouseLeftTimer);
      this.mouseLeftTimer = null;
    }
    if (this.mouseRightTimer) {
      window.clearTimeout(this.mouseRightTimer);
      this.mouseRightTimer = null;
    }
    this.pressedKeys.clear();
    if (this.unlistenKey) {
      this.unlistenKey();
      this.unlistenKey = null;
    }
    if (this.unlistenMouse) {
      this.unlistenMouse();
      this.unlistenMouse = null;
    }
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("mousedown", this.handleMouseDown);
    window.removeEventListener("mouseup", this.handleMouseUp);
  }
}
