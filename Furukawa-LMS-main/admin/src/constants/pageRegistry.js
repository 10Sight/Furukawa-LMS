import { getIcon } from "./IconRegistry";

// Page registry — single source of truth for all assignable pages.
// layout: which layout the page belongs to (determines which sidebar it appears in)
// key: unique identifier used in customRole.allowedPages[]

const normalizeAllowedPages = (user) => {
    const allowedPages = user?.customRole?.allowedPages;
    if (typeof allowedPages === 'string') {
        try { return JSON.parse(allowedPages); } catch (e) { return []; }
    }
    return Array.isArray(allowedPages) ? allowedPages : [];
};

export const hasRestrictions = (user) => {
    if (!user) return false;

    // Superadmins and Master Admins have full access
    const isMasterAdmin =
        user.role === 'SUPERADMIN' ||
        user.role === 'ADMIN' ||
        user.isAdmin === 1 ||
        user.isAdmin === true;

    if (isMasterAdmin) return false;

    // Trainers and Employees (Operators) are ALWAYS restricted to their assigned pages.
    // Custom roles are also restricted unless they are explicitly assigned to system Admin roles.
    if (user.isTrainer || user.isEmployee || user.role === 'CUSTOM') {
        return true;
    }

    return false;
};

export const getPagesByLayout = (layout) =>
    PAGE_REGISTRY.filter((p) => p.layout === layout && p.label && p.link);

export const getPageByLink = (link, layout) =>
    PAGE_REGISTRY
        .filter((p) => p.layout === layout && (link === p.link || link.startsWith(`${p.link}/`)))
        .sort((a, b) => b.link.length - a.link.length)[0];

export const getKeyByPath = (path, layout) => {
    let lookupPaths = [path];
    if (path.startsWith("/portal/")) {
        const subPath = path.slice(8); // remove "/portal/"
        lookupPaths.push(`/admin/${subPath}`);
        lookupPaths.push(`/cms/${subPath}`);
        lookupPaths.push(`/dashboard/${subPath}`);
    }

    for (const p of lookupPaths) {
        // Check aliases/prefixes FIRST
        const aliases = PAGE_REGISTRY.filter(item => item.prefix && p.startsWith(item.prefix) && item.layout === layout);
        if (aliases.length > 0) {
            return aliases.sort((a, b) => b.prefix.length - a.prefix.length)[0].key;
        }

        // Check direct registry matches SECOND
        const page = getPageByLink(p, layout);
        if (page) return page.key;
    }

    return null;
};

export const isPageAllowed = (key, allowedPages) => {
    if (!allowedPages || allowedPages.length === 0) return true;
    return allowedPages.includes(key);
};

export const getAllowedPagesForLayout = (layout, user) => {
    const layoutPages = getPagesByLayout(layout);
    if (!hasRestrictions(user)) return layoutPages;
    if (layout === 'student' && user?.isEmployee) return layoutPages;
    if (layout === 'trainer' && user?.isTrainer) return layoutPages;

    const allowed = new Set(normalizeAllowedPages(user));
    return layoutPages.filter((p) => allowed.has(p.key));
};

export const filterTabsByAllowedPages = (tabs, layout, user) => {
    if (!hasRestrictions(user)) return tabs;
    const allowed = new Set(normalizeAllowedPages(user));

    return tabs.filter((tab) => {
        // ALWAYS allow the layout root (Dashboard) by default ONLY if not restricted
        // If restricted, they must have explicit access to the dashboard key
        const rootPath = `/${layout}`;
        if (tab.link === rootPath) return !hasRestrictions(user) || allowed.has(tab.key || layout);

        const page = getPageByLink(tab.link, layout);
        if (!page) {
            // Check if it's a dynamic management page (like /admin/manage-role/5)
            if (tab.isDynamic) return true;
            return false; // Hide pages not in registry
        }
        return allowed.has(page.key);
    });
};

