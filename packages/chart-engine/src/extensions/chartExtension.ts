import type { DrawingRenderer, DrawingRendererRegistry } from "../drawing/drawingRegistry";
import type { DrawingToolDefinition } from "../drawing/drawingToolDefinitions";
import type { DrawingToolRegistry } from "../drawing/drawingToolRegistry";
import { isDrawingType } from "../drawing/drawingTypes";
import type { FigureRenderer } from "../figures/figureTypes";
import type { FigureRendererRegistry } from "../figures/figureRegistry";
import type { SeriesRenderer } from "../series/seriesTypes";
import type { SeriesRendererRegistry } from "../series/seriesRegistry";
import type { VisualRenderer } from "../visuals/visualTypes";
import type { VisualRendererRegistry } from "../visuals/visualRegistry";
import {
  checkEngineCapabilityRequirements,
  type EngineCapabilityCheckResult,
  type EngineCapabilityManifest,
  type EngineCapabilityRequirements,
  type ExtensionContributionType
} from "../engine/engineCapabilityManifest";

export interface ChartExtensionManifest {
  id: string;
  label: string;
  version: string;
  description?: string;
  capabilities?: string[];
}

export interface ChartExtensionContributions {
  seriesRenderers?: SeriesRenderer[];
  visualRenderers?: VisualRenderer[];
  drawingRenderers?: DrawingRenderer[];
  drawingTools?: DrawingToolDefinition[];
  figureRenderers?: FigureRenderer[];
}

export interface ChartExtension {
  manifest: ChartExtensionManifest;
  contributions: ChartExtensionContributions;
}

export interface ChartExtensionInstallContext {
  seriesRenderers?: SeriesRendererRegistry;
  visualRenderers?: VisualRendererRegistry;
  drawingRenderers?: DrawingRendererRegistry;
  drawingTools?: DrawingToolRegistry;
  figureRenderers?: FigureRendererRegistry;
}

export interface ChartExtensionInstallResult {
  extensionId: string;
  installed: {
    seriesRenderers: number;
    visualRenderers: number;
    drawingRenderers: number;
    drawingTools: number;
    figureRenderers: number;
  };
}

export interface ChartExtensionUninstallResult {
  extensionId: string;
  uninstalled: {
    seriesRenderers: number;
    visualRenderers: number;
    drawingRenderers: number;
    drawingTools: number;
    figureRenderers: number;
  };
}

export interface ChartExtensionLifecycleState {
  installedExtensionIds: string[];
  installedCount: number;
}

export interface ChartExtensionLifecycle {
  validateInstall(extension: ChartExtension): ChartExtensionInstallValidationResult;
  install(extension: ChartExtension): ChartExtensionInstallResult;
  uninstall(extensionId: string): ChartExtensionUninstallResult;
  isInstalled(extensionId: string): boolean;
  listInstalled(): ChartExtension[];
  getState(): ChartExtensionLifecycleState;
}

export interface ChartExtensionRegistry {
  register(extension: ChartExtension): void;
  get(id: string): ChartExtension | undefined;
  require(id: string): ChartExtension;
  list(): ChartExtension[];
}

export type ChartExtensionValidationIssueCode =
  | "manifest.id"
  | "manifest.label"
  | "manifest.version"
  | "contribution.duplicate"
  | "contribution.invalidDrawingType";

export interface ChartExtensionValidationIssue {
  code: ChartExtensionValidationIssueCode;
  path: string;
  message: string;
}

export interface ChartExtensionValidationResult {
  valid: boolean;
  issues: ChartExtensionValidationIssue[];
}

export type ChartExtensionInstallValidationIssueCode =
  | ChartExtensionValidationIssueCode
  | "install.alreadyInstalled"
  | "install.contributionConflict";

export interface ChartExtensionInstallValidationIssue {
  code: ChartExtensionInstallValidationIssueCode;
  path: string;
  message: string;
  ownerExtensionId?: string;
}

export interface ChartExtensionInstallValidationResult {
  valid: boolean;
  issues: ChartExtensionInstallValidationIssue[];
}

