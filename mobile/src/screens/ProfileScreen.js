import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, Image, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { updateProfile } from '../services/api';

export default function ProfileScreen({ navigation }) {
    const [nickname, setNickname] = useState('');
    const [profileImage, setProfileImage] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const userEmail = await AsyncStorage.getItem('email');
        setEmail(userEmail);
        try {
            const response = await api.get('/api/users');
            const me = response.data.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
            if (me) {
                setNickname(me.nickname || '');
                setProfileImage(me.profile_image || '');
            }
        } catch (error) {
            console.error('Load profile error:', error);
        }
    };

    const handleSave = async () => {
        if (!nickname.trim()) {
            Alert.alert('Error', 'Nickname cannot be empty');
            return;
        }
        setLoading(true);
        try {
            await updateProfile({ nickname, profile_image: profileImage });
            Alert.alert('Success', 'Profile updated successfully!');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const generateRandomAvatar = () => {
        const randomId = Math.floor(Math.random() * 1000);
        setProfileImage(`https://api.dicebear.com/7.x/avataaars/svg?seed=${randomId}`);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <View style={styles.content}>
                <TouchableOpacity onPress={generateRandomAvatar} style={styles.imageContainer}>
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} style={styles.profileImage} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Text style={styles.placeholderText}>TAP TO GENERATE</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Your Name</Text>
                    <TextInput
                        style={styles.input}
                        value={nickname}
                        onChangeText={setNickname}
                        placeholder="Enter your nickname"
                        placeholderTextColor="#8696a0"
                    />
                    <Text style={styles.hint}>This name will be visible to your WhatsApp contacts.</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <Text style={styles.emailValue}>{email}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.saveBtn, loading && styles.disabledBtn]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>SAVE PROFILE</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0b141a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#202c33',
    },
    backBtn: {
        padding: 4,
        marginRight: 20,
    },
    backBtnText: {
        fontSize: 24,
        color: '#8696a0',
    },
    headerTitle: {
        fontSize: 20,
        color: '#e9edef',
        fontWeight: '600',
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    imageContainer: {
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#202c33',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        overflow: 'hidden',
    },
    profileImage: {
        width: '100%',
        height: '100%',
    },
    placeholderImage: {
        padding: 20,
        alignItems: 'center',
    },
    placeholderText: {
        color: '#00a884',
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    inputGroup: {
        width: '100%',
        marginBottom: 24,
    },
    label: {
        color: '#8696a0',
        fontSize: 14,
        marginBottom: 8,
    },
    input: {
        color: '#e9edef',
        fontSize: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#00a884',
        paddingVertical: 8,
    },
    hint: {
        color: '#8696a0',
        fontSize: 12,
        marginTop: 8,
    },
    emailValue: {
        color: '#e9edef',
        fontSize: 16,
        paddingVertical: 8,
    },
    saveBtn: {
        backgroundColor: '#00a884',
        paddingVertical: 12,
        paddingHorizontal: 40,
        borderRadius: 24,
        marginTop: 20,
        width: '100%',
        alignItems: 'center',
    },
    disabledBtn: {
        backgroundColor: '#005c4b',
    },
    saveBtnText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
