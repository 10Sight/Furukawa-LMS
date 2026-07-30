# SDP Portal: Admin Dashboard Manual

This manual provides a detailed reference guide for the **Admin Dashboard** (`admin/src/pages/Home.jsx`) of the Furukawa Skill Development Portal (SDP) Learning Management System (LMS). This dashboard serves as the central administrative hub for tracking operator statistics, training courses, quiz performance, and department-wise skill efficiencies.

---
**[INSERT IMAGE: Admin Dashboard Home Overview]**
---

## Table of Contents
1. [Global Dashboard Controls](#1-global-dashboard-controls)
2. [Key Performance Indicators (KPI) / Stat Cards](#2-key-performance-indicators-kpi--stat-cards)
3. [Quick Actions Panel](#3-quick-actions-panel)
4. [Recent Activity & System Health](#4-recent-activity--system-health)
5. [In-Depth Chart Guide](#5-in-depth-chart-guide)
   - [Dojo Hiring Trend Chart](#51-dojo-hiring-trend-chart)
   - [Dojo Handover Comparison Chart](#52-dojo-handover-comparison-chart)
   - [Contractor-wise Operator Chart](#53-contractor-wise-operator-chart)
   - [Test Paper Pass Chart](#54-test-paper-pass-chart)
   - [Department Quiz Chart](#55-department-quiz-chart)
   - [Skill Matrix Efficiency Chart](#56-skill-matrix-efficiency-chart)

---

## 1. Global Dashboard Controls

At the top of the dashboard, you will find the global filters that affect the statistical cards and specific query charts:

*   **Date Filter (`DashboardDateFilter`):** Allows administrators to select a custom date range (Start Date and End Date). This filters the Dojo Hiring statistics and synchronizes with various interactive charts to slice data for specific quarters, months, or days.

---
**[INSERT IMAGE: Dashboard Date Filter Controls]**
---

---

## 2. Key Performance Indicators (KPI) / Stat Cards

The top row of the dashboard presents four critical summaries displaying the current state of the organization. Each card includes a relative icon, a total value count, a brief description, and a trend indicator or link to drill down further.

---
**[INSERT IMAGE: Statistics Stat Cards Row]**
---

### A. Total Operators
*   **Title:** Total Operators (`home.totalOperators`)
*   **Value:** Total number of registered operator profiles in the LMS database.
*   **Description:** "Registered Operators" (`home.registeredOperators`)
*   **Interactive Action:** Clicking this card redirects to the Employee Management page (`/admin/employees`).
*   **Trend/Indicator:** Displays the count of currently active operators (e.g., `X Active`).

### B. Total Sections
*   **Title:** Total Sections / Departments (`home.totalSections`)
*   **Value:** Total count of departments / operational sections registered in the system.
*   **Description:** "Learning Groups" (`home.learningGroups`)
*   **Interactive Action:** Clicking this card redirects to the Department Management page (`/admin/departments`).
*   **Trend/Indicator:** Displays the count of completed/active departments.

### C. Total Courses
*   **Title:** Total Courses (`home.totalCourses`)
*   **Value:** Total number of academic or procedural courses configured in the portal.
*   **Description:** "Available Courses" (`home.availableCourses`)
*   **Interactive Action:** Clicking this card redirects to the Courses list (`/admin/courses`).
*   **Trend/Indicator:** Displays the count of currently published courses (e.g., `X Published`).

### D. Dojo Hiring
*   **Title:** Dojo Hiring (`home.dojoHiring`)
*   **Value:** Total number of candidates registered at the Dojo Training Center within the selected date range.
*   **Description:** "Temp Candidates" (`home.tempCandidates`)
*   **Interactive Action:** Clicking this card redirects to the Employee page pre-filtered for temporary candidates (`/admin/employees?type=temporary`).

---

## 3. Quick Actions Panel

Located at the bottom right, this panel gives administrators one-click access to the most frequent daily management workflows:

---
**[INSERT IMAGE: Quick Actions Sidebar Panel]**
---

*   **Add New Course (`home.addNewCourse`):** Redirects to `/admin/add-course` to create a new module, complete with theoretical tests and video lessons.
*   **Manage Sections (`home.manageSections`):** Redirects to `/admin/departments` to configure the workspace structure (departments, sections, lines, and sub-sections).
*   **View Reports (`home.viewReports`):** Redirects to the Analytics dashboard (`/admin/analytics`) for customized spreadsheets and attendance exports.
*   **Operator Management (`home.operatorManagement`):** Redirects to `/admin/employees` to edit profiles, shift assignments, and credentials.

---

## 4. Recent Activity & System Health

---
**[INSERT IMAGE: Recent Activity Card & System Health Indicators]**
---

*   **Recent Activity Card (`RecentActivityCard`):** A lazy-loaded activity stream showing recent actions executed in the admin panel (e.g., test creation, user registration, evaluation approvals).
*   **System Health/Overview Card (`SystemOverviewCard`):** Displays real-time operational diagnostics such as active server latency, database connectivity logs, and background sync worker states.

---

## 5. In-Depth Chart Guide

Each chart is wrapped in a dynamic `LazyContainer` to optimize initial page-load speed. They are built using Highcharts or Recharts and support multiple filters.

---

### 5.1. Dojo Hiring Trend Chart
*   **Location/Component:** [DojoHiringTrendChart.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/charts/DojoHiringTrendChart.jsx)
*   **Purpose:** Tracks and forecasts candidate intake trends into the Dojo Training facility. Useful for monitoring recruitment speed and candidate gender metrics.

---
**[INSERT IMAGE: Dojo Hiring Trend Chart]**
---

*   **Key Controls:**
    *   **Timeframe Buttons:** Toggle between **Daily**, **Monthly**, and **Yearly** views.
    *   **Date Selectors:** Specific date filters depending on the timeframe (e.g., Month picker for Monthly view, Calendar picker for Daily view).
    *   **Gender Filter:** Checkboxes to toggle the visibility of Male, Female, and Other candidate counts on the chart.
*   **Data Representation:** A stacked column chart. Columns show total candidates, while segment colors distinguish gender demographics. Hovering over a column displays tooltips detailing exact numbers.

---

### 5.2. Dojo Handover Comparison Chart
*   **Location/Component:** [DojoHandoverComparisonChart.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/charts/DojoHandoverComparisonChart.jsx)
*   **Purpose:** Monitors deployment efficiency by comparing the **Expected** handover requests from the shop floor against the **Actual** physical handovers completed by the Dojo training team.

---
**[INSERT IMAGE: Dojo Handover Comparison Chart]**
---

*   **Key Controls:**
    *   **Timeframe Toggle:** Group handovers by Daily, Monthly, or Yearly targets.
    *   **Interactive Legend:** Click department color boxes to toggle specific departments on/off in the visual comparison.
*   **Data Representation:** A multi-series column chart. For each period, an **Expected** requirement bar (grouped by department colors) is placed next to an **Actual** handover bar (typically rendered in blue) to instantly flag under-fulfillments.

---

### 5.3. Contractor-wise Operator Chart
*   **Location/Component:** [ContractorWiseOperatorChart.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/charts/ContractorWiseOperatorChart.jsx)
*   **Purpose:** Tracks contractor headcount trends. Identifies the main sources of contract workforce and monitors vendor-specific hiring trends over time.

---
**[INSERT IMAGE: Contractor-wise Operator Distribution Chart]**
---

*   **Key Controls:**
    *   **Timeframe Filters:** Slice historical contractor data by Daily, Monthly, or Yearly brackets.
    *   **Contractor Dropdown Filter:** Multi-select contractor names to narrow down the view to specific hiring agencies.
*   **Data Representation:** A stacked column/bar chart displaying the contractor distribution. Each vendor is assigned a unique color code to trace headcounts easily.

---

### 5.4. Test Paper Pass Chart
*   **Location/Component:** [TestPaperPassChart.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/charts/TestPaperPassChart.jsx)
*   **Purpose:** Displays grading metrics for courses and theoretical assessments. Helps instructors gauge quiz difficulty and passing rates.

---
**[INSERT IMAGE: Test Paper Pass Rate Chart]**
---

*   **Key Controls:**
    *   **Quiz Selector Dropdown:** Focuses the graph on a specific test paper or quiz from the LMS library.
    *   **Date Range Pickers:** Filter scores for a specific timeframe.
*   **Data Representation:** Stacked bars illustrating the proportion of operators who successfully cleared the pass threshold vs. those who failed.

---

### 5.5. Department Quiz Chart
*   **Location/Component:** [DepartmentQuizChart.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/charts/DepartmentQuizChart.jsx)
*   **Purpose:** Shows pass/fail ratios of quizzes specifically categorized by structural divisions (Departments and Sections). Useful for identifying which shop floors need training reviews.

---
**[INSERT IMAGE: Department Quiz Chart]**
---

*   **Key Controls:**
    *   **Department Filter:** Dropdown to select a target Department.
    *   **Section Filter:** Dropdown to select a Section (dynamically populated based on the chosen Department).
    *   **Date Range Inputs:** Clear/Apply custom start and end dates.
*   **Data Representation:** Dual-color grouped columns. Green columns represent the total passing attempts, and red columns represent the failing attempts.

---

### 5.6. Skill Matrix Efficiency Chart
*   **Location/Component:** [EfficiencyChart.jsx](file:///d:/10Sight%20Agency/Sarvagaya%20Institute/FME/Furukawa-LMS/Furukawa-LMS-main/admin/src/components/charts/EfficiencyChart.jsx)
*   **Purpose:** The most complex and vital chart on the dashboard. It visualizes the overall skill efficiency of operators based on evaluations recorded in the Skill Matrix. It excludes Dojo/temporary candidates and focuses solely on the permanent workforce.

---
**[INSERT IMAGE: Skill Matrix Efficiency Chart - Top Level Overview]**
---

#### Understanding the Metrics:
*   **Total Efficiency (Orange Bar):** The average efficiency of all mapped operators under the current filter criteria, regardless of today's attendance status.
*   **Present Operator Efficiency (Blue Bar):** The average efficiency of operators who are marked as `Present`, `Late`, or `Half Day` in today's attendance logs.
*   **Absent Operator Efficiency (Red Bar):** The average efficiency of operators marked as `Absent`.
*   **Minimum Target Efficiency (Green Reference Line):** Displays the base efficiency target configured for the selected line/section.

#### The Drill-Down Workflow:
This chart features an interactive hierarchical navigation structure. Clicking on any bar zooms into the next structural sublevel:

```
[Level 1: Department] -> Averages efficiencies of sections within the department
       │
       ▼
[Level 2: Section]    -> Averages efficiencies of lines within the section
       │
       ▼
[Level 3: Line]       -> Averages efficiencies of sub-sections within the line
       │
       ▼
[Level 4: Sub-Section]-> Averages efficiencies of individual operators in the sub-section
       │
       ▼
[Level 5: Attendance] -> Groups operators by status (Present vs. Absent)
       │
       ▼
[Level 6: Operator]   -> Compares individual efficiency percentages side-by-side
```

*   **Back Navigation:** A breadcrumb trail appears at the top left of the chart. Clicking a parent folder or the 'Reset' button immediately takes you back up the hierarchy.
*   **Legend Toggles:** Clicking on metric names in the legend (e.g., clicking 'Min Efficiency') allows you to hide or show that metric/line on the active view.

---
**[INSERT IMAGE: Skill Matrix Efficiency Chart - Drill Down Sub-Level]**
---
