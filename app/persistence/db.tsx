import * as SQLite from "expo-sqlite";

export default class Database {
  private readonly dbName = "Trajectium.db";
  private readonly db: SQLite.SQLiteDatabase;

  constructor() {
    this.db = SQLite.openDatabaseSync(this.dbName);
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.db.execSync(`
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS recording (id INTEGER PRIMARY KEY AUTOINCREMENT, startTime INTEGER NOT NULL, endTime INTEGER);
          CREATE TABLE IF NOT EXISTS motion (id INTEGER PRIMARY KEY AUTOINCREMENT, recordingFK INTEGER NOT NULL, x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL, duration INTEGER NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL, FOREIGN KEY(recordingFK) REFERENCES recording(id) ON DELETE CASCADE);
        `);
  }

  public async deleteDatabaseAsync() {
    await SQLite.deleteDatabaseAsync(this.dbName);
  }

  public async execAsync(command: string) {
    await this.db.execAsync(command);
  }

  public async runAsync(command: string, params: SQLite.SQLiteBindParams = []) {
    return await this.db.runAsync(command, params);
  }

  public async getAllAsync<returnType>(
    command: string,
    params: SQLite.SQLiteBindParams = [],
  ) {
    return await this.db.getAllAsync<returnType>(command, params);
  }
}
