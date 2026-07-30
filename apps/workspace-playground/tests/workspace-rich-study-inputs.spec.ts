import { expect, test } from "@playwright/test";

test("creates and edits one custom study through native rich input controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Fixture Rich Inputs" }).click();
  await page.getByLabel("Fixture Rich Inputs Length").fill("3");
  await page.getByLabel("Fixture Rich Inputs Enabled").check();
  await page.getByLabel("Fixture Rich Inputs Note").fill("review");
  await page.getByLabel("Fixture Rich Inputs Mode").selectOption("exponential");
  await page.getByLabel("Fixture Rich Inputs Source").selectOption("hlc3");
  await page.getByRole("button", { name: "Apply custom:fixture.rich" }).click();

  await expect.poll(() => page.evaluate(() => window.__chart!.dataReady())).toBe(true);
  const created = await page.evaluate(() => {
    const study = window.__chart!.getAllStudies()
      .find((candidate) => candidate.id === "custom:fixture.rich");
    if (!study) throw new Error("rich custom study was not created");
    const entity = window.__chart!.getEntities("indicator")
      .find((candidate) =>
        candidate.kind === "indicator" &&
        candidate.value.instanceId === study.instanceId
      );
    const api = entity?.kind === "indicator"
      ? window.__chart!.getStudyApi(
          entity.id as import("@simoncharts/charts").ChartIndicatorEntityId
        )
      : undefined;
    if (!api) throw new Error("rich custom study API was not created");
    api.setVisualOverrides([{
      outputId: "value",
      type: "line",
      color: "#ec4899",
      lineWidth: 3
    }]);
    api.setVisible(false);
    return structuredClone(study);
  });
  expect(created).toMatchObject({
    id: "custom:fixture.rich",
    definitionVersion: "1",
    params: {
      length: 3,
      enabled: true,
      note: "review",
      mode: "exponential",
      source: "hlc3"
    }
  });

  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Edit custom:fixture.rich" }).click();
  await expect(page.getByLabel("Fixture Rich Inputs Length")).toHaveValue("3");
  await expect(page.getByLabel("Fixture Rich Inputs Enabled")).toBeChecked();
  await expect(page.getByLabel("Fixture Rich Inputs Note")).toHaveValue("review");
  await expect(page.getByLabel("Fixture Rich Inputs Mode")).toHaveValue("exponential");
  await expect(page.getByLabel("Fixture Rich Inputs Source")).toHaveValue("hlc3");
  await page.getByLabel("Fixture Rich Inputs Length").fill("8");
  await page.getByLabel("Fixture Rich Inputs Enabled").uncheck();
  await page.getByLabel("Fixture Rich Inputs Note").fill("edited");
  await page.getByLabel("Fixture Rich Inputs Mode").selectOption("simple");
  await page.getByLabel("Fixture Rich Inputs Source").selectOption("close");
  await page.getByRole("button", { name: "Apply custom:fixture.rich" }).click();

  await expect.poll(() => page.evaluate(() => window.__chart!.dataReady())).toBe(true);
  const edited = await page.evaluate((instanceId) => {
    const study = window.__chart!.getAllStudies()
      .find((candidate) => candidate.instanceId === instanceId);
    return study === undefined ? undefined : structuredClone(study);
  }, created.instanceId);
  expect(edited).toEqual({
    instanceId: created.instanceId,
    id: "custom:fixture.rich",
    definitionVersion: "1",
    params: {
      length: 8,
      enabled: false,
      note: "edited",
      mode: "simple",
      source: "close"
    },
    visible: false,
    visualOverrides: [{
      outputId: "value",
      type: "line",
      color: "#ec4899",
      lineWidth: 3
    }]
  });
  expect(errors).toEqual([]);
});

test("reports the study limit and returns focus after Escape", async ({ page }) => {
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    window.__chart!.setIndicators(Array.from({ length: 32 }, (_, index) => ({
      instanceId: `limit-${index}`,
      id: "MA",
      params: { period: index + 1 },
      visible: true
    })));
  });

  const open = page.getByTestId("indicator-manager-open");
  await open.click();
  await page.getByRole("button", { name: "Fixture Rich Inputs" }).click();
  await page.getByLabel("Fixture Rich Inputs Note").focus();
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();

  await open.click();
  await page.getByRole("button", { name: "Fixture Rich Inputs" }).click();
  await page.getByRole("button", { name: "Apply custom:fixture.rich" }).click();
  await expect(page.getByTestId("indicator-editor-error"))
    .toHaveText("每个图表最多支持 32 个指标");
  await expect(page.getByTestId("indicator-editor-error")).toBeVisible();
  expect(await page.evaluate(() => window.__chart!.getAllStudies().length)).toBe(32);
});

test("rejects an empty numeric input without coercing it to zero", async ({ page }) => {
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Edit custom:fixture.average" }).click();
  await page.getByLabel("Fixture Average Factor").fill("");
  await page.getByRole("button", { name: "Apply custom:fixture.average" }).click();

  await expect(page.getByTestId("indicator-editor-error")).toBeVisible();
  await expect(page.getByTestId("indicator-editor-error")).toContainText("must be finite");
  expect(await page.evaluate(() =>
    window.__chart!.getAllStudies()
      .find((study) => study.instanceId === "fixture-average")
      ?.params.factor
  )).toBe(1);
});

test("keeps a stale study editor open and reports the missing study", async ({ page }) => {
  await page.goto("/?customStudies=1");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();

  await page.getByTestId("indicator-manager-open").click();
  await page.getByRole("button", { name: "Edit custom:fixture.average" }).click();
  await page.evaluate(() => {
    window.__chart!.removeStudy(
      window.__customStudyIds![0] as import("@simoncharts/charts").ChartIndicatorEntityId
    );
  });
  await page.getByRole("button", { name: "Apply custom:fixture.average" }).click();

  await expect(page.getByTestId("indicator-editor-error")).toBeVisible();
  await expect(page.getByTestId("indicator-editor-error")).toContainText("已不存在");
  await expect(page.getByLabel("Fixture Average Factor")).toBeVisible();
  expect(await page.evaluate(() =>
    window.__chart!.getAllStudies().some((study) => study.instanceId === "fixture-average")
  )).toBe(false);
});
