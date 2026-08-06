import { renderMarkdown } from "./markdown";

console.log("--- TESTING HEADERS ---");
const headersInput = "# Header 1\n## Header 2\n### Header 3";
const headersOutput = renderMarkdown(headersInput);
console.log(headersOutput);
if (
  !headersOutput.includes("HEADER 1") ||
  !headersOutput.includes("Header 2") ||
  !headersOutput.includes("Header 3")
) {
  console.error("FAIL: Headers not parsed correctly.");
  process.exit(1);
}

console.log("\n--- TESTING INLINE FORMATTING ---");
const inlineInput =
  "This has **bold**, *italic*, ~~strikethrough~~ and `inline code`.";
const inlineOutput = renderMarkdown(inlineInput);
console.log(inlineOutput);
if (
  !inlineOutput.includes("\x1b[1mbold\x1b[22m") ||
  !inlineOutput.includes("\x1b[3mitalic\x1b[23m")
) {
  console.error("FAIL: Inline formatting not parsed correctly.");
  process.exit(1);
}

console.log("\n--- TESTING LISTS AND BLOCKQUOTES ---");
const listInput = "* Bullet item 1\n* Bullet item 2\n> Blockquote line";
const listOutput = renderMarkdown(listInput);
console.log(listOutput);
if (
  !listOutput.includes("\x1b[32m•\x1b[0m Bullet item 1") ||
  !listOutput.includes("\x1b[34m│\x1b[0m \x1b[3mBlockquote line\x1b[0m")
) {
  console.error("FAIL: Lists/Blockquotes not parsed correctly.");
  process.exit(1);
}

console.log("\n--- TESTING TABLES ---");
const tableInput = `
| Header A | Header B |
| --- | --- |
| Value A1 | Value B1 |
| Value A2 | Value B2 |
`;
const tableOutput = renderMarkdown(tableInput);
console.log(tableOutput);
if (
  !tableOutput.includes("┌") ||
  !tableOutput.includes("Header A") ||
  !tableOutput.includes("Value B2")
) {
  console.error("FAIL: Tables not parsed correctly.");
  process.exit(1);
}

console.log("\n--- ALL MARKDOWN TESTS PASSED SUCCESSFULLY! ---");
process.exit(0);
