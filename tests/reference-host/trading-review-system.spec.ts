import { expect, test, type Locator, type Page } from "@playwright/test";

const username = process.env.TRADING_REVIEW_USERNAME ?? "";
const password = process.env.TRADING_REVIEW_PASSWORD ?? "";
const tradeDate = process.env.TRADING_REVIEW_TRADE_DATE ?? "";

type CapturedResponse = {
  body: Promise<string>;
  status: number;
  url: string;
};

type CapturedRequest = {
  body?: Record<string, unknown>;
  method: string;
  url: string;
};

type ReviewScenario = {
  code: string;
  draftLabel: "人工备注" | "观察条件" | "触发位";
  draftValue: string;
  step: "opportunities" | "watchlist" | "positions";
};

const scenarios: ReviewScenario[] = [
  {
    code: "600519",
    draftLabel: "人工备注",
    draftValue: "未保存：结合量价确认机会",
    step: "opportunities"
  },
  {
    code: "300750",
    draftLabel: "观察条件",
    draftValue: "未保存：突破区间上沿再关注",
    step: "watchlist"
  },
  {
    code: "000001",
    draftLabel: "触发位",
    draftValue: "未保存：跌破 10 元重新评估",
    step: "positions"
  }
];

const chartViews = [
  { adjustMode: "none", chartView: "intraday", label: "分时", seriesType: "line", timeframe: "1m" },
  { adjustMode: "none", chartView: "timeframe", label: "1分", seriesType: "candles", timeframe: "1m" },
  { adjustMode: "none", chartView: "timeframe", label: "5分", seriesType: "candles", timeframe: "5m" },
  { adjustMode: "none", chartView: "timeframe", label: "15分", seriesType: "candles", timeframe: "15m" },
  { adjustMode: "none", chartView: "timeframe", label: "30分", seriesType: "candles", timeframe: "30m" },
  { adjustMode: "none", chartView: "timeframe", label: "60分", seriesType: "candles", timeframe: "60m" },
  { adjustMode: "forward", chartView: "timeframe", label: "日", seriesType: "candles", timeframe: "1d" },
  { adjustMode: "forward", chartView: "timeframe", label: "周", seriesType: "candles", timeframe: "1w" },
  { adjustMode: "forward", chartView: "timeframe", label: "月", seriesType: "candles", timeframe: "1mo" }
] as const;

type ChartView = (typeof chartViews)[number];

const chartSwitchOrder: readonly ChartView[] = [
  chartViews[0],
  chartViews[2],
  chartViews[1],
  ...chartViews.slice(3)
];

const expectedCapabilities = [
  { timeframe: "1m", adjust_modes: ["none"] },
  { timeframe: "5m", adjust_modes: ["none"] },
  { timeframe: "15m", adjust_modes: ["none"] },
  { timeframe: "30m", adjust_modes: ["none"] },
  { timeframe: "60m", adjust_modes: ["none"] },
  { timeframe: "1d", adjust_modes: ["forward"] },
  { timeframe: "1w", adjust_modes: ["forward"] },
  { timeframe: "1mo", adjust_modes: ["forward"] }
];

const providerDataVersionPattern = /^(?:materialized|minute-parquet):[a-f0-9]+$/;

const forbiddenMinimalSelectors = [
  '[data-testid="symbol-search-input"]',
  '[data-testid="series-type-select"]',
  '[data-testid="price-scale-select"]',
  '[data-testid="drawing-palette"]',
  '[data-testid="drawing-undo"]',
  '[data-testid="drawing-redo"]',
  '[data-testid="chart-settings-open"]',
  '[data-testid="bottom-panel-toggle"]',
  ".sc-bottom-host"
].join(",");

const draftPlaceholders: Record<ReviewScenario["draftLabel"], string> = {
  人工备注: "记录观察逻辑与风险点",
  观察条件: "记录触发关注或放弃观察的条件",
  触发位: "输入止损、止盈或观察条件"
};

function stableStockId(code: string): string {
  const exchange = /^(4|8|92)/.test(code) ? "BSE" : code.startsWith("6") ? "SSE" : "SZSE";
  return `stock:${exchange}:${code}`;
}

