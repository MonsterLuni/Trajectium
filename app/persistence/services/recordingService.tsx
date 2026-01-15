import { Database } from "../db";

export type RecordingDto = {
    id: number;
    startTime: number;
    endTime: number;
};

export type PutRecordingDto = {
    id: number;
    startTime: number;
    endTime: number;
}

export type CreateRecordingDto = {
    startTime: number;
}

export class RecordingService {
    private readonly db: Database
    constructor(){
        this.db = new Database();
    }

    public async getRecordingsAsync() {
        return await this.db.getAllAsync<RecordingDto>(`SELECT * FROM recording;`);
    }

    public async createRecordingAsync(createRecordingDto: CreateRecordingDto){
        return this.db.runAsync(`INSERT INTO recording (startTime) VALUES (?);`, [createRecordingDto.startTime]);
    }

    public async updateRecordingAsync(PutRecordingDto: PutRecordingDto){
        return await this.db.runAsync(`UPDATE recording SET startTime = ?, endTime = ? WHERE id = ?;`, [PutRecordingDto.startTime, PutRecordingDto.endTime, PutRecordingDto.id]);
    }

    public async deleteRecordingAsync(id: number){
        console.log(id)
        console.log(await this.getRecordingsAsync())
        await this.db.runAsync(`DELETE FROM recording WHERE id = ?;`, [id]);
        console.log(await this.getRecordingsAsync())
    }
}