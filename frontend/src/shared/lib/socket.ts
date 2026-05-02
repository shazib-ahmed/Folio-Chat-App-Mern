import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.APP_SOCKET_URL;

let socket: Socket | null = null;
let subscribers: ((err: Error | null, msg: any) => void)[] = [];

const setupGlobalListeners = () => {
	if (!socket) return;

	socket.off('newMessage');
	socket.off('messagesSeen');

	socket.on('newMessage', (msg: any) => {
		subscribers.forEach(cb => cb(null, { ...msg, type: 'newMessage' }));
	});

	socket.on('messagesSeen', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'messagesSeen' }));
	});

	socket.on('typing', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'typing' }));
	});

	socket.on('stopTyping', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'stopTyping' }));
	});

	socket.on('userBlockStatus', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'userBlockStatus' }));
	});

	socket.on('chatRequestAccepted', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'chatRequestAccepted' }));
	});

	socket.on('messageUpdated', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'messageUpdated' }));
	});

	socket.on('messageDeleted', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'messageDeleted' }));
	});

	socket.on('messageReaction', (data: any) => {
		subscribers.forEach(cb => cb(null, { ...data, type: 'messageReaction' }));
	});
};




export const initiateSocketConnection = (userId: string | number, token: string) => {
	socket = io(SOCKET_URL, {
		query: { userId: userId.toString() },
		auth: { token }
	});
	setupGlobalListeners();
};

export const disconnectSocket = () => {
	if (socket) socket.disconnect();
	subscribers = [];
};

export const subscribeToMessages = (cb: (err: Error | null, msg: any) => void) => {
	subscribers.push(cb);

	return () => {
		subscribers = subscribers.filter(s => s !== cb);
	};
};

export const sendMessageSocket = (msg: any) => {
	if (socket) socket.emit('sendMessage', msg);
};

export const getSocket = () => socket;
