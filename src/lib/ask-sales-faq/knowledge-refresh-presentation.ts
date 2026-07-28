export type DailyRefreshHealth = {
  tone: "good" | "warning" | "empty";
  title: string;
  description: string;
};

export function getDailyRefreshHealth(input: {
  hasRun: boolean;
  unavailableSources: number;
  totalSources: number;
}): DailyRefreshHealth {
  if (!input.hasRun) {
    return {
      tone: "empty",
      title: "Waiting for the first recorded refresh",
      description: "No production knowledge was changed.",
    };
  }

  if (input.unavailableSources > 0) {
    const sourceLabel = input.unavailableSources === 1 ? "source was" : "sources were";
    return {
      tone: "warning",
      title: "Refresh completed with warnings",
      description: `${input.unavailableSources} of ${input.totalSources} ${sourceLabel} unavailable. Available sources were processed, failed sources remain visible, and no source was silently skipped.`,
    };
  }

  return {
    tone: "good",
    title: "Refresh completed",
    description: "Every configured source was available for this recorded run.",
  };
}

export type KnowledgeRefreshNextStep = {
  title: string;
  description: string;
  href: string | null;
  label: string | null;
};

export function getKnowledgeRefreshNextStep(input: {
  needsReview: number;
  needsOwner: number;
  approvedReady: number;
  awaitingReleasePreparation: number;
  readyToPublish: number;
  publishing: number;
}): KnowledgeRefreshNextStep {
  if (input.publishing > 0) {
    return {
      title: "Publication verification is running",
      description: "The page refreshes automatically. The live chatbot changes only after every safety check passes.",
      href: "#release-status",
      label: "View status",
    };
  }
  if (input.readyToPublish > 0) {
    return {
      title: "A protected release is ready for your final decision",
      description: "Review the exact current-versus-proposed answers, then publish only if they are correct.",
      href: "#release-status",
      label: "Review release",
    };
  }
  if (input.awaitingReleasePreparation > 0) {
    return {
      title: "A checked preview is ready to prepare",
      description: "Continue from Release status. This creates protected repository changes but does not publish them.",
      href: "#release-status",
      label: "Continue release",
    };
  }
  if (input.approvedReady > 0) {
    return {
      title: "Approved updates are ready for one final preview",
      description: "Select the green drafts and compare the exact current and proposed answers before release preparation.",
      href: "/ask-sales-faq/admin/knowledge-refresh?view=approved",
      label: "Review approved updates",
    };
  }
  if (input.needsReview + input.needsOwner > 0) {
    return {
      title: "Knowledge updates need your review",
      description: "Accept, edit, keep the current answer, request confirmation, or ignore each useful proposal.",
      href: "/ask-sales-faq/admin/knowledge-refresh?view=actionable",
      label: "Review updates",
    };
  }
  return {
    title: "Nothing needs your attention",
    description: "The daily refresh will check the approved read-only sources again at 9:00 PM Miami time.",
    href: null,
    label: null,
  };
}
