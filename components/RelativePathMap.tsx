import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';

export default function RelativePathMap({ path, start }) {
  // path: Array<{ x: number, y: number }>
  // start: { latitude: number, longitude: number }
  const startLat = start?.latitude ?? 52.520008;
  const startLng = start?.longitude ?? 13.404954;
  // Umrechnung Meter → Grad (maßstabsgetreu, abhängig von Breitengrad)
  // 1 Breitengrad = ca. 111320 m
  // 1 Längengrad = ca. 111320 * cos(Breite) m
  const latMeter = 1 / 111320;
  const lngMeter = 1 / (111320 * Math.cos((startLat * Math.PI) / 180));
  const coords = path.map((p) => ({
    latitude: startLat + p.y * latMeter,
    longitude: startLng + p.x * lngMeter,
  }));
  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: startLat,
          longitude: startLng,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        }}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {/* Startpunkt Marker */}
        <Marker coordinate={{ latitude: startLat, longitude: startLng }} title="Startposition" pinColor="#388e3c" />
        <Polyline
          coordinates={coords}
          strokeColor="#e91e63"
          strokeWidth={4}
        />
        {coords.length > 0 && (
          <Marker coordinate={coords[coords.length - 1]} title="Aktuelle Position" />
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: Dimensions.get('window').width - 32,
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: 16,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
});
