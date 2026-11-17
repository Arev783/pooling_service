require('dotenv').config();
const { Pool } = require('pg');

if (typeof process.env.DB_PASSWORD !== 'string' || process.env.DB_PASSWORD.length === 0) {
throw new Error('Missing required database password: set DB_PASSWORD');
}

const pool = new Pool({
host: process.env.DB_HOST,
port: Number(process.env.DB_PORT),
user: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
});

async function withTransaction(fn) {
const client = await pool.connect();
try {
await client.query('BEGIN');
const result = await fn(client);
await client.query('COMMIT');
return result;
} catch (err) {
await client.query('ROLLBACK');
throw err;
} finally {
client.release(); 
}
}

module.exports = { pool, withTransaction };