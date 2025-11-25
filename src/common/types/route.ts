export interface RouteNode {
  id: string;
  path?: string;
  index?: boolean;
  element: React.ReactNode;
  children?: RouteNode[];
  order?: number;
  meta?: Record<string, unknown>;
} 