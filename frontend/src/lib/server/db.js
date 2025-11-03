// Fail: src/lib/server/db.js
import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

const pool = new pg.Pool({
	connectionString: DATABASE_URL
});

export default pool;