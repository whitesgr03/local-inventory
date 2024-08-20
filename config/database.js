import pg from "pg";
import debug from "debug";

const databaseLog = debug("PostgreSQL");
const { Pool } = pg;

databaseLog("Connecting PostgreSQL...");
const db = new Pool({
	connectionString: process.env.DATABASE_URL,
});
databaseLog("PostgreSQL connect successful");

db.on("error", async err => {
	databaseLog("Connect error:");
	databaseLog(err);
	databaseLog(`Database is closed.`);
	await db.end();
	process.exit(1);
});

export default db;
