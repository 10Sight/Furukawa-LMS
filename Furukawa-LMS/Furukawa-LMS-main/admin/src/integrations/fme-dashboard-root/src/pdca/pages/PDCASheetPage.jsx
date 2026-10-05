import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PDCASheet from '../components/PDCASheet';
import { usePDCA } from '../context/PDCAContext';

export default function PDCASheetPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data } = usePDCA();

  // Find the selected topic by route param ID, or fallback to the first item
  const selectedTopic = data.find((d) => d.id === id) || (data.length > 0 ? data[0] : null);

  return (
    <div className="w-full min-w-0">
      <PDCASheet
        topic={selectedTopic}
        onBack={() => navigate('/')}
      />
    </div>
  );
}
