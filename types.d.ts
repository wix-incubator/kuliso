declare type RangeName = 'entry' | 'exit' | 'contain' | 'cover';

declare type RangeOffset = {
  name?: RangeName;
  offset?: number;
};

declare type mouseConfig = {
  scenes: MouseScene;
  transitionActive?: boolean;
  transitionFriction?: number;
}

declare type MouseScene = {
  effect: (scene: MouseScene, progress: number) => void;
  start?: RangeOffset;
  duration?: number | RangeName;
  end?: RangeOffset;
  disabled?: boolean;
  viewSource?: HTMLElement;
}

declare module "kuliso";
