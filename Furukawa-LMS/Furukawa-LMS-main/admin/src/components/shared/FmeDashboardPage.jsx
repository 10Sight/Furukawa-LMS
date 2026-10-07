import { MAN_MACHINE_INTERLINK_URL } from '../man-machine-interlink/integration';
import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useOutletContext } from 'react-router-dom';

const labels = { ptm: 'PTM', pdca: 'PDCA', 'process-audit': 'Process Audit', 'man-machine-interlink': 'Man–Machine Interlink' };

export default function FmeDashboardPage({ page, viewContext, lpaSource }) {
    const frameRef = useRef(null);
    const user = useSelector(state => state.auth.user);
    const departments = (Array.isArray(user?.departments) ? user.departments : []).filter(item => item && typeof item === 'object');
    const sections = Array.isArray(user?.sections) ? user.sections : [];
    const sectionId = user?.sectionId?.id || user?.sectionId?._id || user?.sectionId || user?.sections?.[0]?.id || user?.sections?.[0]?._id || user?.sections?.[0];
    const section = (Array.isArray(sections) ? sections : []).find(item => String(item.id || item._id) === String(sectionId));
    const contextRef = useRef(null);
    contextRef.current = {
        lpaSource: lpaSource || null,
        user: { name: user?.fullName || user?.name || '', code: user?.employeeId || user?.empId || user?.empCode || user?.userName || '', email: user?.email || '' },
        section: { id: section?.id || section?._id || sectionId || '', name: section?.name || user?.section?.name || user?.sectionName || user?.sectionId?.name || user?.sections?.[0]?.name || '' },
        departments: departments.map(item => ({ id: item.id || item._id, name: item.name })),
        loading: false,
        error: false,
    };
    const publishUserContext = () => {
        if (page === 'pdca') frameRef.current?.contentWindow?.postMessage({ type: 'fme-cms-user-context', ...contextRef.current }, window.location.origin);
    };
    useEffect(publishUserContext, [page, lpaSource, user]);
    const outletContext = useOutletContext();
    const { isFormView, setIsFormView } = viewContext || outletContext;
    useEffect(() => () => setIsFormView(false), [setIsFormView]);
    useEffect(() => {
        const syncFormView = event => {
            if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow || event.data?.page !== page) return;
            if (event.data.type === 'fme-cms-user-context-request') publishUserContext();
            if (event.data.type === 'fme-cms-form-view') setIsFormView(event.data.open === true);
        };
        window.addEventListener('message', syncFormView);
        return () => window.removeEventListener('message', syncFormView);
    }, [page, setIsFormView]);
    const source = page === 'man-machine-interlink'
        ? MAN_MACHINE_INTERLINK_URL
        : `/cms-dashboard/index.html?page=${page}`;
    return <iframe ref={frameRef} src={source} title={labels[page]} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" onLoad={() => { publishUserContext(); frameRef.current?.contentWindow?.postMessage({ type: 'fme-cms-state-request' }, window.location.origin); }} className={`block w-full border-0 ${isFormView ? '' : 'rounded-lg'}`} style={{ height: isFormView ? '100dvh' : 'calc(100dvh - 10rem)', minHeight: isFormView ? 0 : '32rem' }} />;
}
