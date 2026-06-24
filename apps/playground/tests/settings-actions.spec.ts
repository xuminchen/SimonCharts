import { expect, test } from "@playwright/test";

test("toolbar actions update neutral engine state", async ({ page }) => {
  await page.goto("/");

  await page.getByTestId("toggle-grid").click();
  await expect(page.getByTestId("grid-state")).toHaveText("grid off");

  await page.getByTestId("invert-price-scale").click();
  await expect(page.getByTestId("scale-state")).toHaveText("inverted");

  await page.getByTestId("theme-mode").selectOption("dark");
  await expect(page.getByTestId("theme-state")).toHaveText("dark");
});
