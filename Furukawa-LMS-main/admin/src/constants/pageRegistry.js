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
    // Check for portal-prefixed paths for custom roles
    if (path.startsWith("/portal/")) {
        // Map /portal/xyz to /admin/xyz to find the correct key
        const subPath = path.substring(7); // e.g. "/departments/123"
        const mappedPath = `/admin${subPath}`;
        
        // Try to find the key using the mapped path in the admin layout
        const key = getKeyByPath(mappedPath, "admin");
        if (key) return key;

        // Fallback: search for any page that matches the subPath suffix
        const match = PAGE_REGISTRY.find(p => p.link && p.link.endsWith(subPath.split('/')[1]));
        if (match) return match.key;
    }

    // Check direct registry matches
    const page = getPageByLink(path, layout);
    if (page) return page.key;

    // Check aliases/prefixes
    const aliases = PAGE_REGISTRY.filter(p => p.prefix && path.startsWith(p.prefix) && p.layout === layout);
    if (aliases.length > 0) {
        return aliases.sort((a, b) => b.prefix.length - a.prefix.length)[0].key;
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
            if (layout !== 'admin') return false;
            return true;
        }
        return false;
    }

    const allowed = normalizeAllowedPages(user);
    if (layout === 'student' && user?.isEmployee) return true;
    return allowed.includes(pageKey);
};

export const getSidebarTabs = (currentLayout, user, t, hasPrivilege = () => true) => {
    const allowedKeys = new Set(normalizeAllowedPages(user));
    const isRestricted = hasRestrictions(user);

    // Filter registry for pages that should appear in the sidebar
    const sidebarPages = PAGE_REGISTRY.filter(p => p.label && p.link);

    // A page is shown if:
    // 1. It belongs to the current layout OR the user has explicit cross-layout access to it
    // 2. The user is not restricted OR the page key is in allowedPages
    // 3. It's not the root dashboard of a DIFFERENT layout
    // 4. The user has the required privilege (if any)

    const tabs = sidebarPages.filter(p => {
        const isCurrentLayout = p.layout === currentLayout;
        const isAllowed = !isRestricted || allowedKeys.has(p.key) || (p.layout === 'student' && user?.isEmployee);
        const isPrivileged = !p.privilege || hasPrivilege(p.privilege);

        // Root dashboard rule: Only show the dashboard of the CURRENT layout
        const isOtherLayoutDashboard = p.link === `/${p.layout}` && !isCurrentLayout;

        // Condition 1: Pages in the current layout that the user has permission for
        if (isCurrentLayout) return isAllowed && isPrivileged;

        // Condition 2: Pages in other layouts ONLY if they are SPECIFICALLY granted via a custom role
        // This prevents Full Admins/SuperAdmins from seeing every single page in every sidebar
        const isExplicitlyAllowed = user?.customRole && allowedKeys.has(p.key);

        return isExplicitlyAllowed && isPrivileged && !isOtherLayoutDashboard;
    });

    // Map to the format layouts expect
    return tabs.map(p => ({
        link: currentLayout === "custom" ? p.link.replace(/^\/[^/]+/, "/portal") : p.link,
        label: p.labelKey ? t(p.labelKey, p.label) : p.label,
        icon: getIcon(p.icon),
        key: p.key
    }));
};

export const getFirstAllowedPage = (layout, user, t) => {
    const tabs = getSidebarTabs(layout, user, t);
    return tabs.length > 0 ? tabs[0].link : null;
};

