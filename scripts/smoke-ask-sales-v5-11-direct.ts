import { runAskSalesFaqV511 } from "@/lib/ask-sales-faq/v5-11/runtime";

async function main() {
  const question = process.argv.slice(2).join(" ").trim();
  if (!question) throw new Error("Provide one question to the V5.11 direct smoke script.");
  const result = await runAskSalesFaqV511(question);
  process.stdout.write(JSON.stringify({
    question,
    lane: result.lane,
    answer: result.answer,
    routeChannels: result.routeChannels,
    selectedPolicyIds: result.selectedPolicyIds,
    provider: result.provider,
    model: result.model,
    providerAttempts: result.runtimeMetadata.providerAttempts,
  }, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
