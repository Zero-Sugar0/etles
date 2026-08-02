import { tool } from "ai";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  DeleteBucketCommand,
  PutBucketPolicyCommand,
  GetBucketPolicyCommand,
  PutBucketLifecycleConfigurationCommand,
  GetBucketLifecycleConfigurationCommand,
  PutBucketTaggingCommand,
  GetBucketTaggingCommand,
} from "@aws-sdk/client-s3";
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  RebootInstancesCommand,
  TerminateInstancesCommand,
  DescribeSecurityGroupsCommand,
  DescribeKeyPairsCommand,
  AllocateAddressCommand,
  AssociateAddressCommand,
  ReleaseAddressCommand,
  DescribeAddressesCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  AuthorizeSecurityGroupEgressCommand,
  CreateKeyPairCommand,
  RunInstancesCommand,
} from "@aws-sdk/client-ec2";
import {
  LambdaClient,
  ListFunctionsCommand,
  InvokeCommand,
  GetFunctionCommand,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand,
  DeleteFunctionCommand,
  ListAliasesCommand,
  ListVersionsByFunctionCommand,
  PublishVersionCommand,
  GetFunctionConfigurationCommand,
  PutFunctionConcurrencyCommand,
  GetFunctionConcurrencyCommand,
} from "@aws-sdk/client-lambda";
import { GetCallerIdentityCommand, STSClient } from "@aws-sdk/client-sts";

// ─── AWS CLI Helper ───────────────────────────────────────────────────────────
// Falls back to AWS CLI for services without SDK packages installed.
// Uses the same credential chain as the SDK clients.

const execAsync = promisify(exec);

async function runAwsCli(args: string[], region?: string): Promise<any> {
  const regionFlag = region ? `--region ${region}` : "";
  const { stdout, stderr } = await execAsync(
    `aws ${args.join(" ")} ${regionFlag} --output json`,
  );
  if (stderr && !stdout) throw new Error(stderr);
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout;
  }
}

// ─── SDK Client Factories ─────────────────────────────────────────────────────

function getS3Client(region?: string) {
  return new S3Client({ region: region || process.env.AWS_REGION || "us-east-1" });
}

function getEC2Client(region?: string) {
  return new EC2Client({ region: region || process.env.AWS_REGION || "us-east-1" });
}

function getLambdaClient(region?: string) {
  return new LambdaClient({ region: region || process.env.AWS_REGION || "us-east-1" });
}

function getSTSClient(region?: string) {
  return new STSClient({ region: region || process.env.AWS_REGION || "us-east-1" });
}

// =============================================================================
// SECTION 1 — S3 (Object Storage)
// =============================================================================

export const awsS3 = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS S3: list/create/delete buckets, list/upload/download/delete/copy objects, " +
      "manage bucket policies, lifecycle rules, and tags. Use action='list_buckets' first to discover buckets.",
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
        "get_policy",
        "put_policy",
        "get_lifecycle",
        "put_lifecycle",
        "get_tags",
        "put_tags",
        "generate_presigned_url",
      ]),
      bucket: z.string().optional().describe("S3 bucket name"),
      key: z.string().optional().describe("S3 object key (path)"),
      destinationBucket: z.string().optional().describe("Destination bucket for copy"),
      destinationKey: z.string().optional().describe("Destination key for copy"),
      content: z.string().optional().describe("Content for upload (string or base64)"),
      contentBase64: z.boolean().optional().default(false).describe("If true, content is base64-encoded"),
      policy: z.string().optional().describe("Bucket policy JSON"),
      lifecycleRules: z.string().optional().describe("Lifecycle rules JSON array"),
      tags: z.record(z.string(), z.string()).optional().describe("Tags for bucket"),
      region: z.string().optional().describe("AWS region"),
      prefix: z.string().optional().describe("Object prefix filter for list_objects"),
      maxKeys: z.number().int().min(1).max(1000).optional().default(100).describe("Max objects to return"),
      expiresIn: z.number().int().optional().default(3600).describe("Presigned URL expiry in seconds"),
      acl: z.enum(["private", "public-read", "public-read-write", "authenticated-read"]).optional().describe("Bucket ACL"),
    }),
    execute: async ({
      action, bucket, key, destinationBucket, destinationKey, content, contentBase64,
      policy, lifecycleRules, tags, region, prefix, maxKeys, expiresIn, acl,
    }) => {
      const client = getS3Client(region);
      try {
        switch (action) {
          // ── Bucket Operations ──
          case "list_buckets": {
            const data = await client.send(new ListBucketsCommand({}));
            return {
              success: true,
              buckets: (data.Buckets || []).map((b) => ({
                name: b.Name,
                creationDate: b.CreationDate?.toISOString(),
              })),
              owner: data.Owner,
            };
          }

          case "create_bucket": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            const regionActual = region || process.env.AWS_REGION || "us-east-1";
            const params: any = { Bucket: bucket };
            if (regionActual !== "us-east-1") {
              params.CreateBucketConfiguration = { LocationConstraint: regionActual };
            }
            if (acl) params.ACL = acl;
            await client.send(new CreateBucketCommand(params));
            return { success: true, bucket, region: regionActual, message: `Bucket '${bucket}' created` };
          }

          case "delete_bucket": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            await client.send(new DeleteBucketCommand({ Bucket: bucket }));
            return { success: true, bucket, message: `Bucket '${bucket}' deleted` };
          }

          // ── Object Operations ──
          case "list_objects": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            const data = await client.send(
              new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: maxKeys }),
            );
            return {
              success: true,
              bucket,
              prefix: prefix || "",
              isTruncated: data.IsTruncated,
              objects: (data.Contents || []).map((o) => ({
                key: o.Key,
                size: o.Size,
                lastModified: o.LastModified?.toISOString(),
                etag: o.ETag,
                storageClass: o.StorageClass,
              })),
              commonPrefixes: data.CommonPrefixes?.map((p) => p.Prefix) || [],
            };
          }

          case "upload": {
            if (!bucket || !key || content === undefined) {
              return { success: false, error: "Bucket, key, and content required" };
            }
            const body = contentBase64 ? Buffer.from(content, "base64") : content;
            await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
            return { success: true, bucket, key, message: `Uploaded s3://${bucket}/${key}` };
          }

          case "download": {
            if (!bucket || !key) return { success: false, error: "Bucket and key required" };
            const data = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const body = await data.Body?.transformToString();
            return {
              success: true,
              bucket,
              key,
              content: body,
              contentType: data.ContentType,
              contentLength: data.ContentLength,
              lastModified: data.LastModified?.toISOString(),
              etag: data.ETag,
              metadata: data.Metadata,
            };
          }

          case "delete_object": {
            if (!bucket || !key) return { success: false, error: "Bucket and key required" };
            await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
            return { success: true, bucket, key, message: `Deleted s3://${bucket}/${key}` };
          }

          case "copy_object": {
            if (!bucket || !key || !destinationBucket || !destinationKey) {
              return { success: false, error: "Bucket, key, destinationBucket, and destinationKey required" };
            }
            await client.send(new CopyObjectCommand({
              Bucket: destinationBucket,
              Key: destinationKey,
              CopySource: `/${bucket}/${key}`,
            }));
            return {
              success: true,
              source: `s3://${bucket}/${key}`,
              destination: `s3://${destinationBucket}/${destinationKey}`,
              message: "Object copied",
            };
          }

          // ── Policy ──
          case "get_policy": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            const data = await client.send(new GetBucketPolicyCommand({ Bucket: bucket }));
            return { success: true, bucket, policy: data.Policy ? JSON.parse(data.Policy) : null };
          }

          case "put_policy": {
            if (!bucket || !policy) return { success: false, error: "Bucket and policy required" };
            await client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
            return { success: true, bucket, message: "Policy updated" };
          }

          // ── Lifecycle ──
          case "get_lifecycle": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            const data = await client.send(new GetBucketLifecycleConfigurationCommand({ Bucket: bucket }));
            return { success: true, bucket, rules: data.Rules };
          }

          case "put_lifecycle": {
            if (!bucket || !lifecycleRules) return { success: false, error: "Bucket and lifecycleRules required" };
            const rules = typeof lifecycleRules === "string" ? JSON.parse(lifecycleRules) : lifecycleRules;
            await client.send(new PutBucketLifecycleConfigurationCommand({
              Bucket: bucket,
              LifecycleConfiguration: { Rules: rules },
            }));
            return { success: true, bucket, message: "Lifecycle rules updated" };
          }

          // ── Tags ──
          case "get_tags": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            const data = await client.send(new GetBucketTaggingCommand({ Bucket: bucket }));
            return { success: true, bucket, tags: (data.TagSet || []).reduce((acc: Record<string, string>, t) => {
              if (t.Key && t.Value) acc[t.Key] = t.Value;
              return acc;
            }, {}) };
          }

          case "put_tags": {
            if (!bucket || !tags) return { success: false, error: "Bucket and tags required" };
            const tagSet = Object.entries(tags).map(([Key, Value]) => ({ Key, Value }));
            await client.send(new PutBucketTaggingCommand({
              Bucket: bucket,
              Tagging: { TagSet: tagSet },
            }));
            return { success: true, bucket, tags, message: "Tags updated" };
          }

          case "generate_presigned_url": {
            // Use AWS CLI for presigned URLs since SDK v3 requires @aws-sdk/s3-request-presigner
            if (!bucket || !key) return { success: false, error: "Bucket and key required" };
            const result = await runAwsCli([
              "s3", "presign", `s3://${bucket}/${key}`,
              `--expires-in`, String(expiresIn || 3600),
            ], region);
            return { success: true, url: result.trim(), bucket, key, expiresIn: expiresIn || 3600 };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message, code: error.name };
      }
    },
  });

// =============================================================================
// SECTION 2 — EC2 (Compute)
// =============================================================================

