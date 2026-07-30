import { createEngineCapabilityManifest } from "@simoncharts/chart-engine";
import type {
  ChartFeature,
  ChartDisplayMode,
  ChartLocale,
  ChartReplaySpeed,
  ChartTheme
} from "../contracts";
import type { IndicatorConfig } from "../runtime/indicatorRuntime";
import type {
  WorkspaceUiActions,
  WorkspaceViewModel
} from "../controller/chartController";
import type {
  DataWindowSnapshot,
  ExecutionTooltipSnapshot
} from "../runtime/chartEngineRuntime";
import type { DataTableSnapshot } from "../runtime/dataTable";
import { formatPrice } from "../runtime/priceFormatter";
import { formatShanghaiTime } from "../runtime/shanghaiTimeFormatter";
import { createBottomPanel } from "./bottomPanel";
import { createDataTableView } from "./dataTable";
import { createDrawingPalette } from "./drawingPalette";
import { createErrorPanel } from "./errorPanel";
import { labelsFor } from "./localization";
import { createTopToolbar } from "./topToolbar";

export interface WorkspaceShellOptions {
  readonly features: ReadonlySet<ChartFeature>;
  readonly theme: ChartTheme;
  readonly locale: ChartLocale;
  readonly studyTitleFor?: (config: Readonly<IndicatorConfig>) => string;
}

type ShellUiActions = WorkspaceUiActions & {
  resetToLatest?(): void;
  setDisplayMode?(mode: ChartDisplayMode): void;
};

