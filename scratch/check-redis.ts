import { Redis } from "@upstash/redis";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  console.log("Using Redis URL:", url);
  if (!url || !token) {
    return;
  }

  const redis = new Redis({ url, token });
  try {
    const keys = await redis.keys("*");
    console.log(`Found ${keys.length} keys in Redis:`);
    for (const key of keys) {
      const type = await redis.type(key);
      console.log(`Key: ${key} (${type})`);
      if (type === "string") {
        const val = await redis.get(key);
        console.log("Value:", val);
      } else if (type === "hash") {
        const val = await redis.hgetall(key);
        console.log("Value (hash):", JSON.stringify(val));
      } else if (type === "set") {
        const val = await redis.smembers(key);
        console.log("Value (set):", val);
      } else {
        console.log("Value (other): [not printed]");
      }
      console.log("-----------------------------------------");
    }
  } catch (error: any) {
    console.error("Error reading Redis:", error);
  }
}

main();
