export type FigureType =
  | "line"
  | "polyline"
  | "polygon"
  | "rect"
  | "rotatedRect"
  | "circle"
  | "ellipse"
  | "arc"
  | "curve"
  | "text"
  | "label"
  | "arrow"
  | "band"
  | "marker";

export interface FigurePoint {
  x: number;
  y: number;
}

export interface FigureStyle {
  color?: string;
  fill?: string;
  lineWidth?: number;
  lineDash?: number[];
  textColor?: string;
  fontSize?: number;
}

export interface FigureObject {
  id: string;
  type: FigureType;
  points: FigurePoint[];
  text?: string;
  style?: FigureStyle;
}

export interface FigureBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface FigureHitTestResult {
  figureId: string;
  distance: number;
}

export interface FigureRenderContext {
  context: CanvasRenderingContext2D;
  figure: FigureObject;
}

export interface FigureRenderer {
  type: FigureType;
  render(context: FigureRenderContext): void;
}
