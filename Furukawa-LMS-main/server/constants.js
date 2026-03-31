export const UserRolesEnum = {
    ADMIN: "ADMIN",
    INSTRUCTOR: "INSTRUCTOR",
    STUDENT: "STUDENT",
    SUPERADMIN: "SUPERADMIN",
    CUSTOM: "CUSTOM"
};

export const AvailableUserRoles = Object.values(UserRolesEnum);



export const UserStatusEnum = {
    PRESENT: "PRESENT",
    ON_LEAVE: "ON_LEAVE",
    LEFT: "LEFT",
};

export const LegacyUserStatusEnum = {
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    PENDING: "PENDING",
    BANNED: "BANNED",
};

export const AvailableUserStatus = Object.values(UserStatusEnum);

export const mapLegacyStatusToNew = (status) => {
    switch (status) {
        case LegacyUserStatusEnum.ACTIVE:
            return UserStatusEnum.PRESENT;
        case LegacyUserStatusEnum.PENDING:
            return UserStatusEnum.ON_LEAVE;
        case LegacyUserStatusEnum.SUSPENDED:
        case LegacyUserStatusEnum.BANNED:
            return UserStatusEnum.LEFT;
        default:
            return status;
    }
};

export const UserLoginType = {
    FACEBOOK: "FACEBOOK",
    EMAIL_PASSWORD: "EMAIL_PASSWORD",
};

export const AvailableSocialLogins = Object.values(UserLoginType);

export const CourseType = {
    BEGGINER: "BEGGINER",
    INTERMEDIATE: "INTERMEDIATE",
    ADVANCED: "ADVANCED"
};

export const AvailableCourseDifficultyLevels = Object.values(CourseType);

export const CourseStatus = {
    DRAFT: "DRAFT",
    PUBLISHED: "PUBLISHED",
    ARCHIVED: "ARCHIVED"
};

export const AvailableCourseStatus = Object.values(CourseStatus);

export const StudentStatus = {
    PASSED: "PASSED",
    FAILED: "FAILED",
    IN_PROGRESS: "IN_PROGRESS"
};

export const AvailableStudentStatus = Object.values(StudentStatus);

// Units (e.g., for grouping users by unit)
export const UnitEnum = {
    UNIT_1: "UNIT_1",
    UNIT_2: "UNIT_2",
    UNIT_3: "UNIT_3",
    UNIT_4: "UNIT_4",
    UNIT_5: "UNIT_5",
};

export const AvailableUnits = Object.values(UnitEnum);
