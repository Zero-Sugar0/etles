/**
 * Tool set for Telegram AI paths (workflow + inline fallback).
 * Mirrors the web chat agent's core tools (memory, search, schedule, sandbox, etc.)
 * so behaviour stays consistent across surfaces.
 * lib/ai/build-etles-telegram-tools.ts
 */

import type { ToolSet } from "ai";
import * as aws from "@/lib/ai/tools/aws";
import * as azure from "@/lib/ai/tools/azure";
import * as browserUseTools from "@/lib/ai/tools/browser-use";
import { readAgentSkill } from "@/lib/ai/tools/agent-skills";
import * as db from "@/lib/ai/tools/databases";
import {
  archiveSandbox,
  createDirectory,
  createSandbox,
  deleteSandbox,
  executeCommand,
  getPreviewLink,
  gitBranch,
  gitClone,
  gitCommit,
  gitPull,
  gitPush,
  gitStatus,
  listFiles,
  listSandboxes,
  lspDiagnostics,
  readFile,
  replaceInFiles,
  runBackgroundProcess,
  runCode,
  searchFiles,
  writeFile,
} from "@/lib/ai/tools/daytona";
import * as daytonaBrowserTools from "@/lib/ai/tools/daytona-browser";
import * as gcp from "@/lib/ai/tools/gcp";
import { getWeather } from "@/lib/ai/tools/get-weather";
import {
  addGoal,
  deleteGoal,
  listGoals,
  logGoalProgress,
  updateGoal,
} from "@/lib/ai/tools/goals";
import {
  addKnowledgeRelation,
  deleteKnowledgeEntity,
  deleteKnowledgeRelation,
  getKnowledgeEntity,
  searchKnowledgeGraph,
  upsertKnowledgeEntity,
} from "@/lib/ai/tools/knowledge-graph";
import * as legal from "@/lib/ai/tools/legal";
import {
  deleteMemory,
  recallMemory,
  saveMemory,
  updateMemory,
} from "@/lib/ai/tools/memory";
import { getMissionStatus, launchMission } from "@/lib/ai/tools/missions";
import { allOracleTools } from "@/lib/ai/tools/oracle-cloud";
import { getPersistentSandboxTools } from "@/lib/ai/tools/persistent-sandbox";
import {
  addPlanTask,
  cancelPlan,
  createPlan,
  deletePlan,
  listPlans,
  updatePlanTask,
} from "@/lib/ai/tools/planner";
import {
  activateHeartbeat,
  getAgentSystemStatus,
  setMorningBriefingTime,
} from "@/lib/ai/tools/proactive";
import {
  deleteReminder,
  deleteSchedule,
  listSchedules,
  setCronJob,
  setReminder,
} from "@/lib/ai/tools/schedule";
import { searchPastConversations } from "@/lib/ai/tools/search-history";
import {
  delegateToSubAgent,
  getSubAgentResult,
  listSubAgents,
} from "@/lib/ai/tools/subagents";
import {
  tavilyCrawl,
  tavilyExtract,
  tavilyMap,
  tavilySearch,
} from "@/lib/ai/tools/tavily-search";
import {
  listActiveTriggers,
  removeTrigger,
  setupTrigger,
} from "@/lib/ai/tools/triggers";
import * as twilio from "@/lib/ai/tools/twilio";
import * as twilioWhatsApp from "@/lib/ai/tools/twilio-whatsapp";
import { wikiIngest, wikiQuery } from "@/lib/ai/tools/wiki";
import { withApproval } from "@/lib/ai/tools/with-approval";

export type TelegramEtlesToolsParams = {
  userId: string;
  chatId: string;
  baseUrl: string;
  composioTools: Record<string, unknown>;
};