export const PAGE_REGISTRY = [
    // Admin layout
    { key: "dashboard", label: "Dashboard", labelKey: "nav.dashboard", layout: "admin", link: "/admin", icon: "IconLayoutDashboardFilled" },
    { key: "trainers", label: "Instructors", labelKey: "nav.instructors", layout: "admin", link: "/admin/trainers", icon: "IconUser" },
    { key: "courses", label: "Courses", labelKey: "nav.courses", layout: "admin", link: "/admin/courses", icon: "IconCertificate" },
    { key: "departments", label: "Departments", labelKey: "nav.departments", layout: "admin", link: "/admin/departments", icon: "IconFolder" },
    { key: "employees", label: "Operator", labelKey: "nav.trainees", layout: "admin", link: "/admin/employees", icon: "IconUsers" },
    { key: "quiz-monitoring", label: "Quiz Monitoring", labelKey: "nav.quizMonitoring", layout: "admin", link: "/admin/quiz-monitoring", icon: "IconClock" },
    { key: "test-paper", label: "Test Paper", labelKey: "nav.testPaper", layout: "admin", link: "/admin/test-paper", icon: "IconFileText" },
    { key: "attempt-requests", label: "Attempt Requests", labelKey: "nav.attemptRequests", layout: "admin", link: "/admin/attempt-requests", icon: "IconBell" },
    { key: "course-level-settings", label: "Course Level Settings", labelKey: "nav.courseLevelSettings", layout: "admin", link: "/admin/course-level-settings", icon: "IconLayersIntersect" },
    { key: "student-levels", label: "Student Levels", labelKey: "nav.studentLevels", layout: "admin", link: "/admin/student-levels", icon: "IconSettings" },
    { key: "certificate-templates", label: "Certificate Templates", labelKey: "nav.certificateTemplates", layout: "admin", link: "/admin/certificate-templates", icon: "IconTemplate" },
    { key: "analytics", label: "Analytics", labelKey: "nav.analytics", layout: "admin", link: "/admin/analytics", icon: "IconChartPie" },
    { key: "report", label: "Report", labelKey: "nav.report", layout: "admin", link: "/admin/report", icon: "IconClipboardList" },
    { key: "10-cycle", label: "10 Cycle", labelKey: "nav.tenCycle", layout: "admin", link: "/admin/10-cycle", icon: "IconRepeat" },
    { key: "3-day-monitoring", label: "3-Day Monitoring", labelKey: "nav.threeDayMonitoring", layout: "admin", link: "/admin/3-day-monitoring", icon: "IconCalendarCheck" },
    { key: "16-day-monitoring", label: "16-Day Monitoring", labelKey: "nav.sixteenDayMonitoring", layout: "admin", link: "/admin/16-day-monitoring", icon: "IconCalendarCheck" },
    { key: "handover-sheet", label: "Handover Sheet", labelKey: "nav.handoverSheet", layout: "admin", link: "/admin/handover-sheet", icon: "IconClipboardList" },
    { key: "skill-matrix", label: "Skill Matrix", labelKey: "nav.skillMatrix", layout: "admin", link: "/admin/skill-matrix", icon: "IconStars" },
    { key: "daily-production-report", label: "Daily Production Report", labelKey: "nav.dailyProductionReport", layout: "admin", link: "/admin/daily-production-report", icon: "IconReportAnalytics" },
    { key: "dpr-manage", label: "DPR Setup", labelKey: "nav.dprManage", layout: "admin", link: "/admin/dpr-manage", icon: "IconSettings" },
    { key: "role-manager", label: "Roles & Permissions", labelKey: "nav.rolesPermissions", layout: "admin", link: "/admin/role-manager", icon: "IconSettings" },
    { key: "all-users", label: "All Users", labelKey: "nav.allUsers", layout: "admin", link: "/admin/all-users", icon: "IconUsers" },
    { key: "mentors", label: "Mentors", labelKey: "nav.mentors", layout: "admin", link: "/admin/mentors", icon: "IconUserHeart" },
    { key: "supervisors", label: "Supervisors", labelKey: "nav.supervisors", layout: "admin", link: "/admin/supervisors", icon: "IconUserShield" },
    { key: "incharges", label: "Incharges", labelKey: "nav.incharges", layout: "admin", link: "/admin/incharges", icon: "IconUserCheck" },
    { key: "line-requirements", label: "Line Requirements", labelKey: "nav.lineRequirements", layout: "admin", link: "/admin/line-requirements", icon: "IconSettings" },
    { key: "report-clubbing", label: "Report Clubbing", layout: "admin", link: "/admin/report-clubbing", icon: "IconLayersDifference" },
    { key: "multi-skilling", label: "Multi Skilling", labelKey: "nav.multiSkilling", layout: "admin", link: "/admin/multi-skilling", icon: "IconStars" },
    { key: "dojo-hiring", label: "DOJO Hiring", layout: "admin", link: "/admin/dojo-hiring", icon: "IconUserPlus" },
    { key: "learning", label: "Learning", labelKey: "nav.learning", layout: "admin", link: "/admin/learning", icon: "IconBook" },

    // Dashboard-specific pages (often considered core Admin functions)
    { key: "dashboard-home", label: "Dashboard", labelKey: "nav.dashboard", layout: "dashboard", link: "/dashboard", icon: "IconLayoutDashboardFilled" },
    { key: "onboarding-id", label: "Onboarding & ID", layout: "dashboard", link: "/dashboard/onboarding-id", icon: "IconId" },
    { key: "attendance", label: "Attendance", layout: "dashboard", link: "/dashboard/attendance", icon: "IconFingerprint" },
    { key: "requirements", label: "Set Requirements", layout: "dashboard", link: "/dashboard/requirements", icon: "IconSettings" },
    { key: "users", label: "User Management", layout: "dashboard", link: "/dashboard/users", icon: "IconUsers", privilege: "user management" },
    { key: "requirement-logs", label: "History", layout: "dashboard", link: "/dashboard/requirement-logs", icon: "IconHistory" },
    { key: "email-reports", label: "Email Reports", layout: "dashboard", link: "/dashboard/email-reports", icon: "IconMail", privilege: "email_reports" },

    // Admin Aliases (No label/icon means they don't show in sidebar)
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
    { layout: "admin", prefix: "/admin/report-clubbing/", key: "report-clubbing" },
    { layout: "admin", prefix: "/admin/trainers/", key: "trainers" },
    { layout: "admin", prefix: "/admin/dojo-hiring/", key: "dojo-hiring" },
    { layout: "admin", prefix: "/admin/employees/", key: "employees" },
    { layout: "admin", prefix: "/admin/departments/", key: "departments" },
    { layout: "admin", prefix: "/admin/learning/", key: "learning" },
    { layout: "admin", prefix: "/admin/learning/create", key: "learning" },

    // Trainer layout
    { key: "trainer-dashboard", label: "Dashboard", labelKey: "nav.dashboard", layout: "trainer", link: "/trainer", icon: "IconLayoutDashboardFilled" },
    { key: "trainer-courses", label: "My Courses", labelKey: "nav.myCourses", layout: "trainer", link: "/trainer/courses", icon: "IconCertificate" },
    { key: "trainer-departments", label: "Departments", labelKey: "nav.myDepartments", layout: "trainer", link: "/trainer/departments", icon: "IconFolder" },
    { key: "trainer-employees", label: "My Operator", labelKey: "nav.students", layout: "trainer", link: "/trainer/employees", icon: "IconUsers" },
    { key: "trainer-quiz-monitoring", label: "Quiz Monitoring", labelKey: "nav.quizManagement", layout: "trainer", link: "/trainer/quiz-monitoring", icon: "IconClock" },
    { key: "trainer-assignment-monitoring", label: "Assignment Monitoring", labelKey: "nav.assignmentManagement", layout: "trainer", link: "/trainer/assignment-monitoring", icon: "IconClipboardList" },
    { key: "trainer-certificates", label: "Certificate Issuance", labelKey: "nav.certificates", layout: "trainer", link: "/trainer/certificate-issuance", icon: "IconTemplate" },
    { key: "trainer-attempt-requests", label: "Attempt Requests", labelKey: "nav.attemptRequests", layout: "trainer", link: "/trainer/attempt-requests", icon: "IconBell" },
    { key: "trainer-skill-matrix", label: "Skill Matrix", labelKey: "nav.skillMatrix", layout: "trainer", link: "/trainer/skill-matrix", icon: "IconStars" },

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
    { key: "landing-page", label: "Landing Page (Portal Selector)", layout: "custom", link: "/", icon: "IconLayoutGrid" },
];

