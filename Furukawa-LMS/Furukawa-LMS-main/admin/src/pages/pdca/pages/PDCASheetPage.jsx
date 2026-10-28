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

  useEffect(() => {
    if (id && (!data || !data.some((d) => d.id === id))) {
      pdcaApi.getRecord(id).then((rec) => {
        if (rec) setDirectTopic(rec);
      }).catch((err) => {
        console.warn('Could not load record directly from backend:', err);
      });
    }
  }, [id, data]);

  // Find the selected topic by route param ID, fallback to direct fetch, or fallback to first item
  const selectedTopic = (id ? data.find((d) => d.id === id) : (data.length > 0 ? data[0] : null)) || directTopic;

  const isCreator = selectedTopic ? isRecordCreator(selectedTopic, userContext?.user) : false;

  return (
    <div className="w-full min-w-0">
      <PDCASheet
        key={selectedTopic?.id || id}
        topic={selectedTopic || (id ? { id, topic: 'PDCA Audit Sheet' } : null)}
        isCreator={isCreator}
        currentUser={userContext?.user}
        onBack={() => {
          navigate(location.state?.returnTo || '/', { replace: true });
        }}
      />
    </div>
  );
}
