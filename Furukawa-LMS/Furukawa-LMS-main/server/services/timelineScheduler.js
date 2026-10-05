import cron from 'node-cron';
import ModuleTimeline from '../models/moduleTimeline.model.js';
import Progress from '../models/progress.model.js';
import Course from '../models/course.model.js';
import User from '../models/auth.model.js';

class TimelineScheduler {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  // Initialize the scheduler
  init() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Schedule timeline enforcement every hour
      const enforcementJob = cron.schedule('0 * * * *', async () => {
        await this.processTimelineEnforcement();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Schedule warning notifications every 30 minutes
      const warningJob = cron.schedule('*/30 * * * *', async () => {
        await this.sendTimelineWarnings();
      }, {
        scheduled: false,
        timezone: "UTC"
      });

      // Store jobs for management
      this.jobs.set('enforcement', enforcementJob);
      this.jobs.set('warnings', warningJob);

      // Start the jobs
      enforcementJob.start();
      warningJob.start();

      this.isInitialized = true;

    } catch (error) {
      // Failed to initialize timeline scheduler
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
      // Error stopping timeline scheduler
    }
  }

  // Manual enforcement trigger
  async processTimelineEnforcement() {
    const startTime = Date.now();
    let processedCount = 0;
    let demotionCount = 0;
    const errors = [];

    try {
      // Get timelines that need processing
      const timelinesToProcess = await ModuleTimeline.getTimelinesToProcess();

      for (const timeline of timelinesToProcess) {
        try {
          const result = await this.processSingleTimeline(timeline);
          processedCount++;
          demotionCount += result.demotions;

        } catch (error) {
          errors.push({
            timelineId: timeline._id,
            moduleName: timeline.module?.title,
            departmentName: timeline.department?.name,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      // Timeline enforcement errors tracked

      return { processedCount, demotionCount, errors };

    } catch (error) {
      return { processedCount: 0, demotionCount: 0, errors: [{ error: error.message }] };
    }
  }

  // Process a single timeline
  async processSingleTimeline(timeline) {
    const now = new Date();
    let demotions = 0;

    // Get students in this department
    const departmentStudents = await User.find({
      _id: { $in: timeline.department.students },
      role: 'STUDENT'
    }).select('_id');

    // Get progress records for these students
    const progressRecords = await Progress.find({
      course: timeline.course._id,
      student: { $in: departmentStudents.map(s => s._id) }
    });

    for (const progress of progressRecords) {
      // Check if student has completed this module
      const hasCompleted = progress.completedModules.some(
        cm => cm.moduleId.toString() === timeline.module._id.toString()
      );

      if (!hasCompleted && !timeline.hasStudentMissedDeadline(progress.student)) {
        // Check if grace period has passed
        const graceDeadline = new Date(
          timeline.deadline.getTime() + (timeline.gracePeriodHours * 60 * 60 * 1000)
        );

        if (now > graceDeadline) {
          // Find the previous module to demote to
          const course = await Course.findById(timeline.course._id).populate('modules');
          const sortedModules = course.modules.sort((a, b) => a.order - b.order);
          const currentModuleIndex = sortedModules.findIndex(
            m => m._id.toString() === timeline.module._id.toString()
          );

          if (currentModuleIndex > 0) {
            const previousModule = sortedModules[currentModuleIndex - 1];

            // Demote student
            const demoted = await progress.demoteToModule(previousModule._id);

            if (demoted) {
              // Record timeline violation
              progress.addTimelineViolation(
                timeline.module._id,
                timeline.deadline,
                timeline.module._id,
                previousModule._id
              );

              // Add notification
              progress.addTimelineNotification(
                'DEMOTION',
                timeline.module._id,
                `You have been moved back to "${previousModule.title}" due to missing the deadline for "${timeline.module.title}".`
              );

              await progress.save();

              // Track in timeline
              timeline.addMissedDeadlineStudent(progress.student, previousModule._id);
              timeline.markStudentDemoted(progress.student);

              demotions++;
            }
          }
        }
      }
    }

    // Update processing timestamp
    timeline.lastProcessedAt = now;
    await timeline.save();

    return { demotions };
  }

  // Send timeline warnings
  async sendTimelineWarnings() {
    const startTime = Date.now();
    let warningsSent = 0;
    const errors = [];

    try {
      const now = new Date();
      const upcomingTimelines = await ModuleTimeline.getUpcomingWarnings();

      for (const timeline of upcomingTimelines) {
        try {
          const result = await this.processSingleTimelineWarnings(timeline, now);
          warningsSent += result.warnings;

        } catch (error) {
          errors.push({
            timelineId: timeline._id,
            moduleName: timeline.module?.title,
            departmentName: timeline.department?.name,
            error: error.message
          });
        }
      }

      const duration = Date.now() - startTime;

      // Timeline warning errors tracked

      return { warningsSent, errors };

    } catch (error) {
      return { warningsSent: 0, errors: [{ error: error.message }] };
    }
  }

  // Process warnings for a single timeline
  async processSingleTimelineWarnings(timeline, now) {
    let warnings = 0;

    const timeUntilDeadline = timeline.deadline.getTime() - now.getTime();
    const hoursUntilDeadline = timeUntilDeadline / (1000 * 60 * 60);

    // Check each warning period
    for (const warningHours of timeline.warningPeriods) {
      if (hoursUntilDeadline <= warningHours && hoursUntilDeadline > (warningHours - 1)) {
        const warningType = warningHours === 168 ? '7_DAYS' :
          warningHours === 72 ? '3_DAYS' :
            warningHours === 24 ? '1_DAY' : 'CUSTOM';

        // Get students who need this warning
        const departmentStudents = await User.find({
          _id: { $in: timeline.department.students },
          role: 'STUDENT'
        }).select('_id');

        const progressRecords = await Progress.find({
          course: timeline.course._id,
          student: { $in: departmentStudents.map(s => s._id) }
        });

        for (const progress of progressRecords) {
          // Check if student has completed module
          const hasCompleted = progress.completedModules.some(
            cm => cm.moduleId.toString() === timeline.module._id.toString()
          );

          if (!hasCompleted && timeline.shouldSendWarning(progress.student, warningType)) {
            // Send warning
            const warningMessage = `Reminder: You have ${Math.ceil(hoursUntilDeadline)} hours left to complete "${timeline.module.title}" before the deadline.`;

            progress.addTimelineNotification(
              'WARNING',
              timeline.module._id,
              warningMessage
            );

            await progress.save();

            // Record warning sent
            timeline.recordWarningSent(progress.student, warningType);
            warnings++;
          }
        }
      }
    }

    if (warnings > 0) {
      await timeline.save();
    }

    return { warnings };
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
const timelineScheduler = new TimelineScheduler();

export default timelineScheduler;
