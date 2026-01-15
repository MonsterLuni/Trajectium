import { DeviceMotion } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function SensorScreen() {
  const [worldAcceleration, setWorldAcceleration] = useState({ x: 0, y: 0, z: 0});
  const [accelerationData, setAccelerationData] = useState({ x: 0, y: 0, z: 0, timestamp: 0 });
  const [rotationData, setRotationData] = useState({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });
  const [showData, setShowData] = useState(false);
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);
  const recording = useRef(false);
  const recordingId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    deleteDatabase();
    initializeDatabase();

    DeviceMotion.setUpdateInterval(250);
    DeviceMotion.addListener(async (deviceMotion) => {
    // acceleration in m/s²
    setAccelerationData(deviceMotion.acceleration ?? { x: 0, y: 0, z: 0, timestamp: 0 });
    setRotationData(deviceMotion.rotation);
    await calculateWorldAcceleration();
  });
  }, []);

  async function toggleRecording(){
    if (!dbRef.current) throw new Error("DB not initialized");

    recording.current ? stopRecording() : startRecording();
    recording.current = !recording.current;
  }

  async function startRecording(){
      startTime.current = Date.now();
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
  }

  async function deleteDatabase(){
    await SQLite.deleteDatabaseAsync('Motion.db');
  }

  async function calculateWorldAcceleration() {
    // Für jede Richtung muss abgewegt werden, wie viel davon einfach in x,y,z richtung ist in der Welt.
    const cosAlpha = Math.cos(rotationData.alpha);
    const cosBeta = Math.cos(rotationData.beta);
    const cosGamma = Math.cos(rotationData.gamma);

    worldAcceleration.x = ((accelerationData.x * cosGamma) * cosAlpha) * cosBeta
    worldAcceleration.y = ((accelerationData.y * cosBeta) * cosAlpha) * cosGamma
    worldAcceleration.z = ((accelerationData.z * cosAlpha) * cosAlpha) * cosBeta

    if(recording.current){
      await saveInDatabase();
    }
  }

  async function saveInDatabase(){
    if(dbRef.current === null){
      throw new Error("Database not initialized");
    }
    if(recordingId.current === null){
      throw new Error("Recording ID is null");
    }
    if(startTime.current === null){
      throw new Error("Start time is null");
    }

    const timeSinceLastRecord = accelerationData.timestamp - (startTime.current);
    console.log("INNERHALB DES LOOPS MIT RECORDINGID: " + recordingId.current);
    try{
      await dbRef.current.runAsync(`INSERT INTO motion (recordingFK, x, y, z, duration) VALUES (?, ?, ?, ?, ?);`, [recordingId.current, worldAcceleration.x, worldAcceleration.y, worldAcceleration.z, timeSinceLastRecord]);
    }catch(e){
      console.error("Error inserting data:", e);
    }
  }

  type MotionRow = {
    id: number;
    recordingFK: number;
    x: number;
    y: number;
    z: number;
    duration: number;
  };

  async function getRecording(id: number) {
    if(dbRef.current === null){
      throw new Error("Database not initialized");
    }
    const result = await dbRef.current.getAllAsync<MotionRow>(`SELECT id, recordingFK, x, y, z, duration FROM motion WHERE recordingFK = ? ORDER BY id ASC;`, [id]);
    result.forEach(motionRow => {
      console.log(`ID: ${motionRow.id}, RecordingFK: ${motionRow.recordingFK}, X: ${motionRow.x}, Y: ${motionRow.y}, Z: ${motionRow.z}, Duration: ${motionRow.duration}`);
    });
    setShowData(true);
  }

  return (
      <View style={styles.container}>
          <Button onPress={() => getRecording(recordingId.current ?? 0)} title="Get Last Recording"/>
          <Button onPress={() => toggleRecording()} title={recording.current ? "Stop Recording" : "Start Recording"}/>
          <Text>Acceleration:</Text>
          <Text>x: {accelerationData.x}</Text>
          <Text>y: {accelerationData.y}</Text>
          <Text>z: {accelerationData.z}</Text>
          <Text>Rotation:</Text>
          <Text>x: {rotationData.alpha}</Text>
          <Text>y: {rotationData.beta}</Text>
          <Text>z: {rotationData.gamma}</Text>
          <Text>World Acceleration:</Text>
          <Text>x: {worldAcceleration.x}</Text>
          <Text>y: {worldAcceleration.y}</Text>
          <Text>z: {worldAcceleration.z}</Text>
          {
            showData && (
              <Text>Data fetched from database. Check console log for details.</Text>
            )
          }
      </View>    
  );
}

const styles = StyleSheet.create({
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
