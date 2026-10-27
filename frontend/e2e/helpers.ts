import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123!";
export const DEMO = {
  owner: "owner@fitforge.dev",
  trainer: "trainer@fitforge.dev",
  staff: "staff@fitforge.dev",
  member: "member@fitforge.dev",
};

/** Tests that create data only run when allowed (CI points them at a throwaway database). */
export const writesAllowed = process.env.E2E_ALLOW_WRITES === "1";

export async function logIn(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).not.toHaveURL(/\/login/);
}
