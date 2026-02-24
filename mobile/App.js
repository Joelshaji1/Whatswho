import 'react-native-gesture-handler';
import React from 'react';
import { View, StyleSheet, Platform, Dimensions } from 'react-native';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.webWrapper}>
        <View style={styles.webContainer}>
          <AppNavigator />
        </View>
      </View>
    );
  }
  return <AppNavigator />;
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: '#0b141a', // WhatsApp deep dark background
    justifyContent: 'center',
    alignItems: 'center',
    width: '100vw',
    height: '100vh',
  },
  webContainer: {
    width: '100%',
    maxWidth: 450, // Standard phone width on desktop
    height: '100%',
    maxHeight: 900, // Standard phone height
    backgroundColor: '#111b21',
    // Professional shadow for desktop viewing
    ...Platform.select({
      web: {
        boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
        borderRadius: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#202c33',
      }
    })
  },
});
