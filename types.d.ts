declare type PointerConfig = {
  scenes: PointerScene;
  root?: HTMLElement;
}

declare type PointerScene = {
  effect: (scene: PointerScene, progress: {x: number, y: number}, velocity: {x: number, y: number}) => void;
  centeredToTarget?: boolean;
  target?: HTMLElement;
}

declare module "kuliso";
