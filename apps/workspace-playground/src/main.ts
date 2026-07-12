import { createChartWorkspace } from "@simoncharts/chart-workspace";
import "@simoncharts/chart-workspace/styles.css";
import "./styles.css";
import { createFixtureDataSource, stock } from "./fixtures/createFixtureDataSource";

const container = document.querySelector<HTMLElement>("#app");
if (!container) throw new Error("Workspace host is missing");

createChartWorkspace(container, {
  workspaceId: "workspace-playground",
  initialSymbol: stock,
  dataSource: createFixtureDataSource()
});
