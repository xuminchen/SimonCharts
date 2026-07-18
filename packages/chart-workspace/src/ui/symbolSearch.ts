import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { ChartLabels } from "./localization";

export interface SymbolSearch {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createSymbolSearch(labels: ChartLabels): SymbolSearch {
  const element = document.createElement("div");
  element.className = "sc-symbol-search";
  const input = document.createElement("input");
  input.dataset.testid = "symbol-search-input";
  input.setAttribute("aria-label", labels.searchSymbol);
  input.placeholder = labels.searchSymbol;
  input.autocomplete = "off";
  input.spellcheck = false;
  const popup = document.createElement("div");
  popup.className = "sc-symbol-search-popup";
  popup.setAttribute("role", "listbox");
  popup.hidden = true;
  element.append(input, popup);
  let actions: WorkspaceUiActions | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let results: WorkspaceViewModel["search"]["results"] = [];
  let dismissed = false;

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const onInput = () => {
        dismissed = false;
        if (timer !== undefined) clearTimeout(timer);
        const query = input.value.trim();
        if (query.length === 0) return;
        timer = setTimeout(() => actions?.searchSymbols(query), 200);
      };
      const onClick = (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-symbol-index]");
        if (!target) return;
        const symbol = results[Number(target.dataset.symbolIndex)];
        if (symbol) {
          dismissed = true;
          popup.hidden = true;
          input.value = "";
          actions?.setSymbol(symbol);
        }
      };
      const outside = (event: PointerEvent) => {
        if (!element.contains(event.target as Node)) {
          dismissed = true;
          popup.hidden = true;
        }
      };
      const escape = (event: KeyboardEvent) => {
        if (event.key !== "Escape") return;
        dismissed = true;
        popup.hidden = true;
        input.blur();
      };
      input.addEventListener("input", onInput);
      popup.addEventListener("click", onClick);
      element.ownerDocument.addEventListener("pointerdown", outside);
      element.ownerDocument.addEventListener("keydown", escape);
      return () => {
        if (timer !== undefined) clearTimeout(timer);
        input.removeEventListener("input", onInput);
        popup.removeEventListener("click", onClick);
        element.ownerDocument.removeEventListener("pointerdown", outside);
        element.ownerDocument.removeEventListener("keydown", escape);
      };
    },
    render(viewModel) {
      results = viewModel.search.results;
      popup.replaceChildren();
      for (const [index, symbol] of results.entries()) {
        const option = document.createElement("button");
        option.type = "button";
        option.setAttribute("role", "option");
        option.dataset.symbolIndex = String(index);
        option.textContent = `${symbol.name} ${symbol.code}`;
        popup.append(option);
      }
      if (viewModel.search.error) {
        const error = document.createElement("span");
        error.textContent = viewModel.search.error.message;
        const retry = document.createElement("button");
        retry.type = "button";
        retry.textContent = labels.retry;
        retry.addEventListener("click", () => actions?.retrySearch(), { once: true });
        popup.append(error, retry);
      }
      popup.hidden = dismissed || (results.length === 0 && !viewModel.search.error);
    }
  };
}
