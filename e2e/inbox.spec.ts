import { expect, test } from "@playwright/test"

test("inbox route renders rebuilt shell", async ({ page }) => {
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
  await expect(page.getByLabel("Search inbox reviews")).toBeVisible()
  await expect(page.getByRole("button", { name: "Pending" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Replied" })).toBeVisible()
  await expect(page.getByRole("button", { name: /Bulk Approve/ })).toBeVisible()
})
