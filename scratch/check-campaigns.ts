import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Load Next.js environment variables before importing schema
config({ path: ".env.local" });
config({ path: ".env" });

import { campaignQueue, mission, user } from "../lib/db/schema";

const dbUrl = process.env.POSTGRES_URL;
if (!dbUrl) {
  console.error("CRITICAL: POSTGRES_URL is undefined in process.env!");
  process.exit(1);
}

const client = postgres(dbUrl);
const db = drizzle(client);

async function main() {
  console.log("=== DIAGNOSTIC SYSTEM ===");
  try {
    const usersCount = await db.select().from(user);
    console.log(`Total Users in system: ${usersCount.length}`);
    if (usersCount.length > 0) {
      console.log("First 3 Users:");
      usersCount
        .slice(0, 3)
        .forEach((u) =>
          console.log(
            `- ID: ${u.id}, Email: ${u.email}, Name: ${u.firstName} ${u.lastName}`
          )
        );
    }

    const missionsCount = await db.select().from(mission);
    console.log(`\nTotal Missions in system: ${missionsCount.length}`);
    if (missionsCount.length > 0) {
      console.log("Missions:");
      missionsCount.forEach((m) =>
        console.log(
          `- ID: ${m.id}, UserID: ${m.userId}, Goal: ${m.goal}, Status: ${m.status}`
        )
      );
    }

    const queueCount = await db.select().from(campaignQueue);
    console.log(`\nTotal Campaign Queue Items in system: ${queueCount.length}`);
    if (queueCount.length > 0) {
      console.log("Queue Items:");
      queueCount.forEach((q) =>
        console.log(
          `- ID: ${q.id}, MissionID: ${q.missionId}, Channel: ${q.channel}, Status: ${q.status}, Recipient: ${q.recipient}`
        )
      );
    }
  } catch (err) {
    console.error("Diagnostic failed:", err);
  } finally {
    await client.end();
  }
}

main();
