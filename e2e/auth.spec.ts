import { test, expect } from "@playwright/test"

test("unauthenticated inbox redirects to signin", async ({ page }) => {
  await page.goto("/inbox")
  await expect(page).toHaveURL(/\/signin/)
  await expect(page.getByRole("heading", { name: "Google Business Profile" })).toBeVisible()
})
