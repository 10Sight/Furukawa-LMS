import cron from 'node-cron';
import Department from '../models/department.model.js';
import User from '../models/auth.model.js';
import logger from '../logger/winston.logger.js';

class DepartmentStatusScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize the department status scheduler
  init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Schedule department status updates to run daily at midnight
      const statusUpdateJob = cron.schedule('0 0 * * *', async () => {
        await this.updateDepartmentStatuses();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Store job for management
      this.jobs.set('statusUpdate', statusUpdateJob);

      // Start the job
      statusUpdateJob.start();

      this.isInitialized = true;

    } catch (error) {
      // Failed to initialize department status scheduler
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
      // Error stopping department status scheduler
    }
  }

  // Manual department status update trigger
  async updateDepartmentStatuses() {
    const startTime = Date.now();

    try {
      const result = await Department.updateAllStatuses();

      const duration = Date.now() - startTime;

      // Send notifications for status changes
      if (result.results.length > 0) {
        await this.sendStatusChangeNotifications(result.results);
      }

      return result;

    } catch (error) {
      logger.error('Department status update error:', error);
      return { totalProcessed: 0, updatedCount: 0, results: [], error: error.message };
    }
  }

  // Send notifications for department status changes
  async sendStatusChangeNotifications(statusChanges) {
    try {
      for (const change of statusChanges) {
        // Get department with populated students and instructor
        const department = await Department.findById(change.departmentId)
          .populate('students', 'fullName email')
          .populate('instructor', 'fullName email')
          .populate('course', 'title');

        if (!department) continue;

        // Prepare notification message based on new status
        let notificationMessage = '';
        let notificationType = 'INFO';

        switch (change.newStatus) {
          case 'ONGOING':
            notificationMessage = `Your department "${department.name}" has started today! You can now access the course materials.`;
            notificationType = 'SUCCESS';
            break;
          case 'COMPLETED':
            notificationMessage = `Your department "${department.name}" has been completed. Thank you for your participation!`;
            notificationType = 'INFO';
            break;
          case 'CANCELLED':
            notificationMessage = `Important: Your department "${department.name}" has been cancelled. Please contact support for more information.`;
            notificationType = 'ERROR';
            break;
          default:
            continue; // Skip other status changes
        }

        // Create notifications array for all users in the department
        const notifications = [];

        // Add students to notifications
        department.students.forEach(student => {
          notifications.push({
            recipient: student._id,
            type: notificationType,
            title: `Department Status Update: ${department.name}`,
            message: notificationMessage,
            metadata: {
              departmentId: department._id,
              departmentName: department.name,
              oldStatus: change.oldStatus,
              newStatus: change.newStatus,
              courseTitle: department.course?.title || 'N/A'
            }
          });
        });

        // Add instructor to notifications if exists
        if (department.instructor) {
          notifications.push({
            recipient: department.instructor._id,
            type: notificationType,
            title: `Department Status Update: ${department.name}`,
            message: notificationMessage.replace('Your department', 'Your assigned department'),
            metadata: {
              departmentId: department._id,
              departmentName: department.name,
              oldStatus: change.oldStatus,
              newStatus: change.newStatus,
              courseTitle: department.course?.title || 'N/A'
            }
          });
        }

        // Here you would typically save these notifications to a notifications collection
        // or send them via email/push notifications

        // Log the notification for tracking
        logger.info(`Department status change notification sent`, {
          departmentId: department._id,
          departmentName: department.name,
          statusChange: `${change.oldStatus} → ${change.newStatus}`,
          recipientCount: notifications.length
        });
      }
    } catch (error) {
      logger.error('Department status notification error:', error);
    }
  }

  // Get specific department status notifications for a user
  async getDepartmentNotificationsForUser(userId, departmentId = null) {
    try {
      const user = await User.findById(userId).populate('department');
      if (!user) {
        return [];
      }

      // Get user's department or use provided departmentId
      const targetDepartmentId = departmentId || user.department?._id;
      if (!targetDepartmentId) {
        return [];
      }

      const department = await Department.findById(targetDepartmentId).populate('course', 'title');
      if (!department) {
        return [];
      }

      const notifications = [];

      // Check if department is cancelled and user should be notified
      if (department.status === 'CANCELLED') {
        notifications.push({
          type: 'ERROR',
          title: `Department Cancelled: ${department.name}`,
          message: `Your department "${department.name}" has been cancelled. Please contact support for further assistance.`,
          metadata: {
            departmentId: department._id,
            departmentName: department.name,
            status: department.status,
            courseTitle: department.course?.title || 'N/A'
          },
          urgent: true
        });
      }

      // Check if department just started (ongoing status)
      if (department.status === 'ONGOING' && department.startDate) {
        const today = new Date();
        const startDate = new Date(department.startDate);
        const daysDiff = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));

        // Show notification if department started within the last 3 days
        if (daysDiff <= 3) {
          notifications.push({
            type: 'SUCCESS',
            title: `Department Started: ${department.name}`,
            message: `Your department "${department.name}" has started! You can now access the course materials and begin learning.`,
            metadata: {
              departmentId: department._id,
              departmentName: department.name,
              status: department.status,
              courseTitle: department.course?.title || 'N/A',
              startDate: department.startDate
            },
            urgent: false
          });
        }
      }

      return notifications;

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
const departmentStatusScheduler = new DepartmentStatusScheduler();

export default departmentStatusScheduler;
