import { Client as QStashClient } from "@upstash/qstash";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const appBaseUrl = process.env.BASE_URL;
  const userId = "fb398c2f-dc5f-4634-ab6c-0359329ba939";

  console.log("Token:", token ? token.substring(0, 10) + "..." : "undefined");
  console.log("Base URL:", appBaseUrl);

  if (!token || !appBaseUrl) {
    console.error("Missing token or base URL");
    return;
  }

  const qstash = new QStashClient({ token });
  const heartbeatUrl = `${appBaseUrl}/api/agent/heartbeat`;

  // Register hourly heartbeat schedule via SDK
  try {
    const s = await qstash.schedules.create({
      destination: heartbeatUrl,
      cron: "0 * * * *",
      body: JSON.stringify({ userId, type: "heartbeat" }),
      headers: {
        "Content-Type": "application/json",
      },
      scheduleId: `hb-${userId}`,
    });
    console.log("Hourly heartbeat schedule created successfully:", s);
  } catch (error: any) {
    console.error("Hourly heartbeat schedule creation failed:", error.message);
  }

  // Register weekly synthesis schedule via SDK
  try {
    const s = await qstash.schedules.create({
      destination: heartbeatUrl,
      cron: "0 8 * * 1",
      body: JSON.stringify({ userId, type: "weekly_synthesis" }),
      headers: {
        "Content-Type": "application/json",
      },
      scheduleId: `syn-${userId}`,
    });
    console.log("Weekly synthesis schedule created successfully:", s);
  } catch (error: any) {
    console.error("Weekly synthesis schedule creation failed:", error.message);
  }
}

main();
