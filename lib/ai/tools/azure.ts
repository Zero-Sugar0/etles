import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runAz(args: string[]) {
  const { stdout, stderr } = await execAsync(`az ${args.join(" ")} -o json`);
  if (stderr && !stdout) {
     // Some az commands output to stderr even on success, but usually it's warnings
     try {
       return JSON.parse(stdout);
     } catch {
       throw new Error(stderr);
     }
  }
  return JSON.parse(stdout);
}

export const azureStorage = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage Azure Blob Storage via az CLI: list containers, list blobs, upload, download.",
    inputSchema: z.object({
      action: z.enum(["list_containers", "list_blobs", "upload", "download"]),
      accountName: z.string().optional(),
      container: z.string().optional(),
      blob: z.string().optional(),
      localPath: z.string().optional(),
    }),
    execute: async ({ action, accountName, container, blob, localPath }) => {
      try {
        const accountArg = accountName ? `--account-name ${accountName}` : "";
        switch (action) {
          case "list_containers": {
            const data = await runAz(["storage", "container", "list", accountArg]);
            return { success: true, containers: data };
          }
          case "list_blobs": {
            if (!container) return { success: false, error: "Container required" };
            const data = await runAz(["storage", "blob", "list", "--container-name", container, accountArg]);
            return { success: true, blobs: data };
          }
          case "upload": {
            if (!container || !blob || !localPath) return { success: false, error: "Container, blob, and localPath required" };
            await execAsync(`az storage blob upload --container-name ${container} --name ${blob} --file ${localPath} ${accountArg}`);
            return { success: true, message: `Uploaded ${blob} to ${container}` };
          }
          case "download": {
            if (!container || !blob || !localPath) return { success: false, error: "Container, blob, and localPath required" };
            await execAsync(`az storage blob download --container-name ${container} --name ${blob} --file ${localPath} ${accountArg}`);
            return { success: true, message: `Downloaded ${blob} to ${localPath}` };
          }
          default: return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const azureVM = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage Azure Virtual Machines via az CLI: list, start, stop, restart.",
    inputSchema: z.object({
      action: z.enum(["list", "start", "stop", "restart"]),
      resourceGroup: z.string().optional(),
      vmName: z.string().optional(),
    }),
    execute: async ({ action, resourceGroup, vmName }) => {
      try {
        const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
        switch (action) {
          case "list": {
            const data = await runAz(["vm", "list", rgArg]);
            return { success: true, vms: data };
          }
          case "start": {
            if (!vmName || !resourceGroup) return { success: false, error: "VM name and resource group required" };
            await execAsync(`az vm start --name ${vmName} --resource-group ${resourceGroup}`);
            return { success: true, message: `Started VM ${vmName}` };
          }
          case "stop": {
            if (!vmName || !resourceGroup) return { success: false, error: "VM name and resource group required" };
            await execAsync(`az vm stop --name ${vmName} --resource-group ${resourceGroup}`);
            return { success: true, message: `Stopped VM ${vmName}` };
          }
          case "restart": {
            if (!vmName || !resourceGroup) return { success: false, error: "VM name and resource group required" };
            await execAsync(`az vm restart --name ${vmName} --resource-group ${resourceGroup}`);
            return { success: true, message: `Restarted VM ${vmName}` };
          }
          default: return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const azureFunctions = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage Azure Functions via az CLI: list, show.",
    inputSchema: z.object({
      action: z.enum(["list", "show"]),
      resourceGroup: z.string().optional(),
      appName: z.string().optional(),
    }),
    execute: async ({ action, resourceGroup, appName }) => {
      try {
        const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
        switch (action) {
          case "list": {
            const data = await runAz(["functionapp", "list", rgArg]);
            return { success: true, apps: data };
          }
          case "show": {
            if (!appName || !resourceGroup) return { success: false, error: "App name and resource group required" };
            const data = await runAz(["functionapp", "show", "--name", appName, "--resource-group", resourceGroup]);
            return { success: true, app: data };
          }
          default: return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });
