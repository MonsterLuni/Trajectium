import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import { DeviceMotion } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, useWindowDimensions, View } from "react-native";
import MapView, { Polyline } from "react-native-maps";
import MatrixService, { Vector3D } from "../matrix/matrix";
import MotionService, {
  MotionDto,
} from "../persistence/services/motionService";
import RecordingService, {
  RecordingDto,
} from "../persistence/services/recordingService";

export default function SensorScreen() {
  const motionService = useRef<MotionService>(new MotionService()).current;
  const recordingService = useRef<RecordingService>(
    new RecordingService(),
  ).current;
  const matrixService = useRef<MatrixService>(new MatrixService()).current;

  const [motionData, setMotionData] = useState<Array<MotionDto>>([]);
  const motionDataRef = useRef<Array<MotionDto>>([]);
  const [mapStartPosition, setMapStartPosition] =
    useState<Location.LocationObjectCoords>();

  useEffect(() => {
    motionDataRef.current = motionData;
  }, [motionData]);

  const [recording, setRecording] = useState<boolean>(false);
  const recordingRef = useRef<boolean>(false);

  const { width } = useWindowDimensions();
  const maxHeight = 250;
  const computedHeight = Math.min(maxHeight, motionData.length * 10);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  const [selectedRecording, setSelectedRecording] = useState<number>(-1);
  const [recordings, setRecordings] = useState<Array<RecordingDto>>([]);

  const accelerationData = useRef({ x: 0, y: 0, z: 0, timestamp: 0 });
  const rotationData = useRef({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });

  const recordingId = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);
  const lastTime = useRef<number | null>(null);

  let worldVelocity = useRef<Vector3D>({ x: 0, y: 0, z: 0 });
  let worldAcceleration = useRef<Vector3D>({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    const init = async () => {
      setRecordings(await recordingService.getRecordingsAsync());
      const location = await Location.getCurrentPositionAsync();
      setMapStartPosition(location.coords);
    };
    init();
  }, []);

  async function toggleRecording() {
    recording ? stopRecording() : startRecording();
    setRecording(!recording);
  }

  async function startRecording() {
    worldVelocity.current = { x: 0, y: 0, z: 0 };
    worldAcceleration.current = { x: 0, y: 0, z: 0 };
    lastTime.current = Date.now();
    DeviceMotion.setUpdateInterval(33);
    DeviceMotion.addListener(async (deviceMotion) => {
      // acceleration in m/s²
      accelerationData.current = deviceMotion.acceleration ?? {
        x: 0,
        y: 0,
        z: 0,
        timestamp: 0,
      };
      rotationData.current = deviceMotion.rotation;
      await calculateWorldAccelerationAsync();
    });
    lastTime.current = Date.now();
    const startPoint = await Location.getCurrentPositionAsync();
    startTime.current = Date.now();
    const result = await recordingService.createRecordingAsync({
      startTime: startTime.current,
    });
    recordingId.current = result.lastInsertRowId;
    setMotionData([]);
  }

  async function stopRecording() {
    DeviceMotion.removeAllListeners();
    await recordingService.updateRecordingAsync({
      id: recordingId.current!,
      startTime: startTime.current!,
      endTime: Date.now(),
    });
    const recordings = await recordingService.getRecordingsAsync();
    setRecordings(recordings);
  }

  async function calculateWorldAccelerationAsync() {
    if (recordingId.current == null) {
      console.log("RETURN");
      return;
    }

    // Für jede Richtung muss abgewegt werden, wie viel davon einfach in x,y,z richtung ist in der Welt.
    const cosAlpha = Math.cos(rotationData.current.alpha);
    const sinAlpha = Math.sin(rotationData.current.alpha);

    const cosBeta = Math.cos(rotationData.current.beta);
    const sinBeta = Math.sin(rotationData.current.beta);

    const cosGamma = Math.cos(rotationData.current.gamma);
    const sinGamma = Math.sin(rotationData.current.gamma);

    const vector = {
      x: accelerationData.current.x,
      y: accelerationData.current.y,
      z: accelerationData.current.z,
    } as Vector3D;

    if (vector.x < 0.08 && vector.x > -0.08) {
      vector.x = 0;
    }

    if (vector.y < 0.08 && vector.y > -0.08) {
      vector.y = 0;
    }

    if (vector.z < 0.08 && vector.z > -0.08) {
      vector.z = 0;
    }

    const rotationMatrixX = {
      m11: 1,
      m12: 0,
      m13: 0,
      m21: 0,
      m22: cosBeta,
      m23: -sinBeta,
      m31: 0,
      m32: sinBeta,
      m33: cosBeta,
    };
    const rotationMatrixY = {
      m11: cosGamma,
      m12: 0,
      m13: sinGamma,
      m21: 0,
      m22: 1,
      m23: 0,
      m31: -sinGamma,
      m32: 0,
      m33: cosGamma,
    };
    const rotationMatrixZ = {
      m11: cosAlpha,
      m12: -sinAlpha,
      m13: 0,
      m21: sinAlpha,
      m22: cosAlpha,
      m23: 0,
      m31: 0,
      m32: 0,
      m33: 1,
    };

    const vectorWithX = matrixService.multiplyVectorWithMatrix(
      vector,
      rotationMatrixX,
    );
    const vectorWithXY = matrixService.multiplyVectorWithMatrix(
      vectorWithX,
      rotationMatrixY,
    );
    const worldVector = matrixService.multiplyVectorWithMatrix(
      vectorWithXY,
      rotationMatrixZ,
    );

    worldAcceleration.current = matrixService.addVectors(
      worldAcceleration.current,
      worldVector,
    );

    let timeSinceLastUpdate: number | null;
    if (lastTime.current != null) {
      timeSinceLastUpdate = Date.now() - lastTime.current;

      worldAcceleration.current = calculateLengthOfMotionBasedOnTime(
        worldAcceleration.current,
        timeSinceLastUpdate / 1000,
      );

      const motionInMeters = calculateLengthOfMotionBasedOnTime(
        worldAcceleration.current,
        timeSinceLastUpdate / 1000,
      );

      if (recordingRef.current) {
        await motionService.createMotionAsync({
          recordingFK: recordingId.current,
          x: motionInMeters.x,
          y: motionInMeters.y,
          z: motionInMeters.z,
          duration: timeSinceLastUpdate,
        });
        if (motionDataRef.current.length > 100) {
          setMotionData(motionDataRef.current.slice(1));
        } else {
          setMotionData(
            motionDataRef.current.concat([
              {
                x: motionInMeters.x,
                y: motionInMeters.y,
                z: motionInMeters.z,
                duration: timeSinceLastUpdate,
              },
            ]),
          );
        }
      }
    }
    lastTime.current = Date.now();
  }

  function calculateLengthOfMotionBasedOnTime(
    velocityVector: Vector3D,
    durationInSeconds: number,
  ) {
    return {
      x: velocityVector.x * durationInSeconds,
      y: velocityVector.y * durationInSeconds,
      z: velocityVector.z * durationInSeconds,
    } as Vector3D;
  }

  return (
    <View style={styles.container}>
      <Picker
        style={styles.picker}
        selectedValue={selectedRecording}
        onValueChange={async (itemValue) => {
          setSelectedRecording(itemValue);
          setMotionData(
            await motionService.getMotionsFromRecordingIdAsync(itemValue),
          );
        }}
      >
        <Picker.Item color="#000" label="Select Recording" value={-1} />
        {recordings &&
          recordings.map((recording) => (
            <Picker.Item
              color="#000"
              key={recording.id}
              label={`Recording ${recording.id}`}
              value={recording.id}
            />
          ))}
      </Picker>
      {mapStartPosition && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: mapStartPosition.latitude,
            longitude: mapStartPosition.longitude,
            latitudeDelta: 0.001,
            longitudeDelta: 0.001,
          }}
        >
          {motionData &&
            mapStartPosition &&
            motionData.map((motion, index) => (
              <Polyline
                key={`${selectedRecording}-${index}`}
                coordinates={[
                  {
                    latitude: mapStartPosition.latitude,
                    longitude: mapStartPosition.longitude,
                  },
                  {
                    latitude: mapStartPosition.latitude - motion.x / 111320,
                    longitude: mapStartPosition.longitude - motion.y / 111320,
                  },
                ]}
                strokeWidth={4}
                strokeColor="#1E90FF"
              />
            ))}
        </MapView>
      )}
      <Button
        onPress={() => toggleRecording()}
        title={recording ? "Stop Recording" : "Start Recording"}
      />
      <Button
        onPress={async () => {
          if (selectedRecording != null) {
            await recordingService.deleteRecordingAsync(selectedRecording);
            const recordings = await recordingService.getRecordingsAsync();
            setRecordings(recordings);
            setMotionData([]);
          }
        }}
        title="Delete Selected Recording"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    width: "80%",
  },
  container: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 24,
  },
  data: {
    fontSize: 20,
    marginBottom: 8,
  },
  map: {
    width: "80%",
    height: 300,
  },
});
