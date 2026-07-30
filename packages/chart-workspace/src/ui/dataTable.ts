import type { DataTableSnapshot } from "../runtime/dataTable";
import type { ChartLabels } from "./localization";

export interface DataTableView {
  readonly element: HTMLDivElement;
  bind(onBack: () => void): () => void;
  render(snapshot: Readonly<DataTableSnapshot>): void;
  setVisible(visible: boolean): void;
  focus(): void;
  destroy(): void;
}

const batchSize = 250;

export function createDataTableView(labels: ChartLabels): DataTableView {
  const element = document.createElement("div");
  element.className = "sc-data-table-view";
  element.dataset.testid = "chart-data-table";
  element.hidden = true;

  const header = document.createElement("div");
  header.className = "sc-data-table-header";
  const title = document.createElement("strong");
  title.textContent = labels.dataTable;
  const back = document.createElement("button");
  back.type = "button";
  back.dataset.testid = "data-table-back";
  back.textContent = labels.chartView;
  header.append(title, back);

  const scroll = document.createElement("div");
  scroll.className = "sc-data-table-scroll";
  scroll.tabIndex = 0;
  scroll.setAttribute("role", "region");
  scroll.setAttribute("aria-label", labels.dataTable);
  const table = document.createElement("table");
  const caption = document.createElement("caption");
  caption.textContent = labels.dataTable;
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  table.append(caption, head, body);
  scroll.append(table);
  element.append(header, scroll);

  let current: Readonly<DataTableSnapshot> | undefined;
  let rendered = 0;

  const appendRows = () => {
    if (current === undefined || rendered >= current.rows.length) return;
    const fragment = document.createDocumentFragment();
    const end = Math.min(current.rows.length, rendered + batchSize);
    for (let index = rendered; index < end; index += 1) {
      const source = current.rows[index]!;
      const row = document.createElement("tr");
      row.dataset.time = String(source.time);
      source.cells().forEach((value, cellIndex) => {
        const cell = document.createElement("td");
        cell.dataset.columnId = current!.columns[cellIndex]?.id ?? "";
        cell.textContent = value;
        row.append(cell);
      });
      fragment.append(row);
    }
    body.append(fragment);
    rendered = end;
  };

  const onScroll = () => {
    if (scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 160) {
      appendRows();
    }
  };
  scroll.addEventListener("scroll", onScroll);

  return {
    element,
    bind(onBack) {
      back.addEventListener("click", onBack);
      return () => back.removeEventListener("click", onBack);
    },
    render(snapshot) {
      if (snapshot === current) return;
      current = snapshot;
      rendered = 0;
      head.replaceChildren();
      body.replaceChildren();
      const row = document.createElement("tr");
      for (const column of snapshot.columns) {
        const cell = document.createElement("th");
        cell.scope = "col";
        cell.dataset.columnId = column.id;
        cell.textContent = column.label;
        if (column.id === "time") cell.setAttribute("aria-sort", "descending");
        if (column.color) cell.style.color = column.color;
        row.append(cell);
      }
      head.append(row);
      if (snapshot.rows.length === 0) {
        const emptyRow = document.createElement("tr");
        const empty = document.createElement("td");
        empty.colSpan = Math.max(1, snapshot.columns.length);
        empty.textContent = snapshot.status === "loading"
          ? labels.dataTableLoading
          : snapshot.status === "blocked"
            ? labels.dataTableBlocked
            : labels.noData;
        emptyRow.append(empty);
        body.append(emptyRow);
        return;
      }
      appendRows();
    },
    setVisible(visible) {
      element.hidden = !visible;
    },
    focus() {
      scroll.focus({ preventScroll: true });
    },
    destroy() {
      scroll.removeEventListener("scroll", onScroll);
      current = undefined;
      head.replaceChildren();
      body.replaceChildren();
    }
  };
}
