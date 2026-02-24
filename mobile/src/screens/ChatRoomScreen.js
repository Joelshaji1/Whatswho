import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ImageBackground } from 'react-native';
import api, { sendMessage, subscribeToMessages, initiateSocketConnection, disconnectSocket, subscribeToUserList } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ChatRoomScreen({ route, navigation }) {
    const { recipient } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [email, setEmail] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const flatListRef = useRef();

    useEffect(() => {
        setup();
        return () => disconnectSocket();
    }, []);

    const setup = async () => {
        const userEmail = await AsyncStorage.getItem('email');
        const normalizedMyEmail = userEmail?.toLowerCase();
        const normalizedRecipient = recipient?.toLowerCase();

        setEmail(normalizedMyEmail);
        initiateSocketConnection(normalizedMyEmail);

        subscribeToUserList((err, users) => {
            setIsOnline(users.includes(normalizedRecipient));
        });

        // Load history
        try {
            const response = await api.get('/api/messages');
            const filtered = response.data.filter(m =>
                (m.sender.toLowerCase() === normalizedMyEmail && m.recipient.toLowerCase() === normalizedRecipient) ||
                (m.sender.toLowerCase() === normalizedRecipient && m.recipient.toLowerCase() === normalizedMyEmail)
            );
            setMessages(filtered);
        } catch (error) {
            console.error('ChatRoom load error:', error);
        }

        // Subscribe to new messages
        subscribeToMessages((err, msg) => {
            const msgSender = msg.sender.toLowerCase();
            const msgRecipient = msg.recipient.toLowerCase();

            if ((msgSender === normalizedRecipient && msgRecipient === normalizedMyEmail) ||
                (msgSender === normalizedMyEmail && msgRecipient === normalizedRecipient)) {
                setMessages(prev => {
                    // avoid duplicates
                    if (prev.find(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
            }
        });
    };

    const handleSend = async () => {
        if (inputText.trim()) {
            const msgData = {
                sender: email,
                recipient: recipient.toLowerCase(),
                body: inputText,
                timestamp: new Date().toISOString()
            };

            // Add a temporary message to UI for instant feedback
            const tempId = 'temp-' + Date.now();
            const tempMsg = { ...msgData, id: tempId };
            setMessages(prev => [...prev, tempMsg]);
            setInputText('');

            try {
                console.log(`[UI] Sending message via REST...`);
                const savedMsg = await sendMessage(msgData);
                // Replace temp message with the real one from server
                setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
            } catch (error) {
                console.error('[UI] Send failed:', error);
                // Mark temp message as failed or remove it
                setMessages(prev => prev.filter(m => m.id !== tempId));
                alert('Message failed to send. Please check your connection.');
            }
        }
    };

    const renderMessage = ({ item, index }) => {
        const isMe = item.sender === email;
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const isFirstInGroup = !prevMsg || prevMsg.sender !== item.sender;

        return (
            <View style={[
                styles.messageContainer,
                isMe ? styles.myMessageContainer : styles.theirMessageContainer,
                isFirstInGroup && { marginTop: 12 }
            ]}>
                <View style={[
                    styles.bubble,
                    isMe ? styles.myBubble : styles.theirBubble,
                    isFirstInGroup && (isMe ? styles.myTail : styles.theirTail)
                ]}>
                    <Text style={styles.messageText}>{item.body}</Text>
                    <View style={styles.messageDetails}>
                        <Text style={styles.timeText}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMe && <Text style={styles.readTicks}>✓✓</Text>}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{recipient[0].toUpperCase()}</Text>
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName} numberOfLines={1}>{recipient}</Text>
                    {isOnline && <Text style={styles.headerStatus}>online</Text>}
                </View>
                <View style={styles.headerIcons}>
                    <TouchableOpacity style={styles.iconBtn}><Text style={styles.navIcon}>📹</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}><Text style={styles.navIcon}>📞</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn}>
                        <View style={styles.menuDot} /><View style={styles.menuDot} /><View style={styles.menuDot} />
                    </TouchableOpacity>
                </View>
            </View>

            <ImageBackground
                source={{ uri: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png' }}
                style={styles.chatBackground}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item, index) => index.toString()}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            </ImageBackground>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <View style={styles.inputSection}>
                    <View style={styles.inputWrapper}>
                        <TextInput
                            style={styles.input}
                            placeholder="Message"
                            placeholderTextColor="#8696a0"
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            selectionColor="#00a884"
                        />
                    </View>
                    <TouchableOpacity
                        style={styles.sendBtn}
                        onPress={handleSend}
                        activeOpacity={0.7}
                    >
                        <View style={styles.sendCircle}>
                            <Text style={styles.sendIcon}>{'>'}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
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
        paddingHorizontal: 8,
        paddingVertical: 6,
        backgroundColor: '#202c33',
    },
    backBtn: {
        padding: 4,
    },
    backBtnText: {
        fontSize: 24,
        color: '#8696a0',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#53bdeb',
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: 4,
    },
    avatarText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
    },
    headerInfo: {
        flex: 1,
        marginLeft: 4,
    },
    headerName: {
        color: '#e9edef',
        fontSize: 16,
        fontWeight: '600',
    },
    headerStatus: {
        color: '#8696a0',
        fontSize: 12,
    },
    headerIcons: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconBtn: {
        padding: 8,
        marginLeft: 8,
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
    chatBackground: {
        flex: 1,
        backgroundColor: '#0b141a',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
    },
    messageContainer: {
        width: '100%',
        marginVertical: 1,
    },
    myMessageContainer: {
        alignItems: 'flex-end',
    },
    theirMessageContainer: {
        alignItems: 'flex-start',
    },
    bubble: {
        maxWidth: '85%',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        position: 'relative',
    },
    myBubble: {
        backgroundColor: '#005c4b',
    },
    theirBubble: {
        backgroundColor: '#202c33',
    },
    myTail: {
        borderTopRightRadius: 0,
    },
    theirTail: {
        borderTopLeftRadius: 0,
    },
    messageText: {
        color: '#e9edef',
        fontSize: 15,
        lineHeight: 21,
    },
    messageDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-end',
        marginTop: 2,
    },
    timeText: {
        color: '#8696a0',
        fontSize: 10,
    },
    readTicks: {
        color: '#8696a0', // Gray ticks by default (Sent/Delivered)
        fontSize: 10,
        marginLeft: 4,
        fontWeight: 'bold',
    },
    inputSection: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 8,
        paddingVertical: 8,
        backgroundColor: 'transparent',
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#2a3942',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginRight: 6,
    },
    input: {
        color: '#e9edef',
        fontSize: 16,
        maxHeight: 120,
    },
    sendBtn: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#00a884',
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendIcon: {
        color: '#0b141a',
        fontSize: 20,
        fontWeight: 'bold',
    },
});
