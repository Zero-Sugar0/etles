import * as ink from "ink";

console.log(
  "Ink exports keys:",
  Object.keys(ink).filter((k) => k.startsWith("use") || k === "render")
);
