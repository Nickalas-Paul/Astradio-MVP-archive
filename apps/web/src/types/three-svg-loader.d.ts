declare module 'three/examples/jsm/loaders/SVGLoader' {
  import { Loader, Shape } from 'three';

  export interface SVGResultPath {
    userData?: { style?: { fill?: string } };
  }

  export interface SVGResult {
    paths: SVGResultPath[];
  }

  export class SVGLoader extends Loader {
    parse(text: string): SVGResult;
    static createShapes(path: SVGResultPath): Shape[];
  }
}
