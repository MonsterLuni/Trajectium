import { LatLng } from "react-native-maps";
import Database from "../db";

export type MotionDto = {
  x: number;
  y: number;
  z: number;
};

export type MotionStartAndEndPointDto = {
  startPoint: LatLng;
  endPoint: LatLng;
};

export type MotionRow = {
  id: number;
  recordingFK: number;
  x: number;
  y: number;
  z: number;
};

export type CreateMotionDto = {
  recordingFK: number;
  x: number;
  y: number;
  z: number;
};

export default class MotionService {
  private readonly db: Database;
  constructor() {
    this.db = new Database();
  }

  public async createMotionAsync(createMotionDto: CreateMotionDto) {
    return await this.db.runAsync(
      `INSERT INTO motion (recordingFK, x, y, z) VALUES (?, ?, ?, ?);`,
      [
        createMotionDto.recordingFK,
        createMotionDto.x,
        createMotionDto.y,
        createMotionDto.z,
      ],
    );
  }

  public async getMotionsFromRecordingIdAsync(id: number) {
    return await this.db.getAllAsync<MotionRow>(
      `SELECT id, recordingFK, x, y, z FROM motion WHERE recordingFK = ? ORDER BY id ASC;`,
      [id],
    );
  }
}