export const isPathAllowedForUser = (pathname, layout, user) => {
    if (!hasRestrictions(user)) return true;
    if (layout === 'student' && user?.isEmployee) return true;
    if (layout === 'trainer' && user?.isTrainer) return true;

    // For specific system layouts, check if restricted
    if (pathname === `/${layout}`) {
        if (!hasRestrictions(user)) return true;

        // Custom roles: If they have ANY allowed page that belongs to this layout,
        // we allow them to enter the layout root. The layout component itself 
        // will then redirect them to the first actually allowed tab.
        const allowed = normalizeAllowedPages(user);
        const layoutPages = PAGE_REGISTRY.filter(p => p.layout === layout && p.key);
        const hasAnyAllowedPageInLayout = layoutPages.some(p => allowed.includes(p.key));

        if (hasAnyAllowedPageInLayout) return true;

        // Fallback for specific dashboard keys
        return allowed.includes(layout) ||
            allowed.includes(`${layout}-home`) ||
            allowed.includes(`${layout}-dashboard`) ||
            allowed.includes('dashboard');
    }

    // Custom check: if they are accessing quiz page or take-test page, they can access if they have test-paper OR student-courses OR courses
    const allowed = normalizeAllowedPages(user);
    if (pathname.includes("/quiz/") || pathname.includes("/take-test/")) {
        if (allowed.includes("test-paper") || allowed.includes("student-courses") || allowed.includes("courses")) return true;
    }

    const pageKey = getKeyByPath(pathname, layout);
    if (!pageKey) {
        // Fallback: Check if the path is within any layout the user has access to
        // This handles cases where a user in Layout A is accessing a page from Layout B
        const otherLayouts = ['admin', 'dashboard', 'trainer', 'student', 'cms'].filter(l => l !== layout);
        for (const l of otherLayouts) {
            const k = getKeyByPath(pathname, l);
            if (k && normalizeAllowedPages(user).includes(k)) return true;
        }

        // Allow common dynamic paths if we can't map them but they are within the layout
        if (pathname.startsWith(`/${layout}/`)) {
            // For student/trainer/cms we are stricter
            if (layout !== 'admin' && layout !== 'dashboard' && layout !== 'custom') return false;
            return true;
        }
        return false;
    }

    if (layout === 'student' && user?.isEmployee) return true;
    return allowed.includes(pageKey);
};

export const getSidebarTabs = (currentLayout, user, t, hasPrivilege = () => true) => {
    const allowedKeys = new Set(normalizeAllowedPages(user));
    const isRestricted = hasRestrictions(user);

    // Filter registry for pages that should appear in the sidebar
    // "landing-page" is excluded here since it's already surfaced via the fixed "Back to Main Menu" button
    const sidebarPages = PAGE_REGISTRY.filter(p => p.label && p.link && p.key !== "landing-page");

    // A page is shown if:
    // 1. It belongs to the current layout OR the user has explicit cross-layout access to it
    // 2. The user is not restricted OR the page key is in allowedPages
    // 3. It's not the root dashboard of a DIFFERENT layout
    // 4. The user has the required privilege (if any)

    const tabs = sidebarPages.filter(p => {
        const isCurrentLayout = p.layout === currentLayout;
        const isAllowed = !isRestricted || allowedKeys.has(p.key) || (p.layout === 'student' && user?.isEmployee) || (p.layout === 'trainer' && user?.isTrainer);
        const isPrivileged = !p.privilege || hasPrivilege(p.privilege);

        // Root dashboard rule: Only show the dashboard of the CURRENT layout
        const isOtherLayoutDashboard = p.link === `/${p.layout}` && !isCurrentLayout;

        // Condition 1: If we are in a specific layout (admin, cms, dashboard, trainer, student),
        // strictly show only pages belonging to THAT layout.
        if (currentLayout !== "custom") {
            return isCurrentLayout && isAllowed && isPrivileged && !isOtherLayoutDashboard;
        }

        // Condition 2: If we are in the unified 'custom' layout, show pages across
        // all layouts that are explicitly granted via the custom role.
        const isExplicitlyAllowed = user?.customRole && allowedKeys.has(p.key);
        return isExplicitlyAllowed && isPrivileged && !isOtherLayoutDashboard;
    });

    // Map to the format layouts expect
    return tabs.map(p => {
        let link = p.link;
        if (currentLayout === "custom") {
            if (link.startsWith("/admin/")) {
                link = "/portal/" + link.slice(7);
            } else if (link.startsWith("/admin")) {
                link = "/portal" + link.slice(6);
            } else if (link.startsWith("/cms/")) {
                link = "/portal/" + link.slice(5);
            } else if (link.startsWith("/cms")) {
                link = "/portal" + link.slice(4);
            } else if (link.startsWith("/dashboard/")) {
                link = "/portal/" + link.slice(11);
            } else if (link.startsWith("/dashboard")) {
                link = "/portal" + link.slice(10);
            }
        }
        return {
            link,
            label: p.labelKey ? t(p.labelKey, p.label) : p.label,
            icon: getIcon(p.icon),
            key: p.key
        };
    });
};

