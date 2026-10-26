import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Runs axe with the WCAG 2.1 A and AA rules and fails with a readable list of violations. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const violations = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? "n/a"}): ${violation.help}\n    ` +
      violation.nodes
        .slice(0, 5)
        .map((node) => node.target.join(" "))
        .join("\n    "),
  );
  expect(violations, violations.join("\n")).toEqual([]);
}
