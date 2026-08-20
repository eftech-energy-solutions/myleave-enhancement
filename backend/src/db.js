// import pg from "pg";

// pg.types.setTypeParser(1082, (val) => val); // DATE → plain string

// const { Pool } = pg;

// const pool = new Pool({
//   connectionString: 'postgresql://neondb_owner:npg_eC2AXFDiQu3g@ep-dark-glitter-a18g8y9r-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
//   ssl: { rejectUnauthorized: false }
// });

// export default pool;

import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

pg.types.setTypeParser(1082, (val) => val); // DATE → string

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const dbHost = process.env.DATABASE_URL
  ? new URL(process.env.DATABASE_URL).host
  : "unknown";
console.log(`✅ DB init, connected to ${dbHost}`);

export default pool;
