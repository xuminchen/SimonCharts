import {
  calculateCoreIndicator,
  createChartEngine,
  deserializeDrawingObject,
  fixtureDailyCandleSeries,
  serializeDrawingObject
} from "@simoncharts/chart-engine";

const engine = createChartEngine({
  series: fixtureDailyCandleSeries,
  seriesType: "candles"
});

engine.setViewport({
  visibleRange: { from: 5, to: 25 },
  candleWidth: 8,
  scrollOffset: 0,
  priceScaleMode: "linear"
});

const drawing = deserializeDrawingObject(
  serializeDrawingObject({
    id: "host-drawing-1",
    type: "trendLine",
    anchors: [
      { x: 0, y: 0, time: fixtureDailyCandleSeries.candles[0].time, price: 10 },
      { x: 80, y: 80, time: fixtureDailyCandleSeries.candles[10].time, price: 20 }
    ]
  })
);

engine.setDrawings([drawing]);

const macd = calculateCoreIndicator("MACD", fixtureDailyCandleSeries);

if (engine.getState().viewport.visibleRange.from !== 5) {
  throw new Error("Package consumer failed to update viewport");
}

if (engine.getState().drawings.length !== 1) {
  throw new Error("Package consumer failed to round-trip drawings");
}

if (!macd.outputs.some((output) => output.panelId === "MACD")) {
  throw new Error("Package consumer failed to calculate MACD outputs");
}

engine.destroy();
console.log("Package consumer smoke test passed.");
