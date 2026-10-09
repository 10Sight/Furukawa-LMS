import React from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import PDCASheet from '@components/pdca/PDCASheet';
import { usePDCA } from '../context/PDCAContext';

export default function PDCASheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { data } = usePDCA();

  // Find the selected topic by route param ID, or fallback to the first item
  const selectedTopic = id ? data.find((d) => d.id === id) : (data.length > 0 ? data[0] : null);

  return (
    <div className="w-full min-w-0">
      <PDCASheet
        key={selectedTopic?.id}
        topic={selectedTopic}
        onBack={() => {
          navigate(location.state?.returnTo || '/', { replace: true });
        }}
      />
    </div>
  );
}
