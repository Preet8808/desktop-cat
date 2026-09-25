import { PetStatsData } from "../core/types";

export class StatsPanel {
  private el: HTMLElement;
  private onVisibilityChange: (visible: boolean) => void;
  private openedAt = 0;
  private built = false;
  private titleEl: HTMLElement | null = null;
  private fillEls: Record<string, HTMLElement> = {};

  constructor(elementId = "stats-panel", onVisibilityChange: (visible: boolean) => void = () => {}) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`StatsPanel: element #${elementId} not found`);
    this.el = el;
    this.onVisibilityChange = onVisibilityChange;
    const handleOutsideDismiss = (e: MouseEvent | PointerEvent) => {
      if (performance.now() - this.openedAt < 150) return;
      if (!this.el.contains(e.target as Node) && !this.el.classList.contains("hidden")) {
        this.hide();
      }
    };

    document.addEventListener("pointerdown", handleOutsideDismiss);
    document.addEventListener("click", handleOutsideDismiss);
    document.addEventListener("contextmenu", handleOutsideDismiss);

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.el.classList.contains("hidden")) {
        this.hide();
      }
    });
  }

  open(x: number, y: number, name: string, stats: PetStatsData): void {
    this.openedAt = performance.now();
    if (!this.built) {
      this.buildDOM();
    }
    this.updateValues(name, stats);

    const width = 200;
    const left = Math.max(4, Math.min(window.innerWidth - width - 4, x));
    const top = Math.max(4, Math.min(window.innerHeight - 160, y));
    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
    this.el.classList.remove("hidden");
    this.onVisibilityChange(true);
  }

  update(name: string, stats: PetStatsData): void {
    if (!this.el.classList.contains("hidden")) {
      if (!this.built) {
        this.buildDOM();
      }
      this.updateValues(name, stats);
    }
  }

  hide(): void {
    if (this.el.classList.contains("hidden")) return;
    this.el.classList.add("hidden");
    this.onVisibilityChange(false);
  }

  private buildDOM(): void {
    this.el.innerHTML = "";

    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.padding = "4px 6px 8px";
    this.titleEl = title;
    this.el.appendChild(title);

    const keys: { key: keyof PetStatsData; label: string }[] = [
      { key: "hunger", label: "Hunger" },
      { key: "happiness", label: "Happiness" },
      { key: "energy", label: "Energy" },
      { key: "affection", label: "Affection" },
    ];

    for (const { key, label } of keys) {
      const row = document.createElement("div");
      row.className = "stat-row";

      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      labelEl.style.minWidth = "90px";

      const bar = document.createElement("div");
      bar.className = "bar";

      const fill = document.createElement("div");
      fill.className = "bar-fill";
      this.fillEls[key] = fill;

      bar.appendChild(fill);
      row.appendChild(labelEl);
      row.appendChild(bar);
      this.el.appendChild(row);
    }

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.marginTop = "8px";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
    });
    this.el.appendChild(closeBtn);

    this.built = true;
  }

  private updateValues(name: string, stats: PetStatsData): void {
    if (this.titleEl) {
      this.titleEl.textContent = `${name}'s Stats`;
    }
    const keys: (keyof PetStatsData)[] = ["hunger", "happiness", "energy", "affection"];
    for (const key of keys) {
      const fill = this.fillEls[key];
      if (fill) {
        fill.style.width = `${Math.round(stats[key])}%`;
      }
    }
  }
}