function reviewPath(step: ReviewScenario["step"], selectedStock?: string): string {
  const params = new URLSearchParams({
    date: tradeDate,
    step,
    include_st: "false",
    include_star: "false",
    include_chinext: "false",
    include_bse: "false"
  });
  if (selectedStock) params.set("selected_stock", selectedStock);
  return `/review?${params}`;
}

function withSelectedStock(path: string, code: string): string {
  const parsed = new URL(path, "http://review.local");
  parsed.searchParams.set("selected_stock", code);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function candidate(id: string, code: string, name: string) {
  return {
    id,
    code,
    name,
    price: code === "600519" ? "1500.00" : "10.50",
    change: "+1.00%",
    bucket: "重点观察",
    opportunity_score: 80,
    risk_score: 20,
    strategies: ["S001"],
    sector: code === "600519" ? "白酒" : "银行",
    user_note: ""
  };
}

function watchlistItem(id: string, code: string, name: string) {
  return {
    id,
    code,
    name,
    sector: code === "300750" ? "电池" : "银行",
    price: code === "300750" ? 210 : 10.5,
    change: 1.2,
    source: "opportunity",
    condition: "保持观察",
    added_trade_date: tradeDate,
    is_added_today: true
  };
}

function position(id: string, code: string, name: string) {
  return {
    id,
    code,
    name,
    shares: 100,
    cost: 10,
    price: 10.5,
    market_value: 1050,
    today_pnl: 50,
    today_pnl_rate: 5,
    total_pnl: 50,
    total_pnl_rate: 5,
    portfolio_diversity: 50,
    quote_trade_date: tradeDate,
    open_price: 10,
    open_change_pct: 0,
    volume_ratio: 1,
    turnover_rate: 1,
    position_rate: "10%",
    pnl: "+50",
    action: "继续持有",
    trigger: "",
    conclusion: "",
    trigger_options: [{ label: "无", value: "", kind: "none" }],
    risk: "继续观察",
    quote_status: "ready",
    quote_message: "",
    confirmed: false
  };
}

async function installBusinessFixtures(page: Page): Promise<{ chartRequests: string[] }> {
  const chartRequests: string[] = [];
  const candidates = [
    candidate("acceptance-candidate-bank", "000001", "平安银行"),
    candidate("acceptance-candidate-liquor", "600519", "贵州茅台")
  ];
  const watchlistItems = [
    watchlistItem("acceptance-watchlist-bank", "000001", "平安银行"),
    watchlistItem("acceptance-watchlist-battery", "300750", "宁德时代")
  ];
  const positions = [
    position("acceptance-position-liquor", "600519", "贵州茅台"),
    position("acceptance-position-bank", "000001", "平安银行")
  ];

  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/chart/")) {
      chartRequests.push(url.toString());
      await route.continue();
      return;
    }
    if (url.pathname === "/api/candidates") {
      await route.fulfill({
        json: {
          data: candidates,
          total: candidates.length,
          page: 1,
          page_size: 10,
          total_pages: 1,
          has_run: true,
          latest_run: {
            strategy_run_id: "acceptance-run",
            trade_date: tradeDate,
            status: "success",
            hit_count: candidates.length,
            universe_filter: null,
            universe_filter_stale: false
          },
          bucket_counts: { "重点观察": candidates.length, "普通观察": 0, "风险观察": 0, "剔除": 0 },
          snapshot_count: candidates.length
        }
      });
      return;
    }
    if (url.pathname === `/api/review-sessions/${tradeDate}/watchlist`) {
      await route.fulfill({
        json: {
          trade_date: tradeDate,
          status: "in_progress",
          completed_at: null,
          total: watchlistItems.length,
          added_today_count: watchlistItems.length,
          conditioned_count: watchlistItems.length,
          source_counts: { opportunity: watchlistItems.length, sector: 0 },
          items: watchlistItems
        }
      });
      return;
    }
    if (url.pathname === "/api/positions") {
      await route.fulfill({ json: positions });
      return;
    }
    if (url.pathname === "/api/positions/review/status") {
      await route.fulfill({
        json: {
          trade_date: tradeDate,
          source_trade_date: tradeDate,
          snapshot_established: true,
          confirmed: false,
          no_positions: false,
          position_count: positions.length
        }
      });
      return;
    }
    if (url.pathname === "/api/capital/current") {
      await route.fulfill({
        json: {
          trade_date: tradeDate,
          amount: 20_000,
          total_market_value: 2100,
          total_cost: 2000,
          today_pnl: 100,
          today_pnl_rate: 5,
          total_pnl: 100,
          total_pnl_rate: 5,
          account_contribution_rate: 0.5,
          total_position_rate: 10.5
        }
      });
      return;
    }
    if (url.pathname === "/api/capital/history" || url.pathname === "/api/positions/transactions") {
      await route.fulfill({ json: [] });
      return;
    }
    await route.continue();
  });
  return { chartRequests };
}