const extensionContributionOrder: readonly ExtensionContributionType[] = [
  "seriesRenderers",
  "visualRenderers",
  "drawingRenderers",
  "drawingTools",
  "figureRenderers"
];

export function validateChartExtension(extension: ChartExtension): ChartExtensionValidationResult {
  const issues: ChartExtensionValidationIssue[] = [];

  appendManifestIssue(issues, "id", extension?.manifest?.id);
  appendManifestIssue(issues, "label", extension?.manifest?.label);
  appendManifestIssue(issues, "version", extension?.manifest?.version);

  for (const contributionType of extensionContributionOrder) {
    appendDuplicateContributionIssues(
      issues,
      contributionType,
      getContributionArray(extension?.contributions, contributionType)
    );
  }

  appendInvalidDrawingTypeIssues(
    issues,
    "drawingRenderers",
    getContributionArray(extension?.contributions, "drawingRenderers")
  );
  appendInvalidDrawingTypeIssues(
    issues,
    "drawingTools",
    getContributionArray(extension?.contributions, "drawingTools")
  );

  return {
    valid: issues.length === 0,
    issues
  };
}

export function createChartExtension(
  manifest: ChartExtensionManifest,
  contributions: ChartExtensionContributions = {}
): ChartExtension {
  assertManifest(manifest);

  return {
    manifest: cloneManifest(manifest),
    contributions: cloneContributions(contributions)
  };
}

export function getChartExtensionCapabilityRequirements(
  extension: ChartExtension
): EngineCapabilityRequirements {
  const extensionContributionTypes = extensionContributionOrder.filter(
    (type) => (extension.contributions[type]?.length ?? 0) > 0
  );

  if (extensionContributionTypes.length === 0) {
    return {};
  }

  return {
    extensionContributionTypes: [...extensionContributionTypes]
  };
}

export function checkChartExtensionCompatibility(
  manifest: EngineCapabilityManifest,
  extension: ChartExtension
): EngineCapabilityCheckResult {
  return checkEngineCapabilityRequirements(
    manifest,
    getChartExtensionCapabilityRequirements(extension)
  );
}

export function createChartExtensionRegistry(): ChartExtensionRegistry {
  const extensions = new Map<string, ChartExtension>();

  return {
    register(extension) {
      assertManifest(extension.manifest);

      if (extensions.has(extension.manifest.id)) {
        throw new Error(`Chart extension is already registered: ${extension.manifest.id}`);
      }

      extensions.set(extension.manifest.id, {
        manifest: cloneManifest(extension.manifest),
        contributions: cloneContributions(extension.contributions)
      });
    },
    get(id) {
      const extension = extensions.get(id);

      return extension ? cloneExtension(extension) : undefined;
    },
    require(id) {
      const extension = extensions.get(id);

      if (!extension) {
        throw new Error(`Chart extension is not registered: ${id}`);
      }

      return cloneExtension(extension);
    },
    list() {
      return [...extensions.values()].map(cloneExtension);
    }
  };
}

