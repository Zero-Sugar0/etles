import { tool } from "ai";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

// ─── GCloud CLI Helper ────────────────────────────────────────────────────────
// All GCP tools use the gcloud CLI. Ensure gcloud is installed and authenticated.

const execAsync = promisify(exec);

async function runGCloud(args: string[]): Promise<any> {
  const { stdout, stderr } = await execAsync(
    `gcloud ${args.join(" ")} --format=json`
  );
  if (stderr && !stdout) {
    throw new Error(stderr);
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout;
  }
}

// =============================================================================
// SECTION 1 — Cloud Storage
// =============================================================================

export const gcpStorage = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Storage: list/create/delete buckets, list/upload/download/delete/copy objects, " +
      "manage IAM policies, lifecycle rules, and object metadata. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_buckets",
        "create_bucket",
        "delete_bucket",
        "list_objects",
        "upload",
        "download",
        "delete_object",
        "copy_object",
        "get_iam_policy",
        "set_iam_policy",
        "get_lifecycle",
        "set_lifecycle",
        "get_object_metadata",
        "set_object_metadata",
        "generate_signed_url",
      ]),
      bucket: z.string().optional().describe("Cloud Storage bucket name"),
      object: z.string().optional().describe("Object key/path"),
      sourceBucket: z.string().optional().describe("Source bucket for copy"),
      sourceObject: z.string().optional().describe("Source object for copy"),
      destinationBucket: z
        .string()
        .optional()
        .describe("Destination bucket for copy"),
      destinationObject: z
        .string()
        .optional()
        .describe("Destination object for copy"),
      localPath: z
        .string()
        .optional()
        .describe("Local file path for upload/download"),
      content: z.string().optional().describe("Content to upload (string)"),
      contentType: z
        .string()
        .optional()
        .describe("Content type (e.g. text/plain, application/json)"),
      project: z.string().optional().describe("GCP project ID"),
      location: z
        .string()
        .optional()
        .default("US")
        .describe("Bucket location (e.g. US, EU, asia-east1)"),
      storageClass: z
        .enum(["STANDARD", "NEARLINE", "COLDLINE", "ARCHIVE"])
        .optional()
        .default("STANDARD"),
      lifecycleConfig: z.string().optional().describe("Lifecycle config JSON"),
      iamPolicy: z.string().optional().describe("IAM policy JSON"),
      expiresIn: z
        .number()
        .int()
        .optional()
        .default(3600)
        .describe("Signed URL expiry in seconds"),
      prefix: z.string().optional().describe("Object prefix filter"),
      maxResults: z
        .number()
        .int()
        .optional()
        .default(100)
        .describe("Max results to return"),
    }),
    execute: async ({
      action,
      bucket,
      object,
      sourceBucket,
      sourceObject,
      destinationBucket,
      destinationObject,
      localPath,
      content,
      contentType,
      project,
      location,
      storageClass,
      lifecycleConfig,
      iamPolicy,
      expiresIn,
      prefix,
      maxResults,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          // ── Bucket Operations ──
          case "list_buckets": {
            const data = await runGCloud([
              "storage",
              "buckets",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              buckets: (Array.isArray(data) ? data : []).map((b: any) => ({
                name: b.name || b.id,
                location: b.location,
                storageClass: b.storageClass,
                creationDate: b.timeCreated,
                projectNumber: b.projectNumber,
                etag: b.etag,
              })),
            };
          }

          case "create_bucket": {
            if (!bucket) {
              return { success: false, error: "Bucket name required" };
            }
            const args = [
              "storage",
              "buckets",
              "create",
              `gs://${bucket}`,
              projectFlag,
            ];
            if (location) {
              args.push("--location", location);
            }
            if (storageClass) {
              args.push("--default-storage-class", storageClass);
            }
            await runGCloud(args);
            return {
              success: true,
              bucket,
              location: location || "US",
              storageClass: storageClass || "STANDARD",
            };
          }

          case "delete_bucket": {
            if (!bucket) {
              return { success: false, error: "Bucket name required" };
            }
            await runGCloud([
              "storage",
              "buckets",
              "delete",
              `gs://${bucket}`,
              projectFlag,
            ]);
            return {
              success: true,
              bucket,
              message: `Bucket '${bucket}' deleted`,
            };
          }

          // ── Object Operations ──
          case "list_objects": {
            if (!bucket) {
              return { success: false, error: "Bucket name required" };
            }
            const args = ["storage", "objects", "list", `gs://${bucket}`];
            if (prefix) {
              args.push("--prefix", prefix);
            }
            if (maxResults) {
              args.push("--limit", String(maxResults));
            }
            const data = await runGCloud(args);
            return {
              success: true,
              bucket,
              prefix: prefix || "",
              objects: (Array.isArray(data) ? data : []).map((o: any) => ({
                name: o.name,
                size: o.size ? Number(o.size) : 0,
                contentType: o.contentType,
                updated: o.updated,
                storageClass: o.storageClass,
                crc32c: o.crc32c,
                md5Hash: o.md5Hash,
                etag: o.etag,
              })),
            };
          }

          case "upload": {
            if (!bucket || !object) {
              return { success: false, error: "Bucket and object required" };
            }
            if (localPath) {
              await runGCloud([
                "storage",
                "cp",
                localPath,
                `gs://${bucket}/${object}`,
              ]);
            } else if (content === undefined) {
              return { success: false, error: "localPath or content required" };
            } else {
              // Write content to temp file and upload
              const tmpFile = `/tmp/gcs_upload_${Date.now()}`;
              await execAsync(`echo ${JSON.stringify(content)} > ${tmpFile}`);
              await runGCloud([
                "storage",
                "cp",
                tmpFile,
                `gs://${bucket}/${object}`,
              ]);
              await execAsync(`rm -f ${tmpFile}`);
            }
            return {
              success: true,
              bucket,
              object,
              message: `Uploaded gs://${bucket}/${object}`,
            };
          }

          case "download": {
            if (!bucket || !object) {
              return { success: false, error: "Bucket and object required" };
            }
            const tmpFile = localPath || `/tmp/gcs_download_${Date.now()}`;
            await runGCloud([
              "storage",
              "cp",
              `gs://${bucket}/${object}`,
              tmpFile,
            ]);
            const { stdout } = await execAsync(`cat ${tmpFile}`);
            if (!localPath) {
              await execAsync(`rm -f ${tmpFile}`);
            }
            return { success: true, bucket, object, content: stdout };
          }

          case "delete_object": {
            if (!bucket || !object) {
              return { success: false, error: "Bucket and object required" };
            }
            await runGCloud([
              "storage",
              "objects",
              "delete",
              `gs://${bucket}/${object}`,
            ]);
            return {
              success: true,
              bucket,
              object,
              message: `Deleted gs://${bucket}/${object}`,
            };
          }

          case "copy_object": {
            if (
              !sourceBucket ||
              !sourceObject ||
              !destinationBucket ||
              !destinationObject
            ) {
              return {
                success: false,
                error:
                  "sourceBucket, sourceObject, destinationBucket, destinationObject required",
              };
            }
            await runGCloud([
              "storage",
              "cp",
              `gs://${sourceBucket}/${sourceObject}`,
              `gs://${destinationBucket}/${destinationObject}`,
            ]);
            return {
              success: true,
              source: `gs://${sourceBucket}/${sourceObject}`,
              destination: `gs://${destinationBucket}/${destinationObject}`,
            };
          }

          // ── IAM ──
          case "get_iam_policy": {
            if (!bucket) {
              return { success: false, error: "Bucket name required" };
            }
            const data = await runGCloud([
              "storage",
              "buckets",
              "get-iam-policy",
              `gs://${bucket}`,
              projectFlag,
            ]);
            return { success: true, bucket, policy: data };
          }

          case "set_iam_policy": {
            if (!bucket || !iamPolicy) {
              return { success: false, error: "Bucket and iamPolicy required" };
            }
            const tmpFile = `/tmp/gcs_iam_${Date.now()}.json`;
            await execAsync(`echo ${JSON.stringify(iamPolicy)} > ${tmpFile}`);
            await runGCloud([
              "storage",
              "buckets",
              "set-iam-policy",
              `gs://${bucket}`,
              tmpFile,
              projectFlag,
            ]);
            await execAsync(`rm -f ${tmpFile}`);
            return { success: true, bucket, message: "IAM policy updated" };
          }

          // ── Lifecycle ──
          case "get_lifecycle": {
            if (!bucket) {
              return { success: false, error: "Bucket name required" };
            }
            const data = await runGCloud([
              "storage",
              "buckets",
              "describe",
              `gs://${bucket}`,
              projectFlag,
            ]);
            return {
              success: true,
              bucket,
              lifecycle: (data as any)?.lifecycle || null,
            };
          }

          case "set_lifecycle": {
            if (!bucket || !lifecycleConfig) {
              return {
                success: false,
                error: "Bucket and lifecycleConfig required",
              };
            }
            const tmpFile = `/tmp/gcs_lifecycle_${Date.now()}.json`;
            await execAsync(
              `echo ${JSON.stringify(lifecycleConfig)} > ${tmpFile}`
            );
            await runGCloud([
              "storage",
              "buckets",
              "update",
              `gs://${bucket}`,
              "--lifecycle-file",
              tmpFile,
              projectFlag,
            ]);
            await execAsync(`rm -f ${tmpFile}`);
            return {
              success: true,
              bucket,
              message: "Lifecycle config updated",
            };
          }

          // ── Object Metadata ──
          case "get_object_metadata": {
            if (!bucket || !object) {
              return { success: false, error: "Bucket and object required" };
            }
            const data = await runGCloud([
              "storage",
              "objects",
              "describe",
              `gs://${bucket}/${object}`,
            ]);
            return { success: true, bucket, object, metadata: data };
          }

          case "set_object_metadata": {
            if (!bucket || !object) {
              return { success: false, error: "Bucket and object required" };
            }
            if (contentType) {
              await runGCloud([
                "storage",
                "objects",
                "update",
                `gs://${bucket}/${object}`,
                "--content-type",
                contentType,
              ]);
            }
            return {
              success: true,
              bucket,
              object,
              message: "Metadata updated",
            };
          }

          case "generate_signed_url": {
            if (!bucket || !object) {
              return { success: false, error: "Bucket and object required" };
            }
            const result = await runGCloud([
              "storage",
              "sign-url",
              `gs://${bucket}/${object}`,
              `--duration=${expiresIn || 3600}s`,
            ]);
            return {
              success: true,
              url: typeof result === "string" ? result.trim() : result,
              bucket,
              object,
              expiresIn: expiresIn || 3600,
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
// SECTION 2 — Compute Engine
// =============================================================================

export const gcpCompute = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Compute Engine: list/start/stop/delete instances, create from image, " +
      "manage snapshots, disks, firewall rules, and instance groups. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_instances",
        "describe_instance",
        "start",
        "stop",
        "delete",
        "create_instance",
        "reset",
        "list_disks",
        "create_disk",
        "delete_disk",
        "list_snapshots",
        "create_snapshot",
        "delete_snapshot",
        "list_firewall_rules",
        "create_firewall_rule",
        "delete_firewall_rule",
        "list_instance_groups",
        "list_images",
        "list_zones",
        "list_machine_types",
      ]),
      instanceName: z.string().optional().describe("Instance name"),
      zone: z.string().optional().describe("GCP zone (e.g. us-central1-a)"),
      project: z.string().optional().describe("GCP project ID"),
      // Create instance params
      machineType: z
        .string()
        .optional()
        .default("e2-micro")
        .describe("Machine type"),
      image: z
        .string()
        .optional()
        .default("ubuntu-2204-lts")
        .describe("Image family or name"),
      imageProject: z
        .string()
        .optional()
        .describe("Image project (e.g. ubuntu-os-cloud)"),
      bootDiskSize: z
        .number()
        .int()
        .optional()
        .default(20)
        .describe("Boot disk size in GB"),
      bootDiskType: z
        .enum(["pd-standard", "pd-ssd", "pd-balanced", "pd-extreme"])
        .optional()
        .default("pd-standard"),
      tags: z.array(z.string()).optional().describe("Network tags"),
      network: z.string().optional().describe("Network name"),
      subnet: z.string().optional().describe("Subnet name"),
      serviceAccount: z.string().optional().describe("Service account email"),
      scopes: z.array(z.string()).optional().describe("Access scopes"),
      metadata: z
        .record(z.string(), z.string())
        .optional()
        .describe("Instance metadata"),
      labels: z
        .record(z.string(), z.string())
        .optional()
        .describe("Instance labels"),
      preemptible: z.boolean().optional().default(false),
      // Disk params
      diskName: z.string().optional().describe("Disk name"),
      diskSize: z.number().int().optional().describe("Disk size in GB"),
      diskType: z
        .string()
        .optional()
        .default("pd-standard")
        .describe("Disk type"),
      snapshotName: z.string().optional().describe("Snapshot name"),
      sourceDisk: z.string().optional().describe("Source disk for snapshot"),
      sourceZone: z.string().optional().describe("Source disk zone"),
      // Firewall params
      firewallName: z.string().optional().describe("Firewall rule name"),
      firewallPriority: z.number().int().optional().default(1000),
      allowProtocol: z
        .string()
        .optional()
        .default("tcp")
        .describe("Protocol to allow"),
      allowPorts: z
        .array(z.string())
        .optional()
        .describe("Ports to allow (e.g. ['80', '443'])"),
      targetTags: z.array(z.string()).optional().describe("Target tags"),
      sourceRanges: z
        .array(z.string())
        .optional()
        .default(["0.0.0.0/0"])
        .describe("Source CIDR ranges"),
      // Filters
      filter: z
        .string()
        .optional()
        .describe("Filter expression (e.g. 'name:my-instance')"),
    }),
    execute: async ({
      action,
      instanceName,
      zone,
      project,
      machineType,
      image,
      imageProject,
      bootDiskSize,
      bootDiskType,
      tags,
      network,
      subnet,
      serviceAccount,
      scopes,
      metadata,
      labels,
      preemptible,
      diskName,
      diskSize,
      diskType,
      snapshotName,
      sourceDisk,
      sourceZone,
      firewallName,
      firewallPriority,
      allowProtocol,
      allowPorts,
      targetTags,
      sourceRanges,
      filter,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      const zoneFlag = zone ? `--zone=${zone}` : "";
      try {
        switch (action) {
          case "list_instances": {
            const args = ["compute", "instances", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              instances: (Array.isArray(data) ? data : []).map((i: any) => ({
                name: i.name,
                zone: i.zone?.split("/").pop(),
                machineType: i.machineType?.split("/").pop(),
                status: i.status,
                creationTimestamp: i.creationTimestamp,
                internalIp: i.networkInterfaces?.[0]?.networkIP,
                externalIp: i.networkInterfaces?.[0]?.accessConfigs?.[0]?.natIP,
                network: i.networkInterfaces?.[0]?.network?.split("/").pop(),
                subnet: i.networkInterfaces?.[0]?.subnetwork?.split("/").pop(),
                tags: i.tags?.items,
                labels: i.labels,
                serviceAccount: i.serviceAccounts?.[0]?.email,
                preemptible: i.scheduling?.preemptible,
                diskSizeGb: i.disks?.[0]?.diskSizeGb,
                diskType: i.disks?.[0]?.type,
              })),
            };
          }

          case "describe_instance": {
            if (!instanceName || !zone) {
              return {
                success: false,
                error: "instanceName and zone required",
              };
            }
            const data = await runGCloud([
              "compute",
              "instances",
              "describe",
              instanceName,
              zoneFlag,
              projectFlag,
            ]);
            return { success: true, instance: data };
          }

          case "start": {
            if (!instanceName || !zone) {
              return {
                success: false,
                error: "instanceName and zone required",
              };
            }
            await runGCloud([
              "compute",
              "instances",
              "start",
              instanceName,
              zoneFlag,
              projectFlag,
            ]);
            return { success: true, instanceName, action: "started" };
          }

          case "stop": {
            if (!instanceName || !zone) {
              return {
                success: false,
                error: "instanceName and zone required",
              };
            }
            await runGCloud([
              "compute",
              "instances",
              "stop",
              instanceName,
              zoneFlag,
              projectFlag,
            ]);
            return { success: true, instanceName, action: "stopped" };
          }

          case "delete": {
            if (!instanceName || !zone) {
              return {
                success: false,
                error: "instanceName and zone required",
              };
            }
            await runGCloud([
              "compute",
              "instances",
              "delete",
              instanceName,
              zoneFlag,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, instanceName, action: "deleted" };
          }

          case "reset": {
            if (!instanceName || !zone) {
              return {
                success: false,
                error: "instanceName and zone required",
              };
            }
            await runGCloud([
              "compute",
              "instances",
              "reset",
              instanceName,
              zoneFlag,
              projectFlag,
            ]);
            return { success: true, instanceName, action: "reset" };
          }

          case "create_instance": {
            if (!instanceName || !zone) {
              return {
                success: false,
                error: "instanceName and zone required",
              };
            }
            const args = [
              "compute",
              "instances",
              "create",
              instanceName,
              zoneFlag,
              projectFlag,
              `--machine-type=${machineType || "e2-micro"}`,
              `--boot-disk-size=${bootDiskSize || 20}GB`,
              `--boot-disk-type=${bootDiskType || "pd-standard"}`,
            ];
            if (image) {
              const imgArg = imageProject
                ? `--image-project=${imageProject}`
                : "";
              args.push(`--image-family=${image}`, imgArg);
            }
            if (tags?.length) {
              args.push(`--tags=${tags.join(",")}`);
            }
            if (network) {
              args.push(`--network=${network}`);
            }
            if (subnet) {
              args.push(`--subnet=${subnet}`);
            }
            if (serviceAccount) {
              args.push(`--service-account=${serviceAccount}`);
            }
            if (scopes?.length) {
              args.push(`--scopes=${scopes.join(",")}`);
            }
            if (metadata) {
              args.push(
                ...Object.entries(metadata).map(
                  ([k, v]) => `--metadata=${k}=${v}`
                )
              );
            }
            if (labels) {
              args.push(
                `--labels=${Object.entries(labels)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            if (preemptible) {
              args.push("--preemptible");
            }
            const data = await runGCloud(args);
            return {
              success: true,
              instanceName,
              zone,
              machineType: machineType || "e2-micro",
              result: data,
            };
          }

          case "list_disks": {
            const args = ["compute", "disks", "list", projectFlag];
            if (zone) {
              args.push(`--filter=zone:${zone}`);
            }
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              disks: (Array.isArray(data) ? data : []).map((d: any) => ({
                name: d.name,
                zone: d.zone?.split("/").pop(),
                sizeGb: d.sizeGb,
                type: d.type?.split("/").pop(),
                status: d.status,
                sourceSnapshot: d.sourceSnapshot,
                labels: d.labels,
                creationTimestamp: d.creationTimestamp,
              })),
            };
          }

          case "create_disk": {
            if (!diskName || !zone) {
              return { success: false, error: "diskName and zone required" };
            }
            const args = [
              "compute",
              "disks",
              "create",
              diskName,
              zoneFlag,
              projectFlag,
              `--size=${diskSize || 10}GB`,
              `--type=${diskType || "pd-standard"}`,
            ];
            await runGCloud(args);
            return {
              success: true,
              diskName,
              zone,
              size: diskSize || 10,
              type: diskType || "pd-standard",
            };
          }

          case "delete_disk": {
            if (!diskName || !zone) {
              return { success: false, error: "diskName and zone required" };
            }
            await runGCloud([
              "compute",
              "disks",
              "delete",
              diskName,
              zoneFlag,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, diskName, action: "deleted" };
          }

          case "list_snapshots": {
            const args = ["compute", "snapshots", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              snapshots: (Array.isArray(data) ? data : []).map((s: any) => ({
                name: s.name,
                diskSizeGb: s.diskSizeGb,
                sourceDisk: s.sourceDisk,
                status: s.status,
                creationTimestamp: s.creationTimestamp,
                storageBytes: s.storageBytes,
                labels: s.labels,
              })),
            };
          }

          case "create_snapshot": {
            if (!snapshotName || !sourceDisk) {
              return {
                success: false,
                error: "snapshotName and sourceDisk required",
              };
            }
            const args = [
              "compute",
              "disks",
              "snapshot",
              sourceDisk,
              `--snapshot-names=${snapshotName}`,
              projectFlag,
            ];
            if (sourceZone) {
              args.push(`--zone=${sourceZone}`);
            }
            await runGCloud(args);
            return { success: true, snapshotName, sourceDisk };
          }

          case "delete_snapshot": {
            if (!snapshotName) {
              return { success: false, error: "snapshotName required" };
            }
            await runGCloud([
              "compute",
              "snapshots",
              "delete",
              snapshotName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, snapshotName, action: "deleted" };
          }

          case "list_firewall_rules": {
            const args = ["compute", "firewall-rules", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              rules: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.name,
                network: r.network?.split("/").pop(),
                priority: r.priority,
                direction: r.direction,
                sourceRanges: r.sourceRanges,
                targetTags: r.targetTags,
                allowed: r.allowed,
                denied: r.denied,
                disabled: r.disabled,
                creationTimestamp: r.creationTimestamp,
              })),
            };
          }

          case "create_firewall_rule": {
            if (!firewallName) {
              return { success: false, error: "firewallName required" };
            }
            const args = [
              "compute",
              "firewall-rules",
              "create",
              firewallName,
              projectFlag,
              `--priority=${firewallPriority || 1000}`,
              `--allow=${allowProtocol || "tcp"}:${(allowPorts || ["80"]).join(",")}`,
              `--source-ranges=${(sourceRanges || ["0.0.0.0/0"]).join(",")}`,
            ];
            if (targetTags?.length) {
              args.push(`--target-tags=${targetTags.join(",")}`);
            }
            if (network) {
              args.push(`--network=${network}`);
            }
            await runGCloud(args);
            return {
              success: true,
              firewallName,
              rule: `${allowProtocol || "tcp"}:${(allowPorts || ["80"]).join(",")}`,
            };
          }

          case "delete_firewall_rule": {
            if (!firewallName) {
              return { success: false, error: "firewallName required" };
            }
            await runGCloud([
              "compute",
              "firewall-rules",
              "delete",
              firewallName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, firewallName, action: "deleted" };
          }

          case "list_instance_groups": {
            const args = ["compute", "instance-groups", "list", projectFlag];
            if (zone) {
              args.push(`--filter=zone:${zone}`);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              groups: (Array.isArray(data) ? data : []).map((g: any) => ({
                name: g.name,
                zone: g.zone?.split("/").pop(),
                size: g.size,
                instanceTemplate: g.instanceTemplate,
                namedPorts: g.namedPorts,
                creationTimestamp: g.creationTimestamp,
              })),
            };
          }

          case "list_images": {
            const args = ["compute", "images", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              images: (Array.isArray(data) ? data : []).map((img: any) => ({
                name: img.name,
                family: img.family,
                project: img.selfLink?.split("/")[6],
                status: img.status,
                diskSizeGb: img.diskSizeGb,
                creationTimestamp: img.creationTimestamp,
                architecture: img.architecture,
              })),
            };
          }

          case "list_zones": {
            const data = await runGCloud([
              "compute",
              "zones",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              zones: (Array.isArray(data) ? data : []).map((z: any) => ({
                name: z.name,
                region: z.region?.split("/").pop(),
                status: z.status,
              })),
            };
          }

          case "list_machine_types": {
            const args = ["compute", "machine-types", "list", projectFlag];
            if (zone) {
              args.push(`--filter=zone:${zone}`);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              machineTypes: (Array.isArray(data) ? data : []).map((m: any) => ({
                name: m.name,
                zone: m.zone?.split("/").pop(),
                guestCpus: m.guestCpus,
                memoryMb: m.memoryMb,
                maximumPersistentDisks: m.maximumPersistentDisks,
                maximumPersistentDisksSizeGb: m.maximumPersistentDisksSizeGb,
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
// SECTION 3 — Cloud Functions
// =============================================================================

export const gcpFunctions = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Functions (2nd gen): list, call, get, create, update, delete, " +
      "manage environment variables, and list event triggers. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list",
        "call",
        "get",
        "create",
        "update",
        "delete",
        "list_event_triggers",
        "get_logs",
      ]),
      functionName: z.string().optional().describe("Cloud Function name"),
      region: z
        .string()
        .optional()
        .default("us-central1")
        .describe("Function region"),
      project: z.string().optional().describe("GCP project ID"),
      data: z
        .string()
        .optional()
        .describe("JSON data for calling the function"),
      // Create/Update params
      entryPoint: z.string().optional().describe("Function entry point"),
      runtime: z
        .string()
        .optional()
        .default("nodejs20")
        .describe("Runtime (e.g. nodejs20, python312, go121)"),
      source: z.string().optional().describe("Source code path or URL"),
      sourceRepoUrl: z
        .string()
        .optional()
        .describe("Cloud Source Repository URL"),
      triggerHttp: z
        .boolean()
        .optional()
        .default(true)
        .describe("HTTP trigger"),
      triggerEvent: z
        .string()
        .optional()
        .describe("Event trigger (e.g. google.storage.object.finalize)"),
      triggerResource: z.string().optional().describe("Trigger resource"),
      allowUnauthenticated: z.boolean().optional().default(false),
      memory: z.number().int().optional().default(256).describe("Memory in MB"),
      timeout: z
        .number()
        .int()
        .optional()
        .default(60)
        .describe("Timeout in seconds"),
      minInstances: z.number().int().optional().default(0),
      maxInstances: z.number().int().optional().describe("Max instances"),
      serviceAccount: z.string().optional().describe("Service account email"),
      vpcConnector: z.string().optional().describe("VPC connector name"),
      ingressSettings: z
        .enum(["ALLOW_ALL", "ALLOW_INTERNAL_ONLY", "ALLOW_INTERNAL_AND_GCLB"])
        .optional(),
      environmentVariables: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables"),
      buildEnvironmentVariables: z
        .record(z.string(), z.string())
        .optional()
        .describe("Build environment variables"),
      labels: z
        .record(z.string(), z.string())
        .optional()
        .describe("Function labels"),
      logLines: z
        .number()
        .int()
        .optional()
        .default(50)
        .describe("Number of log lines to fetch"),
    }),
    execute: async ({
      action,
      functionName,
      region,
      project,
      data,
      entryPoint,
      runtime,
      source,
      sourceRepoUrl,
      triggerHttp,
      triggerEvent,
      triggerResource,
      allowUnauthenticated,
      memory,
      timeout,
      minInstances,
      maxInstances,
      serviceAccount,
      vpcConnector,
      ingressSettings,
      environmentVariables,
      buildEnvironmentVariables,
      labels,
      logLines,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      const regionFlag = region ? `--region=${region || "us-central1"}` : "";
      try {
        switch (action) {
          case "list": {
            const args = ["functions", "list", regionFlag, projectFlag];
            const data = await runGCloud(args);
            return {
              success: true,
              functions: (Array.isArray(data) ? data : []).map((fn: any) => ({
                name: fn.name?.split("/").pop(),
                state: fn.state,
                environment: fn.environment,
                runtime: fn.runtime,
                entryPoint: fn.entryPoint,
                trigger: fn.eventTrigger?.trigger || fn.httpsTrigger?.url,
                url: fn.httpsTrigger?.url,
                region: fn.name?.split("/")[3],
                lastModified: fn.updateTime,
                memory: fn.availableMemoryMb,
                serviceAccount: fn.serviceAccountEmail,
                maxInstances: fn.maxInstances,
                minInstances: fn.minInstances,
                vpcConnector: fn.vpcConnector,
                ingressSettings: fn.ingressSettings,
                labels: fn.labels,
              })),
            };
          }

          case "call": {
            if (!functionName) {
              return { success: false, error: "Function name required" };
            }
            const args = [
              "functions",
              "call",
              functionName,
              regionFlag,
              projectFlag,
            ];
            if (data) {
              args.push("--data", data);
            }
            const result = await runGCloud(args);
            return { success: true, functionName, result };
          }

          case "get": {
            if (!functionName) {
              return { success: false, error: "Function name required" };
            }
            const data = await runGCloud([
              "functions",
              "describe",
              functionName,
              regionFlag,
              projectFlag,
            ]);
            return { success: true, function: data };
          }

          case "create": {
            if (!functionName) {
              return { success: false, error: "Function name required" };
            }
            const args = [
              "functions",
              "deploy",
              functionName,
              regionFlag,
              projectFlag,
            ];
            if (entryPoint) {
              args.push(`--entry-point=${entryPoint}`);
            }
            if (runtime) {
              args.push(`--runtime=${runtime}`);
            }
            if (source) {
              args.push(`--source=${source}`);
            }
            if (sourceRepoUrl) {
              args.push(`--source-repo=${sourceRepoUrl}`);
            }
            if (triggerHttp) {
              args.push("--trigger-http");
            }
            if (triggerEvent && triggerResource) {
              args.push(
                `--trigger-event=${triggerEvent}`,
                `--trigger-resource=${triggerResource}`
              );
            }
            if (allowUnauthenticated) {
              args.push("--allow-unauthenticated");
            }
            if (memory) {
              args.push(`--memory=${memory}MB`);
            }
            if (timeout) {
              args.push(`--timeout=${timeout}`);
            }
            if (minInstances !== undefined) {
              args.push(`--min-instances=${minInstances}`);
            }
            if (maxInstances !== undefined) {
              args.push(`--max-instances=${maxInstances}`);
            }
            if (serviceAccount) {
              args.push(`--service-account=${serviceAccount}`);
            }
            if (vpcConnector) {
              args.push(`--vpc-connector=${vpcConnector}`);
            }
            if (ingressSettings) {
              args.push(`--ingress-settings=${ingressSettings}`);
            }
            if (environmentVariables) {
              args.push(
                `--set-env-vars=${Object.entries(environmentVariables)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            if (buildEnvironmentVariables) {
              args.push(
                `--set-build-env-vars=${Object.entries(
                  buildEnvironmentVariables
                )
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            if (labels) {
              args.push(
                `--labels=${Object.entries(labels)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            const result = await runGCloud(args);
            return { success: true, functionName, result };
          }

          case "update": {
            if (!functionName) {
              return { success: false, error: "Function name required" };
            }
            const args = [
              "functions",
              "deploy",
              functionName,
              regionFlag,
              projectFlag,
            ];
            if (entryPoint) {
              args.push(`--entry-point=${entryPoint}`);
            }
            if (runtime) {
              args.push(`--runtime=${runtime}`);
            }
            if (source) {
              args.push(`--source=${source}`);
            }
            if (memory) {
              args.push(`--memory=${memory}MB`);
            }
            if (timeout) {
              args.push(`--timeout=${timeout}`);
            }
            if (minInstances !== undefined) {
              args.push(`--min-instances=${minInstances}`);
            }
            if (maxInstances !== undefined) {
              args.push(`--max-instances=${maxInstances}`);
            }
            if (serviceAccount) {
              args.push(`--service-account=${serviceAccount}`);
            }
            if (vpcConnector) {
              args.push(`--vpc-connector=${vpcConnector}`);
            }
            if (ingressSettings) {
              args.push(`--ingress-settings=${ingressSettings}`);
            }
            if (environmentVariables) {
              args.push(
                `--set-env-vars=${Object.entries(environmentVariables)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            if (labels) {
              args.push(
                `--update-labels=${Object.entries(labels)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            const result = await runGCloud(args);
            return { success: true, functionName, result };
          }

          case "delete": {
            if (!functionName) {
              return { success: false, error: "Function name required" };
            }
            await runGCloud([
              "functions",
              "delete",
              functionName,
              regionFlag,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, functionName, action: "deleted" };
          }

          case "list_event_triggers": {
            const data = await runGCloud([
              "functions",
              "describe",
              functionName || "",
              regionFlag,
              projectFlag,
            ]);
            return {
              success: true,
              eventTrigger: (data as any)?.eventTrigger || null,
            };
          }

          case "get_logs": {
            if (!functionName) {
              return { success: false, error: "Function name required" };
            }
            const { stdout } = await execAsync(
              `gcloud functions logs read ${functionName} ${regionFlag} ${projectFlag} --limit=${logLines || 50}`
            );
            return { success: true, functionName, logs: stdout };
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
// SECTION 4 — Cloud Run
// =============================================================================

export const gcpCloudRun = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Run: list services, deploy, update traffic, manage revisions, " +
      "list and execute jobs. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_services",
        "describe_service",
        "deploy",
        "update_traffic",
        "delete_service",
        "list_revisions",
        "list_jobs",
        "execute_job",
        "list_regions",
      ]),
      serviceName: z.string().optional().describe("Cloud Run service name"),
      region: z.string().optional().default("us-central1").describe("Region"),
      project: z.string().optional().describe("GCP project ID"),
      image: z
        .string()
        .optional()
        .describe("Container image URL (e.g. gcr.io/project/image:tag)"),
      revisionName: z
        .string()
        .optional()
        .describe("Revision name for traffic update"),
      trafficPercent: z
        .number()
        .int()
        .optional()
        .describe("Traffic percentage for revision"),
      allowUnauthenticated: z.boolean().optional().default(false),
      port: z.number().int().optional().describe("Container port"),
      memory: z.string().optional().describe("Memory (e.g. 256Mi, 1Gi)"),
      cpu: z.string().optional().describe("CPU (e.g. 1, 2)"),
      maxInstances: z.number().int().optional().describe("Max instances"),
      minInstances: z.number().int().optional().describe("Min instances"),
      concurrency: z
        .number()
        .int()
        .optional()
        .describe("Max concurrent requests"),
      timeout: z.string().optional().describe("Request timeout (e.g. 300s)"),
      serviceAccount: z.string().optional().describe("Service account email"),
      vpcConnector: z.string().optional().describe("VPC connector name"),
      ingress: z
        .enum(["all", "internal", "internal-and-cloud-load-balancing"])
        .optional(),
      environmentVariables: z
        .record(z.string(), z.string())
        .optional()
        .describe("Environment variables"),
      labels: z
        .record(z.string(), z.string())
        .optional()
        .describe("Service labels"),
      command: z
        .array(z.string())
        .optional()
        .describe("Container entrypoint command"),
      containerArgs: z
        .array(z.string())
        .optional()
        .describe("Container arguments"),
      jobName: z.string().optional().describe("Cloud Run job name"),
      taskCount: z
        .number()
        .int()
        .optional()
        .describe("Number of tasks for job execution"),
    }),
    execute: async ({
      action,
      serviceName,
      region,
      project,
      image,
      revisionName,
      trafficPercent,
      allowUnauthenticated,
      port,
      memory,
      cpu,
      maxInstances,
      minInstances,
      concurrency,
      timeout,
      serviceAccount,
      vpcConnector,
      ingress,
      environmentVariables,
      labels,
      command,
      containerArgs,
      jobName,
      taskCount,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      const regionFlag = region ? `--region=${region || "us-central1"}` : "";
      try {
        switch (action) {
          case "list_services": {
            const data = await runGCloud([
              "run",
              "services",
              "list",
              regionFlag,
              projectFlag,
            ]);
            return {
              success: true,
              services: (Array.isArray(data) ? data : []).map((s: any) => ({
                name: s.name?.split("/").pop(),
                url: s.url,
                status: s.status?.conditions?.[0]?.status,
                latestReadyRevision: s.status?.latestReadyRevisionName
                  ?.split("/")
                  .pop(),
                latestCreatedRevision: s.status?.latestCreatedRevisionName
                  ?.split("/")
                  .pop(),
                region: s.metadata?.labels?.["cloud.googleapis.com/location"],
                lastModified: s.metadata?.lastModifiedTime,
              })),
            };
          }

          case "describe_service": {
            if (!serviceName) {
              return { success: false, error: "serviceName required" };
            }
            const data = await runGCloud([
              "run",
              "services",
              "describe",
              serviceName,
              regionFlag,
              projectFlag,
            ]);
            return { success: true, service: data };
          }

          case "deploy": {
            if (!serviceName || !image) {
              return {
                success: false,
                error: "serviceName and image required",
              };
            }
            const args = [
              "run",
              "deploy",
              serviceName,
              `--image=${image}`,
              regionFlag,
              projectFlag,
            ];
            if (allowUnauthenticated) {
              args.push("--allow-unauthenticated");
            }
            if (port) {
              args.push(`--port=${port}`);
            }
            if (memory) {
              args.push(`--memory=${memory}`);
            }
            if (cpu) {
              args.push(`--cpu=${cpu}`);
            }
            if (maxInstances !== undefined) {
              args.push(`--max-instances=${maxInstances}`);
            }
            if (minInstances !== undefined) {
              args.push(`--min-instances=${minInstances}`);
            }
            if (concurrency !== undefined) {
              args.push(`--concurrency=${concurrency}`);
            }
            if (timeout) {
              args.push(`--timeout=${timeout}`);
            }
            if (serviceAccount) {
              args.push(`--service-account=${serviceAccount}`);
            }
            if (vpcConnector) {
              args.push(`--vpc-connector=${vpcConnector}`);
            }
            if (ingress) {
              args.push(`--ingress=${ingress}`);
            }
            if (environmentVariables) {
              args.push(
                `--set-env-vars=${Object.entries(environmentVariables)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            if (labels) {
              args.push(
                `--labels=${Object.entries(labels)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            if (command?.length) {
              args.push(`--command=${command.join(" ")}`);
            }
            if (containerArgs?.length) {
              args.push(`--args=${containerArgs.join(" ")}`);
            }
            const result = await runGCloud(args);
            return {
              success: true,
              serviceName,
              image,
              url: (result as any)?.status?.url,
            };
          }

          case "update_traffic": {
            if (!serviceName || !revisionName || trafficPercent === undefined) {
              return {
                success: false,
                error: "serviceName, revisionName, and trafficPercent required",
              };
            }
            await runGCloud([
              "run",
              "services",
              "update-traffic",
              serviceName,
              `--to-revisions=${revisionName}=${trafficPercent}`,
              regionFlag,
              projectFlag,
            ]);
            return { success: true, serviceName, revisionName, trafficPercent };
          }

          case "delete_service": {
            if (!serviceName) {
              return { success: false, error: "serviceName required" };
            }
            await runGCloud([
              "run",
              "services",
              "delete",
              serviceName,
              regionFlag,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, serviceName, action: "deleted" };
          }

          case "list_revisions": {
            if (!serviceName) {
              return { success: false, error: "serviceName required" };
            }
            const data = await runGCloud([
              "run",
              "revisions",
              "list",
              `--service=${serviceName}`,
              regionFlag,
              projectFlag,
            ]);
            return {
              success: true,
              revisions: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.metadata?.name,
                status: r.status?.conditions?.[0]?.status,
                image: r.spec?.containers?.[0]?.image,
                created: r.metadata?.creationTimestamp,
                concurrency: r.spec?.containerConcurrency,
                timeout: r.spec?.timeoutSeconds,
                serviceAccount: r.spec?.serviceAccountName,
              })),
            };
          }

          case "list_jobs": {
            const data = await runGCloud([
              "run",
              "jobs",
              "list",
              regionFlag,
              projectFlag,
            ]);
            return {
              success: true,
              jobs: (Array.isArray(data) ? data : []).map((j: any) => ({
                name: j.name?.split("/").pop(),
                status: j.status?.conditions?.[0]?.status,
                taskCount: j.spec?.template?.spec?.taskCount,
                maxRetries: j.spec?.template?.spec?.maxRetries,
                lastModified: j.metadata?.lastModifiedTime,
              })),
            };
          }

          case "execute_job": {
            if (!jobName) {
              return { success: false, error: "jobName required" };
            }
            const args = [
              "run",
              "jobs",
              "execute",
              jobName,
              regionFlag,
              projectFlag,
            ];
            if (taskCount) {
              args.push(`--tasks=${taskCount}`);
            }
            const result = await runGCloud(args);
            return { success: true, jobName, execution: result };
          }

          case "list_regions": {
            const data = await runGCloud([
              "run",
              "regions",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              regions: (Array.isArray(data) ? data : []).map(
                (r: any) => r.locationId || r.name
              ),
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
// SECTION 5 — Cloud SQL
// =============================================================================

export const gcpCloudSQL = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud SQL: list/describe/create/delete instances, manage databases, " +
      "users, export/import, start/stop, and list backups. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_instances",
        "describe_instance",
        "create_instance",
        "delete_instance",
        "start",
        "stop",
        "restart",
        "list_databases",
        "create_database",
        "delete_database",
        "list_users",
        "create_user",
        "delete_user",
        "export",
        "import",
        "list_backups",
        "describe_backup",
        "list_operations",
        "describe_operation",
      ]),
      instanceName: z.string().optional().describe("Cloud SQL instance name"),
      project: z.string().optional().describe("GCP project ID"),
      region: z.string().optional().default("us-central1").describe("Region"),
      databaseVersion: z
        .string()
        .optional()
        .default("POSTGRES_15")
        .describe("Database version"),
      tier: z
        .string()
        .optional()
        .default("db-f1-micro")
        .describe("Tier (e.g. db-f1-micro, db-g1-small)"),
      storageSize: z
        .number()
        .int()
        .optional()
        .default(10)
        .describe("Storage size in GB"),
      storageType: z.enum(["SSD", "HDD"]).optional().default("SSD"),
      rootPassword: z.string().optional().describe("Root password"),
      databaseName: z.string().optional().describe("Database name"),
      userName: z.string().optional().describe("User name"),
      userPassword: z.string().optional().describe("User password"),
      exportUri: z
        .string()
        .optional()
        .describe("GCS URI for export (gs://bucket/file.sql.gz)"),
      importUri: z
        .string()
        .optional()
        .describe("GCS URI for import (gs://bucket/file.sql.gz)"),
      backupId: z.string().optional().describe("Backup ID"),
      operationId: z.string().optional().describe("Operation ID"),
      filter: z.string().optional().describe("Filter expression"),
    }),
    execute: async ({
      action,
      instanceName,
      project,
      region,
      databaseVersion,
      tier,
      storageSize,
      storageType,
      rootPassword,
      databaseName,
      userName,
      userPassword,
      exportUri,
      importUri,
      backupId,
      operationId,
      filter,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          case "list_instances": {
            const args = ["sql", "instances", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              instances: (Array.isArray(data) ? data : []).map((i: any) => ({
                name: i.name,
                databaseVersion: i.databaseVersion,
                state: i.state,
                tier: i.settings?.tier,
                region: i.region,
                ipAddress: i.ipAddresses?.[0]?.ipAddress,
                publicIp: i.ipAddresses?.find((a: any) => a.type === "PRIMARY")
                  ?.ipAddress,
                privateIp: i.ipAddresses?.find((a: any) => a.type === "PRIVATE")
                  ?.ipAddress,
                storageSizeGb: i.settings?.dataDiskSizeGb,
                storageType: i.settings?.dataDiskType,
                creationDate: i.createTime,
                backupEnabled: i.settings?.backupConfiguration?.enabled,
                binaryLogEnabled:
                  i.settings?.backupConfiguration?.binaryLogEnabled,
                availabilityType: i.settings?.availabilityType,
                sslMode: i.settings?.ipConfiguration?.sslMode,
                authorizedNetworks:
                  i.settings?.ipConfiguration?.authorizedNetworks?.map(
                    (n: any) => n.value
                  ),
              })),
            };
          }

          case "describe_instance": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            const data = await runGCloud([
              "sql",
              "instances",
              "describe",
              instanceName,
              projectFlag,
            ]);
            return { success: true, instance: data };
          }

          case "create_instance": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            const args = [
              "sql",
              "instances",
              "create",
              instanceName,
              projectFlag,
              `--database-version=${databaseVersion || "POSTGRES_15"}`,
              `--tier=${tier || "db-f1-micro"}`,
              `--storage-size=${storageSize || 10}`,
              `--storage-type=${storageType || "SSD"}`,
              `--region=${region || "us-central1"}`,
            ];
            if (rootPassword) {
              args.push(`--root-password=${rootPassword}`);
            }
            const data = await runGCloud(args);
            return { success: true, instanceName, result: data };
          }

          case "delete_instance": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            await runGCloud([
              "sql",
              "instances",
              "delete",
              instanceName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, instanceName, action: "deleted" };
          }

          case "start": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            await runGCloud([
              "sql",
              "instances",
              "patch",
              instanceName,
              "--activation-policy=ALWAYS",
              projectFlag,
            ]);
            return { success: true, instanceName, action: "started" };
          }

          case "stop": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            await runGCloud([
              "sql",
              "instances",
              "patch",
              instanceName,
              "--activation-policy=NEVER",
              projectFlag,
            ]);
            return { success: true, instanceName, action: "stopped" };
          }

          case "restart": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            await runGCloud([
              "sql",
              "instances",
              "restart",
              instanceName,
              projectFlag,
            ]);
            return { success: true, instanceName, action: "restarted" };
          }

          case "list_databases": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            const data = await runGCloud([
              "sql",
              "databases",
              "list",
              `--instance=${instanceName}`,
              projectFlag,
            ]);
            return {
              success: true,
              databases: (Array.isArray(data) ? data : []).map((d: any) => ({
                name: d.name,
                charset: d.charset,
                collation: d.collation,
              })),
            };
          }

          case "create_database": {
            if (!instanceName || !databaseName) {
              return {
                success: false,
                error: "instanceName and databaseName required",
              };
            }
            await runGCloud([
              "sql",
              "databases",
              "create",
              databaseName,
              `--instance=${instanceName}`,
              projectFlag,
            ]);
            return { success: true, instanceName, databaseName };
          }

          case "delete_database": {
            if (!instanceName || !databaseName) {
              return {
                success: false,
                error: "instanceName and databaseName required",
              };
            }
            await runGCloud([
              "sql",
              "databases",
              "delete",
              databaseName,
              `--instance=${instanceName}`,
              projectFlag,
              "--quiet",
            ]);
            return {
              success: true,
              instanceName,
              databaseName,
              action: "deleted",
            };
          }

          case "list_users": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            const data = await runGCloud([
              "sql",
              "users",
              "list",
              `--instance=${instanceName}`,
              projectFlag,
            ]);
            return {
              success: true,
              users: (Array.isArray(data) ? data : []).map((u: any) => ({
                name: u.name,
                host: u.host,
                type: u.type,
              })),
            };
          }

          case "create_user": {
            if (!instanceName || !userName || !userPassword) {
              return {
                success: false,
                error: "instanceName, userName, and userPassword required",
              };
            }
            await runGCloud([
              "sql",
              "users",
              "create",
              userName,
              `--instance=${instanceName}`,
              `--password=${userPassword}`,
              projectFlag,
            ]);
            return { success: true, instanceName, userName };
          }

          case "delete_user": {
            if (!instanceName || !userName) {
              return {
                success: false,
                error: "instanceName and userName required",
              };
            }
            await runGCloud([
              "sql",
              "users",
              "delete",
              userName,
              `--instance=${instanceName}`,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, instanceName, userName, action: "deleted" };
          }

          case "export": {
            if (!instanceName || !exportUri || !databaseName) {
              return {
                success: false,
                error: "instanceName, exportUri, and databaseName required",
              };
            }
            const data = await runGCloud([
              "sql",
              "export",
              "sql",
              instanceName,
              exportUri,
              `--database=${databaseName}`,
              projectFlag,
            ]);
            return { success: true, instanceName, exportUri, operation: data };
          }

          case "import": {
            if (!instanceName || !importUri || !databaseName) {
              return {
                success: false,
                error: "instanceName, importUri, and databaseName required",
              };
            }
            const data = await runGCloud([
              "sql",
              "import",
              "sql",
              instanceName,
              importUri,
              `--database=${databaseName}`,
              projectFlag,
            ]);
            return { success: true, instanceName, importUri, operation: data };
          }

          case "list_backups": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            const data = await runGCloud([
              "sql",
              "backups",
              "list",
              `--instance=${instanceName}`,
              projectFlag,
            ]);
            return {
              success: true,
              backups: (Array.isArray(data) ? data : []).map((b: any) => ({
                id: b.id,
                type: b.type,
                status: b.status,
                windowStartTime: b.windowStartTime,
                enqueuedTime: b.enqueuedTime,
                error: b.error,
                instance: b.instance,
              })),
            };
          }

          case "describe_backup": {
            if (!instanceName || !backupId) {
              return {
                success: false,
                error: "instanceName and backupId required",
              };
            }
            const data = await runGCloud([
              "sql",
              "backups",
              "describe",
              backupId,
              `--instance=${instanceName}`,
              projectFlag,
            ]);
            return { success: true, backup: data };
          }

          case "list_operations": {
            if (!instanceName) {
              return { success: false, error: "instanceName required" };
            }
            const data = await runGCloud([
              "sql",
              "operations",
              "list",
              `--instance=${instanceName}`,
              projectFlag,
            ]);
            return {
              success: true,
              operations: (Array.isArray(data) ? data : []).map((o: any) => ({
                id: o.name,
                operationType: o.operationType,
                status: o.status,
                startTime: o.startTime,
                endTime: o.endTime,
                error: o.error,
              })),
            };
          }

          case "describe_operation": {
            if (!operationId) {
              return { success: false, error: "operationId required" };
            }
            const data = await runGCloud([
              "sql",
              "operations",
              "describe",
              operationId,
              projectFlag,
            ]);
            return { success: true, operation: data };
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
// SECTION 6 — IAM
// =============================================================================

export const gcpIAM = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage GCP IAM: list service accounts, create/delete, manage keys, " +
      "get/set IAM policies, list roles. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_service_accounts",
        "create_service_account",
        "delete_service_account",
        "list_keys",
        "create_key",
        "delete_key",
        "get_iam_policy",
        "set_iam_policy",
        "add_iam_policy_binding",
        "remove_iam_policy_binding",
        "list_roles",
        "list_grantable_roles",
        "test_iam_permissions",
      ]),
      serviceAccountName: z
        .string()
        .optional()
        .describe("Service account name (not email)"),
      serviceAccountEmail: z
        .string()
        .optional()
        .describe("Service account email"),
      project: z.string().optional().describe("GCP project ID"),
      displayName: z
        .string()
        .optional()
        .describe("Display name for service account"),
      description: z
        .string()
        .optional()
        .describe("Description for service account"),
      keyName: z.string().optional().describe("Key name for deletion"),
      resource: z
        .string()
        .optional()
        .describe("Resource for IAM policy (e.g. projects/PROJECT)"),
      member: z
        .string()
        .optional()
        .describe(
          "Member (e.g. user:email@example.com, serviceAccount:sa@project.iam.gserviceaccount.com)"
        ),
      role: z
        .string()
        .optional()
        .describe("IAM role (e.g. roles/viewer, roles/compute.admin)"),
      condition: z.string().optional().describe("IAM condition expression"),
      permissions: z
        .array(z.string())
        .optional()
        .describe("Permissions to test"),
      filter: z.string().optional().describe("Filter expression"),
    }),
    execute: async ({
      action,
      serviceAccountName,
      serviceAccountEmail,
      project,
      displayName,
      description,
      keyName,
      resource,
      member,
      role,
      condition,
      permissions,
      filter,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          case "list_service_accounts": {
            const args = ["iam", "service-accounts", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              serviceAccounts: (Array.isArray(data) ? data : []).map(
                (sa: any) => ({
                  email: sa.email,
                  displayName: sa.displayName,
                  description: sa.description,
                  disabled: sa.disabled,
                  uniqueId: sa.uniqueId,
                  oauth2ClientId: sa.oauth2ClientId,
                  projectId: sa.projectId,
                })
              ),
            };
          }

          case "create_service_account": {
            if (!serviceAccountName) {
              return { success: false, error: "serviceAccountName required" };
            }
            const args = [
              "iam",
              "service-accounts",
              "create",
              serviceAccountName,
              projectFlag,
            ];
            if (displayName) {
              args.push(`--display-name=${displayName}`);
            }
            if (description) {
              args.push(`--description=${description}`);
            }
            const data = await runGCloud(args);
            return { success: true, serviceAccount: data };
          }

          case "delete_service_account": {
            if (!serviceAccountEmail) {
              return { success: false, error: "serviceAccountEmail required" };
            }
            await runGCloud([
              "iam",
              "service-accounts",
              "delete",
              serviceAccountEmail,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, serviceAccountEmail, action: "deleted" };
          }

          case "list_keys": {
            if (!serviceAccountEmail) {
              return { success: false, error: "serviceAccountEmail required" };
            }
            const data = await runGCloud([
              "iam",
              "service-accounts",
              "keys",
              "list",
              `--iam-account=${serviceAccountEmail}`,
              projectFlag,
            ]);
            return {
              success: true,
              keys: (Array.isArray(data) ? data : []).map((k: any) => ({
                name: k.name?.split("/").pop(),
                type: k.keyType,
                validAfter: k.validAfterTime,
                validBefore: k.validBeforeTime,
                disabled: k.disabled,
              })),
            };
          }

          case "create_key": {
            if (!serviceAccountEmail) {
              return { success: false, error: "serviceAccountEmail required" };
            }
            const data = await runGCloud([
              "iam",
              "service-accounts",
              "keys",
              "create",
              `--iam-account=${serviceAccountEmail}`,
              projectFlag,
            ]);
            return {
              success: true,
              key: data,
              message: "Save the private key — it cannot be retrieved later",
            };
          }

          case "delete_key": {
            if (!serviceAccountEmail || !keyName) {
              return {
                success: false,
                error: "serviceAccountEmail and keyName required",
              };
            }
            await runGCloud([
              "iam",
              "service-accounts",
              "keys",
              "delete",
              keyName,
              `--iam-account=${serviceAccountEmail}`,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, keyName, action: "deleted" };
          }

          case "get_iam_policy": {
            if (!resource) {
              return { success: false, error: "resource required" };
            }
            const data = await runGCloud([
              "iam",
              "get-iam-policy",
              resource,
              projectFlag,
            ]);
            return { success: true, resource, policy: data };
          }

          case "set_iam_policy": {
            if (!resource) {
              return { success: false, error: "resource required" };
            }
            // This requires a policy file; we use get first then modify
            return {
              success: false,
              error:
                "Use add_iam_policy_binding or remove_iam_policy_binding instead",
            };
          }

          case "add_iam_policy_binding": {
            if (!resource || !member || !role) {
              return {
                success: false,
                error: "resource, member, and role required",
              };
            }
            const args = [
              "iam",
              "add-iam-policy-binding",
              resource,
              `--member=${member}`,
              `--role=${role}`,
              projectFlag,
            ];
            if (condition) {
              args.push(`--condition=${condition}`);
            }
            await runGCloud(args);
            return {
              success: true,
              resource,
              member,
              role,
              action: "binding added",
            };
          }

          case "remove_iam_policy_binding": {
            if (!resource || !member || !role) {
              return {
                success: false,
                error: "resource, member, and role required",
              };
            }
            const args = [
              "iam",
              "remove-iam-policy-binding",
              resource,
              `--member=${member}`,
              `--role=${role}`,
              projectFlag,
            ];
            if (condition) {
              args.push(`--condition=${condition}`);
            }
            await runGCloud(args);
            return {
              success: true,
              resource,
              member,
              role,
              action: "binding removed",
            };
          }

          case "list_roles": {
            const args = ["iam", "roles", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              roles: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.name,
                title: r.title,
                description: r.description,
                stage: r.stage,
                includedPermissions: r.includedPermissions,
              })),
            };
          }

          case "list_grantable_roles": {
            if (!resource) {
              return { success: false, error: "resource required" };
            }
            const data = await runGCloud([
              "iam",
              "list-grantable-roles",
              resource,
              projectFlag,
            ]);
            return {
              success: true,
              roles: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.name,
                title: r.title,
                description: r.description,
              })),
            };
          }

          case "test_iam_permissions": {
            if (!resource || !permissions?.length) {
              return {
                success: false,
                error: "resource and permissions required",
              };
            }
            const data = await runGCloud([
              "iam",
              "test-iam-permissions",
              resource,
              `--permissions=${permissions.join(",")}`,
              projectFlag,
            ]);
            return { success: true, resource, permissions: data };
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
// SECTION 7 — Cloud DNS
// =============================================================================

export const gcpDNS = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud DNS: list managed zones, list record sets, create/delete records, " +
      "create/delete zones. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_zones",
        "create_zone",
        "delete_zone",
        "list_record_sets",
        "add_record",
        "remove_record",
        "describe_zone",
      ]),
      zoneName: z.string().optional().describe("DNS zone name"),
      dnsName: z.string().optional().describe("DNS name (e.g. example.com.)"),
      description: z.string().optional().describe("Zone description"),
      project: z.string().optional().describe("GCP project ID"),
      recordName: z.string().optional().describe("Record set name"),
      recordType: z
        .string()
        .optional()
        .default("A")
        .describe("Record type (A, AAAA, CNAME, MX, TXT, etc.)"),
      recordTtl: z
        .number()
        .int()
        .optional()
        .default(300)
        .describe("TTL in seconds"),
      recordData: z.array(z.string()).optional().describe("Record data values"),
      filter: z.string().optional().describe("Filter expression"),
    }),
    execute: async ({
      action,
      zoneName,
      dnsName,
      description,
      project,
      recordName,
      recordType,
      recordTtl,
      recordData,
      filter,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          case "list_zones": {
            const args = ["dns", "managed-zones", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              zones: (Array.isArray(data) ? data : []).map((z: any) => ({
                name: z.name,
                dnsName: z.dnsName,
                description: z.description,
                visibility: z.visibility,
                nameServers: z.nameServers,
                creationTime: z.creationTime,
              })),
            };
          }

          case "create_zone": {
            if (!zoneName || !dnsName) {
              return { success: false, error: "zoneName and dnsName required" };
            }
            const args = [
              "dns",
              "managed-zones",
              "create",
              zoneName,
              `--dns-name=${dnsName}`,
              `--description=${description || `DNS zone for ${dnsName}`}`,
              projectFlag,
            ];
            const data = await runGCloud(args);
            return { success: true, zone: data };
          }

          case "delete_zone": {
            if (!zoneName) {
              return { success: false, error: "zoneName required" };
            }
            await runGCloud([
              "dns",
              "managed-zones",
              "delete",
              zoneName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, zoneName, action: "deleted" };
          }

          case "describe_zone": {
            if (!zoneName) {
              return { success: false, error: "zoneName required" };
            }
            const data = await runGCloud([
              "dns",
              "managed-zones",
              "describe",
              zoneName,
              projectFlag,
            ]);
            return { success: true, zone: data };
          }

          case "list_record_sets": {
            if (!zoneName) {
              return { success: false, error: "zoneName required" };
            }
            const args = [
              "dns",
              "record-sets",
              "list",
              `--zone=${zoneName}`,
              projectFlag,
            ];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              recordSets: (Array.isArray(data) ? data : []).map((r: any) => ({
                name: r.name,
                type: r.type,
                ttl: r.ttl,
                rrdatas: r.rrdatas,
                routingPolicy: r.routingPolicy,
              })),
            };
          }

          case "add_record": {
            if (
              !zoneName ||
              !recordName ||
              !recordType ||
              !recordData?.length
            ) {
              return {
                success: false,
                error:
                  "zoneName, recordName, recordType, and recordData required",
              };
            }
            const args = [
              "dns",
              "record-sets",
              "create",
              recordName,
              `--zone=${zoneName}`,
              `--type=${recordType}`,
              `--ttl=${recordTtl || 300}`,
              ...recordData.map((d) => `--rrdatas=${d}`),
              projectFlag,
            ];
            await runGCloud(args);
            return {
              success: true,
              zoneName,
              recordName,
              type: recordType,
              data: recordData,
            };
          }

          case "remove_record": {
            if (
              !zoneName ||
              !recordName ||
              !recordType ||
              !recordData?.length
            ) {
              return {
                success: false,
                error:
                  "zoneName, recordName, recordType, and recordData required",
              };
            }
            const args = [
              "dns",
              "record-sets",
              "delete",
              recordName,
              `--zone=${zoneName}`,
              `--type=${recordType}`,
              `--ttl=${recordTtl || 300}`,
              ...recordData.map((d) => `--rrdatas=${d}`),
              projectFlag,
              "--quiet",
            ];
            await runGCloud(args);
            return {
              success: true,
              zoneName,
              recordName,
              type: recordType,
              action: "deleted",
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
// SECTION 8 — Cloud Monitoring
// =============================================================================

export const gcpMonitoring = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Monitoring: list metric descriptors, get time series data, " +
      "list alert policies, list uptime checks, list notification channels. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_metric_descriptors",
        "list_time_series",
        "list_alert_policies",
        "describe_alert_policy",
        "list_uptime_checks",
        "list_notification_channels",
        "list_dashboards",
      ]),
      project: z.string().optional().describe("GCP project ID"),
      filter: z.string().optional().describe("Filter expression"),
      metricType: z
        .string()
        .optional()
        .describe(
          "Metric type (e.g. compute.googleapis.com/instance/cpu/utilization)"
        ),
      startTime: z.string().optional().describe("Start time (ISO 8601)"),
      endTime: z.string().optional().describe("End time (ISO 8601)"),
      alertPolicyName: z.string().optional().describe("Alert policy name"),
    }),
    execute: async ({
      action,
      project,
      filter,
      metricType,
      startTime,
      endTime,
      alertPolicyName,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          case "list_metric_descriptors": {
            const args = [
              "monitoring",
              "metric-descriptors",
              "list",
              projectFlag,
            ];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              metricDescriptors: (Array.isArray(data) ? data : []).map(
                (m: any) => ({
                  type: m.type,
                  name: m.name,
                  displayName: m.displayName,
                  description: m.description,
                  unit: m.unit,
                  metricKind: m.metricKind,
                  valueType: m.valueType,
                  labels: m.labels,
                })
              ),
            };
          }

          case "list_time_series": {
            if (!metricType) {
              return { success: false, error: "metricType required" };
            }
            const args = [
              "monitoring",
              "time-series",
              "list",
              `--metric-type=${metricType}`,
              projectFlag,
            ];
            if (startTime) {
              args.push(`--start-time=${startTime}`);
            }
            if (endTime) {
              args.push(`--end-time=${endTime}`);
            }
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return { success: true, timeSeries: data };
          }

          case "list_alert_policies": {
            const args = ["monitoring", "alert-policies", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              alertPolicies: (Array.isArray(data) ? data : []).map(
                (p: any) => ({
                  name: p.name?.split("/").pop(),
                  displayName: p.displayName,
                  enabled: p.enabled,
                  severity: p.severity,
                  conditions: p.conditions?.map((c: any) => ({
                    displayName: c.displayName,
                    conditionThreshold: c.conditionThreshold,
                  })),
                  notificationChannels: p.notificationChannels,
                  creationRecord: p.creationRecord,
                })
              ),
            };
          }

          case "describe_alert_policy": {
            if (!alertPolicyName) {
              return { success: false, error: "alertPolicyName required" };
            }
            const data = await runGCloud([
              "monitoring",
              "alert-policies",
              "describe",
              alertPolicyName,
              projectFlag,
            ]);
            return { success: true, alertPolicy: data };
          }

          case "list_uptime_checks": {
            const data = await runGCloud([
              "monitoring",
              "uptime-checks",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              uptimeChecks: (Array.isArray(data) ? data : []).map((c: any) => ({
                name: c.name?.split("/").pop(),
                displayName: c.displayName,
                monitoredResource: c.monitoredResource,
                period: c.period,
                timeout: c.timeout,
                httpCheck: c.httpCheck,
                tcpCheck: c.tcpCheck,
              })),
            };
          }

          case "list_notification_channels": {
            const data = await runGCloud([
              "monitoring",
              "channels",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              channels: (Array.isArray(data) ? data : []).map((c: any) => ({
                name: c.name?.split("/").pop(),
                displayName: c.displayName,
                type: c.type,
                enabled: c.enabled,
                labels: c.labels,
              })),
            };
          }

          case "list_dashboards": {
            const data = await runGCloud([
              "monitoring",
              "dashboards",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              dashboards: (Array.isArray(data) ? data : []).map((d: any) => ({
                name: d.name?.split("/").pop(),
                displayName: d.displayName,
                etag: d.etag,
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
// SECTION 9 — Pub/Sub
// =============================================================================

export const gcpPubSub = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Pub/Sub: list/create/delete topics, list/create/delete subscriptions, " +
      "publish messages, seek subscriptions. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_topics",
        "create_topic",
        "delete_topic",
        "publish",
        "list_subscriptions",
        "create_subscription",
        "delete_subscription",
        "pull_messages",
        "seek_subscription",
        "list_snapshots",
      ]),
      topicName: z.string().optional().describe("Topic name (not full path)"),
      subscriptionName: z.string().optional().describe("Subscription name"),
      project: z.string().optional().describe("GCP project ID"),
      message: z.string().optional().describe("Message body to publish"),
      messageAttributes: z
        .record(z.string(), z.string())
        .optional()
        .describe("Message attributes"),
      ackDeadline: z
        .number()
        .int()
        .optional()
        .default(10)
        .describe("Ack deadline in seconds"),
      pushEndpoint: z.string().optional().describe("Push endpoint URL"),
      pullCount: z
        .number()
        .int()
        .optional()
        .default(1)
        .describe("Number of messages to pull"),
      filter: z.string().optional().describe("Filter expression"),
      snapshotName: z.string().optional().describe("Snapshot name for seek"),
    }),
    execute: async ({
      action,
      topicName,
      subscriptionName,
      project,
      message,
      messageAttributes,
      ackDeadline,
      pushEndpoint,
      pullCount,
      filter,
      snapshotName,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          case "list_topics": {
            const args = ["pubsub", "topics", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              topics: (Array.isArray(data) ? data : []).map((t: any) => ({
                name: t.name?.split("/").pop(),
                kmsKey: t.kmsKeyName,
                labels: t.labels,
              })),
            };
          }

          case "create_topic": {
            if (!topicName) {
              return { success: false, error: "topicName required" };
            }
            await runGCloud([
              "pubsub",
              "topics",
              "create",
              topicName,
              projectFlag,
            ]);
            return { success: true, topicName };
          }

          case "delete_topic": {
            if (!topicName) {
              return { success: false, error: "topicName required" };
            }
            await runGCloud([
              "pubsub",
              "topics",
              "delete",
              topicName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, topicName, action: "deleted" };
          }

          case "publish": {
            if (!topicName || !message) {
              return {
                success: false,
                error: "topicName and message required",
              };
            }
            const args = [
              "pubsub",
              "topics",
              "publish",
              topicName,
              `--message=${message}`,
              projectFlag,
            ];
            if (messageAttributes) {
              args.push(
                `--attribute=${Object.entries(messageAttributes)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            const data = await runGCloud(args);
            return {
              success: true,
              topicName,
              messageId: (data as any)?.messageIds?.[0],
            };
          }

          case "list_subscriptions": {
            const args = ["pubsub", "subscriptions", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              subscriptions: (Array.isArray(data) ? data : []).map(
                (s: any) => ({
                  name: s.name?.split("/").pop(),
                  topic: s.topic?.split("/").pop(),
                  pushEndpoint: s.pushConfig?.pushEndpoint,
                  ackDeadlineSeconds: s.ackDeadlineSeconds,
                  messageRetentionDuration: s.messageRetentionDuration,
                  enableMessageOrdering: s.enableMessageOrdering,
                  filter: s.filter,
                  labels: s.labels,
                })
              ),
            };
          }

          case "create_subscription": {
            if (!subscriptionName || !topicName) {
              return {
                success: false,
                error: "subscriptionName and topicName required",
              };
            }
            const args = [
              "pubsub",
              "subscriptions",
              "create",
              subscriptionName,
              `--topic=${topicName}`,
              `--ack-deadline=${ackDeadline || 10}`,
              projectFlag,
            ];
            if (pushEndpoint) {
              args.push(`--push-endpoint=${pushEndpoint}`);
            }
            await runGCloud(args);
            return { success: true, subscriptionName, topicName };
          }

          case "delete_subscription": {
            if (!subscriptionName) {
              return { success: false, error: "subscriptionName required" };
            }
            await runGCloud([
              "pubsub",
              "subscriptions",
              "delete",
              subscriptionName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, subscriptionName, action: "deleted" };
          }

          case "pull_messages": {
            if (!subscriptionName) {
              return { success: false, error: "subscriptionName required" };
            }
            const data = await runGCloud([
              "pubsub",
              "subscriptions",
              "pull",
              subscriptionName,
              `--limit=${pullCount || 1}`,
              "--auto-ack",
              projectFlag,
            ]);
            return {
              success: true,
              messages: (Array.isArray(data) ? data : []).map((m: any) => ({
                messageId: m.message?.messageId,
                data: m.message?.data
                  ? Buffer.from(m.message.data, "base64").toString()
                  : null,
                attributes: m.message?.attributes,
                publishTime: m.message?.publishTime,
              })),
            };
          }

          case "seek_subscription": {
            if (!subscriptionName || !snapshotName) {
              return {
                success: false,
                error: "subscriptionName and snapshotName required",
              };
            }
            await runGCloud([
              "pubsub",
              "subscriptions",
              "seek",
              subscriptionName,
              `--snapshot=${snapshotName}`,
              projectFlag,
            ]);
            return { success: true, subscriptionName, snapshotName };
          }

          case "list_snapshots": {
            const data = await runGCloud([
              "pubsub",
              "snapshots",
              "list",
              projectFlag,
            ]);
            return {
              success: true,
              snapshots: (Array.isArray(data) ? data : []).map((s: any) => ({
                name: s.name?.split("/").pop(),
                topic: s.topic?.split("/").pop(),
                expireTime: s.expireTime,
                labels: s.labels,
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
// SECTION 10 — Secret Manager
// =============================================================================

export const gcpSecretManager = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Secret Manager: list secrets, access secret versions, " +
      "create/update/delete secrets and versions. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_secrets",
        "create_secret",
        "delete_secret",
        "access_secret",
        "add_secret_version",
        "list_versions",
        "disable_version",
        "enable_version",
        "destroy_version",
      ]),
      secretName: z.string().optional().describe("Secret name"),
      project: z.string().optional().describe("GCP project ID"),
      secretData: z.string().optional().describe("Secret data (plain text)"),
      version: z
        .string()
        .optional()
        .describe("Secret version (e.g. '1', 'latest')"),
      labels: z
        .record(z.string(), z.string())
        .optional()
        .describe("Secret labels"),
      filter: z.string().optional().describe("Filter expression"),
    }),
    execute: async ({
      action,
      secretName,
      project,
      secretData,
      version,
      labels,
      filter,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      try {
        switch (action) {
          case "list_secrets": {
            const args = ["secrets", "list", projectFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              secrets: (Array.isArray(data) ? data : []).map((s: any) => ({
                name: s.name?.split("/").pop(),
                replication: s.replication,
                createTime: s.createTime,
                expireTime: s.expireTime,
                labels: s.labels,
                versionCount: s.versionCount,
              })),
            };
          }

          case "create_secret": {
            if (!secretName || !secretData) {
              return {
                success: false,
                error: "secretName and secretData required",
              };
            }
            const args = [
              "secrets",
              "create",
              secretName,
              "--data-file=-",
              projectFlag,
            ];
            if (labels) {
              args.push(
                `--labels=${Object.entries(labels)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(",")}`
              );
            }
            // Pipe data via stdin
            const { stdout } = await execAsync(
              `echo ${JSON.stringify(secretData)} | gcloud secrets create ${secretName} --data-file=- ${projectFlag}`
            );
            return { success: true, secretName, result: stdout };
          }

          case "delete_secret": {
            if (!secretName) {
              return { success: false, error: "secretName required" };
            }
            await runGCloud([
              "secrets",
              "delete",
              secretName,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, secretName, action: "deleted" };
          }

          case "access_secret": {
            if (!secretName) {
              return { success: false, error: "secretName required" };
            }
            const versionFlag = version ? `--version=${version}` : "";
            const { stdout } = await execAsync(
              `gcloud secrets versions access ${version || "latest"} --secret=${secretName} ${projectFlag}`
            );
            return {
              success: true,
              secretName,
              version: version || "latest",
              data: stdout,
            };
          }

          case "add_secret_version": {
            if (!secretName || !secretData) {
              return {
                success: false,
                error: "secretName and secretData required",
              };
            }
            const { stdout } = await execAsync(
              `echo ${JSON.stringify(secretData)} | gcloud secrets versions add ${secretName} --data-file=- ${projectFlag}`
            );
            return { success: true, secretName, result: stdout };
          }

          case "list_versions": {
            if (!secretName) {
              return { success: false, error: "secretName required" };
            }
            const data = await runGCloud([
              "secrets",
              "versions",
              "list",
              secretName,
              projectFlag,
            ]);
            return {
              success: true,
              versions: (Array.isArray(data) ? data : []).map((v: any) => ({
                name: v.name?.split("/").pop(),
                state: v.state,
                createTime: v.createTime,
                destroyTime: v.destroyTime,
              })),
            };
          }

          case "disable_version": {
            if (!secretName || !version) {
              return {
                success: false,
                error: "secretName and version required",
              };
            }
            await runGCloud([
              "secrets",
              "versions",
              "disable",
              version,
              `--secret=${secretName}`,
              projectFlag,
            ]);
            return { success: true, secretName, version, action: "disabled" };
          }

          case "enable_version": {
            if (!secretName || !version) {
              return {
                success: false,
                error: "secretName and version required",
              };
            }
            await runGCloud([
              "secrets",
              "versions",
              "enable",
              version,
              `--secret=${secretName}`,
              projectFlag,
            ]);
            return { success: true, secretName, version, action: "enabled" };
          }

          case "destroy_version": {
            if (!secretName || !version) {
              return {
                success: false,
                error: "secretName and version required",
              };
            }
            await runGCloud([
              "secrets",
              "versions",
              "destroy",
              version,
              `--secret=${secretName}`,
              projectFlag,
              "--quiet",
            ]);
            return { success: true, secretName, version, action: "destroyed" };
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
// SECTION 11 — Cloud Build
// =============================================================================

export const gcpCloudBuild = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google Cloud Build: list builds, submit builds, cancel builds, " +
      "list build triggers, list available worker pools. Uses gcloud CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_builds",
        "describe_build",
        "submit",
        "cancel",
        "list_triggers",
        "run_trigger",
        "list_worker_pools",
      ]),
      project: z.string().optional().describe("GCP project ID"),
      buildId: z.string().optional().describe("Build ID"),
      config: z
        .string()
        .optional()
        .describe("Build config file path (cloudbuild.yaml)"),
      source: z.string().optional().describe("Source directory or tarball"),
      substitutions: z
        .record(z.string(), z.string())
        .optional()
        .describe("Build substitutions"),
      triggerName: z.string().optional().describe("Build trigger name"),
      triggerBranch: z.string().optional().describe("Branch for trigger run"),
      region: z.string().optional().default("global").describe("Region"),
      filter: z.string().optional().describe("Filter expression"),
    }),
    execute: async ({
      action,
      project,
      buildId,
      config,
      source,
      substitutions,
      triggerName,
      triggerBranch,
      region,
      filter,
    }) => {
      const projectFlag = project ? `--project=${project}` : "";
      const regionFlag = region ? `--region=${region}` : "";
      try {
        switch (action) {
          case "list_builds": {
            const args = ["builds", "list", projectFlag, regionFlag];
            if (filter) {
              args.push("--filter", filter);
            }
            const data = await runGCloud(args);
            return {
              success: true,
              builds: (Array.isArray(data) ? data : []).map((b: any) => ({
                id: b.id,
                status: b.status,
                createTime: b.createTime,
                finishTime: b.finishTime,
                source: b.source,
                images: b.images,
                logUrl: b.logUrl,
                substitutions: b.substitutions,
                tags: b.tags,
              })),
            };
          }

          case "describe_build": {
            if (!buildId) {
              return { success: false, error: "buildId required" };
            }
            const data = await runGCloud([
              "builds",
              "describe",
              buildId,
              projectFlag,
              regionFlag,
            ]);
            return { success: true, build: data };
          }

          case "submit": {
            const args = ["builds", "submit", projectFlag, regionFlag];
            if (config) {
              args.push("--config", config);
            }
            if (source) {
              args.push(source);
            }
            if (substitutions) {
              args.push(
                `--substitutions=${Object.entries(substitutions)
                  .map(([k, v]) => `_${k}=${v}`)
                  .join(",")}`
              );
            }
            const data = await runGCloud(args);
            return { success: true, build: data };
          }

          case "cancel": {
            if (!buildId) {
              return { success: false, error: "buildId required" };
            }
            await runGCloud([
              "builds",
              "cancel",
              buildId,
              projectFlag,
              regionFlag,
            ]);
            return { success: true, buildId, action: "cancelled" };
          }

          case "list_triggers": {
            const data = await runGCloud([
              "builds",
              "triggers",
              "list",
              projectFlag,
              regionFlag,
            ]);
            return {
              success: true,
              triggers: (Array.isArray(data) ? data : []).map((t: any) => ({
                name: t.name,
                description: t.description,
                triggerTemplate: t.triggerTemplate,
                github: t.github,
                build: t.build,
                filename: t.filename,
                disabled: t.disabled,
                createTime: t.createTime,
              })),
            };
          }

          case "run_trigger": {
            if (!triggerName) {
              return { success: false, error: "triggerName required" };
            }
            const args = [
              "builds",
              "triggers",
              "run",
              triggerName,
              projectFlag,
              regionFlag,
            ];
            if (triggerBranch) {
              args.push(`--branch=${triggerBranch}`);
            }
            const data = await runGCloud(args);
            return { success: true, triggerName, build: data };
          }

          case "list_worker_pools": {
            const data = await runGCloud([
              "builds",
              "worker-pools",
              "list",
              projectFlag,
              regionFlag,
            ]);
            return {
              success: true,
              workerPools: (Array.isArray(data) ? data : []).map((w: any) => ({
                name: w.name?.split("/").pop(),
                state: w.state,
                createTime: w.createTime,
                workerConfig: w.workerConfig,
                networkConfig: w.networkConfig,
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
// SECTION 12 — BigQuery
// =============================================================================

export const gcpBigQuery = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage Google BigQuery: list datasets, list tables, query data, " +
      "create/delete datasets, get table schema. Uses bq CLI (bundled with gcloud).",
    inputSchema: z.object({
      action: z.enum([
        "list_datasets",
        "create_dataset",
        "delete_dataset",
        "list_tables",
        "describe_table",
        "query",
        "show_schema",
        "list_jobs",
      ]),
      project: z.string().optional().describe("GCP project ID"),
      datasetName: z.string().optional().describe("BigQuery dataset name"),
      tableName: z.string().optional().describe("Table name"),
      query: z.string().optional().describe("SQL query to run"),
      location: z
        .string()
        .optional()
        .default("US")
        .describe("Dataset location"),
      maxResults: z
        .number()
        .int()
        .optional()
        .default(100)
        .describe("Max query results"),
      useLegacySql: z.boolean().optional().default(false),
      filter: z.string().optional().describe("Filter expression"),
    }),
    execute: async ({
      action,
      project,
      datasetName,
      tableName,
      query,
      location,
      maxResults,
      useLegacySql,
      filter,
    }) => {
      const projectFlag = project ? `--project_id=${project}` : "";
      try {
        switch (action) {
          case "list_datasets": {
            const { stdout } = await execAsync(
              `bq ls ${projectFlag} --format=json`
            );
            const data = JSON.parse(stdout || "[]");
            return {
              success: true,
              datasets: (Array.isArray(data) ? data : []).map((d: any) => ({
                id: d.id,
                datasetReference: d.datasetReference,
                location: d.location,
                friendlyName: d.friendlyName,
                labels: d.labels,
              })),
            };
          }

          case "create_dataset": {
            if (!datasetName) {
              return { success: false, error: "datasetName required" };
            }
            const args = ["bq", "mk", "--dataset", projectFlag];
            if (location) {
              args.push(`--location=${location}`);
            }
            args.push(`${project ? `${project}:` : ""}${datasetName}`);
            const { stdout } = await execAsync(args.join(" "));
            return { success: true, datasetName, location: location || "US" };
          }

          case "delete_dataset": {
            if (!datasetName) {
              return { success: false, error: "datasetName required" };
            }
            const { stdout } = await execAsync(
              `bq rm -r -f --dataset ${projectFlag} ${project ? `${project}:` : ""}${datasetName}`
            );
            return { success: true, datasetName, action: "deleted" };
          }

          case "list_tables": {
            if (!datasetName) {
              return { success: false, error: "datasetName required" };
            }
            const { stdout } = await execAsync(
              `bq ls ${projectFlag} --format=json ${project ? `${project}:` : ""}${datasetName}`
            );
            const data = JSON.parse(stdout || "[]");
            return {
              success: true,
              tables: (Array.isArray(data) ? data : []).map((t: any) => ({
                id: t.id,
                type: t.type,
                friendlyName: t.friendlyName,
                labels: t.labels,
              })),
            };
          }

          case "describe_table": {
            if (!datasetName || !tableName) {
              return {
                success: false,
                error: "datasetName and tableName required",
              };
            }
            const { stdout } = await execAsync(
              `bq show --format=json ${projectFlag} ${project ? `${project}:` : ""}${datasetName}.${tableName}`
            );
            return { success: true, table: JSON.parse(stdout) };
          }

          case "show_schema": {
            if (!datasetName || !tableName) {
              return {
                success: false,
                error: "datasetName and tableName required",
              };
            }
            const { stdout } = await execAsync(
              `bq show --schema --format=json ${projectFlag} ${project ? `${project}:` : ""}${datasetName}.${tableName}`
            );
            return { success: true, schema: JSON.parse(stdout) };
          }

          case "query": {
            if (!query) {
              return { success: false, error: "query required" };
            }
            const args = [
              "bq",
              "query",
              "--format=json",
              `--max_rows=${maxResults || 100}`,
              projectFlag,
            ];
            if (useLegacySql) {
              args.push("--use_legacy_sql");
            }
            args.push(`"${query.replace(/"/g, '\\"')}"`);
            const { stdout } = await execAsync(args.join(" "));
            const data = JSON.parse(stdout || "[]");
            return {
              success: true,
              rows: Array.isArray(data) ? data : [],
              totalRows: Array.isArray(data) ? data.length : 0,
            };
          }

          case "list_jobs": {
            const { stdout } = await execAsync(
              `bq ls -j ${projectFlag} --format=json --max_results=${maxResults || 50}`
            );
            const data = JSON.parse(stdout || "[]");
            return {
              success: true,
              jobs: (Array.isArray(data) ? data : []).map((j: any) => ({
                id: j.id,
                jobType: j.configuration?.query
                  ? "query"
                  : j.configuration?.load
                    ? "load"
                    : "other",
                state: j.status?.state,
                creationTime: j.statistics?.creationTime,
                startTime: j.statistics?.startTime,
                endTime: j.statistics?.endTime,
                user: j.statistics?.session?.user,
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
// EXPORT ALL — 12 tools
// =============================================================================

export const allGcpTools = (ctx: { userId: string }) => ({
  gcpStorage: gcpStorage(ctx),
  gcpCompute: gcpCompute(ctx),
  gcpFunctions: gcpFunctions(ctx),
  gcpCloudRun: gcpCloudRun(ctx),
  gcpCloudSQL: gcpCloudSQL(ctx),
  gcpIAM: gcpIAM(ctx),
  gcpDNS: gcpDNS(ctx),
  gcpMonitoring: gcpMonitoring(ctx),
  gcpPubSub: gcpPubSub(ctx),
  gcpSecretManager: gcpSecretManager(ctx),
  gcpCloudBuild: gcpCloudBuild(ctx),
  gcpBigQuery: gcpBigQuery(ctx),
});
