import axios from 'axios';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform } from 'react-native';

const DEV_URL = Platform.OS === 'web' ? 'http://localhost:4000' : 'http://192.168.29.66:4000';
const PROD_URL = 'https://whatswho.onrender.com'; // Live Render Backend

const API_URL = __DEV__ ? DEV_URL : PROD_URL;

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let socket;

export const requestOtp = async (email) => {
    return await api.post('/api/auth/request-otp', { email });
};

export const verifyOtp = async (email, code) => {
    return await api.post('/api/auth/verify-otp', { email, code });
};

export const initiateSocketConnection = (email) => {
    if (socket?.connected) {
        console.log('[Socket] Already connected. Re-identifying...');
        if (email) socket.emit('identify', email.toLowerCase());
        return;
    }

    if (socket) {
        console.log('[Socket] Existing socket found but not connected. Disconnecting old one...');
        socket.disconnect();
    }

    socket = io(API_URL, {
        transports: ['websocket'], // Force websocket for better reliability on Render
        reconnection: true,
        reconnectionAttempts: 5,
        timeout: 10000
    });

    console.log(`[Socket] Initiating new connection for ${email}...`);

    socket.on('connect', () => {
        console.log(`[Socket] Connected! ID: ${socket.id}`);
        if (email) {
            console.log(`[Socket] Identifying as ${email}...`);
            socket.emit('identify', email.toLowerCase());
        }
    });

    socket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err.message);
    });

    socket.on('reconnect_attempt', () => {
        console.log('[Socket] Attempting to reconnect...');
    });
};

export const disconnectSocket = () => {
    if (socket) {
        console.log('Disconnecting socket...');
        socket.disconnect();
        socket = null;
    }
};

export const subscribeToMessages = (cb) => {
    if (!socket) return;
    // Remove existing listeners to avoid duplicates if called multiple times
    socket.off('receive_message');
    socket.on('receive_message', (msg) => {
        console.log('[Socket] Message received!');
        cb(null, msg);
    });
};

export const subscribeToUserList = (cb) => {
    if (!socket) return;
    socket.off('update_user_list');
    socket.on('update_user_list', (users) => {
        console.log('[Socket] Online users updated:', users);
        cb(null, users);
    });
};

export const sendMessage = async (data) => {
    try {
        const response = await api.post('/api/messages', data);
        return response.data;
    } catch (err) {
        console.error('[API] Send error:', err.message);
        if (socket?.connected) socket.emit('send_message', data);
        throw err;
    }
};

export const markMessagesAsRead = async (senderEmail) => {
    try {
        await api.post('/api/messages/read', { sender: senderEmail });
    } catch (err) {
        console.error('[API] Mark read error:', err.message);
    }
};

export const deleteMessage = async (messageId, mode) => {
    try {
        const response = await api.delete(`/api/messages/${messageId}`, { data: { mode } });
        return response.data;
    } catch (err) {
        console.error('[API] Delete error:', err.message);
        throw err;
    }
};

export const subscribeToReadReceipts = (cb) => {
    if (!socket) return;
    socket.off('message_read');
    socket.on('message_read', (data) => {
        console.log('[Socket] Read receipt received:', data);
        cb(null, data);
    });
};

export const subscribeToDeleteEvents = (cb) => {
    if (!socket) return;
    socket.off('message_deleted');
    socket.on('message_deleted', (data) => {
        console.log('[Socket] Message deleted:', data);
        cb(null, data);
    });
};

export const updateProfile = async (data) => {
    try {
        const response = await api.put('/api/user/profile', data);
        return response.data;
    } catch (err) {
        console.error('[API] Profile update error:', err.message);
        throw err;
    }
};

export const getUsersInfo = async (emails) => {
    try {
        const response = await api.get(`/api/users/info?emails=${emails.join(',')}`);
        return response.data;
    } catch (err) {
        console.error('[API] Users info error:', err.message);
        return [];
    }
};

export default api;
