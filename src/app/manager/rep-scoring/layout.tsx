import { RouteProgress } from "@/app/manager/rep-scoring/v7-validation/route-progress";
import { ScrollToTop } from "@/app/manager/rep-scoring/v7-validation/scroll-to-top";

export default function RepScoringLayout({ children }: { children: React.ReactNode }) {
  return <><RouteProgress /><ScrollToTop />{children}</>;
}
