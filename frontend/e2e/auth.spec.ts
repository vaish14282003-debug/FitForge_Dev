import { expect, test } from "@playwright/test";
import { DEMO, logIn, writesAllowed } from "./helpers";

test("landing page shows the hero and links to sign-up @mobile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Train.");
  await page.getByRole("link", { name: /start training/i }).click();
  await expect(page).toHaveURL(/\/register/);
});

test("signed-out visitors are sent to login and returned afterwards", async ({ page }) => {
  await page.goto("/progress");
  await expect(page).toHaveURL(/\/login\?next=%2Fprogress/);
  await page.getByLabel("Email").fill(DEMO.member);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/progress$/);
});

test("a wrong password shows an error and stays on login", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(DEMO.member);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("forgot password confirms without revealing whether the account exists", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  // Wait for the new page: the login form has an "Email" field too.
  await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
  await page.getByLabel("Email").fill("nobody-here@example.com");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
});

test("each role lands on its own dashboard and can't open others' pages", async ({ page }) => {
  await logIn(page, DEMO.member);
  await expect(page).toHaveURL(/\/member$/);
  await page.goto("/reports");
  await expect(page).toHaveURL(/\/member$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await logIn(page, DEMO.owner);
  await expect(page).toHaveURL(/\/owner$/);
  await expect(page.getByRole("heading", { name: /at a glance/ })).toBeVisible();
});

test("a new gym owner can sign up", async ({ page }) => {
  test.skip(!writesAllowed, "creates an account");
  const email = `owner-${Date.now()}@example.com`;
  await page.goto("/register");
  await page.getByText("I own a gym").click();
  await page.getByLabel("Full name").fill("Test Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Password123!");
  await page.getByLabel("Gym name").fill("E2E Gym");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/owner$/);

  // New accounts get the welcome tour once.
  const tour = page.getByRole("dialog");
  await expect(tour.getByRole("heading", { name: "Welcome to FitForge, Test!" })).toBeVisible();
  await tour.getByRole("button", { name: "Show me around" }).click();
  await expect(tour.getByRole("heading", { name: "Your gym at a glance" })).toBeVisible();
  for (let i = 0; i < 12 && (await tour.getByRole("button", { name: "Next" }).isVisible()); i++) {
    await tour.getByRole("button", { name: "Next" }).click();
  }
  await expect(tour.getByRole("heading", { name: "You're all set" })).toBeVisible();
  await tour.getByRole("button", { name: "Let's go" }).click();
  await expect(tour).toBeHidden();

  await expect(page.getByText("Member join code")).toBeVisible();
  // Remembered by the server: it doesn't come back.
  await page.reload();
  await expect(page.getByText("Member join code")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog")).toBeHidden();
});
