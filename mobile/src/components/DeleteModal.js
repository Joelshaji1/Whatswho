import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, Pressable, Platform } from 'react-native';

export default function DeleteModal({ visible, onClose, onDeleteForMe, onDeleteForEveryone, isMe }) {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={onClose}
        >
            <Pressable style={styles.overlay} onPress={onClose}>
                <View style={styles.modalContainer}>
                    <View style={styles.content}>
                        <Text style={styles.title}>Delete message?</Text>

                        {isMe && (
                            <TouchableOpacity style={styles.option} onPress={onDeleteForEveryone}>
                                <Text style={styles.optionTextRed}>Delete for everyone</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity style={styles.option} onPress={onDeleteForMe}>
                            <Text style={styles.optionTextRed}>Delete for me</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.option} onPress={onClose}>
                            <Text style={styles.optionTextGrey}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '80%',
        backgroundColor: '#202c33',
        borderRadius: 3,
        overflow: 'hidden',
    },
    content: {
        paddingVertical: 15,
    },
    title: {
        fontSize: 18,
        color: '#e9edef',
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    option: {
        paddingVertical: 12,
        paddingHorizontal: 24,
    },
    optionTextRed: {
        fontSize: 16,
        color: '#f15c6d',
    },
    optionTextGrey: {
        fontSize: 16,
        color: '#8696a0',
    }
});
