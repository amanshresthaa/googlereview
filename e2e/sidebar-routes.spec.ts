import { expect, test } from "@playwright/test"

const SIDEBAR_ROUTES = ["/inbox", "/performance", "/locations", "/users", "/settings"] as const

for (const route of SIDEBAR_ROUTES) {
  test(`unauthenticated ${route} redirects to signin`, async ({ page }) => {
    await page.goto(route)
    await expect(page).toHaveURL(/\/signin/)
  })
}

