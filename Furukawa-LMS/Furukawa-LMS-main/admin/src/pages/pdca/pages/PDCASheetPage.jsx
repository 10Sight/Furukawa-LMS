import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PDCASheet from '@components/pdca/PDCASheet';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import pdcaApi from '@/services/api/pdcaApi.js';

import { isRecordCreator } from '../data/recordFilters';

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

  const isCreator = selectedTopic ? isRecordCreator(selectedTopic, userContext?.user) : false;

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
