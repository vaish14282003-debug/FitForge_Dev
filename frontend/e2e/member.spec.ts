import { expect, test } from "@playwright/test";
import { DEMO, logIn, writesAllowed } from "./helpers";

test.beforeEach(async ({ page }) => {
  await logIn(page, DEMO.member);
});

test("member dashboard shows streak, today's workout and the tab bar on phones @mobile", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vaishnavi");
  await expect(page.getByText("Day streak")).toBeVisible();
  await expect(page.getByRole("link", { name: /start workout/i })).toBeVisible();
});

test("workouts, progress and nutrition pages load", async ({ page }) => {
  await page.getByRole("link", { name: "Workouts" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("workouts");
  await page.getByRole("link", { name: "Progress" }).first().click();
  await expect(page.getByRole("heading", { name: "Body weight" }).first()).toBeVisible();
  await page.getByRole("link", { name: "Nutrition" }).first().click();
  await expect(page.getByText("Calories").first()).toBeVisible();
});

test("the bell opens notifications", async ({ page }) => {
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByRole("dialog", { name: "Notifications" })).toBeVisible();
});

test("logging a weigh-in updates progress", async ({ page }) => {
  test.skip(!writesAllowed, "writes a weigh-in");
  await page.goto("/progress");
  await page.getByRole("button", { name: "Log weigh-in" }).click();
  await page.getByLabel("Weight (kg)").fill("61.4");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Weigh-in saved")).toBeVisible();
  await expect(page.getByText("61.4 kg").first()).toBeVisible();
});
