import * as ink from "ink";

console.log("Ink version:", (ink as any).version || "Unknown");
console.log(
  "Exported hooks:",
  Object.keys(ink).filter((k) => k.startsWith("use"))
);