export const awsEC2 = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS EC2 instances and related resources: list/start/stop/reboot/terminate instances, " +
      "manage security groups, key pairs, elastic IPs, and launch instances. " +
      "Use action='list_instances' first to discover running instances.",
    inputSchema: z.object({
      action: z.enum([
        "list_instances",
        "start",
        "stop",
        "reboot",
        "terminate",
        "run_instance",
        "list_security_groups",
        "create_security_group",
        "authorize_ingress",
        "authorize_egress",
        "list_key_pairs",
        "create_key_pair",
        "list_elastic_ips",
        "allocate_elastic_ip",
        "associate_elastic_ip",
        "release_elastic_ip",
      ]),
      instanceIds: z.array(z.string()).optional().describe("EC2 instance IDs"),
      region: z.string().optional().describe("AWS region"),
      // Run instance params
      imageId: z.string().optional().describe("AMI ID for run_instance"),
      instanceType: z.string().optional().default("t3.micro").describe("Instance type"),
      keyName: z.string().optional().describe("Key pair name"),
      securityGroupIds: z.array(z.string()).optional().describe("Security group IDs"),
      subnetId: z.string().optional().describe("Subnet ID"),
      minCount: z.number().int().optional().default(1),
      maxCount: z.number().int().optional().default(1),
      userData: z.string().optional().describe("Base64-encoded user data script"),
      // Security group params
      groupName: z.string().optional().describe("Security group name"),
      groupDescription: z.string().optional().describe("Security group description"),
      vpcId: z.string().optional().describe("VPC ID"),
      ipProtocol: z.string().optional().default("tcp").describe("Protocol for rules (tcp, udp, icmp, -1)"),
      fromPort: z.number().int().optional().describe("Start of port range"),
      toPort: z.number().int().optional().describe("End of port range"),
      cidrBlock: z.string().optional().default("0.0.0.0/0").describe("CIDR block for rules"),
      // Elastic IP params
      allocationId: z.string().optional().describe("Allocation ID for release/associate"),
      instanceId: z.string().optional().describe("Instance ID for association"),
      // Filters
      filters: z.array(z.object({
        name: z.string(),
        values: z.array(z.string()),
      })).optional().describe("EC2 filter criteria"),
    }),
    execute: async ({
      action, instanceIds, region, imageId, instanceType, keyName,
      securityGroupIds, subnetId, minCount, maxCount, userData,
      groupName, groupDescription, vpcId, ipProtocol, fromPort, toPort, cidrBlock,
      allocationId, instanceId, filters,
    }) => {
      const client = getEC2Client(region);
      try {
        switch (action) {
          case "list_instances": {
            const params: any = {};
            if (filters) params.Filters = filters;
            if (instanceIds?.length) params.InstanceIds = instanceIds;
            const data = await client.send(new DescribeInstancesCommand(params));
            const instances = (data.Reservations || []).flatMap((r) =>
              (r.Instances || []).map((i) => ({
                instanceId: i.InstanceId,
                state: i.State?.Name,
                instanceType: i.InstanceType,
                launchTime: i.LaunchTime?.toISOString(),
                publicIp: i.PublicIpAddress,
                privateIp: i.PrivateIpAddress,
                publicDns: i.PublicDnsName,
                privateDns: i.PrivateDnsName,
                vpcId: i.VpcId,
                subnetId: i.SubnetId,
                securityGroups: i.SecurityGroups?.map((sg) => ({
                  id: sg.GroupId,
                  name: sg.GroupName,
                })),
                tags: (i.Tags || []).reduce((acc: Record<string, string>, t) => {
                  if (t.Key && t.Value) acc[t.Key] = t.Value;
                  return acc;
                }, {}),
                keyName: i.KeyName,
                imageId: i.ImageId,
                platform: i.Platform,
                architecture: i.Architecture,
                monitoring: i.Monitoring?.State,
                ebsOptimized: i.EbsOptimized,
                rootDeviceType: i.RootDeviceType,
                rootDeviceName: i.RootDeviceName,
              })),
            );
            return { success: true, instances, totalCount: instances.length };
          }

          case "start": {
            if (!instanceIds?.length) return { success: false, error: "Instance IDs required" };
            const data = await client.send(new StartInstancesCommand({ InstanceIds: instanceIds }));
            return {
              success: true,
              action: "started",
              instances: (data.StartingInstances || []).map((i) => ({
                instanceId: i.InstanceId,
                currentState: i.CurrentState?.Name,
                previousState: i.PreviousState?.Name,
              })),
            };
          }

          case "stop": {
            if (!instanceIds?.length) return { success: false, error: "Instance IDs required" };
            const data = await client.send(new StopInstancesCommand({ InstanceIds: instanceIds }));
            return {
              success: true,
              action: "stopped",
              instances: (data.StoppingInstances || []).map((i) => ({
                instanceId: i.InstanceId,
                currentState: i.CurrentState?.Name,
                previousState: i.PreviousState?.Name,
              })),
            };
          }

          case "reboot": {
            if (!instanceIds?.length) return { success: false, error: "Instance IDs required" };
            await client.send(new RebootInstancesCommand({ InstanceIds: instanceIds }));
            return { success: true, action: "rebooted", instanceIds, message: "Reboot initiated" };
          }

          case "terminate": {
            if (!instanceIds?.length) return { success: false, error: "Instance IDs required" };
            const data = await client.send(new TerminateInstancesCommand({ InstanceIds: instanceIds }));
            return {
              success: true,
              action: "terminated",
              instances: (data.TerminatingInstances || []).map((i) => ({
                instanceId: i.InstanceId,
                currentState: i.CurrentState?.Name,
                previousState: i.PreviousState?.Name,
              })),
            };
          }

          case "run_instance": {
            if (!imageId) return { success: false, error: "imageId required" };
            const params: any = {
              ImageId: imageId,
              InstanceType: instanceType || "t3.micro",
              MinCount: minCount || 1,
              MaxCount: maxCount || 1,
            };
            if (keyName) params.KeyName = keyName;
            if (securityGroupIds?.length) params.SecurityGroupIds = securityGroupIds;
            if (subnetId) params.SubnetId = subnetId;
            if (userData) params.UserData = userData;
            const data = await client.send(new RunInstancesCommand(params));
            const launched = (data.Instances || []).map((i) => ({
              instanceId: i.InstanceId,
              instanceType: i.InstanceType,
              state: i.State?.Name,
              launchTime: i.LaunchTime?.toISOString(),
              privateIp: i.PrivateIpAddress,
            }));
            return { success: true, instances: launched, count: launched.length };
          }

          case "list_security_groups": {
            const params: any = {};
            if (filters) params.Filters = filters;
            if (groupName) params.GroupNames = [groupName];
            const data = await client.send(new DescribeSecurityGroupsCommand(params));
            return {
              success: true,
              securityGroups: (data.SecurityGroups || []).map((sg) => ({
                id: sg.GroupId,
                name: sg.GroupName,
                description: sg.Description,
                vpcId: sg.VpcId,
                ingressRules: sg.IpPermissions?.map((p) => ({
                  protocol: p.IpProtocol,
                  fromPort: p.FromPort,
                  toPort: p.ToPort,
                  cidr: p.IpRanges?.map((r) => r.CidrIp),
                  securityGroups: p.UserIdGroupPairs?.map((g) => g.GroupId),
                })),
                egressRules: sg.IpPermissionsEgress?.map((p) => ({
                  protocol: p.IpProtocol,
                  fromPort: p.FromPort,
                  toPort: p.ToPort,
                  cidr: p.IpRanges?.map((r) => r.CidrIp),
                })),
                tags: (sg.Tags || []).reduce((acc: Record<string, string>, t) => {
                  if (t.Key && t.Value) acc[t.Key] = t.Value;
                  return acc;
                }, {}),
              })),
            };
          }

          case "create_security_group": {
            if (!groupName || !groupDescription) {
              return { success: false, error: "groupName and groupDescription required" };
            }
            const params: any = {
              GroupName: groupName,
              Description: groupDescription,
            };
            if (vpcId) params.VpcId = vpcId;
            const data = await client.send(new CreateSecurityGroupCommand(params));
            return { success: true, groupId: data.GroupId, groupName, vpcId: vpcId || "default" };
          }

          case "authorize_ingress": {
            if (!groupName || fromPort === undefined || toPort === undefined) {
              return { success: false, error: "groupName, fromPort, and toPort required" };
            }
            await client.send(new AuthorizeSecurityGroupIngressCommand({
              GroupName: groupName,
              IpPermissions: [{
                IpProtocol: ipProtocol || "tcp",
                FromPort: fromPort,
                ToPort: toPort,
                IpRanges: [{ CidrIp: cidrBlock || "0.0.0.0/0" }],
              }],
            }));
            return {
              success: true,
              groupName,
              rule: `${ipProtocol || "tcp"} ${fromPort}-${toPort} from ${cidrBlock || "0.0.0.0/0"}`,
              direction: "ingress",
            };
          }

          case "authorize_egress": {
            if (!groupName || fromPort === undefined || toPort === undefined) {
              return { success: false, error: "groupName, fromPort, and toPort required" };
            }
            await client.send(new AuthorizeSecurityGroupEgressCommand({
              GroupId: groupName,
              IpPermissions: [{
                IpProtocol: ipProtocol || "tcp",
                FromPort: fromPort,
                ToPort: toPort,
                IpRanges: [{ CidrIp: cidrBlock || "0.0.0.0/0" }],
              }],
            } as any));
            return {
              success: true,
              groupName,
              rule: `${ipProtocol || "tcp"} ${fromPort}-${toPort} to ${cidrBlock || "0.0.0.0/0"}`,
              direction: "egress",
            };
          }

          case "list_key_pairs": {
            const data = await client.send(new DescribeKeyPairsCommand({}));
            return {
              success: true,
              keyPairs: (data.KeyPairs || []).map((kp) => ({
                name: kp.KeyName,
                type: kp.KeyType,
                fingerprint: kp.KeyFingerprint,
                tags: (kp.Tags || []).reduce((acc: Record<string, string>, t) => {
                  if (t.Key && t.Value) acc[t.Key] = t.Value;
                  return acc;
                }, {}),
              })),
            };
          }

          case "create_key_pair": {
            if (!keyName) return { success: false, error: "keyName required" };
            const data = await client.send(new CreateKeyPairCommand({ KeyName: keyName }));
            return {
              success: true,
              keyName: data.KeyName,
              keyFingerprint: data.KeyFingerprint,
              keyMaterial: data.KeyMaterial,
              message: "Save the key material — it cannot be retrieved later",
            };
          }

          case "list_elastic_ips": {
            const data = await client.send(new DescribeAddressesCommand({}));
            return {
              success: true,
              addresses: (data.Addresses || []).map((a) => ({
                publicIp: a.PublicIp,
                allocationId: a.AllocationId,
                associationId: a.AssociationId,
                instanceId: a.InstanceId,
                domain: a.Domain,
                tags: (a.Tags || []).reduce((acc: Record<string, string>, t) => {
                  if (t.Key && t.Value) acc[t.Key] = t.Value;
                  return acc;
                }, {}),
              })),
            };
          }

          case "allocate_elastic_ip": {
            const data = await client.send(new AllocateAddressCommand({ Domain: "vpc" }));
            return {
              success: true,
              publicIp: data.PublicIp,
              allocationId: data.AllocationId,
              domain: "vpc",
            };
          }

          case "associate_elastic_ip": {
            if (!allocationId || !instanceId) {
              return { success: false, error: "allocationId and instanceId required" };
            }
            const data = await client.send(new AssociateAddressCommand({
              AllocationId: allocationId,
              InstanceId: instanceId,
            }));
            return { success: true, associationId: data.AssociationId, instanceId, allocationId };
          }

          case "release_elastic_ip": {
            if (!allocationId) return { success: false, error: "allocationId required" };
            await client.send(new ReleaseAddressCommand({ AllocationId: allocationId }));
            return { success: true, allocationId, message: "Elastic IP released" };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message, code: error.name };
      }
    },
  });

