import type {
  BuiltInDrawingType,
  DrawingToolCategory,
  PriceScaleMode,
  SeriesType
} from "@simoncharts/chart-engine";
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
  readonly drawingCategories: Readonly<Record<DrawingToolCategory, string>>;
  readonly drawingTools: Readonly<Partial<Record<BuiltInDrawingType, string>>>;
  readonly searchSymbol: string;
  readonly compareSymbol: string;
  readonly addComparisonSymbol: string;
  readonly comparisonSymbols: string;
  readonly showComparisonSymbol: string;
  readonly hideComparisonSymbol: string;
  readonly removeComparisonSymbol: string;
  readonly comparisonLoading: string;
  readonly comparisonReady: string;
  readonly comparisonNoData: string;
  readonly comparisonUnsupported: string;
  readonly comparisonLoadFailed: string;
  readonly comparisonHidden: string;
  readonly searchingSymbols: string;
  readonly noSearchResults: string;
  readonly searchResultCount: (count: number) => string;
  readonly indicators: string;
  readonly studyLimitReached: string;
  readonly studyNoLongerExists: string;
  readonly undo: string;
  readonly redo: string;
  readonly settings: string;
  readonly grid: string;
  readonly bottomPanel: string;
  readonly executions: string;
  readonly replay: string;
  readonly replayPlay: string;
  readonly replayPause: string;
  readonly replayStep: string;
  readonly replaySpeed: string;
  readonly replayExit: string;
  readonly more: string;
  readonly fullscreen: string;
  readonly exitFullscreen: string;
  readonly select: string;
  readonly objects: string;
  readonly createDrawingGroup: string;
  readonly renameDrawingGroup: string;
  readonly selectDrawingGroup: string;
  readonly showObject: string;
  readonly hideObject: string;
  readonly lockObject: string;
  readonly unlockObject: string;
  readonly moveObjectForward: string;
  readonly moveObjectBackward: string;
  readonly ungroupDrawingGroup: string;
  readonly deleteDrawingGroupDrawings: string;
  readonly properties: string;
  readonly dataWindow: string;
  readonly dataTable: string;
  readonly chartView: string;
  readonly dataTableLoading: string;
  readonly dataTableBlocked: string;
  readonly noData: string;
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

const drawingCategories: Record<ChartLocale, Record<DrawingToolCategory, string>> = {
  "zh-CN": {
    basic: "趋势线工具",
    channel: "通道",
    fibonacci: "斐波那契",
    annotation: "标注",
    shape: "形状",
    path: "笔刷与箭头",
    position: "仓位",
    measurement: "测量",
    gann: "江恩",
    pitchfork: "音叉",
    pattern: "形态",
    forecast: "预测"
  },
  "en-US": {
    basic: "Trend Line Tools",
    channel: "Channels",
    fibonacci: "Fibonacci",
    annotation: "Annotations",
    shape: "Shapes",
    path: "Brushes & Arrows",
    position: "Positions",
    measurement: "Measurement",
    gann: "Gann",
    pitchfork: "Pitchforks",
    pattern: "Patterns",
    forecast: "Forecast"
  }
};

const zhDrawingTools: Record<BuiltInDrawingType, string> = {
  trendLine: "趋势线",
  ray: "射线",
  extendedLine: "延长线",
  horizontalLine: "水平线",
  verticalLine: "垂直线",
  crossLine: "十字线",
  segment: "线段",
  straightLine: "直线",
  rayLine: "射线线段",
  horizontalRayLine: "水平射线",
  horizontalSegment: "水平线段",
  horizontalStraightLine: "水平直线",
  verticalRayLine: "垂直射线",
  verticalSegment: "垂直线段",
  verticalStraightLine: "垂直直线",
  priceLine: "价格线",
  parallelChannel: "平行通道",
  regressionChannel: "回归通道",
  priceChannelLine: "价格通道",
  fibonacciRetracement: "斐波那契回撤",
  fibonacciExtension: "斐波那契扩展",
  fibTrendBasedExtension: "趋势斐波那契扩展",
  fibTimeZone: "斐波那契时间周期",
  fibFan: "斐波那契扇形",
  fibArc: "斐波那契弧线",
  fibChannel: "斐波那契通道",
  fibWedge: "斐波那契楔形",
  text: "文本",
  callout: "标注气泡",
  simpleAnnotation: "便笺",
  simpleTag: "标签",
  rectangle: "矩形",
  rotatedRectangle: "旋转矩形",
  circle: "圆",
  ellipse: "椭圆",
  polygon: "多边形",
  triangle: "三角形",
  arc: "弧形",
  curve: "曲线",
  path: "路径",
  brush: "笔刷",
  arrow: "箭头",
  longPosition: "多头仓位",
  shortPosition: "空头仓位",
  profitLossRange: "盈亏范围",
  datePriceRange: "日期和价格范围",
  dateRange: "日期范围",
  priceRange: "价格范围",
  measure: "测量",
  trendAngle: "趋势线角度",
  gannFan: "江恩扇形",
  gannBox: "江恩箱",
  gannSquare: "江恩正方形",
  pitchfork: "安德鲁音叉",
  schiffPitchfork: "Schiff 音叉",
  modifiedSchiffPitchfork: "改良 Schiff 音叉",
  insidePitchfork: "内部音叉",
  elliottImpulseWave: "艾略特脉冲波浪（12345）",
  elliottCorrectionWave: "艾略特校正波浪（ABC）",
  xabcdPattern: "XABCD 形态",
  cypherPattern: "赛福形态",
  headAndShouldersPattern: "头肩形态",
  forecastPath: "预测路径"
};

