import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform, ActivityIndicator, KeyboardAvoidingView, ScrollView } from 'react-native';
import { requestOtp, verifyOtp } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }) {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState(1); // 1: Enter Email, 2: Enter OTP
    const [loading, setLoading] = useState(false);

    const handleRequestOtp = async () => {
        if (!email.includes('@')) {
            const warning = 'Please enter a valid email address';
            if (Platform.OS === 'web') alert(warning);
            else Alert.alert('Invalid Email', warning);
            return;
        }
        setLoading(true);
        try {
            console.log('Requesting OTP for:', email);
            const response = await requestOtp(email);

            if (response.data?.simulation) {
                const info = 'Simulation Mode Active: Because of provider restrictions, the code has been sent to the server logs instead of this inbox. Check your Render logs!';
                if (Platform.OS === 'web') alert(info);
                else Alert.alert('Simulation Mode', info);
            }

            setStep(2);
        } catch (error) {
            console.error('OTP Request Error:', error);
            const msg = error.response?.data?.message || error.message;
            if (Platform.OS === 'web') alert('Error: ' + msg);
            else Alert.alert('Error', msg);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otp.length !== 6) {
            const warning = 'Please enter the 6-digit code sent to your email.';
            if (Platform.OS === 'web') alert(warning);
            else Alert.alert('Invalid Code', warning);
            return;
        }
        setLoading(true);
        try {
            const response = await verifyOtp(email, otp);
            await AsyncStorage.setItem('token', response.data.token);
            await AsyncStorage.setItem('email', response.data.email);
            navigation.replace('ChatList');
        } catch (error) {
            const msg = error.response?.data?.message || 'Invalid code';
            if (Platform.OS === 'web') alert('Verification Failed: ' + msg);
            else Alert.alert('Verification Failed', msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.brandContainer}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoW}>W</Text>
                    </View>
                    <Text style={styles.title}>Whatswho</Text>
                    <Text style={styles.tagline}>Simple. Secure. Reliable.</Text>
                </View>

                {step === 1 ? (
                    <View style={styles.card}>
                        <Text style={styles.subtitle}>Enter your email to get started</Text>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email Address</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="name@company.com"
                                placeholderTextColor="#8696a0"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleRequestOtp}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Next</Text>}
                        </TouchableOpacity>
                        <Text style={styles.disclaimer}>
                            By continuing, you agree to our Terms of Service and Privacy Policy.
                        </Text>
                    </View>
                ) : (
                    <View style={styles.card}>
                        <Text style={styles.subtitle}>Verify your account</Text>
                        <Text style={styles.infoText}>We sent a 6-digit code to {email}</Text>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Verification Code</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="000000"
                                placeholderTextColor="#8696a0"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                                letterSpacing={5}
                                textAlign="center"
                            />
                        </View>
                        <TouchableOpacity
                            style={styles.button}
                            onPress={handleVerifyOtp}
                            disabled={loading}
                            activeOpacity={0.8}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setStep(1)} style={styles.backBtn}>
                            <Text style={styles.backBtnText}>Change Email Address</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111b21',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    brandContainer: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#00a884',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
            android: { elevation: 8 },
            web: { boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }
        })
    },
    logoW: {
        color: '#fff',
        fontSize: 42,
        fontWeight: 'bold',
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#e9edef',
        letterSpacing: -0.5,
    },
    tagline: {
        fontSize: 14,
        color: '#8696a0',
        marginTop: 4,
    },
    card: {
        backgroundColor: '#202c33',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
            android: { elevation: 4 },
            web: { boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }
        })
    },
    subtitle: {
        color: '#e9edef',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 24,
        textAlign: 'center',
    },
    infoText: {
        color: '#8696a0',
        fontSize: 14,
        marginBottom: 20,
        textAlign: 'center',
    },
    inputContainer: {
        marginBottom: 24,
    },
    label: {
        color: '#00a884',
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        width: '100%',
        height: 56,
        backgroundColor: '#2a3942',
        borderRadius: 12,
        paddingHorizontal: 16,
        color: '#e9edef',
        fontSize: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    button: {
        width: '100%',
        height: 56,
        backgroundColor: '#00a884',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
    },
    buttonText: {
        color: '#111b21',
        fontSize: 16,
        fontWeight: '700',
    },
    disclaimer: {
        color: '#667781',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 24,
        lineHeight: 18,
    },
    backBtn: {
        marginTop: 20,
        alignItems: 'center',
    },
    backBtnText: {
        color: '#00a884',
        fontSize: 14,
        fontWeight: '600',
    },
});