export function createChartExtensionLifecycle(
  context: ChartExtensionInstallContext
): ChartExtensionLifecycle {
  const records = new Map<string, InstalledExtensionRecord>();
  const contributionOwners = new Map<string, string>();

  return {
    validateInstall(extension) {
      const issues: ChartExtensionInstallValidationIssue[] = [
        ...validateChartExtension(extension).issues
      ];
      const extensionId = extension?.manifest?.id;

      if (typeof extensionId === "string" && records.has(extensionId)) {
        issues.push({
          code: "install.alreadyInstalled",
          path: "manifest.id",
          message: `Chart extension is already installed: ${extensionId}`
        });
      }

      appendInstallContributionConflictIssues(issues, extension, contributionOwners);

      return {
        valid: issues.length === 0,
        issues
      };
    },
    install(extension) {
      const clonedExtension = cloneExtension(extension);
      const extensionId = clonedExtension.manifest.id;

      assertManifest(clonedExtension.manifest);

      if (records.has(extensionId)) {
        throw new Error(`Chart extension is already installed: ${extensionId}`);
      }

      const snapshots = createContributionSnapshots(
        clonedExtension,
        context,
        contributionOwners
      );

      const appliedSnapshots: ContributionSnapshot[] = [];

      try {
        for (const snapshot of snapshots) {
          if (!snapshot.registry) {
            continue;
          }

          snapshot.registry.register(snapshot.installed as never);
          appliedSnapshots.push(snapshot);
        }
      } catch (error) {
        for (const snapshot of [...appliedSnapshots].reverse()) {
          try {
            restoreContributionSnapshot(snapshot);
          } catch {
            // Preserve the original registry error that caused install to fail.
          }
        }

        throw error;
      }

      for (const snapshot of snapshots) {
        contributionOwners.set(contributionKey(snapshot.kind, snapshot.type), extensionId);
      }

      const result = createInstallResult(clonedExtension);

      records.set(extensionId, {
        extension: clonedExtension,
        result,
        snapshots
      });

      return result;
    },
    uninstall(extensionId) {
      const record = records.get(extensionId);

      if (!record) {
        throw new Error(`Chart extension is not installed: ${extensionId}`);
      }

      const uninstalled = createEmptyContributionCounts();

      for (const snapshot of [...record.snapshots].reverse()) {
        const restored = restoreContributionSnapshot(snapshot);

        if (restored) {
          uninstalled[snapshot.kind] += 1;
        }

        contributionOwners.delete(contributionKey(snapshot.kind, snapshot.type));
      }

      records.delete(extensionId);

      return {
        extensionId,
        uninstalled
      };
    },
    isInstalled(extensionId) {
      return records.has(extensionId);
    },
    listInstalled() {
      return [...records.values()].map((record) => cloneExtension(record.extension));
    },
    getState() {
      return {
        installedExtensionIds: [...records.keys()],
        installedCount: records.size
      };
    }
  };
}

export function applyChartExtension(
  extension: ChartExtension,
  context: ChartExtensionInstallContext
): ChartExtensionInstallResult {
  assertManifest(extension.manifest);

  const contributions = extension.contributions;

  for (const renderer of contributions.seriesRenderers ?? []) {
    context.seriesRenderers?.register(renderer);
  }

  for (const renderer of contributions.visualRenderers ?? []) {
    context.visualRenderers?.register(renderer);
  }

  for (const renderer of contributions.drawingRenderers ?? []) {
    context.drawingRenderers?.register(renderer);
  }

  for (const definition of contributions.drawingTools ?? []) {
    context.drawingTools?.register(definition);
  }

  for (const renderer of contributions.figureRenderers ?? []) {
    context.figureRenderers?.register(renderer);
  }

  return {
    extensionId: extension.manifest.id,
    installed: {
      seriesRenderers: contributions.seriesRenderers?.length ?? 0,
      visualRenderers: contributions.visualRenderers?.length ?? 0,
      drawingRenderers: contributions.drawingRenderers?.length ?? 0,
      drawingTools: contributions.drawingTools?.length ?? 0,
      figureRenderers: contributions.figureRenderers?.length ?? 0
    }
  };
}

type ContributionKind = keyof ChartExtensionInstallResult["installed"];

type ContributionWithType =
  | SeriesRenderer
  | VisualRenderer
  | DrawingRenderer
  | DrawingToolDefinition
  | FigureRenderer;

interface LifecycleRegistry<TContribution extends ContributionWithType> {
  register(contribution: TContribution): void;
  unregister(type: TContribution["type"]): TContribution | undefined;
  get(type: TContribution["type"]): TContribution | undefined;
}

interface ContributionSnapshot<TContribution extends ContributionWithType = ContributionWithType> {
  kind: ContributionKind;
  type: TContribution["type"];
  installed: TContribution;
  previous: TContribution | undefined;
  registry: LifecycleRegistry<TContribution> | undefined;
}

interface InstalledExtensionRecord {
  extension: ChartExtension;
  result: ChartExtensionInstallResult;
  snapshots: ContributionSnapshot[];
}

type ContributionCounts = ChartExtensionInstallResult["installed"];

