import { Picker } from '@react-native-picker/picker';
import { DeviceMotion } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { LineChart } from "react-native-gifted-charts";
import { MotionDto, MotionService } from '../persistence/services/motionService';
import { RecordingDto, RecordingService } from '../persistence/services/recordingService';

export default function SensorScreen() {
  const [worldRotationDeg, setWorldRotationDeg] = useState<{ alpha: number; beta: number; gamma: number }>({ alpha: 0, beta: 0, gamma: 0 });
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
  

  const [selectedRecording, setSelectedRecording] = useState<number>(-1);
  const [recordings, setRecordings] = useState<Array<RecordingDto>>([]);

  const accelerationData = useRef({ x: 0, y: 0, z: 0, timestamp: 0 });
  const rotationData = useRef({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });

  const worldAcceleration = useRef({ x: 0, y: 0, z: 0});
  
  const recordingId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    DeviceMotion.setUpdateInterval(33);
    DeviceMotion.addListener(async (deviceMotion) => {
      // acceleration in m/s²
      accelerationData.current = deviceMotion.acceleration ?? { x: 0, y: 0, z: 0, timestamp: 0 };
      rotationData.current = deviceMotion.rotation;
      await calculateWorldAccelerationAsync();
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
    let alphaDeg = rotationData.current.alpha * (180 / Math.PI);
    let betaDeg = rotationData.current.beta * (180 / Math.PI);
    let gammaDeg = rotationData.current.gamma * (180 / Math.PI);

    const cosAlpha = Math.cos(alphaDeg);
    const cosBeta = Math.cos(betaDeg);
    const cosGamma = Math.cos(gammaDeg);

    setWorldRotationDeg({ alpha: alphaDeg, beta: betaDeg, gamma: gammaDeg });

    worldAcceleration.current.x = ((accelerationData.current.x * cosGamma) * cosBeta) * cosAlpha
    worldAcceleration.current.y = ((accelerationData.current.y * cosGamma) * cosAlpha) * cosBeta
    worldAcceleration.current.z = ((accelerationData.current.z * cosBeta) * cosAlpha) * cosGamma

    const timeSinceLastUpdate = Date.now() - (accelerationData.current.timestamp);
    if(recordingRef.current){
      
      await motionService.createMotionAsync({ recordingFK: recordingId.current!, x: worldAcceleration.current.x, y: worldAcceleration.current.y, z: worldAcceleration.current.z, duration: timeSinceLastUpdate});
      if(motionDataRef.current.length > 10){
        console.log("TRIMMING MOTION DATA");
        setMotionData(motionDataRef.current.slice(1))
      }else{
        setMotionData(motionDataRef.current.concat([{ x: worldAcceleration.current.x, y: worldAcceleration.current.y, z: worldAcceleration.current.z, duration: timeSinceLastUpdate }]));
      }
      console.log(motionDataRef.current);
    }
  }

  return (
      <ScrollView contentContainerStyle={styles.container}>
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
          {
            motionData && <LineChart data={motionData.map((data) => ({value: data.x}))} 
            //data2={motionData.map((data) => ({value: data.y}))} 
            //data3={motionData.map((data) => ({value: data.z}))} 
            stepValue={0.1}
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
          <Button onPress={() => motionService.getMotionsFromRecordingIdAsync(recordingId.current ?? 0)} title="Get Last Recording"/>
          <Button onPress={() => toggleRecording()} title={recording ? "Stop Recording" : "Start Recording"}/>
          <Button onPress={async () => {if(recordingId.current != null){
            await recordingService.deleteRecordingAsync(selectedRecording)
            const recordings = await recordingService.getRecordingsAsync();
            setRecordings(recordings);
            }}} title="Delete Selected Recording"/>
          <Text>Rotation:</Text>
          <Text>x: {worldRotationDeg.alpha.toFixed(2)}</Text>
          <Text>y: {worldRotationDeg.beta.toFixed(2)}</Text>
          <Text>z: {worldRotationDeg.gamma.toFixed(2)}</Text>
      </ScrollView>    
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
