import { expect, test } from "@playwright/test";

test("manages drawing groups in the native Objects inspector", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('.sc-workspace[data-state="ready"]')).toBeVisible();
  await page.evaluate(() => {
    window.__chart!.setDrawings([
      {
        id: "group-a",
        type: "trendLine",
        anchors: [{ time: 1_719_000_000, price: 12 }, { time: 1_719_086_400, price: 14 }]
      },
      {
        id: "group-b",
        type: "horizontalLine",
        anchors: [{ time: 1_719_000_000, price: 13 }]
      },
      {
        id: "passive-a",
        type: "horizontalLine",
        anchors: [{ time: 1_719_000_000, price: 18 }],
        interactive: false
      },
      {
        id: "passive-b",
        type: "horizontalLine",
        anchors: [{ time: 1_719_000_000, price: 19 }],
        interactive: false
      }
    ]);
    const groups = window.__chart!.getDrawingGroupsApi();
    groups.create(["group-a", "group-b"], "计划");
    groups.create(["passive-a", "passive-b"], "只读");
  });

  await page.getByRole("tab", { name: "对象", exact: true }).click();
  await expect(page.locator('[role="tree"]')).toHaveCount(0);
  await expect(page.locator("details[data-drawing-group-id]")).toHaveCount(2);
  await expect(page.locator('[data-drawing-group-id="drawing-group:1"] .sc-object-row')).toHaveCount(2);

  await page.locator('[data-drawing-group-id="drawing-group:1"] summary').click();
  await expect(page.locator('[data-drawing-group-id="drawing-group:1"]')).not.toHaveAttribute("open", "");
  await expect(page.locator('[data-drawing-id="group-a"]')).toHaveAttribute("data-selected", "true");
  await expect(page.locator('[data-drawing-id="group-b"]')).toHaveAttribute("data-selected", "true");
  await page.locator('[data-drawing-group-id="drawing-group:1"] summary').click();
  await expect(page.locator('[data-drawing-group-id="drawing-group:1"]')).toHaveAttribute("open", "");
  await page.getByRole("tab", { name: "属性", exact: true }).click();
  await expect(page.getByText("请选择一个绘图对象", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "对象", exact: true }).click();
  await page.locator('[data-drawing-group-id="drawing-group:1"]').evaluate(
    (details: HTMLDetailsElement) => { details.open = true; }
  );

  const name = page.locator('[data-drawing-group-id="drawing-group:1"] [data-group-name]');
  await name.fill("执行计划");
  await name.press("Tab");
  await expect.poll(() => page.evaluate(() =>
    window.__chart!.getDrawingGroupsApi().getAll().find(({ id }) => id === "drawing-group:1")?.name
  )).toBe("执行计划");
  const hide = page.locator('[data-drawing-group-id="drawing-group:1"] [data-group-command="visible"]');
  await hide.focus();
  await hide.click();
  await expect(hide).toBeFocused();

  await page.locator('[data-drawing-group-id="drawing-group:1"] [data-group-command="ungroup"]').click();
  await expect(page.getByRole("button", { name: "新建组" })).toBeEnabled();
  await page.getByRole("button", { name: "新建组" }).click();
  await expect.poll(() => page.evaluate(() => window.__chart!.getDrawingGroupsApi().getAll().length)).toBe(2);

  const passiveGroup = page.locator('[data-drawing-group-id="drawing-group:2"]');
  await expect(passiveGroup.locator("input")).toBeDisabled();
  const passiveControls = passiveGroup.locator("[data-group-command]");
  await expect(passiveControls).toHaveCount(6);
  expect(await passiveControls.evaluateAll((buttons) =>
    buttons.every((button) => (button as HTMLButtonElement).disabled)
  )).toBe(true);
});
