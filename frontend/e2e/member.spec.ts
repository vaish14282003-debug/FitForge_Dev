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

test("the welcome tour can be replayed from the profile and points at the phone tab bar @mobile", async ({ page, isMobile }) => {
  await page.goto("/profile");
  await page.getByRole("button", { name: "Take the tour again" }).click();

  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: /Welcome to FitForge/ })).toBeVisible();
  await tour.getByRole("button", { name: "Show me around" }).click();
  await tour.getByRole("button", { name: "Next" }).click();
  await expect(tour.getByRole("heading", { name: "Workouts" })).toBeVisible();

  // The card stays on screen, and on phones it sits above the bottom tab bar it points at.
  // It slides into place, so wait until it stops moving.
  let previous = -1;
  await expect
    .poll(async () => {
      const y = (await tour.boundingBox())!.y;
      const settled = Math.abs(y - previous) < 0.5;
      previous = y;
      return settled;
    }, { intervals: [150] })
    .toBe(true);
  const box = (await tour.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  if (isMobile) {
    const tab = page.locator('nav[aria-label="Main"] >> visible=true').getByRole("link", { name: "Workouts" });
    expect(box.y + box.height).toBeLessThanOrEqual((await tab.boundingBox())!.y);
  }

  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
});

test("a workout finished without signal is kept on the phone and uploaded later", async ({ page, context }) => {
  test.skip(!writesAllowed, "logs a workout");
  await page.goto("/workouts");
  await page.getByRole("link", { name: /^Start (this )?workout$/ }).first().click();
  await page.getByRole("button", { name: "Mark set 1 done" }).first().click();

  await context.setOffline(true);
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Save workout" }).click();
  await expect(page.getByText("Workout saved on this phone")).toBeVisible();
  await expect(page.getByText("1 workout waiting to upload")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText("Offline workout uploaded")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/waiting to upload/)).toBeHidden();
});

test("the installed app opens pages without signal @mobile", async ({ page, context }) => {
  await page.goto("/workouts");
  const hasWorker = await page.evaluate(async () => {
    const registration = await Promise.race([
      navigator.serviceWorker?.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);
    return !!registration;
  });
  test.skip(!hasWorker, "the service worker only runs in production builds");
  // The first visit installed the worker; this one is served through it and remembered.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("You're offline. Workouts save to this phone.")).toBeVisible();
  await expect(page.getByRole("link", { name: /^Start (this )?workout$/ }).first()).toBeVisible();
  await context.setOffline(false);
});
