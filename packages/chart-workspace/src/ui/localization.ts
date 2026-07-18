import type { PriceScaleMode, SeriesType } from "@simoncharts/chart-engine";
import type { AdjustMode, ChartLocale, Timeframe } from "../contracts";

export interface ChartLabels {
  readonly intraday: string;
  readonly intradayChart: string;
  readonly intradayDays: string;
  readonly intradayDayUnit: string;
  readonly timeframes: Readonly<Record<Timeframe, string>>;
  readonly adjustModes: Readonly<Record<AdjustMode, string>>;
  readonly seriesTypes: Readonly<Record<SeriesType, string>>;
  readonly priceScaleModes: Readonly<Record<PriceScaleMode, string>>;
  readonly searchSymbol: string;
  readonly indicators: string;
  readonly undo: string;
  readonly redo: string;
  readonly settings: string;
  readonly grid: string;
  readonly bottomPanel: string;
  readonly more: string;
  readonly fullscreen: string;
  readonly exitFullscreen: string;
  readonly select: string;
  readonly objects: string;
  readonly properties: string;
  readonly dataWindow: string;
  readonly resetView: string;
  readonly showGrid: string;
  readonly hideGrid: string;
  readonly shanghaiTime: string;
  readonly retry: string;
}

const seriesTypes: Record<ChartLocale, Record<SeriesType, string>> = {
  "zh-CN": {
    bars: "美国线（Bars）",
    candles: "蜡烛图（Candles）",
    hollowCandles: "空心蜡烛图（Hollow Candles）",
    volumeCandles: "成交量蜡烛图（Volume Candles）",
    line: "线形图（Line）",
    lineWithMarkers: "带标记线（Line with Markers）",
    stepLine: "阶梯线（Step Line）",
    area: "面积图（Area）",
    hlcArea: "HLC 区域（HLC Area）",
    baseline: "基准线（Baseline）",
    columns: "柱状图（Columns）",
    highLow: "高低图（High-Low）",
    heikinAshi: "平均 K 线（Heikin Ashi）",
    renko: "砖形图（Renko）",
    lineBreak: "新价线（Line Break）",
    kagi: "卡吉图（Kagi）",
    pointAndFigure: "点数图（Point & Figure）"
  },
  "en-US": {
    bars: "Bars",
    candles: "Candles",
    hollowCandles: "Hollow candles",
    volumeCandles: "Volume candles",
    line: "Line",
    lineWithMarkers: "Line with markers",
    stepLine: "Step line",
    area: "Area",
    hlcArea: "HLC area",
    baseline: "Baseline",
    columns: "Columns",
    highLow: "High-low",
    heikinAshi: "Heikin Ashi",
    renko: "Renko",
    lineBreak: "Line break",
    kagi: "Kagi",
    pointAndFigure: "Point & figure"
  }
};

export function labelsFor(locale: ChartLocale): ChartLabels {
  if (locale === "en-US") {
    return {
      intraday: "Intraday",
      intradayChart: "Intraday chart",
      intradayDays: "Intraday days",
      intradayDayUnit: "D",
      timeframes: { "1m": "1 min", "5m": "5 min", "15m": "15 min", "30m": "30 min", "60m": "60 min", "1d": "1 day", "1w": "1 week", "1mo": "1 month" },
      adjustModes: { none: "Unadjusted", forward: "Forward adjusted", backward: "Backward adjusted" },
      seriesTypes: seriesTypes[locale],
      priceScaleModes: { linear: "Linear", log: "Logarithmic", percentage: "Percentage" },
      searchSymbol: "Search symbol",
      indicators: "Indicators",
      undo: "Undo",
      redo: "Redo",
      settings: "Settings",
      grid: "Grid",
      bottomPanel: "Inspector",
      more: "More",
      fullscreen: "Fullscreen",
      exitFullscreen: "Exit fullscreen",
      select: "Select",
      objects: "Objects",
      properties: "Properties",
      dataWindow: "Data window",
      resetView: "Reset view",
      showGrid: "Show grid",
      hideGrid: "Hide grid",
      shanghaiTime: "Asia/Shanghai",
      retry: "Retry"
    };
  }
  return {
    intraday: "分时",
    intradayChart: "分时图",
    intradayDays: "多日分时",
    intradayDayUnit: "日",
    timeframes: { "1m": "1分", "5m": "5分", "15m": "15分", "30m": "30分", "60m": "60分", "1d": "日", "1w": "周", "1mo": "月" },
    adjustModes: { none: "不复权", forward: "前复权", backward: "后复权" },
    seriesTypes: seriesTypes[locale],
    priceScaleModes: { linear: "线性", log: "对数", percentage: "百分比" },
    searchSymbol: "搜索标的",
    indicators: "指标",
    undo: "撤销",
    redo: "重做",
    settings: "设置",
    grid: "网格",
    bottomPanel: "检查器",
    more: "更多",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    select: "选择",
    objects: "对象",
    properties: "属性",
    dataWindow: "数据窗口",
    resetView: "复位视图",
    showGrid: "显示网格",
    hideGrid: "隐藏网格",
    shanghaiTime: "Asia/Shanghai",
    retry: "重试"
  };
}
