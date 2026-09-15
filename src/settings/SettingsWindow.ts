import { Personality, Settings } from "../core/types";

export interface SettingsActions {
  onChange: (settings: Settings) => void;
  onReset: () => void;
}

export class SettingsWindow {
  private el: HTMLElement;
  private actions: SettingsActions;
  private current: Settings;
  private onVisibilityChange: (visible: boolean) => void;

  constructor(
    actions: SettingsActions,
    initial: Settings,
    elementId = "settings-window",
    onVisibilityChange: (visible: boolean) => void = () => {}
  ) {
    const el = document.getElementById(elementId);
    if (!el) throw new Error(`SettingsWindow: element #${elementId} not found`);
    this.el = el;
    this.actions = actions;
    this.current = { ...initial };
    this.onVisibilityChange = onVisibilityChange;
  }

  open(): void {
    this.render();
    this.el.style.left = `${Math.round(window.innerWidth / 2 - 140)}px`;
    this.el.style.top = `${Math.round(window.innerHeight / 2 - 160)}px`;
    this.el.classList.remove("hidden");
    this.onVisibilityChange(true);
  }

  hide(): void {
    this.el.classList.add("hidden");
    this.onVisibilityChange(false);
  }

  setValues(settings: Settings): void {
    this.current = { ...settings };
    if (!this.el.classList.contains("hidden")) this.render();
  }

  private update(patch: Partial<Settings>): void {
    this.current = { ...this.current, ...patch };
    this.actions.onChange(this.current);
  }

  private render(): void {
    this.el.innerHTML = "";
    const title = document.createElement("div");
    title.style.fontWeight = "700";
    title.style.padding = "4px 6px 8px";
    title.textContent = "Settings";
    this.el.appendChild(title);

    // Name
    this.el.appendChild(
      this.row("Name", () => {
        const input = document.createElement("input");
        input.type = "text";
        input.value = this.current.catName;
        input.maxLength = 20;
        input.addEventListener("change", () => this.update({ catName: input.value || "Kitty" }));
        return input;
      })
    );

    // Size
    this.el.appendChild(
      this.row("Size", () => {
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0.5";
        input.max = "2";
        input.step = "0.1";
        input.value = String(this.current.catSize);
        input.addEventListener("input", () => this.update({ catSize: parseFloat(input.value) }));
        return input;
      })
    );

    // Speed
    this.el.appendChild(
      this.row("Speed", () => {
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0.5";
        input.max = "2";
        input.step = "0.1";
        input.value = String(this.current.movementSpeed);
        input.addEventListener("input", () => this.update({ movementSpeed: parseFloat(input.value) }));
        return input;
      })
    );

    // Personality
    this.el.appendChild(
      this.row("Personality", () => {
        const select = document.createElement("select");
        const options: Personality[] = ["playful", "lazy", "energetic", "mischievous"];
        for (const p of options) {
          const opt = document.createElement("option");
          opt.value = p;
          opt.textContent = p[0].toUpperCase() + p.slice(1);
          if (p === this.current.personality) opt.selected = true;
          select.appendChild(opt);
        }
        select.addEventListener("change", () => this.update({ personality: select.value as Personality }));
        return select;
      })
    );

    this.el.appendChild(this.toggleRow("Sound", this.current.soundEnabled, (v) => this.update({ soundEnabled: v })));
    this.el.appendChild(this.toggleRow("Always on top", this.current.alwaysOnTop, (v) => this.update({ alwaysOnTop: v })));
    this.el.appendChild(this.toggleRow("Start with computer", this.current.startWithComputer, (v) => this.update({ startWithComputer: v })));

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "Reset Pet";
    resetBtn.style.marginTop = "8px";
    resetBtn.addEventListener("click", () => {
      if (confirm("Reset all pet data? This cannot be undone.")) {
        this.actions.onReset();
      }
    });
    this.el.appendChild(resetBtn);

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "Close";
    closeBtn.addEventListener("click", () => this.hide());
    this.el.appendChild(closeBtn);
  }

  private row(label: string, makeControl: () => HTMLElement): HTMLElement {
    const row = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = label;
    row.appendChild(span);
    row.appendChild(makeControl());
    return row;
  }

  private toggleRow(label: string, value: boolean, onChange: (v: boolean) => void): HTMLElement {
    return this.row(label, () => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = value;
      input.addEventListener("change", () => onChange(input.checked));
      return input;
    });
  }
}
