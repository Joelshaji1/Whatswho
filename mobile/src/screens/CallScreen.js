import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, Image, ActivityIndicator } from 'react-native';

export default function CallScreen({ route, navigation }) {
    const { partnerName, isVideo, profileImage, mode, caller } = route.params;
    // mode: 'calling' (outgoing), 'ongoing'

    const [status, setStatus] = useState(mode === 'calling' ? 'Calling...' : 'Ongoing');
    const [isMuted, setIsMuted] = useState(false);
    const [isSpeaker, setIsSpeaker] = useState(true);
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        let interval;
        if (status === 'Ongoing') {
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [status]);

    const formatTime = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleEndCall = () => {
        // Emit call_end via socket in the parent component or service
        navigation.goBack();
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.infoArea}>
                    <View style={styles.avatarContainer}>
                        {profileImage ? (
                            <Image source={{ uri: profileImage }} style={styles.profileImg} />
                        ) : (
                            <View style={styles.placeholderAvatar}>
                                <Text style={styles.placeholderText}>{partnerName[0].toUpperCase()}</Text>
                            </View>
                        )}
                    </View>
                    <Text style={styles.nameText}>{partnerName}</Text>
                    <Text style={styles.statusText}>{status === 'Ongoing' ? formatTime(seconds) : status}</Text>
                </View>

                {isVideo && <View style={styles.videoPlaceholder}>
                    <Text style={styles.videoText}>Camera is Starting...</Text>
                    <ActivityIndicator color="#fff" style={{ marginTop: 20 }} />
                </View>}

                <View style={styles.controlsRow}>
                    <TouchableOpacity style={[styles.controlBtn, isSpeaker && styles.activeControl]} onPress={() => setIsSpeaker(!isSpeaker)}>
                        <Text style={styles.controlIcon}>{isSpeaker ? '🔊' : '🔈'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlBtn} onPress={() => { }}>
                        <Text style={styles.controlIcon}>📹</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.controlBtn, isMuted && styles.activeControl]} onPress={() => setIsMuted(!isMuted)}>
                        <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
                    <Text style={styles.endBtnText}>📞</Text>
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
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 60,
    },
    infoArea: {
        alignItems: 'center',
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
        marginBottom: 20,
        backgroundColor: '#202c33',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileImg: {
        width: '100%',
        height: '100%',
    },
    placeholderAvatar: {
        width: '100%',
        height: '100%',
        backgroundColor: '#00a884',
        justifyContent: 'center',
        alignItems: 'center',
    },
    placeholderText: {
        color: '#fff',
        fontSize: 48,
        fontWeight: 'bold',
    },
    nameText: {
        color: '#e9edef',
        fontSize: 28,
        fontWeight: '600',
        marginBottom: 8,
    },
    statusText: {
        color: '#8696a0',
        fontSize: 16,
    },
    videoPlaceholder: {
        width: '90%',
        height: '40%',
        backgroundColor: '#111b21',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#202c33',
    },
    videoText: {
        color: '#8696a0',
        fontSize: 14,
    },
    controlsRow: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-evenly',
        paddingHorizontal: 20,
    },
    controlBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#202c33',
        justifyContent: 'center',
        alignItems: 'center',
    },
    activeControl: {
        backgroundColor: '#00a884',
    },
    controlIcon: {
        fontSize: 24,
    },
    endBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#f15c6d',
        justifyContent: 'center',
        alignItems: 'center',
        transform: [{ rotate: '135deg' }],
    },
    endBtnText: {
        fontSize: 32,
        color: '#fff',
    }
});
