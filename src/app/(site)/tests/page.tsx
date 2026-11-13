import type { Metadata } from "next";
import { PageBanner } from "@/components/page-banner";
import { TestsCatalog } from "@/features/tests/tests-catalog";

export const metadata: Metadata = {
  title: "Practice tests",
  description: "NTA-style mock tests, sectional papers and chapter tests for JEE and MHT-CET.",
};

export default function TestsPage() {
  return (
    <>
      <PageBanner
        crumbs={[{ href: "/", label: "Home" }, { label: "Tests" }]}
        title="Practice tests"
        description="Full mocks, sectional-timed papers and chapter tests in a familiar NTA-style interface. Start with the free demo — no account needed."
      />
      <TestsCatalog />
    </>
  );
}