const drawingTools: Record<ChartLocale, Partial<Record<BuiltInDrawingType, string>>> = {
  "en-US": {},
  "zh-CN": zhDrawingTools
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
      drawingCategories: drawingCategories[locale],
      drawingTools: drawingTools[locale],
      searchSymbol: "Search symbol",
      compareSymbol: "Compare",
      addComparisonSymbol: "Add comparison symbol",
      comparisonSymbols: "Comparison symbols",
      showComparisonSymbol: "Show comparison symbol",
      hideComparisonSymbol: "Hide comparison symbol",
      removeComparisonSymbol: "Remove comparison symbol",
      comparisonLoading: "Loading",
      comparisonReady: "Ready",
      comparisonNoData: "No data",
      comparisonUnsupported: "Unsupported",
      comparisonLoadFailed: "Load failed",
      comparisonHidden: "Hidden",
      searchingSymbols: "Searching symbols",
      noSearchResults: "No symbols found",
      searchResultCount: (count) => `${count} symbol${count === 1 ? "" : "s"} found`,
      indicators: "Indicators",
      studyLimitReached: "A chart supports at most 32 studies",
      studyNoLongerExists: "This study no longer exists",
      undo: "Undo",
      redo: "Redo",
      settings: "Settings",
      grid: "Grid",
      bottomPanel: "Inspector",
      executions: "Executions",
      replay: "Historical replay",
      replayPlay: "Play replay",
      replayPause: "Pause replay",
      replayStep: "Next bar",
      replaySpeed: "Replay speed",
      replayExit: "Exit replay",
      more: "More",
      fullscreen: "Fullscreen",
      exitFullscreen: "Exit fullscreen",
      select: "Select",
      objects: "Objects",
      createDrawingGroup: "Create group",
      renameDrawingGroup: "Rename group",
      selectDrawingGroup: "Select group",
      showObject: "Show",
      hideObject: "Hide",
      lockObject: "Lock",
      unlockObject: "Unlock",
      moveObjectForward: "Move forward",
      moveObjectBackward: "Move backward",
      ungroupDrawingGroup: "Ungroup",
      deleteDrawingGroupDrawings: "Delete drawings",
      properties: "Properties",
      dataWindow: "Data window",
      dataTable: "Data table",
      chartView: "Chart view",
      dataTableLoading: "Loading data",
      dataTableBlocked: "Data unavailable",
      noData: "No data",
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
    drawingCategories: drawingCategories[locale],
    drawingTools: drawingTools[locale],
    searchSymbol: "搜索标的",
    compareSymbol: "比较",
    addComparisonSymbol: "添加比较标的",
    comparisonSymbols: "比较标的",
    showComparisonSymbol: "显示比较标的",
    hideComparisonSymbol: "隐藏比较标的",
    removeComparisonSymbol: "移除比较标的",
    comparisonLoading: "加载中",
    comparisonReady: "已就绪",
    comparisonNoData: "无数据",
    comparisonUnsupported: "不支持",
    comparisonLoadFailed: "加载失败",
    comparisonHidden: "已隐藏",
    searchingSymbols: "正在搜索标的",
    noSearchResults: "没有找到标的",
    searchResultCount: (count) => `找到 ${count} 个标的`,
    indicators: "指标",
    studyLimitReached: "每个图表最多支持 32 个指标",
    studyNoLongerExists: "该指标已不存在",
    undo: "撤销",
    redo: "重做",
    settings: "设置",
    grid: "网格",
    bottomPanel: "检查器",
    executions: "成交标记",
    replay: "历史回放",
    replayPlay: "播放回放",
    replayPause: "暂停回放",
    replayStep: "下一根 K 线",
    replaySpeed: "回放速度",
    replayExit: "退出回放",
    more: "更多",
    fullscreen: "全屏",
    exitFullscreen: "退出全屏",
    select: "选择",
    objects: "对象",
    createDrawingGroup: "新建组",
    renameDrawingGroup: "重命名组",
    selectDrawingGroup: "选择组",
    showObject: "显示",
    hideObject: "隐藏",
    lockObject: "锁定",
    unlockObject: "解锁",
    moveObjectForward: "上移",
    moveObjectBackward: "下移",
    ungroupDrawingGroup: "解散组",
    deleteDrawingGroupDrawings: "删除图形",
    properties: "属性",
    dataWindow: "数据窗口",
    dataTable: "数据表",
    chartView: "图表视图",
    dataTableLoading: "正在加载数据",
    dataTableBlocked: "数据不可用",
    noData: "暂无数据",
    resetView: "复位视图",
    showGrid: "显示网格",
    hideGrid: "隐藏网格",
    shanghaiTime: "Asia/Shanghai",
    retry: "重试"
  };
}
