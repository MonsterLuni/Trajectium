import { DeviceMotion } from 'expo-sensors';
import * as SQLite from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function SensorScreen() {
  const [worldAcceleration, setWorldAcceleration] = useState({ x: 0, y: 0, z: 0});
  const [accelerationData, setAccelerationData] = useState({ x: 0, y: 0, z: 0, timestamp: 0 });
  const [rotationData, setRotationData] = useState({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });
  const [recording, setRecording] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [recordingId, setRecordingId] = useState<number | null>(null);
  const [showData, setShowData] = useState(false);
  const dbRef = useRef<SQLite.SQLiteDatabase | null>(null);

  useEffect(() => {
    if (recording) {
      if(dbRef.current === null){
      throw new Error("Database not initialized");
      }
      const startTime = Date.now();
      setStartTime(startTime);
      console.log(startTime);
      const result = dbRef.current.runSync(`INSERT INTO recording (startTime) VALUES (?);`, [startTime]);
      setRecordingId(result.lastInsertRowId);
    }
  }, [recording]);

  initializeDatabase();

  DeviceMotion.setUpdateInterval(250);
  DeviceMotion.addListener(async (deviceMotion) => {
    // acceleration in m/s²
    setAccelerationData(deviceMotion.acceleration ?? { x: 0, y: 0, z: 0, timestamp: 0 });
    setRotationData(deviceMotion.rotation);
    await calculateWorldAcceleration();
  });

  async function initializeDatabase() {
    var db = await SQLite.openDatabaseAsync('Motion.db');
    
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recording (id INTEGER PRIMARY KEY AUTOINCREMENT, startTime INTEGER NOT NULL, endTime INTEGER);
      CREATE TABLE IF NOT EXISTS motion (id INTEGER PRIMARY KEY AUTOINCREMENT,recordingId INTEGER NOT NULL,recordingFK INTEGER PRECISION NOT NULL,x DOUBLE PRECISION NOT NULL,y DOUBLE PRECISION NOT NULL,z DOUBLE PRECISION NOT NULL,duration INTEGER NOT NULL, FOREIGN KEY (recordingId) REFERENCES recording(id));
    `);
    dbRef.current = db;
  }

  async function calculateWorldAcceleration() {
    // Für jede Richtung muss abgewegt werden, wie viel davon einfach in x,y,z richtung ist in der Welt.
    const cosAlpha = Math.cos(rotationData.alpha);
    const cosBeta = Math.cos(rotationData.beta);
    const cosGamma = Math.cos(rotationData.gamma);

    worldAcceleration.x = ((accelerationData.x * cosGamma) * cosAlpha) * cosBeta
    worldAcceleration.y = ((accelerationData.y * cosBeta) * cosAlpha) * cosGamma
    worldAcceleration.z = ((accelerationData.z * cosAlpha) * cosAlpha) * cosBeta

    if(recording){
      await saveInDatabase();
    }
  }

  async function saveInDatabase(){
    if(dbRef.current === null){
      throw new Error("Database not initialized");
    }
    if(!startTime){
      throw new Error("Start time is null");
    }
    if(!recordingId){
      throw new Error("Recording ID is null");
    }

    const timeSinceLastRecord = accelerationData.timestamp - (startTime);
    await dbRef.current.runAsync(`INSERT INTO motion (recordingId, x, y, z, duration) VALUES (?, ?, ?, ?, ?);`, [recordingId, worldAcceleration.x, worldAcceleration.y, worldAcceleration.z, timeSinceLastRecord]);
  }

  async function getRecording(id: number) {
    if(dbRef.current === null){
      throw new Error("Database not initialized");
    }
    const result = await dbRef.current.getAllAsync(`SELECT id, recordingId, x, y, z, duration FROM motion WHERE recordingId = ? ORDER BY id ASC;`, [id]);
    console.log(result);
    setShowData(true);
  }

  return (
      <View style={styles.container}>
          <Button onPress={() => getRecording(recordingId ?? 0)} title="Get Last Recording"/>
          <Button onPress={() => setRecording(!recording)} title={recording ? "Stop Recording" : "Start Recording"}/>
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
