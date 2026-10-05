# Project Analysis: Furukawa LMS

## Overview
Furukawa LMS is a full-stack Learning Management System designed to handle various user roles (Student, Instructor, Admin, SuperAdmin) with real-time capabilities. It manages courses, quizzes, assignments, users, and departments.

## Project Structure
The project is a monorepo-style structure with distinct directories for frontend and backend:
-   `admin/`: Frontend application (React + Vite).
-   `server/`: Backend application (Node.js + Express).
-   `scripts/`: Utility scripts.
-   `logs/`: Server logs.

## Technology Stack

### Frontend (`admin/`)
-   **Framework**: React 19 with Vite 7.
-   **State Management**: Redux Toolkit, React Redux.
-   **Styling**: Tailwind CSS v4, Material UI (MUI) v7, Radix UI primitives.
-   **Routing**: React Router DOM v7 (Role-based code splitting with `React.lazy`).
-   **HTTP Client**: Axios.
-   **Real-time**: Socket.io Client.
-   **Forms**: React Hook Form + Zod validation.
-   **Utilities**: Date-fns, Crypto-js, ExcelJS.

### Backend (`server/`)
-   **Runtime**: Node.js (ES Modules).
-   **Framework**: Express.js 5.
-   **Database**: MySQL (accessed via `mysql2` driver).
-   **ORM/ODM**: Custom Class-based Data Access Layer (DAL) mimicking Mongoose API (e.g., `User.find()`, `user.save()`) using raw SQL queries.
-   **Real-time**: Socket.io Server (Authentication, Room-based signaling).
-   **Authentication**: JWT (Access & Refresh tokens), Bcrypt for password hashing.
-   **File Handling**: Multer (Cloudinary integration likely present based on dependencies).
-   **Logging**: Winston, Morgan.

## Key Features & Architecture
1.  **Role-Based Access Control (RBAC)**:
    -   Dedicated layouts and routes for `SuperAdmin`, `Admin`, `Instructor`, and `Student`.
    -   `RequireAccess` and `ProtectedRoute` components enforce permissions.
2.  **Real-Time Interactions**:
    -   Socket.io handles test start/submission, assignment notifications, and general user alerts.
    -   Room-based channels for Departments and Users.
3.  **Database Design**:
    -   Relational MySQL database.
    -   Key Tables: `users`, `departments`, `courses`, `quizzes`, `assignments`, `enrollments`.
    -   Custom model classes handle SQL generation, effectively abstracting `pool.query`.
4.  **Deployment**:
    -   Frontend: Vite build.
    -   Backend: Node.js server.
    -   Environment variables control configuration (Ports, DB credentials, JWT secrets).

## Data Models (Inferred)
-   **User**: Handles authentication, roles, and profile data. JSON fields used for `enrolledCourses`, `departments`.
-   **Course/Module/Lesson**: Hierarchical content structure.
-   **Quiz/Attempt**: Assessment engine.
-   **Department/Line/Machine**: Organizational hierarchy for manufacturing context.

## Observations
-   **Hybrid Data Storage**: Some relational data (e.g., `departments` in `User`) is stored as JSON strings/arrays within columns, which mimics NoSQL behavior in a SQL database.
-   **Custom ORM**: The backend uses a custom active record pattern rather than a standard ORM like Sequelize or TypeORM. This gives fine-grained control but requires careful maintenance of SQL queries.
-   **Modern Frontend**: Uses the latest React 19 and Tailwind 4, indicating a very recent tech stack update.