export const getFirstAllowedPage = (layout, user, t) => {
    const tabs = getSidebarTabs(layout, user, t);
    return tabs.length > 0 ? tabs[0].link : null;
};

export const PAGE_REGISTRY = [
    // Admin layout
    { key: "dashboard", label: "Dashboard", labelKey: "nav.dashboard", layout: "admin", link: "/admin", icon: "IconLayoutDashboardFilled" },
    { key: "dojo-hiring", label: "DOJO Hiring", labelKey: "nav.dojoHiring", layout: "admin", link: "/admin/dojo-hiring", icon: "IconUser" },
    // { key: "trainers", label: "Instructors", labelKey: "nav.instructors", layout: "admin", link: "/admin/trainers", icon: "IconUser" },
    { key: "courses", layout: "admin", link: "/admin/courses" },
    { key: "departments", label: "Departments", labelKey: "nav.departments", layout: "admin", link: "/admin/departments", icon: "IconFolder" },
    { key: "skill-matrix", label: "Skill Evaluation", labelKey: "nav.skillMatrix", layout: "admin", link: "/admin/skill-matrix", icon: "IconStars" },
    { key: "multi-skilling", label: "Multi Skilling", labelKey: "nav.multiSkilling", layout: "admin", link: "/admin/multi-skilling", icon: "IconStars" },
    { key: "employees", label: "Operator", labelKey: "nav.trainees", layout: "admin", link: "/admin/employees", icon: "IconUsers" },
    { key: "contractors", label: "Contractors", labelKey: "nav.contractors", layout: "admin", link: "/admin/contractors", icon: "IconBuilding" },
    { key: "designations", label: "Designations", labelKey: "nav.designations", layout: "admin", link: "/admin/designations", icon: "IconId" },
    { key: "student-levels", layout: "admin", link: "/admin/student-levels" },
    { key: "quiz-monitoring", layout: "admin", link: "/admin/quiz-monitoring" },
    { key: "test-paper", label: "Test Paper", labelKey: "nav.testPaper", layout: "admin", link: "/admin/test-paper", icon: "IconFileText" },
    // { key: "attempt-requests", label: "Attempt Requests", labelKey: "nav.attemptRequests", layout: "admin", link: "/admin/attempt-requests", icon: "IconBell" },
    { key: "course-level-settings", label: "Course Level Settings", labelKey: "nav.courseLevelSettings", layout: "admin", link: "/admin/course-level-settings", icon: "IconLayersIntersect" },
    // { key: "certificate-templates", label: "Certificate Templates", labelKey: "nav.certificateTemplates", layout: "admin", link: "/admin/certificate-templates", icon: "IconTemplate" },
    { key: "analytics", label: "Recent Activity", labelKey: "nav.analytics", layout: "admin", link: "/admin/analytics", icon: "IconChartPie" },
    { key: "report", label: "Monthly Report", labelKey: "nav.report", layout: "admin", link: "/admin/report", icon: "IconClipboardList" },
    // { key: "10-cycle", label: "10 Cycle", labelKey: "nav.tenCycle", layout: "admin", link: "/admin/10-cycle", icon: "IconRepeat" },
    // { key: "3-day-monitoring", label: "3-Day Monitoring", labelKey: "nav.threeDayMonitoring", layout: "admin", link: "/admin/3-day-monitoring", icon: "IconCalendarCheck" },
    { key: "16-day-monitoring", layout: "admin", link: "/admin/16-day-monitoring" },
    { key: "handover-sheet", layout: "admin", link: "/admin/handover-sheet" },
    { key: "daily-production-report", label: "Daily Production Report", labelKey: "nav.dailyProductionReport", layout: "admin", link: "/admin/daily-production-report", icon: "IconReportAnalytics" },
    // { key: "dpr-manage", label: "DPR Setup", labelKey: "nav.dprManage", layout: "admin", link: "/admin/dpr-manage", icon: "IconSettings" },
    { key: "on-job-training", label: "On Job Training (OJT)", labelKey: "nav.onJobTraining", layout: "admin", link: "/admin/on-job-training", icon: "IconClipboardList" },
    { key: "role-manager", label: "Roles & Permissions", labelKey: "nav.rolesPermissions", layout: "admin", link: "/admin/role-manager", icon: "IconSettings" },
    { key: "settings", label: "Settings", labelKey: "nav.settings", layout: "admin", link: "/admin/settings", icon: "IconSettings" },
    { key: "all-users", label: "All Users", labelKey: "nav.allUsers", layout: "admin", link: "/admin/all-users", icon: "IconUsers" },
    { key: "mentors", label: "Mentors", labelKey: "nav.mentors", layout: "admin", link: "/admin/mentors", icon: "IconUserHeart" },
    // { key: "supervisors", label: "Supervisors", labelKey: "nav.supervisors", layout: "admin", link: "/admin/supervisors", icon: "IconUserShield" },
    // { key: "incharges", label: "Incharges", labelKey: "nav.incharges", layout: "admin", link: "/admin/incharges", icon: "IconUserCheck" },
    { key: "line-requirements", label: "Line Requirements", labelKey: "nav.lineRequirements", layout: "admin", link: "/admin/line-requirements", icon: "IconSettings" },
    { key: "revision-table", label: "Revision Table", labelKey: "nav.revisionTable", layout: "admin", link: "/admin/revision-table", icon: "IconHistory" },
    // { key: "report-clubbing", label: "Report Clubbing", layout: "admin", link: "/admin/report-clubbing", icon: "IconLayersDifference" },
    { key: "learning", label: "Improvement Evidence", labelKey: "nav.learning", layout: "admin", link: "/admin/learning", icon: "IconBook" },
    { key: "data-management", label: "Data Management", labelKey: "nav.dataManagement", layout: "admin", link: "/admin/data-management", icon: "IconDatabase" },
    // { key: "dojo-evaluation-test", label: "DOJO Evaluation Test", labelKey: "nav.evaluationTest", layout: "admin", link: "/admin/evaluation-test", icon: "IconClipboard" },

    // Dashboard-specific pages (often considered core Admin functions)
    { key: "dashboard-home", label: "Dashboard", labelKey: "nav.dashboard", layout: "dashboard", link: "/dashboard", icon: "IconLayoutDashboardFilled" },
    // { key: "onboarding-id", label: "Onboarding & ID", layout: "dashboard", link: "/dashboard/onboarding-id", icon: "IconId" },
    { key: "attendance", label: "Attendance", layout: "dashboard", link: "/dashboard/attendance", icon: "IconFingerprint" },
    { key: "requirements", label: "Set Requirements", layout: "dashboard", link: "/dashboard/requirements", icon: "IconSettings" },
    { key: "requirement-logs", label: "History", layout: "dashboard", link: "/dashboard/requirement-logs", icon: "IconHistory" },
    { key: "email-reports", label: "Email Reports", layout: "dashboard", link: "/dashboard/email-reports", icon: "IconMail" },
    // { key: "dashboard-role-manager", label: "Roles & Permissions", layout: "dashboard", link: "/dashboard/role-manager", icon: "IconSettings" },

    // Admin Aliases (No label/icon means they don't show in sidebar)
    { layout: "dashboard", prefix: "/dashboard/manage-role/", key: "dashboard-role-manager" },
    { layout: "admin", prefix: "/admin/manage-role/", key: "role-manager" },
    { layout: "admin", prefix: "/admin/courses/", key: "courses" },
    { layout: "admin", prefix: "/admin/add-course", key: "courses" },
    { layout: "admin", prefix: "/admin/add-module/", key: "courses" },
    { layout: "admin", prefix: "/admin/edit-module/", key: "courses" },
    { layout: "admin", prefix: "/admin/add-lesson/", key: "courses" },
    { layout: "admin", prefix: "/admin/edit-lesson/", key: "courses" },
    { layout: "admin", prefix: "/admin/add-assignment/", key: "courses" },
    { layout: "admin", prefix: "/admin/add-resource/", key: "courses" },
    { layout: "admin", prefix: "/admin/add-quiz/", key: "courses" },
    { layout: "admin", prefix: "/admin/edit-quiz/", key: "courses" },
    { layout: "admin", prefix: "/admin/revision-table/", key: "revision-table" },
    { layout: "admin", prefix: "/admin/report-clubbing/", key: "report-clubbing" },
    { layout: "admin", prefix: "/admin/trainers/", key: "trainers" },
    { layout: "admin", prefix: "/admin/dojo-hiring/", key: "dojo-hiring" },
    { layout: "admin", prefix: "/admin/employees/", key: "employees" },
    { layout: "admin", prefix: "/admin/contractors/", key: "contractors" },
    { layout: "admin", prefix: "/admin/designations/", key: "designations" },
    { layout: "admin", prefix: "/admin/departments/", key: "departments" },
    { layout: "admin", prefix: "/admin/learning/", key: "learning" },
    { layout: "admin", prefix: "/admin/learning/create", key: "learning" },
    { layout: "admin", prefix: "/admin/test-paper", key: "test-paper" },
    { layout: "admin", prefix: "/admin/add-test-paper", key: "test-paper" },
    { layout: "admin", prefix: "/admin/edit-test-paper/", key: "test-paper" },
    { layout: "admin", prefix: "/admin/take-test/", key: "test-paper" },
    { layout: "admin", prefix: "/admin/on-job-training", key: "on-job-training" },
    { layout: "admin", prefix: "/admin/settings", key: "settings" },
    { layout: "admin", prefix: "/admin/data-management", key: "data-management" },
    { layout: "admin", prefix: "/admin/evaluation-test", key: "dojo-hiring" },
    { layout: "admin", prefix: "/admin/add-evaluation-test", key: "dojo-hiring" },
    { layout: "admin", prefix: "/admin/edit-evaluation-test/", key: "dojo-hiring" },
    { layout: "admin", prefix: "/admin/attempt-evaluation-test/", key: "dojo-hiring" },
    { layout: "admin", prefix: "/admin/view-evaluation-attempt/", key: "dojo-hiring" },
    { layout: "cms", prefix: "/cms/abnormal-condition", key: "abnormal-condition" },

    // Trainer layout
    { key: "trainer-dashboard", label: "Dashboard", labelKey: "nav.dashboard", layout: "trainer", link: "/trainer", icon: "IconLayoutDashboardFilled" },
    { key: "trainer-courses", label: "My Courses", labelKey: "nav.myCourses", layout: "trainer", link: "/trainer/courses", icon: "IconCertificate" },
    { key: "trainer-departments", label: "Departments", labelKey: "nav.myDepartments", layout: "trainer", link: "/trainer/departments", icon: "IconFolder" },
    { key: "trainer-employees", label: "My Operator", labelKey: "nav.students", layout: "trainer", link: "/trainer/employees", icon: "IconUsers" },
    { key: "trainer-quiz-monitoring", label: "Quiz Monitoring", labelKey: "nav.quizManagement", layout: "trainer", link: "/trainer/quiz-monitoring", icon: "IconClock" },
    { key: "trainer-assignment-monitoring", label: "Assignment Monitoring", labelKey: "nav.assignmentManagement", layout: "trainer", link: "/trainer/assignment-monitoring", icon: "IconClipboardList" },
    { key: "trainer-certificates", label: "Certificate Issuance", labelKey: "nav.certificates", layout: "trainer", link: "/trainer/certificate-issuance", icon: "IconTemplate" },
    { key: "trainer-attempt-requests", label: "Attempt Requests", labelKey: "nav.attemptRequests", layout: "trainer", link: "/trainer/attempt-requests", icon: "IconBell" },
    { key: "trainer-skill-matrix", label: "Skill Evaluation", labelKey: "nav.skillMatrix", layout: "trainer", link: "/trainer/skill-matrix", icon: "IconStars" },
    { key: "trainer-on-job-training", label: "On Job Training (OJT)", labelKey: "nav.onJobTraining", layout: "trainer", link: "/trainer/on-job-training", icon: "IconClipboardList" },

    // Trainer route aliases
    { layout: "trainer", prefix: "/trainer/courses/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/add-module/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/edit-module/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/add-lesson/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/edit-lesson/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/add-assignment/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/add-resource/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/add-quiz/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/edit-quiz/", key: "trainer-courses" },
    { layout: "trainer", prefix: "/trainer/departments/", key: "trainer-departments" },
    { layout: "trainer", prefix: "/trainer/employees/", key: "trainer-employees" },
    { layout: "trainer", prefix: "/trainer/on-job-training", key: "trainer-on-job-training" },

    // Student layout
    { key: "student-dashboard", label: "Dashboard", labelKey: "nav.dashboard", layout: "student", link: "/student", icon: "IconLayoutDashboardFilled" },
    { key: "student-test-paper", label: "Test Papers", layout: "student", link: "/student/test-paper", icon: "IconFileText" },
    { key: "student-certificates", label: "My Certificates", labelKey: "nav.certificates", layout: "student", link: "/student/certificates", icon: "IconFileCertificate" },
    { key: "student-profile", label: "My Profile", labelKey: "nav.profile", layout: "student", link: "/student/profile", icon: "IconUser" },

    // Student route aliases
    { layout: "student", prefix: "/student/quiz/", key: "student-courses" },
    { layout: "student", prefix: "/student/resource-preview/", key: "student-courses" },

    // CMS layout
    { key: "cms-dashboard", label: "Dashboard", labelKey: "nav.dashboard", layout: "cms", link: "/cms", icon: "IconLayoutDashboardFilled" },
    // { key: "cms-add-question", label: "Add Question Paper", layout: "cms", link: "/cms/add-question-paper", icon: "IconPlus" },
    { key: "cms-recording", label: "Daily 5M Recording", layout: "cms", link: "/cms/daily-5m-recording", icon: "IconTable" },
    { key: "abnormal-condition", label: "Abnormal Condition", labelKey: "nav.abnormalCondition", layout: "cms", link: "/cms/abnormal-condition", icon: "IconAlertTriangle" },
    { key: "landing-page", label: "Landing Page", labelKey: "nav.landingPage", layout: "custom", link: "/", icon: "IconLayoutGrid" },
];