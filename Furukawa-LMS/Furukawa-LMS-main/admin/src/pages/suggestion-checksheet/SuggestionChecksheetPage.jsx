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

  const authUser = useSelector((state) => state.auth?.user);
  const isAdmin = Boolean(
    authUser?.isAdmin ||
    authUser?.role === 'ADMIN' ||
    authUser?.role === 'SUPERADMIN' ||
    authUser?.isSuperAdmin ||
    authUser?.customRole?.permissions?.includes('admin') ||
    authUser?.customRoleName?.toLowerCase()?.includes('admin')
  );

  const [records, setRecords] = useState(() => getStoredSuggestionChecksheets());
  const [selectedItem, setSelectedItem] = useState(null);
  const [currentPage, setCurrentPage] = useState('list'); // 'list' | 'detail'
  const [selectedUnit, setSelectedUnit] = useState('Bawal'); // Default unit is Bawal
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'BEST'

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

  // Toggle Best Suggestion (Admin only)
  const handleToggleBest = async (item) => {
    if (!isAdmin) return;
    const newIsBest = !item.isBest;
    const updatedItem = {
      ...item,
      isBest: newIsBest,
    };
    await handleSaveChecksheet(updatedItem);
  };

  // Back to list
  const handleBackToList = () => {
    setCurrentPage('list');
    setSelectedItem(null);
    if (typeof setIsFormView === 'function') {
      setIsFormView(false);
    }
  };

  // Check if current user is creator of the selected sheet
  const isCreatorOfItem = (item) => {
    if (!authUser || !item) return false;
    const uFull = (authUser.fullName || '').toLowerCase().trim();
    const uName = (authUser.name || '').toLowerCase().trim();
    const uEmp = (authUser.empId || authUser.employeeId || '').toLowerCase().trim();
    const uUser = (authUser.userName || '').toLowerCase().trim();
    const subBy = (item.submittedBy || '').toLowerCase();

    return Boolean(
      (uFull && subBy.includes(uFull)) ||
      (uName && subBy.includes(uName)) ||
      (uEmp && subBy.includes(uEmp)) ||
      (uUser && subBy.includes(uUser)) ||
      (authUser.id && item.createdById === authUser.id)
    );
  };

  // Edit access rule:
  // In Best Suggestions page (or if item.isBest): only admin and sheet creator can edit; others can view only
  const isReadOnly = Boolean((selectedItem?.isBest || Number(selectedItem?.defectPreventionRank) >= 4) && !isAdmin && !isCreatorOfItem(selectedItem));

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
          isReadOnly={isReadOnly}
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
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdmin={isAdmin}
          onToggleBest={handleToggleBest}
        />
      )}
    </div>
  );
}
