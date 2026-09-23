import * as PIXI from "pixi.js";
import { invoke } from "@tauri-apps/api/tauri";
import { appWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
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
import { BongoCat } from "./bongo/BongoCat";
import { AnimationName, AppMode, FoodType, SaveData, Settings } from "./core/types";

async function main() {
  const hasTauri = typeof (window as any).__TAURI__ !== "undefined";
  let interactionManager: InteractionManager | null = null;
  let currentOverlayInteractive: boolean | null = null;
  const setOverlayInteractive = (interactive: boolean): void => {
    if (currentOverlayInteractive === interactive) return;
    currentOverlayInteractive = interactive;
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
  let currentMode: AppMode = save.mode || "roaming";
  let bongoPos = save.bongoPosition || {
    x: Math.max(50, window.innerWidth - 450),
    y: Math.max(50, window.innerHeight - 250),
  };

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

  // --- Bongo Cat setup ---
  let contextMenu!: ContextMenu;

  const bongoCat = await BongoCat.create(
    {
      onRightClick: (x, y) => contextMenu.open(x, y),
      onPositionChange: (x, y) => {
        bongoPos = { x, y };
        persist();
      },
      onScaleChange: (scale) => {
        settings.bongoSize = scale;
        settingsWindow.setValues(settings);
        persist();
      },
    },
    bongoPos.x,
    bongoPos.y,
    settings.bongoSize || 1.0
  );
  app.stage.addChild(bongoCat.container);

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

  const checkHover = (cursorX: number, cursorY: number) => {
    if (currentMode === "bongo") {
      const bounds = bongoCat.getBounds();
      const isHovered =
        cursorX >= bounds.x &&
        cursorX <= bounds.x + bounds.width &&
        cursorY >= bounds.y &&
        cursorY <= bounds.y + bounds.height;
      setOverlayInteractive(isHovered);
    } else {
      interactionManager?.checkCursorHover(cursorX, cursorY);
    }
  };

  let cursorPollInFlight = false;
  const updatePointerTarget = (x: number, y: number) => behavior.setPointerTarget(x, y);
  const pollCursor = async () => {
    if (!hasTauri || cursorPollInFlight) return;
    cursorPollInFlight = true;
    try {
      const position = await invoke<{ x: number; y: number }>("get_cursor_position");
      if (currentMode === "roaming") {
        updatePointerTarget(position.x, position.y);
      } else if (currentMode === "bongo") {
        bongoCat.setCursorPosition(position.x, position.y);
      }
      checkHover(position.x, position.y);
    } catch {
      // Cursor polling is unavailable while running outside the Tauri window.
    } finally {
      cursorPollInFlight = false;
    }
  };
  window.addEventListener("mousemove", (event) => {
    if (!hasTauri) {
      if (currentMode === "roaming") {
        updatePointerTarget(event.clientX, event.clientY);
      } else if (currentMode === "bongo") {
        bongoCat.setCursorPosition(event.clientX, event.clientY);
      }
      checkHover(event.clientX, event.clientY);
    }
  });
  window.setInterval(() => void pollCursor(), 10);

  // --- Interaction wiring ---
  interactionManager = new InteractionManager(animationSystem.sprite, {
    onClick: () => behavior.reactToClick(),
    onDoubleClick: () => behavior.reactToDoubleClick(),
    onDragStart: () => {
      behavior.reactToDragStart();
      if (hasTauri) void appWindow.startDragging().catch(() => {});
    },
    onDragMove: (x, y) => {
      if (!hasTauri) {
        movement.x = x;
        movement.y = y;
      }
    },
    onDragEnd: () => behavior.reactToDragEnd(),
    onRightClick: (x, y) => contextMenu.open(x, y),
  });

  // --- Mode manager ---
  const setAppMode = (mode: AppMode): void => {
    currentMode = mode;
    contextMenu.setMode(mode);
    if (mode === "bongo") {
      behavior.setPaused(true);
      animationSystem.sprite.visible = false;
      bongoCat.activate();
    } else {
      bongoCat.deactivate();
      animationSystem.sprite.visible = true;
      behavior.setPaused(false);
    }
  };

  // --- UI: context menu, stats panel, settings ---
  contextMenu = new ContextMenu({
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
    onToggleMode: () => {
      const nextMode = currentMode === "roaming" ? "bongo" : "roaming";
      setAppMode(nextMode);
      persist();
    },
    onCycleBongoSize: () => {
      const presets = [0.65, 1.0, 1.35, 0.45];
      const cur = settings.bongoSize || 1.0;
      let next = presets[0];
      for (let i = 0; i < presets.length; i++) {
        if (Math.abs(cur - presets[i]) < 0.1) {
          next = presets[(i + 1) % presets.length];
          break;
        }
      }
      settings.bongoSize = next;
      bongoCat.setScale(next);
      settingsWindow.setValues(settings);
      persist();
    },
    getBongoSizeLabel: () => {
      const s = settings.bongoSize || 1.0;
      if (s <= 0.5) return "Tiny (45%)";
      if (s <= 0.8) return "Small (65%)";
      if (s <= 1.15) return "Normal (100%)";
      return "Large (135%)";
    },
    onQuit: () => {
      if (hasTauri) void appWindow.close();
      else window.close();
    },
  }, "context-menu", (visible: boolean) => {
    behavior.setPaused(visible);
    setOverlayInteractive(visible);
  });

  // Apply loaded mode
  setAppMode(currentMode);

  const statsPanel = new StatsPanel("stats-panel", setOverlayInteractive);

  const settingsWindow = new SettingsWindow(
    {
      onChange: (updated) => {
        Object.assign(settings, updated);
        animationSystem.sprite.scale.set(settings.catSize * 2);
        bongoCat.setScale(settings.bongoSize || 1.0);
        movement.setConfig({
          maxWalkSpeed: 60 * settings.movementSpeed,
          maxRunSpeed: 160 * settings.movementSpeed,
        });
        audio.setEnabled(settings.soundEnabled);
        behavior.setPersonality(settings.personality);
        if (hasTauri) {
          void appWindow.setAlwaysOnTop(settings.alwaysOnTop).catch(() => {});
        }
        persist();
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
    void listen("open-settings", () => settingsWindow.open());
  }

  // --- Main loop ---
  let lastTime = performance.now();
  app.ticker.add(() => {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTime) / 1000); // clamp to avoid huge steps after a tab/OS freeze
    lastTime = now;

    if (currentMode === "roaming") {
      behavior.update(dt);
      stats.tick(dt, { isActive: behavior.isActive, isSleeping: behavior.isSleeping });
      animationSystem.sprite.x = movement.x;
      animationSystem.sprite.y = movement.y;
    }

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
      mode: currentMode,
      bongoPosition: bongoPos,
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
