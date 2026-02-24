import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Animated } from 'react-native';

export default function CallNotification({ visible, from, onAccept, onReject, isVideo }) {
    if (!visible) return null;

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.typeText}>{isVideo ? 'Video Call' : 'WhatsApp Voice Call'}</Text>
                </View>
                <View style={styles.content}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{from[0].toUpperCase()}</Text>
                    </View>
                    <View style={styles.info}>
                        <Text style={styles.nameText}>{from}</Text>
                        <Text style={styles.incomingText}>Incoming...</Text>
                    </View>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity style={[styles.btn, styles.declineBtn]} onPress={onReject}>
                        <Text style={styles.btnIcon}>📞</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btn, styles.acceptBtn]} onPress={onAccept}>
                        <Text style={styles.btnIcon}>📞</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 40,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        zIndex: 9999,
    },
    card: {
        backgroundColor: '#202c33',
        borderRadius: 12,
        padding: 16,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    header: {
        marginBottom: 12,
    },
    typeText: {
        color: '#8696a0',
        fontSize: 12,
        fontWeight: '600',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#00a884',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    info: {
        marginLeft: 12,
        flex: 1,
    },
    nameText: {
        color: '#e9edef',
        fontSize: 18,
        fontWeight: '600',
    },
    incomingText: {
        color: '#8696a0',
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: 20,
    },
    btn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    declineBtn: {
        backgroundColor: '#f15c6d',
        transform: [{ rotate: '135deg' }],
    },
    acceptBtn: {
        backgroundColor: '#25d366',
    },
    btnIcon: {
        fontSize: 24,
        color: '#fff',
    }
});
