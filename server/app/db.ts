import { createPool, type Pool, type PoolConnection } from "mysql2/promise";

import { MongoClient, type Collection, type Db, type Document } from "mongodb";

let sqlPool: Pool | undefined;

let mongoClient: MongoClient | undefined;
let mongoDatabase: Db | undefined;

function env(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export const Database = {
  async getSQLConnection(): Promise<PoolConnection> {
    if (!sqlPool) {
      sqlPool = createPool({
        host: env("MYSQL_HOST"),
        port: parseInt(process.env.MYSQL_PORT ?? "3306", 10),
        user: env("MYSQL_USER"),
        password: env("MYSQL_PASS"),
        database: env("MYSQL_DATABASE"),

        waitForConnections: true,
        dateStrings: true,

        connectionLimit:
          process.env.ENV !== "test"
            ? parseInt(process.env.MYSQL_MAX_POOL_SIZE ?? "10", 10)
            : 100,

        queueLimit:
          process.env.ENV !== "test"
            ? parseInt(process.env.MYSQL_QUEUE_LIMIT ?? "0", 10)
            : 100,
      });
    }

    return sqlPool.getConnection();
  },

  async getMongoCollection<T extends Document = Document>(
    collection_name: string,
  ): Promise<Collection<T>> {
    if (!mongoClient) {
      const mongoUri =
        `mongodb://${env("MONGO_USER")}:${env("MONGO_PASS")}` +
        `@${env("MONGO_HOST")}:${env("MONGO_PORT")}` +
        `/${env("MONGO_DB")}` +
        `?authSource=admin`;

      mongoClient = new MongoClient(mongoUri, {
        maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE ?? "10", 10),
      });

      await mongoClient.connect();

      mongoDatabase = mongoClient.db(env("MONGO_DB"));
    }

    if (!mongoDatabase) {
      throw new Error("Mongo database unavailable");
    }

    return mongoDatabase.collection<T>(collection_name);
  },

  async closeConnections(): Promise<void> {
    const operations: Promise<unknown>[] = [];

    if (sqlPool) {
      operations.push(sqlPool.end());
      sqlPool = undefined;
    }

    if (mongoClient) {
      operations.push(mongoClient.close());
      mongoClient = undefined;
      mongoDatabase = undefined;
    }

    await Promise.all(operations);
  },
};

export default Database;
