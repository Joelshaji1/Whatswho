import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, TextInput, Platform, Image } from 'react-native';
import api, { subscribeToUserList, initiateSocketConnection, subscribeToMessages } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatListScreen({ navigation }) {
    const [recipient, setRecipient] = useState('');
    const [history, setHistory] = useState([]);
    const [email, setEmail] = useState('');
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        setup();
    }, []);

    const setup = async () => {
        const userEmail = await AsyncStorage.getItem('email');
        const normalizedEmail = userEmail?.toLowerCase();
        setEmail(normalizedEmail);

        // Re-init socket if needed to get online users
        // Re-init socket if needed to get online users
        initiateSocketConnection(normalizedEmail);

        subscribeToUserList((err, users) => {
            setOnlineUsers(users);
        });

        // Subscribe to messages live so list updates immediately
        subscribeToMessages((err, msg) => {
            console.log('[Socket] New message received on list screen, refreshing list...');
            loadData(normalizedEmail);
        });

        loadData(normalizedEmail);
    };

    // Refresh when screen comes back into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            if (email) loadData(email);
        });
        return unsubscribe;
    }, [navigation, email]);

    const loadData = async (userEmail) => {
        try {
            console.log('Loading chat list data for:', userEmail);
            const response = await api.get('/api/messages');
            const messages = response.data;

            // Get unique contacts and their LATEST message
            const contactsMap = new Map();

            // Sort messages by timestamp descending to easily find latest
            messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            messages.forEach(m => {
                const normSender = m.sender.toLowerCase();
                const normRecipient = m.recipient.toLowerCase();
                const normMe = userEmail.toLowerCase();

                const partner = normSender === normMe ? normRecipient : normSender;
                if (!contactsMap.has(partner)) {
                    contactsMap.set(partner, {
                        id: partner,
                        name: partner,
                        lastMsg: m.body,
                        time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        rawTime: new Date(m.timestamp)
                    });
                }
            });

            // Convert to array and sort the list so recent chats are on top
            const sortedList = Array.from(contactsMap.values()).sort((a, b) => b.rawTime - a.rawTime);
            setHistory(sortedList);
        } catch (error) {
            console.error('ChatList load error:', error);
        }
    };

    const startChat = () => {
        if (recipient) {
            navigation.navigate('ChatRoom', { recipient });
        }
    };

    const renderItem = ({ item }) => {
        const isOnline = onlineUsers.includes(item.name);
        return (
            <TouchableOpacity
                style={styles.chatItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('ChatRoom', { recipient: item.name })}
            >
                <View style={styles.avatarContainer}>
                    <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
                        <Text style={styles.avatarText}>{item.name[0].toUpperCase()}</Text>
                    </View>
                    {isOnline && <View style={styles.onlineBadge} />}
                </View>
                <View style={styles.chatContent}>
                    <View style={styles.chatHeader}>
                        <Text style={styles.chatName} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.chatTime}>{item.time}</Text>
                    </View>
                    <View style={styles.chatFooter}>
                        <Text style={styles.lastMsg} numberOfLines={1}>{item.lastMsg}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Whatswho</Text>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconBtn}><Text style={styles.navIcon}>📷</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Text style={styles.navIcon}>🔍</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                        <View style={styles.menuDot} /><View style={styles.menuDot} /><View style={styles.menuDot} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Start conversation by email"
                        placeholderTextColor="#8696a0"
                        value={recipient}
                        onChangeText={setRecipient}
                        autoCapitalize="none"
                        keyboardType="email-address"
                    />
                    <TouchableOpacity style={styles.goBtn} onPress={startChat}>
                        <Text style={styles.goBtnText}>Go</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={history}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
            />

            <TouchableOpacity style={styles.fab} onPress={() => setRecipient('')}>
                <Text style={styles.fabIcon}>💬</Text>
            </TouchableOpacity>
        </View>
    );
}

const getAvatarColor = (name) => {
    const colors = ['#00a884', '#128c7e', '#34b7f1', '#25d366', '#53bdeb'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#111b21',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 16,
        backgroundColor: '#202c33',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#8696a0',
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        marginLeft: 20,
        padding: 4,
    },
    navIcon: {
        fontSize: 18,
        color: '#8696a0',
    },
    menuDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#8696a0',
        marginVertical: 1.5,
    },
    searchSection: {
        padding: 16,
    },
    searchBar: {
        flexDirection: 'row',
        height: 44,
        backgroundColor: '#202c33',
        borderRadius: 22,
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    searchInput: {
        flex: 1,
        color: '#e9edef',
        paddingHorizontal: 16,
        fontSize: 15,
    },
    goBtn: {
        backgroundColor: '#00a884',
        height: 36,
        borderRadius: 18,
        paddingHorizontal: 16,
        justifyContent: 'center',
        marginRight: 4,
    },
    goBtnText: {
        color: '#111b21',
        fontWeight: '700',
        fontSize: 13,
    },
    listContent: {
        paddingBottom: 100,
    },
    chatItem: {
        flexDirection: 'row',
        height: 74,
        paddingHorizontal: 16,
        alignItems: 'center',
    },
    avatarContainer: {
        marginRight: 15,
        position: 'relative',
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    onlineBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#25d366',
        borderWidth: 2,
        borderColor: '#111b21',
    },
    chatContent: {
        flex: 1,
        height: '100%',
        justifyContent: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#202c33',
    },
    chatHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    chatName: {
        color: '#e9edef',
        fontSize: 17,
        fontWeight: '600',
        flex: 1,
    },
    chatTime: {
        color: '#8696a0',
        fontSize: 12,
    },
    chatFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2,
    },
    lastMsg: {
        color: '#8696a0',
        fontSize: 14,
        flex: 1,
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#00a884',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
    },
    fabIcon: {
        fontSize: 24,
        color: '#fff',
    },
});
