
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const roles = ["Customer", "Teller", "Manager", "Admin"];

test.describe("Banking dashboard accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("has no automatically detectable WCAG 2.1 A/AA violations on initial load", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations,
      JSON.stringify(
        results.violations.map(({ id, impact, description, nodes }) => ({
          id,
          impact,
          description,
          elements: nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        })),
        null,
        2,
      ),
    ).toEqual([]);
  });


test("supports all four dashboard role previews", async ({ page }) => {
  const rolePicker = page.getByLabel("Preview role");

  for (const role of roles) {
    await rolePicker.selectOption({ label: role });
    await expect(rolePicker).toHaveValue(role);
  }
});


  test("has no automatically detectable WCAG 2.1 A/AA violations in high-contrast mode", async ({
    page,
  }) => {
    const contrastToggle = page.getByRole("button", {
      name: /high contrast/i,
    });

    await expect(contrastToggle).toBeVisible();
    await contrastToggle.click();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(
      results.violations.map(({ id, impact, description }) => ({
        id,
        impact,
        description,
      })),
      JSON.stringify(results.violations, null, 2),
    ).toEqual([]);
  });
});

test("renders without horizontal overflow on mobile and desktop", async ({ page }) => {
  const viewports = [
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto("/");

    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      pageWidth: document.documentElement.scrollWidth,
    }));

    expect(
      dimensions.pageWidth,
      `Horizontal overflow at ${viewport.width}px: ${JSON.stringify(dimensions)}`,
    ).toBeLessThanOrEqual(dimensions.viewportWidth);
  }
});
