import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.APP_SOCKET_URL || 'http://localhost:5000';

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
};

export const initiateSocketConnection = (userId: string | number) => {
	socket = io(SOCKET_URL, {
		query: { userId: userId.toString() },
	});
	console.log(`Connecting socket for user: ${userId}...`);
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
