// Creates the PSL door's database next to the TypeScript door's, so each contract signs its own.
import 'dotenv/config';
import pg from 'pg';

const target = new URL(process.env['DATABASE_URL_PSL']);
const name = target.pathname.slice(1);
const admin = new URL(process.env['DATABASE_URL']);
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
const exists = await client.query('select 1 from pg_database where datname = $1', [name]);
if (exists.rowCount === 0) {
  await client.query(`create database "${name.replaceAll('"', '""')}"`);
  console.log(`created database ${name}`);
} else {
  console.log(`database ${name} already exists`);
}
await client.end();
