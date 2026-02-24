import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, SafeAreaView, ImageBackground, Alert } from 'react-native';
import api, { sendMessage, subscribeToMessages, initiateSocketConnection, disconnectSocket, subscribeToUserList, markMessagesAsRead, deleteMessage, subscribeToReadReceipts, subscribeToDeleteEvents, getUsersInfo } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeleteModal from '../components/DeleteModal';

export default function ChatRoomScreen({ route, navigation }) {
    const { recipient } = route.params;
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [email, setEmail] = useState('');
    const [isOnline, setIsOnline] = useState(false);
    const [recipientProfile, setRecipientProfile] = useState({ nickname: recipient, profile_image: '' });
    const [selectedMessage, setSelectedMessage] = useState(null);
    const [modalVisible, setModalVisible] = useState(false);
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

        // Mark existing messages as read
        markMessagesAsRead(normalizedRecipient);

        subscribeToUserList((err, users) => {
            setIsOnline(users.includes(normalizedRecipient));
        });

        // Subscribe to read receipts
        subscribeToReadReceipts((err, data) => {
            if (data.reader === normalizedRecipient) {
                setMessages(prev => prev.map(m => ({ ...m, is_read: true })));
            }
        });

        // Subscribe to deletion events
        subscribeToDeleteEvents((err, data) => {
            if (data.mode === 'everyone') {
                setMessages(prev => prev.map(m => m.id === data.id ? { ...m, is_deleted_everyone: true, body: 'This message was deleted' } : m));
            }
        });

        // Load recipient profile
        try {
            const profiles = await getUsersInfo([normalizedRecipient]);
            if (profiles.length > 0) {
                setRecipientProfile(profiles[0]);
            }
        } catch (err) {
            console.error('Profile fetch error:', err);
        }

        // Load history
        try {
            const response = await api.get('/api/messages');
            const history = response.data.filter(m => {
                const mSender = m.sender.toLowerCase();
                const mRecipient = m.recipient.toLowerCase();
                return (mSender === normalizedMyEmail && mRecipient === normalizedRecipient) ||
                    (mSender === normalizedRecipient && mRecipient === normalizedMyEmail);
            });
            setMessages(history);
        } catch (error) {
            console.error('History Error:', error);
        }

        // Subscribe to new messages
        subscribeToMessages((err, msg) => {
            const msgSender = msg.sender.toLowerCase();
            const msgRecipient = msg.recipient.toLowerCase();

            if ((msgSender === normalizedRecipient && msgRecipient === normalizedMyEmail) ||
                (msgSender === normalizedMyEmail && msgRecipient === normalizedRecipient)) {

                // If we received a message from recipient while in this screen, mark it as read immediately
                if (msgSender === normalizedRecipient) {
                    markMessagesAsRead(normalizedRecipient);
                }

                setMessages(prev => {
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
                if (!recipient) throw new Error('Recipient is missing');
                console.log(`[UI] Sending message via REST to ${recipient}...`);
                const savedMsg = await sendMessage(msgData);
                // Replace temp message with the real one from server
                setMessages(prev => prev.map(m => m.id === tempId ? savedMsg : m));
            } catch (error) {
                console.error('[UI] Send failed:', error);
                const errorDetail = error.response?.data?.error || error.message || 'Unknown error';
                // Mark temp message as failed or remove it
                setMessages(prev => prev.filter(m => m.id !== tempId));

                const alertMsg = `Message failed: ${errorDetail}\n\nPlease try refreshing the app.`;
                if (Platform.OS === 'web') alert(alertMsg);
                else Alert.alert('Send Error', alertMsg);
            }
        }
    };

    const handleLongPress = (message) => {
        if (message.is_deleted_everyone) return;
        setSelectedMessage(message);
        setModalVisible(true);
    };

    const processDeletion = async (mode) => {
        if (!selectedMessage) return;
        const id = selectedMessage.id;
        try {
            await deleteMessage(id, mode);
            if (mode === 'me') {
                setMessages(prev => prev.filter(m => m.id !== id));
            }
            // 'everyone' is handled by socket listener
            setModalVisible(false);
            setSelectedMessage(null);
        } catch (error) {
            console.error('Deletion failed:', error);
            alert('Could not delete message.');
        }
    };

    const renderMessage = ({ item, index }) => {
        const isMe = item.sender === email;
        const prevMsg = index > 0 ? messages[index - 1] : null;
        const isFirstInGroup = !prevMsg || prevMsg.sender !== item.sender;

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onLongPress={() => handleLongPress(item)}
                style={[
                    styles.messageContainer,
                    isMe ? styles.myMessageContainer : styles.theirMessageContainer,
                    isFirstInGroup && { marginTop: 12 }
                ]}
            >
                <View style={[
                    styles.bubble,
                    isMe ? styles.myBubble : styles.theirBubble,
                    isFirstInGroup && (isMe ? styles.myTail : styles.theirTail),
                    item.is_deleted_everyone && styles.deletedBubble
                ]}>
                    <Text style={[
                        styles.messageText,
                        item.is_deleted_everyone && styles.deletedText
                    ]}>
                        {item.body}
                    </Text>
                    <View style={styles.messageDetails}>
                        <Text style={styles.timeText}>
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isMe && !item.is_deleted_everyone && (
                            <Text style={[styles.readTicks, item.is_read && styles.readTicksBlue]}>✓✓</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={styles.avatar}>
                    {recipientProfile.profile_image ? (
                        <Image source={{ uri: recipientProfile.profile_image }} style={styles.headerAvatarImg} />
                    ) : (
                        <Text style={styles.avatarText}>{(recipientProfile.nickname || recipient)[0].toUpperCase()}</Text>
                    )}
                </View>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerName} numberOfLines={1}>{recipientProfile.nickname || recipient}</Text>
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

            <DeleteModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onDeleteForMe={() => processDeletion('me')}
                onDeleteForEveryone={() => processDeletion('everyone')}
                isMe={selectedMessage?.sender === email}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0b141a',
    },
    headerAvatarImg: {
        width: '100%',
        height: '100%',
        borderRadius: 18,
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
    readTicksBlue: {
        color: '#53bdeb', // Blue ticks for read
    },
    deletedBubble: {
        backgroundColor: 'rgba(0,0,0,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    deletedText: {
        fontStyle: 'italic',
        color: '#8696a0',
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
