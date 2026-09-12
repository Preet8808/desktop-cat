export type AnimationName =
  | "idle"
  | "walkLeft"
  | "walkRight"
  | "walkUp"
  | "walkDown"
  | "runLeft"
  | "runRight"
  | "jump"
  | "fall"
  | "sit"
  | "sleep"
  | "stretch"
  | "lookAround"
  | "happy"
  | "angry"
  | "eat"
  | "play"
  | "petted";

export type Personality = "lazy" | "playful" | "energetic" | "mischievous";

export type FoodType = "fish" | "milk" | "treat" | "chicken";

export interface PetStatsData {
  hunger: number; // 0-100, 100 = fully fed
  happiness: number; // 0-100
  energy: number; // 0-100
  affection: number; // 0-100
}

export interface Settings {
  catName: string;
  catSize: number; // scale multiplier, e.g. 1.0
  movementSpeed: number; // px/sec multiplier
  soundEnabled: boolean;
  speechEnabled: boolean;
  alwaysOnTop: boolean;
  startWithComputer: boolean;
  personality: Personality;
}

export interface SaveData {
  name: string;
  personality: Personality;
  stats: PetStatsData;
  position: { x: number; y: number };
  settings: Settings;
  lastActiveTimestamp: number;
}

export const DEFAULT_SETTINGS: Settings = {
  catName: "Mochi",
  catSize: 1.0,
  movementSpeed: 1.0,
  soundEnabled: false,
  speechEnabled: true,
  alwaysOnTop: true,
  startWithComputer: false,
  personality: "playful",
};

export const DEFAULT_STATS: PetStatsData = {
  hunger: 80,
  happiness: 80,
  energy: 90,
  affection: 50,
};
