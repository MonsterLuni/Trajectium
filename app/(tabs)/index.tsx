import * as Location from 'expo-location';
import { DeviceMotion } from 'expo-sensors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dimensions, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import RelativePathMap from '../../components/RelativePathMap';

type Vec3 = { x: number; y: number; z: number };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function magnitude(v: Vec3) {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

// Einfache doppelte Integration mit Schwellwert-Filter (2D)
function integrate2DPathSimple(buffer: Array<{ x: number; y: number; z: number; t: number }>, _resetKey: number) {
  if (buffer.length < 2) return [{ x: 0, y: 0 }];

  let path = [{ x: 0, y: 0 }];
  let vx = 0, vy = 0;
  let lastT = buffer[0].t;

  // m/s²: mehr filtern = weniger “zappeln”
  const ACC_THRESHOLD = 0.25;

  for (let i = 1; i < buffer.length; i++) {
    const dt = (buffer[i].t - lastT) / 1000;
    lastT = buffer[i].t;
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.5) continue;

    const ax = Math.abs(buffer[i - 1].x) > ACC_THRESHOLD ? buffer[i - 1].x : 0;
    const ay = Math.abs(buffer[i - 1].y) > ACC_THRESHOLD ? buffer[i - 1].y : 0;

    vx += ax * dt;
    vy += ay * dt;

    const last = path[path.length - 1];
    path.push({ x: last.x + vx * dt, y: last.y + vy * dt });
  }

  return path;
}

