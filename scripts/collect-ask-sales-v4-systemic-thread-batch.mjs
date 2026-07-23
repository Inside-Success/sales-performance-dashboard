import { appendFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve(process.argv[2]);
const mode = process.argv[3];
if (mode === "init") {
  writeFileSync(outputPath, "", { encoding: "utf8", mode: 0o600 });
  process.exit(0);
}
if ((mode !== "append" && mode !== "append-hex") || !process.argv[4]) throw new Error("usage: collect... output.jsonl init|append|append-hex [encoded-json-array]");
const items = JSON.parse(Buffer.from(process.argv[4], mode === "append-hex" ? "hex" : "base64").toString("utf8"));
appendFileSync(outputPath, items.map((item) => `${JSON.stringify(item)}\n`).join(""), "utf8");
