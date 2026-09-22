import Link from "next/link";
import { ArrowRight, Clapperboard, MessageCircleMore } from "lucide-react";
import { TrackUsageEvent } from "@/components/dashboard/usage-tracker";
import styles from "./welcome.module.css";

export const dynamic = "force-dynamic";

const tools = [
  { href: "/coaching", title: "Casting Manager", subtitle: "AI Coach", icon: Clapperboard },
  { href: "/ask-sales-faq", title: "Sales FAQ", subtitle: "chatbot", icon: MessageCircleMore },
];
const steps = ["Review", "Reflect", "Adjust", "Sell More"];

export default function HomeHub() {
  return (
    <main className={`magic-page ${styles.page}`}>
      <TrackUsageEvent eventName="dashboard_home_viewed" eventData={{ source: "product_hub" }} />
      <div className={styles.container}>
        <section className={styles.hero} aria-labelledby="welcome-heading">
          <h1 id="welcome-heading" className={styles.heading}>
            <span className={styles.eyebrow}>Elite Closers/Athletes</span>
            <span className={styles.headline}>Study<span className={styles.mobileBreak}> </span>The Film<span className={styles.period}>.</span></span>
          </h1>
          <ol className={styles.steps} aria-label="Your daily practice">
            {steps.map((step, index) => (
              <li key={step} className={styles.step}>
                <span className={index === 3 ? styles.finalPill : styles.pill}>{step}</span>
                {index < 3 ? <ArrowRight aria-hidden="true" className={styles.stepArrow} /> : null}
              </li>
            ))}
          </ol>
        </section>
        <nav className={styles.tools} aria-label="Magic Mike tools">
          {tools.map((tool, index) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.href} href={tool.href} className={styles.tool}>
                <span aria-hidden="true" className={styles.number}>0{index + 1}</span>
                <span aria-hidden="true" className={styles.icon}><Icon size={25} strokeWidth={2} /></span>
                <span className={styles.toolLabel}><span className={styles.toolTitle}>{tool.title}</span>{" "}<span className={styles.toolSubtitle}>{tool.subtitle}</span></span>
                <span aria-hidden="true" className={styles.toolArrow}><ArrowRight size={19} /></span>
              </Link>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
