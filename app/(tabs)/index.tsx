import { DeviceMotion } from 'expo-sensors';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SensorScreen() {
  const [worldAcceleration, setWorldAcceleration] = useState({ x: 0, y: 0, z: 0});
  const [accelerationData, setAccelerationData] = useState({ x: 0, y: 0, z: 0, timestamp: 0 });
  const [rotationData, setRotationData] = useState({ alpha: 0, beta: 0, gamma: 0, timestamp: 0 });

  DeviceMotion.setUpdateInterval(250);
  DeviceMotion.addListener((deviceMotion) => {
    // acceleration in m/s²
    setAccelerationData(deviceMotion.acceleration ?? { x: 0, y: 0, z: 0, timestamp: 0 });
    setRotationData(deviceMotion.rotation);
    calculateWorldAcceleration();
  });

  function calculateWorldAcceleration() {
    // Für jede Richtung muss abgewegt werden, wie viel davon einfach in x,y,z richtung ist in der Welt.
    
  }

  return (
      <View style={styles.container}>
          <Text>Acceleration:</Text>
          <Text>x: {accelerationData.x}</Text>
          <Text>y: {accelerationData.y}</Text>
          <Text>z: {accelerationData.z}</Text>
          <Text>Rotation:</Text>
          <Text>x: {rotationData.alpha}</Text>
          <Text>y: {rotationData.beta}</Text>
          <Text>z: {rotationData.gamma}</Text>
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
