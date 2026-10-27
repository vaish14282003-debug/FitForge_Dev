import { expect, test } from "@playwright/test";
import { DEMO, logIn } from "./helpers";

test("trainer sees clients, schedule and resources", async ({ page }) => {
  await logIn(page, DEMO.trainer);
  await expect(page).toHaveURL(/\/trainer$/);
  await expect(page.getByText("My clients")).toBeVisible();
  await page.getByRole("link", { name: "Schedule" }).first().click();
  await expect(page.getByRole("heading", { name: "Your hours" })).toBeVisible();
  await page.getByRole("link", { name: "Resources" }).first().click();
  await expect(page.getByRole("button", { name: "Share a file" })).toBeVisible();
});

test("owner reaches memberships, front desk and reports", async ({ page }) => {
  await logIn(page, DEMO.owner);
  await page.getByRole("link", { name: "Memberships" }).first().click();
  await expect(page.getByText("Active members")).toBeVisible();
  await page.getByRole("link", { name: "Front desk" }).first().click();
  await expect(page.getByRole("img", { name: "Check-in QR code" })).toBeVisible();
  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Trainer performance" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download CSV" }).first()).toHaveAttribute("href", /\/api\/reports\/members\.csv/);
});
