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
          <h1 id="welcome-heading" className={styles.heading}>Elite Closers Study The Call</h1>
          <div className={styles.process}>
            <h2 id="welcome-steps-heading" className={styles.processHeading}>4 Easy Steps</h2>
            <ol className={styles.steps} aria-labelledby="welcome-steps-heading">
              {steps.map((step, index) => (
                <li key={step} className={styles.step}>
                  <span className={styles.stepNumber} aria-hidden="true">0{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <nav className={styles.tools} aria-label="Magic Mike tools">
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className={styles.tool}>
              <span className={styles.toolCopy}>
                <span className={styles.toolTitle}>{tool.title}</span>
                <span className={styles.toolSubtitle}>{tool.subtitle}</span>
              </span>
              <span className={styles.toolAction} aria-hidden="true">Open <span>→</span></span>
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
