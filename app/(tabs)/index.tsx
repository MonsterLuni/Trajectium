import { Picker } from '@react-native-picker/picker';
import { DeviceMotion } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { LineChart } from "react-native-gifted-charts";

export default function SensorScreen() {
  const [selectedRecording, setSelectedRecording] = useState<number>(-1);
  const [showData, setShowData] = useState(false);
  const accelerationData = useRef({ x: 0, y: 0, z: 0, timestamp: 0 });
  const rotationData = useRef({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });
  const worldAcceleration = useRef({ x: 0, y: 0, z: 0});
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const recording = useRef(false);
  const recordings = useRef<Array<RecordingRow>>([]);
  const recordingId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

    type MotionRow = {
    id: number;
    recordingFK: number;
    x: number;
    y: number;
    z: number;
    duration: number;
  };

  type RecordingRow = {
    id: number;
    startTime: number;
    endTime: number;
  };

  useEffect(() => {
    initializeDatabase();

    DeviceMotion.setUpdateInterval(250);
    DeviceMotion.addListener(async (deviceMotion) => {
    // acceleration in m/s²
    accelerationData.current = deviceMotion.acceleration ?? { x: 0, y: 0, z: 0, timestamp: 0 };
    rotationData.current = deviceMotion.rotation;
    await calculateWorldAcceleration();
  });
  }, []);

  async function toggleRecording(){
    if (!dbRef.current) throw new Error("DB not initialized (toggleRecording)");

    recording.current ? stopRecording() : startRecording();
    recording.current = !recording.current;
  }

  async function startRecording(){
      startTime.current = Date.now();
      console.log("START TIME: " + startTime.current);
      const result = dbRef.current!.runSync(`INSERT INTO recording (startTime) VALUES (?);`, [startTime.current]);
      recordingId.current = result.lastInsertRowId;
  }

  async function stopRecording(){
    await dbRef.current!.runAsync(`UPDATE recording SET endTime = ? WHERE id = ?;`,[Date.now(), recordingId.current]);
  }

  async function initializeDatabase() {
    var db = await SQLite.openDatabaseAsync('Motion.db');
    
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS recording (id INTEGER PRIMARY KEY AUTOINCREMENT, startTime INTEGER NOT NULL, endTime INTEGER);
      CREATE TABLE IF NOT EXISTS motion (id INTEGER PRIMARY KEY AUTOINCREMENT, recordingFK INTEGER NOT NULL, x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL, duration INTEGER NOT NULL, FOREIGN KEY(recordingFK) REFERENCES recording(id));
    `);
    dbRef.current = db;

    getRecordings();
  }

  async function deleteDatabase(){
    await SQLite.deleteDatabaseAsync('Motion.db');
  }

  async function calculateWorldAcceleration() {
    // Für jede Richtung muss abgewegt werden, wie viel davon einfach in x,y,z richtung ist in der Welt.
    const cosAlpha = Math.cos(rotationData.current.alpha);
    const cosBeta = Math.cos(rotationData.current.beta);
    const cosGamma = Math.cos(rotationData.current.gamma);

    worldAcceleration.current.x = ((accelerationData.current.x * cosGamma) * cosAlpha) * cosBeta
    worldAcceleration.current.y = ((accelerationData.current.y * cosBeta) * cosAlpha) * cosGamma
    worldAcceleration.current.z = ((accelerationData.current.z * cosAlpha) * cosAlpha) * cosBeta

    if(recording.current){
      await saveInDatabase();
    }
  }

  async function saveInDatabase(){
    if(dbRef.current === null){
      throw new Error("Database not initialized (saveInDatabase)");
    }
    if(recordingId.current === null){
      throw new Error("Recording ID is null (saveInDatabase)");
    }
    if(startTime.current === null){
      throw new Error("Start time is null (saveInDatabase)");
    }

    const timeSinceLastRecord = accelerationData.current.timestamp - (startTime.current);
    try{
      await dbRef.current.runAsync(`INSERT INTO motion (recordingFK, x, y, z, duration) VALUES (?, ?, ?, ?, ?);`, [recordingId.current, worldAcceleration.current.x, worldAcceleration.current.y, worldAcceleration.current.z, timeSinceLastRecord]);
    }catch(e){
      console.error("Error inserting data:", e);
    }
  }

  async function getRecording(id: number) {
    if (!dbRef.current) throw new Error("DB not initialized (getRecording)");

    const result = await dbRef.current.getAllAsync<MotionRow>(`SELECT id, recordingFK, x, y, z, duration FROM motion WHERE recordingFK = ? ORDER BY id ASC;`, [id]);
    result.forEach(motionRow => {
      console.log(`ID: ${motionRow.id}, RecordingFK: ${motionRow.recordingFK}, X: ${motionRow.x}, Y: ${motionRow.y}, Z: ${motionRow.z}, Duration: ${motionRow.duration}`);
    });
    setShowData(true);
  }

  async function getRecordings(){
    if (!dbRef.current) throw new Error("DB not initialized (getRecordings)");

    recordings.current =  await dbRef.current.getAllAsync<RecordingRow>(`SELECT * FROM recording;`);
  }

  return (
      <View style={styles.container}>
          <Picker style={styles.picker}
            selectedValue={selectedRecording}
            onValueChange={(itemValue, itemIndex) => {
              if(dbRef.current !== null){
                getRecording(itemValue);
                setSelectedRecording(itemValue);
              }
            }
            }>
              <Picker.Item color="#000" label="Select Recording" value={-1} />
              {
                recordings.current !== null &&
                  recordings.current.map((recording) => (
                    <Picker.Item color="#000"
                      key={recording.id}
                      label={`Recording ${recording.id}`}
                      value={recording.id}
                    />
                  ))
              }
          </Picker>
          {
            recordings.current != null && <LineChart data={recordings.current.map((data) => ({value: data.id}))} />
          }
          <Button onPress={() => getRecording(recordingId.current ?? 0)} title="Get Last Recording"/>
          <Button onPress={() => toggleRecording()} title={recording.current ? "Stop Recording" : "Start Recording"}/>
          <Text>Acceleration:</Text>
          <Text>x: {accelerationData.current.x}</Text>
          <Text>y: {accelerationData.current.y}</Text>
          <Text>z: {accelerationData.current.z}</Text>
          <Text>Rotation:</Text>
          <Text>x: {rotationData.current.alpha}</Text>
          <Text>y: {rotationData.current.beta}</Text>
          <Text>z: {rotationData.current.gamma}</Text>
          <Text>World Acceleration:</Text>
          <Text>x: {worldAcceleration.current.x}</Text>
          <Text>y: {worldAcceleration.current.y}</Text>
          <Text>z: {worldAcceleration.current.z}</Text>
          {
            showData && (
              <Text>Data fetched from database. Check console log for details.</Text>
            )
          }
      </View>    
  );
}

const styles = StyleSheet.create({
  picker: {
    width: '80%',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  data: {
    fontSize: 20,
    marginBottom: 8,
  },
});