export default function SensorScreen() {
  const [startLocation, setStartLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [buffer, setBuffer] = useState<Array<{ x: number; y: number; z: number; t: number }>>([]);
  const [measuring, setMeasuring] = useState(false);

  // Anzeige: “lineare” Beschleunigung (best effort, device-frame)
  const [data, setData] = useState<Vec3>({ x: 0, y: 0, z: 0 });

  // Gravity-Schätzung (Lowpass auf accelIncludingGravity)
  const gravityRef = useRef<Vec3>({ x: 0, y: 0, z: 0 });
  const initedRef = useRef(false);

  // GPS-Startpunkt holen
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const loc = await Location.getCurrentPositionAsync({});
      setStartLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setMeasuring(true);
    })();
  }, []);

  useEffect(() => {
    if (!measuring) return;

    // Für Filter/Integration besser als 200ms
    DeviceMotion.setUpdateInterval(50); // ~20 Hz

    // Filterparameter passend zu 20 Hz:
    // alpha hoch = gravity stabiler (weniger “Rotation = Bewegung”)
    const alpha = 0.98;

    // Wenn Rotation stark ist, ignorieren wir Translation (sonst fliegt es weg)
    const ROT_RATE_THRESHOLD = 1.2; // rad/s (ca. 70°/s), ggf. 0.8–2.0 testen

    // Wenn linear fast null ist, setzen wir sie auf 0 (Deadband)
    const LINEAR_MAG_DEADBAND = 0.35; // m/s², ggf. 0.2–0.6

    const sub = DeviceMotion.addListener((m: any) => {
      const now = Date.now();

      const aInc = m?.accelerationIncludingGravity;
      if (!aInc) return;

      const aVec: Vec3 = {
        x: clamp(aInc.x ?? 0, -30, 30),
        y: clamp(aInc.y ?? 0, -30, 30),
        z: clamp(aInc.z ?? 0, -30, 30),
      };

      // RotationRate (nicht Orientierung!) – je nach Plattform heißt es oft rotationRate
      const rr = m?.rotationRate ?? m?.rotation; // wir lesen beides, aber nur als RATE
      const rotRate: Vec3 = rr
        ? { x: rr.alpha ?? 0, y: rr.beta ?? 0, z: rr.gamma ?? 0 }
        : { x: 0, y: 0, z: 0 };

      const rotMag = magnitude(rotRate);

      // Gravity Lowpass
      if (!initedRef.current) {
        gravityRef.current = aVec;
        initedRef.current = true;
      } else {
        const gPrev = gravityRef.current;
        gravityRef.current = {
          x: alpha * gPrev.x + (1 - alpha) * aVec.x,
          y: alpha * gPrev.y + (1 - alpha) * aVec.y,
          z: alpha * gPrev.z + (1 - alpha) * aVec.z,
        };
      }

      const gEst = gravityRef.current;

      // Linear = aInc - gEst
      let linear: Vec3 = {
        x: aVec.x - gEst.x,
        y: aVec.y - gEst.y,
        z: aVec.z - gEst.z,
      };

      // 1) Wenn wir stark rotieren: linear ausknipsen (Rotation ≠ Translation)
      if (rotMag > ROT_RATE_THRESHOLD) {
        linear = { x: 0, y: 0, z: 0 };
      }

      // 2) Deadband auf Betrag
      if (magnitude(linear) < LINEAR_MAG_DEADBAND) {
        linear = { x: 0, y: 0, z: 0 };
      }

      // Anzeigen + Buffer
      setData(linear);
      setBuffer((prev) => {
        const updated = [...prev, { ...linear, t: now }];
        return updated.slice(-100);
      });
    });

    return () => sub.remove();
  }, [measuring]);

  function round(n: number) {
    return Math.floor(n * 100) / 100;
  }

  const { x, y, z } = data;

  // --- Pfad-Reset-Logik ---
  const [resetKey, setResetKey] = useState(0);
  const [offsetKey, setOffsetKey] = useState(0);

  const path2D = useMemo(() => {
    const idx = buffer.length > 0 ? buffer.findIndex((d) => d.t > offsetKey) : -1;
    const relevant = idx >= 0 ? buffer.slice(idx) : buffer;
    return integrate2DPathSimple(relevant, resetKey);
  }, [buffer, resetKey, offsetKey]);

  const handleResetPath = () => setResetKey((k) => k + 1);
  const handleOffsetNull = () => setOffsetKey(Date.now());

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>IMU (Rotation gedämpft)</Text>
      <Text style={styles.data}>x: {round(x)}</Text>
      <Text style={styles.data}>y: {round(y)}</Text>
      <Text style={styles.data}>z: {round(z)}</Text>

      {startLocation ? (
        <>
          <Text style={{ marginTop: 16, marginBottom: 4, fontWeight: 'bold' }}>
            2D-Bewegungspfad auf Karte (experimentell)
          </Text>
          <RelativePathMap path={path2D} start={startLocation} />
        </>
      ) : (
        <Text style={{ marginTop: 16 }}>Warte auf GPS-Position ...</Text>
      )}

      <Button title="Pfad zurücksetzen" onPress={handleResetPath} />
      <Button title="Offset nullen" onPress={handleOffsetNull} />

      <Text style={{ marginTop: 16, marginBottom: 4, fontWeight: 'bold' }}>Live-Graph</Text>
      <View style={{ backgroundColor: '#f8f8f8', borderRadius: 12, padding: 8 }}>
        <LineChart
          data={{
            labels: buffer.map((_, i) => (i % 10 === 0 ? `${i / 20}s` : '')), // 50ms -> 20Hz
            datasets: [
              { data: buffer.map((d) => round(d.x)), color: () => 'tomato', strokeWidth: 2 },
              { data: buffer.map((d) => round(d.y)), color: () => 'blue', strokeWidth: 2 },
              { data: buffer.map((d) => round(d.z)), color: () => 'green', strokeWidth: 2 },
            ],
            legend: ['x', 'y', 'z'],
          }}
          width={Math.min(Dimensions.get('window').width - 32, 350)}
          height={250}
          chartConfig={{
            backgroundColor: '#f8f8f8',
            backgroundGradientFrom: '#f8f8f8',
            backgroundGradientTo: '#f8f8f8',
            decimalPlaces: 2,
            color: (opacity = 1) => `rgba(0,0,0,${opacity})`,
            labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
            propsForDots: { r: '0' },
          }}
          bezier
          withDots={false}
          withShadow={false}
          style={{ borderRadius: 12 }}
        />
      </View>
      <Text style={{ color: 'tomato', marginTop: 4 }}>x</Text>
      <Text style={{ color: 'blue' }}>y</Text>
      <Text style={{ color: 'green' }}>z</Text>
    </ScrollView>
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
