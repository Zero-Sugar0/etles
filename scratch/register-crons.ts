import dotenv from "dotenv";
import path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const qstashUrl = process.env.QSTASH_URL || "https://qstash.upstash.io";
  const appBaseUrl = process.env.BASE_URL;
  const userId = "fb398c2f-dc5f-4634-ab6c-0359329ba939";

  console.log("Token:", token ? token.substring(0, 10) + "..." : "undefined");
  console.log("QStash URL:", qstashUrl);
  console.log("Base URL:", appBaseUrl);

  if (!token || !appBaseUrl) {
    console.error("Missing token or base URL");
    return;
  }

  const heartbeatUrl = `${appBaseUrl}/api/agent/heartbeat`;

  // Try creating hourly heartbeat schedule with "destination"
  try {
    const res = await fetch(`${qstashUrl}/v2/schedules`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Schedule-Id": `hb-${userId}`,
      },
      body: JSON.stringify({
        destination: heartbeatUrl,
        cron: "0 * * * *",
        body: JSON.stringify({ userId, type: "heartbeat" }),
      }),
    });

    console.log("Heartbeat status:", res.status, res.statusText);
    const body = await res.text();
    console.log("Heartbeat response:", body);
  } catch (err: any) {
    console.error("Heartbeat error:", err);
  }

  // Try creating synthesis schedule with "destination"
  try {
    const res = await fetch(`${qstashUrl}/v2/schedules`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Schedule-Id": `syn-${userId}`,
      },
      body: JSON.stringify({
        destination: heartbeatUrl,
        cron: "0 8 * * 1",
        body: JSON.stringify({ userId, type: "weekly_synthesis" }),
      }),
    });

    console.log("Synthesis status:", res.status, res.statusText);
    const body = await res.text();
    console.log("Synthesis response:", body);
  } catch (err: any) {
    console.error("Synthesis error:", err);
  }
}

main();
