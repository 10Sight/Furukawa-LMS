import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PDCASheet from '@components/pdca/PDCASheet';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import pdcaApi from '@/services/api/pdcaApi.js';

import { isRecordCreator, isUserInSameDepartmentAsRecord, canEditRecord } from '../data/recordFilters';

export default function PDCASheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data, userContext } = usePDCA();
  const [directTopic, setDirectTopic] = useState(null);

  const queryParams = new URLSearchParams(location.search);
  const sheetParam = queryParams.get('sheet');
  const activeId = id || sheetParam;

  useEffect(() => {
    if (activeId && (!data || !data.some((d) => String(d.id || '').toLowerCase() === String(activeId).toLowerCase() || String(d.topic || '').toLowerCase() === String(activeId).toLowerCase()))) {
      pdcaApi.getRecord(activeId).then((rec) => {
        if (rec) setDirectTopic(rec);
      }).catch((err) => {
        console.warn('Could not load record directly from backend:', err);
      });
    }
  }, [activeId, data]);

  // Find the selected topic by route param ID, query param, fallback to direct fetch, or fallback to first item
  const selectedTopic = (activeId ? data.find((d) =>
    String(d.id || '').toLowerCase() === String(activeId).toLowerCase() ||
    String(d.topic || '').toLowerCase() === String(activeId).toLowerCase()
  ) : (data.length > 0 ? data[0] : null)) || directTopic;

  useEffect(() => {
    if (!activeId && selectedTopic?.id) {
      navigate(`?sheet=${encodeURIComponent(selectedTopic.id)}`, { replace: true, state: location.state });
    }
  }, [activeId, selectedTopic?.id, navigate, location.state]);

  useEffect(() => {
    if (selectedTopic) {
      window.parent?.postMessage?.({
        type: 'fme-cms-sheet-opened',
        page: 'pdca',
        topic: selectedTopic.topic || selectedTopic.id,
        id: selectedTopic.id
      }, window.location.origin);
    }
    return () => {
      window.parent?.postMessage?.({
        type: 'fme-cms-sheet-closed',
        page: 'pdca'
      }, window.location.origin);
    };
  }, [selectedTopic?.id, selectedTopic?.topic]);

  const canEdit = selectedTopic ? canEditRecord(selectedTopic, userContext?.user) : false;
  const isCreator = selectedTopic ? isRecordCreator(selectedTopic, userContext?.user) : false;
  const fromScope = location.state?.fromScope || queryParams.get('scope') || (selectedTopic?.scope === 'Self PDCA' ? 'Self PDCA' : '');
  const isSelfView = fromScope === 'Self PDCA';
  const isDepartmentView = fromScope === 'Department' || (!fromScope && selectedTopic?.scope === 'Department');
  const targetDepartment = location.state?.targetDept || queryParams.get('dept') || '';

  return (
    <div className="pdca-page-sheet-root fixed inset-0 z-40 h-dvh w-full bg-white text-slate-800 flex flex-col overflow-hidden p-1.5 sm:p-2 pb-0.5 sm:pb-1">
      <style>{`
        .pdca-page-sheet-root .pdca-sheet-scroll-container,
        .pdca-page-sheet-root .pdca-body-scroll-container {
          scrollbar-width: auto;
          scrollbar-color: #334155 #cbd5e1;
        }
        .pdca-page-sheet-root .pdca-sheet-scroll-container::-webkit-scrollbar,
        .pdca-page-sheet-root .pdca-body-scroll-container::-webkit-scrollbar {
          width: 14px !important;
          height: 14px !important;
        }
        .pdca-page-sheet-root .pdca-sheet-scroll-container::-webkit-scrollbar-track,
        .pdca-page-sheet-root .pdca-body-scroll-container::-webkit-scrollbar-track {
          background: #cbd5e1 !important;
          border-radius: 6px;
        }
        .pdca-page-sheet-root .pdca-sheet-scroll-container::-webkit-scrollbar-thumb,
        .pdca-page-sheet-root .pdca-body-scroll-container::-webkit-scrollbar-thumb {
          background: #334155 !important;
          border-radius: 6px;
          border: 2px solid #cbd5e1;
        }
        .pdca-page-sheet-root .pdca-sheet-scroll-container::-webkit-scrollbar-thumb:hover,
        .pdca-page-sheet-root .pdca-body-scroll-container::-webkit-scrollbar-thumb:hover {
          background: #1e293b !important;
        }
        .pdca-page-sheet-root .pdca-sheet-scroll-container::-webkit-scrollbar-corner,
        .pdca-page-sheet-root .pdca-body-scroll-container::-webkit-scrollbar-corner {
          background: #cbd5e1 !important;
        }
      `}</style>
      <PDCASheet
        key={selectedTopic?.id || id}
        topic={selectedTopic || (id ? { id, topic: 'PDCA Audit Sheet' } : null)}
        isCreator={isCreator}
        isSelfView={isSelfView}
        isDepartmentView={isDepartmentView}
        targetDepartment={targetDepartment}
        currentUser={userContext?.user}
        onBack={() => {
          window.parent?.postMessage?.({
            type: 'fme-cms-sheet-closed',
            page: 'pdca'
          }, window.location.origin);
          if (location.state?.returnTo) {
            navigate(location.state.returnTo);
          } else {
            navigate('/');
          }
        }}
      />
    </div>
  );
}
