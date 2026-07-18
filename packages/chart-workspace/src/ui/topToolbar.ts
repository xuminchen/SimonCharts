import {
  coreIndicatorDefinitions,
  type EngineCapabilityManifest
} from "@simoncharts/chart-engine";
import type {
  AdjustMode,
  ChartDataCapabilities,
  ChartFeature,
  ChartLocale,
  IntradayDayCount,
  Timeframe
} from "../contracts";
import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { FavoriteTimeframe } from "../persistence/browserPersistence";
import { createIndicatorManager } from "./indicatorManager";
import { labelsFor } from "./localization";
import { createSymbolSearch } from "./symbolSearch";

export function createToolbarModel(
  manifest: EngineCapabilityManifest,
  capabilities?: ChartDataCapabilities,
  selectedTimeframe?: Timeframe
) {
  const capability = capabilities?.series.find(
    (item) => item.timeframe === (selectedTimeframe ?? capabilities.series[0]?.timeframe)
  );
  return {
    timeframes: manifest.timeframes.filter(
      (timeframe) => capabilities === undefined || capabilities.series.some((item) => item.timeframe === timeframe)
    ),
    adjustModes: (["none", "forward", "backward"] as const).filter(
      (adjustMode) => capabilities === undefined || capability?.adjustModes.includes(adjustMode)
    ),
    seriesTypes: [...manifest.seriesTypes],
    indicators: coreIndicatorDefinitions.filter((definition) => manifest.coreIndicatorIds.includes(definition.id)),
    priceScaleModes: [...manifest.priceScaleModes]
  };
}

export interface TopToolbar {
  readonly element: HTMLDivElement;
  readonly intradayDaysElement?: HTMLSelectElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

function iconButton(button: HTMLButtonElement, label: string, icon: string): void {
  button.type = "button";
  button.textContent = icon;
  button.title = label;
  button.setAttribute("aria-label", label);
}

export function createTopToolbar(
  manifest: EngineCapabilityManifest,
  features: ReadonlySet<ChartFeature>,
  locale: ChartLocale
): TopToolbar {
  const model = createToolbarModel(manifest);
  const labels = labelsFor(locale);
  const advanced = features.has("drawing-tools") && features.has("bottom-panel");
  const element = document.createElement("div");
  element.className = "sc-top-toolbar";
  element.dataset.variant = advanced ? "advanced" : "embedded";

  const symbolGroup = document.createElement("div");
  symbolGroup.className = "sc-toolbar-group sc-symbol-group";
  const currentSymbol = document.createElement("span");
  currentSymbol.className = "sc-current-symbol";
  const symbolSearch = features.has("symbol-search") ? createSymbolSearch(labels) : undefined;
  symbolGroup.append(currentSymbol);
  if (symbolSearch) symbolGroup.append(symbolSearch.element);

  const timeframeHost = features.has("timeframes") ? document.createElement("div") : undefined;
  const intradayDays = timeframeHost ? document.createElement("select") : undefined;
  const timeframeMore = advanced && timeframeHost ? document.createElement("div") : undefined;
  const timeframeMoreToggle = timeframeMore ? document.createElement("button") : undefined;
  const timeframeMoreMenu = timeframeMore ? document.createElement("div") : undefined;
  const timeframeMenuOptions = new Map<FavoriteTimeframe, HTMLButtonElement>();
  const timeframeLabel = (timeframe: FavoriteTimeframe): string =>
    timeframe === "intraday" ? labels.intraday : labels.timeframes[timeframe];
  const createTimeframeButton = (timeframe: FavoriteTimeframe, menu: boolean): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.chartView = timeframe === "intraday" ? "intraday" : "timeframe";
    button.dataset.timeframe = timeframe === "intraday" ? "1m" : timeframe;
    button.dataset.favoriteTimeframe = timeframe;
    button.textContent = timeframeLabel(timeframe);
    if (menu) {
      button.setAttribute("role", "menuitemradio");
      button.setAttribute("aria-checked", "false");
    }
    return button;
  };
  if (timeframeHost) {
    timeframeHost.className = "sc-toolbar-group sc-timeframes";
    if (intradayDays) {
      intradayDays.className = "sc-intraday-days";
      intradayDays.dataset.testid = "intraday-days-select";
      intradayDays.setAttribute("aria-label", labels.intradayDays);
      for (let days = 1; days <= 9; days += 1) {
        const option = document.createElement("option");
        option.value = String(days);
        option.textContent = `${days}${labels.intradayDayUnit}`;
        intradayDays.append(option);
      }
      intradayDays.hidden = true;
    }
    if (advanced && timeframeMore && timeframeMoreToggle && timeframeMoreMenu) {
      timeframeMore.className = "sc-timeframe-more";
      timeframeMore.dataset.open = "false";
      timeframeMoreToggle.type = "button";
      timeframeMoreToggle.className = "sc-timeframe-more-toggle";
      timeframeMoreToggle.textContent = labels.more;
      timeframeMoreToggle.setAttribute("aria-haspopup", "menu");
      timeframeMoreToggle.setAttribute("aria-expanded", "false");
      timeframeMoreMenu.className = "sc-timeframe-more-menu";
      timeframeMoreMenu.setAttribute("role", "menu");
      timeframeMoreMenu.hidden = true;
      for (const timeframe of ["intraday", ...model.timeframes] as const) {
        const row = document.createElement("div");
        row.className = "sc-timeframe-option";
        row.setAttribute("role", "none");
        const option = createTimeframeButton(timeframe, true);
        const favorite = document.createElement("button");
        favorite.type = "button";
        favorite.className = "sc-timeframe-favorite";
        favorite.dataset.favoriteTimeframePin = timeframe;
        favorite.setAttribute("role", "menuitemcheckbox");
        favorite.setAttribute("aria-checked", "false");
        row.append(option, favorite);
        timeframeMoreMenu.append(row);
        timeframeMenuOptions.set(timeframe, option);
      }
      timeframeMore.append(timeframeMoreToggle, timeframeMoreMenu);
      timeframeHost.append(timeframeMore);
    } else {
      timeframeHost.append(createTimeframeButton("intraday", false));
      for (const timeframe of model.timeframes) timeframeHost.append(createTimeframeButton(timeframe, false));
    }
  }

