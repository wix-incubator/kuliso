declare type PointerConfig = {
  scenes: PointerScene;
  root?: HTMLElement;
  noThrottle?: boolean;
}

declare type PointerScene = {
  effect: (scene: PointerScene, progress: {x: number, y: number}, velocity: {x: number, y: number}) => void;
  centeredToTarget?: boolean;
  target?: HTMLElement;
  disabled?: boolean;
}

declare module "kuliso";
