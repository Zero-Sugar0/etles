/**
 * lib/ai/tools/cron-calculator.ts
 *
 * Lightweight, robust 5-field cron expression next-run calculator.
 * Parses standard cron format: [minute] [hour] [day-of-month] [month] [day-of-week]
 */

function matchField(val: number, expr: string, min: number, max: number): boolean {
  if (expr === "*") return true;
  
  // Step syntax: */5 or 1-30/5
  if (expr.includes("/")) {
    const [sub, stepStr] = expr.split("/");
    const step = Number.parseInt(stepStr, 10);
    if (Number.isNaN(step) || step <= 0) return false;
    
    if (sub === "*") {
      return (val - min) % step === 0;
    }
    
    if (sub.includes("-")) {
      const [startStr, endStr] = sub.split("-");
      const start = Number.parseInt(startStr, 10);
      const end = Number.parseInt(endStr, 10);
      if (val >= start && val <= end) {
        return (val - start) % step === 0;
      }
      return false;
    }
    
    const start = Number.parseInt(sub, 10);
    return val >= start && (val - start) % step === 0;
  }

  // List syntax: 1,5,10
  if (expr.includes(",")) {
    return expr.split(",").some((part) => matchField(val, part, min, max));
  }

  // Range syntax: 1-5
  if (expr.includes("-")) {
    const [startStr, endStr] = expr.split("-");
    const start = Number.parseInt(startStr, 10);
    const end = Number.parseInt(endStr, 10);
    return val >= start && val <= end;
  }

  // Exact number
  const num = Number.parseInt(expr, 10);
  return !Number.isNaN(num) && val === num;
}

/**
 * Calculates the next run date for a 5-field UTC cron string.
 * @param cron 5-field cron string (minute hour dom month dow)
 * @param fromDate Optional start date to calculate from (defaults to now)
 */
export function getNextCronRunDate(cron: string, fromDate = new Date()): Date | null {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minExpr, hourExpr, domExpr, monthExpr, dowExpr] = parts;
    const current = new Date(fromDate.getTime());
    
    // Reset seconds and milliseconds
    current.setUTCSeconds(0, 0);
    // Move to next minute
    current.setUTCMinutes(current.getUTCMinutes() + 1);

    // Look up to 1 year ahead (525,600 minutes)
    for (let i = 0; i < 525600; i++) {
      const min = current.getUTCMinutes();
      const hour = current.getUTCHours();
      const dom = current.getUTCDate();
      const month = current.getUTCMonth() + 1; // 1-12
      const dow = current.getUTCDay(); // 0-6 (Sun-Sat)

      if (
        matchField(month, monthExpr, 1, 12) &&
        matchField(dom, domExpr, 1, 31) &&
        matchField(dow, dowExpr, 0, 6) &&
        matchField(hour, hourExpr, 0, 23) &&
        matchField(min, minExpr, 0, 59)
      ) {
        return current;
      }

      current.setUTCMinutes(current.getUTCMinutes() + 1);
    }
  } catch (e) {
    console.warn("[getNextCronRunDate] Failed to parse cron:", cron, e);
  }

  return null;
}
