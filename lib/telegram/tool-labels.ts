/**
 * Human-friendly labels for AI tool names shown in chat progress messages.
 * Shared between the Telegram webhook ([userId]) and Telegram workflow routes.
 */

const INTERNAL_TOOL_LABELS: Record<string, string> = {
  // Memory
  saveMemory: "🧠 Saving to memory",
  recallMemory: "🧠 Recalling from memory",
  updateMemory: "🧠 Updating memory",
  deleteMemory: "🧠 Deleting a memory",
  searchPastConversations: "🔎 Searching conversation history",
  // Knowledge graph
  upsertKnowledgeEntity: "🕸 Updating knowledge graph",
  addKnowledgeRelation: "🕸 Linking knowledge entities",
  getKnowledgeEntity: "🕸 Looking up knowledge graph",
  searchKnowledgeGraph: "🕸 Searching knowledge graph",
  deleteKnowledgeEntity: "🕸 Removing from knowledge graph",
  deleteKnowledgeRelation: "🕸 Removing knowledge relation",
  // Goals & planning
  addGoal: "🎯 Adding a goal",
  updateGoal: "🎯 Updating a goal",
  logGoalProgress: "🎯 Logging goal progress",
  listGoals: "🎯 Checking goals",
  deleteGoal: "🎯 Removing a goal",
  createPlan: "🗺 Creating a plan",
  addPlanTask: "🗺 Adding a task to plan",
  updatePlanTask: "🗺 Updating a plan task",
  listPlans: "🗺 Reviewing plans",
  cancelPlan: "🗺 Cancelling a plan",
  deletePlan: "🗺 Deleting a plan",
  // Search
  tavilySearch: "🔍 Searching the web",
  tavilyExtract: "🔍 Extracting web content",
  tavilyCrawl: "🔍 Crawling a website",
  tavilyMap: "🔍 Mapping a website",
  // Scheduling
  setReminder: "⏰ Setting a reminder",
  setCronJob: "⏰ Scheduling a recurring task",
  listSchedules: "⏰ Checking your schedules",
  deleteSchedule: "⏰ Removing a schedule",
  deleteReminder: "⏰ Removing a reminder",
  // Sub-agents & missions
  delegateToSubAgent: "🤝 Delegating to a sub-agent",
  getSubAgentResult: "🤝 Checking sub-agent result",
  listSubAgents: "🤝 Listing sub-agents",
  launchMission: "🚀 Launching a mission",
  getMissionStatus: "🚀 Checking mission status",
  // Sandbox / code
  createSandbox: "🖥 Creating a sandbox",
  listSandboxes: "🖥 Listing sandboxes",
  deleteSandbox: "🖥 Removing a sandbox",
  executeCommand: "💻 Running a command",
  runCode: "💻 Executing code",
  listFiles: "📁 Listing files",
  readFile: "📄 Reading a file",
  writeFile: "✏️ Writing a file",
  createDirectory: "📁 Creating a directory",
  searchFiles: "🔎 Searching files",
  replaceInFiles: "✏️ Editing files",
  gitClone: "🐙 Cloning a repo",
  gitStatus: "🐙 Checking git status",
  gitCommit: "🐙 Committing changes",
  gitPush: "🐙 Pushing to git",
  gitPull: "🐙 Pulling from git",
  gitBranch: "🐙 Managing git branches",
  getPreviewLink: "🔗 Getting preview link",
  runBackgroundProcess: "⚙️ Running a background process",
  lspDiagnostics: "🔍 Checking code diagnostics",
  archiveSandbox: "🖥 Archiving sandbox",
  // Browser
  browserUseRunTask: "🌐 Running browser task",
  browserUseStartTask: "🌐 Starting browser task",
  browserUseGetTask: "🌐 Checking browser task",
  browserSetup: "🌐 Setting up browser",
  browserNavigate: "🌐 Navigating to a page",
  browserInteract: "🌐 Interacting with page",
  browserExtract: "🌐 Extracting page content",
  browserScreenshot: "📸 Taking screenshot",
  // Twilio
  twilioSendSMS: "📱 Sending an SMS",
  twilioMakeCall: "📞 Making a phone call",
  twilioWhatsAppSendMessage: "💬 Sending a WhatsApp message",
  // Cloud
  awsS3: "☁️ Working with S3",
  awsEC2: "☁️ Working with EC2",
  awsLambda: "☁️ Running Lambda",
  gcpStorage: "☁️ Working with GCP Storage",
  gcpFunctions: "☁️ Running Cloud Functions",
  azureStorage: "☁️ Working with Azure Storage",
  // Databases
  postgresQuery: "🗄 Querying PostgreSQL",
  mysqlQuery: "🗄 Querying MySQL",
  mongodbQuery: "🗄 Querying MongoDB",
  // Proactive
  activateHeartbeat: "💓 Setting up heartbeat",
  setMorningBriefingTime: "🌅 Scheduling morning briefing",
  getAgentSystemStatus: "⚙️ Checking system status",
  // Misc
  getWeather: "🌤 Checking the weather",
  wikiQuery: "📚 Querying knowledge base",
  wikiIngest: "📚 Ingesting to knowledge base",
  readAgentSkill: "🛠 Reading agent skill",
  setupTrigger: "⚡ Setting up a trigger",
  listActiveTriggers: "⚡ Listing active triggers",
  removeTrigger: "⚡ Removing a trigger",
  // Legal
  analyzeContract: "📜 Analysing contract",
  compareContracts: "📜 Comparing contracts",
  extractClauses: "📜 Extracting clauses",
  complianceCheck: "📜 Checking compliance",
  redlineContract: "📜 Redlining contract",
};

