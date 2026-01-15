import { Database } from "../db";

export type MotionDto = {
    x: number;
    y: number;
    z: number;
    duration: number;
}

export type MotionRow = {
    id: number;
    recordingFK: number;
    x: number;
    y: number;
    z: number;
    duration: number;
};

export type CreateMotionDto = {
    recordingFK: number;
    x: number;
    y: number;
    z: number;
    duration: number;
}

export class MotionService {
    private readonly db: Database
    constructor(){
        this.db = new Database();
    }

    public async createMotionAsync(createMotionDto: CreateMotionDto){
        return await this.db.runAsync(`INSERT INTO motion (recordingFK, x, y, z, duration) VALUES (?, ?, ?, ?, ?);`, [createMotionDto.recordingFK, createMotionDto.x, createMotionDto.y, createMotionDto.z, createMotionDto.duration]);
    }

    public async getMotionsFromRecordingIdAsync(id: number) {
        return await this.db.getAllAsync<MotionRow>(`SELECT id, recordingFK, x, y, z, duration FROM motion WHERE recordingFK = ? ORDER BY id ASC;`, [id]);
    }
}