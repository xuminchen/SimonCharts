import type { ChartSymbol, Exchange, SymbolKind } from "../contracts";

const exchanges = ["SSE", "SZSE", "BSE"] as const;
const symbolKinds = ["stock", "index"] as const;

export function parseChartSymbol(value: unknown): ChartSymbol | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const symbol = value as Partial<ChartSymbol>;
  if (
    typeof symbol.id !== "string" ||
    symbol.id.trim().length === 0 ||
    typeof symbol.code !== "string" ||
    symbol.code.trim().length === 0 ||
    typeof symbol.name !== "string" ||
    symbol.name.trim().length === 0 ||
    !exchanges.includes(symbol.exchange as Exchange) ||
    !symbolKinds.includes(symbol.kind as SymbolKind) ||
    (symbol.pricePrecision !== undefined && (
      !Number.isInteger(symbol.pricePrecision) ||
      symbol.pricePrecision < 0 ||
      symbol.pricePrecision > 8
    ))
  ) return undefined;

  return {
    id: symbol.id,
    code: symbol.code,
    name: symbol.name,
    exchange: symbol.exchange as Exchange,
    kind: symbol.kind as SymbolKind,
    ...(symbol.pricePrecision === undefined ? {} : { pricePrecision: symbol.pricePrecision })
  };
}

export function cloneChartSymbol(symbol: ChartSymbol): ChartSymbol {
  return parseChartSymbol(symbol)!;
}