function createContributionSnapshots(
  extension: ChartExtension,
  context: ChartExtensionInstallContext,
  contributionOwners: Map<string, string>
): ContributionSnapshot[] {
  const snapshots: ContributionSnapshot[] = [];
  const localContributionKeys = new Set<string>();

  appendContributionSnapshots(
    snapshots,
    "seriesRenderers",
    extension.contributions.seriesRenderers,
    context.seriesRenderers,
    contributionOwners,
    localContributionKeys
  );
  appendContributionSnapshots(
    snapshots,
    "visualRenderers",
    extension.contributions.visualRenderers,
    context.visualRenderers,
    contributionOwners,
    localContributionKeys
  );
  appendContributionSnapshots(
    snapshots,
    "drawingRenderers",
    extension.contributions.drawingRenderers,
    context.drawingRenderers,
    contributionOwners,
    localContributionKeys
  );
  appendContributionSnapshots(
    snapshots,
    "drawingTools",
    extension.contributions.drawingTools,
    context.drawingTools,
    contributionOwners,
    localContributionKeys
  );
  appendContributionSnapshots(
    snapshots,
    "figureRenderers",
    extension.contributions.figureRenderers,
    context.figureRenderers,
    contributionOwners,
    localContributionKeys
  );

  return snapshots;
}

function appendContributionSnapshots<TContribution extends ContributionWithType>(
  snapshots: ContributionSnapshot[],
  kind: ContributionKind,
  contributions: TContribution[] | undefined,
  registry: LifecycleRegistry<TContribution> | undefined,
  contributionOwners: Map<string, string>,
  localContributionKeys: Set<string>
): void {
  for (const contribution of contributions ?? []) {
    const key = contributionKey(kind, contribution.type);

    if (localContributionKeys.has(key)) {
      throw new Error(`Chart extension contribution is duplicated: ${kind} ${contribution.type}`);
    }

    const owner = contributionOwners.get(key);

    if (owner) {
      throw new Error(
        `Chart extension contribution is already installed: ${kind} ${contribution.type} by ${owner}`
      );
    }

    localContributionKeys.add(key);
    snapshots.push({
      kind,
      type: contribution.type,
      installed: contribution,
      previous: registry?.get(contribution.type),
      registry
    });
  }
}

function appendInstallContributionConflictIssues(
  issues: ChartExtensionInstallValidationIssue[],
  extension: ChartExtension,
  contributionOwners: Map<string, string>
): void {
  for (const contributionType of extensionContributionOrder) {
    getContributionArray(extension?.contributions, contributionType).forEach((contribution, index) => {
      if (typeof contribution.type !== "string") {
        return;
      }

      const ownerExtensionId = contributionOwners.get(
        contributionKey(contributionType, contribution.type)
      );

      if (!ownerExtensionId) {
        return;
      }

      issues.push({
        code: "install.contributionConflict",
        path: `contributions.${contributionType}[${index}].type`,
        message: `Chart extension contribution is already installed: ${contributionType} ${contribution.type} by ${ownerExtensionId}`,
        ownerExtensionId
      });
    });
  }
}

function restoreContributionSnapshot(snapshot: ContributionSnapshot): boolean {
  if (!snapshot.registry) {
    return false;
  }

  const registry = snapshot.registry as LifecycleRegistry<ContributionWithType>;
  const current = registry.get(snapshot.type);

  if (current !== snapshot.installed) {
    return false;
  }

  if (snapshot.previous) {
    registry.register(snapshot.previous);
  } else {
    registry.unregister(snapshot.type);
  }

  return true;
}

function createInstallResult(extension: ChartExtension): ChartExtensionInstallResult {
  return {
    extensionId: extension.manifest.id,
    installed: {
      seriesRenderers: extension.contributions.seriesRenderers?.length ?? 0,
      visualRenderers: extension.contributions.visualRenderers?.length ?? 0,
      drawingRenderers: extension.contributions.drawingRenderers?.length ?? 0,
      drawingTools: extension.contributions.drawingTools?.length ?? 0,
      figureRenderers: extension.contributions.figureRenderers?.length ?? 0
    }
  };
}