  const adjust = features.has("adjustment") ? document.createElement("select") : undefined;
  if (adjust) {
    adjust.dataset.testid = "adjust-select";
    adjust.setAttribute("aria-label", locale === "zh-CN" ? "复权方式" : "Adjustment mode");
    for (const value of ["none", "forward", "backward"] as const) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = labels.adjustModes[value];
      adjust.append(option);
    }
  }

  const seriesControl = features.has("series-type") ? document.createElement("div") : undefined;
  const series = seriesControl ? document.createElement("button") : undefined;
  const seriesMenu = seriesControl ? document.createElement("div") : undefined;
  if (seriesControl && series && seriesMenu) {
    seriesControl.className = "sc-series-type";
    series.type = "button";
    series.className = "sc-series-type-toggle";
    series.dataset.testid = "series-type-select";
    series.setAttribute("aria-label", locale === "zh-CN" ? "图表类型" : "Chart type");
    series.setAttribute("aria-haspopup", "menu");
    series.setAttribute("aria-expanded", "false");
    series.textContent = "▥⌄";
    seriesMenu.className = "sc-series-type-menu";
    seriesMenu.dataset.testid = "series-type-menu";
    seriesMenu.setAttribute("role", "menu");
    seriesMenu.hidden = true;
    for (const type of model.seriesTypes) {
      const option = document.createElement("button");
      option.type = "button";
      option.dataset.seriesType = type;
      option.setAttribute("role", "menuitemradio");
      option.setAttribute("aria-checked", "false");
      option.textContent = labels.seriesTypes[type];
      seriesMenu.append(option);
    }
    seriesControl.append(series, seriesMenu);
  }

  const scale = features.has("price-scale") ? document.createElement("select") : undefined;
  if (scale) {
    scale.dataset.testid = "price-scale-select";
    scale.setAttribute("aria-label", locale === "zh-CN" ? "价格坐标" : "Price scale");
    for (const mode of model.priceScaleModes) {
      const option = document.createElement("option");
      option.value = mode;
      option.textContent = labels.priceScaleModes[mode];
      scale.append(option);
    }
  }

  const indicatorManager = features.has("indicators") ? createIndicatorManager(labels, advanced) : undefined;
  const undo = features.has("drawing-history") ? document.createElement("button") : undefined;
  if (undo) {
    undo.dataset.testid = "drawing-undo";
    iconButton(undo, labels.undo, "↶");
  }
  const redo = features.has("drawing-history") ? document.createElement("button") : undefined;
  if (redo) {
    redo.dataset.testid = "drawing-redo";
    iconButton(redo, labels.redo, "↷");
  }

  const settings = features.has("settings") ? document.createElement("div") : undefined;
  const settingsOpen = settings ? document.createElement("button") : undefined;
  const settingsPopup = settings ? document.createElement("div") : undefined;
  const grid = settings ? document.createElement("input") : undefined;
  if (settings && settingsOpen && settingsPopup && grid) {
    settings.className = "sc-toolbar-settings";
    settingsOpen.dataset.testid = "chart-settings-open";
    settingsOpen.setAttribute("aria-expanded", "false");
    iconButton(settingsOpen, labels.settings, "⚙");
    settingsPopup.className = "sc-settings-popup";
    settingsPopup.hidden = true;
    const gridLabel = document.createElement("label");
    gridLabel.textContent = labels.grid;
    grid.type = "checkbox";
    grid.dataset.testid = "grid-visible";
    gridLabel.append(grid);
    settingsPopup.append(gridLabel);
    settings.append(settingsOpen, settingsPopup);
  }

  const bottomToggle = features.has("bottom-panel") ? document.createElement("button") : undefined;
  if (bottomToggle) {
    bottomToggle.dataset.testid = "bottom-panel-toggle";
    iconButton(bottomToggle, labels.bottomPanel, "▤");
  }

  const actionGroup = document.createElement("div");
  actionGroup.className = "sc-toolbar-group sc-toolbar-actions";
  if (indicatorManager) actionGroup.append(indicatorManager.element);
  if (undo) actionGroup.append(undo);
  if (redo) actionGroup.append(redo);

  const secondaryControls: HTMLElement[] = [];
  if (adjust) secondaryControls.push(adjust);
  if (seriesControl) secondaryControls.push(seriesControl);
  if (scale) secondaryControls.push(scale);
  if (settings) secondaryControls.push(settings);
  if (bottomToggle) secondaryControls.push(bottomToggle);
  const more = advanced && secondaryControls.length > 0 ? document.createElement("div") : undefined;
  const moreToggle = more ? document.createElement("button") : undefined;
  const moreMenu = more ? document.createElement("div") : undefined;
  if (more && moreToggle && moreMenu) {
    more.className = "sc-toolbar-more";
    more.dataset.open = "false";
    moreToggle.type = "button";
    moreToggle.className = "sc-toolbar-more-toggle";
    moreToggle.textContent = labels.more;
    moreToggle.setAttribute("aria-expanded", "false");
    moreMenu.className = "sc-toolbar-more-menu";
    moreMenu.append(...secondaryControls);
    more.append(moreToggle, moreMenu);
  }

  const fullscreen = advanced ? document.createElement("button") : undefined;
  if (fullscreen) {
    fullscreen.dataset.testid = "chart-fullscreen";
    fullscreen.className = "sc-fullscreen-toggle";
    iconButton(fullscreen, labels.fullscreen, "⛶");
  }

  element.append(symbolGroup);
  if (timeframeHost) element.append(timeframeHost);
  if (actionGroup.childElementCount > 0) element.append(actionGroup);
  if (more) element.append(more);
  else element.append(...secondaryControls);
  if (fullscreen) element.append(fullscreen);
  let currentViewModel: WorkspaceViewModel | undefined;

  const renderFavoriteTimeframes = (
    viewModel: WorkspaceViewModel,
    supportedTimeframes: readonly Timeframe[]
  ): void => {
    if (!timeframeHost || !timeframeMore) return;
    for (const button of timeframeHost.querySelectorAll(":scope > [data-timeframe-shortcut]")) button.remove();
    const ordered = [
      ...model.timeframes.filter((timeframe) => viewModel.favoriteTimeframes.includes(timeframe)),
      ...(viewModel.favoriteTimeframes.includes("intraday") ? ["intraday" as const] : [])
    ];
    for (const timeframe of ordered) {
      const supported = timeframe === "intraday"
        ? supportedTimeframes.includes("1m")
        : supportedTimeframes.includes(timeframe);
      if (!supported) continue;
      const button = createTimeframeButton(timeframe, false);
      button.dataset.timeframeShortcut = "true";
      timeframeHost.insertBefore(button, timeframeMore);
    }
  };

  const renderTimeframeSelection = (viewModel: WorkspaceViewModel): void => {
    for (const button of timeframeHost?.querySelectorAll<HTMLButtonElement>("[data-timeframe]") ?? []) {
      const pressed = button.dataset.chartView === "intraday"
        ? viewModel.state.view === "intraday"
        : viewModel.state.view === "timeframe" && button.dataset.timeframe === viewModel.state.timeframe;
      if (button.getAttribute("role") === "menuitemradio") {
        button.setAttribute("aria-checked", String(pressed));
      } else {
        button.setAttribute("aria-pressed", String(pressed));
      }
    }
    for (const button of timeframeMoreMenu?.querySelectorAll<HTMLButtonElement>("[data-favorite-timeframe-pin]") ?? []) {
      const timeframe = button.dataset.favoriteTimeframePin as FavoriteTimeframe;
      const favorite = viewModel.favoriteTimeframes.includes(timeframe);
      const label = timeframeLabel(timeframe);
      const actionLabel = locale === "zh-CN"
        ? `${favorite ? "取消固定" : "固定"} ${label}`
        : `${favorite ? "Unpin" : "Pin"} ${label}`;
      button.textContent = favorite ? "★" : "☆";
      button.title = actionLabel;
      button.setAttribute("aria-label", actionLabel);
      button.setAttribute("aria-checked", String(favorite));
    }
    if (timeframeMoreToggle && timeframeMoreMenu) {
      const active = viewModel.state.view === "intraday" ? "intraday" : viewModel.state.timeframe;
      const shortcut = timeframeHost?.querySelector<HTMLButtonElement>(
        `:scope > [data-timeframe-shortcut][data-favorite-timeframe="${active}"]`
      );
      const selected = shortcut === null ? timeframeMenuOptions.get(active) : undefined;
      const selectedLabel = selected?.textContent ?? undefined;
      timeframeMoreToggle.textContent = selectedLabel === undefined ? labels.more : `${selectedLabel}⌄`;
      timeframeMoreToggle.setAttribute("aria-label", selectedLabel ?? labels.more);
    }
  };
  const closeTimeframeMore = (): void => {
    if (!timeframeMore || !timeframeMoreToggle || !timeframeMoreMenu) return;
    timeframeMore.dataset.open = "false";
    timeframeMoreToggle.setAttribute("aria-expanded", "false");
    timeframeMoreMenu.hidden = true;
  };
  const closeSeries = (): void => {
    if (!series || !seriesMenu) return;
    series.setAttribute("aria-expanded", "false");
    seriesMenu.hidden = true;
  };
  const closeMore = (): void => {
    if (!more || !moreToggle) return;
    more.dataset.open = "false";
    moreToggle.setAttribute("aria-expanded", "false");
  };

  return {
    element,
    ...(intradayDays === undefined ? {} : { intradayDaysElement: intradayDays }),
    bind(actions) {
      const cleanup: Array<() => void> = [];
      if (timeframeHost) {
        const click = (event: Event) => {
          const target = event.target as HTMLElement;
          const favorite = target.closest<HTMLButtonElement>("[data-favorite-timeframe-pin]");
          if (favorite) {
            const timeframe = favorite.dataset.favoriteTimeframePin as FavoriteTimeframe;
            actions.setFavoriteTimeframe(timeframe, favorite.getAttribute("aria-checked") !== "true");
            return;
          }
          const button = target.closest<HTMLButtonElement>("[data-timeframe]");
          const timeframe = button?.dataset.timeframe as Timeframe | undefined;
          if (!button || !timeframe) return;
          if (button.dataset.chartView === "intraday") actions.setIntradayView(true);
          else actions.setTimeframe(timeframe);
          closeTimeframeMore();
          if (currentViewModel) renderTimeframeSelection(currentViewModel);
        };
        timeframeHost.addEventListener("click", click);
        cleanup.push(() => timeframeHost.removeEventListener("click", click));
      }
      if (timeframeMore && timeframeMoreToggle && timeframeMoreMenu) {
        const click = () => {
          const open = timeframeMoreMenu.hidden;
          timeframeMore.dataset.open = String(open);
          timeframeMoreToggle.setAttribute("aria-expanded", String(open));
          timeframeMoreMenu.hidden = !open;
        };
        timeframeMoreToggle.addEventListener("click", click);
        cleanup.push(() => timeframeMoreToggle.removeEventListener("click", click));
      }
      if (intradayDays) {
        const change = () => actions.setIntradayDays(Number(intradayDays.value) as IntradayDayCount);
        intradayDays.addEventListener("change", change);
        cleanup.push(() => intradayDays.removeEventListener("change", change));
      }
      if (adjust) {
        const change = () => { actions.setAdjustMode(adjust.value as AdjustMode); closeMore(); };
        adjust.addEventListener("change", change);
        cleanup.push(() => adjust.removeEventListener("change", change));
      }
      if (series && seriesMenu) {
        const toggle = () => {
          const open = seriesMenu.hidden;
          series.setAttribute("aria-expanded", String(open));
          seriesMenu.hidden = !open;
        };
        const choose = (event: Event) => {
          const option = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-series-type]");
          if (!option) return;
          actions.setIntradayView(false);
          actions.setSeriesType(option.dataset.seriesType as WorkspaceViewModel["seriesType"]);
          if (currentViewModel) renderTimeframeSelection(currentViewModel);
          closeSeries();
          closeMore();
        };
        series.addEventListener("click", toggle);
        seriesMenu.addEventListener("click", choose);
        cleanup.push(() => series.removeEventListener("click", toggle));
        cleanup.push(() => seriesMenu.removeEventListener("click", choose));
      }
      if (scale) {
        const change = () => { actions.setPriceScaleMode(scale.value as WorkspaceViewModel["priceScaleMode"]); closeMore(); };
        scale.addEventListener("change", change);
        cleanup.push(() => scale.removeEventListener("change", change));
      }
      if (undo) {
        const click = () => actions.undoDrawing();
        undo.addEventListener("click", click);
        cleanup.push(() => undo.removeEventListener("click", click));
      }
      if (redo) {
        const click = () => actions.redoDrawing();
        redo.addEventListener("click", click);
        cleanup.push(() => redo.removeEventListener("click", click));
      }
      if (grid) {
        const change = () => actions.setGridVisible(grid.checked);
        grid.addEventListener("change", change);
        cleanup.push(() => grid.removeEventListener("change", change));
      }
      if (settingsOpen && settingsPopup) {
        const click = () => {
          settingsPopup.hidden = !settingsPopup.hidden;
          settingsOpen.setAttribute("aria-expanded", String(!settingsPopup.hidden));
        };
        settingsOpen.addEventListener("click", click);
        cleanup.push(() => settingsOpen.removeEventListener("click", click));
      }
      if (bottomToggle) {
        const click = () => {
          if (currentViewModel) actions.setBottomPanel({ ...currentViewModel.bottomPanel, collapsed: !currentViewModel.bottomPanel.collapsed });
        };
        bottomToggle.addEventListener("click", click);
        cleanup.push(() => bottomToggle.removeEventListener("click", click));
      }
      if (more && moreToggle) {
        const click = () => {
          const open = more.dataset.open !== "true";
          more.dataset.open = String(open);
          moreToggle.setAttribute("aria-expanded", String(open));
        };
        moreToggle.addEventListener("click", click);
        cleanup.push(() => moreToggle.removeEventListener("click", click));
      }
      const document = element.ownerDocument;
      const outside = (event: PointerEvent) => {
        const target = event.target as Node;
        if (timeframeMore && !timeframeMore.contains(target)) closeTimeframeMore();
        if (seriesControl && !seriesControl.contains(target)) closeSeries();
        if (more && !more.contains(target)) closeMore();
        if (settings && settingsPopup && settingsOpen && !settings.contains(target)) {
          settingsPopup.hidden = true;
          settingsOpen.setAttribute("aria-expanded", "false");
        }
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        closeTimeframeMore();
        closeSeries();
        closeMore();
        if (settingsPopup && settingsOpen) {
          settingsPopup.hidden = true;
          settingsOpen.setAttribute("aria-expanded", "false");
        }
      };
      document.addEventListener("pointerdown", outside);
      document.addEventListener("keydown", escape);
      cleanup.push(() => document.removeEventListener("pointerdown", outside));
      cleanup.push(() => document.removeEventListener("keydown", escape));
      if (fullscreen) {
        const updateFullscreen = () => {
          const active = document.fullscreenElement === element.closest(".sc-workspace");
          iconButton(fullscreen, active ? labels.exitFullscreen : labels.fullscreen, active ? "🗗" : "⛶");
          fullscreen.setAttribute("aria-pressed", String(active));
        };
        const click = () => {
          const root = element.closest<HTMLElement>(".sc-workspace");
          const request = document.fullscreenElement
            ? document.exitFullscreen()
            : root?.requestFullscreen();
          void request?.catch(() => undefined);
        };
        fullscreen.addEventListener("click", click);
        document.addEventListener("fullscreenchange", updateFullscreen);
        updateFullscreen();
        cleanup.push(() => fullscreen.removeEventListener("click", click));
        cleanup.push(() => document.removeEventListener("fullscreenchange", updateFullscreen));
      }
      if (symbolSearch) cleanup.push(symbolSearch.bind(actions));
      if (indicatorManager) cleanup.push(indicatorManager.bind(actions));
      return () => {
        for (const dispose of cleanup.splice(0)) dispose();
      };
    },
    render(viewModel) {
      currentViewModel = viewModel;
      currentSymbol.textContent = `${viewModel.state.symbol.name} ${viewModel.state.symbol.code}`;
      currentSymbol.title = `${viewModel.state.symbol.name} ${viewModel.state.symbol.code}`;
      const supported = viewModel.state.capabilities === undefined
        ? { timeframes: [] as Timeframe[], adjustModes: [] as AdjustMode[] }
        : createToolbarModel(manifest, viewModel.state.capabilities, viewModel.state.timeframe);
      if (timeframeHost) {
        renderFavoriteTimeframes(viewModel, supported.timeframes);
        for (const button of timeframeHost.querySelectorAll<HTMLButtonElement>("[data-timeframe]")) {
          const isSupported = supported.timeframes.includes(button.dataset.timeframe as Timeframe);
          const row = button.closest<HTMLDivElement>(".sc-timeframe-option");
          if (row) row.hidden = !isSupported;
          else button.hidden = !isSupported;
          button.disabled = !isSupported;
        }
        if (timeframeMoreToggle && timeframeMoreMenu) {
          timeframeMoreToggle.hidden = ![...timeframeMoreMenu.querySelectorAll<HTMLDivElement>(".sc-timeframe-option")]
            .some((row) => !row.hidden);
        }
        renderTimeframeSelection(viewModel);
      }
      if (intradayDays) {
        const supportedIntraday = supported.timeframes.includes("1m");
        intradayDays.value = String(viewModel.state.intradayDays);
        intradayDays.hidden = viewModel.state.view !== "intraday" || !supportedIntraday;
        intradayDays.disabled = viewModel.state.loading || !supportedIntraday;
      }
      if (adjust) {
        for (const option of adjust.options) {
          const isSupported = supported.adjustModes.includes(option.value as AdjustMode);
          option.hidden = !isSupported;
          option.disabled = !isSupported;
        }
        adjust.value = viewModel.state.adjustMode;
        adjust.disabled = supported.adjustModes.length <= 1;
      }
      if (series && seriesMenu) {
        series.dataset.value = viewModel.seriesType;
        series.title = labels.seriesTypes[viewModel.seriesType];
        for (const option of seriesMenu.querySelectorAll<HTMLButtonElement>("[data-series-type]")) {
          option.setAttribute("aria-checked", String(option.dataset.seriesType === viewModel.seriesType));
        }
      }
      if (scale) {
        scale.value = viewModel.priceScaleMode;
        scale.disabled = viewModel.state.view === "intraday";
      }
      if (undo) undo.disabled = !viewModel.canUndoDrawing;
      if (redo) redo.disabled = !viewModel.canRedoDrawing;
      if (grid) grid.checked = viewModel.gridVisible;
      if (bottomToggle) bottomToggle.setAttribute("aria-pressed", String(!viewModel.bottomPanel.collapsed));
      symbolSearch?.render(viewModel);
      indicatorManager?.render(viewModel);
    }
  };
}
