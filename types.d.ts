declare type RangeName = 'entry' | 'exit' | 'contain' | 'cover';

declare type RangeOffset = {
  name?: RangeName;
  offset?: number;
};

declare type pointerConfig = {
  scenes: pointerScene;
  transitionActive?: boolean;
  transitionFriction?: number;
}

declare type pointerScene = {
  effect: (scene: pointerScene, progress: number) => void;
  start?: RangeOffset;
  duration?: number | RangeName;
  end?: RangeOffset;
  disabled?: boolean;
  viewSource?: HTMLElement;
}

declare module "kuliso";
