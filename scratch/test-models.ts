import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load environment variables from .env
dotenv.config();

const apiKey = process.env.AI_GATEWAY_API_KEY;

async function fetchModels() {
  if (!apiKey) {
    console.error("AI_GATEWAY_API_KEY is not defined in the environment.");
    return;
  }

  console.log("Fetching available models from Vercel AI Gateway...");
  try {
    const res = await fetch("https://ai-gateway.vercel.sh/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!res.ok) {
      console.error(`Error: ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(body);
      return;
    }

    const data = await res.json();
    console.log(`Successfully fetched ${data.data?.length ?? 0} models!`);

    const destPath = path.join(process.cwd(), "scratch", "gateway-models.json");
    fs.writeFileSync(destPath, JSON.stringify(data, null, 2), "utf-8");
    console.log(`Wrote model list to: ${destPath}`);
  } catch (error) {
    console.error("Failed to fetch models:", error);
  }
}

fetchModels();
