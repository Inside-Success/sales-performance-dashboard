import Link from "next/link";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";
import styles from "./welcome.module.css";

export const dynamic = "force-dynamic";

const tools = [
  { href: "/coaching", title: "Casting Manager", subtitle: "AI Coach" },
  { href: "/ask-sales-faq", title: "Casting Manager", subtitle: "FAQ Bot" },
];
const steps = ["Review", "Reflect", "Adjust", "Sell More"];

export default function HomeHub() {
  return (
    <main className={`magic-page ${styles.page}`}>
      <TrackUsageEvent eventName="dashboard_home_viewed" eventData={{ source: "product_hub" }} />
      <div className={styles.container}>
        <section className={styles.hero} aria-labelledby="welcome-heading">
          <h1 id="welcome-heading" className={styles.heading}>
            <span className={styles.eyebrow}>Elite Closers</span>
            <span className={styles.headline}>Study <span className={styles.phrase}>The Film<span className={styles.period}>.</span></span></span>
          </h1>
          <ol className={styles.steps} aria-label="Your daily practice">
            {steps.map((step) => (
              <li key={step} className={styles.step}>{step}</li>
            ))}
          </ol>
        </section>
        <nav className={styles.tools} aria-label="Magic Mike tools">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className={styles.tool}>
              <span className={styles.toolTitle}>{tool.title}</span>
              <span className={styles.toolSubtitle}>{tool.subtitle}</span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
