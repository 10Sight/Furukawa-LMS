import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  SuggestionChecksheetList,
  SuggestionChecksheetDetail,
  getStoredSuggestionChecksheets,
  saveStoredSuggestionChecksheets
} from '@/components/suggestion-checksheet';

export default function SuggestionChecksheetPage() {
  const outletCtx = useOutletContext() || {};
  const { setIsFormView } = outletCtx;

  const user = useSelector((state) => state.auth?.user);
  const [records, setRecords] = useState(() => getStoredSuggestionChecksheets());
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState('list'); // 'list' | 'detail'
  const [selectedUnit, setSelectedUnit] = useState(null);

  // Sync records to storage
  const handleUpdateRecords = (newRecords) => {
    const updated = typeof newRecords === 'function' ? newRecords(records) : newRecords;
    setRecords(updated);
    saveStoredSuggestionChecksheets(updated);
  };

  // Open detail format
  const handleOpenChecksheet = (item) => {
    setSelectedItem(item);
    setCurrentPage('detail');
    if (typeof setIsFormView === 'function') {
      setIsFormView(true);
    }
  };

  // Save changes from detail form
  const handleSaveChecksheet = (updatedItem) => {
    const updated = records.map((rec) => (rec.id === updatedItem.id ? updatedItem : rec));
    setRecords(updated);
    saveStoredSuggestionChecksheets(updated);
    setSelectedItem(updatedItem);
  };

  // Back to list
  const handleBackToList = () => {
    setCurrentPage('list');
    setSelectedItem(null);
    if (typeof setIsFormView === 'function') {
      setIsFormView(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof setIsFormView === 'function') {
        setIsFormView(false);
      }
    };
  }, [setIsFormView]);

  return (
    <div className="suggestion-checksheet-page-wrapper w-full min-h-0 flex-1 flex flex-col p-2 sm:p-4">
      {currentPage === 'detail' && selectedItem ? (
        <SuggestionChecksheetDetail
          item={selectedItem}
          onBack={handleBackToList}
          onSave={handleSaveChecksheet}
        />
      ) : (
        <SuggestionChecksheetList
          records={records}
          setRecords={handleUpdateRecords}
          onOpenChecksheet={handleOpenChecksheet}
          selectedUnit={selectedUnit}
          setSelectedUnit={setSelectedUnit}
        />
      )}
    </div>
  );
}
