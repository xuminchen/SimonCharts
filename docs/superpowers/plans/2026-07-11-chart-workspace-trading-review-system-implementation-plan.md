# TradingReviewSystem Chart Workspace Host Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/Users/xuminchen/Desktop/TradingReviewSystem` the first real host of the packed commercial workspace, with authenticated symbol search, exact cursor-paged market series, and a full-screen `/chart` route.

**Architecture:** Add a chart-specific provider/service boundary to FastAPI instead of stretching the existing review-summary and position-intraday models. The Next host maps snake_case HTTP responses to the public workspace contracts and mounts only the installed `.tgz`; SimonCharts remains unaware of TradingReviewSystem.

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy, Pydantic, pytest, existing Tushare/AKShare configuration, Next.js 16, React 19, TypeScript 5.7, packed `@simoncharts/chart-workspace`.

## Global Constraints

- Working repository: `/Users/xuminchen/Desktop/TradingReviewSystem`.
- Preserve the existing uncommitted user change in `src/app/globals.css`; this plan never edits that file.
- Update `/Users/xuminchen/Documents/Simon/30_Projects/TradingReviewSystem/TradingReviewSystem.md` only after implementation and validation.
- Install a real versioned `@simoncharts/chart-workspace` `.tgz`; do not use a source-directory dependency, workspace symlink, engine package, internal subpath, or SimonCharts source import.
- Backend endpoints are authenticated by the existing middleware and expose only safe errors.
- Search results contain A-share stocks plus the six existing `P0_INDEXES`; no ETF or other asset types.
- Exact timeframes: `1m`, `5m`, `15m`, `30m`, `60m`, `1d`, `1w`, `1mo`.
- Stock modes: `none`, `forward`, `backward`; index mode: `none` only.
- Never derive missing OHLC candles from `StockDaily` summaries, `IndexDaily` display strings, `IntradayPricePoint` prices, or any synthetic/interpolated formula.
- A provider capability failure returns `CHART_COMBINATION_UNAVAILABLE`; it never silently downgrades timeframe/adjustment or switches semantics.
- Market-data rights and provider permissions remain the host/operator's responsibility. Tushare's current official minute-data documentation requires separate permission and states research/learning restrictions; do not represent that feed as generally licensed for partner commercial redistribution.
- Existing provider evidence:
  - AKShare stock minute history documents `1/5/15/30/60`, but `1m` is recent and unadjusted: <https://akshare.akfamily.xyz/data/stock/stock.html>.
  - AKShare index minute history is current/recent rather than all history: <https://akshare.akfamily.xyz/data/index/index.html>.
  - Tushare documents separately permissioned `1/5/15/30/60` historical minutes: <https://tushare.pro/document/1?doc_id=234>.
- “All history” means all history the configured, authorized provider declares available for that exact combination.
- Phase 3 cannot turn green until the operator supplies and authorizes a provider/snapshot service that both covers the approved exact matrix and honors `ChartProviderSnapshot`; direct AKShare/Tushare calls without revision-addressable snapshot semantics are not sufficient.
- Every task begins with a failing test, ends with focused verification, and creates one reviewable commit in the repository that owns its changed files.

---

## File Structure

### Create

- `backend/app/chart_data.py` — symbol registry, provider protocol, cursor codec, page service, safe domain errors.
- `backend/tests/test_chart_api.py` — chart provider/service/API contract tests.
- `src/lib/chartWorkspaceDataSource.ts` — browser data-source adapter and snake_case mapping.
- `src/components/ChartWorkspaceHost.tsx` — client lifecycle bridge.
- `src/app/chart/page.tsx` — protected full-screen chart route.
- `src/app/chart/chart-page.module.css` — host container only; does not touch global styles.
- `vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz` — immutable Phase 2 acceptance artifact.
- `/Users/xuminchen/Desktop/SimonCharts/playwright.trading-review.config.ts`, `tests/reference-host/trading-review-system.spec.ts`, `scripts/check-trading-review-host.mjs` — reusable automated real-host core gate, expanded in Phase 4.

### Modify

- `backend/app/market_data_providers.py` — provider-specific exact chart-series methods and capability manifests.
- `backend/app/schemas.py` — chart response schemas.
- `backend/app/main.py` — two authenticated GET routes and safe error mapping.
- `backend/tests/test_market_data_real_pipeline.py` — provider normalization/capability tests.
- `package.json`, `package-lock.json` — local `.tgz` dependency.
- `next.config.mjs` — remove stale engine transpile reference; no source transpilation dependency.
- `src/components/AppShell.tsx` — add `/chart` navigation entry only.
- `/Users/xuminchen/Documents/Simon/30_Projects/TradingReviewSystem/TradingReviewSystem.md` — status/decision/change log after completion.

