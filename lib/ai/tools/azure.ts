import { tool } from "ai";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

// ─── Azure CLI Helper ─────────────────────────────────────────────────────────
// All Azure tools use the az CLI. Ensure az is installed and authenticated.

const execAsync = promisify(exec);

async function runAz(args: string[]): Promise<any> {
  const { stdout, stderr } = await execAsync(`az ${args.join(" ")} -o json`);
  if (stderr && !stdout) {
    try {
      return JSON.parse(stdout);
    } catch {
      throw new Error(stderr);
    }
  }
  return JSON.parse(stdout);
}

// =============================================================================
// SECTION 1 — Blob Storage
// =============================================================================

export const azureStorage = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure Blob Storage: list/create/delete containers, list/upload/download/delete blobs, " +
      "manage tiers, generate SAS tokens. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_containers",
        "create_container",
        "delete_container",
        "list_blobs",
        "upload",
        "download",
        "delete_blob",
        "copy_blob",
        "set_blob_tier",
        "generate_sas",
        "set_metadata",
        "list_storage_accounts",
      ]),
      accountName: z.string().optional().describe("Storage account name"),
      accountKey: z.string().optional().describe("Storage account key"),
      connectionString: z
        .string()
        .optional()
        .describe("Storage connection string"),
      container: z.string().optional().describe("Container name"),
      blob: z.string().optional().describe("Blob name/path"),
      sourceContainer: z
        .string()
        .optional()
        .describe("Source container for copy"),
      sourceBlob: z.string().optional().describe("Source blob for copy"),
      destinationContainer: z
        .string()
        .optional()
        .describe("Destination container for copy"),
      destinationBlob: z
        .string()
        .optional()
        .describe("Destination blob for copy"),
      localPath: z.string().optional().describe("Local file path"),
      content: z.string().optional().describe("Content to upload (string)"),
      contentType: z
        .string()
        .optional()
        .describe("Content type (e.g. text/plain)"),
      tier: z
        .enum(["Hot", "Cool", "Archive"])
        .optional()
        .describe("Blob access tier"),
      expiresIn: z
        .number()
        .int()
        .optional()
        .default(3600)
        .describe("SAS token expiry in seconds"),
      permissions: z
        .string()
        .optional()
        .default("r")
        .describe("SAS permissions (r, w, d, l, a, c)"),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe("Blob metadata key-value pairs"),
      prefix: z.string().optional().describe("Blob prefix filter"),
      resourceGroup: z.string().optional().describe("Resource group name"),
      maxResults: z.number().int().optional().default(100),
    }),
    execute: async ({
      action,
      accountName,
      accountKey,
      connectionString,
      container,
      blob,
      sourceContainer,
      sourceBlob,
      destinationContainer,
      destinationBlob,
      localPath,
      content,
      contentType,
      tier,
      expiresIn,
      permissions,
      metadata,
      prefix,
      resourceGroup,
      maxResults,
    }) => {
      const authArg = connectionString
        ? `--connection-string ${connectionString}`
        : accountName
          ? `--account-name ${accountName}${accountKey ? ` --account-key ${accountKey}` : ""}`
          : "";
      const acctConn = connectionString || accountName ? "" : "";

      try {
        switch (action) {
          // ── Storage Accounts ──
          case "list_storage_accounts": {
            const args = ["storage", "account", "list"];
            if (resourceGroup) {
              args.push(`--resource-group ${resourceGroup}`);
            }
            const data = await runAz(args);
            return {
              success: true,
              accounts: (Array.isArray(data) ? data : []).map((a: any) => ({
                name: a.name,
                resourceGroup: a.resourceGroup,
                location: a.location,
                kind: a.kind,
                sku: a.sku?.name,
                primaryEndpoint: a.primaryEndpoints?.blob,
                status: a.statusOfPrimary,
                creationTime: a.creationTime,
                tags: a.tags,
              })),
            };
          }

          // ── Container Operations ──
          case "list_containers": {
            const args = ["storage", "container", "list", authArg];
            if (prefix) {
              args.push(`--prefix ${prefix}`);
            }
            const data = await runAz(args);
            return {
              success: true,
              containers: (Array.isArray(data) ? data : []).map((c: any) => ({
                name: c.name,
                metadata: c.metadata,
                publicAccess: c.publicAccess,
                lastModified: c.lastModified,
                leaseState: c.lease?.state,
              })),
            };
          }

          case "create_container": {
            if (!container) {
              return { success: false, error: "Container name required" };
            }
            await runAz([
              "storage",
              "container",
              "create",
              `--name ${container}`,
              authArg,
            ]);
            return { success: true, container, action: "created" };
          }

          case "delete_container": {
            if (!container) {
              return { success: false, error: "Container name required" };
            }
            await runAz([
              "storage",
              "container",
              "delete",
              `--name ${container}`,
              authArg,
              "--yes",
            ]);
            return { success: true, container, action: "deleted" };
          }

          // ── Blob Operations ──
          case "list_blobs": {
            if (!container) {
              return { success: false, error: "Container name required" };
            }
            const args = [
              "storage",
              "blob",
              "list",
              `--container-name ${container}`,
              authArg,
            ];
            if (prefix) {
              args.push(`--prefix ${prefix}`);
            }
            if (maxResults) {
              args.push(`--num-results ${maxResults}`);
            }
            const data = await runAz(args);
            return {
              success: true,
              blobs: (Array.isArray(data) ? data : []).map((b: any) => ({
                name: b.name,
                size: b.properties?.contentLength,
                contentType: b.properties?.contentType,
                blobType: b.properties?.blobType,
                lastModified: b.properties?.lastModified,
                accessTier: b.properties?.accessTier,
                metadata: b.metadata,
                etag: b.properties?.etag,
              })),
            };
          }

          case "upload": {
            if (!container || !blob) {
              return { success: false, error: "Container and blob required" };
            }
            if (localPath) {
              const args = [
                "storage",
                "blob",
                "upload",
                `--container-name ${container}`,
                `--name ${blob}`,
                `--file ${localPath}`,
                authArg,
              ];
              if (contentType) {
                args.push(`--content-type ${contentType}`);
              }
              if (tier) {
                args.push(`--tier ${tier}`);
              }
              await runAz(args);
            } else if (content === undefined) {
              return { success: false, error: "localPath or content required" };
            } else {
              const tmpFile = `/tmp/az_upload_${Date.now()}`;
              await execAsync(`echo ${JSON.stringify(content)} > ${tmpFile}`);
              await runAz([
                "storage",
                "blob",
                "upload",
                `--container-name ${container}`,
                `--name ${blob}`,
                `--file ${tmpFile}`,
                authArg,
              ]);
              await execAsync(`rm -f ${tmpFile}`);
            }
            return {
              success: true,
              container,
              blob,
              message: `Uploaded ${blob}`,
            };
          }

          case "download": {
            if (!container || !blob) {
              return { success: false, error: "Container and blob required" };
            }
            const tmpFile = localPath || `/tmp/az_download_${Date.now()}`;
            await runAz([
              "storage",
              "blob",
              "download",
              `--container-name ${container}`,
              `--name ${blob}`,
              `--file ${tmpFile}`,
              authArg,
            ]);
            const { stdout } = await execAsync(`cat ${tmpFile}`);
            if (!localPath) {
              await execAsync(`rm -f ${tmpFile}`);
            }
            return { success: true, container, blob, content: stdout };
          }

          case "delete_blob": {
            if (!container || !blob) {
              return { success: false, error: "Container and blob required" };
            }
            await runAz([
              "storage",
              "blob",
              "delete",
              `--container-name ${container}`,
              `--name ${blob}`,
              authArg,
              "--yes",
            ]);
            return { success: true, container, blob, action: "deleted" };
          }

          case "copy_blob": {
            if (
              !sourceContainer ||
              !sourceBlob ||
              !destinationContainer ||
              !destinationBlob
            ) {
              return {
                success: false,
                error:
                  "sourceContainer, sourceBlob, destinationContainer, destinationBlob required",
              };
            }
            const sourceUrl = `https://${accountName}.blob.core.windows.net/${sourceContainer}/${sourceBlob}`;
            await runAz([
              "storage",
              "blob",
              "copy",
              "start",
              `--source-uri ${sourceUrl}`,
              `--destination-container ${destinationContainer}`,
              `--destination-blob ${destinationBlob}`,
              authArg,
            ]);
            return {
              success: true,
              source: `${sourceContainer}/${sourceBlob}`,
              destination: `${destinationContainer}/${destinationBlob}`,
            };
          }

          case "set_blob_tier": {
            if (!container || !blob || !tier) {
              return {
                success: false,
                error: "Container, blob, and tier required",
              };
            }
            await runAz([
              "storage",
              "blob",
              "set-tier",
              `--container-name ${container}`,
              `--name ${blob}`,
              `--tier ${tier}`,
              authArg,
            ]);
            return { success: true, container, blob, tier };
          }

          case "generate_sas": {
            if (!container || !blob) {
              return { success: false, error: "Container and blob required" };
            }
            const data = await runAz([
              "storage",
              "blob",
              "generate-sas",
              `--container-name ${container}`,
              `--name ${blob}`,
              `--permissions ${permissions || "r"}`,
              `--expiry ${new Date(Date.now() + (expiresIn || 3600) * 1000).toISOString()}`,
              authArg,
            ]);
            return { success: true, sasToken: data, container, blob };
          }

          case "set_metadata": {
            if (!container || !blob || !metadata) {
              return {
                success: false,
                error: "Container, blob, and metadata required",
              };
            }
            const metadataArg = Object.entries(metadata)
              .map(([k, v]) => `${k}=${v}`)
              .join(" ");
            await runAz([
              "storage",
              "blob",
              "metadata",
              "update",
              `--container-name ${container}`,
              `--name ${blob}`,
              `--metadata ${metadataArg}`,
              authArg,
            ]);
            return { success: true, container, blob, metadata };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 2 — Virtual Machines
// =============================================================================

export const azureVM = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure Virtual Machines: list/start/stop/restart/delete, create, resize, " +
      "list images, availability sets. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list",
        "show",
        "start",
        "stop",
        "restart",
        "delete",
        "create",
        "resize",
        "list_sizes",
        "list_images",
        "list_avail_sets",
        "list_public_ips",
      ]),
      resourceGroup: z.string().optional().describe("Resource group name"),
      vmName: z.string().optional().describe("VM name"),
      location: z
        .string()
        .optional()
        .default("eastus")
        .describe("Azure region"),
      // Create params
      image: z
        .string()
        .optional()
        .default("UbuntuLTS")
        .describe("VM image (e.g. UbuntuLTS, Win2022Datacenter)"),
      size: z.string().optional().default("Standard_B1s").describe("VM size"),
      adminUsername: z.string().optional().describe("Admin username"),
      adminPassword: z
        .string()
        .optional()
        .describe("Admin password (omit for SSH key auth)"),
      sshKeyName: z.string().optional().describe("SSH public key name"),
      generateSshKeys: z.boolean().optional().default(false),
      vnetName: z.string().optional().describe("Virtual network name"),
      subnetName: z
        .string()
        .optional()
        .default("default")
        .describe("Subnet name"),
      publicIpName: z.string().optional().describe("Public IP name"),
      nsgName: z.string().optional().describe("Network security group name"),
      storageSku: z
        .string()
        .optional()
        .default("Standard_LRS")
        .describe("Storage SKU"),
      osDiskSize: z.number().int().optional().describe("OS disk size in GB"),
      tags: z.record(z.string(), z.string()).optional().describe("VM tags"),
      // Resize
      newSize: z.string().optional().describe("New VM size for resize"),
    }),
    execute: async ({
      action,
      resourceGroup,
      vmName,
      location,
      image,
      size,
      adminUsername,
      adminPassword,
      sshKeyName,
      generateSshKeys,
      vnetName,
      subnetName,
      publicIpName,
      nsgName,
      storageSku,
      osDiskSize,
      tags,
      newSize,
    }) => {
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      try {
        switch (action) {
          case "list": {
            const args = ["vm", "list", rgArg];
            const data = await runAz(args);
            return {
              success: true,
              vms: (Array.isArray(data) ? data : []).map((v: any) => ({
                name: v.name,
                resourceGroup: v.resourceGroup,
                location: v.location,
                vmId: v.vmId,
                size: v.hardwareProfile?.vmSize,
                osType: v.storageProfile?.osDisk?.osType,
                status: v.provisioningState,
                powerState: v.instanceView?.statuses?.find((s: any) =>
                  s.code?.startsWith("PowerState")
                )?.displayStatus,
                publicIps: v.network?.publicIpAddresses?.join(", "),
                privateIps: v.network?.privateIpAddresses?.join(", "),
                tags: v.tags,
              })),
            };
          }

          case "show": {
            if (!vmName || !resourceGroup) {
              return {
                success: false,
                error: "vmName and resourceGroup required",
              };
            }
            const data = await runAz(["vm", "show", `--name ${vmName}`, rgArg]);
            return { success: true, vm: data };
          }

          case "start": {
            if (!vmName || !resourceGroup) {
              return {
                success: false,
                error: "vmName and resourceGroup required",
              };
            }
            await runAz(["vm", "start", `--name ${vmName}`, rgArg]);
            return { success: true, vmName, action: "started" };
          }

          case "stop": {
            if (!vmName || !resourceGroup) {
              return {
                success: false,
                error: "vmName and resourceGroup required",
              };
            }
            await runAz(["vm", "stop", `--name ${vmName}`, rgArg]);
            return { success: true, vmName, action: "stopped" };
          }

          case "restart": {
            if (!vmName || !resourceGroup) {
              return {
                success: false,
                error: "vmName and resourceGroup required",
              };
            }
            await runAz(["vm", "restart", `--name ${vmName}`, rgArg]);
            return { success: true, vmName, action: "restarted" };
          }

          case "delete": {
            if (!vmName || !resourceGroup) {
              return {
                success: false,
                error: "vmName and resourceGroup required",
              };
            }
            await runAz(["vm", "delete", `--name ${vmName}`, rgArg, "--yes"]);
            return { success: true, vmName, action: "deleted" };
          }

          case "create": {
            if (!vmName || !resourceGroup) {
              return {
                success: false,
                error: "vmName and resourceGroup required",
              };
            }
            const args = [
              "vm",
              "create",
              `--name ${vmName}`,
              rgArg,
              `--image ${image || "UbuntuLTS"}`,
              `--size ${size || "Standard_B1s"}`,
              `--location ${location || "eastus"}`,
            ];
            if (adminUsername) {
              args.push(`--admin-username ${adminUsername}`);
            }
            if (adminPassword) {
              args.push(`--admin-password ${adminPassword}`);
            }
            if (generateSshKeys) {
              args.push("--generate-ssh-keys");
            }
            if (sshKeyName) {
              args.push(`--ssh-key-name ${sshKeyName}`);
            }
            if (vnetName) {
              args.push(`--vnet-name ${vnetName}`);
            }
            if (subnetName) {
              args.push(`--subnet ${subnetName}`);
            }
            if (publicIpName) {
              args.push(`--public-ip-address ${publicIpName}`);
            }
            if (nsgName) {
              args.push(`--nsg ${nsgName}`);
            }
            if (storageSku) {
              args.push(`--storage-sku ${storageSku}`);
            }
            if (osDiskSize) {
              args.push(`--os-disk-size-gb ${osDiskSize}`);
            }
            if (tags) {
              args.push(
                `--tags ${Object.entries(tags)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" ")}`
              );
            }
            const data = await runAz(args);
            return { success: true, vm: vmName, result: data };
          }

          case "resize": {
            if (!vmName || !resourceGroup || !newSize) {
              return {
                success: false,
                error: "vmName, resourceGroup, and newSize required",
              };
            }
            const data = await runAz([
              "vm",
              "resize",
              `--name ${vmName}`,
              rgArg,
              `--size ${newSize}`,
            ]);
            return { success: true, vmName, newSize };
          }

          case "list_sizes": {
            const args = [
              "vm",
              "list-sizes",
              `--location ${location || "eastus"}`,
            ];
            const data = await runAz(args);
            return {
              success: true,
              sizes: (Array.isArray(data) ? data : []).map((s: any) => ({
                name: s.name,
                vCPUs: s.numberOfCores,
                memoryMb: s.memoryInMb,
                osDiskSizeGb: s.osDiskSizeInMb
                  ? Math.round(s.osDiskSizeInMb / 1024)
                  : 0,
                maxDataDisks: s.maxDataDiskCount,
                priceTier: s.tier,
              })),
            };
          }

          case "list_images": {
            const data = await runAz([
              "vm",
              "image",
              "list",
              `--location ${location || "eastus"}`,
            ]);
            return {
              success: true,
              images: (Array.isArray(data) ? data : []).map((i: any) => ({
                publisher: i.publisher,
                offer: i.offer,
                sku: i.sku,
                version: i.version,
              })),
            };
          }

          case "list_avail_sets": {
            const data = await runAz(["vm", "availability-set", "list", rgArg]);
            return {
              success: true,
              availabilitySets: Array.isArray(data) ? data : [],
            };
          }

          case "list_public_ips": {
            const data = await runAz(["network", "public-ip", "list", rgArg]);
            return {
              success: true,
              ips: (Array.isArray(data) ? data : []).map((ip: any) => ({
                name: ip.name,
                ipAddress: ip.ipAddress,
                fqdn: ip.dnsSettings?.fqdn,
                allocationMethod: ip.publicIPAllocationMethod,
                sku: ip.sku?.name,
              })),
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 3 — Web Apps (App Service)
// =============================================================================

export const azureWebApp = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure App Service Web Apps: list, show, create, start/stop/restart, " +
      "manage app settings, connection strings, deploy. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list",
        "show",
        "create",
        "start",
        "stop",
        "restart",
        "delete",
        "list_app_settings",
        "set_app_settings",
        "delete_app_settings",
        "list_connection_strings",
        "set_connection_strings",
        "browse",
        "list_plans",
        "list_runtimes",
      ]),
      resourceGroup: z.string().optional().describe("Resource group name"),
      appName: z.string().optional().describe("Web app name"),
      planName: z.string().optional().describe("App Service plan name"),
      location: z
        .string()
        .optional()
        .default("eastus")
        .describe("Azure region"),
      runtime: z
        .string()
        .optional()
        .default("NODE:20-lts")
        .describe("Runtime stack"),
      sku: z
        .string()
        .optional()
        .default("F1")
        .describe("Plan SKU (F1, D1, B1, S1, P1V2)"),
      settings: z
        .record(z.string(), z.string())
        .optional()
        .describe("App settings key-value pairs"),
      settingNames: z
        .array(z.string())
        .optional()
        .describe("Setting names to delete"),
      connectionStringName: z
        .string()
        .optional()
        .describe("Connection string name"),
      connectionStringValue: z
        .string()
        .optional()
        .describe("Connection string value"),
      connectionStringType: z
        .string()
        .optional()
        .default("SQLAzure")
        .describe("Connection string type"),
      tags: z.record(z.string(), z.string()).optional().describe("App tags"),
    }),
    execute: async ({
      action,
      resourceGroup,
      appName,
      planName,
      location,
      runtime,
      sku,
      settings,
      settingNames,
      connectionStringName,
      connectionStringValue,
      connectionStringType,
      tags,
    }) => {
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      try {
        switch (action) {
          case "list": {
            const data = await runAz(["webapp", "list", rgArg]);
            return {
              success: true,
              apps: (Array.isArray(data) ? data : []).map((a: any) => ({
                name: a.name,
                resourceGroup: a.resourceGroup,
                location: a.location,
                kind: a.kind,
                state: a.state,
                defaultHostName: a.defaultHostName,
                plan: a.appServicePlanId?.split("/").pop(),
                sku: a.sku?.name,
                tags: a.tags,
              })),
            };
          }

          case "show": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "webapp",
              "show",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, app: data };
          }

          case "create": {
            if (!appName || !resourceGroup) {
              return {
                success: false,
                error: "appName and resourceGroup required",
              };
            }
            const args = [
              "webapp",
              "create",
              `--name ${appName}`,
              rgArg,
              `--runtime ${runtime || "NODE:20-lts"}`,
            ];
            if (planName) {
              args.push(`--plan ${planName}`);
            }
            if (location) {
              args.push(`--location ${location}`);
            }
            if (sku) {
              // Need to ensure plan exists with correct SKU first
              const plan = planName || `${appName}-plan`;
              await runAz([
                "appservice",
                "plan",
                "create",
                `--name ${plan}`,
                rgArg,
                `--sku ${sku}`,
                `--location ${location || "eastus"}`,
                "--is-linux",
              ]);
              args.push(`--plan ${plan}`);
            }
            const data = await runAz(args);
            return { success: true, app: appName, result: data };
          }

          case "start": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz(["webapp", "start", `--name ${appName}`, rgArg]);
            return { success: true, appName, action: "started" };
          }

          case "stop": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz(["webapp", "stop", `--name ${appName}`, rgArg]);
            return { success: true, appName, action: "stopped" };
          }

          case "restart": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz(["webapp", "restart", `--name ${appName}`, rgArg]);
            return { success: true, appName, action: "restarted" };
          }

          case "delete": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz([
              "webapp",
              "delete",
              `--name ${appName}`,
              rgArg,
              "--yes",
            ]);
            return { success: true, appName, action: "deleted" };
          }

          case "list_app_settings": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "webapp",
              "config",
              "appsettings",
              "list",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, settings: data };
          }

          case "set_app_settings": {
            if (!appName || !settings) {
              return { success: false, error: "appName and settings required" };
            }
            const settingsArgs = Object.entries(settings).map(
              ([k, v]) => `${k}=${v}`
            );
            await runAz([
              "webapp",
              "config",
              "appsettings",
              "set",
              `--name ${appName}`,
              rgArg,
              `--settings ${settingsArgs.join(" ")}`,
            ]);
            return { success: true, appName, settings };
          }

          case "delete_app_settings": {
            if (!appName || !settingNames?.length) {
              return {
                success: false,
                error: "appName and settingNames required",
              };
            }
            await runAz([
              "webapp",
              "config",
              "appsettings",
              "delete",
              `--name ${appName}`,
              rgArg,
              `--setting-names ${settingNames.join(" ")}`,
            ]);
            return { success: true, appName, settingNames, action: "deleted" };
          }

          case "list_connection_strings": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "webapp",
              "config",
              "connection-string",
              "list",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, connectionStrings: data };
          }

          case "set_connection_strings": {
            if (!appName || !connectionStringName || !connectionStringValue) {
              return {
                success: false,
                error:
                  "appName, connectionStringName, and connectionStringValue required",
              };
            }
            await runAz([
              "webapp",
              "config",
              "connection-string",
              "set",
              `--name ${appName}`,
              rgArg,
              `--connection-string-name ${connectionStringName}`,
              `--connection-string-value ${connectionStringValue}`,
              `--connection-string-type ${connectionStringType || "SQLAzure"}`,
            ]);
            return { success: true, appName, connectionStringName };
          }

          case "browse": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "webapp",
              "browse",
              `--name ${appName}`,
              rgArg,
            ]);
            return {
              success: true,
              url: data?.url || `https://${appName}.azurewebsites.net`,
            };
          }

          case "list_plans": {
            const data = await runAz(["appservice", "plan", "list", rgArg]);
            return {
              success: true,
              plans: (Array.isArray(data) ? data : []).map((p: any) => ({
                name: p.name,
                resourceGroup: p.resourceGroup,
                sku: p.sku?.name,
                numberOfSites: p.numberOfSites,
                location: p.location,
                kind: p.kind,
              })),
            };
          }

          case "list_runtimes": {
            const data = await runAz([
              "webapp",
              "list-runtimes",
              `--location ${location || "eastus"}`,
            ]);
            return { success: true, runtimes: Array.isArray(data) ? data : [] };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 4 — Azure SQL
// =============================================================================

export const azureSQL = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure SQL: list servers, list databases, create/delete, firewall rules, " +
      "connection strings. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_servers",
        "create_server",
        "delete_server",
        "list_databases",
        "create_database",
        "delete_database",
        "show_connection_string",
        "list_firewall_rules",
        "create_firewall_rule",
        "delete_firewall_rule",
      ]),
      resourceGroup: z.string().optional().describe("Resource group name"),
      serverName: z.string().optional().describe("SQL server name"),
      databaseName: z.string().optional().describe("Database name"),
      location: z
        .string()
        .optional()
        .default("eastus")
        .describe("Azure region"),
      adminUser: z.string().optional().describe("Server admin username"),
      adminPassword: z.string().optional().describe("Server admin password"),
      edition: z
        .string()
        .optional()
        .default("Basic")
        .describe(
          "Database edition (Basic, Standard, Premium, GeneralPurpose, BusinessCritical)"
        ),
      collation: z
        .string()
        .optional()
        .default("SQL_Latin1_General_CP1_CI_AS")
        .describe("Database collation"),
      maxSize: z.number().int().optional().describe("Max size in GB"),
      firewallRuleName: z.string().optional().describe("Firewall rule name"),
      startIp: z.string().optional().describe("Firewall rule start IP"),
      endIp: z.string().optional().describe("Firewall rule end IP"),
      tags: z
        .record(z.string(), z.string())
        .optional()
        .describe("Resource tags"),
    }),
    execute: async ({
      action,
      resourceGroup,
      serverName,
      databaseName,
      location,
      adminUser,
      adminPassword,
      edition,
      collation,
      maxSize,
      firewallRuleName,
      startIp,
      endIp,
      tags,
    }) => {
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      try {
        switch (action) {
          case "list_servers": {
            const data = await runAz(["sql", "server", "list", rgArg]);
            return {
              success: true,
              servers: (Array.isArray(data) ? data : []).map((s: any) => ({
                name: s.name,
                resourceGroup: s.resourceGroup,
                location: s.location,
                version: s.version,
                state: s.state,
                fullyQualifiedDomainName: s.fullyQualifiedDomainName,
                tags: s.tags,
              })),
            };
          }

          case "create_server": {
            if (!serverName || !resourceGroup || !adminUser || !adminPassword) {
              return {
                success: false,
                error:
                  "serverName, resourceGroup, adminUser, and adminPassword required",
              };
            }
            const args = [
              "sql",
              "server",
              "create",
              `--name ${serverName}`,
              rgArg,
              `--admin-user ${adminUser}`,
              `--admin-password ${adminPassword}`,
              `--location ${location || "eastus"}`,
            ];
            if (tags) {
              args.push(
                `--tags ${Object.entries(tags)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" ")}`
              );
            }
            const data = await runAz(args);
            return { success: true, server: serverName, result: data };
          }

          case "delete_server": {
            if (!serverName || !resourceGroup) {
              return {
                success: false,
                error: "serverName and resourceGroup required",
              };
            }
            await runAz([
              "sql",
              "server",
              "delete",
              `--name ${serverName}`,
              rgArg,
              "--yes",
            ]);
            return { success: true, serverName, action: "deleted" };
          }

          case "list_databases": {
            if (!serverName || !resourceGroup) {
              return {
                success: false,
                error: "serverName and resourceGroup required",
              };
            }
            const data = await runAz([
              "sql",
              "db",
              "list",
              `--server ${serverName}`,
              rgArg,
            ]);
            return {
              success: true,
              databases: (Array.isArray(data) ? data : []).map((d: any) => ({
                name: d.name,
                server: serverName,
                status: d.status,
                edition: d.edition,
                collation: d.collation,
                maxSizeBytes: d.maxSizeBytes,
                elasticPoolName: d.elasticPoolName,
              })),
            };
          }

          case "create_database": {
            if (!serverName || !resourceGroup || !databaseName) {
              return {
                success: false,
                error: "serverName, resourceGroup, and databaseName required",
              };
            }
            const args = [
              "sql",
              "db",
              "create",
              `--server ${serverName}`,
              `--name ${databaseName}`,
              rgArg,
              `--edition ${edition || "Basic"}`,
              `--collation ${collation || "SQL_Latin1_General_CP1_CI_AS"}`,
            ];
            if (maxSize) {
              args.push(`--max-size ${maxSize}GB`);
            }
            const data = await runAz(args);
            return {
              success: true,
              databaseName,
              server: serverName,
              result: data,
            };
          }

          case "delete_database": {
            if (!serverName || !resourceGroup || !databaseName) {
              return {
                success: false,
                error: "serverName, resourceGroup, and databaseName required",
              };
            }
            await runAz([
              "sql",
              "db",
              "delete",
              `--server ${serverName}`,
              `--name ${databaseName}`,
              rgArg,
              "--yes",
            ]);
            return { success: true, databaseName, action: "deleted" };
          }

          case "show_connection_string": {
            if (!serverName || !resourceGroup) {
              return {
                success: false,
                error: "serverName and resourceGroup required",
              };
            }
            const data = await runAz([
              "sql",
              "db",
              "show-connection-string",
              `--server ${serverName}`,
              rgArg,
              "--client ado.net",
            ]);
            return { success: true, connectionString: data };
          }

          case "list_firewall_rules": {
            if (!serverName || !resourceGroup) {
              return {
                success: false,
                error: "serverName and resourceGroup required",
              };
            }
            const data = await runAz([
              "sql",
              "server",
              "firewall-rule",
              "list",
              `--server ${serverName}`,
              rgArg,
            ]);
            return {
              success: true,
              rules: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.name,
                startIpAddress: r.startIpAddress,
                endIpAddress: r.endIpAddress,
              })),
            };
          }

          case "create_firewall_rule": {
            if (
              !serverName ||
              !resourceGroup ||
              !firewallRuleName ||
              !startIp ||
              !endIp
            ) {
              return {
                success: false,
                error:
                  "serverName, resourceGroup, firewallRuleName, startIp, and endIp required",
              };
            }
            await runAz([
              "sql",
              "server",
              "firewall-rule",
              "create",
              `--server ${serverName}`,
              `--name ${firewallRuleName}`,
              rgArg,
              `--start-ip-address ${startIp}`,
              `--end-ip-address ${endIp}`,
            ]);
            return { success: true, firewallRuleName, startIp, endIp };
          }

          case "delete_firewall_rule": {
            if (!serverName || !resourceGroup || !firewallRuleName) {
              return {
                success: false,
                error:
                  "serverName, resourceGroup, and firewallRuleName required",
              };
            }
            await runAz([
              "sql",
              "server",
              "firewall-rule",
              "delete",
              `--server ${serverName}`,
              `--name ${firewallRuleName}`,
              rgArg,
              "--yes",
            ]);
            return { success: true, firewallRuleName, action: "deleted" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 5 — Key Vault
// =============================================================================

export const azureKeyVault = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure Key Vault: list vaults, list/get/set/delete secrets, certificates, keys. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_vaults",
        "list_secrets",
        "show_secret",
        "set_secret",
        "delete_secret",
        "list_certificates",
        "show_certificate",
        "list_keys",
        "show_key",
        "list_deleted_secrets",
      ]),
      vaultName: z.string().optional().describe("Key Vault name"),
      secretName: z.string().optional().describe("Secret name"),
      secretValue: z.string().optional().describe("Secret value"),
      contentType: z
        .string()
        .optional()
        .describe("Secret content type (e.g. text/plain)"),
      certificateName: z.string().optional().describe("Certificate name"),
      keyName: z.string().optional().describe("Key name"),
      resourceGroup: z.string().optional().describe("Resource group name"),
    }),
    execute: async ({
      action,
      vaultName,
      secretName,
      secretValue,
      contentType,
      certificateName,
      keyName,
      resourceGroup,
    }) => {
      const vaultArg = vaultName ? `--vault-name ${vaultName}` : "";
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      try {
        switch (action) {
          case "list_vaults": {
            const data = await runAz(["keyvault", "list", rgArg]);
            return {
              success: true,
              vaults: (Array.isArray(data) ? data : []).map((v: any) => ({
                name: v.name,
                resourceGroup: v.resourceGroup,
                location: v.location,
                sku: v.sku?.name,
                enabledForDeployment: v.properties?.enabledForDeployment,
                enableRbacAuthorization: v.properties?.enableRbacAuthorization,
                softDeleteRetentionDays:
                  v.properties?.softDeleteRetentionInDays,
                tags: v.tags,
              })),
            };
          }

          case "list_secrets": {
            if (!vaultName) {
              return { success: false, error: "vaultName required" };
            }
            const data = await runAz(["keyvault", "secret", "list", vaultArg]);
            return {
              success: true,
              secrets: (Array.isArray(data) ? data : []).map((s: any) => ({
                id: s.id,
                name: s.name,
                enabled: s.attributes?.enabled,
                created: s.attributes?.created,
                updated: s.attributes?.updated,
                contentType: s.contentType,
                tags: s.tags,
              })),
            };
          }

          case "show_secret": {
            if (!vaultName || !secretName) {
              return {
                success: false,
                error: "vaultName and secretName required",
              };
            }
            const data = await runAz([
              "keyvault",
              "secret",
              "show",
              vaultArg,
              `--name ${secretName}`,
            ]);
            return {
              success: true,
              secret: data,
              value: data.value || "(hidden)",
            };
          }

          case "set_secret": {
            if (!vaultName || !secretName || !secretValue) {
              return {
                success: false,
                error: "vaultName, secretName, and secretValue required",
              };
            }
            const args = [
              "keyvault",
              "secret",
              "set",
              vaultArg,
              `--name ${secretName}`,
              `--value ${secretValue}`,
            ];
            if (contentType) {
              args.push(`--content-type ${contentType}`);
            }
            const data = await runAz(args);
            return { success: true, secretName, vaultName, result: data };
          }

          case "delete_secret": {
            if (!vaultName || !secretName) {
              return {
                success: false,
                error: "vaultName and secretName required",
              };
            }
            await runAz([
              "keyvault",
              "secret",
              "delete",
              vaultArg,
              `--name ${secretName}`,
            ]);
            return { success: true, secretName, vaultName, action: "deleted" };
          }

          case "list_certificates": {
            if (!vaultName) {
              return { success: false, error: "vaultName required" };
            }
            const data = await runAz([
              "keyvault",
              "certificate",
              "list",
              vaultArg,
            ]);
            return {
              success: true,
              certificates: (Array.isArray(data) ? data : []).map((c: any) => ({
                id: c.id,
                name: c.name,
                enabled: c.attributes?.enabled,
                created: c.attributes?.created,
                expires: c.attributes?.expires,
                tags: c.tags,
              })),
            };
          }

          case "show_certificate": {
            if (!vaultName || !certificateName) {
              return {
                success: false,
                error: "vaultName and certificateName required",
              };
            }
            const data = await runAz([
              "keyvault",
              "certificate",
              "show",
              vaultArg,
              `--name ${certificateName}`,
            ]);
            return { success: true, certificate: data };
          }

          case "list_keys": {
            if (!vaultName) {
              return { success: false, error: "vaultName required" };
            }
            const data = await runAz(["keyvault", "key", "list", vaultArg]);
            return {
              success: true,
              keys: (Array.isArray(data) ? data : []).map((k: any) => ({
                name: k.name,
                enabled: k.attributes?.enabled,
                created: k.attributes?.created,
                keyType: k.key?.kid?.split("/").pop(),
                tags: k.tags,
              })),
            };
          }

          case "show_key": {
            if (!vaultName || !keyName) {
              return {
                success: false,
                error: "vaultName and keyName required",
              };
            }
            const data = await runAz([
              "keyvault",
              "key",
              "show",
              vaultArg,
              `--name ${keyName}`,
            ]);
            return { success: true, key: data };
          }

          case "list_deleted_secrets": {
            if (!vaultName) {
              return { success: false, error: "vaultName required" };
            }
            const data = await runAz([
              "keyvault",
              "secret",
              "list-deleted",
              vaultArg,
            ]);
            return {
              success: true,
              deletedSecrets: Array.isArray(data) ? data : [],
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 6 — AKS (Kubernetes Service)
// =============================================================================

export const azureAKS = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure Kubernetes Service: list clusters, show, get credentials, " +
      "list node pools, scale, upgrade. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list",
        "show",
        "get_credentials",
        "list_node_pools",
        "scale",
        "upgrade",
        "list_versions",
      ]),
      resourceGroup: z.string().optional().describe("Resource group name"),
      clusterName: z.string().optional().describe("AKS cluster name"),
      nodePoolName: z.string().optional().describe("Node pool name"),
      nodeCount: z.number().int().optional().describe("Node count for scaling"),
      kubernetesVersion: z
        .string()
        .optional()
        .describe("Kubernetes version for upgrade"),
      location: z
        .string()
        .optional()
        .default("eastus")
        .describe("Azure region"),
      admin: z
        .boolean()
        .optional()
        .default(false)
        .describe("Get admin credentials"),
    }),
    execute: async ({
      action,
      resourceGroup,
      clusterName,
      nodePoolName,
      nodeCount,
      kubernetesVersion,
      location,
      admin,
    }) => {
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      try {
        switch (action) {
          case "list": {
            const data = await runAz(["aks", "list", rgArg]);
            return {
              success: true,
              clusters: (Array.isArray(data) ? data : []).map((c: any) => ({
                name: c.name,
                resourceGroup: c.resourceGroup,
                location: c.location,
                kubernetesVersion: c.kubernetesVersion,
                provisioningState: c.provisioningState,
                fqdn: c.fqdn,
                nodeResourceGroup: c.nodeResourceGroup,
                agentPoolProfiles: c.agentPoolProfiles?.map((p: any) => ({
                  name: p.name,
                  count: p.count,
                  vmSize: p.vmSize,
                  osType: p.osType,
                  mode: p.mode,
                })),
                tags: c.tags,
              })),
            };
          }

          case "show": {
            if (!clusterName || !resourceGroup) {
              return {
                success: false,
                error: "clusterName and resourceGroup required",
              };
            }
            const data = await runAz([
              "aks",
              "show",
              `--name ${clusterName}`,
              rgArg,
            ]);
            return { success: true, cluster: data };
          }

          case "get_credentials": {
            if (!clusterName || !resourceGroup) {
              return {
                success: false,
                error: "clusterName and resourceGroup required",
              };
            }
            const args = [
              "aks",
              "get-credentials",
              `--name ${clusterName}`,
              rgArg,
            ];
            if (admin) {
              args.push("--admin");
            }
            await execAsync(`az ${args.join(" ")}`);
            return {
              success: true,
              clusterName,
              message: "Credentials configured for kubectl",
            };
          }

          case "list_node_pools": {
            if (!clusterName || !resourceGroup) {
              return {
                success: false,
                error: "clusterName and resourceGroup required",
              };
            }
            const data = await runAz([
              "aks",
              "nodepool",
              "list",
              `--cluster-name ${clusterName}`,
              rgArg,
            ]);
            return {
              success: true,
              nodePools: (Array.isArray(data) ? data : []).map((p: any) => ({
                name: p.name,
                count: p.count,
                vmSize: p.vmSize,
                osType: p.osType,
                mode: p.mode,
                provisioningState: p.provisioningState,
                nodeLabels: p.nodeLabels,
                nodeTaints: p.nodeTaints,
              })),
            };
          }

          case "scale": {
            if (!clusterName || !resourceGroup || nodeCount === undefined) {
              return {
                success: false,
                error: "clusterName, resourceGroup, and nodeCount required",
              };
            }
            const poolArg = nodePoolName
              ? `--nodepool-name ${nodePoolName}`
              : "";
            await runAz([
              "aks",
              "scale",
              `--name ${clusterName}`,
              rgArg,
              `--node-count ${nodeCount}`,
              poolArg,
            ]);
            return { success: true, clusterName, nodeCount };
          }

          case "upgrade": {
            if (!clusterName || !resourceGroup || !kubernetesVersion) {
              return {
                success: false,
                error:
                  "clusterName, resourceGroup, and kubernetesVersion required",
              };
            }
            await runAz([
              "aks",
              "upgrade",
              `--name ${clusterName}`,
              rgArg,
              `--kubernetes-version ${kubernetesVersion}`,
            ]);
            return { success: true, clusterName, kubernetesVersion };
          }

          case "list_versions": {
            const data = await runAz([
              "aks",
              "get-versions",
              `--location ${location || "eastus"}`,
            ]);
            return {
              success: true,
              versions: (data?.values || []).map((v: any) => ({
                version: v.version,
                patchVersions: v.patchVersions
                  ? Object.keys(v.patchVersions)
                  : [],
                isPreview: v.isPreview,
              })),
              orchestrator: data.orchestrator,
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 7 — Functions
// =============================================================================

export const azureFunctions = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure Functions: list, show, create, delete, list app settings, " +
      "set app settings, start, stop, restart. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list",
        "show",
        "create",
        "delete",
        "start",
        "stop",
        "restart",
        "list_app_settings",
        "set_app_settings",
        "list_keys",
        "show_keys",
      ]),
      resourceGroup: z.string().optional().describe("Resource group name"),
      appName: z.string().optional().describe("Function app name"),
      planName: z.string().optional().describe("App Service plan name"),
      location: z
        .string()
        .optional()
        .default("eastus")
        .describe("Azure region"),
      runtime: z
        .string()
        .optional()
        .default("node")
        .describe("Runtime stack (node, python, dotnet, java)"),
      runtimeVersion: z
        .string()
        .optional()
        .default("20")
        .describe("Runtime version"),
      storageAccount: z
        .string()
        .optional()
        .describe("Storage account for function app"),
      functionsVersion: z
        .string()
        .optional()
        .default("4")
        .describe("Functions runtime version"),
      settings: z
        .record(z.string(), z.string())
        .optional()
        .describe("App settings"),
      sku: z
        .string()
        .optional()
        .default("Y1")
        .describe(
          "Plan SKU (Y1=Consumption, B1=Basic, S1=Standard, P1V2=Premium)"
        ),
      tags: z
        .record(z.string(), z.string())
        .optional()
        .describe("Resource tags"),
    }),
    execute: async ({
      action,
      resourceGroup,
      appName,
      planName,
      location,
      runtime,
      runtimeVersion,
      storageAccount,
      functionsVersion,
      settings,
      sku,
      tags,
    }) => {
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      try {
        switch (action) {
          case "list": {
            const data = await runAz(["functionapp", "list", rgArg]);
            return {
              success: true,
              apps: (Array.isArray(data) ? data : []).map((a: any) => ({
                name: a.name,
                resourceGroup: a.resourceGroup,
                location: a.location,
                kind: a.kind,
                state: a.state,
                defaultHostName: a.defaultHostName,
                plan: a.appServicePlanId?.split("/").pop(),
                tags: a.tags,
              })),
            };
          }

          case "show": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "functionapp",
              "show",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, app: data };
          }

          case "create": {
            if (!appName || !resourceGroup) {
              return {
                success: false,
                error: "appName and resourceGroup required",
              };
            }
            const args = [
              "functionapp",
              "create",
              `--name ${appName}`,
              rgArg,
              `--runtime ${runtime || "node"}`,
              `--runtime-version ${runtimeVersion || "20"}`,
              `--functions-version ${functionsVersion || "4"}`,
              `--location ${location || "eastus"}`,
            ];
            if (planName) {
              args.push(`--plan ${planName}`);
            }
            if (storageAccount) {
              args.push(`--storage-account ${storageAccount}`);
            }
            if (sku) {
              args.push(`--sku ${sku}`);
            }
            if (tags) {
              args.push(
                `--tags ${Object.entries(tags)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(" ")}`
              );
            }
            const data = await runAz(args);
            return { success: true, app: appName, result: data };
          }

          case "delete": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz([
              "functionapp",
              "delete",
              `--name ${appName}`,
              rgArg,
              "--yes",
            ]);
            return { success: true, appName, action: "deleted" };
          }

          case "start": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz(["functionapp", "start", `--name ${appName}`, rgArg]);
            return { success: true, appName, action: "started" };
          }

          case "stop": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz(["functionapp", "stop", `--name ${appName}`, rgArg]);
            return { success: true, appName, action: "stopped" };
          }

          case "restart": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            await runAz(["functionapp", "restart", `--name ${appName}`, rgArg]);
            return { success: true, appName, action: "restarted" };
          }

          case "list_app_settings": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "functionapp",
              "config",
              "appsettings",
              "list",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, settings: data };
          }

          case "set_app_settings": {
            if (!appName || !settings) {
              return { success: false, error: "appName and settings required" };
            }
            const settingsArgs = Object.entries(settings).map(
              ([k, v]) => `${k}=${v}`
            );
            await runAz([
              "functionapp",
              "config",
              "appsettings",
              "set",
              `--name ${appName}`,
              rgArg,
              `--settings ${settingsArgs.join(" ")}`,
            ]);
            return { success: true, appName, settings };
          }

          case "list_keys": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "functionapp",
              "keys",
              "list",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, keys: data };
          }

          case "show_keys": {
            if (!appName) {
              return { success: false, error: "appName required" };
            }
            const data = await runAz([
              "functionapp",
              "keys",
              "list",
              `--name ${appName}`,
              rgArg,
            ]);
            return { success: true, keys: data };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// SECTION 8 — ACR (Container Registry)
// =============================================================================

export const azureACR = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Azure Container Registry: list registries, list repositories, list tags, " +
      "import images, show credentials. Uses az CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_registries",
        "show_registry",
        "list_repositories",
        "list_tags",
        "show_manifest",
        "import_image",
        "show_credentials",
        "list_webhooks",
      ]),
      resourceGroup: z.string().optional().describe("Resource group name"),
      registryName: z.string().optional().describe("ACR registry name"),
      repository: z.string().optional().describe("Repository name"),
      tag: z.string().optional().describe("Image tag"),
      sourceImage: z
        .string()
        .optional()
        .describe(
          "Source image for import (e.g. docker.io/library/nginx:latest)"
        ),
      sourceRegistry: z.string().optional().describe("Source registry URI"),
    }),
    execute: async ({
      action,
      resourceGroup,
      registryName,
      repository,
      tag,
      sourceImage,
      sourceRegistry,
    }) => {
      const rgArg = resourceGroup ? `--resource-group ${resourceGroup}` : "";
      const regArg = registryName ? `--registry ${registryName}` : "";
      try {
        switch (action) {
          case "list_registries": {
            const data = await runAz(["acr", "list", rgArg]);
            return {
              success: true,
              registries: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.name,
                resourceGroup: r.resourceGroup,
                location: r.location,
                sku: r.sku?.name,
                loginServer: r.loginServer,
                adminUserEnabled: r.adminUserEnabled,
                creationDate: r.creationDate,
                tags: r.tags,
              })),
            };
          }

          case "show_registry": {
            if (!registryName) {
              return { success: false, error: "registryName required" };
            }
            const data = await runAz([
              "acr",
              "show",
              `--name ${registryName}`,
              rgArg,
            ]);
            return { success: true, registry: data };
          }

          case "list_repositories": {
            if (!registryName) {
              return { success: false, error: "registryName required" };
            }
            const data = await runAz([
              "acr",
              "repository",
              "list",
              `--name ${registryName}`,
            ]);
            return {
              success: true,
              repositories: Array.isArray(data) ? data : [],
            };
          }

          case "list_tags": {
            if (!registryName || !repository) {
              return {
                success: false,
                error: "registryName and repository required",
              };
            }
            const data = await runAz([
              "acr",
              "repository",
              "show-tags",
              `--name ${registryName}`,
              `--repository ${repository}`,
            ]);
            return {
              success: true,
              tags: Array.isArray(data) ? data : [],
              repository,
              registry: registryName,
            };
          }

          case "show_manifest": {
            if (!registryName || !repository || !tag) {
              return {
                success: false,
                error: "registryName, repository, and tag required",
              };
            }
            const data = await runAz([
              "acr",
              "repository",
              "show-manifest",
              `--name ${registryName}`,
              `--repository ${repository}`,
              `--tag ${tag}`,
            ]);
            return { success: true, manifest: data };
          }

          case "import_image": {
            if (!registryName || !sourceImage) {
              return {
                success: false,
                error: "registryName and sourceImage required",
              };
            }
            const args = [
              "acr",
              "import",
              `--name ${registryName}`,
              `--source ${sourceImage}`,
            ];
            if (sourceRegistry) {
              args.push(`--registry ${sourceRegistry}`);
            }
            if (tag) {
              args.push(`--tag ${tag}`);
            }
            await runAz(args);
            return {
              success: true,
              registryName,
              source: sourceImage,
              tag: tag || "latest",
            };
          }

          case "show_credentials": {
            if (!registryName) {
              return { success: false, error: "registryName required" };
            }
            const data = await runAz([
              "acr",
              "credential",
              "show",
              `--name ${registryName}`,
            ]);
            return { success: true, credentials: data };
          }

          case "list_webhooks": {
            if (!registryName) {
              return { success: false, error: "registryName required" };
            }
            const data = await runAz([
              "acr",
              "webhook",
              "list",
              `--name ${registryName}`,
              rgArg,
            ]);
            return {
              success: true,
              webhooks: (Array.isArray(data) ? data : []).map((w: any) => ({
                name: w.name,
                status: w.status,
                scope: w.scope,
                actions: w.actions,
                location: w.location,
              })),
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

// =============================================================================
// EXPORT ALL — 7 tools
// =============================================================================

export const allAzureTools = (ctx: { userId: string }) => ({
  azureStorage: azureStorage(ctx),
  azureVM: azureVM(ctx),
  azureWebApp: azureWebApp(ctx),
  azureSQL: azureSQL(ctx),
  azureKeyVault: azureKeyVault(ctx),
  azureAKS: azureAKS(ctx),
  azureFunctions: azureFunctions(ctx),
  azureACR: azureACR(ctx),
});
