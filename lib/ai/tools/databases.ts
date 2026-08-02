import { tool } from "ai";
import { z } from "zod";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { MongoClient } from "mongodb";

// =============================================================================
// SECTION 1 — PostgreSQL
// =============================================================================

export const postgresQuery = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Execute PostgreSQL operations: run queries, list tables/schemas/databases, describe tables, " +
      "analyze queries, get table stats, manage indexes, extensions, and connections. " +
      "Provide a connectionString (postgres://user:pass@host:5432/db).",
    inputSchema: z.object({
      action: z.enum([
        "query",
        "list_databases",
        "list_schemas",
        "list_tables",
        "describe_table",
        "list_indexes",
        "get_table_stats",
        "analyze_query",
        "list_extensions",
        "kill_connections",
        "get_connection_status",
      ]),
      connectionString: z.string().describe("PostgreSQL connection string (postgres://...)"),
      query: z.string().optional().describe("SQL query to execute (required for action='query')"),
      params: z.array(z.any()).optional().describe("Query parameters"),
      tableName: z.string().optional().describe("Schema-qualified table name (e.g. public.users)"),
      schema: z.string().optional().default("public").describe("Database schema"),
      database: z.string().optional().describe("Database name"),
      explain: z.boolean().optional().default(false).describe("Prefix with EXPLAIN ANALYZE for query action"),
      limit: z.number().int().optional().default(100).describe("Max rows to return"),
      pid: z.number().int().optional().describe("PID to kill for kill_connections"),
      timeoutMs: z.number().int().optional().default(30000).describe("Query timeout in ms"),
    }),
    execute: async ({
      action, connectionString, query, params, tableName, schema,
      database, explain, limit, pid, timeoutMs,
    }) => {
      const client = new Client({
        connectionString,
        statement_timeout: timeoutMs || 30000,
      });
      try {
        await client.connect();

        switch (action) {
          case "query": {
            if (!query) return { success: false, error: "Query required" };
            const finalQuery = explain ? `EXPLAIN ANALYZE ${query}` : query;
            const finalParams = params || [];
            if (limit && !query.toLowerCase().includes("limit")) {
              const trimmed = query.replace(/;?\s*$/, "");
              const limited = `SELECT * FROM (${trimmed}) AS _subq LIMIT ${limit}`;
              const res = await client.query(limited, finalParams);
              return {
                success: true,
                rows: res.rows,
                rowCount: res.rowCount,
                fields: res.fields?.map((f: any) => ({ name: f.name, dataType: f.dataTypeID })),
                truncated: res.rowCount === limit,
              };
            }
            const res = await client.query(finalQuery, finalParams);
            return {
              success: true,
              rows: res.rows,
              rowCount: res.rowCount,
              fields: res.fields?.map((f: any) => ({ name: f.name, dataType: f.dataTypeID })),
              command: res.command,
            };
          }

          case "list_databases": {
            const res = await client.query(
              "SELECT datname, datdba, encoding, datistemplate, datallowconn FROM pg_database ORDER BY datname",
            );
            return { success: true, databases: res.rows };
          }

          case "list_schemas": {
            const res = await client.query(
              "SELECT schema_name, schema_owner FROM information_schema.schemata ORDER BY schema_name",
            );
            return { success: true, schemas: res.rows };
          }

          case "list_tables": {
            const res = await client.query(
              `SELECT table_schema, table_name, table_type, pg_size_pretty(pg_total_relation_size(quote_ident(table_schema) || '.' || quote_ident(table_name))) AS size
               FROM information_schema.tables
               WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
               ORDER BY table_schema, table_name`,
            );
            return { success: true, tables: res.rows };
          }

          case "describe_table": {
            if (!tableName) return { success: false, error: "tableName required (e.g. public.users)" };
            const [schemaName, tbl] = tableName.includes(".") ? tableName.split(".") : [schema || "public", tableName];
            const columns = await client.query(
              `SELECT column_name, data_type, character_maximum_length, is_nullable, column_default,
                      ordinal_position
               FROM information_schema.columns
               WHERE table_schema = $1 AND table_name = $2
               ORDER BY ordinal_position`,
              [schemaName, tbl],
            );
            const indexes = await client.query(
              "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2",
              [schemaName, tbl],
            );
            const stats = await client.query(
              "SELECT reltuples::bigint AS estimated_rows, relpages AS pages FROM pg_class WHERE relname = $1",
              [tbl],
            );
            return {
              success: true,
              columns: columns.rows,
              indexes: indexes.rows,
              estimatedStats: stats.rows[0] || null,
            };
          }

          case "list_indexes": {
            if (!tableName) {
              const res = await client.query(
                "SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes ORDER BY schemaname, tablename",
              );
              return { success: true, indexes: res.rows };
            }
            const [schemaName, tbl] = tableName.includes(".") ? tableName.split(".") : [schema || "public", tableName];
            const res = await client.query(
              "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = $1 AND tablename = $2",
              [schemaName, tbl],
            );
            return { success: true, indexes: res.rows };
          }

          case "get_table_stats": {
            if (!tableName) {
              const res = await client.query(`
                SELECT schemaname, tablename, seq_scan, seq_tup_read, idx_scan, idx_tup_fetch,
                       n_tup_ins, n_tup_upd, n_tup_del, n_live_tup, n_dead_tup
                FROM pg_stat_user_tables ORDER BY schemaname, tablename`);
              return { success: true, stats: res.rows };
            }
            const [schemaName, tbl] = tableName.includes(".") ? tableName.split(".") : [schema || "public", tableName];
            const res = await client.query(
              `SELECT * FROM pg_stat_user_tables WHERE schemaname = $1 AND relname = $2`,
              [schemaName, tbl],
            );
            return { success: true, stats: res.rows };
          }

          case "analyze_query": {
            if (!query) return { success: false, error: "Query required" };
            const res = await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`, params || []);
            return { success: true, plan: res.rows[0]?.["QUERY PLAN"] || res.rows };
          }

          case "list_extensions": {
            const res = await client.query(
              "SELECT extname, extversion, extnamespace::regnamespace::text AS schema FROM pg_extension ORDER BY extname",
            );
            return { success: true, extensions: res.rows };
          }

          case "kill_connections": {
            if (pid) {
              await client.query(`SELECT pg_terminate_backend($1)`, [pid]);
              return { success: true, pid, action: "terminated" };
            }
            if (!database) return { success: false, error: "database or pid required" };
            const res = await client.query(
              "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
              [database],
            );
            return { success: true, database, terminated: (res.rows || []).filter((r: any) => r.pg_terminate_backend).length };
          }

          case "get_connection_status": {
            const version = await client.query("SELECT version()");
            const stats = await client.query(
              "SELECT count(*) FILTER (WHERE state = 'active') AS active, count(*) AS total FROM pg_stat_activity",
            );
            const dbSize = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS size");
            return {
              success: true,
              version: version.rows[0]?.version,
              connections: stats.rows[0],
              databaseSize: dbSize.rows[0]?.size,
              serverTime: new Date().toISOString(),
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      } finally {
        await client.end().catch(() => {});
      }
    },
  });

// =============================================================================
// SECTION 2 — MySQL
// =============================================================================

export const mysqlQuery = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Execute MySQL/MariaDB operations: run queries, list databases/tables, describe tables, " +
      "list indexes, analyze queries, manage processes and variables. Provide a URI (mysql://...).",
    inputSchema: z.object({
      action: z.enum([
        "query",
        "list_databases",
        "list_tables",
        "describe_table",
        "list_indexes",
        "analyze_query",
        "get_table_stats",
        "list_processes",
        "kill_query",
        "list_variables",
        "engine_status",
      ]),
      uri: z.string().describe("MySQL connection URI (mysql://user:pass@host:3306/db)"),
      database: z.string().optional().describe("Database name (overrides URI)"),
      query: z.string().optional().describe("SQL query to execute (required for action='query')"),
      params: z.array(z.any()).optional().describe("Query parameters"),
      tableName: z.string().optional().describe("Table name"),
      explain: z.boolean().optional().default(false).describe("Prefix with EXPLAIN for query action"),
      limit: z.number().int().optional().default(100).describe("Max rows to return"),
      processId: z.number().int().optional().describe("Process ID to kill"),
      variablePattern: z.string().optional().describe("Variable name pattern filter"),
    }),
    execute: async ({
      action, uri, database, query, params, tableName, explain, limit, processId, variablePattern,
    }) => {
      let connection: mysql.Connection | undefined;
      try {
        connection = await mysql.createConnection({
          uri,
          ...(database ? { database } : {}),
          connectTimeout: 10000,
        });

        switch (action) {
          case "query": {
            if (!query) return { success: false, error: "Query required" };
            const finalQuery = explain ? `EXPLAIN ${query}` : query;
            const [rows] = await connection.execute(finalQuery, params || []);
            const rowsArray = Array.isArray(rows) ? rows : [];
            if (!explain && limit && rowsArray.length > limit) {
              return { success: true, rows: rowsArray.slice(0, limit), totalRows: rowsArray.length, truncated: true };
            }
            return { success: true, rows: rowsArray, totalRows: rowsArray.length };
          }

          case "list_databases": {
            const [rows] = await connection.execute("SHOW DATABASES", []);
            return { success: true, databases: rows };
          }

          case "list_tables": {
            const dbName = database || uri.split("/").pop()?.split("?")[0] || "";
            const [rows] = await connection.execute(
              "SELECT TABLE_NAME, TABLE_TYPE, TABLE_ROWS, ENGINE, TABLE_COLLATION, DATA_LENGTH, INDEX_LENGTH, CREATE_TIME, UPDATE_TIME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME",
              [dbName],
            );
            return { success: true, tables: rows };
          }

          case "describe_table": {
            if (!tableName) return { success: false, error: "tableName required" };
            const [columns] = await connection.execute(`DESCRIBE \`${tableName}\``);
            const [createTable] = await connection.execute(`SHOW CREATE TABLE \`${tableName}\``);
            const [indexes] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
            return {
              success: true,
              columns,
              createStatement: (createTable as any[])[0]?.["Create Table"],
              indexes,
            };
          }

          case "list_indexes": {
            if (!tableName) return { success: false, error: "tableName required" };
            const [rows] = await connection.execute(`SHOW INDEX FROM \`${tableName}\``);
            return { success: true, indexes: rows };
          }

          case "analyze_query": {
            if (!query) return { success: false, error: "Query required" };
            const [rows] = await connection.execute(`EXPLAIN FORMAT=JSON ${query}`, params || []);
            return { success: true, plan: rows };
          }

          case "get_table_stats": {
            if (!tableName) return { success: false, error: "tableName required" };
            const [status] = await connection.execute("SHOW TABLE STATUS WHERE Name = ?", [tableName]);
            const [count] = await connection.execute(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
            return {
              success: true,
              status: (status as any[])[0] || null,
              rowCount: (count as any[])[0]?.count,
            };
          }

          case "list_processes": {
            const [rows] = await connection.execute("SHOW FULL PROCESSLIST");
            return {
              success: true,
              processes: (rows as any[]).map((p: any) => ({
                id: p.Id,
                user: p.User,
                host: p.Host,
                db: p.db,
                command: p.Command,
                time: p.Time,
                state: p.State,
                info: p.Info?.substring(0, 200),
              })),
            };
          }

          case "kill_query": {
            if (!processId) return { success: false, error: "processId required" };
            await connection.execute(`KILL ${processId}`);
            return { success: true, processId, action: "killed" };
          }

          case "list_variables": {
            const pattern = variablePattern ? ` LIKE '%${variablePattern}%'` : "";
            const [rows] = await connection.execute(`SHOW VARIABLES${pattern}`);
            return { success: true, variables: rows };
          }

          case "engine_status": {
            const [version] = await connection.execute("SELECT VERSION() AS version");
            const [status] = await connection.execute("SHOW GLOBAL STATUS LIKE 'Uptime'");
            const [maxConn] = await connection.execute("SHOW VARIABLES LIKE 'max_connections'");
            const [threads] = await connection.execute("SHOW STATUS LIKE 'Threads_connected'");
            const [qps] = await connection.execute("SHOW GLOBAL STATUS LIKE 'Questions'");
            return {
              success: true,
              version: (version as any[])[0]?.version,
              uptime: (status as any[])[0]?.Value,
              maxConnections: (maxConn as any[])[0]?.Value,
              threadConnected: (threads as any[])[0]?.Value,
              questions: (qps as any[])[0]?.Value,
            };
          }

          default:
            return { success: false, error: `Unknown action: ${action}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      } finally {
        if (connection) await connection.end().catch(() => {});
      }
    },
  });

// =============================================================================
// SECTION 3 — MongoDB
// =============================================================================

export const mongodbQuery = ({ userId }: { userId: string }) =>
  tool({
    description:
      "Execute MongoDB operations: CRUD operations, aggregation, index management, " +
      "collection management, database stats. Provide a URI (mongodb://...).",
    inputSchema: z.object({
      mongoAction: z.enum([
        "find",
        "find_one",
        "insert_one",
        "insert_many",
        "update_one",
        "update_many",
        "delete_one",
        "delete_many",
        "aggregate",
        "count_documents",
        "distinct",
        "estimated_document_count",
        "list_collections",
        "list_databases",
        "create_collection",
        "drop_collection",
        "create_index",
        "list_indexes",
        "drop_index",
        "bulk_write",
        "run_command",
        "get_db_stats",
        "get_collection_stats",
        "watch_collection",
      ]),
      uri: z.string().describe("MongoDB connection URI (mongodb://...)"),
      database: z.string().describe("Database name"),
      collection: z.string().optional().describe("Collection name"),
      filter: z.record(z.any()).optional().describe("Filter document"),
      projection: z.record(z.any()).optional().describe("Projection document"),
      sort: z.record(z.any()).optional().describe("Sort document"),
      document: z.record(z.any()).optional().describe("Single document for insert/update"),
      documents: z.array(z.record(z.any())).optional().describe("Documents for insert_many/bulk_write"),
      update: z.record(z.any()).optional().describe("Update operations"),
      pipeline: z.array(z.record(z.any())).optional().describe("Aggregation pipeline"),
      limit: z.number().int().optional().default(50).describe("Max documents to return"),
      skip: z.number().int().optional().default(0).describe("Documents to skip"),
      fieldName: z.string().optional().describe("Field name for distinct"),
      indexSpec: z.record(z.any()).optional().describe("Index specification (e.g. { field: 1 })"),
      indexName: z.string().optional().describe("Index name for drop_index"),
      indexOptions: z.record(z.any()).optional().describe("Index options"),
      command: z.record(z.any()).optional().describe("Database command for run_command"),
      upsert: z.boolean().optional().default(false).describe("Upsert for update operations"),
      ordered: z.boolean().optional().default(true).describe("Ordered bulk write"),
    }),
    execute: async ({
      mongoAction, uri, database, collection, filter, projection, sort,
      document, documents, update, pipeline, limit, skip, fieldName,
      indexSpec, indexName, indexOptions, command, upsert, ordered,
    }) => {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
      });
      try {
        await client.connect();
        const db = client.db(database);
        const coll = collection ? db.collection(collection) : null;

        switch (mongoAction) {
          case "find": {
            if (!coll) return { success: false, error: "Collection required" };
            const cursor = coll.find(filter || {}).skip(skip || 0).limit(limit || 50);
            if (projection) cursor.project(projection);
            if (sort) cursor.sort(sort);
            const results = await cursor.toArray();
            return { success: true, documents: results, count: results.length };
          }

          case "find_one": {
            if (!coll) return { success: false, error: "Collection required" };
            const opts: any = {};
            if (projection) opts.projection = projection;
            if (sort) opts.sort = sort;
            const result = await coll.findOne(filter || {}, opts);
            return { success: true, document: result || null };
          }

          case "insert_one": {
            if (!coll || !document) return { success: false, error: "Collection and document required" };
            const result = await coll.insertOne(document);
            return { success: true, insertedId: result.insertedId, acknowledged: result.acknowledged };
          }

          case "insert_many": {
            if (!coll || !documents?.length) return { success: false, error: "Collection and documents required" };
            const result = await coll.insertMany(documents, { ordered });
            return {
              success: true,
              insertedCount: result.insertedCount,
              insertedIds: Object.values(result.insertedIds),
              acknowledged: result.acknowledged,
            };
          }

          case "update_one": {
            if (!coll || !filter || !update) return { success: false, error: "Collection, filter, and update required" };
            const result = await coll.updateOne(filter, update, { upsert });
            return {
              success: true,
              matchedCount: result.matchedCount,
              modifiedCount: result.modifiedCount,
              upsertedId: result.upsertedId,
            };
          }

          case "update_many": {
            if (!coll || !filter || !update) return { success: false, error: "Collection, filter, and update required" };
            const result = await coll.updateMany(filter, update, { upsert });
            return {
              success: true,
              matchedCount: result.matchedCount,
              modifiedCount: result.modifiedCount,
              upsertedId: result.upsertedId,
            };
          }

          case "delete_one": {
            if (!coll || !filter) return { success: false, error: "Collection and filter required" };
            const result = await coll.deleteOne(filter);
            return { success: true, deletedCount: result.deletedCount };
          }

          case "delete_many": {
            if (!coll || !filter) return { success: false, error: "Collection and filter required" };
            const result = await coll.deleteMany(filter);
            return { success: true, deletedCount: result.deletedCount };
          }

          case "aggregate": {
            if (!coll || !pipeline?.length) return { success: false, error: "Collection and pipeline required" };
            const results = await coll.aggregate(pipeline).toArray();
            return { success: true, documents: results, count: results.length };
          }

          case "count_documents": {
            if (!coll) return { success: false, error: "Collection required" };
            const count = await coll.countDocuments(filter || {});
            return { success: true, count };
          }

          case "distinct": {
            if (!coll || !fieldName) return { success: false, error: "Collection and fieldName required" };
            const values = await coll.distinct(fieldName, filter || {});
            return { success: true, field: fieldName, values, count: values.length };
          }

          case "estimated_document_count": {
            if (!coll) return { success: false, error: "Collection required" };
            const count = await coll.estimatedDocumentCount();
            return { success: true, count };
          }

          case "list_collections": {
            const collections = await db.listCollections().toArray();
            return {
              success: true,
              collections: collections.map((c: any) => ({
                name: c.name,
                type: c.type,
                options: c.options || null,
              })),
            };
          }

          case "list_databases": {
            const dbs = await client.db().admin().listDatabases();
            return {
              success: true,
              databases: dbs.databases.map((d: any) => ({ name: d.name, sizeOnDisk: d.sizeOnDisk, empty: d.empty })),
            };
          }

          case "create_collection": {
            if (!collection) return { success: false, error: "Collection name required" };
            await db.createCollection(collection);
            return { success: true, database, collection };
          }

          case "drop_collection": {
            if (!coll) return { success: false, error: "Collection required" };
            await coll.drop();
            return { success: true, database, collection, action: "dropped" };
          }

          case "create_index": {
            if (!coll || !indexSpec) return { success: false, error: "Collection and indexSpec required" };
            const result = await coll.createIndex(indexSpec, indexOptions || {});
            return { success: true, indexName: result, collection };
          }

          case "list_indexes": {
            if (!coll) return { success: false, error: "Collection required" };
            const indexes = await coll.listIndexes().toArray();
            return { success: true, indexes };
          }

          case "drop_index": {
            if (!coll || !indexName) return { success: false, error: "Collection and indexName required" };
            await coll.dropIndex(indexName);
            return { success: true, database, collection, indexName, action: "dropped" };
          }

          case "bulk_write": {
            if (!coll || !documents?.length) return { success: false, error: "Collection and documents required" };
            return { success: false, error: "Use insert_many, update_many, or delete_many for bulk operations" };
          }

          case "run_command": {
            if (!command) return { success: false, error: "Command required" };
            const result = await db.command(command);
            return { success: true, result };
          }

          case "get_db_stats": {
            const stats = await db.stats();
            return { success: true, stats };
          }

          case "get_collection_stats": {
            if (!coll) return { success: false, error: "Collection required" };
            const stats = await db.command({ collStats: collection });
            return { success: true, stats };
          }

          case "watch_collection": {
            if (!coll) return { success: false, error: "Collection required" };
            return { success: false, error: "watch_collection is a streaming operation. Use find with a sort filter instead." };
          }

          default:
            return { success: false, error: `Unknown action: ${mongoAction}` };
        }
      } catch (error: any) {
        return { success: false, error: error.message };
      } finally {
        await client.close();
      }
    },
  });