export interface WorkspaceShell {
  readonly root: HTMLDivElement;
  readonly chartRegion: HTMLDivElement;
  readonly staticCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  bind(actions: ShellUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
  renderDataWindow(snapshot: DataWindowSnapshot | undefined): void;
  renderDataTable(snapshot: Readonly<DataTableSnapshot>): void;
  renderExecutionTooltip(snapshot: ExecutionTooltipSnapshot | undefined): void;
  setDisplayMode(mode: ChartDisplayMode): void;
  destroy(): void;
}

const toolbarFeatures = new Set<ChartFeature>([
  "symbol-search",
  "timeframes",
  "adjustment",
  "series-type",
  "price-scale",
  "symbol-compare",
  "indicators",
  "drawing-history",
  "settings",
  "bottom-panel",
  "data-table",
  "replay"
]);

function number(value: number): string {
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function price(value: number, precision: number | undefined): string {
  return precision === undefined ? number(value) : formatPrice(value, precision);
}

export function createWorkspaceShell(options: WorkspaceShellOptions): WorkspaceShell {
  const labels = labelsFor(options.locale);
  const advanced = options.features.has("drawing-tools") && options.features.has("bottom-panel");
  const root = document.createElement("div");
  root.className = "sc-chart sc-workspace";
  root.dataset.testid = "simon-chart";
  root.dataset.state = "loading";
  root.dataset.theme = options.theme;
  root.dataset.variant = advanced ? "advanced" : "embedded";
  root.dataset.displayMode = "chart";
  root.lang = options.locale;

  const hasToolbar = [...options.features].some((feature) => toolbarFeatures.has(feature));
  const toolbar = hasToolbar
    ? createTopToolbar(
        createEngineCapabilityManifest(),
        options.features,
        options.locale,
        options.studyTitleFor
      )
    : undefined;
  const body = document.createElement("div");
  body.className = "sc-workspace-body";
  const chartRegion = document.createElement("div");
  chartRegion.className = "sc-chart-region";
  chartRegion.lang = options.locale;
  const staticCanvas = document.createElement("canvas");
  staticCanvas.className = "sc-chart-canvas sc-static-canvas";
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.className = "sc-chart-canvas sc-overlay-canvas";
  overlayCanvas.tabIndex = 0;
  overlayCanvas.setAttribute("aria-label", options.locale === "zh-CN" ? "交互式金融图表" : "Interactive financial chart");
  const executionTooltip = options.features.has("executions")
    ? document.createElement("div")
    : undefined;
  if (executionTooltip) {
    executionTooltip.className = "sc-execution-tooltip";
    executionTooltip.dataset.testid = "execution-tooltip";
    executionTooltip.setAttribute("role", "tooltip");
    executionTooltip.hidden = true;
  }

  const drawingPalette = options.features.has("drawing-tools")
    ? createDrawingPalette(labels)
    : undefined;
  const paletteHost = drawingPalette ? document.createElement("div") : undefined;
  if (drawingPalette && paletteHost) {
    paletteHost.className = "sc-drawing-palette-host";
    paletteHost.append(drawingPalette.element);
    body.dataset.hasPalette = "true";
  }

  const watermark = advanced ? document.createElement("div") : undefined;
  const watermarkName = watermark ? document.createElement("strong") : undefined;
  const watermarkMeta = watermark ? document.createElement("span") : undefined;
  if (watermark && watermarkName && watermarkMeta) {
    watermark.className = "sc-chart-watermark";
    watermark.setAttribute("aria-hidden", "true");
    watermark.append(watermarkName, watermarkMeta);
  }
  const chartHeader = advanced || toolbar?.intradayDaysElement !== undefined
    ? document.createElement("div")
    : undefined;
  const intradayHeader = toolbar?.intradayDaysElement ? document.createElement("div") : undefined;
  const intradayTitle = intradayHeader ? document.createElement("span") : undefined;
  if (intradayHeader && intradayTitle && toolbar?.intradayDaysElement) {
    intradayHeader.className = "sc-intraday-header";
    intradayHeader.hidden = true;
    intradayTitle.className = "sc-intraday-title";
    intradayTitle.textContent = labels.intradayChart;
    intradayHeader.append(intradayTitle, toolbar.intradayDaysElement);
  }
  const legend = chartHeader ? document.createElement("div") : undefined;
  const legendValues = legend
    ? (["high", "open", "low", "close"] as const).map((field) => {
        const value = document.createElement("span");
        value.dataset.field = field;
        legend.append(value);
        return [field, value] as const;
      })
    : [];
  const legendChange = legend ? document.createElement("span") : undefined;
  if (chartHeader && legend) {
    chartHeader.className = "sc-chart-header";
    legend.className = "sc-chart-legend";
    legend.dataset.testid = "chart-ohlc-legend";
    legend.setAttribute("aria-live", "off");
    if (legendChange) {
      legendChange.dataset.field = "change";
      legendChange.dataset.testid = "chart-change-legend";
      legendChange.hidden = true;
      legend.append(legendChange);
    }
    if (intradayHeader) chartHeader.append(intradayHeader);
    chartHeader.append(legend);
  }

  const errorPanel = createErrorPanel();
  const dataTable = createDataTableView(labels);
  chartRegion.append(staticCanvas, overlayCanvas);
  chartRegion.append(dataTable.element);
  if (executionTooltip) chartRegion.append(executionTooltip);
  if (watermark) chartRegion.append(watermark);
  if (chartHeader) chartRegion.append(chartHeader);
  chartRegion.append(errorPanel.element);

  const bottomPanel = options.features.has("bottom-panel") ? createBottomPanel(labels) : undefined;
  const resizer = bottomPanel ? document.createElement("div") : undefined;
  const bottomHost = bottomPanel ? document.createElement("div") : undefined;
  if (bottomPanel && resizer && bottomHost) {
    resizer.className = "sc-bottom-resizer";
    bottomHost.className = "sc-bottom-host sc-right-host";
    bottomHost.append(resizer, bottomPanel.element);
    body.dataset.hasInspector = "true";
  }

  if (paletteHost) body.append(paletteHost);
  body.append(chartRegion);
  if (bottomHost) body.append(bottomHost);

  const replayControls = options.features.has("replay")
    ? document.createElement("div")
    : undefined;
  const replayTime = replayControls ? document.createElement("span") : undefined;
  const replayPlay = replayControls ? document.createElement("button") : undefined;
  const replayStep = replayControls ? document.createElement("button") : undefined;
  const replaySpeed = replayControls ? document.createElement("select") : undefined;
  const replayExit = replayControls ? document.createElement("button") : undefined;
  if (
    replayControls &&
    replayTime &&
    replayPlay &&
    replayStep &&
    replaySpeed &&
    replayExit
  ) {
    replayControls.className = "sc-replay-controls";
    replayControls.dataset.testid = "replay-controls";
    replayControls.setAttribute("role", "group");
    replayControls.setAttribute("aria-label", labels.replay);
    replayControls.hidden = true;
    replayTime.className = "sc-replay-time";
    replayTime.dataset.testid = "replay-current-time";
    replayTime.setAttribute("aria-live", "polite");
    replayPlay.type = "button";
    replayPlay.dataset.testid = "replay-play-toggle";
    replayStep.type = "button";
    replayStep.dataset.testid = "replay-step-forward";
    replayStep.textContent = "▶|";
    replayStep.setAttribute("aria-label", labels.replayStep);
    replaySpeed.dataset.testid = "replay-speed";
    replaySpeed.setAttribute("aria-label", labels.replaySpeed);
    for (const speed of [1, 2, 4, 8] as const) {
      const option = document.createElement("option");
      option.value = String(speed);
      option.textContent = `${speed}×`;
      replaySpeed.append(option);
    }
    replayExit.type = "button";
    replayExit.dataset.testid = "replay-exit";
    replayExit.textContent = "×";
    replayExit.setAttribute("aria-label", labels.replayExit);
    replayControls.append(replayTime, replayPlay, replayStep, replaySpeed, replayExit);
  }

  const statusBar = advanced ? document.createElement("div") : undefined;
  const statusTime = statusBar ? document.createElement("span") : undefined;
  const statusOhlc = statusBar ? document.createElement("span") : undefined;
  const statusMode = statusBar ? document.createElement("span") : undefined;
  if (statusBar && statusTime && statusOhlc && statusMode) {
    statusBar.className = "sc-status-bar";
    statusBar.dataset.testid = "chart-status-bar";
    statusTime.className = "sc-status-time";
    statusOhlc.className = "sc-status-ohlc";
    statusMode.className = "sc-status-mode";
    statusBar.append(statusTime, statusOhlc, statusMode);
  }

  const contextMenu = advanced ? document.createElement("div") : undefined;
  if (contextMenu) {
    contextMenu.className = "sc-context-menu";
    contextMenu.dataset.testid = "chart-context-menu";
    contextMenu.setAttribute("role", "menu");
    contextMenu.hidden = true;
    chartRegion.append(contextMenu);
  }

  const rows = [
    toolbar ? (advanced ? "40px" : "42px") : undefined,
    "minmax(0, 1fr)",
    replayControls ? "auto" : undefined,
    statusBar ? "26px" : undefined
  ]
    .filter((row): row is string => row !== undefined)
    .join(" ");
  root.style.gridTemplateRows = rows;
  if (toolbar) root.append(toolbar.element);
  root.append(body);
  if (replayControls) root.append(replayControls);
  if (statusBar) root.append(statusBar);
  const cleanup: Array<() => void> = [];
  let destroyed = false;
  let currentViewModel: WorkspaceViewModel | undefined;
  let currentDataWindow: DataWindowSnapshot | undefined;
  let currentExecutionTooltipId: string | undefined;

  const paintDataWindow = (snapshot: DataWindowSnapshot | undefined) => {
    if (legend) {
      const intradaySummary = snapshot?.intradaySummary;
      const values = intradaySummary ?? snapshot?.candle;
      const previousClose = intradaySummary?.previousClose
        ?? (snapshot === undefined ? undefined : snapshot.candle.close - snapshot.change);
      const names = options.locale === "zh-CN"
        ? { high: "高", open: "开", low: "低", close: "收" }
        : { high: "H", open: "O", low: "L", close: "C" };
      for (const [field, element] of legendValues) {
        const value = values?.[field];
        element.textContent = `${names[field]} ${value === undefined ? "--" : price(value, snapshot?.pricePrecision)}`;
        element.dataset.direction = value === undefined || previousClose === undefined || value === previousClose
          ? "flat"
          : value > previousClose ? "up" : "down";
      }
      if (legendChange) {
        const timeframe = currentViewModel?.state.view === "timeframe";
        legendChange.hidden = !timeframe || snapshot === undefined;
        if (timeframe && snapshot) {
          const direction = snapshot.change > 0 ? "up" : snapshot.change < 0 ? "down" : "flat";
          const change = `${snapshot.change > 0 ? "+" : ""}${price(snapshot.change, snapshot.pricePrecision)}`;
          const percent = `${snapshot.changePercent > 0 ? "+" : ""}${snapshot.changePercent.toFixed(2)}%`;
          const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "•";
          legendChange.textContent = `${arrow} ${change} ${percent}`;
          legendChange.dataset.direction = direction;
        }
      }
    }
    if (statusTime) statusTime.textContent = snapshot?.formattedTime ?? labels.shanghaiTime;
    if (statusOhlc) {
      statusOhlc.textContent = snapshot
        ? `O ${price(snapshot.candle.open, snapshot.pricePrecision)}  H ${price(snapshot.candle.high, snapshot.pricePrecision)}  L ${price(snapshot.candle.low, snapshot.pricePrecision)}  C ${price(snapshot.candle.close, snapshot.pricePrecision)}  V ${number(snapshot.candle.volume)}`
        : "O --  H --  L --  C --  V --";
    }
    bottomPanel?.renderDataWindow(snapshot);
  };

  return {
    root,
    chartRegion,
    staticCanvas,
    overlayCanvas,
    bind(actions) {
      const unbindToolbar = toolbar?.bind(actions);
      const unbindDrawingPalette = drawingPalette?.bind(actions);
      const unbindBottomPanel = bottomPanel?.bind(actions);
      const unbindDataTable = dataTable.bind(() => actions.setDisplayMode?.("chart"));
      const unbindErrorPanel = errorPanel.bind(() => actions.retry(), () => actions.retryHistory());
      const toggleReplay = () => {
        if (currentViewModel?.replay.status === "playing") actions.pauseReplay();
        else actions.playReplay();
      };
      const stepReplay = () => actions.stepReplay();
      const changeReplaySpeed = () =>
        actions.setReplaySpeed(Number(replaySpeed!.value) as ChartReplaySpeed);
      const exitReplay = () => actions.stopReplay();
      replayPlay?.addEventListener("click", toggleReplay);
      replayStep?.addEventListener("click", stepReplay);
      replaySpeed?.addEventListener("change", changeReplaySpeed);
      replayExit?.addEventListener("click", exitReplay);
      let startX = 0;
      let startWidth = 0;
      const move = (event: PointerEvent) => {
        if (!currentViewModel) return;
        const maximum = Math.max(240, Math.floor(root.clientWidth * 0.4));
        actions.setBottomPanel({
          ...currentViewModel.bottomPanel,
          height: Math.max(240, Math.min(maximum, startWidth + startX - event.clientX)),
          collapsed: false
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      const down = (event: PointerEvent) => {
        startX = event.clientX;
        startWidth = bottomPanel?.element.getBoundingClientRect().width ?? 0;
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      resizer?.addEventListener("pointerdown", down);

      const closeContextMenu = () => {
        if (contextMenu) contextMenu.hidden = true;
      };
      const addMenuButton = (label: string, action: () => void, checked?: boolean) => {
        if (!contextMenu) return;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.setAttribute("aria-label", label);
        button.setAttribute("role", checked === undefined ? "menuitem" : "menuitemradio");
        if (checked !== undefined) button.setAttribute("aria-checked", String(checked));
        button.addEventListener("click", () => {
          action();
          closeContextMenu();
        });
        contextMenu.append(button);
      };
      const addReset = () => {
        if (typeof actions.resetToLatest === "function") addMenuButton(labels.resetView, () => actions.resetToLatest?.());
      };
      const openContextMenu = (event: MouseEvent) => {
        if (!contextMenu || !currentViewModel) return;
        event.preventDefault();
        const rect = chartRegion.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const kind = y >= rect.height - 28 ? "time" : x >= rect.width - 64 ? "price" : "chart";
        contextMenu.replaceChildren();
        contextMenu.dataset.kind = kind;
        if (kind === "chart") {
          addReset();
          addMenuButton(currentViewModel.gridVisible ? labels.hideGrid : labels.showGrid, () => actions.setGridVisible(!currentViewModel!.gridVisible));
          addMenuButton(labels.dataWindow, () => actions.setBottomPanel({ ...currentViewModel!.bottomPanel, activeTab: "data", collapsed: false }));
          if (options.features.has("data-table")) {
            addMenuButton(labels.dataTable, () => actions.setDisplayMode?.("table"));
          }
        } else if (kind === "price") {
          for (const mode of ["linear", "log", "percentage"] as const) {
            addMenuButton(labels.priceScaleModes[mode], () => actions.setPriceScaleMode(mode), currentViewModel.priceScaleMode === mode);
          }
          addReset();
        } else {
          addReset();
          const note = document.createElement("div");
          note.className = "sc-context-note";
          note.textContent = labels.shanghaiTime;
          note.setAttribute("role", "note");
          contextMenu.append(note);
        }
        contextMenu.hidden = false;
        contextMenu.style.visibility = "hidden";
        const left = Math.max(4, Math.min(chartRegion.clientWidth - contextMenu.offsetWidth - 4, x));
        const top = Math.max(4, Math.min(chartRegion.clientHeight - contextMenu.offsetHeight - 4, y));
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        contextMenu.style.visibility = "visible";
        contextMenu.querySelector<HTMLButtonElement>("button")?.focus();
      };
      const blockSecondaryPointer = (event: PointerEvent) => {
        if (event.button !== 2) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      };
      const outside = (event: PointerEvent) => {
        if (contextMenu && !contextMenu.contains(event.target as Node)) closeContextMenu();
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key === "Escape") closeContextMenu();
      };
      if (contextMenu) {
        overlayCanvas.addEventListener("pointerdown", blockSecondaryPointer, true);
        overlayCanvas.addEventListener("contextmenu", openContextMenu);
        root.ownerDocument.addEventListener("pointerdown", outside);
        root.ownerDocument.addEventListener("keydown", escape);
        window.addEventListener("resize", closeContextMenu);
      }
      const unbind = () => {
        unbindToolbar?.();
        unbindDrawingPalette?.();
        unbindBottomPanel?.();
        unbindDataTable();
        unbindErrorPanel();
        replayPlay?.removeEventListener("click", toggleReplay);
        replayStep?.removeEventListener("click", stepReplay);
        replaySpeed?.removeEventListener("change", changeReplaySpeed);
        replayExit?.removeEventListener("click", exitReplay);
        resizer?.removeEventListener("pointerdown", down);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        if (contextMenu) {
          overlayCanvas.removeEventListener("pointerdown", blockSecondaryPointer, true);
          overlayCanvas.removeEventListener("contextmenu", openContextMenu);
          root.ownerDocument.removeEventListener("pointerdown", outside);
          root.ownerDocument.removeEventListener("keydown", escape);
          window.removeEventListener("resize", closeContextMenu);
        }
      };
      cleanup.push(unbind);
      return unbind;
    },
    render(viewModel) {
      currentViewModel = viewModel;
      root.dataset.state =
        viewModel.status.type === "readyWithWarning"
          ? "ready-with-warning"
          : viewModel.status.type;
      root.dataset.replay = viewModel.replay.status;
      toolbar?.render(viewModel);
      if (
        replayControls &&
        replayTime &&
        replayPlay &&
        replayStep &&
        replaySpeed
      ) {
        const active = viewModel.replay.status !== "inactive";
        const playing = viewModel.replay.status === "playing";
        replayControls.hidden = !active;
        replayPlay.textContent = playing ? "Ⅱ" : "▶";
        replayPlay.setAttribute(
          "aria-label",
          playing ? labels.replayPause : labels.replayPlay
        );
        replayPlay.setAttribute("aria-pressed", String(playing));
        replayStep.disabled = playing;
        replaySpeed.value = String(viewModel.replay.speed);
        replayTime.textContent = active
          ? formatShanghaiTime(
              viewModel.replay.cursorTime!,
              viewModel.state.timeframe
            )
          : "";
      }
      drawingPalette?.render(viewModel);
      bottomPanel?.render(viewModel);
      if (bottomHost) bottomHost.dataset.collapsed = String(viewModel.bottomPanel.collapsed);
      errorPanel.render(viewModel.status);
      const intraday = viewModel.state.view === "intraday";
      if (intradayHeader) intradayHeader.hidden = !intraday;
      if (chartHeader && !advanced) chartHeader.hidden = !intraday;
      if (watermarkName && watermarkMeta) {
        watermarkName.textContent = viewModel.state.symbol.name;
        const timeframe = viewModel.state.view === "intraday" ? labels.intraday : labels.timeframes[viewModel.state.timeframe];
        watermarkMeta.textContent = `${viewModel.state.symbol.code} · ${timeframe}`;
      }
      if (statusMode) {
        statusMode.textContent = `${viewModel.state.symbol.code} · ${labels.timeframes[viewModel.state.timeframe]} · ${labels.adjustModes[viewModel.state.adjustMode]}`;
      }
      if (viewModel.dataWindow !== undefined) currentDataWindow = structuredClone(viewModel.dataWindow);
      paintDataWindow(currentDataWindow);
    },
    renderDataWindow(snapshot) {
      currentDataWindow = snapshot === undefined ? undefined : structuredClone(snapshot);
      paintDataWindow(currentDataWindow);
    },
    renderDataTable(snapshot) {
      dataTable.render(snapshot);
    },
    setDisplayMode(mode) {
      const activeElement = root.ownerDocument.activeElement;
      const focusInside = activeElement !== null && root.contains(activeElement);
      const focusInTable = activeElement !== null && dataTable.element.contains(activeElement);
      root.dataset.displayMode = mode;
      dataTable.setVisible(mode === "table");
      if (mode === "table" && focusInside) dataTable.focus();
      else if (mode === "chart" && focusInTable) {
        overlayCanvas.focus({ preventScroll: true });
      }
    },
    renderExecutionTooltip(snapshot) {
      if (!executionTooltip) return;
      if (!snapshot) {
        if (executionTooltip.hidden && currentExecutionTooltipId === undefined) return;
        executionTooltip.hidden = true;
        executionTooltip.replaceChildren();
        currentExecutionTooltipId = undefined;
        return;
      }
      if (snapshot.markId !== currentExecutionTooltipId) {
        const nodes: HTMLElement[] = [];
        if (snapshot.title) {
          const title = document.createElement("strong");
          title.className = "sc-execution-tooltip-title";
          title.textContent = snapshot.title;
          nodes.push(title);
        }
        for (const row of snapshot.rows) {
          const line = document.createElement("div");
          line.className = "sc-execution-tooltip-row";
          const label = document.createElement("span");
          const value = document.createElement("span");
          label.textContent = row.label;
          value.textContent = row.value;
          line.append(label, value);
          nodes.push(line);
        }
        executionTooltip.replaceChildren(...nodes);
        executionTooltip.scrollTop = 0;
        currentExecutionTooltipId = snapshot.markId;
      }
      executionTooltip.dataset.pinned = String(snapshot.pinned);
      executionTooltip.hidden = false;
      executionTooltip.style.visibility = "hidden";
      const gap = 8;
      const width = executionTooltip.offsetWidth;
      const height = executionTooltip.offsetHeight;
      const preferredLeft = snapshot.x + gap;
      const preferredTop = snapshot.y + gap;
      const left = preferredLeft + width <= chartRegion.clientWidth - gap
        ? preferredLeft
        : Math.max(gap, snapshot.x - gap - width);
      const top = preferredTop + height <= chartRegion.clientHeight - gap
        ? preferredTop
        : Math.max(gap, snapshot.y - gap - height);
      executionTooltip.style.left = `${left}px`;
      executionTooltip.style.top = `${top}px`;
      executionTooltip.style.visibility = "visible";
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const dispose of cleanup.splice(0)) dispose();
      dataTable.destroy();
    }
  };
}
