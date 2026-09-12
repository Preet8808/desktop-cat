import { PetStatsData } from "../core/types";

export class StatsPanel {
  private el: HTMLElement;
  private onVisibilityChange: (visible: boolean) => void;

  constructor(elementId = "stats-panel", onVisibilityChange: (visible: boolean) => void = () => {}) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`StatsPanel: element #${elementId} not found`);
    this.el = el;
    this.onVisibilityChange = onVisibilityChange;
  }

  open(x: number, y: number, name: string, stats: PetStatsData): void {
    this.render(name, stats);
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
      this.render(name, stats);
    }
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.onVisibilityChange(false);
  }

  private render(name: string, stats: PetStatsData): void {
    this.el.innerHTML = "";
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.padding = "4px 6px 8px";
    title.textContent = `${name}'s Stats`;
    this.el.appendChild(title);

    const rows: [string, number][] = [
      ["🍖 Hunger", stats.hunger],
      ["😊 Happiness", stats.happiness],
      ["⚡ Energy", stats.energy],
      ["💗 Affection", stats.affection],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "stat-row";
      const labelEl = document.createElement("span");
      labelEl.textContent = label;
      labelEl.style.minWidth = "90px";
      const bar = document.createElement("div");
      bar.className = "bar";
      const fill = document.createElement("div");
      fill.className = "bar-fill";
      fill.style.width = `${Math.round(value)}%`;
      bar.appendChild(fill);
      row.appendChild(labelEl);
      row.appendChild(bar);
      this.el.appendChild(row);
    }

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.style.marginTop = "6px";
    closeBtn.addEventListener("click", () => this.hide());
    this.el.appendChild(closeBtn);
  }
}
