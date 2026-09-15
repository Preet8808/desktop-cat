import { FoodType } from "../core/types";

export interface ContextMenuActions {
  onFeed: (food: FoodType) => void;
  onPet: () => void;
  onSleep?: () => void;
  onStats?: () => void;
  onSettings?: () => void;
  onQuit?: () => void;
}

/**
 * A clean, modern popup menu opened by right-clicking the cat.
 * Displays "Feed it" and "Pat it" without any emojis.
 */
export class ContextMenu {
  private el: HTMLElement;
  private actions: ContextMenuActions;
  private onVisibilityChange: (visible: boolean) => void;
  private openedAt = 0;

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
      if (performance.now() - this.openedAt < 150) return;
      if (!this.el.contains(e.target as Node) && !this.el.classList.contains("hidden")) {
        this.hide();
      }
    });

    document.addEventListener("contextmenu", (e) => {
      if (performance.now() - this.openedAt < 150) return;
      if (!this.el.contains(e.target as Node) && !this.el.classList.contains("hidden")) {
        this.hide();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.el.classList.contains("hidden")) {
        this.hide();
      }
    });
  }

  open(x: number, y: number): void {
    this.openedAt = performance.now();
    this.render();
    const width = 160;
    const height = 110;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, x + 8));
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, y - 35));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.classList.remove("hidden");
    this.onVisibilityChange(true);
  }

  hide(): void {
    if (this.el.classList.contains("hidden")) return;
    this.el.classList.add("hidden");
    this.onVisibilityChange(false);
  }

  private render(): void {
    this.el.innerHTML = "";

    const container = document.createElement("div");
    container.className = "context-menu-container";

    // Main options: "Feed it" and "Pat it" (no emojis)
    const feedBtn = document.createElement("button");
    feedBtn.id = "btn-feed-it";
    feedBtn.className = "context-option-btn feed-btn";
    feedBtn.innerHTML = `<span class="option-text">Feed it</span>`;
    feedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
      this.actions.onFeed("fish");
    });
    container.appendChild(feedBtn);

    const patBtn = document.createElement("button");
    patBtn.id = "btn-pat-it";
    patBtn.className = "context-option-btn pat-btn";
    patBtn.innerHTML = `<span class="option-text">Pat it</span>`;
    patBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
      this.actions.onPet();
    });
    container.appendChild(patBtn);

    // Mini-tools footer: Stats, Settings, Quit (clean text, no emojis)
    if (this.actions.onSettings || this.actions.onStats || this.actions.onQuit) {
      const footer = document.createElement("div");
      footer.className = "context-mini-footer";

      if (this.actions.onStats) {
        const statsBtn = document.createElement("button");
        statsBtn.className = "mini-tool-btn";
        statsBtn.title = "View Stats";
        statsBtn.textContent = "Stats";
        statsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          this.actions.onStats?.();
        });
        footer.appendChild(statsBtn);
      }

      if (this.actions.onSettings) {
        const settingsBtn = document.createElement("button");
        settingsBtn.className = "mini-tool-btn";
        settingsBtn.title = "Settings (Shift+S)";
        settingsBtn.textContent = "Settings";
        settingsBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          this.actions.onSettings?.();
        });
        footer.appendChild(settingsBtn);
      }

      if (this.actions.onQuit) {
        const quitBtn = document.createElement("button");
        quitBtn.className = "mini-tool-btn quit-tool";
        quitBtn.title = "Quit";
        quitBtn.textContent = "Quit";
        quitBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          this.actions.onQuit?.();
        });
        footer.appendChild(quitBtn);
      }

      container.appendChild(footer);
    }

    this.el.appendChild(container);
  }
}
