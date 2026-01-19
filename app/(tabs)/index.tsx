import { Picker } from "@react-native-picker/picker";
import * as Location from "expo-location";
import { DeviceMotion } from "expo-sensors";
import { useEffect, useRef, useState } from "react";
import { Button, StyleSheet, View } from "react-native";
import MapView, { LatLng, Polyline } from "react-native-maps";
import MatrixService, { Vector3D } from "../helpers/matrix/matrix";
import Utility from "../helpers/utility";
import MotionService, {
  MotionDto,
  MotionStartAndEndPointDto,
} from "../persistence/services/motionService";
import RecordingService, {
  RecordingDto,
} from "../persistence/services/recordingService";

export default function SensorScreen() {
  const matrixService = useRef<MatrixService>(new MatrixService()).current;
  const motionService = useRef<MotionService>(new MotionService()).current;
  const recordingService = useRef<RecordingService>(
    new RecordingService(),
  ).current;

  const [currentPositionInMap, setCurrentPositionInMap] = useState<
    LatLng | undefined
  >();
  const currentPositionInMapRef = useRef<LatLng | undefined>(undefined);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    currentPositionInMapRef.current = currentPositionInMap;
  }, [currentPositionInMap]);

  const [recordings, setRecordings] = useState<Array<RecordingDto>>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const recordingId = useRef<number | undefined>(undefined);
  const startTime = useRef<number | undefined>(undefined);
  const lastTime = useRef<number | undefined>(undefined);

  let worldVelocity = useRef<Vector3D>({ x: 0, y: 0, z: 0 });
  let worldAcceleration = useRef<Vector3D>({ x: 0, y: 0, z: 0 });

  // new

  let [recordingInstanceId, setRecordingInstanceId] = useState<
    number | undefined
  >();
  let [recordingInstance, setRecordingInstance] = useState<
    RecordingDto | undefined
  >();
  let [motionInstances, setMotionInstances] = useState<
    MotionDto[] | undefined
  >();

  let motionInstancesRef = useRef<MotionDto[] | undefined>(undefined);

  useEffect(() => {
    if (!recordingInstance || !mapRef.current) return;

    mapRef.current.animateToRegion(
      {
        latitude: recordingInstance.latitude,
        longitude: recordingInstance.longitude,
        latitudeDelta: 0.001,
        longitudeDelta: 0.001,
      },
      1000,
    );
  }, [recordingInstance?.id]);

  useEffect(() => {
    motionInstancesRef.current = motionInstances;
  }, [motionInstances]);

  useEffect(() => {
    const init = async () => {
      const recordings = await recordingService.getRecordingsAsync();
      setRecordings(recordings);
      const location = await Location.getCurrentPositionAsync();
      setCurrentPositionInMap(location.coords);
    };
    init();
    /*const permissions = async () => {
      const locationPermission =
        await Location.requestForegroundPermissionsAsync();
      const motionPermission = await DeviceMotion.requestPermissionsAsync();

      if (!locationPermission.granted && !motionPermission.granted) {
        throw "Permissions not Set";
      }
      permissions();
    };*/
  }, []);

  async function toggleRecording() {
    isRecording ? stopRecording() : startRecording();
    setIsRecording(!isRecording);
  }

  async function startRecording() {
    worldVelocity.current = { x: 0, y: 0, z: 0 };
    worldAcceleration.current = { x: 0, y: 0, z: 0 };
    const startPoint = await Location.getCurrentPositionAsync();
    setCurrentPositionInMap(startPoint.coords);

    startTime.current = Date.now();
    lastTime.current = undefined;
    const result = await recordingService.createRecordingAsync({
      startTime: startTime.current,
      latitude: startPoint.coords.latitude,
      longitude: startPoint.coords.longitude,
    });
    recordingId.current = result.lastInsertRowId;
    setRecordingInstance(undefined);
    setMotionInstances([]);

    DeviceMotion.addListener(async (deviceMotion) => {
      // acceleration in m/s²
      if (deviceMotion.acceleration != null) {
        await calculateWorldAccelerationAsync(
          deviceMotion.rotation,
          deviceMotion.acceleration,
        );
      } else {
        throw "Acceleration is null";
      }
    });
  }

  async function stopRecording() {
    Utility.ensureValue("recordingId", recordingId?.current);
    Utility.ensureValue("startTime", startTime?.current);

    DeviceMotion.removeAllListeners();

    await recordingService.updateRecordingAsync({
      id: recordingId.current,
      startTime: startTime.current,
      endTime: Date.now(),
    });

    const recording = await recordingService.getRecordingAsync(
      recordingId.current,
    );
    if (recording == null) {
      throw "recording is null";
    }
    setRecordingInstance(recording);

    const recordings = await recordingService.getRecordingsAsync();
    setRecordings(recordings);
  }

  async function calculateWorldAccelerationAsync(
    rotationData: {
      alpha: number;
      beta: number;
      gamma: number;
      timestamp: number;
    },
    accelerationData: {
      x: number;
      y: number;
      z: number;
      timestamp: number;
    },
  ) {
    Utility.ensureValue("recordingId", recordingId?.current);
    Utility.ensureValue(
      "currentPositionInMapRef",
      currentPositionInMapRef?.current,
    );
    Utility.ensureValue("motionInstancesRef", motionInstancesRef?.current);

    const vector = {
      x: accelerationData.x,
      y: accelerationData.y,
      z: accelerationData.z,
    } as Vector3D;

    const vectorWithZ = matrixService.multiplyVectorWithMatrix(
      vector,
      matrixService.rotationMatrixZ(rotationData.alpha),
    );
    const vectorWithZX = matrixService.multiplyVectorWithMatrix(
      vectorWithZ,
      matrixService.rotationMatrixX(rotationData.beta),
    );
    let worldVector = matrixService.multiplyVectorWithMatrix(
      vectorWithZX,
      matrixService.rotationMatrixY(rotationData.gamma),
    );

    if (worldVector.x < 0.1 && worldVector.x > -0.1) {
      worldVector.x = 0;
    }

    if (worldVector.y < 0.1 && worldVector.y > -0.1) {
      worldVector.y = 0;
    }

    if (worldVector.z < 0.1 && worldVector.z > -0.1) {
      worldVector.z = 0;
    }

    let timeSinceLastUpdate: number | null;
    if (lastTime.current) {
      timeSinceLastUpdate = Date.now() - lastTime.current;

      const currentVelocity = matrixService.multiplyVectorWithNumber(
        worldVector,
        timeSinceLastUpdate / 1000,
      );

      worldVelocity.current = matrixService.addVectors(
        worldVelocity.current,
        currentVelocity,
      );

      const motionInMeters = matrixService.multiplyVectorWithNumber(
        worldVelocity.current,
        timeSinceLastUpdate / 1000,
      );

      if (recordingId.current) {
        await motionService.createMotionAsync({
          recordingFK: recordingId.current,
          x: motionInMeters.x,
          y: motionInMeters.y,
          z: motionInMeters.z,
        });
        if (motionInstancesRef.current.length > 10000) {
          setMotionInstances(motionInstancesRef.current.slice(1));
        } else {
          setMotionInstances(
            motionInstancesRef.current.concat([
              {
                x: motionInMeters.x,
                y: motionInMeters.y,
                z: motionInMeters.z,
              },
            ]),
          );
        }
      }
    }
    lastTime.current = Date.now();
    console.log(worldVelocity);
  }

  function calculatePositionOfEachMotionForMap(
    recording: RecordingDto,
    motions: MotionDto[],
  ) {
    //TODO: Calculate 111320 with latitude
    let startPosition = {
      latitude: recording.latitude,
      longitude: recording.longitude,
    } as LatLng;
    let motionsWithPosition: MotionStartAndEndPointDto[] = [];

    motions.forEach((motion) => {
      let nextPosition = {
        latitude: startPosition.latitude - motion.x / 111320,
        longitude: startPosition.longitude - motion.y / 111320,
      } as LatLng;

      motionsWithPosition = motionsWithPosition.concat({
        startPoint: startPosition,
        endPoint: nextPosition,
      });
      startPosition = nextPosition;
    });

    return motionsWithPosition;
  }

  return (
    <View style={styles.container}>
      {
        <Picker
          style={styles.picker}
          selectedValue={recordingInstanceId}
          onValueChange={async (itemValue: number | undefined) => {
            setRecordingInstanceId(itemValue);
            if (itemValue) {
              const recording =
                await recordingService.getRecordingAsync(itemValue);
              if (recording != null) {
                setRecordingInstance(recording);
              }

              if (itemValue) {
                const motions =
                  await motionService.getMotionsFromRecordingIdAsync(itemValue);
                if (motions != null) {
                  setMotionInstances(motions);
                }
              }
            }
          }}
        >
          <Picker.Item
            color="#000"
            label="Select Recording"
            value={undefined}
          />
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
      }
      {
        <MapView style={styles.map} ref={mapRef}>
          {recordingInstance &&
            motionInstances &&
            calculatePositionOfEachMotionForMap(
              recordingInstance,
              motionInstances,
            ).map((positions, index) => {
              const polyLine = (
                <Polyline
                  key={`${recordingInstance.id}-${index}`}
                  coordinates={[positions.startPoint, positions.endPoint]}
                  strokeWidth={4}
                  strokeColor="#1E90FF"
                />
              );

              return polyLine;
            })}
        </MapView>
      }
      <Button
        onPress={() => toggleRecording()}
        title={isRecording ? "Stop Recording" : "Start Recording"}
      />
      <Button
        onPress={async () => {
          if (recordingInstance != null) {
            await recordingService.deleteRecordingAsync(recordingInstance.id);
            const recordings = await recordingService.getRecordingsAsync();
            setRecordings(recordings);

            setRecordingInstance(undefined);
            setMotionInstances([]);
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
