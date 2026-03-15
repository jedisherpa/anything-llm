#!/usr/bin/env node

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const prismaDir = join(__dirname, "..", "prisma");
const sourcePath = join(prismaDir, "schema.prisma");
const outputPath = join(prismaDir, "schema.postgresql.prisma");

const source = readFileSync(sourcePath, "utf8");

const postgresBlockPattern =
  /\/\/ datasource db \{\n\/\/   provider = "postgresql"\n\/\/   url      = env\("DATABASE_URL"\)\n\/\/ \}/;
const sqliteBlockPattern =
  /datasource db \{\n  provider = "sqlite"\n  url      = "file:\.\.\/storage\/anythingllm\.db"\n\}/;

if (!postgresBlockPattern.test(source) || !sqliteBlockPattern.test(source)) {
  throw new Error(
    "Expected both the commented PostgreSQL block and active SQLite block in server/prisma/schema.prisma"
  );
}

const generated = `// Generated from prisma/schema.prisma by server/scripts/generate-postgres-prisma-schema.mjs\n// This schema is intended for scalable server deployments that run on PostgreSQL.\n\n${source
  .replace(
    /\/\/ Uncomment the following lines and comment out the SQLite datasource block above to use PostgreSQL\n\/\/ Make sure to set the correct DATABASE_URL in your \.env file\n\/\/ After swapping run `yarn prisma:setup` from the root directory to migrate the database\n\/\/\n/,
    ""
  )
  .replace(
    postgresBlockPattern,
    `datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}`
  )
  .replace(sqliteBlockPattern, "")
  .replace(/\n{3,}/g, "\n\n")}`;

writeFileSync(outputPath, generated, "utf8");
console.log(`Generated ${outputPath}`);