// =============================================================================
// SECTION 3 — Lambda (Serverless Functions)
// =============================================================================

export const awsLambda = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS Lambda functions: list, invoke, get, create, update code/config, delete, " +
      "manage aliases, versions, and concurrency. Use action='list_functions' first.",
    inputSchema: z.object({
      action: z.enum([
        "list_functions",
        "invoke",
        "get_function",
        "get_config",
        "create_function",
        "update_code",
        "update_config",
        "delete_function",
        "list_aliases",
        "list_versions",
        "publish_version",
        "put_concurrency",
        "get_concurrency",
      ]),
      functionName: z.string().optional().describe("Lambda function name or ARN"),
      region: z.string().optional().describe("AWS region"),
      payload: z.string().optional().describe("JSON payload for invocation"),
      invocationType: z.enum(["RequestResponse", "Event", "DryRun"]).optional().default("RequestResponse"),
      // Create/Update params
      runtime: z.string().optional().describe("Runtime e.g. nodejs20.x, python3.12"),
      role: z.string().optional().describe("IAM role ARN for create_function"),
      handler: z.string().optional().describe("Function handler e.g. index.handler"),
      code: z.string().optional().describe("Base64-encoded zip file for function code"),
      codeS3Bucket: z.string().optional().describe("S3 bucket containing function code"),
      codeS3Key: z.string().optional().describe("S3 key for function code"),
      description: z.string().optional().describe("Function description"),
      memorySize: z.number().int().optional().describe("Memory in MB (128-10240)"),
      timeout: z.number().int().optional().describe("Timeout in seconds (1-900)"),
      environment: z.record(z.string(), z.string()).optional().describe("Environment variables"),
      // Alias/Version
      aliasName: z.string().optional().describe("Alias name"),
      versionNumber: z.string().optional().describe("Version number"),
      // Concurrency
      reservedConcurrency: z.number().int().optional().describe("Reserved concurrency (0 for no limit)"),
      maxItems: z.number().int().optional().default(50).describe("Max items to return"),
    }),
    execute: async ({
      action, functionName, region, payload, invocationType,
      runtime, role, handler, code, codeS3Bucket, codeS3Key,
      description, memorySize, timeout, environment,
      aliasName, versionNumber, reservedConcurrency, maxItems,
    }) => {
      const client = getLambdaClient(region);
      try {
        switch (action) {
          case "list_functions": {
            const data = await client.send(new ListFunctionsCommand({ MaxItems: maxItems }));
            return {
              success: true,
              functions: (data.Functions || []).map((fn) => ({
                name: fn.FunctionName,
                arn: fn.FunctionArn,
                runtime: fn.Runtime,
                handler: fn.Handler,
                memorySize: fn.MemorySize,
                timeout: fn.Timeout,
                lastModified: fn.LastModified,
                codeSize: fn.CodeSize,
                description: fn.Description,
                role: fn.Role,
                state: fn.State,
                lastUpdateStatus: fn.LastUpdateStatus,
                architectures: fn.Architectures,
                packageType: fn.PackageType,
                runtimeVersionConfig: fn.RuntimeVersionConfig?.RuntimeVersionArn,
              })),
              totalCount: (data.Functions || []).length,
            };
          }

          case "invoke": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new InvokeCommand({
              FunctionName: functionName,
              InvocationType: invocationType || "RequestResponse",
              Payload: payload ? Buffer.from(payload) : undefined,
            }));
            const resultPayload = data.Payload ? Buffer.from(data.Payload).toString() : null;
            let parsedResult: any = resultPayload;
            try { parsedResult = JSON.parse(resultPayload || "null"); } catch {}
            return {
              success: data.StatusCode === 200 || data.StatusCode === 202,
              statusCode: data.StatusCode,
              result: parsedResult,
              logResult: data.LogResult ? Buffer.from(data.LogResult, "base64").toString() : undefined,
              executedVersion: data.ExecutedVersion,
              functionError: data.FunctionError,
            };
          }

          case "get_function": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new GetFunctionCommand({ FunctionName: functionName }));
            return {
              success: true,
              configuration: {
                name: data.Configuration?.FunctionName,
                arn: data.Configuration?.FunctionArn,
                runtime: data.Configuration?.Runtime,
                handler: data.Configuration?.Handler,
                memorySize: data.Configuration?.MemorySize,
                timeout: data.Configuration?.Timeout,
                lastModified: data.Configuration?.LastModified,
                codeSize: data.Configuration?.CodeSize,
                description: data.Configuration?.Description,
                role: data.Configuration?.Role,
                state: data.Configuration?.State,
                stateReason: data.Configuration?.StateReason,
                lastUpdateStatus: data.Configuration?.LastUpdateStatus,
                environment: data.Configuration?.Environment?.Variables,
                vpcConfig: data.Configuration?.VpcConfig,
                deadLetterConfig: data.Configuration?.DeadLetterConfig,
                tracingConfig: data.Configuration?.TracingConfig?.Mode,
                architectures: data.Configuration?.Architectures,
                packageType: data.Configuration?.PackageType,
                layers: data.Configuration?.Layers?.map((l) => l.Arn),
              },
              code: {
                repositoryType: data.Code?.RepositoryType,
                location: data.Code?.Location,
                imageUri: data.Code?.ImageUri,
              },
              tags: data.Tags,
            };
          }

          case "get_config": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
            return {
              success: true,
              configuration: {
                name: data.FunctionName,
                arn: data.FunctionArn,
                runtime: data.Runtime,
                handler: data.Handler,
                memorySize: data.MemorySize,
                timeout: data.Timeout,
                lastModified: data.LastModified,
                description: data.Description,
                role: data.Role,
                environment: data.Environment?.Variables,
                vpcConfig: data.VpcConfig,
                deadLetterConfig: data.DeadLetterConfig,
                tracingConfig: data.TracingConfig?.Mode,
                layers: data.Layers?.map((l) => l.Arn),
                fileSystemConfigs: data.FileSystemConfigs,
                ephemeralStorage: data.EphemeralStorage?.Size,
                snapStart: data.SnapStart?.ApplyOn,
                loggingConfig: data.LoggingConfig,
              },
            };
          }

          case "create_function": {
            if (!functionName || !runtime || !role || !handler) {
              return { success: false, error: "functionName, runtime, role, and handler required" };
            }
            const params: any = {
              FunctionName: functionName,
              Runtime: runtime,
              Role: role,
              Handler: handler,
            };
            if (code) {
              params.Code = { ZipFile: Buffer.from(code, "base64") };
            } else if (codeS3Bucket && codeS3Key) {
              params.Code = { S3Bucket: codeS3Bucket, S3Key: codeS3Key };
            } else {
              return { success: false, error: "code (base64 zip) or codeS3Bucket+codeS3Key required" };
            }
            if (description) params.Description = description;
            if (memorySize) params.MemorySize = memorySize;
            if (timeout) params.Timeout = timeout;
            if (environment) params.Environment = { Variables: environment };
            const data = await client.send(new CreateFunctionCommand(params));
            return {
              success: true,
              functionName: data.FunctionName,
              arn: data.FunctionArn,
              runtime: data.Runtime,
              handler: data.Handler,
              state: data.State,
            };
          }

          case "update_code": {
            if (!functionName) return { success: false, error: "Function name required" };
            const params: any = { FunctionName: functionName };
            if (code) {
              params.ZipFile = Buffer.from(code, "base64");
            } else if (codeS3Bucket && codeS3Key) {
              params.S3Bucket = codeS3Bucket;
              params.S3Key = codeS3Key;
            } else {
              return { success: false, error: "code (base64 zip) or codeS3Bucket+codeS3Key required" };
            }
            const data = await client.send(new UpdateFunctionCodeCommand(params));
            return {
              success: true,
              functionName: data.FunctionName,
              lastUpdateStatus: data.LastUpdateStatus,
              state: data.State,
            };
          }

          case "update_config": {
            if (!functionName) return { success: false, error: "Function name required" };
            const params: any = { FunctionName: functionName };
            if (description) params.Description = description;
            if (handler) params.Handler = handler;
            if (memorySize) params.MemorySize = memorySize;
            if (timeout) params.Timeout = timeout;
            if (runtime) params.Runtime = runtime;
            if (role) params.Role = role;
            if (environment) params.Environment = { Variables: environment };
            const data = await client.send(new UpdateFunctionConfigurationCommand(params));
            return {
              success: true,
              functionName: data.FunctionName,
              lastUpdateStatus: data.LastUpdateStatus,
              state: data.State,
            };
          }

          case "delete_function": {
            if (!functionName) return { success: false, error: "Function name required" };
            await client.send(new DeleteFunctionCommand({ FunctionName: functionName }));
            return { success: true, functionName, message: `Function '${functionName}' deleted` };
          }

          case "list_aliases": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new ListAliasesCommand({ FunctionName: functionName }));
            return {
              success: true,
              aliases: (data.Aliases || []).map((a) => ({
                name: a.Name,
                functionVersion: a.FunctionVersion,
                arn: a.AliasArn,
                description: a.Description,
                routingConfig: a.RoutingConfig?.AdditionalVersionWeights,
              })),
            };
          }

          case "list_versions": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new ListVersionsByFunctionCommand({
              FunctionName: functionName,
              MaxItems: maxItems,
            }));
            return {
              success: true,
              versions: (data.Versions || []).map((v) => ({
                name: v.FunctionName,
                version: v.Version,
                arn: v.FunctionArn,
                runtime: v.Runtime,
                handler: v.Handler,
                state: v.State,
                lastModified: v.LastModified,
                description: v.Description,
              })),
            };
          }

          case "publish_version": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new PublishVersionCommand({
              FunctionName: functionName,
              Description: description,
            }));
            return {
              success: true,
              version: data.Version,
              arn: data.FunctionArn,
              state: data.State,
            };
          }

          case "put_concurrency": {
            if (!functionName) return { success: false, error: "Function name required" };
            if (reservedConcurrency === undefined) {
              return { success: false, error: "reservedConcurrency required" };
            }
            const data = await client.send(new PutFunctionConcurrencyCommand({
              FunctionName: functionName,
              ReservedConcurrentExecutions: reservedConcurrency,
            }));
            return {
              success: true,
              functionName,
              reservedConcurrency: data.ReservedConcurrentExecutions,
            };
          }

          case "get_concurrency": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new GetFunctionConcurrencyCommand({ FunctionName: functionName }));
            return {
              success: true,
              functionName,
              reservedConcurrency: data.ReservedConcurrentExecutions,
              unreservedConcurrency: undefined,
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message, code: error.name };
      }
    },
  });

