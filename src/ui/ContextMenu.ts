import { FoodType } from "../core/types";

export interface ContextMenuActions {
  onFeed: (food: FoodType) => void;
  onPet: () => void;
  onSleep: () => void;
  onStats: () => void;
  onSettings: () => void;
  onQuit: () => void;
}

/**
 * A tiny, unobtrusive popup menu (not a full app window) opened by clicking
 * or right-clicking the cat. Renders a top-level list; Feed expands into a
 * food submenu inline rather than opening a second window.
 */
export class ContextMenu {
  private el: HTMLElement;
  private actions: ContextMenuActions;
  private showingFoodSubmenu = false;
  private onVisibilityChange: (visible: boolean) => void;

  constructor(
    actions: ContextMenuActions,
    elementId = "context-menu",
    onVisibilityChange: (visible: boolean) => void = () => {}
  ) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`ContextMenu: element #${elementId} not found`);
    this.el = el;
    this.actions = actions;
    this.onVisibilityChange = onVisibilityChange;

    document.addEventListener("click", (e) => {
      if (!this.el.contains(e.target as Node) && !this.el.classList.contains("hidden")) {
        this.hide();
      }
    });
  }

  open(x: number, y: number): void {
    this.showingFoodSubmenu = false;
    this.render();
    const width = 160;
    const left = Math.max(4, Math.min(window.innerWidth - width - 4, x));
    const top = Math.max(4, Math.min(window.innerHeight - 220, y));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.classList.remove("hidden");
    this.onVisibilityChange(true);
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.onVisibilityChange(false);
  }

  private render(): void {
    this.el.innerHTML = "";

    if (this.showingFoodSubmenu) {
      const foods: { key: FoodType; icon: string; label: string }[] = [
        { key: "fish", icon: "🐟", label: "Fish" },
        { key: "milk", icon: "🥛", label: "Milk" },
        { key: "treat", icon: "🍪", label: "Treat" },
        { key: "chicken", icon: "🍗", label: "Chicken" },
      ];
      for (const food of foods) {
        this.el.appendChild(
          this.makeButton(`${food.icon} ${food.label}`, () => {
            this.hide();
            this.actions.onFeed(food.key);
          })
        );
      }
      this.el.appendChild(
        this.makeButton("⬅ Back", () => {
          this.showingFoodSubmenu = false;
          this.render();
        })
      );
      return;
    }

    const items: [string, () => void][] = [
      ["🍽 Feed", () => {
        this.hide();
        this.showingFoodSubmenu = true;
        this.render();
        this.el.classList.remove("hidden");
        this.onVisibilityChange(true);
      }],
      ["🤚 Pet", () => {
        this.hide();
        this.actions.onPet();
      }],
      ["😴 Sleep", () => {
        this.hide();
        this.actions.onSleep();
      }],
      ["📊 Stats", () => {
        this.hide();
        this.actions.onStats();
      }],
      ["⚙️ Settings", () => {
        this.hide();
        this.actions.onSettings();
      }],
      ["✖ Quit", () => {
        this.actions.onQuit();
      }],
    ];
    for (const [label, handler] of items) {
      this.el.appendChild(this.makeButton(label, handler));
    }
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  }
}
