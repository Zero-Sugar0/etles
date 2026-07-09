import { tool } from "ai";
import { z } from "zod";
import { S3Client, ListBucketsCommand, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { EC2Client, DescribeInstancesCommand, StartInstancesCommand, StopInstancesCommand } from "@aws-sdk/client-ec2";
import { LambdaClient, ListFunctionsCommand, InvokeCommand } from "@aws-sdk/client-lambda";

function getS3Client(region?: string) {
  return new S3Client({ region: region || process.env.AWS_REGION || "us-east-1" });
}

function getEC2Client(region?: string) {
  return new EC2Client({ region: region || process.env.AWS_REGION || "us-east-1" });
}

function getLambdaClient(region?: string) {
  return new LambdaClient({ region: region || process.env.AWS_REGION || "us-east-1" });
}

export const awsS3 = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage AWS S3: list buckets, list objects, upload, download.",
    inputSchema: z.object({
      action: z.enum(["list_buckets", "list_objects", "upload", "download"]),
      bucket: z.string().optional(),
      key: z.string().optional(),
      content: z.string().optional().describe("Content for upload (string or base64)"),
      region: z.string().optional(),
    }),
    execute: async ({ action, bucket, key, content, region }) => {
      const client = getS3Client(region);
      try {
        switch (action) {
          case "list_buckets": {
            const data = await client.send(new ListBucketsCommand({}));
            return { success: true, buckets: data.Buckets };
          }
          case "list_objects": {
            if (!bucket) return { success: false, error: "Bucket name required" };
            const data = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
            return { success: true, objects: data.Contents };
          }
          case "upload": {
            if (!bucket || !key || content === undefined) return { success: false, error: "Bucket, key, and content required" };
            await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content }));
            return { success: true, message: `Uploaded to ${bucket}/${key}` };
          }
          case "download": {
            if (!bucket || !key) return { success: false, error: "Bucket and key required" };
            const data = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
            const body = await data.Body?.transformToString();
            return { success: true, content: body };
          }
          default:
            return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const awsEC2 = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage AWS EC2: list instances, start, stop.",
    inputSchema: z.object({
      action: z.enum(["list_instances", "start", "stop"]),
      instanceIds: z.array(z.string()).optional(),
      region: z.string().optional(),
    }),
    execute: async ({ action, instanceIds, region }) => {
      const client = getEC2Client(region);
      try {
        switch (action) {
          case "list_instances": {
            const data = await client.send(new DescribeInstancesCommand({}));
            const instances = data.Reservations?.flatMap(r => r.Instances || []);
            return { success: true, instances };
          }
          case "start": {
            if (!instanceIds?.length) return { success: false, error: "Instance IDs required" };
            const data = await client.send(new StartInstancesCommand({ InstanceIds: instanceIds }));
            return { success: true, starting: data.StartingInstances };
          }
          case "stop": {
            if (!instanceIds?.length) return { success: false, error: "Instance IDs required" };
            const data = await client.send(new StopInstancesCommand({ InstanceIds: instanceIds }));
            return { success: true, stopping: data.StoppingInstances };
          }
          default:
            return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const awsLambda = ({ userId }: { userId: string }) =>
  tool({
    description: "Manage AWS Lambda: list functions, invoke.",
    inputSchema: z.object({
      action: z.enum(["list_functions", "invoke"]),
      functionName: z.string().optional(),
      payload: z.string().optional().describe("JSON payload for invocation"),
      region: z.string().optional(),
    }),
    execute: async ({ action, functionName, payload, region }) => {
      const client = getLambdaClient(region);
      try {
        switch (action) {
          case "list_functions": {
            const data = await client.send(new ListFunctionsCommand({}));
            return { success: true, functions: data.Functions };
          }
          case "invoke": {
            if (!functionName) return { success: false, error: "Function name required" };
            const data = await client.send(new InvokeCommand({
              FunctionName: functionName,
              Payload: payload ? Buffer.from(payload) : undefined,
            }));
            const result = data.Payload ? Buffer.from(data.Payload).toString() : null;
            return { success: true, result, statusCode: data.StatusCode };
          }
          default:
            return { success: false, error: "Invalid action" };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });
