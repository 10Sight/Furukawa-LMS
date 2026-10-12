import { demoModeEnabled } from "../../../../shared/demoData.js";
import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';

const labels = { ptm: 'PTM', pdca: 'PDCA', 'process-audit': 'Process Audit' };

export default function FmeDashboardPage({ page }) {
    const frameRef = useRef(null);
    const { search } = useLocation();
    const navigate = useNavigate();
    const { isFormView, setIsFormView } = useOutletContext();
    useEffect(() => () => setIsFormView(false), [setIsFormView]);

    const user = useSelector(state => state.auth?.user);
    const departments = (Array.isArray(user?.departments) ? user.departments : []).filter(item => item && typeof item === 'object');
    const sections = Array.isArray(user?.sections) ? user.sections : [];
    const sectionId = user?.sectionId?.id || user?.sectionId?._id || user?.sectionId || user?.sections?.[0]?.id || user?.sections?.[0]?._id || user?.sections?.[0];
    const section = (Array.isArray(sections) ? sections : []).find(item => String(item.id || item._id) === String(sectionId));
    const contextRef = useRef(null);
    contextRef.current = {
        lpaSource: null,
        user: { name: user?.fullName || user?.name || '', code: user?.employeeId || user?.empId || user?.empCode || user?.userName || '', email: user?.email || '' },
        section: { id: section?.id || section?._id || sectionId || '', name: section?.name || user?.section?.name || user?.sectionName || user?.sectionId?.name || user?.sections?.[0]?.name || '' },
        departments: departments.map(item => ({ id: item.id || item._id, name: item.name })),
        loading: false,
        error: false,
    };
    const publishUserContext = () => {
        if (page === 'pdca' && frameRef.current?.contentWindow) {
            frameRef.current.contentWindow.postMessage({ type: 'fme-cms-user-context', ...contextRef.current }, window.location.origin);
        }
    };
    useEffect(publishUserContext, [page, user]);

    const sourceRef = useRef(null);
    if (!sourceRef.current) {
        const sheet = new URLSearchParams(search).get('sheet');
        const route = page === 'pdca' && sheet ? `/sheet/${encodeURIComponent(sheet)}` : '/';
        sourceRef.current = `/cms-dashboard/index.html?page=${page}${demoModeEnabled(import.meta.env) ? "&demo=1" : ""}#${route}`;
    }
    useEffect(() => {
        const syncRoute = event => {
            if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow || event.data?.page !== page) return;
            if (event.data.type === 'fme-cms-user-context-request') {
                publishUserContext();
                return;
            }
            if (event.data.type === 'fme-cms-form-view') {
                setIsFormView(event.data.open === true);
                return;
            }
            if (event.data.type !== 'fme-cms-route') return;
            const match = /^#\/sheet\/([^/?#]+)$/.exec(event.data.hash || '');
            navigate(`/cms/${page}${match ? `?sheet=${encodeURIComponent(decodeURIComponent(match[1]))}` : ''}`, { replace: true });
        };
        window.addEventListener('message', syncRoute);
        return () => window.removeEventListener('message', syncRoute);
    }, [navigate, page, setIsFormView]);
    return <iframe ref={frameRef} src={sourceRef.current} title={labels[page]} onLoad={() => { publishUserContext(); frameRef.current?.contentWindow?.postMessage({ type: 'fme-cms-state-request' }, window.location.origin); }} className={`block w-full border-0 ${isFormView ? '' : 'rounded-lg'}`} style={{ height: isFormView ? '100dvh' : 'calc(100dvh - 10rem)', minHeight: isFormView ? 0 : '32rem' }} />;
}
