import { ScrollToTop } from "@/app/manager/rep-scoring/v7-validation/scroll-to-top";

export default function V7ValidationLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><ScrollToTop />{children}</>;
}
