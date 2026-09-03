export type ReportMode = "reflect" | "understand";
export type UnderstandPeriod = "single_month" | "annual" | null | undefined;

export function getKesPrice(
  mode: ReportMode,
  period?: UnderstandPeriod
): number {
  if (mode === "reflect") return 300;
  return period === "single_month" ? 800 : 2_000;
}
