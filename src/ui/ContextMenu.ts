import { FoodType, AppMode } from "../core/types";

export interface ContextMenuActions {
  onFeed: (food: FoodType) => void;
  onPet: () => void;
  onSleep?: () => void;
  onStats?: () => void;
  onSettings?: () => void;
  onToggleMode?: () => void;
  onCycleBongoSize?: () => void;
  getBongoSizeLabel?: () => string;
  onQuit?: () => void;
}

/**
 * A clean, modern popup menu opened by right-clicking the cat.
 * Displays actions without any emojis, including switching into Bongo Cat mode.
 */
export class ContextMenu {
  private el: HTMLElement;
  private actions: ContextMenuActions;
  private onVisibilityChange: (visible: boolean) => void;
  private openedAt = 0;
  private currentMode: AppMode = "roaming";

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

  setMode(mode: AppMode): void {
    this.currentMode = mode;
  }

  open(x: number, y: number): void {
    this.openedAt = performance.now();
    this.render();
    const width = 170;
    const height = this.currentMode === "roaming" ? 150 : 130;
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

    if (this.currentMode === "roaming") {
      // Main options in roaming mode
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

      if (this.actions.onToggleMode) {
        const modeBtn = document.createElement("button");
        modeBtn.id = "btn-bongo-mode";
        modeBtn.className = "context-option-btn bongo-btn";
        modeBtn.innerHTML = `<span class="option-text">Bongo Cat Mode</span>`;
        modeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          this.actions.onToggleMode?.();
        });
        container.appendChild(modeBtn);
      }
    } else {
      // Bongo Cat mode: option to switch back to roaming Desktop Pet
      if (this.actions.onToggleMode) {
        const modeBtn = document.createElement("button");
        modeBtn.id = "btn-roaming-mode";
        modeBtn.className = "context-option-btn bongo-btn";
        modeBtn.innerHTML = `<span class="option-text">Desktop Pet Mode</span>`;
        modeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.hide();
          this.actions.onToggleMode?.();
        });
        container.appendChild(modeBtn);
      }

      // Quick size cycler
      if (this.actions.onCycleBongoSize) {
        const sizeBtn = document.createElement("button");
        sizeBtn.id = "btn-bongo-size";
        sizeBtn.className = "context-option-btn size-btn";
        const label = this.actions.getBongoSizeLabel ? this.actions.getBongoSizeLabel() : "Normal (100%)";
        sizeBtn.innerHTML = `<span class="option-text">Size: ${label}</span>`;
        sizeBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          this.actions.onCycleBongoSize?.();
          this.render();
        });
        container.appendChild(sizeBtn);
      }
    }

    // Mini-tools footer: Stats, Settings, Quit (clean text, no emojis)
    if (this.actions.onSettings || this.actions.onStats || this.actions.onQuit) {
      const footer = document.createElement("div");
      footer.className = "context-mini-footer";

      if (this.actions.onStats && this.currentMode === "roaming") {
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

