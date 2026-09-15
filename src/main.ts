import * as PIXI from "pixi.js";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";
import { AnimationSystem } from "./animation/AnimationSystem";
import { Movement } from "./physics/Movement";
import { PetStats } from "./core/PetStats";
import { SaveManager } from "./core/SaveManager";
import { BehaviorAI } from "./behavior/BehaviorAI";
import { InteractionManager } from "./interaction/InteractionManager";
import { ContextMenu } from "./ui/ContextMenu";
import { StatsPanel } from "./ui/StatsPanel";
import { SettingsWindow } from "./settings/SettingsWindow";
import { AudioManager } from "./audio/AudioManager";
import { AnimationName, FoodType, SaveData, Settings } from "./core/types";

async function main() {
  const hasTauri = typeof (window as any).__TAURI__ !== "undefined";
  let interactionManager: InteractionManager | null = null;
  const setOverlayInteractive = (interactive: boolean): void => {
    interactionManager?.setOverlayInteractive(interactive);
    if (hasTauri) {
      void invoke("set_click_through", { ignore: !interactive }).catch(() => {});
    }
  };

  // --- Load save data & compute offline progress ---
  const saveManager = new SaveManager();
  const save: SaveData = await saveManager.load();
  const elapsedSeconds = Math.max(0, (Date.now() - save.lastActiveTimestamp) / 1000);

  const stats = new PetStats(save.stats);
  stats.applyElapsedTime(elapsedSeconds);

  const settings: Settings = { ...save.settings };

  // --- PixiJS setup ---
  const canvas = document.getElementById("cat-canvas") as HTMLCanvasElement;
  const app = new PIXI.Application({
    view: canvas,
    resizeTo: window,
    backgroundAlpha: 0,
    antialias: false,
  });

  let catVisible = true;
  const setCatVisible = (visible: boolean): void => {
    catVisible = visible;
    canvas.style.visibility = visible ? "visible" : "hidden";
    if (!visible) setOverlayInteractive(false);
  };

  // Prevent browser context menu so our custom cat menu shows cleanly
  window.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  window.addEventListener("keydown", (event) => {
    if (event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCatVisible(!catVisible);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        settingsWindow.open();
      }
    }
  });

  const animationSystem = await AnimationSystem.create();
  animationSystem.sprite.scale.set(settings.catSize * 2);
  app.stage.addChild(animationSystem.sprite);

  const groundY = window.innerHeight - 80;
  const movement = new Movement(save.position.x || 200, save.position.y || groundY);
  movement.setGroundY(groundY);
  movement.setConfig({
    maxWalkSpeed: 60 * settings.movementSpeed,
    maxRunSpeed: 160 * settings.movementSpeed,
  });

  const audio = new AudioManager();
  audio.setEnabled(settings.soundEnabled);

  const behavior = new BehaviorAI(movement, stats, settings.personality, {
    onAnimationChange: (anim: AnimationName, once) => {
      if (once) {
        animationSystem.playOnce(anim, () => {
          behavior.finishReaction();
          animationSystem.play("idle");
        });
      } else {
        animationSystem.play(anim);
      }
      if (anim === "jump") audio.play("jump");
      if (anim === "eat") audio.play("eating");
      if (anim === "happy" || anim === "petted") audio.play("happy", 0.4);
    },
  });
  behavior.setScreenSize(window.innerWidth, window.innerHeight);

  window.addEventListener("resize", () => {
    behavior.setScreenSize(window.innerWidth, window.innerHeight);
    movement.setGroundY(window.innerHeight - 80);
  });

  let cursorPollInFlight = false;
  const updatePointerTarget = (x: number, y: number) => behavior.setPointerTarget(x, y);
  const pollCursor = async () => {
    if (!hasTauri || cursorPollInFlight) return;
    cursorPollInFlight = true;
    try {
      const position = await invoke<{ x: number; y: number }>("get_cursor_position");
      updatePointerTarget(position.x, position.y);
    } catch {
      // Cursor polling is unavailable while running outside the Tauri window.
    } finally {
      cursorPollInFlight = false;
    }
  };
  window.addEventListener("mousemove", (event) => {
    if (!hasTauri) updatePointerTarget(event.clientX, event.clientY);
  });
  window.setInterval(() => void pollCursor(), 40);

  // --- Interaction wiring ---
  interactionManager = new InteractionManager(animationSystem.sprite, {
    onClick: () => behavior.reactToClick(),
    onDoubleClick: () => behavior.reactToDoubleClick(),
    onDragStart: () => {
      behavior.reactToDragStart();
      if (hasTauri) void appWindow.startDragging().catch(() => {});
    },
    onDragMove: (x, y) => {
      // In-window sprite dragging fallback for non-Tauri (browser) dev mode;
      // when running under Tauri, native window dragging (above) takes over
      // and the sprite simply stays anchored while the OS window moves.
      if (!hasTauri) {
        movement.x = x;
        movement.y = y;
      }
    },
    onDragEnd: () => behavior.reactToDragEnd(),
    onRightClick: (x, y) => contextMenu.open(x, y),
  });

  // --- UI: context menu, stats panel, settings ---
  const contextMenu = new ContextMenu({
    onFeed: (food: FoodType) => {
      stats.feed();
      behavior.reactToFeed();
    },
    onPet: () => {
      stats.pet();
      behavior.reactToPet();
    },
    onSleep: () => {
      animationSystem.play("sleep");
    },
    onStats: () => {
      statsPanel.open(movement.x, movement.y, settings.catName, stats.data);
    },
    onSettings: () => {
      settingsWindow.open();
    },
    onQuit: () => {
      if (hasTauri) void appWindow.close();
      else window.close();
    },
  }, "context-menu", (visible: boolean) => {
    behavior.setPaused(visible);
    setOverlayInteractive(visible);
  });

  const statsPanel = new StatsPanel("stats-panel", setOverlayInteractive);

  const settingsWindow = new SettingsWindow(
    {
      onChange: (updated) => {
        Object.assign(settings, updated);
        animationSystem.sprite.scale.set(settings.catSize * 2);
        movement.setConfig({
          maxWalkSpeed: 60 * settings.movementSpeed,
          maxRunSpeed: 160 * settings.movementSpeed,
        });
        audio.setEnabled(settings.soundEnabled);
        behavior.setPersonality(settings.personality);
        if (hasTauri) {
          void appWindow.setAlwaysOnTop(settings.alwaysOnTop).catch(() => {});
        }
      },
      onReset: () => {
        stats.data = { hunger: 80, happiness: 80, energy: 90, affection: 50 };
        settingsWindow.hide();
      },
    },
    settings,
    "settings-window",
    setOverlayInteractive
  );

  // Tray "Settings" click emits this event (see src-tauri/src/main.rs).
  if (hasTauri) {
    const { listen } = await import("@tauri-apps/api/event");
    void listen("open-settings", () => settingsWindow.open());
  }

  // --- Main loop ---
  let lastTime = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000); // clamp to avoid huge steps after a tab/OS freeze
    lastTime = now;

    behavior.update(dt);
    stats.tick(dt, { isActive: behavior.isActive, isSleeping: behavior.isSleeping });

    animationSystem.sprite.x = movement.x;
    animationSystem.sprite.y = movement.y;

    statsPanel.update(settings.catName, stats.data);
  });

  // --- Periodic autosave + save-on-close ---
  const persist = () => {
    const data: SaveData = {
      name: settings.catName,
      personality: settings.personality,
      stats: stats.data,
      position: { x: movement.x, y: movement.y },
      settings,
      lastActiveTimestamp: Date.now(),
    };
    void saveManager.save(data);
  };

  setInterval(persist, 30_000);
  window.addEventListener("beforeunload", persist);
  if (hasTauri) {
    void appWindow.onCloseRequested(() => persist());
  }
}

main().catch((err) => {
  console.error("Fatal error starting Desktop Cat:", err);
});
