import type { DrawingType } from "./drawingTypes";
import type { DrawingToolDefinition } from "./drawingToolDefinitions";

export interface DrawingToolRegistry {
  register(definition: DrawingToolDefinition): void;
  require(type: DrawingType): DrawingToolDefinition;
  list(): DrawingToolDefinition[];
}

export function createDrawingToolRegistry(): DrawingToolRegistry {
  const definitions = new Map<DrawingType, DrawingToolDefinition>();

  return {
    register(definition) {
      definitions.set(definition.type, definition);
    },
    require(type) {
      const definition = definitions.get(type);

      if (!definition) {
        throw new Error(`Drawing tool is not registered: ${type}`);
      }

      return definition;
    },
    list() {
      return [...definitions.values()];
    }
  };
}
