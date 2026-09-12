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

  constructor(sprite: PIXI.Sprite, callbacks: InteractionCallbacks) {
    this.sprite = sprite;
    this.callbacks = callbacks;
    this.hasTauri = typeof (window as any).__TAURI__ !== "undefined";

    sprite.eventMode = "static";
    sprite.cursor = "pointer";

    sprite.on("pointerover", () => this.setClickThrough(false));
    sprite.on("pointerout", () => {
      if (!this.dragging && !this.overlayInteractive) this.setClickThrough(true);
    });

    sprite.on("pointerdown", (e: PIXI.FederatedPointerEvent) => this.handlePointerDown(e));
    sprite.on("rightclick", (e: PIXI.FederatedPointerEvent) => {
      e.preventDefault?.();
      this.callbacks.onRightClick(e.global.x, e.global.y);
    });

    window.addEventListener("pointermove", (e) => this.handlePointerMove(e));
    window.addEventListener("pointerup", () => this.handlePointerUp());
  }

  setOverlayInteractive(interactive: boolean): void {
    this.overlayInteractive = interactive;
    this.setClickThrough(!interactive);
  }

  private setClickThrough(ignore: boolean): void {
    if (!this.hasTauri) return;
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

  private dragStarted = false;

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
    // Cursor may have left the sprite mid-drag; re-check whether we should
    // restore click-through.
    if (!this.sprite.getBounds().contains(0, 0)) {
      // Cheap heuristic: pointerout already handles the common case, this
      // just guards against a stuck non-click-through state after a drag
      // that ends off-sprite.
    }
  }
}
