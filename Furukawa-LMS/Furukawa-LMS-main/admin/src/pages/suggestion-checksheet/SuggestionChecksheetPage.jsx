import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  SuggestionChecksheetList,
  SuggestionChecksheetDetail,
  getStoredSuggestionChecksheets,
  saveStoredSuggestionChecksheets
} from '@/components/suggestion-checksheet';
import {
  useGetSuggestionChecksheetsQuery,
  useCreateSuggestionChecksheetMutation,
  useUpdateSuggestionChecksheetMutation,
  useDeleteSuggestionChecksheetMutation
} from '@/services/api/SuggestionChecksheetApi.js';

export default function SuggestionChecksheetPage() {
  const outletCtx = useOutletContext() || {};
  const { setIsFormView } = outletCtx;

  const [records, setRecords] = useState(() => getStoredSuggestionChecksheets());
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState('list'); // 'list' | 'detail'
  const [selectedUnit, setSelectedUnit] = useState(null);

  // RTK Query endpoints connected to database
  const { data: apiResponse, refetch } = useGetSuggestionChecksheetsQuery();
  const [createChecksheetMutation] = useCreateSuggestionChecksheetMutation();
  const [updateChecksheetMutation] = useUpdateSuggestionChecksheetMutation();
  const [deleteChecksheetMutation] = useDeleteSuggestionChecksheetMutation();

  // Sync records from database when loaded
  useEffect(() => {
    const list = apiResponse?.data;
    if (Array.isArray(list)) {
      setRecords(list);
      saveStoredSuggestionChecksheets(list);
    }
  }, [apiResponse]);

  // Sync records to storage and backend database
  const handleUpdateRecords = async (newRecords) => {
    const previous = records;
    const updated = typeof newRecords === 'function' ? newRecords(previous) : newRecords;
    setRecords(updated);
    saveStoredSuggestionChecksheets(updated);

    // Detect if an item was added or deleted
    if (updated.length > previous.length) {
      // Newly added item (first item)
      const newItem = updated[0];
      try {
        await createChecksheetMutation(newItem).unwrap();
      } catch (err) {
        console.warn('Backend sync on create failed, saved locally:', err);
      }
    } else if (updated.length < previous.length) {
      // Deleted item
      const deletedItem = previous.find((p) => !updated.some((u) => u.id === p.id));
      if (deletedItem) {
        try {
          await deleteChecksheetMutation(deletedItem.id).unwrap();
        } catch (err) {
          console.warn('Backend sync on delete failed, saved locally:', err);
        }
      }
    }
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
  const handleSaveChecksheet = async (updatedItem) => {
    const updated = records.map((rec) => (rec.id === updatedItem.id ? updatedItem : rec));
    setRecords(updated);
    saveStoredSuggestionChecksheets(updated);
    setSelectedItem(updatedItem);

    try {
      await updateChecksheetMutation({ id: updatedItem.id, ...updatedItem }).unwrap();
    } catch (err) {
      console.warn('Backend sync on update failed, saved locally:', err);
    }
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
    <div
      className={`suggestion-checksheet-page-wrapper w-full flex flex-col ${
        currentPage === 'detail' ? 'h-full min-h-0 flex-1 overflow-y-auto p-2 sm:p-4' : 'min-h-0 flex-1 p-2 sm:p-4'
      }`}
    >
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
