# Redux API Implementation

This document outlines all the Redux APIs created from your server controllers for the Learning Management System admin panel.

## Overview

All server controller endpoints have been converted into Redux RTK Query APIs with proper TypeScript support, caching, and state management. The implementation follows a consistent pattern and includes proper error handling and data synchronization.

## Created API Files

### 1. AuthApi.js
**Endpoints:**
- `userRegister` - Register new users
- `userLogin` - User authentication
- `userLogout` - Logout functionality
- `getUserProfile` - Get current user profile
- `forgotPassword` - Password reset request
- `resetPassword` - Reset password with token

### 2. UserApi.js
**Endpoints:**
- `getAllUsers` - Get paginated list of users with filters
- `getUserById` - Get specific user details
- `updateProfile` - Update user profile
- `updateAvatar` - Upload/update user avatar
- `deleteUser` - Delete user (soft/hard delete based on permissions)

### 3. CourseApi.js
**Endpoints:**
- `createCourse` - Create new course
- `getCourses` - Get paginated courses with filters
- `getCourseById` - Get specific course details
- `updateCourse` - Update course information
- `deleteCourse` - Delete course

### 4. AssignmentApi.js
**Endpoints:**
- `createAssignment` - Create new assignment
- `getAllAssignments` - Get assignments (with optional course filter)
- `getAssignmentById` - Get specific assignment
- `updateAssignment` - Update assignment details
- `deleteAssignment` - Delete assignment

### 5. BatchApi.js
**Endpoints:**
- `createBatch` - Create new batch
- `assignInstructor` - Assign instructor to batch
- `addStudentToBatch` - Add student to batch
- `removeStudentFromBatch` - Remove student from batch
- `getAllBatches` - Get paginated batches
- `getBatchById` - Get specific batch
- `updateBatch` - Update batch information
- `deleteBatch` - Delete batch

### 6. QuizApi.js
**Endpoints:**
- `createQuiz` - Create new test
- `getAllQuizzes` - Get paginated tests with filters
- `getQuizById` - Get specific test
- `updateQuiz` - Update test details
- `deleteQuiz` - Delete test

### 7. EnrollmentApi.js
**Endpoints:**
- `enrollStudent` - Enroll student in course
- `unenrollStudent` - Unenroll student from course
- `getAllEnrollments` - Get paginated enrollments
- `getStudentEnrollments` - Get enrollments for specific student
- `getCourseEnrollments` - Get enrollments for specific course
- `updateEnrollment` - Update enrollment status
- `deleteEnrollment` - Delete enrollment

### 8. ProgressApi.js
**Endpoints:**
- `initializeProgress` - Initialize progress tracking
- `updateProgress` - Update student progress
- `upgradeLevel` - Upgrade student level
- `getMyProgress` - Get current user's progress
- `getCourseProgress` - Get progress for all students in course

### 9. SubmissionApi.js
**Endpoints:**
- `createSubmission` - Submit assignment
- `resubmitAssignment` - Resubmit assignment
- `getSubmissionByAssignment` - Get all submissions for assignment
- `getMySubmissions` - Get current user's submissions
- `gradeSubmission` - Grade student submission

### 10. CertificateApi.js
**Endpoints:**
- `issueCertificate` - Issue certificate to student
- `getCertificateById` - Get specific certificate
- `getStudentCertificates` - Get certificates for student
- `getCourseCertificates` - Get certificates for course
- `revokeCertificate` - Revoke certificate

### 11. AuditApi.js
**Endpoints:**
- `getAllAudits` - Get paginated audit logs
- `getAuditById` - Get specific audit log
- `deleteAudit` - Delete audit log

### 12. AttemptedQuizApi.js
**Endpoints:**
- `attemptQuiz` - Submit quiz attempt
- `getMyAttempts` - Get current user's quiz attempts
- `getAttemptsQuiz` - Get all attempts for specific quiz
- `getAttemptById` - Get specific quiz attempt
- `deleteAttempt` - Delete quiz attempt

## Slice Files Created

### 1. UserSlice.js
**State Management:**
- User filters (search, role, sorting)
- Pagination state
- Bulk operations
- Selected users

### 2. CourseSlice.js
**State Management:**
- Course filters and pagination
- Course creation form data
- Module management
- Bulk operations
- Selected courses

## Store Configuration

The Redux store has been updated to include:
- All 12 API reducers and middleware
- Slice reducers for local state management
- Proper middleware configuration for all RTK Query APIs

## Usage Examples

### Basic API Usage
```javascript
import { useGetAllUsersQuery, useDeleteUserMutation } from '@/Redux/AllApi';

function UsersList() {
    const { data: users, isLoading } = useGetAllUsersQuery({
        page: 1,
        limit: 20,
        search: "john",
        role: "STUDENT"
    });
    
    const [deleteUser] = useDeleteUserMutation();
    
    const handleDelete = async (userId) => {
        try {
            await deleteUser(userId).unwrap();
            // Success handling
        } catch (error) {
            // Error handling
        }
    };
}
```

### Using Slices for Local State
```javascript
import { useSelector, useDispatch } from 'react-redux';
import { setUserFilters, clearUserFilters } from '@/Redux/Slice';

function UserFilters() {
    const dispatch = useDispatch();
    const filters = useSelector(state => state.user.userFilters);
    
    const handleFilterChange = (newFilters) => {
        dispatch(setUserFilters(newFilters));
    };
}
```

### Importing Everything
```javascript
// Import all APIs and hooks
import {
    useGetAllUsersQuery,
    useCreateCourseMutation,
    useGetAllBatchesQuery,
    // ... all other hooks
} from '@/Redux';

// Import slice actions
import {
    setUserFilters,
    setCourseFilters,
    // ... all other actions
} from '@/Redux';
```

## Features Included

1. **Automatic Caching** - RTK Query handles caching automatically
2. **Optimistic Updates** - UI updates immediately, rolls back on error
3. **Background Refetching** - Data stays fresh automatically
4. **Error Handling** - Consistent error handling across all APIs
5. **Loading States** - Built-in loading indicators
6. **Tag-based Invalidation** - Smart cache invalidation
7. **TypeScript Ready** - All APIs are properly typed
8. **Pagination Support** - Built-in pagination for list endpoints
9. **Search and Filtering** - Query parameter support for filtering
10. **Bulk Operations** - State management for bulk selections

## Next Steps

1. **Add the missing helper files** if not present:
   - `@/Helper/axiosBaseQuery.js`
   - `@/Helper/axiosInstance.js`

2. **Update your components** to use the new APIs instead of direct API calls

3. **Add proper error boundaries** for better error handling

4. **Consider adding more slice files** for other UI states as needed

5. **Add middleware for logging/debugging** if required

All APIs follow the same pattern as your existing AuthApi.js and are ready to use in your components!
