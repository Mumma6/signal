import { config } from "dotenv";
config({ path: ".env.local" });
async function main() {
  const { generateBriefing } = await import("../src/lib/pipeline");
  const date = process.argv[2] || new Date().toISOString().slice(0, 10);
  // Continue saved stages in separate bounded invocations. No infinite provider retries.
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await generateBriefing(date);
    console.info(JSON.stringify(result, null, 2));
    if (result.status !== "pending") return;
  }
  throw new Error("Briefing still pending; run the command again to resume.");
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Generation failed");
    process.exit(1);
  });
