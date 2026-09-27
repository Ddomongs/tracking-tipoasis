import type { Metadata } from "next";
import { ResultKitHarness } from "./ResultKitHarness";

export const metadata: Metadata = {
  title: "결과 화면 점검",
  robots: { index: false, follow: false }
};

/** Internal test harness: renders the result area for view models handed over by E2E tests. Never linked publicly. */
export default function ResultKitPage(): React.JSX.Element {
  return <ResultKitHarness />;
}
