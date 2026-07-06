import fs from "fs";
import path from "path";

const sourcePath = path.join(process.cwd(), "scratch", "gateway-models.json");

if (!fs.existsSync(sourcePath)) {
  console.error(`Source file does not exist: ${sourcePath}`);
  process.exit(1);
}

const rawData = fs.readFileSync(sourcePath, "utf-8");
const gatewayData = JSON.parse(rawData);

const models = gatewayData.data || [];
console.log(`Analyzing ${models.length} models...`);

const parsedModels: any[] = [];

for (const m of models) {
  const tags = m.tags || [];
  const hasVision = tags.includes("vision") || tags.includes("multimodal");
  const hasReasoning = tags.includes("reasoning") || tags.includes("thinking") || m.id.includes("thinking") || m.id.includes("reasoner") || m.id.includes("thinking");
  const hasTools = tags.includes("tool-use") || tags.includes("tools") || tags.includes("function-calling");

  const [provider] = m.id.split("/");

  parsedModels.push({
    id: m.id,
    name: m.name || m.id,
    provider: provider,
    description: m.description || "",
    features: {
      reasoning: hasReasoning,
      vision: hasVision,
      tools: hasTools
    }
  });
}

// Group by provider
const byProvider: Record<string, any[]> = {};
for (const pm of parsedModels) {
  if (!byProvider[pm.provider]) {
    byProvider[pm.provider] = [];
  }
  byProvider[pm.provider].push(pm);
}

console.log("\n--- Available Providers on AI Gateway ---");
for (const prov of Object.keys(byProvider)) {
  console.log(`• ${prov}: ${byProvider[prov].length} models`);
}

// Let's filter and inspect the top/latest models per key provider
const targetProviders = ["openai", "anthropic", "google", "xai", "deepseek", "minimax", "zai"];
console.log("\n--- Key Providers & Top Models Sample ---");
for (const prov of targetProviders) {
  if (byProvider[prov]) {
    console.log(`\n[${prov.toUpperCase()}] (${byProvider[prov].length} total):`);
    // Print first 8 models to inspect
    byProvider[prov].slice(0, 10).forEach(m => {
      console.log(`  - ${m.id} (${m.name})`);
      console.log(`    Features: reasoning=${m.features.reasoning}, vision=${m.features.vision}, tools=${m.features.tools}`);
    });
  }
}

// Write the compiled classified model list to scratch/parsed-models-classified.json
fs.writeFileSync(
  path.join(process.cwd(), "scratch", "parsed-models-classified.json"),
  JSON.stringify(parsedModels, null, 2),
  "utf-8"
);
console.log("\nWrote classified list to: scratch/parsed-models-classified.json");
