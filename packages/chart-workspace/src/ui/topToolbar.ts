import {
  coreIndicatorDefinitions,
  type EngineCapabilityManifest,
  type SeriesType
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
import {
  maxFavoriteTimeframes,
  type FavoriteTimeframe
} from "../persistence/browserPersistence";
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

const seriesTypeIconShapes: Readonly<Record<SeriesType, string>> = {
  bars: '<path d="M4 2v16M2 6h2M4 13h3M12 4v13M9 9h3M12 14h3M20 1v16M17 5h3M20 12h2"/>',
  candles: '<path d="M6 1v18M17 2v16"/><rect x="3" y="5" width="6" height="8" fill="currentColor"/><rect x="14" y="8" width="6" height="7" fill="currentColor"/>',
  hollowCandles: '<path d="M6 1v18M17 2v16"/><rect x="3" y="5" width="6" height="8"/><rect x="14" y="8" width="6" height="7"/>',
  volumeCandles: '<path d="M5 1v12M15 2v10"/><rect x="2" y="4" width="6" height="6" fill="currentColor"/><rect x="12" y="5" width="6" height="5" fill="currentColor"/><path d="M1 18V14M5 18v-5M9 18v-3M13 18v-6M17 18v-4M21 18v-7"/>',
  line: '<path d="M1 16 6 10l4 3 5-9 4 4 4-5"/>',
  lineWithMarkers: '<path d="M1 16 6 10l4 3 5-9 4 4 4-5"/><circle cx="6" cy="10" r="1.5" fill="currentColor"/><circle cx="15" cy="4" r="1.5" fill="currentColor"/>',
  stepLine: '<path d="M1 16h6V11h6V6h5V2h5"/>',
  area: '<path d="M1 16 6 10l4 3 5-9 4 4 4-5v15H1Z" fill="currentColor" opacity=".28"/><path d="M1 16 6 10l4 3 5-9 4 4 4-5"/>',
  hlcArea: '<path d="M1 13 6 8l5 2 5-7 7 4v8l-7-3-5 5-5-2-5 3Z" fill="currentColor" opacity=".22"/><path d="M1 13 6 8l5 2 5-7 7 4M1 18l5-3 5 2 5-5 7 3"/>',
  baseline: '<path d="M1 16 6 10l4 3 5-9 4 4 4-5"/><path d="M1 12h22" stroke-dasharray="2 2"/>',
  columns: '<rect x="2" y="10" width="4" height="8" fill="currentColor"/><rect x="10" y="4" width="4" height="14" fill="currentColor"/><rect x="18" y="7" width="4" height="11" fill="currentColor"/>',
  highLow: '<path d="M5 3v15M3 3h4M3 18h4M13 6v10M11 6h4M11 16h4M21 1v13M19 1h4M19 14h4"/>',
  heikinAshi: '<path d="M6 1v18M17 2v16"/><rect x="3" y="5" width="6" height="8" fill="currentColor" opacity=".55"/><rect x="14" y="7" width="6" height="8" fill="currentColor" opacity=".85"/>',
  renko: '<path d="m2 13 5-5 5 5-5 5Zm10-6 5-5 5 5-5 5Z" fill="currentColor" opacity=".75"/>',
  lineBreak: '<rect x="2" y="9" width="5" height="9" fill="currentColor"/><rect x="9" y="4" width="5" height="10"/><rect x="16" y="1" width="5" height="8" fill="currentColor"/>',
  kagi: '<path d="M2 17V8h7V3h6v11h7"/><path d="M9 8v8" stroke-width="2.5"/>',
  pointAndFigure: '<path d="m2 3 6 6m0-6L2 9m0 3 6 6m0-6-6 6"/><circle cx="17" cy="6" r="4"/><circle cx="17" cy="15" r="4"/>'
};

function createSeriesTypeIcon(type: SeriesType): SVGSVGElement {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 20");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.5");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.classList.add("sc-series-type-icon");
  icon.dataset.seriesIcon = type;
  icon.innerHTML = seriesTypeIconShapes[type];
  icon.setAttribute("aria-hidden", "true");
  return icon;
}

