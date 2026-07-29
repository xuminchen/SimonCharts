import type { WorkspaceUiActions, WorkspaceViewModel } from "../controller/chartController";
import type { ChartLabels } from "./localization";

export interface SymbolSearch {
  readonly element: HTMLDivElement;
  bind(actions: WorkspaceUiActions): () => void;
  render(viewModel: WorkspaceViewModel): void;
}

let nextSymbolSearchId = 0;

export function createSymbolSearch(labels: ChartLabels): SymbolSearch {
  const id = `sc-symbol-search-${++nextSymbolSearchId}`;
  const element = document.createElement("div");
  element.className = "sc-symbol-search";
  const input = document.createElement("input");
  input.dataset.testid = "symbol-search-input";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-label", labels.searchSymbol);
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", `${id}-listbox`);
  input.setAttribute("aria-busy", "false");
  input.placeholder = labels.searchSymbol;
  input.autocomplete = "off";
  input.spellcheck = false;
  const popup = document.createElement("div");
  popup.className = "sc-symbol-search-popup";
  popup.hidden = true;
  const listbox = document.createElement("div");
  listbox.id = `${id}-listbox`;
  listbox.setAttribute("role", "listbox");
  listbox.setAttribute("aria-label", labels.searchSymbol);
  const message = document.createElement("div");
  message.className = "sc-symbol-search-message";
  message.hidden = true;
  const status = document.createElement("span");
  status.className = "sc-visually-hidden";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  popup.append(listbox, message);
  element.append(input, popup, status);
  let actions: WorkspaceUiActions | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let results: WorkspaceViewModel["search"]["results"] = [];
  let activeIndex = -1;
  let renderedQuery = "";
  let dismissed = false;

  const setExpanded = (expanded: boolean): void => {
    popup.hidden = !expanded;
    input.setAttribute("aria-expanded", String(expanded));
    if (!expanded) input.removeAttribute("aria-activedescendant");
  };
  const paintActive = (scroll = false): void => {
    const options = [...listbox.querySelectorAll<HTMLElement>("[role=option]")];
    for (const [index, option] of options.entries()) {
      option.setAttribute("aria-selected", String(index === activeIndex));
    }
    const active = options[activeIndex];
    if (!active || popup.hidden) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", active.id);
    if (scroll) active.scrollIntoView({ block: "nearest" });
  };
  const close = (): void => {
    dismissed = true;
    activeIndex = -1;
    setExpanded(false);
  };
  const select = (index: number): void => {
    const symbol = results[index];
    if (!symbol) return;
    dismissed = true;
    activeIndex = -1;
    input.value = "";
    setExpanded(false);
    actions?.searchSymbols("");
    actions?.setSymbol(symbol);
    input.focus({ preventScroll: true });
  };

  return {
    element,
    bind(nextActions) {
      actions = nextActions;
      const updateQuery = () => {
        dismissed = false;
        activeIndex = -1;
        results = [];
        renderedQuery = "";
        listbox.replaceChildren();
        message.replaceChildren();
        message.hidden = true;
        status.textContent = "";
        setExpanded(false);
        if (timer !== undefined) clearTimeout(timer);
        actions?.searchSymbols("");
        const query = input.value.trim();
        if (query.length === 0) return;
        timer = setTimeout(() => actions?.searchSymbols(query), 200);
      };
      const onInput = (event: Event) => {
        if (!(event as InputEvent).isComposing) updateQuery();
      };
      const onCompositionEnd = () => updateQuery();
      const onClick = (event: Event) => {
        const target = event.target as HTMLElement;
        if (target.closest<HTMLElement>("[data-search-retry]")) {
          dismissed = false;
          input.focus({ preventScroll: true });
          actions?.retrySearch();
          return;
        }
        const option = target.closest<HTMLElement>("[data-symbol-index]");
        if (option) select(Number(option.dataset.symbolIndex));
      };
      const onPointerMove = (event: PointerEvent) => {
        const option = (event.target as HTMLElement).closest<HTMLElement>("[data-symbol-index]");
        if (!option) return;
        activeIndex = Number(option.dataset.symbolIndex);
        paintActive();
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.target === input && event.isComposing) return;
        if (event.key === "Escape" && element.contains(element.ownerDocument.activeElement)) {
          event.preventDefault();
          close();
          input.focus({ preventScroll: true });
          return;
        }
        if (event.target !== input || event.isComposing) return;
        if (event.key === "Tab") {
          if (!message.querySelector("[data-search-retry]")) close();
          return;
        }
        if (results.length === 0) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          dismissed = false;
          setExpanded(true);
          activeIndex = event.key === "ArrowDown"
            ? Math.min(results.length - 1, activeIndex + 1)
            : activeIndex < 0 ? results.length - 1 : Math.max(0, activeIndex - 1);
          paintActive(true);
          return;
        }
        if (activeIndex >= 0 && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          activeIndex = -1;
          paintActive();
          return;
        }
        if (activeIndex >= 0 && (event.key === "Home" || event.key === "End")) {
          event.preventDefault();
          activeIndex = event.key === "Home" ? 0 : results.length - 1;
          paintActive(true);
          return;
        }
        if (!popup.hidden && event.key === "Enter" && activeIndex >= 0) {
          event.preventDefault();
          select(activeIndex);
        }
      };
      const outside = (event: PointerEvent) => {
        if (!element.contains(event.target as Node)) close();
      };
      const onFocusOut = (event: FocusEvent) => {
        if (!(event.relatedTarget instanceof Node) || !element.contains(event.relatedTarget)) close();
      };
      input.addEventListener("input", onInput);
      input.addEventListener("compositionend", onCompositionEnd);
      popup.addEventListener("click", onClick);
      popup.addEventListener("pointermove", onPointerMove);
      element.addEventListener("keydown", onKeyDown);
      element.addEventListener("focusout", onFocusOut);
      element.ownerDocument.addEventListener("pointerdown", outside);
      return () => {
        if (timer !== undefined) clearTimeout(timer);
        input.removeEventListener("input", onInput);
        input.removeEventListener("compositionend", onCompositionEnd);
        popup.removeEventListener("click", onClick);
        popup.removeEventListener("pointermove", onPointerMove);
        element.removeEventListener("keydown", onKeyDown);
        element.removeEventListener("focusout", onFocusOut);
        element.ownerDocument.removeEventListener("pointerdown", outside);
        actions = undefined;
      };
    },
    render(viewModel) {
      const query = input.value.trim();
      const matches = query.length > 0 && viewModel.search.query === query;
      if (renderedQuery !== viewModel.search.query) activeIndex = -1;
      renderedQuery = viewModel.search.query;
      results = matches ? viewModel.search.results : [];
      listbox.replaceChildren();
      for (const [index, symbol] of results.entries()) {
        const option = document.createElement("button");
        option.type = "button";
        option.id = `${id}-option-${index}`;
        option.tabIndex = -1;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === activeIndex));
        option.dataset.symbolIndex = String(index);
        option.textContent = `${symbol.name} ${symbol.code} · ${symbol.exchange}`;
        listbox.append(option);
      }
      if (activeIndex >= results.length) activeIndex = -1;
      message.replaceChildren();
      message.hidden = true;
      const error = matches ? viewModel.search.error : undefined;
      if (error) {
        const text = document.createElement("span");
        text.textContent = error.message;
        message.append(text);
        if (error.recoverable) {
          const retry = document.createElement("button");
          retry.type = "button";
          retry.dataset.searchRetry = "true";
          retry.textContent = labels.retry;
          message.append(retry);
        }
        message.hidden = false;
      } else if (matches && !viewModel.search.loading && results.length === 0) {
        message.textContent = labels.noSearchResults;
        message.hidden = false;
      }
      input.setAttribute("aria-busy", String(matches && viewModel.search.loading));
      const nextStatus = !matches
        ? ""
        : viewModel.search.loading
          ? labels.searchingSymbols
          : error?.message ?? (
              results.length === 0
                ? labels.noSearchResults
                : labels.searchResultCount(results.length)
            );
      if (status.textContent !== nextStatus) status.textContent = nextStatus;
      const expanded =
        !dismissed &&
        matches &&
        !viewModel.search.loading &&
        (results.length > 0 || !message.hidden);
      setExpanded(expanded);
      paintActive(activeIndex >= 0);
    }
  };
}
