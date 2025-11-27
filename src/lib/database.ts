import { open } from "sqlite";
import sqlite3 from "sqlite3";

export async function initializeDatabase() {
	const db = await open("./database.sqlite", {
		mode: sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
		verbose: true,
	});
	await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        )
    `);
	return db;
}