function createEmptyContributionCounts(): ContributionCounts {
  return {
    seriesRenderers: 0,
    visualRenderers: 0,
    drawingRenderers: 0,
    drawingTools: 0,
    figureRenderers: 0
  };
}

function contributionKey(kind: ContributionKind, type: string): string {
  return `${kind}:${type}`;
}

function appendManifestIssue(
  issues: ChartExtensionValidationIssue[],
  key: "id" | "label" | "version",
  value: unknown
): void {
  if (isNonEmptyString(value)) {
    return;
  }

  issues.push({
    code: `manifest.${key}`,
    path: `manifest.${key}`,
    message: `Chart extension manifest ${key} must be a non-empty string`
  });
}

function appendDuplicateContributionIssues(
  issues: ChartExtensionValidationIssue[],
  contributionType: ExtensionContributionType,
  contributions: ContributionWithType[]
): void {
  const firstIndexes = new Map<string, number>();

  contributions.forEach((contribution, index) => {
    if (typeof contribution.type !== "string") {
      return;
    }

    const firstIndex = firstIndexes.get(contribution.type);

    if (firstIndex === undefined) {
      firstIndexes.set(contribution.type, index);
      return;
    }

    issues.push({
      code: "contribution.duplicate",
      path: `contributions.${contributionType}[${index}].type`,
      message: `Chart extension contribution type is duplicated: ${contributionType} ${contribution.type}`
    });
  });
}

function appendInvalidDrawingTypeIssues(
  issues: ChartExtensionValidationIssue[],
  contributionType: "drawingRenderers" | "drawingTools",
  contributions: ContributionWithType[]
): void {
  contributions.forEach((contribution, index) => {
    const type = contribution.type;

    if (typeof type === "string" && isDrawingType(type)) {
      return;
    }

    issues.push({
      code: "contribution.invalidDrawingType",
      path: `contributions.${contributionType}[${index}].type`,
      message: `Chart extension drawing contribution type is invalid: ${contributionType} ${String(type)}`
    });
  });
}

function getContributionArray(
  contributions: ChartExtensionContributions | undefined,
  contributionType: ExtensionContributionType
): ContributionWithType[] {
  const contribution = contributions?.[contributionType];

  return Array.isArray(contribution) ? contribution : [];
}

function assertManifest(manifest: ChartExtensionManifest): void {
  if (!isNonEmptyString(manifest.id)) {
    throw new Error("Chart extension id must be a non-empty string");
  }

  if (!isNonEmptyString(manifest.label)) {
    throw new Error("Chart extension label must be a non-empty string");
  }

  if (!isNonEmptyString(manifest.version)) {
    throw new Error("Chart extension version must be a non-empty string");
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneExtension(extension: ChartExtension): ChartExtension {
  return {
    manifest: cloneManifest(extension.manifest),
    contributions: cloneContributions(extension.contributions)
  };
}

function cloneManifest(manifest: ChartExtensionManifest): ChartExtensionManifest {
  return {
    ...manifest,
    capabilities: manifest.capabilities ? [...manifest.capabilities] : undefined
  };
}

function cloneContributions(contributions: ChartExtensionContributions): ChartExtensionContributions {
  return {
    seriesRenderers: contributions.seriesRenderers ? [...contributions.seriesRenderers] : undefined,
    visualRenderers: contributions.visualRenderers ? [...contributions.visualRenderers] : undefined,
    drawingRenderers: contributions.drawingRenderers ? [...contributions.drawingRenderers] : undefined,
    drawingTools: contributions.drawingTools ? contributions.drawingTools.map(cloneDrawingTool) : undefined,
    figureRenderers: contributions.figureRenderers ? [...contributions.figureRenderers] : undefined
  };
}

function cloneDrawingTool(definition: DrawingToolDefinition): DrawingToolDefinition {
  return {
    ...definition,
    defaultStyle: {
      ...definition.defaultStyle,
      lineDash: definition.defaultStyle.lineDash ? [...definition.defaultStyle.lineDash] : undefined
    }
  };
}