/**
 * Composio tools arrive as TOOLKIT_ACTION_NAME (all caps, underscores).
 * We derive a human-friendly label from the toolkit prefix.
 */
const COMPOSIO_TOOLKIT_LABELS: Record<string, string> = {
  GMAIL: "📧 Gmail",
  GOOGLECALENDAR: "📅 Google Calendar",
  GOOGLEDRIVE: "📁 Google Drive",
  GOOGLEDOCS: "📄 Google Docs",
  GOOGLESHEETS: "📊 Google Sheets",
  GOOGLETASKS: "✅ Google Tasks",
  GOOGLECONTACTS: "👤 Google Contacts",
  GOOGLEMEET: "📹 Google Meet",
  GOOGLESEARCH: "🔍 Google Search",
  GITHUB: "🐙 GitHub",
  GITLAB: "🐙 GitLab",
  SLACK: "💬 Slack",
  NOTION: "📒 Notion",
  DISCORD: "💬 Discord",
  TWITTER: "🐦 Twitter / X",
  TWITTEROAUTH: "🐦 Twitter / X",
  LINKEDIN: "💼 LinkedIn",
  HUBSPOT: "🎯 HubSpot",
  SALESFORCE: "☁️ Salesforce",
  PIPEDRIVE: "🎯 Pipedrive",
  STRIPE: "💳 Stripe",
  SHOPIFY: "🛍 Shopify",
  AIRTABLE: "📊 Airtable",
  ASANA: "✅ Asana",
  JIRA: "🐛 Jira",
  TRELLO: "📋 Trello",
  CLICKUP: "✅ ClickUp",
  ZOOM: "📹 Zoom",
  CALENDLY: "📅 Calendly",
  DROPBOX: "📦 Dropbox",
  ONEDRIVE: "📦 OneDrive",
  FIGMA: "🎨 Figma",
  LINEAR: "📋 Linear",
  ZENDESK: "🎧 Zendesk",
  INTERCOM: "💬 Intercom",
  MAILCHIMP: "📧 Mailchimp",
  TYPEFORM: "📝 Typeform",
  WEBFLOW: "🌐 Webflow",
  WORDPRESS: "📝 WordPress",
  REDDIT: "📱 Reddit",
  YOUTUBE: "▶️ YouTube",
  SPOTIFY: "🎵 Spotify",
  WHATSAPP: "💬 WhatsApp",
  TELEGRAM: "✈️ Telegram",
  TWILIO: "📱 Twilio",
  SENDGRID: "📧 SendGrid",
  POSTMARK: "📧 Postmark",
  PAGERDUTY: "🚨 PagerDuty",
  DATADOG: "📊 Datadog",
  SENTRY: "🐛 Sentry",
  VERCEL: "▲ Vercel",
  NETLIFY: "🌐 Netlify",
  AWS: "☁️ AWS",
  GCP: "☁️ Google Cloud",
  AZURE: "☁️ Azure",
  SNOWFLAKE: "❄️ Snowflake",
  SUPABASE: "🗄 Supabase",
  MONGODB: "🍃 MongoDB",
  POSTGRES: "🐘 PostgreSQL",
  MYSQL: "🗄 MySQL",
  REDIS: "🔴 Redis",
  OPENAI: "🤖 OpenAI",
  ANTHROPIC: "🤖 Anthropic",
};

export function toolLabel(toolName: string): string {
  // 1. Exact match — internal tools (camelCase)
  if (toolName in INTERNAL_TOOL_LABELS) {
    return `${INTERNAL_TOOL_LABELS[toolName]}…`;
  }

  // 2. Composio convention: TOOLKIT_ACTION_NAME (all caps, underscores)
  //    Extract the toolkit prefix and look it up.
  if (toolName === toolName.toUpperCase() && toolName.includes("_")) {
    const prefix = toolName.split("_")[0];
    if (prefix in COMPOSIO_TOOLKIT_LABELS) {
      const action = toolName
        .slice(prefix.length + 1)
        .toLowerCase()
        .replace(/_/g, " ");
      return `${COMPOSIO_TOOLKIT_LABELS[prefix]}: ${action}…`;
    }
  }

  // 3. Generic fallback — humanise whatever the tool name is
  return `🔧 ${toolName.replace(/_/g, " ")}…`;
}