## Task 1: Chart Symbol And Series HTTP Schemas

**Files:**
- Modify: `backend/app/schemas.py`
- Create: `backend/tests/test_chart_api.py`

**Interfaces:**
- Produces: `ChartSymbolResponse`, `ChartCandleResponse`, `ChartSeriesPageResponse`, exact `Literal` aliases.
- Consumed by: chart service/routes and frontend adapter.

- [ ] **Step 1: Write failing schema validation tests**

Create `test_chart_api.py` with:

```python
from collections.abc import Iterator

from fastapi.testclient import TestClient
from pydantic import ValidationError
import pytest
from sqlalchemy.orm import Session

from app.database import SessionLocal, init_db
from app.main import app, create_auth_token
from app.schemas import ChartCandleResponse, ChartSeriesPageResponse, ChartSymbolResponse


@pytest.fixture(autouse=True)
def reset_chart_database() -> Iterator[None]:
    init_db(drop_existing=True)
    yield


@pytest.fixture
def session() -> Iterator[Session]:
    with SessionLocal() as database_session:
        yield database_session


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app, headers={"Authorization": f"Bearer {create_auth_token()}"}) as test_client:
        yield test_client


@pytest.fixture
def anonymous_client() -> Iterator[TestClient]:
    with TestClient(app) as test_client:
        yield test_client


def test_chart_schemas_accept_only_approved_market_values() -> None:
    symbol = ChartSymbolResponse(
        id="stock:SSE:600000",
        code="600000",
        name="浦发银行",
        exchange="SSE",
        kind="stock",
    )
    candle = ChartCandleResponse(
        time=1_750_000_000_000,
        open=10.0,
        high=10.5,
        low=9.8,
        close=10.2,
        volume=1000,
        turnover=10_200,
    )
    page = ChartSeriesPageResponse(
        candles=[candle],
        before_cursor="opaque",
        has_more_before=True,
        data_version="provider:snapshot-1",
    )
    assert symbol.kind == "stock"
    assert page.candles[0].close == 10.2

    with pytest.raises(ValidationError):
        ChartSymbolResponse(id="etf:SSE:510300", code="510300", name="ETF", exchange="SSE", kind="etf")
```

- [ ] **Step 2: Run and verify schemas are absent**

Run:

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q
```

Expected: collection FAIL because chart schema classes do not exist.

Keep these fixtures local to `test_chart_api.py`; current `backend/tests/conftest.py` configures only the test database URL and does not provide `session` or clients. Task 3 adds its deterministic `fake_provider` fixture beside the fake class. Commit or roll back seeded session rows explicitly before an API request reads them.

- [ ] **Step 3: Add exact Pydantic contracts**

Use:

```python
ChartSymbolKind = Literal["stock", "index"]
ChartExchange = Literal["SSE", "SZSE", "BSE"]
ChartTimeframe = Literal["1m", "5m", "15m", "30m", "60m", "1d", "1w", "1mo"]
ChartAdjustMode = Literal["none", "forward", "backward"]


class ChartSymbolResponse(BaseModel):
    id: str
    code: str
    name: str
    exchange: ChartExchange
    kind: ChartSymbolKind


