import { Client } from "@upstash/qstash";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return;

  const qstash = new Client({ token });
  try {
    const schedules = await qstash.schedules.list();
    console.log(`Found ${schedules.length} schedules:`);
    for (const s of schedules) {
      console.log("-----------------------------------------");
      console.log("Keys:", Object.keys(s));
      console.log("Full Object:", JSON.stringify(s, null, 2));
    }
  } catch (error: any) {
    console.error("Error listing schedules:", error);
  }
}

main();
