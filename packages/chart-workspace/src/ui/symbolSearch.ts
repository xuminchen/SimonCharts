import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartWorkspaceController";

export interface SymbolSearch {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

export function createSymbolSearch(): SymbolSearch {
  const element = document.createElement("div");
  element.className = "sc-symbol-search";
  const input = document.createElement("input");
  input.dataset.testid = "symbol-search-input";
  input.setAttribute("aria-label", "搜索标的");
  const popup = document.createElement("div");
  popup.className = "sc-symbol-search-popup";
  popup.setAttribute("role", "listbox");
  popup.hidden = true;
  element.append(input, popup);
  let actions: WorkspaceUiActions | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let results: WorkspaceViewModel["search"]["results"] = [];

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const onInput = () => {
        if (timer !== undefined) clearTimeout(timer);
        const query = input.value.trim();
        if (query.length === 0) return;
        timer = setTimeout(() => actions?.searchSymbols(query), 200);
      };
      const onClick = (event: Event) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>("[data-symbol-index]");
        if (!target) return;
        const symbol = results[Number(target.dataset.symbolIndex)];
        if (symbol) actions?.setSymbol(symbol);
      };
      input.addEventListener("input", onInput);
      popup.addEventListener("click", onClick);
      return () => {
        if (timer !== undefined) clearTimeout(timer);
        input.removeEventListener("input", onInput);
        popup.removeEventListener("click", onClick);
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
        retry.textContent = "重试";
        retry.addEventListener("click", () => actions?.retrySearch(), { once: true });
        popup.append(error, retry);
      }
      popup.hidden = results.length === 0 && !viewModel.search.error;
    }
  };
}
