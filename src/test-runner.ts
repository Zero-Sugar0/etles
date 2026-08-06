import {
  deleteCredentials,
  getCredentials,
  saveCredentials,
  validateCredentials,
} from "./modules/auth";
import { getConfig, resetConfig, setConfigKey } from "./modules/config";
import {
  clearMemory,
  deleteMemory,
  getMemory,
  listMemory,
  setMemory,
} from "./modules/memory";
import { getLoadedSkills, loadSkill, unloadSkill } from "./modules/skills";
import { AVAILABLE_TOOLS, inspectTool } from "./modules/tools";
import { renderMarkdown } from "./utils/markdown";

async function runTests() {
  console.log(
    "\x1b[1;36m=== STARTING ETLES CLI INTEGRATION TEST SUITE ===\x1b[0m\n"
  );

  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (condition) {
      console.log(`  \x1b[32m✓\x1b[0m ${message}`);
      passed++;
    } else {
      console.error(`  \x1b[31m✗ FAIL:\x1b[0m ${message}`);
      failed++;
    }
  };

  // 1. Auth Tests
  try {
    console.log("\x1b[1m[1/6] Auth & Credential Tests\x1b[0m");
    const validateRes = await validateCredentials(
      "test@etles.ai",
      "password123"
    );
    assert(
      validateRes.success && !!validateRes.data,
      "Email/Password validation succeeds with premium simulation data"
    );

    const apiKeyRes = await validateCredentials(
      undefined,
      undefined,
      "api-key-testapikeyvalue123456"
    );
    assert(
      apiKeyRes.success && !!apiKeyRes.data,
      "API key validation succeeds for api-key- formatted keys"
    );

    const invalidApiKey = await validateCredentials(
      undefined,
      undefined,
      "invalid"
    );
    assert(!invalidApiKey.success, "Invalid API keys are rejected format-wise");

    await deleteCredentials();
    const credsEmpty = await getCredentials();
    assert(
      credsEmpty === null,
      "Credentials successfully cleared and verified empty"
    );

    if (validateRes.data) {
      await saveCredentials(validateRes.data);
      const credsSaved = await getCredentials();
      assert(
        credsSaved?.user?.email === "test@etles.ai",
        "Credentials successfully stored and retrieved"
      );
    }
  } catch (e: unknown) {
    console.error("Auth test crashed: ", e);
    failed++;
  }

  // 2. Config Tests
  try {
    console.log("\n\x1b[1m[2/6] Configuration Persistence Tests\x1b[0m");
    resetConfig();
    let config = getConfig();
    assert(
      config.defaultAgent === "main_agent",
      "Config reset restores Main Agent default agent"
    );

    setConfigKey("defaultAgent", "sdr");
    config = getConfig();
    assert(
      config.defaultAgent === "sdr",
      "Config setter successfully writes defaultAgent to SDR"
    );
    resetConfig();
  } catch (e: unknown) {
    console.error("Config test crashed: ", e);
    failed++;
  }

  // 3. Memory CRUD Tests
  try {
    console.log("\n\x1b[1m[3/6] Semantic Memory Database Tests\x1b[0m");
    clearMemory();
    assert(listMemory().length === 0, "Memory is initially empty");

    setMemory("user_name", "Jules", "string");
    const val = getMemory("user_name");
    assert(
      val?.value === "Jules" && val.type === "string",
      "Memory key successfully stored and verified with get"
    );

    const list = listMemory();
    assert(
      list.length === 1 && list[0].key === "user_name",
      "Memory list correctly returns stored key"
    );

    const deleted = deleteMemory("user_name");
    assert(
      deleted && listMemory().length === 0,
      "Memory key deletion functions correctly"
    );
  } catch (e: unknown) {
    console.error("Memory test crashed: ", e);
    failed++;
  }

  // 4. Skills Slots Allocation Tests
  try {
    console.log("\n\x1b[1m[4/6] Skills Slots TUI Tests\x1b[0m");
    // Clear first
    const loaded = getLoadedSkills();
    for (const s of loaded) {
      unloadSkill(s);
    }
    assert(getLoadedSkills().length === 0, "Skills slots initially reclaimed");

    const load1 = loadSkill("github_copilot"); // 2 slots
    assert(load1.success, "Successfully loaded GitHub Copilot skill");

    const load2 = loadSkill("data_pipeline"); // 2 slots -> total 4 slots
    assert(load2.success, "Successfully loaded Data Pipeline skill");

    const load3 = loadSkill("crm_sync"); // 1 slot -> exceeds 4 max!
    assert(
      !load3.success && !!load3.error?.includes("slots"),
      "Loading skill is rejected when slot capacity is exceeded"
    );

    unloadSkill("github_copilot");
    assert(
      !getLoadedSkills().includes("github_copilot"),
      "Successfully unloaded GitHub Copilot skill"
    );
  } catch (e: unknown) {
    console.error("Skills test crashed: ", e);
    failed++;
  }

  // 5. Tool Inspector Tests
  try {
    console.log("\n\x1b[1m[5/6] Tool Inspector Schema Tests\x1b[0m");
    assert(AVAILABLE_TOOLS.length > 0, "Registered tools list is populated");
    const tool = inspectTool("shell_execute");
    assert(
      tool?.icon === "🐚" && !!tool.schema,
      "Shell execution tool inspected successfully with valid schema"
    );
  } catch (e: unknown) {
    console.error("Tool test crashed: ", e);
    failed++;
  }

  // 6. Markdown Renderer Verification
  try {
    console.log("\n\x1b[1m[6/6] Colorized Markdown Engine Tests\x1b[0m");
    const md = `
# System Report
---
| Service | Status |
| --- | --- |
| Database | Online |
| Redis | Online |
`;
    const rendered = renderMarkdown(md);
    assert(
      rendered.includes("SYSTEM REPORT"),
      "Headers capitalized and styled"
    );
    assert(
      rendered.includes("┌") && rendered.includes("Database"),
      "Table column alignments styled with unicode characters"
    );
  } catch (e: unknown) {
    console.error("Markdown test crashed: ", e);
    failed++;
  }

  console.log("\n\x1b[1;36m=== INTEGRATION TEST SUMMARY ===\x1b[0m");
  console.log(`Passed: \x1b[32m${passed}\x1b[0m`);
  console.log(`Failed: \x1b[31m${failed}\x1b[0m`);

  if (failed > 0) {
    console.error("\n\x1b[31mIntegration test suite failed.\x1b[0m");
    process.exit(1);
  } else {
    console.log("\n\x1b[32mAll integration checks passed perfectly!\x1b[0m");
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Unhandle error running test runner: ", err);
  process.exit(1);
});
