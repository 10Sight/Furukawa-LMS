import cron from 'node-cron';
import Department from '../models/department.model.js';
import User from '../models/auth.model.js';
import logger from '../logger/winston.logger.js';

class DepartmentCleanupScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize the department cleanup scheduler
  init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Schedule department cleanup to run daily at 2 AM UTC
      const cleanupJob = cron.schedule('0 2 * * *', async () => {
        await this.cleanupOldDepartments();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Schedule cleanup warning notifications to run daily at 1 AM UTC (1 hour before cleanup)
      const warningJob = cron.schedule('0 1 * * *', async () => {
        await this.sendCleanupWarnings();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Store jobs for management
      this.jobs.set('cleanup', cleanupJob);
      this.jobs.set('warnings', warningJob);

      // Start the jobs
      cleanupJob.start();
      warningJob.start();

      this.isInitialized = true;

    } catch (error) {
      // Failed to initialize department cleanup scheduler
    }
  }

  // Stop all scheduled jobs
  stop() {
    try {
      this.jobs.forEach((job, name) => {
        job.stop();
        job.destroy();
      });

      this.jobs.clear();
      this.isInitialized = false;
    } catch (error) {
      // Error stopping department cleanup scheduler
    }
  }

  // Main cleanup function
  async cleanupOldDepartments() {
    const startTime = Date.now();

    try {
      const result = await Department.cleanupOldDepartments();

      const duration = Date.now() - startTime;

      // Send cleanup completion notifications
      if (result.deletedDepartments.length > 0) {
        await this.sendCleanupCompletionNotifications(result.deletedDepartments);
      }

      // Log to file
      logger.info('Department cleanup completed', {
        duration,
        found: result.found,
        deleted: result.deleted,
        errors: result.errors.length,
        deletedDepartments: result.deletedDepartments.map(b => ({
          name: b.name,
          status: b.status,
          studentCount: b.studentCount
        }))
      });

      return result;

    } catch (error) {
      logger.error('Department cleanup error:', error);
      return { found: 0, deleted: 0, errors: [{ error: error.message }], deletedDepartments: [] };
    }
  }

  // Send warning notifications before cleanup
  async sendCleanupWarnings() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const departmentsToDelete = await Department.find({
        status: { $in: ['COMPLETED', 'CANCELLED'] },
        statusUpdatedAt: { $lt: oneWeekAgo },
        isDeleted: { $ne: true }
      }).populate('students', 'fullName email')
        .populate('instructor', 'fullName email')
        .populate('course', 'title');

      if (departmentsToDelete.length === 0) {
        return;
      }

      // Create warning notifications for each department
      for (const department of departmentsToDelete) {
        const warningMessage = `Your department "${department.name}" (${department.status.toLowerCase()}) will be automatically deleted in 24 hours. All associated data including progress, submissions, and quiz attempts will be permanently removed.`;

        const notifications = [];

        // Add students to notifications
        department.students.forEach(student => {
          notifications.push({
            recipient: student._id,
            type: 'WARNING',
            title: `Department Deletion Warning: ${department.name}`,
            message: warningMessage,
            metadata: {
              departmentId: department._id,
              departmentName: department.name,
              status: department.status,
              deletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              courseTitle: department.course?.title || 'N/A',
              isCleanupWarning: true
            },
            urgent: true
          });
        });

        // Add instructor to notifications if exists
        if (department.instructor) {
          notifications.push({
            recipient: department.instructor._id,
            type: 'WARNING',
            title: `Department Deletion Warning: ${department.name}`,
            message: warningMessage.replace('Your department', 'Your assigned department'),
            metadata: {
              departmentId: department._id,
              departmentName: department.name,
              status: department.status,
              deletionDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              courseTitle: department.course?.title || 'N/A',
              isCleanupWarning: true
            },
            urgent: true
          });
        }

        // Here you would typically save these notifications to a notifications collection
        // or send them via email/push notifications

        // Log the notification for tracking
        logger.warn(`Department cleanup warning sent`, {
          departmentId: department._id,
          departmentName: department.name,
          status: department.status,
          recipientCount: notifications.length,
          scheduledDeletion: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }

    } catch (error) {
      logger.error('Department cleanup warning error:', error);
    }
  }

  // Send notifications after cleanup completion
  async sendCleanupCompletionNotifications(deletedDepartments) {
    try {
      // This would typically be sent to system administrators
      const adminNotification = {
        type: 'SYSTEM',
        title: 'Department Cleanup Completed',
        message: `Automatic department cleanup completed. ${deletedDepartments.length} departments were deleted.`,
        metadata: {
          deletedCount: deletedDepartments.length,
          deletedDepartments: deletedDepartments.map(b => ({
            name: b.name,
            status: b.status,
            studentCount: b.studentCount
          })),
          completedAt: new Date().toISOString()
        }
      };

      // Log completion notification
      logger.info('Department cleanup completion notification', adminNotification);

    } catch (error) {
      logger.error('Department cleanup completion notification error:', error);
    }
  }

  // Manual cleanup trigger
  async triggerCleanup() {
    return await this.cleanupOldDepartments();
  }

  // Get departments that will be cleaned up soon
  async getDepartmentsScheduledForCleanup() {
    try {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const departmentsToDelete = await Department.find({
        status: { $in: ['COMPLETED', 'CANCELLED'] },
        statusUpdatedAt: { $lt: oneWeekAgo },
        isDeleted: { $ne: true }
      }).populate('course', 'title')
        .select('name status statusUpdatedAt students course');

      return departmentsToDelete.map(department => ({
        id: department._id,
        name: department.name,
        status: department.status,
        statusUpdatedAt: department.statusUpdatedAt,
        studentCount: department.students.length,
        courseName: department.course?.title || 'N/A',
        daysSinceStatusChange: Math.floor((Date.now() - department.statusUpdatedAt) / (1000 * 60 * 60 * 24))
      }));

    } catch (error) {
      return [];
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      activeJobs: Array.from(this.jobs.keys()),
      jobCount: this.jobs.size
    };
  }

  // Restart scheduler
  restart() {
    this.stop();
    setTimeout(() => {
      this.init();
    }, 1000);
  }
}

// Create singleton instance
const departmentCleanupScheduler = new DepartmentCleanupScheduler();

export default departmentCleanupScheduler;
