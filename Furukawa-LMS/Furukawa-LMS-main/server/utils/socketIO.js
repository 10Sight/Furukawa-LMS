import logger from '../logger/winston.logger.js';

/**
 * Socket.IO utility functions for real-time notifications
 */
class SocketIOService {
    constructor() {
        this.io = null;
    }

    initialize(io) {
        this.io = io;
        logger.info('Socket.IO service initialized');
    }

    // Emit to a specific room
    emitToRoom(roomId, event, data) {
        if (this.io) {
            this.io.to(roomId).emit(event, data);
            logger.info(`Emitted ${event} to room ${roomId}:`, data);
        }
    }

    // Emit to all connected clients
    emitToAll(event, data) {
        if (this.io) {
            this.io.emit(event, data);
            logger.info(`Emitted ${event} to all clients:`, data);
        }
    }

    // Emit to a specific socket by ID
    emitToSocket(socketId, event, data) {
        if (this.io) {
            this.io.to(socketId).emit(event, data);
            logger.info(`Emitted ${event} to socket ${socketId}:`, data);
        }
    }

    // LMS-specific notification methods
    notifyQuizStarted(departmentId, quizData) {
        this.emitToRoom(`department-${departmentId}`, 'quiz-started', {
            type: 'quiz-started',
            message: `Quiz "${quizData.title}" has started`,
            quiz: quizData,
            timestamp: new Date()
        });
    }

    notifyQuizSubmitted(departmentId, submissionData) {
        this.emitToRoom(`department-${departmentId}`, 'quiz-submitted', {
            type: 'quiz-submitted',
            message: `Quiz submitted by ${submissionData.studentName}`,
            submission: submissionData,
            timestamp: new Date()
        });
    }

    notifyAssignmentCreated(departmentId, assignmentData) {
        this.emitToRoom(`department-${departmentId}`, 'assignment-created', {
            type: 'assignment-created',
            message: `New assignment: "${assignmentData.title}"`,
            assignment: assignmentData,
            timestamp: new Date()
        });
    }

    notifyAssignmentSubmitted(departmentId, submissionData) {
        this.emitToRoom(`department-${departmentId}`, 'assignment-submitted', {
            type: 'assignment-submitted',
            message: `Assignment submitted by ${submissionData.studentName}`,
            submission: submissionData,
            timestamp: new Date()
        });
    }

    notifyGradeUpdated(studentId, gradeData) {
        this.emitToSocket(studentId, 'grade-updated', {
            type: 'grade-updated',
            message: `Your grade has been updated for ${gradeData.itemName}`,
            grade: gradeData,
            timestamp: new Date()
        });
    }

    notifyNewAnnouncement(departmentId, announcementData) {
        this.emitToRoom(`department-${departmentId}`, 'new-announcement', {
            type: 'announcement',
            message: announcementData.message,
            announcement: announcementData,
            timestamp: new Date()
        });
    }

    // Get connected users count
    getConnectedUsersCount() {
        return this.io ? this.io.sockets.sockets.size : 0;
    }

    // Get users in a specific room
    async getUsersInRoom(roomId) {
        if (this.io) {
            const sockets = await this.io.in(roomId).fetchSockets();
            return sockets.length;
        }
        return 0;
    }
}

// Create singleton instance
const socketIOService = new SocketIOService();

export default socketIOService;