// =============================================================================
// SECTION 4 — IAM (Identity & Access Management)
// =============================================================================

export const awsIAM = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS IAM: list users/roles/policies, create/attach/detach policies, " +
      "manage access keys, simulate policy, and get account details. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_users",
        "get_user",
        "list_roles",
        "get_role",
        "list_policies",
        "get_policy",
        "create_policy",
        "attach_user_policy",
        "detach_user_policy",
        "attach_role_policy",
        "detach_role_policy",
        "list_attached_user_policies",
        "list_attached_role_policies",
        "list_access_keys",
        "create_access_key",
        "update_access_key",
        "delete_access_key",
        "simulate_principal_policy",
        "get_account_summary",
        "list_groups",
      ]),
      userName: z.string().optional().describe("IAM user name"),
      roleName: z.string().optional().describe("IAM role name"),
      policyArn: z.string().optional().describe("Policy ARN"),
      policyName: z.string().optional().describe("Policy name"),
      policyDocument: z.string().optional().describe("Policy document JSON"),
      pathPrefix: z.string().optional().describe("Path prefix filter"),
      scope: z.enum(["All", "AWS", "Local"]).optional().default("All").describe("Policy scope"),
      accessKeyId: z.string().optional().describe("Access key ID"),
      status: z.enum(["Active", "Inactive"]).optional().describe("Access key status"),
      actionNames: z.array(z.string()).optional().describe("Actions to simulate"),
      resourceArns: z.array(z.string()).optional().describe("Resource ARNs for simulation"),
      policySourceArn: z.string().optional().describe("Policy source ARN for simulate_principal_policy"),
      region: z.string().optional(),
    }),
    execute: async ({
      action, userName, roleName, policyArn, policyName, policyDocument,
      pathPrefix, scope, accessKeyId, status, actionNames, resourceArns, region,
      policySourceArn,
    }) => {
      try {
        switch (action) {
          case "list_users": {
            const args = ["iam", "list-users"];
            if (pathPrefix) args.push("--path-prefix", pathPrefix);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              users: (data.Users || []).map((u: any) => ({
                userName: u.UserName,
                userId: u.UserId,
                arn: u.Arn,
                createDate: u.CreateDate,
                passwordLastUsed: u.PasswordLastUsed,
                path: u.Path,
              })),
            };
          }

          case "get_user": {
            if (!userName) return { success: false, error: "userName required" };
            const data = await runAwsCli(["iam", "get-user", "--user-name", userName], region);
            const u = data.User;
            return {
              success: true,
              user: {
                userName: u.UserName,
                userId: u.UserId,
                arn: u.Arn,
                createDate: u.CreateDate,
                passwordLastUsed: u.PasswordLastUsed,
                path: u.Path,
                tags: (u.Tags || []).reduce((acc: Record<string, string>, t: any) => {
                  acc[t.Key] = t.Value;
                  return acc;
                }, {}),
              },
            };
          }

          case "list_roles": {
            const args = ["iam", "list-roles"];
            if (pathPrefix) args.push("--path-prefix", pathPrefix);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              roles: (data.Roles || []).map((r: any) => ({
                roleName: r.RoleName,
                roleId: r.RoleId,
                arn: r.Arn,
                createDate: r.CreateDate,
                description: r.Description,
                maxSessionDuration: r.MaxSessionDuration,
                assumeRolePolicyDocument: r.AssumeRolePolicyDocument
                  ? (typeof r.AssumeRolePolicyDocument === "string"
                    ? JSON.parse(decodeURIComponent(r.AssumeRolePolicyDocument))
                    : r.AssumeRolePolicyDocument)
                  : null,
                path: r.Path,
              })),
            };
          }

          case "get_role": {
            if (!roleName) return { success: false, error: "roleName required" };
            const data = await runAwsCli(["iam", "get-role", "--role-name", roleName], region);
            const r = data.Role;
            return {
              success: true,
              role: {
                roleName: r.RoleName,
                roleId: r.RoleId,
                arn: r.Arn,
                createDate: r.CreateDate,
                description: r.Description,
                maxSessionDuration: r.MaxSessionDuration,
                assumeRolePolicyDocument: r.AssumeRolePolicyDocument
                  ? (typeof r.AssumeRolePolicyDocument === "string"
                    ? JSON.parse(decodeURIComponent(r.AssumeRolePolicyDocument))
                    : r.AssumeRolePolicyDocument)
                  : null,
                path: r.Path,
                tags: (r.Tags || []).reduce((acc: Record<string, string>, t: any) => {
                  acc[t.Key] = t.Value;
                  return acc;
                }, {}),
              },
            };
          }

          case "list_policies": {
            const args = ["iam", "list-policies", "--scope", scope || "All"];
            if (pathPrefix) args.push("--path-prefix", pathPrefix);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              policies: (data.Policies || []).map((p: any) => ({
                policyName: p.PolicyName,
                policyId: p.PolicyId,
                arn: p.Arn,
                path: p.Path,
                description: p.Description,
                createDate: p.CreateDate,
                updateDate: p.UpdateDate,
                attachmentCount: p.AttachmentCount,
                isAttachable: p.IsAttachable,
                permissionsBoundaryUsageCount: p.PermissionsBoundaryUsageCount,
                defaultVersionId: p.DefaultVersionId,
              })),
            };
          }

          case "get_policy": {
            if (!policyArn) return { success: false, error: "policyArn required" };
            const data = await runAwsCli(["iam", "get-policy", "--policy-arn", policyArn], region);
            const p = data.Policy;
            // Also get the default version
            const versionData = await runAwsCli([
              "iam", "get-policy-version",
              "--policy-arn", policyArn,
              "--version-id", p.DefaultVersionId,
            ], region);
            return {
              success: true,
              policy: {
                policyName: p.PolicyName,
                policyId: p.PolicyId,
                arn: p.Arn,
                description: p.Description,
                createDate: p.CreateDate,
                updateDate: p.UpdateDate,
                attachmentCount: p.AttachmentCount,
                defaultVersionId: p.DefaultVersionId,
                document: versionData.PolicyVersion?.Document
                  ? (typeof versionData.PolicyVersion.Document === "string"
                    ? JSON.parse(decodeURIComponent(versionData.PolicyVersion.Document))
                    : versionData.PolicyVersion.Document)
                  : null,
              },
            };
          }

          case "create_policy": {
            if (!policyName || !policyDocument) {
              return { success: false, error: "policyName and policyDocument required" };
            }
            const data = await runAwsCli([
              "iam", "create-policy",
              "--policy-name", policyName,
              "--policy-document", policyDocument,
            ], region);
            return {
              success: true,
              policy: {
                policyName: data.Policy?.PolicyName,
                arn: data.Policy?.Arn,
              },
            };
          }

          case "attach_user_policy": {
            if (!userName || !policyArn) {
              return { success: false, error: "userName and policyArn required" };
            }
            await runAwsCli([
              "iam", "attach-user-policy",
              "--user-name", userName,
              "--policy-arn", policyArn,
            ], region);
            return { success: true, userName, policyArn, message: "Policy attached to user" };
          }

          case "detach_user_policy": {
            if (!userName || !policyArn) {
              return { success: false, error: "userName and policyArn required" };
            }
            await runAwsCli([
              "iam", "detach-user-policy",
              "--user-name", userName,
              "--policy-arn", policyArn,
            ], region);
            return { success: true, userName, policyArn, message: "Policy detached from user" };
          }

          case "attach_role_policy": {
            if (!roleName || !policyArn) {
              return { success: false, error: "roleName and policyArn required" };
            }
            await runAwsCli([
              "iam", "attach-role-policy",
              "--role-name", roleName,
              "--policy-arn", policyArn,
            ], region);
            return { success: true, roleName, policyArn, message: "Policy attached to role" };
          }

          case "detach_role_policy": {
            if (!roleName || !policyArn) {
              return { success: false, error: "roleName and policyArn required" };
            }
            await runAwsCli([
              "iam", "detach-role-policy",
              "--role-name", roleName,
              "--policy-arn", policyArn,
            ], region);
            return { success: true, roleName, policyArn, message: "Policy detached from role" };
          }

          case "list_attached_user_policies": {
            if (!userName) return { success: false, error: "userName required" };
            const data = await runAwsCli([
              "iam", "list-attached-user-policies",
              "--user-name", userName,
            ], region);
            return {
              success: true,
              userName,
              attachedPolicies: (data.AttachedPolicies || []).map((p: any) => ({
                policyName: p.PolicyName,
                policyArn: p.PolicyArn,
              })),
            };
          }

          case "list_attached_role_policies": {
            if (!roleName) return { success: false, error: "roleName required" };
            const data = await runAwsCli([
              "iam", "list-attached-role-policies",
              "--role-name", roleName,
            ], region);
            return {
              success: true,
              roleName,
              attachedPolicies: (data.AttachedPolicies || []).map((p: any) => ({
                policyName: p.PolicyName,
                policyArn: p.PolicyArn,
              })),
            };
          }

          case "list_access_keys": {
            if (!userName) return { success: false, error: "userName required" };
            const data = await runAwsCli([
              "iam", "list-access-keys",
              "--user-name", userName,
            ], region);
            return {
              success: true,
              userName,
              accessKeys: (data.AccessKeyMetadata || []).map((k: any) => ({
                accessKeyId: k.AccessKeyId,
                status: k.Status,
                createDate: k.CreateDate,
              })),
            };
          }

          case "create_access_key": {
            if (!userName) return { success: false, error: "userName required" };
            const data = await runAwsCli([
              "iam", "create-access-key",
              "--user-name", userName,
            ], region);
            return {
              success: true,
              accessKey: {
                accessKeyId: data.AccessKey?.AccessKeyId,
                secretAccessKey: data.AccessKey?.SecretAccessKey,
                status: data.AccessKey?.Status,
                createDate: data.AccessKey?.CreateDate,
              },
              message: "Save the secret access key — it cannot be retrieved later",
            };
          }

          case "update_access_key": {
            if (!userName || !accessKeyId || !status) {
              return { success: false, error: "userName, accessKeyId, and status required" };
            }
            await runAwsCli([
              "iam", "update-access-key",
              "--user-name", userName,
              "--access-key-id", accessKeyId,
              "--status", status,
            ], region);
            return { success: true, userName, accessKeyId, status };
          }

          case "delete_access_key": {
            if (!userName || !accessKeyId) {
              return { success: false, error: "userName and accessKeyId required" };
            }
            await runAwsCli([
              "iam", "delete-access-key",
              "--user-name", userName,
              "--access-key-id", accessKeyId,
            ], region);
            return { success: true, userName, accessKeyId, message: "Access key deleted" };
          }

          case "simulate_principal_policy": {
            if (!policySourceArn || !actionNames?.length) {
              return { success: false, error: "policySourceArn and actionNames required" };
            }
            const data = await runAwsCli([
              "iam", "simulate-principal-policy",
              "--policy-source-arn", policySourceArn,
              "--action-names", ...actionNames,
              ...(resourceArns?.length ? ["--resource-arns", ...resourceArns] : []),
            ], region);
            return {
              success: true,
              results: (data.EvaluationResults || []).map((r: any) => ({
                actionName: r.EvalActionName,
                decision: r.EvalDecision,
                matchedStatements: r.MatchedStatements,
                missingContextValues: r.MissingContextValues,
              })),
            };
          }

          case "get_account_summary": {
            const data = await runAwsCli(["iam", "get-account-summary"], region);
            return { success: true, summary: data.SummaryMap };
          }

          case "list_groups": {
            const data = await runAwsCli(["iam", "list-groups"], region);
            return {
              success: true,
              groups: (data.Groups || []).map((g: any) => ({
                groupName: g.GroupName,
                groupId: g.GroupId,
                arn: g.Arn,
                createDate: g.CreateDate,
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
// SECTION 5 — DynamoDB (NoSQL Database)
// =============================================================================

export const awsDynamoDB = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS DynamoDB: list tables, describe table, get/put/update/delete items, " +
      "query, scan, create/delete table. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_tables",
        "describe_table",
        "get_item",
        "put_item",
        "update_item",
        "delete_item",
        "query",
        "scan",
        "create_table",
        "delete_table",
      ]),
      tableName: z.string().optional().describe("DynamoDB table name"),
      key: z.record(z.any()).optional().describe("Primary key for get/update/delete"),
      item: z.record(z.any()).optional().describe("Item to put"),
      updateExpression: z.string().optional().describe("Update expression"),
      expressionAttributeValues: z.record(z.any()).optional().describe("Expression attribute values"),
      expressionAttributeNames: z.record(z.string()).optional().describe("Expression attribute names"),
      keyConditionExpression: z.string().optional().describe("Key condition for query"),
      filterExpression: z.string().optional().describe("Filter expression"),
      indexName: z.string().optional().describe("Secondary index name"),
      limit: z.number().int().optional().default(100).describe("Max items to return"),
      select: z.enum(["ALL_ATTRIBUTES", "ALL_PROJECTED_ATTRIBUTES", "COUNT", "SPECIFIC_ATTRIBUTES"]).optional(),
      attributesToGet: z.array(z.string()).optional().describe("Attributes to get"),
      consistentRead: z.boolean().optional().default(false),
      scanIndexForward: z.boolean().optional().describe("Sort order for query"),
      // Create table params
      attributeDefinitions: z.array(z.object({
        attributeName: z.string(),
        attributeType: z.enum(["S", "N", "B"]),
      })).optional().describe("Attribute definitions"),
      keySchema: z.array(z.object({
        attributeName: z.string(),
        keyType: z.enum(["HASH", "RANGE"]),
      })).optional().describe("Key schema"),
      billingMode: z.enum(["PROVISIONED", "PAY_PER_REQUEST"]).optional().default("PAY_PER_REQUEST"),
      readCapacity: z.number().int().optional().describe("Read capacity units (provisioned mode)"),
      writeCapacity: z.number().int().optional().describe("Write capacity units (provisioned mode)"),
      region: z.string().optional(),
    }),
    execute: async ({
      action, tableName, key, item, updateExpression,
      expressionAttributeValues, expressionAttributeNames,
      keyConditionExpression, filterExpression, indexName, limit,
      select, attributesToGet, consistentRead, scanIndexForward,
      attributeDefinitions, keySchema, billingMode, readCapacity, writeCapacity,
      region,
    }) => {
      try {
        switch (action) {
          case "list_tables": {
            const data = await runAwsCli(["dynamodb", "list-tables"], region);
            return { success: true, tables: data.TableNames || [] };
          }

          case "describe_table": {
            if (!tableName) return { success: false, error: "tableName required" };
            const data = await runAwsCli(["dynamodb", "describe-table", "--table-name", tableName], region);
            return { success: true, table: data.Table };
          }

          case "get_item": {
            if (!tableName || !key) return { success: false, error: "tableName and key required" };
            const args = [
              "dynamodb", "get-item",
              "--table-name", tableName,
              "--key", JSON.stringify(key),
            ];
            if (consistentRead) args.push("--consistent-read");
            if (attributesToGet?.length) {
              args.push("--attributes-to-get", ...attributesToGet);
            }
            const data = await runAwsCli(args, region);
            return { success: true, item: data.Item || null };
          }

          case "put_item": {
            if (!tableName || !item) return { success: false, error: "tableName and item required" };
            await runAwsCli([
              "dynamodb", "put-item",
              "--table-name", tableName,
              "--item", JSON.stringify(item),
            ], region);
            return { success: true, tableName, message: "Item inserted" };
          }

          case "update_item": {
            if (!tableName || !key || !updateExpression) {
              return { success: false, error: "tableName, key, and updateExpression required" };
            }
            const args = [
              "dynamodb", "update-item",
              "--table-name", tableName,
              "--key", JSON.stringify(key),
              "--update-expression", updateExpression,
            ];
            if (expressionAttributeValues) {
              args.push("--expression-attribute-values", JSON.stringify(expressionAttributeValues));
            }
            if (expressionAttributeNames) {
              args.push("--expression-attribute-names", JSON.stringify(expressionAttributeNames));
            }
            const data = await runAwsCli(args, region);
            return { success: true, attributes: data.Attributes || null };
          }

          case "delete_item": {
            if (!tableName || !key) return { success: false, error: "tableName and key required" };
            await runAwsCli([
              "dynamodb", "delete-item",
              "--table-name", tableName,
              "--key", JSON.stringify(key),
            ], region);
            return { success: true, tableName, message: "Item deleted" };
          }

          case "query": {
            if (!tableName || !keyConditionExpression) {
              return { success: false, error: "tableName and keyConditionExpression required" };
            }
            const args = [
              "dynamodb", "query",
              "--table-name", tableName,
              "--key-condition-expression", keyConditionExpression,
            ];
            if (indexName) args.push("--index-name", indexName);
            if (filterExpression) args.push("--filter-expression", filterExpression);
            if (expressionAttributeValues) {
              args.push("--expression-attribute-values", JSON.stringify(expressionAttributeValues));
            }
            if (expressionAttributeNames) {
              args.push("--expression-attribute-names", JSON.stringify(expressionAttributeNames));
            }
            if (limit) args.push("--limit", String(limit));
            if (select) args.push("--select", select);
            if (consistentRead) args.push("--consistent-read");
            if (scanIndexForward !== undefined) args.push("--scan-index-forward", String(scanIndexForward));
            const data = await runAwsCli(args, region);
            return {
              success: true,
              items: data.Items || [],
              count: data.Count,
              scannedCount: data.ScannedCount,
              lastEvaluatedKey: data.LastEvaluatedKey || null,
            };
          }

          case "scan": {
            if (!tableName) return { success: false, error: "tableName required" };
            const args = ["dynamodb", "scan", "--table-name", tableName];
            if (indexName) args.push("--index-name", indexName);
            if (filterExpression) args.push("--filter-expression", filterExpression);
            if (expressionAttributeValues) {
              args.push("--expression-attribute-values", JSON.stringify(expressionAttributeValues));
            }
            if (expressionAttributeNames) {
              args.push("--expression-attribute-names", JSON.stringify(expressionAttributeNames));
            }
            if (limit) args.push("--limit", String(limit));
            if (select) args.push("--select", select);
            if (consistentRead) args.push("--consistent-read");
            if (attributesToGet?.length) {
              args.push("--attributes-to-get", ...attributesToGet);
            }
            const data = await runAwsCli(args, region);
            return {
              success: true,
              items: data.Items || [],
              count: data.Count,
              scannedCount: data.ScannedCount,
              lastEvaluatedKey: data.LastEvaluatedKey || null,
            };
          }

          case "create_table": {
            if (!tableName || !attributeDefinitions || !keySchema) {
              return { success: false, error: "tableName, attributeDefinitions, and keySchema required" };
            }
            const args = [
              "dynamodb", "create-table",
              "--table-name", tableName,
              "--attribute-definitions", JSON.stringify(attributeDefinitions),
              "--key-schema", JSON.stringify(keySchema),
              "--billing-mode", billingMode || "PAY_PER_REQUEST",
            ];
            if (billingMode === "PROVISIONED" && readCapacity && writeCapacity) {
              args.push("--provisioned-throughput",
                JSON.stringify({ ReadCapacityUnits: readCapacity, WriteCapacityUnits: writeCapacity }));
            }
            const data = await runAwsCli(args, region);
            return { success: true, tableDescription: data.TableDescription };
          }

          case "delete_table": {
            if (!tableName) return { success: false, error: "tableName required" };
            await runAwsCli(["dynamodb", "delete-table", "--table-name", tableName], region);
            return { success: true, tableName, message: `Table '${tableName}' deleted` };
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
// SECTION 6 — RDS (Relational Database Service)
// =============================================================================

export const awsRDS = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS RDS: list/describe/create/delete instances, manage snapshots, " +
      "start/stop instances. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_instances",
        "describe_instance",
        "create_instance",
        "delete_instance",
        "start_instance",
        "stop_instance",
        "reboot_instance",
        "list_snapshots",
        "create_snapshot",
        "delete_snapshot",
        "describe_engine_versions",
      ]),
      dbInstanceIdentifier: z.string().optional().describe("RDS instance identifier"),
      region: z.string().optional(),
      // Create params
      engine: z.string().optional().describe("Engine: mysql, postgres, mariadb, oracle-se2, sqlserver-ex"),
      engineVersion: z.string().optional().describe("Engine version"),
      dbInstanceClass: z.string().optional().default("db.t3.micro").describe("Instance class"),
      allocatedStorage: z.number().int().optional().default(20).describe("Storage in GB"),
      masterUsername: z.string().optional().describe("Master username"),
      masterPassword: z.string().optional().describe("Master password"),
      dbName: z.string().optional().describe("Database name"),
      vpcSecurityGroupIds: z.array(z.string()).optional().describe("VPC security group IDs"),
      publiclyAccessible: z.boolean().optional().default(false),
      multiAZ: z.boolean().optional().default(false),
      storageType: z.enum(["gp2", "gp3", "io1", "io2", "standard"]).optional().default("gp3"),
      autoMinorVersionUpgrade: z.boolean().optional().default(true),
      backupRetentionPeriod: z.number().int().optional().default(7),
      // Snapshot params
      snapshotIdentifier: z.string().optional().describe("Snapshot identifier"),
      // Filters
      filters: z.string().optional().describe("JSON filter string"),
    }),
    execute: async ({
      action, dbInstanceIdentifier, region,
      engine, engineVersion, dbInstanceClass, allocatedStorage,
      masterUsername, masterPassword, dbName, vpcSecurityGroupIds,
      publiclyAccessible, multiAZ, storageType, autoMinorVersionUpgrade,
      backupRetentionPeriod, snapshotIdentifier, filters,
    }) => {
      try {
        switch (action) {
          case "list_instances": {
            const args = ["rds", "describe-db-instances"];
            if (filters) args.push("--filters", filters);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              instances: (data.DBInstances || []).map((i: any) => ({
                identifier: i.DBInstanceIdentifier,
                engine: i.Engine,
                engineVersion: i.EngineVersion,
                status: i.DBInstanceStatus,
                instanceClass: i.DBInstanceClass,
                allocatedStorage: i.AllocatedStorage,
                endpoint: i.Endpoint?.Address,
                port: i.Endpoint?.Port,
                createDate: i.InstanceCreateTime,
                multiAZ: i.MultiAZ,
                storageType: i.StorageType,
                vpcId: i.DBSubnetGroup?.VpcId,
                securityGroups: i.VpcSecurityGroups?.map((sg: any) => sg.VpcSecurityGroupId),
                publiclyAccessible: i.PubliclyAccessible,
                autoMinorVersionUpgrade: i.AutoMinorVersionUpgrade,
                backupRetentionPeriod: i.BackupRetentionPeriod,
                preferredBackupWindow: i.PreferredBackupWindow,
                preferredMaintenanceWindow: i.PreferredMaintenanceWindow,
                latestRestorableTime: i.LatestRestorableTime,
                dbName: i.DBName,
                masterUsername: i.MasterUsername,
                tags: (i.TagList || []).reduce((acc: Record<string, string>, t: any) => {
                  acc[t.Key] = t.Value;
                  return acc;
                }, {}),
              })),
            };
          }

          case "describe_instance": {
            if (!dbInstanceIdentifier) return { success: false, error: "dbInstanceIdentifier required" };
            const data = await runAwsCli([
              "rds", "describe-db-instances",
              "--db-instance-identifier", dbInstanceIdentifier,
            ], region);
            return { success: true, instance: data.DBInstances?.[0] || null };
          }

          case "create_instance": {
            if (!dbInstanceIdentifier || !engine || !masterUsername || !masterPassword) {
              return { success: false, error: "dbInstanceIdentifier, engine, masterUsername, masterPassword required" };
            }
            const args = [
              "rds", "create-db-instance",
              "--db-instance-identifier", dbInstanceIdentifier,
              "--engine", engine,
              "--db-instance-class", dbInstanceClass || "db.t3.micro",
              "--allocated-storage", String(allocatedStorage || 20),
              "--master-username", masterUsername,
              "--master-user-password", masterPassword,
            ];
            if (dbName) args.push("--db-name", dbName);
            if (engineVersion) args.push("--engine-version", engineVersion);
            if (vpcSecurityGroupIds?.length) {
              args.push("--vpc-security-group-ids", ...vpcSecurityGroupIds);
            }
            if (publiclyAccessible) args.push("--publicly-accessible");
            if (multiAZ) args.push("--multi-az");
            if (storageType) args.push("--storage-type", storageType);
            if (autoMinorVersionUpgrade !== undefined) {
              args.push("--auto-minor-version-upgrade", String(autoMinorVersionUpgrade));
            }
            if (backupRetentionPeriod !== undefined) {
              args.push("--backup-retention-period", String(backupRetentionPeriod));
            }
            const data = await runAwsCli(args, region);
            return { success: true, instance: data.DBInstance };
          }

          case "delete_instance": {
            if (!dbInstanceIdentifier) return { success: false, error: "dbInstanceIdentifier required" };
            const data = await runAwsCli([
              "rds", "delete-db-instance",
              "--db-instance-identifier", dbInstanceIdentifier,
              "--skip-final-snapshot",
            ], region);
            return { success: true, instance: data.DBInstance, message: "Deletion initiated" };
          }

          case "start_instance": {
            if (!dbInstanceIdentifier) return { success: false, error: "dbInstanceIdentifier required" };
            const data = await runAwsCli([
              "rds", "start-db-instance",
              "--db-instance-identifier", dbInstanceIdentifier,
            ], region);
            return { success: true, status: data.DBInstance?.DBInstanceStatus };
          }

          case "stop_instance": {
            if (!dbInstanceIdentifier) return { success: false, error: "dbInstanceIdentifier required" };
            const data = await runAwsCli([
              "rds", "stop-db-instance",
              "--db-instance-identifier", dbInstanceIdentifier,
            ], region);
            return { success: true, status: data.DBInstance?.DBInstanceStatus };
          }

          case "reboot_instance": {
            if (!dbInstanceIdentifier) return { success: false, error: "dbInstanceIdentifier required" };
            const data = await runAwsCli([
              "rds", "reboot-db-instance",
              "--db-instance-identifier", dbInstanceIdentifier,
            ], region);
            return { success: true, status: data.DBInstance?.DBInstanceStatus };
          }

          case "list_snapshots": {
            const args = ["rds", "describe-db-snapshots"];
            if (dbInstanceIdentifier) args.push("--db-instance-identifier", dbInstanceIdentifier);
            if (snapshotIdentifier) args.push("--db-snapshot-identifier", snapshotIdentifier);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              snapshots: (data.DBSnapshots || []).map((s: any) => ({
                identifier: s.DBSnapshotIdentifier,
                instanceIdentifier: s.DBInstanceIdentifier,
                status: s.Status,
                createDate: s.SnapshotCreateTime,
                engine: s.Engine,
                allocatedStorage: s.AllocatedStorage,
                instanceClass: s.DBInstanceClass,
                snapshotType: s.SnapshotType,
                percentProgress: s.PercentProgress,
                encrypted: s.Encrypted,
              })),
            };
          }

          case "create_snapshot": {
            if (!dbInstanceIdentifier || !snapshotIdentifier) {
              return { success: false, error: "dbInstanceIdentifier and snapshotIdentifier required" };
            }
            const data = await runAwsCli([
              "rds", "create-db-snapshot",
              "--db-instance-identifier", dbInstanceIdentifier,
              "--db-snapshot-identifier", snapshotIdentifier,
            ], region);
            return { success: true, snapshot: data.DBSnapshot };
          }

          case "delete_snapshot": {
            if (!snapshotIdentifier) return { success: false, error: "snapshotIdentifier required" };
            const data = await runAwsCli([
              "rds", "delete-db-snapshot",
              "--db-snapshot-identifier", snapshotIdentifier,
            ], region);
            return { success: true, snapshot: data.DBSnapshot };
          }

          case "describe_engine_versions": {
            const args = ["rds", "describe-db-engine-versions"];
            if (engine) args.push("--engine", engine);
            if (engineVersion) args.push("--engine-version", engineVersion);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              engineVersions: (data.DBEngineVersions || []).map((v: any) => ({
                engine: v.Engine,
                engineVersion: v.EngineVersion,
                description: v.DBEngineDescription,
                engineDescription: v.DBEngineVersionDescription,
                validUpgradeTarget: v.ValidUpgradeTarget?.length > 0,
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
// SECTION 7 — SES (Email)
// =============================================================================

export const awsSES = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS SES: send email, verify identities, list identities, get send quota. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "send_email",
        "verify_email",
        "verify_domain",
        "list_identities",
        "delete_identity",
        "get_send_quota",
        "get_send_statistics",
      ]),
      source: z.string().optional().describe("From email address"),
      toAddresses: z.array(z.string()).optional().describe("Recipient email addresses"),
      ccAddresses: z.array(z.string()).optional().describe("CC recipients"),
      bccAddresses: z.array(z.string()).optional().describe("BCC recipients"),
      subject: z.string().optional().describe("Email subject"),
      bodyText: z.string().optional().describe("Plain text body"),
      bodyHtml: z.string().optional().describe("HTML body"),
      replyToAddresses: z.array(z.string()).optional().describe("Reply-to addresses"),
      returnPath: z.string().optional().describe("Return path / bounce address"),
      configurationSetName: z.string().optional().describe("SES configuration set"),
      identity: z.string().optional().describe("Email or domain identity"),
      region: z.string().optional(),
    }),
    execute: async ({
      action, source, toAddresses, ccAddresses, bccAddresses,
      subject, bodyText, bodyHtml, replyToAddresses, returnPath,
      configurationSetName, identity, region,
    }) => {
      try {
        switch (action) {
          case "send_email": {
            if (!source || !toAddresses?.length || !subject) {
              return { success: false, error: "source, toAddresses, and subject required" };
            }
            const message: any = {
              Subject: { Data: subject },
            };
            if (bodyText) message.Body = { ...message.Body, Text: { Data: bodyText } };
            if (bodyHtml) message.Body = { ...message.Body, Html: { Data: bodyHtml } };
            if (!bodyText && !bodyHtml) {
              message.Body = { Text: { Data: subject } };
            }

            const args = [
              "ses", "send-email",
              "--source", source,
              "--destination", JSON.stringify({
                ToAddresses: toAddresses,
                ...(ccAddresses?.length ? { CcAddresses: ccAddresses } : {}),
                ...(bccAddresses?.length ? { BccAddresses: bccAddresses } : {}),
              }),
              "--message", JSON.stringify(message),
            ];
            if (replyToAddresses?.length) {
              args.push("--reply-to-addresses", ...replyToAddresses);
            }
            if (returnPath) args.push("--return-path", returnPath);
            if (configurationSetName) args.push("--configuration-set-name", configurationSetName);
            const data = await runAwsCli(args, region);
            return { success: true, messageId: data.MessageId };
          }

          case "verify_email": {
            if (!identity) return { success: false, error: "identity (email) required" };
            await runAwsCli(["ses", "verify-email-identity", "--email-address", identity], region);
            return { success: true, email: identity, message: "Verification email sent" };
          }

          case "verify_domain": {
            if (!identity) return { success: false, error: "identity (domain) required" };
            const data = await runAwsCli(["ses", "verify-domain-identity", "--domain", identity], region);
            return {
              success: true,
              domain: identity,
              verificationToken: data.VerificationToken,
              message: "Add this TXT record to your DNS",
            };
          }

          case "list_identities": {
            const data = await runAwsCli(["ses", "list-identities"], region);
            return { success: true, identities: data.Identities || [] };
          }

          case "delete_identity": {
            if (!identity) return { success: false, error: "identity required" };
            await runAwsCli(["ses", "delete-identity", "--identity", identity], region);
            return { success: true, identity, message: "Identity deleted" };
          }

          case "get_send_quota": {
            const data = await runAwsCli(["ses", "get-send-quota"], region);
            return {
              success: true,
              max24HourSend: data.Max24HourSend,
              maxSendRate: data.MaxSendRate,
              sentLast24Hours: data.SentLast24Hours,
            };
          }

          case "get_send_statistics": {
            const data = await runAwsCli(["ses", "get-send-statistics"], region);
            return {
              success: true,
              statistics: (data.SendDataPoints || []).map((p: any) => ({
                timestamp: p.Timestamp,
                deliveryAttempts: p.DeliveryAttempts,
                bounces: p.Bounces,
                complaints: p.Complaints,
                rejects: p.Rejects,
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
// SECTION 8 — CloudFormation (Infrastructure as Code)
// =============================================================================

export const awsCloudFormation = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS CloudFormation: list/describe/create/update/delete stacks, " +
      "list stack resources, get stack events. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_stacks",
        "describe_stack",
        "create_stack",
        "update_stack",
        "delete_stack",
        "list_stack_resources",
        "list_stack_events",
        "describe_change_set",
        "list_exports",
      ]),
      stackName: z.string().optional().describe("CloudFormation stack name"),
      region: z.string().optional(),
      templateBody: z.string().optional().describe("CloudFormation template JSON/YAML"),
      templateURL: z.string().optional().describe("S3 URL to template"),
      parameters: z.array(z.object({
        parameterKey: z.string(),
        parameterValue: z.string(),
      })).optional().describe("Stack parameters"),
      capabilities: z.array(z.enum(["CAPABILITY_IAM", "CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"])).optional(),
      roleARN: z.string().optional().describe("IAM role ARN for stack operations"),
      tags: z.record(z.string(), z.string()).optional().describe("Stack tags"),
      changeSetName: z.string().optional().describe("Change set name"),
      stackStatusFilter: z.array(z.string()).optional().describe("Filter by status"),
    }),
    execute: async ({
      action, stackName, region, templateBody, templateURL,
      parameters, capabilities, roleARN, tags, changeSetName, stackStatusFilter,
    }) => {
      try {
        switch (action) {
          case "list_stacks": {
            const args = ["cloudformation", "list-stacks"];
            if (stackStatusFilter?.length) {
              args.push("--stack-status-filter", ...stackStatusFilter);
            }
            const data = await runAwsCli(args, region);
            return {
              success: true,
              stacks: (data.StackSummaries || []).map((s: any) => ({
                name: s.StackName,
                id: s.StackId,
                status: s.StackStatus,
                statusReason: s.StackStatusReason,
                createDate: s.CreationTime,
                lastUpdatedDate: s.LastUpdatedTime,
                parentId: s.ParentId,
                rootId: s.RootId,
                driftInfo: s.DriftInformation,
              })),
            };
          }

          case "describe_stack": {
            if (!stackName) return { success: false, error: "stackName required" };
            const data = await runAwsCli([
              "cloudformation", "describe-stacks",
              "--stack-name", stackName,
            ], region);
            return { success: true, stack: data.Stacks?.[0] || null };
          }

          case "create_stack": {
            if (!stackName) return { success: false, error: "stackName required" };
            if (!templateBody && !templateURL) {
              return { success: false, error: "templateBody or templateURL required" };
            }
            const args = [
              "cloudformation", "create-stack",
              "--stack-name", stackName,
            ];
            if (templateBody) args.push("--template-body", templateBody);
            if (templateURL) args.push("--template-url", templateURL);
            if (parameters?.length) {
              args.push("--parameters", ...parameters.flatMap((p) => [
                `ParameterKey=${p.parameterKey},ParameterValue=${p.parameterValue}`,
              ]));
            }
            if (capabilities?.length) args.push("--capabilities", ...capabilities);
            if (roleARN) args.push("--role-arn", roleARN);
            if (tags) {
              args.push("--tags", ...Object.entries(tags).map(([k, v]) => `Key=${k},Value=${v}`));
            }
            const data = await runAwsCli(args, region);
            return { success: true, stackId: data.StackId, message: "Stack creation initiated" };
          }

          case "update_stack": {
            if (!stackName) return { success: false, error: "stackName required" };
            const args = [
              "cloudformation", "update-stack",
              "--stack-name", stackName,
            ];
            if (templateBody) args.push("--template-body", templateBody);
            if (templateURL) args.push("--template-url", templateURL);
            if (parameters?.length) {
              args.push("--parameters", ...parameters.flatMap((p) => [
                `ParameterKey=${p.parameterKey},ParameterValue=${p.parameterValue}`,
              ]));
            }
            if (capabilities?.length) args.push("--capabilities", ...capabilities);
            if (roleARN) args.push("--role-arn", roleARN);
            if (tags) {
              args.push("--tags", ...Object.entries(tags).map(([k, v]) => `Key=${k},Value=${v}`));
            }
            const data = await runAwsCli(args, region);
            return { success: true, stackId: data.StackId, message: "Stack update initiated" };
          }

          case "delete_stack": {
            if (!stackName) return { success: false, error: "stackName required" };
            await runAwsCli(["cloudformation", "delete-stack", "--stack-name", stackName], region);
            return { success: true, stackName, message: "Stack deletion initiated" };
          }

          case "list_stack_resources": {
            if (!stackName) return { success: false, error: "stackName required" };
            const data = await runAwsCli([
              "cloudformation", "describe-stack-resources",
              "--stack-name", stackName,
            ], region);
            return {
              success: true,
              resources: (data.StackResources || []).map((r: any) => ({
                logicalId: r.LogicalResourceId,
                physicalId: r.PhysicalResourceId,
                type: r.ResourceType,
                status: r.ResourceStatus,
                statusReason: r.ResourceStatusReason,
                lastUpdated: r.LastUpdatedTimestamp,
              })),
            };
          }

          case "list_stack_events": {
            if (!stackName) return { success: false, error: "stackName required" };
            const data = await runAwsCli([
              "cloudformation", "describe-stack-events",
              "--stack-name", stackName,
            ], region);
            return {
              success: true,
              events: (data.StackEvents || []).map((e: any) => ({
                eventId: e.EventId,
                stackName: e.StackName,
                logicalId: e.LogicalResourceId,
                physicalId: e.PhysicalResourceId,
                resourceType: e.ResourceType,
                timestamp: e.Timestamp,
                resourceStatus: e.ResourceStatus,
                resourceStatusReason: e.ResourceStatusReason,
              })),
            };
          }

          case "describe_change_set": {
            if (!changeSetName || !stackName) {
              return { success: false, error: "changeSetName and stackName required" };
            }
            const data = await runAwsCli([
              "cloudformation", "describe-change-set",
              "--change-set-name", changeSetName,
              "--stack-name", stackName,
            ], region);
            return { success: true, changeSet: data };
          }

          case "list_exports": {
            const data = await runAwsCli(["cloudformation", "list-exports"], region);
            return {
              success: true,
              exports: (data.Exports || []).map((e: any) => ({
                name: e.Name,
                value: e.Value,
                stackId: e.ExportingStackId,
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
// SECTION 9 — SQS (Simple Queue Service)
// =============================================================================

export const awsSQS = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS SQS: list queues, send/receive/delete messages, create/delete queues, " +
      "get/set queue attributes. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_queues",
        "create_queue",
        "delete_queue",
        "send_message",
        "receive_message",
        "delete_message",
        "purge_queue",
        "get_queue_attributes",
        "set_queue_attributes",
        "get_queue_url",
      ]),
      queueName: z.string().optional().describe("Queue name"),
      queueUrl: z.string().optional().describe("Queue URL"),
      messageBody: z.string().optional().describe("Message body"),
      messageGroupId: z.string().optional().describe("Message group ID (FIFO)"),
      messageDeduplicationId: z.string().optional().describe("Message deduplication ID (FIFO)"),
      delaySeconds: z.number().int().optional().describe("Delay in seconds"),
      visibilityTimeout: z.number().int().optional().describe("Visibility timeout in seconds"),
      maxNumberOfMessages: z.number().int().optional().default(1).describe("Max messages to receive (1-10)"),
      waitTimeSeconds: z.number().int().optional().describe("Wait time for long polling"),
      receiptHandle: z.string().optional().describe("Receipt handle for delete"),
      attributes: z.record(z.string(), z.string()).optional().describe("Queue attributes"),
      region: z.string().optional(),
    }),
    execute: async ({
      action, queueName, queueUrl, messageBody, messageGroupId,
      messageDeduplicationId, delaySeconds, visibilityTimeout,
      maxNumberOfMessages, waitTimeSeconds, receiptHandle, attributes, region,
    }) => {
      try {
        switch (action) {
          case "list_queues": {
            const data = await runAwsCli(["sqs", "list-queues"], region);
            return { success: true, queueUrls: data.QueueUrls || [] };
          }

          case "create_queue": {
            if (!queueName) return { success: false, error: "queueName required" };
            const args = ["sqs", "create-queue", "--queue-name", queueName];
            if (attributes) {
              args.push("--attributes", JSON.stringify(attributes));
            }
            const data = await runAwsCli(args, region);
            return { success: true, queueUrl: data.QueueUrl };
          }

          case "delete_queue": {
            if (!queueUrl) return { success: false, error: "queueUrl required" };
            await runAwsCli(["sqs", "delete-queue", "--queue-url", queueUrl], region);
            return { success: true, queueUrl, message: "Queue deleted" };
          }

          case "send_message": {
            if (!queueUrl || !messageBody) {
              return { success: false, error: "queueUrl and messageBody required" };
            }
            const args = [
              "sqs", "send-message",
              "--queue-url", queueUrl,
              "--message-body", messageBody,
            ];
            if (messageGroupId) args.push("--message-group-id", messageGroupId);
            if (messageDeduplicationId) args.push("--message-deduplication-id", messageDeduplicationId);
            if (delaySeconds !== undefined) args.push("--delay-seconds", String(delaySeconds));
            const data = await runAwsCli(args, region);
            return {
              success: true,
              messageId: data.MessageId,
              md5OfBody: data.MD5OfMessageBody,
              sequenceNumber: data.SequenceNumber,
            };
          }

          case "receive_message": {
            if (!queueUrl) return { success: false, error: "queueUrl required" };
            const args = [
              "sqs", "receive-message",
              "--queue-url", queueUrl,
              "--max-number-of-messages", String(maxNumberOfMessages || 1),
            ];
            if (visibilityTimeout !== undefined) {
              args.push("--visibility-timeout", String(visibilityTimeout));
            }
            if (waitTimeSeconds !== undefined) {
              args.push("--wait-time-seconds", String(waitTimeSeconds));
            }
            const data = await runAwsCli(args, region);
            return {
              success: true,
              messages: (data.Messages || []).map((m: any) => ({
                messageId: m.MessageId,
                receiptHandle: m.ReceiptHandle,
                body: m.Body,
                md5OfBody: m.MD5OfBody,
                attributes: m.Attributes,
                messageAttributes: m.MessageAttributes,
              })),
            };
          }

          case "delete_message": {
            if (!queueUrl || !receiptHandle) {
              return { success: false, error: "queueUrl and receiptHandle required" };
            }
            await runAwsCli([
              "sqs", "delete-message",
              "--queue-url", queueUrl,
              "--receipt-handle", receiptHandle,
            ], region);
            return { success: true, message: "Message deleted" };
          }

          case "purge_queue": {
            if (!queueUrl) return { success: false, error: "queueUrl required" };
            await runAwsCli(["sqs", "purge-queue", "--queue-url", queueUrl], region);
            return { success: true, queueUrl, message: "Queue purged" };
          }

          case "get_queue_attributes": {
            if (!queueUrl) return { success: false, error: "queueUrl required" };
            const data = await runAwsCli([
              "sqs", "get-queue-attributes",
              "--queue-url", queueUrl,
              "--attribute-names", "All",
            ], region);
            return { success: true, attributes: data.Attributes };
          }

          case "set_queue_attributes": {
            if (!queueUrl || !attributes) {
              return { success: false, error: "queueUrl and attributes required" };
            }
            await runAwsCli([
              "sqs", "set-queue-attributes",
              "--queue-url", queueUrl,
              "--attributes", JSON.stringify(attributes),
            ], region);
            return { success: true, queueUrl, message: "Attributes updated" };
          }

          case "get_queue_url": {
            if (!queueName) return { success: false, error: "queueName required" };
            const data = await runAwsCli(["sqs", "get-queue-url", "--queue-name", queueName], region);
            return { success: true, queueUrl: data.QueueUrl };
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
// SECTION 10 — CloudWatch (Monitoring)
// =============================================================================

export const awsCloudWatch = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Manage AWS CloudWatch: list metrics, get metric data, put custom metrics, " +
      "list/describe alarms, set alarm state. Uses AWS CLI.",
    inputSchema: z.object({
      action: z.enum([
        "list_metrics",
        "get_metric_data",
        "put_metric_data",
        "list_alarms",
        "describe_alarm",
        "set_alarm_state",
        "list_dashboards",
        "get_dashboard",
      ]),
      namespace: z.string().optional().describe("Metric namespace (e.g. AWS/EC2, Custom/App)"),
      metricName: z.string().optional().describe("Metric name"),
      dimensions: z.array(z.object({
        name: z.string(),
        value: z.string(),
      })).optional().describe("Metric dimensions"),
      startTime: z.string().optional().describe("Start time (ISO 8601)"),
      endTime: z.string().optional().describe("End time (ISO 8601)"),
      period: z.number().int().optional().default(300).describe("Period in seconds"),
      stat: z.string().optional().default("Average").describe("Statistic: Average, Sum, Maximum, Minimum, SampleCount"),
      value: z.number().optional().describe("Metric value for put_metric_data"),
      unit: z.string().optional().describe("Metric unit (e.g. Count, Bytes, Seconds, Percent)"),
      alarmName: z.string().optional().describe("Alarm name"),
      alarmState: z.enum(["OK", "ALARM", "INSUFFICIENT_DATA"]).optional().describe("New alarm state"),
      stateReason: z.string().optional().describe("Reason for state change"),
      dashboardName: z.string().optional().describe("CloudWatch dashboard name"),
      region: z.string().optional(),
    }),
    execute: async ({
      action, namespace, metricName, dimensions, startTime, endTime,
      period, stat, value, unit, alarmName, alarmState, stateReason,
      dashboardName, region,
    }) => {
      try {
        switch (action) {
          case "list_metrics": {
            const args = ["cloudwatch", "list-metrics"];
            if (namespace) args.push("--namespace", namespace);
            if (metricName) args.push("--metric-name", metricName);
            if (dimensions?.length) {
              args.push("--dimensions", ...dimensions.map((d) => `Name=${d.name},Value=${d.value}`));
            }
            const data = await runAwsCli(args, region);
            return {
              success: true,
              metrics: (data.Metrics || []).map((m: any) => ({
                namespace: m.Namespace,
                metricName: m.MetricName,
                dimensions: m.Dimensions?.map((d: any) => ({ name: d.Name, value: d.Value })),
              })),
            };
          }

          case "get_metric_data": {
            if (!namespace || !metricName) {
              return { success: false, error: "namespace and metricName required" };
            }
            const now = new Date();
            const end = endTime || now.toISOString();
            const start = startTime || new Date(now.getTime() - 3600000).toISOString();
            const queryId = "m1";
            const args = [
              "cloudwatch", "get-metric-data",
              "--metric-data-queries", JSON.stringify([{
                Id: queryId,
                MetricStat: {
                  Metric: {
                    Namespace: namespace,
                    MetricName: metricName,
                    Dimensions: dimensions?.map((d) => ({ Name: d.name, Value: d.value })),
                  },
                  Period: period || 300,
                  Stat: stat || "Average",
                },
                ReturnData: true,
              }]),
              "--start-time", start,
              "--end-time", end,
            ];
            const data = await runAwsCli(args, region);
            return {
              success: true,
              timestamps: data.MetricDataResults?.[0]?.Timestamps || [],
              values: data.MetricDataResults?.[0]?.Values || [],
              label: data.MetricDataResults?.[0]?.Label,
              statusCode: data.MetricDataResults?.[0]?.StatusCode,
            };
          }

          case "put_metric_data": {
            if (!namespace || !metricName || value === undefined) {
              return { success: false, error: "namespace, metricName, and value required" };
            }
            const metricData = [{
              MetricName: metricName,
              Value: value,
              Unit: unit || "Count",
              Dimensions: dimensions?.map((d) => ({ Name: d.name, Value: d.value })),
              Timestamp: new Date().toISOString(),
            }];
            await runAwsCli([
              "cloudwatch", "put-metric-data",
              "--namespace", namespace,
              "--metric-data", JSON.stringify(metricData),
            ], region);
            return { success: true, namespace, metricName, value, unit: unit || "Count" };
          }

          case "list_alarms": {
            const args = ["cloudwatch", "describe-alarms"];
            if (alarmName) args.push("--alarm-names", alarmName);
            const data = await runAwsCli(args, region);
            return {
              success: true,
              compositeAlarms: (data.CompositeAlarms || []).map((a: any) => ({
                name: a.AlarmName,
                arn: a.AlarmArn,
                state: a.StateValue,
                stateReason: a.StateReason,
                lastUpdated: a.StateUpdatedTimestamp,
              })),
              metricAlarms: (data.MetricAlarms || []).map((a: any) => ({
                name: a.AlarmName,
                arn: a.AlarmArn,
                state: a.StateValue,
                stateReason: a.StateReason,
                metricName: a.MetricName,
                namespace: a.Namespace,
                statistic: a.Statistic,
                period: a.Period,
                evaluationPeriods: a.EvaluationPeriods,
                threshold: a.Threshold,
                comparisonOperator: a.ComparisonOperator,
                lastUpdated: a.StateUpdatedTimestamp,
                actionsEnabled: a.ActionsEnabled,
                alarmActions: a.AlarmActions,
                okActions: a.OKActions,
                insufficientDataActions: a.InsufficientDataActions,
              })),
            };
          }

          case "describe_alarm": {
            if (!alarmName) return { success: false, error: "alarmName required" };
            const data = await runAwsCli([
              "cloudwatch", "describe-alarms",
              "--alarm-names", alarmName,
            ], region);
            return { success: true, alarm: data.MetricAlarms?.[0] || data.CompositeAlarms?.[0] || null };
          }

          case "set_alarm_state": {
            if (!alarmName || !alarmState) {
              return { success: false, error: "alarmName and alarmState required" };
            }
            await runAwsCli([
              "cloudwatch", "set-alarm-state",
              "--alarm-name", alarmName,
              "--state-value", alarmState,
              "--state-reason", stateReason || "Updated by Etles agent",
            ], region);
            return { success: true, alarmName, newState: alarmState };
          }

          case "list_dashboards": {
            const data = await runAwsCli(["cloudwatch", "list-dashboards"], region);
            return {
              success: true,
              dashboards: (data.DashboardEntries || []).map((d: any) => ({
                name: d.DashboardName,
                arn: d.DashboardArn,
                lastModified: d.LastModified,
                size: d.Size,
              })),
            };
          }

          case "get_dashboard": {
            if (!dashboardName) return { success: false, error: "dashboardName required" };
            const data = await runAwsCli([
              "cloudwatch", "get-dashboard",
              "--dashboard-name", dashboardName,
            ], region);
            return {
              success: true,
              name: data.DashboardName,
              body: data.DashboardBody ? JSON.parse(data.DashboardBody) : null,
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
// SECTION 11 — STS (Security Token Service)
// =============================================================================

export const awsSTS = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Get AWS caller identity and account information. " +
      "Useful for verifying which account/role the agent is operating under.",
    inputSchema: z.object({
      action: z.enum(["get_caller_identity"]),
      region: z.string().optional(),
    }),
    execute: async ({ action, region }) => {
      try {
        switch (action) {
          case "get_caller_identity": {
            const client = getSTSClient(region);
            const data = await client.send(new GetCallerIdentityCommand({}));
            return {
              success: true,
              userId: data.UserId,
              account: data.Account,
              arn: data.Arn,
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
// EXPORT ALL — 11 tools
// =============================================================================

export const allAwsTools = (ctx: { userId: string }) => ({
  awsS3: awsS3(ctx),
  awsEC2: awsEC2(ctx),
  awsLambda: awsLambda(ctx),
  awsIAM: awsIAM(ctx),
  awsDynamoDB: awsDynamoDB(ctx),
  awsRDS: awsRDS(ctx),
  awsSES: awsSES(ctx),
  awsCloudFormation: awsCloudFormation(ctx),
  awsSQS: awsSQS(ctx),
  awsCloudWatch: awsCloudWatch(ctx),
  awsSTS: awsSTS(ctx),
});