export function buildEtlesTelegramTools({
  userId,
  chatId,
  baseUrl,
  composioTools,
}: TelegramEtlesToolsParams): ToolSet {
  return {
    ...withApproval(composioTools),
    getWeather,
    readAgentSkill: readAgentSkill(),
    saveMemory: saveMemory({ userId }),
    recallMemory: recallMemory({ userId }),
    searchPastConversations: searchPastConversations({ userId }),
    updateMemory: updateMemory({ userId }),
    deleteMemory: deleteMemory({ userId }),
    setReminder: setReminder({ userId, baseUrl }),
    setCronJob: setCronJob({ userId, baseUrl }),
    listSchedules: listSchedules({ userId }),
    deleteSchedule: deleteSchedule({ userId: userId || "" }),
    deleteReminder: deleteReminder({ userId }),
    setupTrigger: setupTrigger({ userId }),
    listActiveTriggers: listActiveTriggers({ userId }),
    removeTrigger: removeTrigger({ userId }),
    delegateToSubAgent: delegateToSubAgent({
      userId,
      chatId,
      baseUrl,
    }),
    getSubAgentResult: getSubAgentResult({ userId }),
    listSubAgents: listSubAgents(),
    launchMission: launchMission({ userId, chatId, baseUrl }),
    getMissionStatus: getMissionStatus({ userId }),
    activateHeartbeat: activateHeartbeat({ userId, baseUrl }),
    getAgentSystemStatus: getAgentSystemStatus({ userId }),
    setMorningBriefingTime: setMorningBriefingTime({ userId, baseUrl }),
    upsertKnowledgeEntity: upsertKnowledgeEntity({ userId }),
    addKnowledgeRelation: addKnowledgeRelation({ userId }),
    getKnowledgeEntity: getKnowledgeEntity({ userId }),
    searchKnowledgeGraph: searchKnowledgeGraph({ userId }),
    deleteKnowledgeEntity: deleteKnowledgeEntity({ userId }),
    deleteKnowledgeRelation: deleteKnowledgeRelation({ userId }),
    addGoal: addGoal({ userId }),
    updateGoal: updateGoal({ userId }),
    logGoalProgress: logGoalProgress({ userId }),
    listGoals: listGoals({ userId }),
    deleteGoal: deleteGoal({ userId }),
    createPlan: createPlan({ userId }),
    cancelPlan: cancelPlan({ userId }),
    addPlanTask: addPlanTask({ userId }),
    updatePlanTask: updatePlanTask({ userId }),
    listPlans: listPlans({ userId }),
    deletePlan: deletePlan({ userId }),
    tavilySearch,
    tavilyExtract,
    tavilyCrawl,
    tavilyMap,
    wikiQuery: wikiQuery({ userId }),
    wikiIngest: wikiIngest({ userId }),
    createSandbox: createSandbox({ userId }),
    listSandboxes: listSandboxes({ userId }),
    deleteSandbox: deleteSandbox({ userId }),
    executeCommand: executeCommand({ userId }),
    runCode: runCode({ userId }),
    listFiles: listFiles({ userId }),
    readFile: readFile({ userId }),
    writeFile: writeFile({ userId }),
    createDirectory: createDirectory({ userId }),
    searchFiles: searchFiles({ userId }),
    replaceInFiles: replaceInFiles({ userId }),
    gitClone: gitClone({ userId }),
    gitStatus: gitStatus({ userId }),
    gitCommit: gitCommit({ userId }),
    gitPush: gitPush({ userId }),
    gitPull: gitPull({ userId }),
    gitBranch: gitBranch({ userId }),
    getPreviewLink: getPreviewLink({ userId }),
    runBackgroundProcess: runBackgroundProcess({ userId }),
    lspDiagnostics: lspDiagnostics({ userId }),
    archiveSandbox: archiveSandbox({ userId }),
    // Persistent Sandbox
    ...getPersistentSandboxTools({ userId }),
    twilioMakeCall: twilio.twilioMakeCall({ userId }),
    twilioGetCall: twilio.twilioGetCall({ userId }),
    twilioListCalls: twilio.twilioListCalls({ userId }),
    twilioModifyCall: twilio.twilioModifyCall({ userId }),
    twilioSendSMS: twilio.twilioSendSMS({ userId }),
    twilioGetMessage: twilio.twilioGetMessage({ userId }),
    twilioListMessages: twilio.twilioListMessages({ userId }),
    twilioListMyNumbers: twilio.twilioListMyNumbers({ userId }),
    twilioSearchAvailableNumbers: twilio.twilioSearchAvailableNumbers({
      userId,
    }),
    twilioProvisionNumber: twilio.twilioProvisionNumber({ userId }),
    twilioReleaseNumber: twilio.twilioReleaseNumber({ userId }),
    twilioUpdateNumber: twilio.twilioUpdateNumber({ userId }),
    // Twilio WhatsApp Tools
    twilioWhatsAppSendMessage: twilioWhatsApp.twilioWhatsAppSendMessage({
      userId,
    }),
    twilioWhatsAppGetMessage: twilioWhatsApp.twilioWhatsAppGetMessage({
      userId,
    }),
    twilioWhatsAppListMessages: twilioWhatsApp.twilioWhatsAppListMessages({
      userId,
    }),
    twilioWhatsAppSendTemplate: twilioWhatsApp.twilioWhatsAppSendTemplate({
      userId,
    }),
    twilioWhatsAppCreateTemplate: twilioWhatsApp.twilioWhatsAppCreateTemplate({
      userId,
    }),
    twilioWhatsAppListTemplates: twilioWhatsApp.twilioWhatsAppListTemplates({
      userId,
    }),
    twilioWhatsAppGetTemplate: twilioWhatsApp.twilioWhatsAppGetTemplate({
      userId,
    }),
    twilioWhatsAppDeleteTemplate: twilioWhatsApp.twilioWhatsAppDeleteTemplate({
      userId,
    }),
    twilioWhatsAppSubmitApproval: twilioWhatsApp.twilioWhatsAppSubmitApproval({
      userId,
    }),
    twilioWhatsAppGetApprovalStatus:
      twilioWhatsApp.twilioWhatsAppGetApprovalStatus({ userId }),
    twilioWhatsAppListSenders: twilioWhatsApp.twilioWhatsAppListSenders({
      userId,
    }),
    twilioGetUsage: twilio.twilioGetMessage({ userId }),
    browserUseRunTask: browserUseTools.browserUseRunTask(),
    browserUseStartTask: browserUseTools.browserUseStartTask(),
    browserUseGetTask: browserUseTools.browserUseGetTask(),
    browserUseControlTask: browserUseTools.browserUseControlTask(),
    browserUseCreateSession: browserUseTools.browserUseCreateSession(),
    browserUseGetLiveUrl: browserUseTools.browserUseGetLiveUrl(),
    browserUseListTasks: browserUseTools.browserUseListTasks(),
    browserUseCheckCredits: browserUseTools.browserUseCheckCredits(),
    browserSetup: daytonaBrowserTools.browserSetup({ userId }),
    browserNavigate: daytonaBrowserTools.browserNavigate({ userId }),
    browserInteract: daytonaBrowserTools.browserInteract({ userId }),
    browserExtract: daytonaBrowserTools.browserExtract({ userId }),
    browserMultiTab: daytonaBrowserTools.browserMultiTab({ userId }),
    browserUploadFile: daytonaBrowserTools.browserUploadFile({ userId }),
    browserScreenshot: daytonaBrowserTools.browserScreenshot({ userId }),
    browserVisualInteract: daytonaBrowserTools.browserVisualInteract({
      userId,
    }),
    // AWS tools
    awsS3: aws.awsS3({ userId }),
    awsEC2: aws.awsEC2({ userId }),
    awsLambda: aws.awsLambda({ userId }),
    awsIAM: aws.awsIAM({ userId }),
    awsDynamoDB: aws.awsDynamoDB({ userId }),
    awsRDS: aws.awsRDS({ userId }),
    awsSES: aws.awsSES({ userId }),
    awsCloudFormation: aws.awsCloudFormation({ userId }),
    awsSQS: aws.awsSQS({ userId }),
    awsCloudWatch: aws.awsCloudWatch({ userId }),
    awsSTS: aws.awsSTS({ userId }),
    // GCP tools
    gcpStorage: gcp.gcpStorage({ userId }),
    gcpCompute: gcp.gcpCompute({ userId }),
    gcpFunctions: gcp.gcpFunctions({ userId }),
    gcpCloudRun: gcp.gcpCloudRun({ userId }),
    gcpCloudSQL: gcp.gcpCloudSQL({ userId }),
    gcpIAM: gcp.gcpIAM({ userId }),
    gcpDNS: gcp.gcpDNS({ userId }),
    gcpMonitoring: gcp.gcpMonitoring({ userId }),
    gcpPubSub: gcp.gcpPubSub({ userId }),
    gcpSecretManager: gcp.gcpSecretManager({ userId }),
    gcpCloudBuild: gcp.gcpCloudBuild({ userId }),
    gcpBigQuery: gcp.gcpBigQuery({ userId }),
    // Azure tools
    azureStorage: azure.azureStorage({ userId }),
    azureVM: azure.azureVM({ userId }),
    azureWebApp: azure.azureWebApp({ userId }),
    azureSQL: azure.azureSQL({ userId }),
    azureKeyVault: azure.azureKeyVault({ userId }),
    azureAKS: azure.azureAKS({ userId }),
    azureFunctions: azure.azureFunctions({ userId }),
    azureACR: azure.azureACR({ userId }),
    // Database tools
    postgresQuery: db.postgresQuery({ userId }),
    mysqlQuery: db.mysqlQuery({ userId }),
    mongodbQuery: db.mongodbQuery({ userId }),
    // Legal tools
    analyzeContract: legal.analyzeContract({ userId }),
    compareContracts: legal.compareContracts({ userId }),
    extractClauses: legal.extractClauses({ userId }),
    complianceCheck: legal.complianceCheck({ userId }),
    redlineContract: legal.redlineContract({ userId }),
    obligationTracker: legal.obligationTracker({ userId }),
    jurisdictionAnalysis: legal.jurisdictionAnalysis({ userId }),
    riskScoring: legal.riskScoring({ userId }),
    // Oracle Cloud tools
    ...allOracleTools({ userId }),
  } as ToolSet;
}