class ChartCandleResponse(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    turnover: float


class ChartSeriesPageResponse(BaseModel):
    candles: list[ChartCandleResponse]
    before_cursor: str | None = None
    has_more_before: bool
    data_version: str
```

- [ ] **Step 4: Run schema tests**

Run:

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q
```

Expected: PASS for the schema-only test.

- [ ] **Step 5: Commit**

```bash
git add backend/app/schemas.py backend/tests/test_chart_api.py
git commit -m "feat(chart): define workspace API schemas"
```

## Task 2: Stable Stock And Major-Index Search

**Files:**
- Create: `backend/app/chart_data.py`
- Modify: `backend/tests/test_chart_api.py`

**Interfaces:**
- Consumes: `StockBasic`, existing `P0_INDEXES`, SQLAlchemy session.
- Produces: `search_chart_symbols(session, query, limit=50)` and `parse_chart_symbol_id`.

- [ ] **Step 1: Write failing search tests**

Seed `StockBasic` for Shanghai, Shenzhen, and Beijing prefixes and assert:

```python
def test_search_chart_symbols_returns_stocks_and_registered_indexes(session) -> None:
    rows = search_chart_symbols(session, "000001")
    assert [(row.id, row.kind) for row in rows] == [
        ("stock:SZSE:000001", "stock"),
        ("index:SSE:000001", "index"),
    ]


def test_search_chart_symbols_maps_beijing_exchange(session) -> None:
    rows = search_chart_symbols(session, "北交")
    assert rows[0].exchange == "BSE"


def test_search_chart_symbols_never_returns_etf(session) -> None:
    assert all(row.kind in {"stock", "index"} for row in search_chart_symbols(session, ""))
```

- [ ] **Step 2: Run and verify search is absent**

Run:

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q -k search_chart_symbols
```

Expected: FAIL because `search_chart_symbols` does not exist.

- [ ] **Step 3: Implement stable ids and exchange mapping**

Use the persisted board classification first, then an explicit code fallback:

```python
def stock_exchange(code: str, board: str) -> ChartExchange:
    if board == "北交所" or code.startswith(("4", "8", "92")):
        return "BSE"
    if code.startswith("6"):
        return "SSE"
    return "SZSE"


def stock_symbol_id(code: str, board: str) -> str:
    return f"stock:{stock_exchange(code, board)}:{code}"
```

Add focused cases for `600000/主板 → SSE`, `000001/主板 → SZSE`, and `920001/北交所 → BSE`. Build index entries only from the six `P0_INDEXES`, converting `ts_code` suffixes to `SSE`/`SZSE`. Query stock code/name with SQL `contains`, merge with matching indexes, sort exact code match first then kind/code, and cap at 50. Do not query ETFs or infer indexes from `IndexDaily` display rows.

- [ ] **Step 4: Run focused tests**

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q -k search_chart_symbols
```

Expected: PASS with stable ids and exactly the approved kinds.

- [ ] **Step 5: Commit**

```bash
git add backend/app/chart_data.py backend/tests/test_chart_api.py
git commit -m "feat(chart): add stable symbol search"
```

## Task 3: Exact Chart Provider Contract And Capability Rejection

**Files:**
- Modify: `backend/app/chart_data.py`
- Modify: `backend/app/market_data_providers.py`
- Modify: `backend/tests/test_chart_api.py`
- Modify: `backend/tests/test_market_data_real_pipeline.py`

**Interfaces:**
- Produces: `ChartSeriesProvider`, `ChartProviderCapabilities`, `ProviderChartPage`, safe `ChartDataError`.
- Consumed by: pagination service.

- [ ] **Step 1: Write failing exact-combination tests with a fake provider**

Use:

```python
def test_provider_rejects_unsupported_combination_without_downgrade() -> None:
    provider = FakeChartProvider(
        capabilities=ChartProviderCapabilities(
            stock={"1d": {"none", "forward", "backward"}},
            index={"1d": {"none"}},
        )
    )
    with pytest.raises(ChartDataError) as error:
        select_chart_provider([provider], stock_symbol, "1m", "forward")
    assert error.value.code == "CHART_COMBINATION_UNAVAILABLE"
    assert provider.requests == []
    assert provider.snapshot_requests == []
```

Add provider-normalization tests requiring strict ascending epoch milliseconds, positive finite OHLC, nonnegative volume/turnover, and exact requested period/adjust arguments.

In the same test file, define `FakeChartProvider` with a `requests` list and a `collections.deque[ProviderChartPage]`; `fetch_chart_page()` appends the exact arguments and pops one page. Add a local `fake_provider` pytest fixture seeded with three strictly advancing pages and one stable snapshot, plus `fake_provider_registry` that wraps that instance behind `ChartProviderRegistry`. They perform no network or environment lookup, so Task 4 cursor tests are deterministic.

- [ ] **Step 2: Run and verify provider contract is absent**

Run:

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py backend/tests/test_market_data_real_pipeline.py -q -k "chart_provider or chart_page"
```

Expected: FAIL because chart provider types/methods do not exist.

- [ ] **Step 3: Define a vendor-neutral provider protocol**

Use:

```python
@dataclass(frozen=True)
class ChartProviderCapabilities:
    stock: dict[str, frozenset[str]]
    index: dict[str, frozenset[str]]


@dataclass(frozen=True)
class ProviderChartPage:
    candles: tuple[ChartCandleResponse, ...]
    next_before_time: int | None
    has_more_before: bool
    snapshot_token: str
    snapshot_cutoff_time: int


@dataclass(frozen=True)
class ChartProviderSnapshot:
    token: str
    cutoff_time: int


class ChartSeriesProvider(Protocol):
    name: str
    capabilities: ChartProviderCapabilities

    def begin_chart_snapshot(
        self,
        symbol: ChartSymbolResponse,
        timeframe: str,
        adjust_mode: str,
    ) -> ChartProviderSnapshot:
        raise NotImplementedError

    def fetch_chart_page(
        self,
        symbol: ChartSymbolResponse,
        timeframe: str,
        adjust_mode: str,
        before_time: int | None,
        limit: int,
        snapshot: ChartProviderSnapshot,
    ) -> ProviderChartPage:
        raise NotImplementedError
```

`ChartDataError` carries only `code`, safe `message`, and safe details. Raw provider exception text is logged server-side with request id but never placed in the HTTP response.

- [ ] **Step 4: Add explicit AKShare/Tushare capability adapters**

Map workspace modes to provider values only inside adapters:

```python
AK_ADJUST = {"none": "", "forward": "qfq", "backward": "hfq"}
AK_PERIOD = {"1m": "1", "5m": "5", "15m": "15", "30m": "30", "60m": "60", "1d": "daily", "1w": "weekly", "1mo": "monthly"}
TS_FREQ = {"1m": "1min", "5m": "5min", "15m": "15min", "30m": "30min", "60m": "60min", "1d": "D", "1w": "W", "1mo": "M"}
TS_ADJUST = {"none": None, "forward": "qfq", "backward": "hfq"}
```

Capabilities must reflect what the configured account/API can actually return. AKShare stock `1m` advertises `none` only; AKShare indexes advertise `none` only and recent minute history. Tushare minute capability is disabled unless `TRADING_REVIEW_TUSHARE_MINUTE_ENABLED=1`; even when enabled, the operator must separately verify authorization for the intended commercial use. Reject upstream rows with non-finite or non-positive OHLC rather than coercing them. Never compute adjusted 1m values from daily summaries.

Provider resolution examines only configured providers whose capability manifest contains the exact symbol-kind/timeframe/adjustment tuple **and** can create a real immutable/revision-addressable snapshot. It may choose another configured provider for the initial page only when the tuple is identical; it never changes timeframe, adjustment, candle meaning, or provider during a cursor chain. If no authorized configured provider covers the tuple, raise `CHART_COMBINATION_UNAVAILABLE` before any upstream call.

`begin_chart_snapshot()` fixes both a provider revision token and the maximum source timestamp. Every later fetch must address that same revision and filter to `time <= cutoff_time`. Merely echoing a token generated by this service is not snapshot support. Direct AKShare/Tushare adapters advertise a combination only when an operator-configured snapshot service/cache can honor the token; if the upstream cannot retrieve the fixed revision, raise `CHART_SNAPSHOT_UNAVAILABLE`. Add a fake-provider test that mutates its newest and historical rows between page calls: the second page must either return the original revision or fail with that code, never return changed rows under the original `data_version`.

- [ ] **Step 5: Run focused provider tests**

Run:

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py backend/tests/test_market_data_real_pipeline.py -q -k "chart_provider or chart_page"
```

Expected: PASS; provider calls receive exact timeframe/adjust inputs and unsupported combinations call no upstream API.

- [ ] **Step 6: Commit**

```bash
git add backend/app/chart_data.py backend/app/market_data_providers.py backend/tests/test_chart_api.py backend/tests/test_market_data_real_pipeline.py
git commit -m "feat(chart): add exact market series providers"
```

## Task 4: Opaque Cursor, Snapshot Version, And Page Service

**Files:**
- Modify: `backend/app/chart_data.py`
- Modify: `backend/tests/test_chart_api.py`

**Interfaces:**
- Consumes: `ChartSeriesProvider`.
- Produces: `load_chart_series_page(provider_registry: ChartProviderRegistry, symbol: ChartSymbolResponse, timeframe: ChartTimeframe, adjust_mode: ChartAdjustMode, before_cursor: str | None) -> ChartSeriesPageResponse` and a provider/selection-bound opaque cursor codec.

- [ ] **Step 1: Write failing cursor chain tests**

```python
def test_chart_cursor_is_bound_to_selection_and_advances(fake_provider_registry) -> None:
    first = load_chart_series_page(fake_provider_registry, stock_symbol, "1d", "forward", None)
    assert first.has_more_before is True
    assert first.before_cursor

    second = load_chart_series_page(fake_provider_registry, stock_symbol, "1d", "forward", first.before_cursor)
    assert second.data_version == first.data_version
    assert max(candle.time for candle in second.candles) < max(candle.time for candle in first.candles)

    with pytest.raises(ChartDataError) as error:
        load_chart_series_page(fake_provider_registry, stock_symbol, "5m", "forward", first.before_cursor)
    assert error.value.code == "INVALID_CHART_CURSOR"
```

Also test malformed base64, repeated `before_time`, changed snapshot version, empty page with `has_more=True`, and provider rows returned descending.

- [ ] **Step 2: Run and verify page service is absent**

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q -k cursor
```

Expected: FAIL because cursor encode/decode and page service do not exist.

- [ ] **Step 3: Implement a selection-bound cursor**

Encode compact JSON with urlsafe base64:

```python
@dataclass(frozen=True)
class ChartCursor:
    provider_name: str
    symbol_id: str
    timeframe: str
    adjust_mode: str
    before_time: int
    snapshot_token: str
    snapshot_cutoff_time: int
```

Decode with strict key/type checks and require provider/symbol/timeframe/adjust equality. The first page resolves an exact-capability provider and calls `begin_chart_snapshot`; every later page resolves the cursor's `provider_name` and reconstructs the same snapshot token/cutoff, failing safely if that provider/revision is no longer available. Cursor text is opaque to the frontend; the snapshot token must be a random/internal identifier containing no provider request parameters or credentials.

- [ ] **Step 4: Implement fixed-size atomic page assembly**

Use server-owned `CHART_PAGE_SIZE = 2000`. Normalize provider candles to strict ascending order, reject duplicates, non-finite values, non-positive OHLC, invalid OHLC bounds, negative volume/turnover, or any row later than the snapshot cutoff, and return no partial page. `data_version` is `${provider.name}:${snapshot.token}`; subsequent results must match provider, token, and cutoff. `has_more_before=True` requires a strictly earlier `next_before_time`; encode it with the same snapshot as the next cursor.

- [ ] **Step 5: Run focused tests**

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q -k "cursor or series_page"
```

Expected: PASS; cursors cannot be reused across selection keys and every page advances.

- [ ] **Step 6: Commit**

```bash
git add backend/app/chart_data.py backend/tests/test_chart_api.py
git commit -m "feat(chart): paginate stable market snapshots"
```

## Task 5: Authenticated Chart Endpoints And Safe Errors

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/schemas.py`
- Modify: `backend/tests/test_chart_api.py`

**Interfaces:**
- Produces: `GET /api/chart/symbols` and `GET /api/chart/series`.
- Consumed by: browser adapter.

- [ ] **Step 1: Write failing authenticated API tests**

```python
def test_chart_symbols_and_series_are_authenticated(client, anonymous_client, monkeypatch) -> None:
    monkeypatch.setattr(main_module, "chart_provider_registry", lambda _session: fixture_provider_registry())
    assert anonymous_client.get("/api/chart/symbols", params={"q": "000001"}).status_code == 401
    symbols = client.get("/api/chart/symbols", params={"q": "000001"})
    assert symbols.status_code == 200
    series = client.get(
        "/api/chart/series",
        params={"symbol_id": "stock:SZSE:000001", "timeframe": "1d", "adjust_mode": "forward"},
    )
    assert series.status_code == 200
    assert series.json()["data_version"] == "fixture:snapshot-1"


def test_chart_provider_error_is_safe(client, monkeypatch) -> None:
    monkeypatch.setattr(main_module, "chart_provider_registry", lambda _session: unsupported_provider_registry())
    response = client.get(
        "/api/chart/series",
        params={"symbol_id": "stock:SZSE:000001", "timeframe": "1m", "adjust_mode": "forward"},
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "CHART_COMBINATION_UNAVAILABLE"
    assert "token" not in str(body).lower()
```

- [ ] **Step 2: Run and verify routes are 404**

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q -k "authenticated or provider_error"
```

Expected: FAIL with 404.

- [ ] **Step 3: Add thin routes with typed query validation**

Add:

```python
@app.get("/api/chart/symbols", response_model=list[ChartSymbolResponse])
def chart_symbols(
    q: str = Query(default="", max_length=64),
    session: Session = Depends(get_session),
) -> list[ChartSymbolResponse]:
    return search_chart_symbols(session, q)


@app.get("/api/chart/series", response_model=ChartSeriesPageResponse)
def chart_series(
    symbol_id: str = Query(min_length=1, max_length=64),
    timeframe: ChartTimeframe = Query(),
    adjust_mode: ChartAdjustMode = Query(),
    before_cursor: str | None = Query(default=None, max_length=1024),
    session: Session = Depends(get_session),
) -> ChartSeriesPageResponse:
    symbol = require_chart_symbol(session, symbol_id)
    if symbol.kind == "index" and adjust_mode != "none":
        raise safe_http_error(422, "CHART_ADJUSTMENT_NOT_SUPPORTED", "指数只支持不复权。")
    return load_chart_series_page(chart_provider_registry(session), symbol, timeframe, adjust_mode, before_cursor)
```

Map `ChartDataError` to the existing `{error:{code,message,details},request_id}` format without raw cause text.

Import `app.main as main_module` in the test file and use the local authenticated/anonymous client fixtures created in Task 1. Provider registries in API tests are always monkeypatched deterministic fakes; real adapter normalization remains in `test_market_data_real_pipeline.py`.

- [ ] **Step 4: Run focused and full backend suites**

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q
npm run test:backend
```

Expected: chart tests and the existing backend baseline pass.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/app/schemas.py backend/tests/test_chart_api.py
git commit -m "feat(chart): expose authenticated chart APIs"
```

## Task 6: Install The Real Workspace Tarball

**Files:**
- Create: `vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `next.config.mjs`

**Interfaces:**
- Consumes: Phase 2 packed artifact.
- Produces: reproducible host dependency with no workspace symlink or engine import.

- [ ] **Step 1: Build and pack from SimonCharts**

Run in SimonCharts:

```bash
cd /Users/xuminchen/Desktop/SimonCharts
npm run build -w @simoncharts/chart-workspace
mkdir -p /Users/xuminchen/Desktop/TradingReviewSystem/vendor
npm pack -w @simoncharts/chart-workspace --pack-destination /Users/xuminchen/Desktop/TradingReviewSystem/vendor
```

Expected: `/Users/xuminchen/Desktop/TradingReviewSystem/vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz` is created directly by `npm pack` and Phase 2 gates are green.

- [ ] **Step 2: Install the immutable artifact**

Run:

```bash
cd /Users/xuminchen/Desktop/TradingReviewSystem
npm install ./vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz --save-exact
```

Expected: package.json contains:

```json
"@simoncharts/chart-workspace": "file:vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz"
```

- [ ] **Step 3: Remove the stale engine transpile configuration**

Delete `transpilePackages: ["@simoncharts/chart-engine"]` from `next.config.mjs`. Do not replace it with a source package path; the workspace is already compiled.

- [ ] **Step 4: Verify package boundaries before UI code**

Run:

```bash
node -e 'const p=require("./node_modules/@simoncharts/chart-workspace/package.json"); if(p.name!=="@simoncharts/chart-workspace"||p.version!=="1.0.0-rc.0") process.exit(1)'
test ! -L node_modules/@simoncharts/chart-workspace
rg -n -P '@simoncharts/chart-workspace/(?!styles\.css)|@simoncharts/chart-engine|packages/chart-(engine|workspace)/src' src next.config.mjs
```

Expected: package/version check passes, installed directory is not a symlink, and `rg` returns no matches.

- [ ] **Step 5: Commit**

```bash
git add vendor/simoncharts-chart-workspace-1.0.0-rc.0.tgz package.json package-lock.json next.config.mjs
git commit -m "build(chart): install the packed workspace SDK"
```

## Task 7: Abort-Aware Browser Data Source Adapter

**Files:**
- Create: `src/lib/chartWorkspaceDataSource.ts`
- Modify: `src/lib/types.ts`
- Verify only: `src/lib/api.ts`

**Interfaces:**
- Consumes: two host HTTP endpoints.
- Produces: `tradingReviewChartDataSource: ChartWorkspaceDataSource` and `defaultChartSymbol`.

- [ ] **Step 1: Add a failing TypeScript fixture check**

Create the adapter file initially with imports and expected export; run typecheck to prove missing implementation. Its final public surface is:

```ts
export const defaultChartSymbol: ChartSymbol;
export const tradingReviewChartDataSource: ChartWorkspaceDataSource;
```

- [ ] **Step 2: Implement exact snake_case mapping and signal forwarding**

Use package-root type imports only. The series request path is:

```ts
const params = new URLSearchParams({
  symbol_id: request.symbol.id,
  timeframe: request.timeframe,
  adjust_mode: request.adjustMode
});
if (request.beforeCursor) params.set("before_cursor", request.beforeCursor);

const response = await fetch(`/api/chart/series?${params}`, {
  method: "GET",
  credentials: "include",
  signal
});
```

Map each raw candle field without defaulting or coercing invalid values. Return:

```ts
return {
  candles: raw.candles.map((candle) => ({
    time: candle.time,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    turnover: candle.turnover
  })),
  beforeCursor: raw.before_cursor ?? undefined,
  hasMoreBefore: raw.has_more_before,
  dataVersion: raw.data_version
};
```

Search uses the same origin, credentials, and passed signal. For non-2xx responses, parse only safe `error.code/message`; throw an `Error` containing that safe message, never the raw body.

- [ ] **Step 3: Define the real initial symbol descriptor**

Use the existing primary index registry identity:

```ts
export const defaultChartSymbol: ChartSymbol = Object.freeze({
  id: "index:SSE:000001",
  code: "000001",
  name: "上证指数",
  exchange: "SSE",
  kind: "index"
});
```

This is symbol metadata only; it does not include or synthesize market candles.

- [ ] **Step 4: Run TypeScript and lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: PASS; abort signal reaches both fetch calls and imports use only `@simoncharts/chart-workspace` root.

- [ ] **Step 5: Commit**

```bash
git add src/lib/chartWorkspaceDataSource.ts src/lib/types.ts
git commit -m "feat(chart): adapt host APIs to workspace data"
```

## Task 8: Full-Screen `/chart` Host Lifecycle

**Files:**
- Create: `src/components/ChartWorkspaceHost.tsx`
- Create: `src/app/chart/page.tsx`
- Create: `src/app/chart/chart-page.module.css`
- Modify: `src/components/AppShell.tsx`

**Interfaces:**
- Consumes: installed package, default symbol, browser data source.
- Produces: protected full-screen `/chart` page and deterministic mount/unmount cleanup.

- [ ] **Step 1: Create the client lifecycle component**

Use:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { createChartWorkspace } from "@simoncharts/chart-workspace";
import "@simoncharts/chart-workspace/styles.css";
import styles from "@/app/chart/chart-page.module.css";
import { defaultChartSymbol, tradingReviewChartDataSource } from "@/lib/chartWorkspaceDataSource";

export function ChartWorkspaceHost() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const workspace = createChartWorkspace(container, {
      workspaceId: "trading-review-system",
      initialSymbol: defaultChartSymbol,
      initialTimeframe: "1d",
      initialAdjustMode: "none",
      dataSource: tradingReviewChartDataSource
    });
    return () => workspace.destroy();
  }, []);

  return <div ref={containerRef} data-testid="trading-review-chart-workspace" className={styles.host} />;
}
```

The rendered element carries the stable data-testid; the CSS-module class remains host-local.

- [ ] **Step 2: Create the full-screen route without AppShell constraints**

`page.tsx` imports the same CSS module and renders `<main className={styles.page}><ChartWorkspaceHost /></main>`. `chart-page.module.css` owns only host geometry:

```css
.page {
  position: fixed;
  inset: 0;
  min-width: 1280px;
  min-height: 720px;
  overflow: auto;
  background: #08090d;
}

.host {
  width: 100%;
  height: 100%;
}
```

Do not edit `globals.css` and do not wrap this route with the padded `AppShell`.

- [ ] **Step 3: Add one navigation entry**

Add `{ href: "/chart", icon: <LineChart size={17} />, label: "专业图表" }` to `AppShell` navigation. Do not alter existing nav/layout behavior.

- [ ] **Step 4: Run frontend gates**

```bash
npx tsc --noEmit
npm run lint
npx next build --webpack
```

Expected: PASS; production build resolves JS/types/CSS only from the installed workspace package.

- [ ] **Step 5: Verify forbidden imports and protected dirty file**

```bash
rg -n -P '@simoncharts/chart-workspace/(?!styles\.css)|@simoncharts/chart-engine|packages/chart-(engine|workspace)/src' src next.config.mjs
git status --short
```

Expected: import scan has no matches; status includes the pre-existing `M src/app/globals.css` plus only this task's intended files before commit.

- [ ] **Step 6: Commit without staging the user CSS change**

```bash
git add src/components/ChartWorkspaceHost.tsx src/app/chart/page.tsx src/app/chart/chart-page.module.css src/components/AppShell.tsx
git commit -m "feat(chart): mount the commercial workspace"
```

## Task 9: Real Host Acceptance And Project Documentation

**Files:**
- Modify: `backend/tests/test_chart_api.py`
- Create: `/Users/xuminchen/Desktop/SimonCharts/playwright.trading-review.config.ts`
- Create: `/Users/xuminchen/Desktop/SimonCharts/tests/reference-host/trading-review-system.spec.ts`
- Create: `/Users/xuminchen/Desktop/SimonCharts/scripts/check-trading-review-host.mjs`
- Modify: `/Users/xuminchen/Desktop/SimonCharts/package.json`
- Modify: `/Users/xuminchen/Documents/Simon/30_Projects/TradingReviewSystem/TradingReviewSystem.md`
- No product source changes unless a failing acceptance test exposes a scoped defect.

**Interfaces:**
- Consumes: completed backend, packed package, and `/chart` host.
- Produces: reference-host evidence required by the commercial release plan.

- [ ] **Step 1: Run complete automated host gates**

```bash
PYTHONPATH=backend pytest backend/tests/test_chart_api.py -q
npm run test:backend
npx tsc --noEmit
npm run lint
npx next build --webpack
```

Expected: all commands exit 0; backend full baseline does not regress.

- [ ] **Step 2: Start real backend and frontend**

In separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

Expected: backend at `127.0.0.1:8000`, frontend at `127.0.0.1:3000`.

- [ ] **Step 3: Create and run the automated Chrome real-host core gate**

In SimonCharts, add a Playwright config that requires `TRADING_REVIEW_FRONTEND_URL`, username, and password but never starts/mutates the host. The core spec logs in through the real form, opens `/chart`, waits for `.sc-workspace[data-state="ready"]`, searches and selects one real stock, requests `1d/forward`, pans to trigger one `before_cursor` history response, then navigates away and requires the workspace root to disappear. Collect `pageerror` and console `error`, require both empty, and reject network URLs/bodies containing `fixture`, `fake`, or SimonCharts source paths.

The wrapper validates environment and invokes the spec. Run:

```bash
cd /Users/xuminchen/Desktop/SimonCharts
TRADING_REVIEW_FRONTEND_URL=http://127.0.0.1:3000 \
TRADING_REVIEW_USERNAME="$TRADING_REVIEW_USERNAME" \
TRADING_REVIEW_PASSWORD="$TRADING_REVIEW_PASSWORD" \
PLAYWRIGHT_CHANNEL=chrome \
npm run check:trading-review-host
```

Expected: PASS against authenticated real provider data with an advancing cursor and zero browser errors. Commit these reusable core-gate files in SimonCharts:

```bash
git add playwright.trading-review.config.ts tests/reference-host/trading-review-system.spec.ts scripts/check-trading-review-host.mjs package.json
git commit -m "test(workspace): add reference host core gate"
```

Commercial Release Task 6 expands this same config/spec/wrapper to the complete 17/16/63/four-browser matrix; it does not create a separate test path.

- [ ] **Step 4: Record provider capability evidence honestly**

Record configured provider name, authorized capability set, earliest/latest returned timestamps per timeframe, and unsupported combinations. Do not mark the full commercial gate green unless the provider required by the approved full matrix is configured and authorized.

- [ ] **Step 5: Update the vault project document**

Add a dated change log, current state, and key decision entries noting:

- `/chart` consumes a versioned `.tgz` only.
- chart APIs use exact provider capabilities and safe cursor paging.
- no summary/intraday-price data is converted to candles.
- `src/app/globals.css` user change was preserved.
- exact automated backend/build and Chrome core-host evidence; identify the later expanded formal release gate separately.

- [ ] **Step 6: Commit repository evidence only**

```bash
git status --short
```

Expected: `src/app/globals.css` remains modified and unstaged; no repository evidence file is committed unless it already exists and is explicitly in scope. The vault update is outside this Git repository.

## Phase Acceptance

- Search returns real stock metadata and the six registered major indexes with stable ids.
- Series API returns exact, provider-supplied OHLCV/turnover pages with advancing opaque cursors and stable version.
- Unsupported provider combinations fail safely; they are never downgraded or fabricated.
- Provider pages are bound to one revision/cutoff; lack of a configured snapshot-capable authorized provider is an explicit phase blocker, not a successful empty capability matrix.
- `/chart` is full-screen, protected, min-width 1280, and mounts/destroys the real packed workspace.
- Host source imports only the workspace package root and CSS export.
- The pre-existing `src/app/globals.css` change remains intact and uncommitted unless its owner handles it separately.
