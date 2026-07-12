import type {
  WorkspaceUiActions,
  WorkspaceViewModel
} from "../controller/chartWorkspaceController";
import { createBottomPanel } from "./bottomPanel";
import { createErrorPanel } from "./errorPanel";
import { createTopToolbar } from "./topToolbar";

export interface WorkspaceShell {
  readonly root: HTMLDivElement;
  readonly chartRegion: HTMLDivElement;
  readonly staticCanvas: HTMLCanvasElement;
  readonly overlayCanvas: HTMLCanvasElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
  destroy(): void;
}

export function createWorkspaceShell(): WorkspaceShell {
  const root = document.createElement("div");
  root.className = "sc-workspace";
  root.dataset.state = "loading";
  const toolbar = createTopToolbar();
  const chartRegion = document.createElement("div");
  chartRegion.className = "sc-chart-region";
  const staticCanvas = document.createElement("canvas");
  staticCanvas.className = "sc-chart-canvas sc-static-canvas";
  const overlayCanvas = document.createElement("canvas");
  overlayCanvas.className = "sc-chart-canvas sc-overlay-canvas";
  overlayCanvas.tabIndex = 0;
  const paletteHost = document.createElement("div");
  paletteHost.className = "sc-drawing-palette-host";
  const errorPanel = createErrorPanel();
  chartRegion.append(staticCanvas, overlayCanvas, paletteHost, errorPanel.element);
  const resizer = document.createElement("div");
  resizer.className = "sc-bottom-resizer";
  const bottomPanel = createBottomPanel();
  const bottomHost = document.createElement("div");
  bottomHost.className = "sc-bottom-host";
  bottomHost.append(resizer, bottomPanel.element);
  root.append(toolbar.element, chartRegion, bottomHost);
  const cleanup: Array<() => void> = [];
  let destroyed = false;

  return {
    root,
    chartRegion,
    staticCanvas,
    overlayCanvas,
    bind(actions) {
      let startY = 0;
      let startHeight = 0;
      const move = (event: PointerEvent) => {
        const maximum = Math.floor(root.clientHeight * 0.4);
        actions.setBottomPanel({
          height: Math.max(120, Math.min(maximum, startHeight + startY - event.clientY)),
          collapsed: false,
          activeTab: "objects"
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      const down = (event: PointerEvent) => {
        startY = event.clientY;
        startHeight = bottomPanel.element.getBoundingClientRect().height;
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      };
      resizer.addEventListener("pointerdown", down);
      const unbind = () => {
        resizer.removeEventListener("pointerdown", down);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      cleanup.push(unbind);
      return unbind;
    },
    render(viewModel) {
      root.dataset.state =
        viewModel.status.type === "readyWithWarning"
          ? "ready-with-warning"
          : viewModel.status.type;
      toolbar.render(viewModel);
      bottomPanel.render(viewModel);
      errorPanel.render(viewModel.status);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const dispose of cleanup.splice(0)) dispose();
    }
  };
}
