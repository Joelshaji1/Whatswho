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
    socket = io(API_URL);
    console.log(`Connecting socket...`);
    if (socket && email) socket.emit('identify', email);
};

export const disconnectSocket = () => {
    console.log('Disconnecting socket...');
    if (socket) socket.disconnect();
};

export const subscribeToMessages = (cb) => {
    if (!socket) return;
    socket.on('receive_message', (msg) => {
        console.log('Websocket message received!');
        cb(null, msg);
    });
};

export const subscribeToUserList = (cb) => {
    if (!socket) return;
    socket.on('update_user_list', (users) => {
        console.log('Online users updated:', users);
        cb(null, users);
    });
};

export const sendMessage = (data) => {
    if (socket) socket.emit('send_message', data);
};

export default api;