async function login(page: Page, returnPath: string): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(returnPath)}`);
  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page).toHaveURL(new RegExp("/review\\?"));
}

function selectedStockButton(page: Page, code: string): Locator {
  return page.locator('button[aria-pressed="true"]').filter({ hasText: code }).first();
}

async function selectStock(page: Page, scenario: ReviewScenario): Promise<void> {
  const button = page.locator("button[aria-pressed]").filter({ hasText: scenario.code }).first();
  await expect(button).toBeVisible();
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

function embeddedChart(page: Page, code: string): Locator {
  return page.locator(`[data-testid="review-embedded-chart"][data-stock-code="${code}"]`);
}

function embeddedDraftField(wrapper: Locator, label: ReviewScenario["draftLabel"]): Locator {
  return wrapper.locator("..").getByPlaceholder(draftPlaceholders[label], { exact: true });
}

async function expectDraftValue(
  wrapper: Locator,
  label: ReviewScenario["draftLabel"],
  expected: string
): Promise<void> {
  await expect.poll(async () => embeddedDraftField(wrapper, label).inputValue()).toBe(expected);
}

async function expectEmbeddedReady(page: Page, code: string): Promise<Locator> {
  const wrapper = embeddedChart(page, code);
  await expect(wrapper).toBeVisible({ timeout: 60_000 });
  await expect(wrapper.getByTestId("trading-review-chart")).toBeVisible();
  await expect(wrapper.getByTestId("simon-chart")).toBeVisible({ timeout: 60_000 });
  await expect(wrapper.locator('.sc-workspace[data-state="ready"]')).toBeVisible({ timeout: 60_000 });
  return wrapper;
}

async function expectMinimalSurface(wrapper: Locator): Promise<void> {
  await expect(wrapper.locator(forbiddenMinimalSelectors)).toHaveCount(0);
  await expect(wrapper.locator(".sc-overlay-canvas")).toBeVisible();
}

async function expectChartViews(chart: Locator): Promise<void> {
  const more = chart.locator(".sc-timeframe-more-toggle");
  if (!await more.count()) {
    const buttons = chart.locator(".sc-timeframes button:not([hidden])");
    await expect(buttons).toHaveText(chartViews.map((view) => view.label));
    for (const button of await buttons.all()) await expect(button).toBeVisible();
    return;
  }
  await expect(chart.locator(".sc-timeframes > [data-timeframe-shortcut]:not([hidden])")).toHaveText([
    "15分", "60分", "日", "分时"
  ]);
  await more.click();
  await expect(chart.locator(".sc-timeframe-more-menu [role=menuitemradio]:not([hidden])")).toHaveText([
    "分时", "1分", "5分", "15分", "30分", "60分", "日", "周", "月"
  ]);
  await chart.page().keyboard.press("Escape");
}

async function switchChartView(page: Page, chart: Locator, view: ChartView, code: string) {
  const seriesResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/chart/series"
      && !url.searchParams.has("before_cursor")
      && url.searchParams.get("timeframe") === view.timeframe
      && url.searchParams.get("adjust_mode") === view.adjustMode;
  }, { timeout: 60_000 });
  const shortcut = chart.locator(
    `.sc-timeframes > [data-timeframe-shortcut][data-chart-view="${view.chartView}"][data-timeframe="${view.timeframe}"]`
  );
  const shortcutVisible = await shortcut.isVisible();
  if (!shortcutVisible) await chart.locator(".sc-timeframe-more-toggle").click();
  const button = shortcutVisible
    ? shortcut
    : chart.locator(
        `.sc-timeframe-more-menu [data-chart-view="${view.chartView}"][data-timeframe="${view.timeframe}"]`
      );
  await expect(button).toBeVisible();
  await button.click();
  const response = await seriesResponse;
  expect(response.status()).toBe(200);
  await expect(chart).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await expect(button).toHaveAttribute(shortcutVisible ? "aria-pressed" : "aria-checked", "true");
  await expect(chart.locator('[data-testid="adjust-select"]')).toHaveValue(view.adjustMode);
  const seriesType = chart.locator('[data-testid="series-type-select"]');
  if (await seriesType.count()) await expect(seriesType).toHaveAttribute("data-value", view.seriesType);

  const url = new URL(response.url());
  const body = await response.json();
  const requestedCutoff = Date.parse(`${tradeDate}T23:59:59.999+08:00`);
  expect(url.searchParams.get("symbol_id")).toBe(stableStockId(code));
  expect(url.searchParams.get("timeframe")).toBe(view.timeframe);
  expect(url.searchParams.get("adjust_mode")).toBe(view.adjustMode);
  expect(url.searchParams.get("data_cutoff_time")).toBe(String(requestedCutoff));
  expect(body.data_version).toMatch(providerDataVersionPattern);
  expect(body.candles.length).toBeGreaterThan(0);
  expect(body.candles.every((candle: { time: number }) => candle.time <= requestedCutoff)).toBe(true);
  return body;
}

function expectEnvironment(): void {
  expect(username, "TRADING_REVIEW_USERNAME is required").not.toBe("");
  expect(password, "TRADING_REVIEW_PASSWORD is required").not.toBe("");
  expect(tradeDate, "TRADING_REVIEW_TRADE_DATE must use the frozen accepted baseline").toBe("2026-07-15");
}

test("embedded chart is usable at 390, 768, and 1440 without page overflow", async ({ page }) => {
  test.setTimeout(180_000);
  expectEnvironment();
  const fixtures = await installBusinessFixtures(page);
  const scenario = scenarios[0];
  await login(page, reviewPath(scenario.step, scenario.code));

  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(reviewPath(scenario.step, scenario.code));
    const wrapper = await expectEmbeddedReady(page, scenario.code);
    await expectMinimalSurface(wrapper);
    await expectChartViews(wrapper.getByTestId("simon-chart"));
    await wrapper.scrollIntoViewIfNeeded();

    const bounds = await wrapper.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { height: rect.height, left: rect.left, right: rect.right, width: rect.width };
    });
    expect(bounds.height).toBeGreaterThan(200);
    expect(bounds.width).toBeGreaterThan(0);
    expect(bounds.left).toBeGreaterThanOrEqual(-1);
    expect(bounds.right).toBeLessThanOrEqual(width + 1);
    const overflow = await page.evaluate(() => ({
      body: document.body.scrollWidth - document.body.clientWidth,
      document: document.documentElement.scrollWidth - document.documentElement.clientWidth
    }));
    expect(overflow).toEqual({ body: 0, document: 0 });
    expect(new URL(page.url()).pathname).toBe("/review");
  }
  expect(fixtures.chartRequests.length).toBeGreaterThan(0);
});

test("opportunity, watchlist, and position drafts stay beside an in-place minimal chart", async ({ page }) => {
  test.setTimeout(300_000);
  expectEnvironment();
  const fixtures = await installBusinessFixtures(page);
  await login(page, reviewPath(scenarios[0].step));

  for (const scenario of scenarios) {
    const path = reviewPath(scenario.step);
    await page.goto(path);
    await selectStock(page, scenario);
    const wrapper = await expectEmbeddedReady(page, scenario.code);
    await expectMinimalSurface(wrapper);
    const chart = wrapper.getByTestId("simon-chart");
    await expectChartViews(chart);
    await expect(wrapper.getByRole("link", { name: "高级图表" })).toBeVisible();

    const draft = embeddedDraftField(wrapper, scenario.draftLabel);
    await expect(draft).toBeVisible();
    await draft.fill(scenario.draftValue);
    await expectDraftValue(wrapper, scenario.draftLabel, scenario.draftValue);
    await expect(wrapper.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
    await expectDraftValue(wrapper, scenario.draftLabel, scenario.draftValue);
    if (scenario.step === "opportunities") {
      let intradayVersion = "";
      let oneMinuteVersion = "";
      for (const view of chartSwitchOrder) {
        const body = await switchChartView(page, chart, view, scenario.code);
        if (view.chartView === "intraday") intradayVersion = body.data_version;
        if (view.chartView === "timeframe" && view.timeframe === "1m") oneMinuteVersion = body.data_version;
        expect(new URL(page.url()).pathname).toBe("/review");
        await expectDraftValue(wrapper, scenario.draftLabel, scenario.draftValue);
      }
      expect(intradayVersion).toBe(oneMinuteVersion);
    }
    if (scenario.step === "positions") {
      await expect(wrapper.locator("..").getByRole("combobox", { name: "动作", exact: true })).toBeVisible();
      await expect(page.getByText("单票复盘结论", { exact: true })).toBeVisible();
    }

    const current = new URL(page.url());
    expect(current.pathname).toBe("/review");
    expect(current.searchParams.get("step")).toBe(scenario.step);
    expect(current.pathname).not.toBe("/chart");
  }
  expect(fixtures.chartRequests.length).toBeGreaterThanOrEqual(scenarios.length);
});

test("advanced chart round-trip restores the exact selected stock in every review surface", async ({ page }) => {
  test.setTimeout(180_000);
  expectEnvironment();
  await installBusinessFixtures(page);
  await login(page, reviewPath(scenarios[0].step));

  for (const scenario of scenarios) {
    const origin = reviewPath(scenario.step);
    await page.goto(origin);
    await selectStock(page, scenario);
    const wrapper = await expectEmbeddedReady(page, scenario.code);
    const link = wrapper.getByRole("link", { name: "高级图表" });
    await expect(link).toBeVisible();

    const href = await link.getAttribute("href");
    expect(href).not.toBeNull();
    const target = new URL(href!, "http://review.local");
    expect(target.pathname).toBe("/chart");
    expect(target.searchParams.get("symbol")).toBe(stableStockId(scenario.code));
    expect(target.searchParams.get("date")).toBe(tradeDate);
    expect(target.searchParams.get("returnTo")).toBe(withSelectedStock(origin, scenario.code));

    await link.click();
    await expect(page).toHaveURL(/\/chart\?/);
    await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible({ timeout: 60_000 });
    await page.getByRole("link", { name: /返回复盘/ }).click();

    await expect(page).toHaveURL(/\/review\?/);
    const returned = new URL(page.url());
    expect(returned.pathname).toBe("/review");
    expect(returned.searchParams.get("date")).toBe(tradeDate);
    expect(returned.searchParams.get("step")).toBe(scenario.step);
    expect(returned.searchParams.get("selected_stock")).toBe(scenario.code);
    await expect(selectedStockButton(page, scenario.code)).toBeVisible();
    await expectEmbeddedReady(page, scenario.code);
  }
});

test("real advanced route preserves capabilities, cutoff, immutable history, and UI-only persistence", async ({ page }) => {
  test.setTimeout(300_000);
  expectEnvironment();
  const browserErrors: string[] = [];
  const chartRequests: CapturedRequest[] = [];
  const chartResponses: CapturedResponse[] = [];
  let captureChart = false;
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const source = message.location().url;
      browserErrors.push(source ? `${message.text()} (${source})` : message.text());
    }
  });
  page.on("request", (request) => {
    if (!captureChart || !request.url().includes("/api/chart/")) return;
    chartRequests.push({
      ...(request.method() === "POST" ? { body: request.postDataJSON() as Record<string, unknown> } : {}),
      method: request.method(),
      url: request.url()
    });
  });
  page.on("response", (response) => {
    if (!captureChart || !response.url().includes("/api/chart/")) return;
    chartResponses.push({
      body: response.text().catch(() => ""),
      status: response.status(),
      url: response.url()
    });
  });

  const fixtures = await installBusinessFixtures(page);
  const code = "000001";
  const origin = reviewPath("positions", code);
  await login(page, reviewPath("opportunities"));
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("simoncharts:")) localStorage.removeItem(key);
    }
  });
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("simoncharts:")))).toEqual([]);
  await page.goto(origin);
  const inline = await expectEmbeddedReady(page, code);
  await expectMinimalSurface(inline);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.includes(":drawings:")))).toEqual([]);

  captureChart = true;
  await inline.getByRole("link", { name: "高级图表" }).click();
  await expect(page).toHaveURL(new RegExp(`/chart\\?[^#]*symbol=${encodeURIComponent(stableStockId(code))}`));

  const workspace = page.locator('.sc-workspace[data-state="ready"]');
  await expect(workspace).toBeVisible({ timeout: 60_000 });
  await expectChartViews(workspace);
  await expect(page.locator('[data-testid="adjust-select"]')).toHaveValue("forward");
  await expect(page.getByTestId("drawing-palette")).toBeVisible();

  const canvas = page.locator(".sc-overlay-canvas");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height * 0.5);
  for (let attempt = 0; attempt < 16; attempt += 1) {
    if (chartResponses.some((response) => response.url.includes("before_cursor="))) break;
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(100);
  }
  await expect.poll(() => chartResponses.some((response) => response.url.includes("before_cursor=")), {
    timeout: 30_000
  }).toBe(true);

  const captured = await Promise.all(chartResponses.map(async (response) => ({
    ...response,
    bodyText: await response.body
  })));
  expect(captured.every((response) => response.status === 200)).toBe(true);
  const warmups = captured
    .filter((response) => response.url.includes("/api/chart/snapshots/warmup"))
    .map((response) => JSON.parse(response.bodyText));
  expect(warmups.length).toBeGreaterThan(0);
  const prepared = warmups.at(-1);
  const requestedCutoff = Date.parse(`${tradeDate}T23:59:59.999+08:00`);
  expect(prepared.requested_cutoff_time).toBe(requestedCutoff);
  expect(prepared.effective_cutoff_time).toBe(requestedCutoff);
  expect(prepared.data_version).toMatch(providerDataVersionPattern);

  const capabilities = captured
    .filter((response) => response.url.includes("/api/chart/capabilities"))
    .map((response) => JSON.parse(response.bodyText));
  expect(capabilities.at(-1)?.series).toEqual(expectedCapabilities);

  const seriesResponses = captured
    .filter((response) => response.url.includes("/api/chart/series"))
    .map((response) => ({ url: new URL(response.url), body: JSON.parse(response.bodyText) }));
  expect(seriesResponses.length).toBeGreaterThanOrEqual(2);
  expect(new Set(seriesResponses.map((response) => response.body.data_version))).toEqual(
    new Set([prepared.data_version])
  );
  for (const response of seriesResponses) {
    expect(response.body.data_version).toMatch(providerDataVersionPattern);
    expect(response.url.searchParams.get("symbol_id")).toBe(stableStockId(code));
    expect(response.url.searchParams.get("timeframe")).toBe("1d");
    expect(response.url.searchParams.get("adjust_mode")).toBe("forward");
    expect(response.url.searchParams.get("data_cutoff_time")).toBe(String(prepared.effective_cutoff_time));
    expect(response.body.candles.length).toBeGreaterThan(0);
    expect(response.body.candles.every((candle: { time: number }) => candle.time <= prepared.effective_cutoff_time)).toBe(true);
  }
  const initialSeries = seriesResponses.find((response) => !response.url.searchParams.has("before_cursor"));
  const historySeries = seriesResponses.find((response) => response.url.searchParams.has("before_cursor"));
  expect(initialSeries).toBeDefined();
  expect(historySeries).toBeDefined();
  expect(historySeries!.body.candles.at(-1).time).toBeLessThan(initialSeries!.body.candles[0].time);

  let intradayVersion = "";
  let oneMinuteVersion = "";
  for (const view of chartSwitchOrder) {
    const body = await switchChartView(page, workspace, view, code);
    if (view.chartView === "intraday") intradayVersion = body.data_version;
    if (view.chartView === "timeframe" && view.timeframe === "1m") oneMinuteVersion = body.data_version;
  }
  expect(intradayVersion).toBe(oneMinuteVersion);

  const allCaptured = await Promise.all(chartResponses.map(async (response) => ({
    ...response,
    bodyText: await response.body
  })));
  expect(allCaptured.every((response) => response.status === 200)).toBe(true);
  const allWarmups = allCaptured
    .filter((response) => response.url.includes("/api/chart/snapshots/warmup"))
    .map((response) => JSON.parse(response.bodyText));
  for (const warmup of allWarmups) {
    expect(warmup.requested_cutoff_time).toBe(requestedCutoff);
    expect(warmup.effective_cutoff_time).toBe(requestedCutoff);
    expect(warmup.data_version).toMatch(providerDataVersionPattern);
  }

  const warmupRequests = chartRequests.filter(
    (request) => request.method === "POST" && new URL(request.url).pathname === "/api/chart/snapshots/warmup"
  );
  for (const capability of expectedCapabilities) {
    expect(warmupRequests.some((request) =>
      request.body?.symbol_id === stableStockId(code)
      && request.body?.timeframe === capability.timeframe
      && request.body?.adjust_mode === capability.adjust_modes[0]
      && request.body?.data_cutoff_time === requestedCutoff
    )).toBe(true);
  }

  const allSeriesResponses = allCaptured
    .filter((response) => response.url.includes("/api/chart/series"))
    .map((response) => ({ url: new URL(response.url), body: JSON.parse(response.bodyText) }));
  for (const capability of expectedCapabilities) {
    const readable = allSeriesResponses.filter((response) =>
      !response.url.searchParams.has("before_cursor")
      && response.url.searchParams.get("timeframe") === capability.timeframe
      && response.url.searchParams.get("adjust_mode") === capability.adjust_modes[0]
    );
    expect(readable.length).toBeGreaterThan(0);
    for (const response of readable) {
      expect(response.url.searchParams.get("symbol_id")).toBe(stableStockId(code));
      expect(response.url.searchParams.get("data_cutoff_time")).toBe(String(requestedCutoff));
      expect(response.body.data_version).toMatch(providerDataVersionPattern);
      expect(response.body.candles.length).toBeGreaterThan(0);
      expect(response.body.candles.every((candle: { time: number }) => candle.time <= requestedCutoff)).toBe(true);
    }
  }

  await page.getByTestId("drawing-palette-expand").click();
  await page.getByTestId("drawing-category-basic").click();
  await page.locator('[data-drawing-tool="trendLine"]').click();
  await page.mouse.click(box!.x + box!.width * 0.35, box!.y + box!.height * 0.4);
  await page.mouse.click(box!.x + box!.width * 0.65, box!.y + box!.height * 0.6);
  await expect.poll(async () => page.evaluate(() =>
    Object.entries(localStorage).some(([key, value]) => key.includes(":drawings:") && value.includes("trendLine"))
  )).toBe(true);
  const persisted = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  const drawingKeys = Object.keys(persisted).filter((key) => key.includes(":drawings:"));
  expect(drawingKeys).toHaveLength(1);
  expect(drawingKeys.some((key) => key.endsWith(":none"))).toBe(false);
  expect(drawingKeys[0]).toContain(`:drawings:${encodeURIComponent(`cutoff:${prepared.effective_cutoff_time}`)}:`);
  expect(drawingKeys[0]).toContain(`:${encodeURIComponent(stableStockId(code))}:forward`);
  expect(Object.values(persisted).join("\n")).not.toMatch(
    /"candles"\s*:|before_cursor|data_version/
  );

  const forbiddenEvidence = [
    ...allCaptured.map((response) => response.url),
    ...allCaptured.map((response) => response.bodyText)
  ].join("\n");
  expect(forbiddenEvidence).not.toMatch(/fixture|fake|packages\/chart-(?:engine|workspace)\/src/i);

  await page.getByRole("link", { name: /返回复盘/ }).click();
  await expect(page).toHaveURL(/\/review\?/);
  const returned = new URL(page.url());
  expect(returned.searchParams.get("selected_stock")).toBe(code);
  await expect(selectedStockButton(page, code)).toBeVisible();
  const returnedInline = await expectEmbeddedReady(page, code);
  await expectMinimalSurface(returnedInline);
  expect(fixtures.chartRequests.length).toBeGreaterThan(0);
  expect(browserErrors).toEqual([]);
});
