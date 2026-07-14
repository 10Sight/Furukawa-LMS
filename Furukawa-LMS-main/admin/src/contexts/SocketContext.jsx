import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'sonner';
import axiosInstance from '@/Helper/axiosInstance';

export const SocketContext = createContext();

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [notifications, setNotifications] = useState([]);

    // Get auth data from Redux store
    const { user, isLoggedIn } = useSelector((state) => state.auth);

    useEffect(() => {
        // Only initialize socket if user is authenticated
        let cleanup;
        const init = async () => {
            if (isLoggedIn && user) {
                const { io } = await import('socket.io-client');
                // Prefer explicit env, fall back to API base URL, then localhost
                const envUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_SERVER_URL;
                const apiBase = axiosInstance?.defaults?.baseURL;
                let socketUrl = 'https://swargaya-learning-management-system-3vcz.onrender.com';
                if (envUrl) {
                    socketUrl = envUrl;
                } else if (apiBase) {
                    try {
                        socketUrl = new URL(apiBase).origin;
                    } catch {
                        socketUrl = apiBase;
                    }
                } else if (typeof window !== 'undefined') {
                    const { protocol, hostname } = window.location;
                    socketUrl = `${protocol}//${hostname}:5000`;
                }
                const newSocket = io(socketUrl, {
                    path: import.meta.env.VITE_SOCKET_PATH || '/socket.io',
                    // Allow fallback when websocket upgrade fails in local/dev environments.
                    transports: ['websocket', 'polling'],
                    upgrade: true,
                    withCredentials: true,
                    autoConnect: true,
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 10000,
                    forceNew: true,
                });

                // Connection event handlers
                newSocket.on('connect', () => {
                    setIsConnected(true);

                    // Authenticate user with socket
                    newSocket.emit('authenticate', {
                        userId: user._id,
                        name: user.fullName || user.userName || user.name || 'User',
                        role: user.role,
                        departments: user.departments || [], // Assuming user has departments array
                    });
                });

                newSocket.on('disconnect', () => {
                    setIsConnected(false);
                });

                newSocket.on('authenticated', () => {
                    toast.success('Real-time notifications enabled');
                });

                // Real-time notification handlers
                newSocket.on('notification', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]); // Keep last 50 notifications

                    // Show toast notification
                    toast(data.message, {
                        description: `From: ${data.from} • ${new Date(data.timestamp).toLocaleTimeString()}`,
                        action: {
                            label: 'View',
                            onClick: () => console.log('Notification clicked:', data),
                        },
                    });
                });

                // Quiz notifications
                newSocket.on('quiz-started', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.info(data.message, {
                        description: `Quiz: ${data.quiz?.title}`,
                        duration: 6000,
                    });
                });

                newSocket.on('quiz-submitted', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.success(data.message, {
                        description: 'Test submission received',
                    });
                });

                // Assignment notifications
                newSocket.on('assignment-created', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.info(data.message, {
                        description: `Due: ${data.assignment?.dueDate ? new Date(data.assignment.dueDate).toLocaleDateString() : 'No due date'}`,
                        duration: 8000,
                    });
                });

                newSocket.on('assignment-submitted', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.success(data.message);
                });

                // Grade notifications
                newSocket.on('grade-updated', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.success(data.message, {
                        description: `Score: ${data.grade?.score || 'N/A'}`,
                        duration: 6000,
                    });
                });

                // Announcement notifications
                newSocket.on('new-announcement', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.info('📢 New Announcement', {
                        description: data.message,
                        duration: 10000,
                    });
                });

                // Extra attempt notifications
                newSocket.on('attempt-approved', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.success('Extra attempt approved', {
                        description: data.message,
                        duration: 6000,
                    });
                    // emit custom app-wide event
                    window.dispatchEvent(new CustomEvent('attempt-extension-updated', { detail: { quizId: data.quiz?._id, status: 'APPROVED' } }));
                });
                newSocket.on('attempt-rejected', (data) => {
                    setNotifications(prev => [data, ...prev.slice(0, 49)]);
                    toast.error('Extra attempt rejected', {
                        description: data.message,
                        duration: 6000,
                    });
                    window.dispatchEvent(new CustomEvent('attempt-extension-updated', { detail: { quizId: data.quiz?._id, status: 'REJECTED' } }));
                });

                // User activity notifications
                newSocket.on('user-joined', (data) => {
                    if (data.userName) {
                        toast(`${data.userName} joined`, {
                            description: `Room: ${data.roomId}`,
                            duration: 5000,
                        });
                    }
                });

                newSocket.on('user-left', (data) => {
                    if (data.userName) {
                        toast(`${data.userName} left`, {
                            description: `Room: ${data.roomId}`,
                            duration: 5000,
                        });
                    }
                });

                // Typing indicators (for future chat features)
                newSocket.on('user-typing', (data) => {
                    console.log('User typing:', data);
                    // Handle typing indicator display
                });

                newSocket.on('user-stopped-typing', (data) => {
                    console.log('User stopped typing:', data);
                    // Handle typing indicator removal
                });

                // Error handling
                newSocket.on('connect_error', (error) => {
                    console.error('Socket connection error:', error);
                    if (!newSocket.connected) {
                        toast.error('Connection error', {
                            description: 'Failed to connect to real-time notifications',
                        });
                    }
                });

                setSocket(newSocket);

                // Cleanup on unmount or auth change
                cleanup = () => {
                    newSocket.disconnect();
                    setSocket(null);
                    setIsConnected(false);
                };
            } else {
                // Disconnect socket if user logs out
                if (socket) {
                    socket.disconnect();
                    setSocket(null);
                    setIsConnected(false);
                    setNotifications([]);
                }
            }
        };
        init();
        return () => cleanup && cleanup();
    }, [isLoggedIn, user]);

    // Helper functions
    const joinRoom = (roomId) => {
        if (socket && isConnected) {
            socket.emit('join-room', roomId);
        }
    };

    const leaveRoom = (roomId) => {
        if (socket && isConnected) {
            socket.emit('leave-room', roomId);
        }
    };

    const sendNotification = (targetRoom, message, type = 'info') => {
        if (socket && isConnected) {
            socket.emit('send-notification', {
                targetRoom,
                message,
                type,
                from: user?.name || 'Unknown User'
            });
        }
    };

    const notifyQuizStarted = (departmentId, quizData) => {
        if (socket && isConnected) {
            socket.emit('quiz-started', {
                departmentId,
                quizData
            });
        }
    };

    const notifyQuizSubmitted = (departmentId, submissionData) => {
        if (socket && isConnected) {
            socket.emit('quiz-submitted', {
                departmentId,
                submissionData
            });
        }
    };

    const notifyAssignmentCreated = (departmentId, assignmentData) => {
        if (socket && isConnected) {
            socket.emit('assignment-created', {
                departmentId,
                assignmentData
            });
        }
    };

    const notifyAssignmentSubmitted = (departmentId, submissionData) => {
        if (socket && isConnected) {
            socket.emit('assignment-submitted', {
                departmentId,
                submissionData
            });
        }
    };

    const clearNotifications = () => {
        setNotifications([]);
    };

    const removeNotification = (index) => {
        setNotifications(prev => prev.filter((_, i) => i !== index));
    };

    const contextValue = {
        socket,
        isConnected,
        notifications,
        joinRoom,
        leaveRoom,
        sendNotification,
        notifyQuizStarted,
        notifyQuizSubmitted,
        notifyAssignmentCreated,
        notifyAssignmentSubmitted,
        clearNotifications,
        removeNotification,
    };

    return (
        <SocketContext.Provider value={contextValue}>
            {children}
        </SocketContext.Provider>
    );
};

export default SocketProvider;
