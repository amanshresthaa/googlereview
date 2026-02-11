import { test, expect } from "@playwright/test"

test("inbox renders and opens review drawer", async ({ page }) => {
  const secret = process.env.E2E_TEST_SECRET
  if (!secret) {
    throw new Error("E2E_TEST_SECRET is required for e2e tests")
  }

  const loginRes = await page.request.post("/api/test/login", {
    headers: { authorization: `Bearer ${secret}` },
  })
  expect(loginRes.ok()).toBeTruthy()

  await page.goto("/inbox")
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible()

  // We seeded a 5-star review with a comment snippet.
  await expect(page.getByText("Amazing stay. Friendly staff and spotless room.")).toBeVisible()

  // Click the row to open the drawer (desktop).
  await page.getByText("Amazing stay. Friendly staff and spotless room.").click()
  // "Review" is a substring of the app name ("GBP Reviews"), so use roles to avoid strict-mode collisions.
  await expect(page.getByRole("heading", { name: /^Review$/ })).toBeVisible()
  await expect(page.getByRole("button", { name: /^Response$/ })).toBeVisible()
})
