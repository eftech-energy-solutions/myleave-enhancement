import pg from 'pg';
import { DATABASE_URL } from '$env/static/private';

// Create a new pool of connections to the database
const pool = new pg.Pool({
    connectionString: DATABASE_URL,
});

// A simple query function
export function query(text, params) {
    return pool.query(text, params);
}