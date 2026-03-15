const { PrismaClient } = require("@prisma/client");
const { resolvePrismaDatasourceUrl } = require("./databaseUrl");

// npx prisma introspect
// npx prisma generate
// npx prisma migrate dev --name init -> ensures that db is in sync with schema
// npx prisma migrate reset -> resets the db

const logLevels = ["error", "info", "warn"]; // add "query" to debug query logs
const datasourceUrl = resolvePrismaDatasourceUrl();
if (datasourceUrl) process.env.DATABASE_URL = datasourceUrl;

const prisma = new PrismaClient({
  log: logLevels,
  ...(datasourceUrl
    ? {
        datasources: {
          db: {
            url: datasourceUrl,
          },
        },
      }
    : {}),
});

module.exports = prisma;
