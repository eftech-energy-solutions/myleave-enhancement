// import pg from "pg";

// pg.types.setTypeParser(1082, (val) => val); // DATE → plain string

// const { Pool } = pg;

// const pool = new Pool({
//   connectionString: 'postgresql://neondb_owner:npg_eC2AXFDiQu3g@ep-dark-glitter-a18g8y9r-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
//   ssl: { rejectUnauthorized: false }
// });

// export default pool;

import pg from "pg";
import "dotenv/config";

pg.types.setTypeParser(1082, (val) => val); // DATE → string

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === "true"
    ? { rejectUnauthorized: false }
    : false,
});

console.log(`✅ DB init, using ${process.env.DATABASE_URL}`);

export default pool;
