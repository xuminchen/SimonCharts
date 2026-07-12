import {
  coreIndicatorDefinitions,
  type EngineCapabilityManifest
} from "@simoncharts/chart-engine";
import type { AdjustMode, Timeframe } from "../contracts";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartWorkspaceController";
import { createIndicatorManager } from "./indicatorManager";
import { createSymbolSearch } from "./symbolSearch";

export const timeframeLabels: Record<Timeframe, string> = {
  "1m": "1分钟", "5m": "5分钟", "15m": "15分钟", "30m": "30分钟",
  "60m": "60分钟", "1d": "日线", "1w": "周线", "1mo": "月线"
};

export function createToolbarModel(manifest: EngineCapabilityManifest) {
  return {
    timeframes: [...manifest.timeframes],
    seriesTypes: [...manifest.seriesTypes],
    indicators: coreIndicatorDefinitions.filter((definition) => manifest.coreIndicatorIds.includes(definition.id)),
    priceScaleModes: [...manifest.priceScaleModes]
  };
}

export interface TopToolbar {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createTopToolbar(manifest: EngineCapabilityManifest): TopToolbar {
  const model = createToolbarModel(manifest);
  const element = document.createElement("div");
  element.className = "sc-top-toolbar";
  const symbolSearch = createSymbolSearch();
  const currentSymbol = document.createElement("span");
  currentSymbol.className = "sc-current-symbol";
  const timeframeHost = document.createElement("div");
  for (const timeframe of model.timeframes) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.timeframe = timeframe;
    button.textContent = timeframeLabels[timeframe];
    timeframeHost.append(button);
  }
  const adjust = document.createElement("select");
  adjust.dataset.testid = "adjust-select";
  for (const [value, label] of [["none", "不复权"], ["forward", "前复权"], ["backward", "后复权"]] as const) {
    const option = document.createElement("option"); option.value = value; option.textContent = label; adjust.append(option);
  }
  const series = document.createElement("select");
  series.dataset.testid = "series-type-select";
  for (const type of model.seriesTypes) { const option = document.createElement("option"); option.value = type; option.textContent = type; series.append(option); }
  const scale = document.createElement("select");
  scale.dataset.testid = "price-scale-select";
  const scaleLabels = { linear: "线性", log: "对数", percentage: "百分比" } as const;
  for (const mode of model.priceScaleModes) { const option = document.createElement("option"); option.value = mode; option.textContent = scaleLabels[mode]; scale.append(option); }
  const indicatorManager = createIndicatorManager();
  const undo = document.createElement("button"); undo.type = "button"; undo.dataset.testid = "drawing-undo"; undo.textContent = "撤销";
  const redo = document.createElement("button"); redo.type = "button"; redo.dataset.testid = "drawing-redo"; redo.textContent = "重做";
  const settings = document.createElement("div"); settings.className = "sc-toolbar-settings";
  const settingsOpen = document.createElement("button"); settingsOpen.type = "button"; settingsOpen.dataset.testid = "chart-settings-open"; settingsOpen.textContent = "设置";
  const settingsPopup = document.createElement("div"); settingsPopup.className = "sc-settings-popup"; settingsPopup.hidden = true;
  const gridLabel = document.createElement("label"); gridLabel.textContent = "网格";
  const grid = document.createElement("input"); grid.type = "checkbox"; grid.dataset.testid = "grid-visible"; gridLabel.append(grid); settingsPopup.append(gridLabel); settings.append(settingsOpen, settingsPopup);
  const bottomToggle = document.createElement("button"); bottomToggle.type = "button"; bottomToggle.dataset.testid = "bottom-panel-toggle"; bottomToggle.textContent = "下方面板";
  element.append(symbolSearch.element, currentSymbol, timeframeHost, adjust, series, scale, indicatorManager.element, undo, redo, settings, bottomToggle);
  let currentViewModel: WorkspaceViewModel | undefined;

  return {
    element,
    bind(actions) {
      const click = (event: Event) => {
        const timeframe = (event.target as HTMLElement).closest<HTMLElement>("[data-timeframe]")?.dataset.timeframe as Timeframe | undefined;
        if (timeframe) actions.setTimeframe(timeframe);
      };
      const adjustChange = () => actions.setAdjustMode(adjust.value as AdjustMode);
      const seriesChange = () => actions.setSeriesType(series.value as WorkspaceViewModel["seriesType"]);
      const scaleChange = () => actions.setPriceScaleMode(scale.value as WorkspaceViewModel["priceScaleMode"]);
      const undoClick = () => actions.undoDrawing();
      const redoClick = () => actions.redoDrawing();
      const gridChange = () => actions.setGridVisible(grid.checked);
      const settingsToggle = () => { settingsPopup.hidden = !settingsPopup.hidden; };
      const bottomClick = () => { if (currentViewModel) actions.setBottomPanel({ ...currentViewModel.bottomPanel, collapsed: !currentViewModel.bottomPanel.collapsed }); };
      timeframeHost.addEventListener("click", click); adjust.addEventListener("change", adjustChange); series.addEventListener("change", seriesChange); scale.addEventListener("change", scaleChange); undo.addEventListener("click", undoClick); redo.addEventListener("click", redoClick); grid.addEventListener("change", gridChange); settingsOpen.addEventListener("click", settingsToggle); bottomToggle.addEventListener("click", bottomClick);
      const unbindSearch = symbolSearch.bind(actions);
      const unbindIndicators = indicatorManager.bind(actions);
      return () => { timeframeHost.removeEventListener("click", click); adjust.removeEventListener("change", adjustChange); series.removeEventListener("change", seriesChange); scale.removeEventListener("change", scaleChange); undo.removeEventListener("click", undoClick); redo.removeEventListener("click", redoClick); grid.removeEventListener("change", gridChange); settingsOpen.removeEventListener("click", settingsToggle); bottomToggle.removeEventListener("click", bottomClick); unbindSearch(); unbindIndicators(); };
    },
    render(viewModel) {
      currentViewModel = viewModel;
      currentSymbol.textContent = `${viewModel.state.symbol.name} ${viewModel.state.symbol.code}`;
      for (const button of timeframeHost.querySelectorAll<HTMLButtonElement>("button")) button.setAttribute("aria-pressed", String(button.dataset.timeframe === viewModel.state.timeframe));
      adjust.value = viewModel.state.symbol.kind === "index" ? "none" : viewModel.state.adjustMode;
      adjust.disabled = viewModel.state.symbol.kind === "index";
      series.value = viewModel.seriesType;
      scale.value = viewModel.priceScaleMode;
      undo.disabled = !viewModel.canUndoDrawing;
      redo.disabled = !viewModel.canRedoDrawing;
      grid.checked = viewModel.gridVisible;
      symbolSearch.render(viewModel);
      indicatorManager.render(viewModel);
    }
  };
}
