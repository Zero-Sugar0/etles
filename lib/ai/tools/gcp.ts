import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function runGCloud(args: string[]) {
  const { stdout, stderr } = await execAsync(`gcloud ${args.join(" ")} --format=json`);
  if (stderr && !stdout) throw new Error(stderr);
  return JSON.parse(stdout);
}

export const gcpStorage = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage Google Cloud Storage via gcloud: list buckets, list objects, upload, download.",
    inputSchema: z.object({
      action: z.enum(["list_buckets", "list_objects", "upload", "download"]),
      bucket: z.string().optional(),
      object: z.string().optional(),
      localPath: z.string().optional(),
    }),
    execute: async ({ action, bucket, object, localPath }) => {
      try {
        switch (action) {
          case "list_buckets": {
            const data = await runGCloud(["storage", "buckets", "list"]);
            return { success: true, buckets: data };
          }
          case "list_objects": {
            if (!bucket) return { success: false, error: "Bucket required" };
            const data = await runGCloud(["storage", "objects", "list", `gs://${bucket}`]);
            return { success: true, objects: data };
          }
          case "upload": {
            if (!bucket || !object || !localPath) return { success: false, error: "Bucket, object, and localPath required" };
            await execAsync(`gcloud storage cp ${localPath} gs://${bucket}/${object}`);
            return { success: true, message: `Uploaded to gs://${bucket}/${object}` };
          }
          case "download": {
            if (!bucket || !object || !localPath) return { success: false, error: "Bucket, object, and localPath required" };
            await execAsync(`gcloud storage cp gs://${bucket}/${object} ${localPath}`);
            return { success: true, message: `Downloaded to ${localPath}` };
          }
          default: return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const gcpCompute = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage Google Compute Engine via gcloud: list instances, start, stop.",
    inputSchema: z.object({
      action: z.enum(["list_instances", "start", "stop"]),
      instanceName: z.string().optional(),
      zone: z.string().optional(),
    }),
    execute: async ({ action, instanceName, zone }) => {
      try {
        const zoneArg = zone ? `--zone=${zone}` : "";
        switch (action) {
          case "list_instances": {
            const data = await runGCloud(["compute", "instances", "list"]);
            return { success: true, instances: data };
          }
          case "start": {
            if (!instanceName) return { success: false, error: "Instance name required" };
            await execAsync(`gcloud compute instances start ${instanceName} ${zoneArg}`);
            return { success: true, message: `Started ${instanceName}` };
          }
          case "stop": {
            if (!instanceName) return { success: false, error: "Instance name required" };
            await execAsync(`gcloud compute instances stop ${instanceName} ${zoneArg}`);
            return { success: true, message: `Stopped ${instanceName}` };
          }
          default: return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const gcpFunctions = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage Google Cloud Functions via gcloud: list, call.",
    inputSchema: z.object({
      action: z.enum(["list", "call"]),
      functionName: z.string().optional(),
      region: z.string().optional(),
      data: z.string().optional().describe("JSON data for calling the function"),
    }),
    execute: async ({ action, functionName, region, data }) => {
      try {
        const regionArg = region ? `--region=${region}` : "";
        switch (action) {
          case "list": {
            const result = await runGCloud(["functions", "list"]);
            return { success: true, functions: result };
          }
          case "call": {
            if (!functionName) return { success: false, error: "Function name required" };
            const dataArg = data ? `--data='${data}'` : "";
            const { stdout } = await execAsync(`gcloud functions call ${functionName} ${regionArg} ${dataArg}`);
            return { success: true, result: stdout };
          }
          default: return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });
