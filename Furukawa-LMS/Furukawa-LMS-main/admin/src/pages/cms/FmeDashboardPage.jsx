import { demoModeEnabled } from "../../../../shared/demoData.js";
import { authSession } from "@/utils/authSession.js";
import React, { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useParams, useOutletContext } from 'react-router-dom';

const labels = { ptm: 'PTM', pdca: 'PDCA', 'process-audit': 'Process Audit' };

export default function FmeDashboardPage({ page }) {
    const frameRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    const params = useParams();
    const { isFormView, setIsFormView } = useOutletContext();
    useEffect(() => () => setIsFormView(false), [setIsFormView]);

    const activeSheet = params.sheetTopic
        ? decodeURIComponent(params.sheetTopic)
        : (new URLSearchParams(location.search).get('sheet') || '');

    const user = useSelector(state => state.auth?.user);
    const departments = (Array.isArray(user?.departments) ? user.departments : []).filter(item => item && typeof item === 'object');
    const sections = Array.isArray(user?.sections) ? user.sections : [];
    const sectionId = user?.sectionId?.id || user?.sectionId?._id || user?.sectionId || user?.sections?.[0]?.id || user?.sections?.[0]?._id || user?.sections?.[0];
    const section = (Array.isArray(sections) ? sections : []).find(item => String(item.id || item._id) === String(sectionId));
    const contextRef = useRef(null);
    const authToken = authSession.getItem('token') || sessionStorage.getItem('token') || '';
    const userDept = user?.department?.name || (typeof user?.department === 'string' ? user?.department : '') || user?.deptName || (departments[0]?.name || '');
    contextRef.current = {
        lpaSource: null,
        token: authToken,
        user: {
            ...user,
            id: user?.id || user?._id || '',
            name: user?.fullName || user?.name || '',
            code: user?.employeeId || user?.empId || user?.empCode || user?.userName || '',
            email: user?.email || '',
            role: user?.role || 'EMPLOYEE',
            department: userDept,
            deptName: userDept,
            departments: user?.departments || departments,
            section: (typeof user?.section === 'string' ? user.section : user?.section?.name) || section?.name || user?.sectionName || '',
            sectionName: (typeof user?.section === 'string' ? user.section : user?.section?.name) || section?.name || user?.sectionName || '',
            sectionId: sectionId || user?.sectionId || user?.targetSectionId || section?.id || '',
            departmentId: user?.departmentId || user?.targetDeptId || (typeof user?.department === 'object' ? user?.department?.id : '') || '',
            isAdmin: Boolean(user?.isAdmin || user?.role === 'ADMIN' || String(user?.role || '').toUpperCase() === 'ADMIN' || String(user?.role || '').toUpperCase() === 'SUPERADMIN')
        },
        section: { id: section?.id || section?._id || sectionId || '', name: section?.name || user?.section?.name || user?.sectionName || user?.sectionId?.name || user?.sections?.[0]?.name || '' },
        departments: departments.map(item => ({ id: item.id || item._id, name: item.name })),
        loading: false,
        error: false,
    };
    const publishUserContext = useCallback(() => {
        if (page === 'pdca' && frameRef.current?.contentWindow) {
            frameRef.current.contentWindow.postMessage({ type: 'fme-cms-user-context', ...contextRef.current }, window.location.origin);
        }
    }, [page]);
    useEffect(publishUserContext, [publishUserContext, user]);

    const sourceRef = useRef(null);
    if (!sourceRef.current) {
        const sheetQuery = activeSheet ? `&sheet=${encodeURIComponent(activeSheet)}` : '';
        const route = activeSheet ? (page === 'pdca' ? `/sheet/${encodeURIComponent(activeSheet)}` : `/${encodeURIComponent(activeSheet)}`) : '/';
        sourceRef.current = `/cms-dashboard/index.html?page=${page}${sheetQuery}&_v=${Date.now()}${demoModeEnabled(import.meta.env) ? "&demo=1" : ""}#${route}`;
    }

    // Distinguish between iframe-driven navigation and browser back/forward buttons
    const internalNavRef = useRef(false);

    // Synchronize browser history navigation (back/forward) with the iframe
    useEffect(() => {
        if (internalNavRef.current) {
            internalNavRef.current = false;
            return;
        }
        if (!frameRef.current?.contentWindow) return;

        if (!activeSheet) {
            // URL navigated back to /cms/:page (e.g. user clicked browser Back)
            frameRef.current.contentWindow.postMessage({
                type: 'fme-cms-navigate-to-list',
                page
            }, window.location.origin);
        } else {
            // URL changed to a sheet (e.g. user clicked browser Forward)
            frameRef.current.contentWindow.postMessage({
                type: 'fme-cms-open-sheet',
                page,
                topic: activeSheet
            }, window.location.origin);
        }
    }, [activeSheet, page]);

    useEffect(() => {
        const syncRoute = event => {
            if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return;
            if (event.data?.page && event.data.page !== page) return;

            if (event.data.type === 'fme-cms-user-context-request') {
                publishUserContext();
                return;
            }
            if (event.data.type === 'fme-cms-form-view') {
                setIsFormView(event.data.open === true);
                return;
            }

            // Sheet opened inside iframe: push new history entry so browser Back button works
            if (event.data.type === 'fme-cms-sheet-opened' || (event.data.type === 'fme-cms-route' && event.data.topic)) {
                const topic = event.data.topic || event.data.id;
                if (topic) {
                    const targetPath = `/cms/${page}/${encodeURIComponent(topic)}`;
                    if (location.pathname !== targetPath) {
                        internalNavRef.current = true;
                        navigate(targetPath, { replace: false });
                    }
                }
                return;
            }

            // Sheet closed inside iframe (e.g. Back button inside sheet clicked)
            if (event.data.type === 'fme-cms-sheet-closed' || (event.data.type === 'fme-cms-route' && !event.data.topic && !event.data.hash)) {
                const targetPath = `/cms/${page}`;
                if (location.pathname !== targetPath) {
                    internalNavRef.current = true;
                    navigate(targetPath, { replace: false });
                }
                return;
            }

            // Legacy hash route support
            if (event.data.type === 'fme-cms-route') {
                const match = /^#\/sheet\/([^/?#]+)$/.exec(event.data.hash || '');
                if (match) {
                    const topic = decodeURIComponent(match[1]);
                    const targetPath = `/cms/${page}/${encodeURIComponent(topic)}`;
                    if (location.pathname !== targetPath) {
                        internalNavRef.current = true;
                        navigate(targetPath, { replace: false });
                    }
                } else {
                    const targetPath = `/cms/${page}`;
                    if (location.pathname !== targetPath) {
                        internalNavRef.current = true;
                        navigate(targetPath, { replace: false });
                    }
                }
            }
        };
        window.addEventListener('message', syncRoute);
        return () => window.removeEventListener('message', syncRoute);
    }, [location.pathname, navigate, page, publishUserContext, setIsFormView]);

    return (
        <iframe
            ref={frameRef}
            src={sourceRef.current}
            title={labels[page]}
            onLoad={() => {
                publishUserContext();
                frameRef.current?.contentWindow?.postMessage({ type: 'fme-cms-state-request' }, window.location.origin);
                if (activeSheet) {
                    frameRef.current?.contentWindow?.postMessage({
                        type: 'fme-cms-open-sheet',
                        page,
                        topic: activeSheet
                    }, window.location.origin);
                }
            }}
            className={`block w-full border-0 ${isFormView ? '' : 'rounded-lg'}`}
            style={{ height: isFormView ? '100dvh' : 'calc(100dvh - 10rem)', minHeight: isFormView ? 0 : '32rem' }}
        />
    );
}
