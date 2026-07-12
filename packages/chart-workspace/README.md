# @simoncharts/chart-workspace

Private, `UNLICENSED` browser chart workspace package for approved SimonCharts partners.

## Install a delivered package

```bash
npm install ./simoncharts-chart-workspace-1.0.0-rc.0.tgz
```

## Mount the workspace

```ts
import {
  createChartWorkspace,
  type ChartWorkspaceDataSource
} from "@simoncharts/chart-workspace";
import "@simoncharts/chart-workspace/styles.css";

const dataSource: ChartWorkspaceDataSource = {
  async searchSymbols(query, signal) {
    return searchSymbolsFromHost(query, signal);
  },
  async loadSeries(request, signal) {
    return loadSeriesFromHost(request, signal);
  }
};

const workspace = createChartWorkspace(container, {
  workspaceId: "partner-chart",
  initialSymbol,
  dataSource
});

// Call when the host page unmounts.
workspace.destroy();
```

The host supplies symbol search and cursor-paged candle data through the two public methods above.
