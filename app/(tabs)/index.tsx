import { Picker } from '@react-native-picker/picker';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, View } from 'react-native';
import { LineChart } from "react-native-gifted-charts";
import MapView from 'react-native-maps';
import { MatrixService, Vector3D } from '../matrix/matrix';
import { MotionDto, MotionService } from '../persistence/services/motionService';
import { RecordingDto, RecordingService } from '../persistence/services/recordingService';

export default function SensorScreen() {
  const [motionData, setMotionData] = useState<Array<MotionDto>>([]);
  const motionDataRef = useRef<Array<MotionDto>>([]);

  useEffect(() => {
    motionDataRef.current = motionData;
  }, [motionData]);

  const [recording, setRecording] = useState<boolean>(false);
  const recordingRef = useRef<boolean>(false);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const motionService = new MotionService();
  const recordingService = new RecordingService();
  const matrixService = new MatrixService(); 

  const [selectedRecording, setSelectedRecording] = useState<number>(-1);
  const [recordings, setRecordings] = useState<Array<RecordingDto>>([]);

  const accelerationData = useRef({ x: 0, y: 0, z: 0, timestamp: 0 });
  const rotationData = useRef({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });
  
  const recordingId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    DeviceMotion.setUpdateInterval(250);
    DeviceMotion.addListener(async (deviceMotion) => {
      // acceleration in m/s²
      accelerationData.current = deviceMotion.acceleration ?? { x: 0, y: 0, z: 0, timestamp: 0 };
      rotationData.current = deviceMotion.rotation;
      await calculateWorldAccelerationAsync();
      setRecordings(await recordingService.getRecordingsAsync());
    });
  console.log("SETUP DONE");
  }, []);

  async function toggleRecording(){
    recording ? stopRecording() : startRecording();
    setRecording(!recording);
  }

  async function startRecording(){
      startTime.current = Date.now();
      const result = await recordingService.createRecordingAsync({startTime: startTime.current});
      recordingId.current = result.lastInsertRowId;
      setMotionData([]);
  }

  async function stopRecording(){
    await recordingService.updateRecordingAsync({id: recordingId.current!, startTime: startTime.current!, endTime: Date.now()});
    const recordings = await recordingService.getRecordingsAsync();
    setRecordings(recordings);
  }

  async function calculateWorldAccelerationAsync() {
    // Für jede Richtung muss abgewegt werden, wie viel davon einfach in x,y,z richtung ist in der Welt.
    const cosAlpha = Math.cos(rotationData.current.alpha);
    const sinAlpha = Math.sin(rotationData.current.alpha);
    
    const cosBeta = Math.cos(rotationData.current.beta);
    const sinBeta = Math.sin(rotationData.current.beta);

    const cosGamma = Math.cos(rotationData.current.gamma );
    const sinGamma = Math.sin(rotationData.current.gamma );

    const vector = { x: accelerationData.current.x, y: accelerationData.current.y, z: accelerationData.current.z } as Vector3D;
    const rotationMatrixX = {
        m11: 1, m12: 0, m13: 0,
        m21: 0, m22: cosBeta, m23: -sinBeta,
        m31: 0, m32: sinBeta, m33: cosBeta 
      }
    const rotationMatrixY = {
        m11: cosGamma, m12: 0, m13: sinGamma,
        m21: 0, m22: 1, m23: 0,
        m31: -sinGamma, m32: 0, m33: cosGamma 
      }
    const rotationMatrixZ = {
        m11: cosAlpha, m12: -sinAlpha, m13: 0,
        m21: sinAlpha, m22: cosAlpha, m23: 0,
        m31: 0, m32: 0, m33: 1 
      }

    const vectorWithX = matrixService.multiplyVectorWithMatrix(vector, rotationMatrixX);
    const vectorWithXY = matrixService.multiplyVectorWithMatrix(vectorWithX, rotationMatrixY);
    const worldVector = matrixService.multiplyVectorWithMatrix(vectorWithXY, rotationMatrixZ);

    const timeSinceLastUpdate = Date.now() - (accelerationData.current.timestamp);
    if(recordingRef.current){
      await motionService.createMotionAsync({ recordingFK: recordingId.current!, x: worldVector.x, y: worldVector.y, z: worldVector.z, duration: timeSinceLastUpdate});
      if(motionDataRef.current.length > 10){
        setMotionData(motionDataRef.current.slice(1))
      }else{
        setMotionData(motionDataRef.current.concat([{ x: worldVector.x, y: worldVector.y, z: worldVector.z, duration: timeSinceLastUpdate }]));
      }
    }
  }

  return (
    <View style={styles.container}>
            <Picker style={styles.picker}
            selectedValue={selectedRecording}
            onValueChange={async (itemValue, itemIndex) => {
              const data = await motionService.getMotionsFromRecordingIdAsync(itemValue);
              setMotionData(data);
              setSelectedRecording(itemValue);
            }
            }>
              <Picker.Item color="#000" label="Select Recording" value={-1} />
              {
                recordings &&
                  recordings.map((recording) => (
                    <Picker.Item color="#000"
                      key={recording.id}
                      label={`Recording ${recording.id}`}
                      value={recording.id}
                    />
                  ))
              }
      </Picker>
      <MapView style={styles.map} />
      <ScrollView contentContainerStyle={styles.container}>
          {
            motionData && <LineChart data={motionData.map((data) => ({value: data.x}))} 
            data2={motionData.map((data) => ({value: data.y}))} 
            data3={motionData.map((data) => ({value: data.z}))} 
            stepValue={0.2}
            height={250}
            showVerticalLines
            spacing={44}
            initialSpacing={0}
            color1="skyblue"
            color2="orange"
            textColor1="green"
            dataPointsHeight={6}
            dataPointsWidth={6}
            dataPointsColor1="blue"
            dataPointsColor2="red"
            textShiftY={-2}
            textShiftX={-5}
            textFontSize={13}
            />
          }
      </ScrollView>
          <Button onPress={() => toggleRecording()} title={recording ? "Stop Recording" : "Start Recording"}/>
          <Button onPress={async () => {if(recordingId.current != null){
            await recordingService.deleteRecordingAsync(selectedRecording)
            const recordings = await recordingService.getRecordingsAsync();
            setRecordings(recordings);
            }}} title="Delete Selected Recording"/>
    </View>  
  );
}

const styles = StyleSheet.create({
  picker: {
    width: '80%',
  },
  container: {
    width: '100%',
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
  map: {
    width: '100%',
    height: 300,
  },
});
