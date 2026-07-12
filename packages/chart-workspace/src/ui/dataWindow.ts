import type { DataWindowSnapshot } from "../runtime/chartEngineRuntime";

export interface DataWindow {
  readonly element: HTMLDivElement;
  render(snapshot: DataWindowSnapshot | undefined): void;
}

function format(value: number | undefined): string {
  return value === undefined ? "--" : value.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

export function createDataWindow(): DataWindow {
  const element = document.createElement("div");
  element.className = "sc-data-window";
  return {
    element,
    render(snapshot) {
      element.replaceChildren();
      const rows: Array<[string, string, string?]> = snapshot
        ? [
            ["时间", snapshot.formattedTime],
            ["开", format(snapshot.candle.open), "data-window-open"],
            ["高", format(snapshot.candle.high)],
            ["低", format(snapshot.candle.low)],
            ["收", format(snapshot.candle.close)],
            ["涨跌", format(snapshot.change)],
            ["涨跌幅", `${format(snapshot.changePercent)}%`],
            ["成交量", format(snapshot.candle.volume)],
            ["成交额", format(snapshot.candle.turnover)],
            ...snapshot.indicatorRows.map((row) => [row.label, row.value, `data-window-indicator-${row.id}`] as [string, string, string])
          ]
        : [["时间", "--"], ["开", "--", "data-window-open"], ["高", "--"], ["低", "--"], ["收", "--"], ["涨跌", "--"], ["涨跌幅", "--"], ["成交量", "--"], ["成交额", "--"]];
      for (const [label, value, testId] of rows) {
        const row = document.createElement("div");
        row.className = "sc-data-window-row";
        const name = document.createElement("span");
        name.textContent = label;
        const output = document.createElement("strong");
        output.textContent = value;
        if (testId) output.dataset.testid = testId;
        row.append(name, output);
        element.append(row);
      }
    }
  };
}
