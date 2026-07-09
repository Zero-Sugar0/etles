import { tool } from "ai";
import { z } from "zod";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";

export const postgresQuery = ({ userId }: { userId: string }) =>
  tool({
    description: "Execute a PostgreSQL query. Requires a connection string.",
    inputSchema: z.object({
      connectionString: z.string().describe("PostgreSQL connection string (postgres://...)"),
      query: z.string().describe("SQL query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
    }),
    execute: async ({ connectionString, query, params }) => {
      const client = new Client({ connectionString });
      try {
        await client.connect();
        const res = await client.query(query, params);
        return { success: true, rows: res.rows, rowCount: res.rowCount };
      } catch (error: any) {
        return { success: false, error: error.message };
      } finally {
        await client.end();
      }
    },
  });

export const mysqlQuery = ({ userId }: { userId: string }) =>
  tool({
    description: "Execute a MySQL query. Requires connection details.",
    inputSchema: z.object({
      uri: z.string().describe("MySQL connection URI (mysql://...)"),
      query: z.string().describe("SQL query to execute"),
      params: z.array(z.any()).optional().describe("Query parameters"),
    }),
    execute: async ({ uri, query, params }) => {
      try {
        const connection = await mysql.createConnection(uri);
        const [rows] = await connection.execute(query, params);
        await connection.end();
        return { success: true, rows };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },
  });

export const mongodbQuery = ({ userId }: { userId: string }) =>
  tool({
    description: "Execute a MongoDB operation. Requires a connection URI.",
    inputSchema: z.object({
      uri: z.string().describe("MongoDB connection URI (mongodb://...)"),
      database: z.string().describe("Database name"),
      collection: z.string().describe("Collection name"),
      action: z.enum(["find", "insertOne", "updateMany", "deleteMany", "aggregate"]),
      filter: z.record(z.any()).optional().describe("Filter for find/update/delete"),
      document: z.record(z.any()).optional().describe("Document for insert"),
      update: z.record(z.any()).optional().describe("Update operations"),
      pipeline: z.array(z.record(z.any())).optional().describe("Aggregation pipeline"),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ uri, database, collection, action, filter, document, update, pipeline, limit }) => {
      const client = new MongoClient(uri);
      try {
        await client.connect();
        const db = client.db(database);
        const coll = db.collection(collection);
        let result;
        switch (action) {
          case "find":
            result = await coll.find(filter || {}).limit(limit).toArray();
            break;
          case "insertOne":
            if (!document) throw new Error("Document required for insertOne");
            result = await coll.insertOne(document);
            break;
          case "updateMany":
            if (!update) throw new Error("Update operations required for updateMany");
            result = await coll.updateMany(filter || {}, update);
            break;
          case "deleteMany":
            result = await coll.deleteMany(filter || {});
            break;
          case "aggregate":
            if (!pipeline) throw new Error("Pipeline required for aggregate");
            result = await coll.aggregate(pipeline).toArray();
            break;
        }
        return { success: true, result };
      } catch (error: any) {
        return { success: false, error: error.message };
      } finally {
        await client.close();
      }
    },
  });
