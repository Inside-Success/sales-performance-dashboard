import { ScrollToTop } from "@/app/manager/rep-scoring/v7-validation/scroll-to-top";
import { RouteProgress } from "@/app/manager/rep-scoring/v7-validation/route-progress";

export default function V7ValidationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><ScrollToTop /><RouteProgress />{children}</>;
}