export function createTopToolbar(
  manifest: EngineCapabilityManifest,
  features: ReadonlySet<ChartFeature>,
  locale: ChartLocale,
  studyTitleFor?: (config: Readonly<WorkspaceViewModel["indicators"][number]>) => string
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
  const primarySymbolSearchEnabled = features.has("symbol-search");
  const comparisonEnabled = features.has("symbol-compare");
  const symbolSearch = primarySymbolSearchEnabled || comparisonEnabled
    ? createSymbolSearch(labels)
    : undefined;
  symbolGroup.append(currentSymbol);
  if (symbolSearch) symbolGroup.append(symbolSearch.element);

  const comparisonGroup = comparisonEnabled ? document.createElement("div") : undefined;
  const comparisonToggle = comparisonGroup && symbolSearch ? document.createElement("button") : undefined;
  const comparisonChips = comparisonGroup ? document.createElement("div") : undefined;
  if (comparisonGroup && comparisonChips) {
    comparisonGroup.className = "sc-toolbar-group sc-comparison-group";
    comparisonChips.className = "sc-comparison-chips";
    comparisonChips.setAttribute("role", "list");
    comparisonChips.setAttribute("aria-label", labels.comparisonSymbols);
    if (comparisonToggle) {
      comparisonToggle.type = "button";
      comparisonToggle.dataset.testid = "symbol-compare-toggle";
      comparisonToggle.className = "sc-symbol-compare-toggle";
      comparisonToggle.textContent = `+ ${labels.compareSymbol}`;
      comparisonToggle.title = labels.addComparisonSymbol;
      comparisonToggle.setAttribute("aria-label", labels.addComparisonSymbol);
      comparisonToggle.setAttribute("aria-pressed", "false");
      comparisonGroup.append(comparisonToggle);
    }
    comparisonGroup.append(comparisonChips);
    if (!primarySymbolSearchEnabled && symbolSearch && comparisonToggle) {
      symbolSearch.setMode("comparison");
      comparisonToggle.setAttribute("aria-pressed", "true");
    }
  }

  const timeframeHost = features.has("timeframes") ? document.createElement("div") : undefined;
  const intradayDays = timeframeHost ? document.createElement("select") : undefined;
  const timeframeMore = advanced && timeframeHost ? document.createElement("div") : undefined;
  const timeframeMoreToggle = timeframeMore ? document.createElement("button") : undefined;
  const timeframeMoreMenu = timeframeMore ? document.createElement("div") : undefined;
  const favoriteLimitToast = timeframeMore ? document.createElement("div") : undefined;
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
    const chevron = document.createElement("span");
    chevron.className = "sc-menu-chevron";
    chevron.textContent = "⌄";
    chevron.setAttribute("aria-hidden", "true");
    series.append(createSeriesTypeIcon("candles"), chevron);
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
      const label = document.createElement("span");
      label.className = "sc-series-type-label";
      label.textContent = labels.seriesTypes[type];
      option.append(createSeriesTypeIcon(type), label);
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

  const indicatorManager = features.has("indicators")
    ? createIndicatorManager(labels, advanced, studyTitleFor)
    : undefined;
  const executionsToggle = features.has("executions") ? document.createElement("button") : undefined;
  if (executionsToggle) {
    executionsToggle.dataset.testid = "executions-toggle";
    iconButton(executionsToggle, labels.executions, "B/S");
  }
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
  if (executionsToggle) actionGroup.append(executionsToggle);
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
  if (comparisonGroup) element.append(comparisonGroup);
  if (timeframeHost) element.append(timeframeHost);
  if (actionGroup.childElementCount > 0) element.append(actionGroup);
  if (more) element.append(more);
  else element.append(...secondaryControls);
  if (fullscreen) element.append(fullscreen);
  if (favoriteLimitToast) {
    favoriteLimitToast.className = "sc-toolbar-toast";
    favoriteLimitToast.dataset.testid = "favorite-timeframe-limit";
    favoriteLimitToast.setAttribute("role", "status");
    favoriteLimitToast.setAttribute("aria-live", "polite");
    favoriteLimitToast.hidden = true;
    const warning = document.createElement("span");
    warning.className = "sc-toolbar-toast-icon";
    warning.textContent = "!";
    const message = document.createElement("span");
    message.textContent = locale === "zh-CN"
      ? `最多固定 ${maxFavoriteTimeframes} 个周期，请先取消一个`
      : `Pin up to ${maxFavoriteTimeframes} timeframes; unpin one first`;
    favoriteLimitToast.append(warning, message);
    element.append(favoriteLimitToast);
  }
  let currentViewModel: WorkspaceViewModel | undefined;
  let favoriteLimitTimer: ReturnType<typeof setTimeout> | undefined;

  const showFavoriteLimit = (): void => {
    if (!favoriteLimitToast) return;
    favoriteLimitToast.hidden = false;
    if (favoriteLimitTimer !== undefined) clearTimeout(favoriteLimitTimer);
    favoriteLimitTimer = setTimeout(() => {
      favoriteLimitToast.hidden = true;
      favoriteLimitTimer = undefined;
    }, 2_500);
  };

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
  const renderComparisons = (viewModel: WorkspaceViewModel): void => {
    if (!comparisonChips) return;
    comparisonChips.replaceChildren();
    for (const comparison of viewModel.comparisons) {
      const label = `${comparison.symbol.name} ${comparison.symbol.code}`;
      const visible = comparison.visible !== false;
      const status = viewModel.comparisonStatuses.find(
        (item) => item.symbolId === comparison.symbol.id
      )?.status ?? (visible ? "loading" : "hidden");
      const statusLabel = status === "ready"
        ? labels.comparisonReady
        : status === "empty"
          ? labels.comparisonNoData
          : status === "unsupported"
            ? labels.comparisonUnsupported
            : status === "error"
              ? labels.comparisonLoadFailed
              : status === "hidden" ? labels.comparisonHidden : labels.comparisonLoading;
      const chip = document.createElement("div");
      chip.className = "sc-comparison-chip";
      chip.dataset.comparisonSymbolId = comparison.symbol.id;
      chip.dataset.visible = String(visible);
      chip.dataset.status = status;
      chip.setAttribute("role", "listitem");
      const swatch = document.createElement("span");
      swatch.className = "sc-comparison-swatch";
      swatch.style.backgroundColor = comparison.color ?? "currentColor";
      swatch.setAttribute("aria-hidden", "true");
      const visibility = document.createElement("button");
      visibility.type = "button";
      visibility.className = "sc-comparison-visibility";
      visibility.dataset.comparisonAction = "visibility";
      visibility.dataset.symbolId = comparison.symbol.id;
      visibility.textContent = label;
      visibility.title = `${label} · ${statusLabel}`;
      visibility.setAttribute("aria-pressed", String(visible));
      visibility.setAttribute(
        "aria-label",
        `${visible ? labels.hideComparisonSymbol : labels.showComparisonSymbol}: ${label}, ${statusLabel}`
      );
      const statusText = document.createElement("span");
      statusText.className = "sc-comparison-status";
      statusText.textContent = statusLabel;
      statusText.hidden = status === "ready";
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "sc-comparison-remove";
      remove.dataset.comparisonAction = "remove";
      remove.dataset.symbolId = comparison.symbol.id;
      remove.textContent = "×";
      remove.setAttribute("aria-label", `${labels.removeComparisonSymbol}: ${label}`);
      chip.append(swatch, visibility, statusText, remove);
      comparisonChips.append(chip);
    }
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
            const next = favorite.getAttribute("aria-checked") !== "true";
            if (!actions.setFavoriteTimeframe(timeframe, next)) showFavoriteLimit();
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
      if (comparisonToggle && symbolSearch) {
        const click = () => {
          if (!primarySymbolSearchEnabled) {
            symbolSearch.focus();
            return;
          }
          const active = comparisonToggle.getAttribute("aria-pressed") !== "true";
          comparisonToggle.setAttribute("aria-pressed", String(active));
          symbolSearch.setMode(active ? "comparison" : "primary");
          if (active) symbolSearch.focus();
        };
        comparisonToggle.addEventListener("click", click);
        cleanup.push(() => comparisonToggle.removeEventListener("click", click));
      }
      if (comparisonChips) {
        const click = (event: Event) => {
          const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-comparison-action]");
          const symbolId = button?.dataset.symbolId;
          if (!button || !symbolId || !currentViewModel) return;
          if (button.dataset.comparisonAction === "remove") {
            actions.setComparisons(
              currentViewModel.comparisons.filter((comparison) => comparison.symbol.id !== symbolId)
            );
            return;
          }
          actions.setComparisons(currentViewModel.comparisons.map((comparison) =>
            comparison.symbol.id === symbolId
              ? { ...comparison, visible: comparison.visible === false }
              : comparison
          ));
        };
        comparisonChips.addEventListener("click", click);
        cleanup.push(() => comparisonChips.removeEventListener("click", click));
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
      if (executionsToggle) {
        const click = () => actions.setExecutionsVisible(!currentViewModel!.executionsVisible);
        executionsToggle.addEventListener("click", click);
        cleanup.push(() => executionsToggle.removeEventListener("click", click));
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
        if (favoriteLimitTimer !== undefined) clearTimeout(favoriteLimitTimer);
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
          const favorite = viewModel.favoriteTimeframes.includes(
            button.dataset.favoriteTimeframe as FavoriteTimeframe
          );
          if (row) row.hidden = !isSupported && !favorite;
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
        series.replaceChildren(
          createSeriesTypeIcon(viewModel.seriesType),
          Object.assign(document.createElement("span"), {
            className: "sc-menu-chevron",
            textContent: "⌄"
          })
        );
        series.disabled = viewModel.state.view === "intraday";
        if (series.disabled) closeSeries();
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
      if (executionsToggle) executionsToggle.setAttribute("aria-pressed", String(viewModel.executionsVisible));
      if (grid) grid.checked = viewModel.gridVisible;
      if (bottomToggle) bottomToggle.setAttribute("aria-pressed", String(!viewModel.bottomPanel.collapsed));
      renderComparisons(viewModel);
      symbolSearch?.render(viewModel);
      indicatorManager?.render(viewModel);
    }
  };
}
