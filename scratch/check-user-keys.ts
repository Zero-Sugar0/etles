import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return;
  }

  const redis = new Redis({ url, token });
  const userId = "fb398c2f-dc5f-4634-ab6c-0359329ba939";
  try {
    const keys = [
      `agent:status:${userId}:heartbeat`,
      `agent:status:${userId}:synthesis`,
      `agent:status:${userId}:morning`,
      `agent:status:${userId}:paused`,
      `agent:heartbeat:schedules:${userId}`,
    ];
    console.log("Checking keys for user:", userId);
    for (const key of keys) {
      const exists = await redis.exists(key);
      if (exists) {
        const type = await redis.type(key);
        const val = await redis.get(key);
        console.log(`Key: ${key} (${type})`);
        console.log(
          "Value:",
          typeof val === "object" ? JSON.stringify(val, null, 2) : val
        );
      } else {
        console.log(`Key: ${key} -> DOES NOT EXIST`);
      }
      console.log("-----------------------------------------");
    }
  } catch (error: any) {
    console.error("Error reading Redis:", error);
  }
}

main();
