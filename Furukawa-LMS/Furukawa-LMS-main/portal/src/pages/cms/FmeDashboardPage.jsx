import { demoModeEnabled } from "../../../../shared/demoData.js";
import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';

const labels = { ptm: 'PTM', pdca: 'PDCA', 'process-audit': 'Process Audit' };

export default function FmeDashboardPage({ page }) {
    const frameRef = useRef(null);
    const { search } = useLocation();
    const navigate = useNavigate();
    const { isFormView, setIsFormView } = useOutletContext();
    useEffect(() => () => setIsFormView(false), [setIsFormView]);
    const sourceRef = useRef(null);
    if (!sourceRef.current) {
        const sheet = new URLSearchParams(search).get('sheet');
        const route = page === 'pdca' && sheet ? `/sheet/${encodeURIComponent(sheet)}` : '/';
        sourceRef.current = `/cms-dashboard/index.html?page=${page}${demoModeEnabled(import.meta.env) ? "&demo=1" : ""}#${route}`;
    }
    useEffect(() => {
        const syncRoute = event => {
            if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow || event.data?.page !== page) return;
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
    return <iframe ref={frameRef} src={sourceRef.current} title={labels[page]} onLoad={() => frameRef.current?.contentWindow?.postMessage({ type: 'fme-cms-state-request' }, window.location.origin)} className={`block w-full border-0 ${isFormView ? '' : 'rounded-lg'}`} style={{ height: isFormView ? '100dvh' : 'calc(100dvh - 10rem)', minHeight: isFormView ? 0 : '32rem' }} />;
}
