import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PDCASheet from '@components/pdca/PDCASheet';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import pdcaApi from '@/services/api/pdcaApi.js';

import { isRecordCreator, isUserInSameDepartmentAsRecord } from '../data/recordFilters';

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
    if (activeId && (!data || !data.some((d) => d.id === activeId))) {
      pdcaApi.getRecord(activeId).then((rec) => {
        if (rec) setDirectTopic(rec);
      }).catch((err) => {
        console.warn('Could not load record directly from backend:', err);
      });
    }
  }, [activeId, data]);

  // Find the selected topic by route param ID, query param, fallback to direct fetch, or fallback to first item
  const selectedTopic = (activeId ? data.find((d) => d.id === activeId) : (data.length > 0 ? data[0] : null)) || directTopic;

  useEffect(() => {
    if (!activeId && selectedTopic?.id) {
      navigate(`?sheet=${encodeURIComponent(selectedTopic.id)}`, { replace: true, state: location.state });
    }
  }, [activeId, selectedTopic?.id, navigate, location.state]);

  const isUserAdmin = Boolean(userContext?.user?.role === 'admin' || userContext?.user?.isAdmin || String(userContext?.user?.role || '').toUpperCase() === 'ADMIN' || String(userContext?.user?.role || '').toUpperCase() === 'SUPERADMIN');
  const isCreator = selectedTopic ? isRecordCreator(selectedTopic, userContext?.user) : false;
  const isSameDept = selectedTopic ? isUserInSameDepartmentAsRecord(selectedTopic, userContext?.user) : false;
  const hasAccess = !selectedTopic || isUserAdmin || isCreator || isSameDept;

  if (selectedTopic && !hasAccess) {
    return (
      <div className="w-full max-w-xl mx-auto my-12 p-8 text-center bg-white rounded-2xl shadow-xl border border-slate-200">
        <h3 className="text-lg font-bold text-slate-800 mb-2">Access Restricted</h3>
        <p className="text-sm text-slate-600 mb-6">You do not have permission to access this PDCA Sheet. Access is restricted to members of the same department or the creator.</p>
        <button
          onClick={() => {
            if (location.state?.returnTo) {
              navigate(location.state.returnTo);
            } else {
              navigate(-1);
            }
          }}
          className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <PDCASheet
        key={selectedTopic?.id || id}
        topic={selectedTopic || (id ? { id, topic: 'PDCA Audit Sheet' } : null)}
        isCreator={isCreator}
        currentUser={userContext?.user}
        onBack={() => {
          if (location.state?.returnTo) {
            navigate(location.state.returnTo);
          } else {
            navigate(-1);
          }
        }}
      />
    </div>
  );
}
