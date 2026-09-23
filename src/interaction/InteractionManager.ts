import * as PIXI from "pixi.js";
import { invoke } from "@tauri-apps/api/tauri";

export interface InteractionCallbacks {
  onClick: () => void;
  onDoubleClick: () => void;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => void;
  onDragEnd: () => void;
  onRightClick: (screenX: number, screenY: number) => void;
}

const DOUBLE_CLICK_MS = 320;

/**
 * Wires pointer events on the cat sprite itself. The rest of the transparent
 * window stays click-through (set via the Rust `set_click_through` command)
 * so the user can interact with whatever is beneath the cat; only hovering
 * the sprite re-enables the window's hit testing.
 */
export class InteractionManager {
  private sprite: PIXI.Sprite;
  private callbacks: InteractionCallbacks;
  private hasTauri: boolean;

  private dragging = false;
  private lastClickTime = 0;
  private dragOffset = { x: 0, y: 0 };
  private overlayInteractive = false;
  private isHovered = false;
  private dragStarted = false;
  private currentClickThrough: boolean | null = null;

  constructor(sprite: PIXI.Sprite, callbacks: InteractionCallbacks) {
    this.sprite = sprite;
    this.callbacks = callbacks;
    this.hasTauri = typeof (window as any).__TAURI__ !== "undefined";

    sprite.eventMode = "static";
    sprite.cursor = "pointer";

    sprite.on("pointerover", () => {
      this.isHovered = true;
      this.setClickThrough(false);
    });
    sprite.on("pointerout", () => {
      this.isHovered = false;
      if (!this.dragging && !this.overlayInteractive) this.setClickThrough(true);
    });

    let rightDownPos: { x: number; y: number } | null = null;
    let lastRightClickTime = 0;
    const triggerRightClick = (x: number, y: number) => {
      const now = performance.now();
      if (now - lastRightClickTime < 300) return;
      lastRightClickTime = now;
      this.callbacks.onRightClick(x, y);
    };

    sprite.on("pointerdown", (e: PIXI.FederatedPointerEvent) => this.handlePointerDown(e));

    sprite.on("rightdown", (e: PIXI.FederatedPointerEvent) => {
      e.preventDefault?.();
      rightDownPos = { x: e.global.x, y: e.global.y };
    });

    sprite.on("rightup", (e: PIXI.FederatedPointerEvent) => {
      e.preventDefault?.();
      if (rightDownPos) {
        const dx = Math.abs(e.global.x - rightDownPos.x);
        const dy = Math.abs(e.global.y - rightDownPos.y);
        rightDownPos = null;
        if (dx < 25 && dy < 25) {
          triggerRightClick(e.global.x, e.global.y);
        }
      }
    });

    sprite.on("rightclick", (e: PIXI.FederatedPointerEvent) => {
      e.preventDefault?.();
      triggerRightClick(e.global.x, e.global.y);
    });

    // Native window contextmenu listener ensures right-click always triggers
    // even if Pixi's synthetic event is delayed or consumed
    window.addEventListener("contextmenu", (e) => {
      const bounds = this.sprite.getBounds();
      if (
        e.clientX >= bounds.x - 12 &&
        e.clientX <= bounds.x + bounds.width + 12 &&
        e.clientY >= bounds.y - 12 &&
        e.clientY <= bounds.y + bounds.height + 12
      ) {
        e.preventDefault();
        triggerRightClick(e.clientX, e.clientY);
      }
    });

    window.addEventListener("pointermove", (e) => this.handlePointerMove(e));
    window.addEventListener("pointerup", () => this.handlePointerUp());
  }

  checkCursorHover(x: number, y: number): void {
    if (this.overlayInteractive || this.dragging) return;
    const bounds = this.sprite.getBounds();
    const isHovering = (
      x >= bounds.x - 12 &&
      x <= bounds.x + bounds.width + 12 &&
      y >= bounds.y - 12 &&
      y <= bounds.y + bounds.height + 12
    );

    if (isHovering !== this.isHovered) {
      this.isHovered = isHovering;
      this.setClickThrough(!isHovering);
    }
  }

  setOverlayInteractive(interactive: boolean): void {
    this.overlayInteractive = interactive;
    if (interactive) {
      this.setClickThrough(false);
    } else if (!this.isHovered && !this.dragging) {
      this.setClickThrough(true);
    }
  }

  private setClickThrough(ignore: boolean): void {
    if (!this.hasTauri) return;
    if (this.currentClickThrough === ignore) return;
    this.currentClickThrough = ignore;
    void invoke("set_click_through", { ignore }).catch(() => {});
  }

  private handlePointerDown(e: PIXI.FederatedPointerEvent): void {
    if (e.button === 2) return; // right click handled separately

    const now = performance.now();
    const isDoubleClick = now - this.lastClickTime < DOUBLE_CLICK_MS;
    this.lastClickTime = now;

    if (isDoubleClick) {
      this.callbacks.onDoubleClick();
      return;
    }

    this.callbacks.onClick();
    this.dragging = true;
    this.dragOffset = { x: e.global.x - this.sprite.x, y: e.global.y - this.sprite.y };

    // A short delay before we treat this as a "drag" avoids every click
    // being reported as a drag; onDragStart only fires once movement begins.
    this.dragStarted = false;
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.dragging) return;
    if (!this.dragStarted) {
      this.dragStarted = true;
      this.callbacks.onDragStart();
    }
    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;
    this.callbacks.onDragMove(x, y);
  }

  private handlePointerUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.dragStarted) {
      this.dragStarted = false;
      this.callbacks.onDragEnd();
    }
    if (!this.isHovered && !this.overlayInteractive) {
      this.setClickThrough(true);
    }
  }
}
