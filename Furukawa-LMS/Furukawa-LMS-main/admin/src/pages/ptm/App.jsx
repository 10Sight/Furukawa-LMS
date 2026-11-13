import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import Sidebar from '../../components/ptm/PTM/Sidebar';
import TopHeader from '../../components/ptm/PTM/TopHeader';
import PTMDashboardTable from '../../components/ptm/PTM/PTMDashboardTable';
import FilterToolbar from '../../components/ptm/PTM/FilterToolbar';
import Pagination from '../../components/ptm/PTM/Pagination';
import AddPTMModal from '../../components/ptm/PTM/AddPTMModal';
import PTMTable from '../../components/ptm/PTM/PTMTable';
import PTMHeader from '../../components/ptm/PTM/PTMHeader';
import LoginPage from '../../components/ptm/Auth/LoginPage';
import FormZoomControls from '../../components/shared/FormZoomControls';
import PTMTabNavigation from '../../components/ptm/PTM/PTMTabNavigation';
import {
  PTM_VALID_UNITS,
  getPTMVisibleSheets,
  filterPTMRecordsBySection,
  getPTMSectionCounts,
} from './data/ptmRecordFilters';
import { authApi, ptmApi, sheetApi } from './services/api';
import { initialPTMData } from './data/mockData';
import { initialHeaderInfo, initialPTMRows } from './data/ptmData';
import { ChevronDown, Check, Plus, Download, ArrowLeft, Undo2, Redo2, Save, Clock, CheckCircle2 } from 'lucide-react';

const ProcessAudit = lazy(() => import('../process-audit/ProcessAudit'));
const VALID_UNITS = ['Bawal', 'Gujrat', 'All'];

function getStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createBlankRow(index, unit = 'Both') {
  return {
    id: `row-blank-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    addedFrom: 'filters',
    rowType: 'parent',
    parentSerialNo: index + 1,
    childrenHidden: false,
    phaseNo: '',
    phaseName: '',
    reqNo: '',
    reqName: '',
    customerEvent: '',
    rankA: '',
    rankB: '',
    rankC: '',
    rankS: '',
    critical: false,
    activity: '',
    departments: {
      FA: '',
      HR: '',
      MKT: '',
      DD: '',
      PE: '',
      PPC: '',
      PROD: '',
      SCM: '',
      Quality: '',
    },
    deliverableRequired: 'Yes',
    deliverable: '',
    duration: '',
    startDatePlan: '',
    startDateActual: '',
    endDatePlan: '',
    endDateActual: '',
    hitMiss: '',
    revisedDate: '',
    noOfTimesRevised: '',
    reasonOfFailure: '',
    actionTaken: '',
    respUnits: [unit && ['Bawal', 'Gujrat'].includes(unit) ? unit : 'Bawal'],
    respUnit: unit && ['Bawal', 'Gujrat'].includes(unit) ? unit : 'Bawal',
    respDeptsByUnit: {},
    staffEmployees: [],
    staffEmployee: '',
    staffName: '',
    staffId: '',
    responsiblePersonDept: '',
    status: 'Not-Started',
    remarks: '',
    unit: unit && unit !== 'All Units' ? unit : 'Both',
  };
}

function createDefaultBlankRows(count = 10, unit = 'Both') {
  return Array.from({ length: count }, (_, idx) => createBlankRow(idx, unit));
}

function createBlankHeaderInfo(item) {
  return {
    model: '',
    rank: '',
    apqpLeader: '',
    phase: '',
    projectLeader: item?.createdBy?.name || '',
    reviewDate: '',
    formTitle: 'FRM-WH-DD-006 Project Tracking Matrix Rev. 17',
    tabName: 'PTM - Final Latest Rev. 17',
    deliverableNos: '',
    iterationsInPlan: '',
    finalDate: '',
    finalDateDiff: '',
    scheduleRemarks: '',
    docNo: 'FRM-WH-DD-006',
    revNo: '17',
    issueDate: '07.11.2013',
    revDate: '17.10.23',
  };
}

function loadUnitRows(unit) {
  const scopedRows = getStoredJson(`ptm_rows_data_${unit}`, null);
  if (Array.isArray(scopedRows)) return scopedRows;

  if (unit === 'All Units') {
    return initialPTMRows.map((row) => ({ ...row, unit: row.unit || 'Both' }));
  }

  let legacyOwner;
  try {
    legacyOwner = localStorage.getItem('ptm_legacy_data_owner');
    if (!legacyOwner) {
      legacyOwner = unit;
      localStorage.setItem('ptm_legacy_data_owner', unit);
    }
  } catch {
    legacyOwner = unit;
  }

  const sourceRows = legacyOwner === unit
    ? getStoredJson('ptm_rows_data', initialPTMRows)
    : initialPTMRows;

  return sourceRows
    .filter((row) => !row.unit || row.unit === 'Both' || row.unit === unit)
    .map((row) => ({ ...row, unit: row.unit || unit }));
}

function loadUnitHeaderInfo(unit) {
  const scopedInfo = getStoredJson(`ptm_header_info_${unit}`, null);
  if (scopedInfo) return scopedInfo;

  let legacyOwner;
  try {
    legacyOwner = localStorage.getItem('ptm_legacy_data_owner');
    if (!legacyOwner) {
      legacyOwner = unit;
      localStorage.setItem('ptm_legacy_data_owner', unit);
    }
  } catch {
    legacyOwner = unit;
  }

  return legacyOwner === unit
    ? getStoredJson('ptm_header_info', initialHeaderInfo)
    : initialHeaderInfo;
}

function getPortalUser() {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (raw) {
      const u = typeof raw === 'object' ? raw : JSON.parse(raw);
      const role = u.role || (u.isAdmin ? 'ADMIN' : 'EMPLOYEE');
      const isAdmin = Boolean(
        u.isAdmin ||
        String(role).toUpperCase() === 'ADMIN' ||
        String(role).toUpperCase() === 'SUPERADMIN'
      );
      return {
        id: u.id || u._id || 1,
        username: u.userName || u.username || 'ST080014',
        name: u.fullName || u.name || u.userName || 'ST080014',
        employeeId: u.employeeId || u.empId || u.idCard || 'EMP0080',
        department: u.department?.name || (typeof u.department === 'string' ? u.department : '') || 'Assembly',
        role: role,
        isAdmin: isAdmin,
      };
    }
  } catch {}
  return null;
}

export default function App({ embedded = false, cmsIntegration = false, activeSection = 'ptm', onFormViewChange }) {
  /* ── 0. Authentication State ── */
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ptm_auth_user');
      if (stored) return JSON.parse(stored);
    } catch {}
    if (embedded || cmsIntegration) {
      const portalUser = getPortalUser();
      if (portalUser) return portalUser;
      // Default fallback user for embedded CMS mode
      return {
        id: 1,
        username: 'ST080014',
        name: 'ST080014',
        employeeId: 'EMP0080',
        department: 'Assembly',
        role: 'admin',
        isAdmin: true,
      };
    }
    return null;
  });

  const isAdmin = Boolean(
    currentUser?.isAdmin === true ||
    String(currentUser?.role || '').toUpperCase() === 'ADMIN' ||
    String(currentUser?.role || '').toUpperCase() === 'SUPERADMIN'
  );

  useEffect(() => {
    const handleContextMessage = (event) => {
      if (event.data?.type === 'fme-cms-user-context' && event.data?.user) {
        const u = event.data.user;
        const role = u.role || (u.isAdmin ? 'ADMIN' : 'EMPLOYEE');
        const adminStatus = Boolean(
          u.isAdmin === true ||
          String(role).toUpperCase() === 'ADMIN' ||
          String(role).toUpperCase() === 'SUPERADMIN'
        );
        setCurrentUser((prev) => ({
          ...(prev || {}),
          ...u,
          role,
          isAdmin: adminStatus,
        }));
      }
    };
    window.addEventListener('message', handleContextMessage);
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'fme-cms-user-context-request', page: 'ptm' }, '*');
      }
    } catch {}
    return () => window.removeEventListener('message', handleContextMessage);
  }, []);

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.warn('Logout error', e);
    }
    localStorage.removeItem('ptm_auth_user');
    setCurrentUser(null);
    setCurrentView('list');
    setSelectedTopicItem(null);
    setSelectedUnit(null);
  };

  /* ── 1. Unit Selection State ── */
  const [selectedUnit, setSelectedUnit] = useState(() => {
    try {
      return sessionStorage.getItem('ptm_selected_unit') || 'Bawal';
    } catch {
      return 'Bawal';
    }
  });

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState(activeSection === 'process-audit' ? 'process-audit' : 'list');
  const [isProcessAuditFormOpen, setIsProcessAuditFormOpen] = useState(false);
  const [selectedTopicItem, setSelectedTopicItem] = useState(null);

  useEffect(() => {
    if (activeSection === 'process-audit') setCurrentView('process-audit');
    else if (activeSection === 'ptm' && currentView === 'process-audit') setCurrentView('list');
  }, [activeSection]);

  useEffect(() => {
    onFormViewChange?.(
      (activeSection === 'ptm' && currentView === 'form') ||
      (activeSection === 'process-audit' && isProcessAuditFormOpen)
    );
  }, [activeSection, currentView, isProcessAuditFormOpen, onFormViewChange]);

  /* ── 2. PTM Dashboard List State ── */
  const [listItems, setListItems] = useState(() => {
    try {
      const saved = localStorage.getItem('ptm_dashboard_items');
      return saved ? JSON.parse(saved) : initialPTMData;
    } catch {
      return initialPTMData;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('ptm_dashboard_items', JSON.stringify(listItems));
    } catch (e) {
      console.warn('Could not save list items to localStorage', e);
    }
  }, [listItems]);

  // Sync PTM items from SQLite backend API on mount
  useEffect(() => {
    if (!currentUser) return;
    ptmApi.getAll().then((res) => {
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setListItems(res.data);
      }
    }).catch((err) => {
      console.warn('Could not load PTM items from backend API, using cached data', err);
    });
  }, [currentUser]);

  const [activeTab, setActiveTab] = useState('Company'); // 'Company' (Plant) | 'Department' | 'Self PTM'
  const [activePtmSection, setActivePtmSection] = useState('Ongoing'); // 'Ongoing' | 'Done'
  const [listSearch, setListSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [unitDropdownOpen, setUnitDropdownOpen] = useState(false);

  /* ── 3. PTM Matrix Form Data State ── */
  const [headerInfo, setHeaderInfo] = useState(() => {
    return initialHeaderInfo;
  });

  const projectLeaderOptions = useMemo(
    () => [...new Set([
      headerInfo.projectLeader?.trim(),
      headerInfo.apqpLeader?.trim(),
      ...listItems
        .filter((item) => selectedUnit === 'All Units' || item.plant === selectedUnit)
        .map((item) => item.createdBy?.name?.trim()),
    ].filter(Boolean))],
    [headerInfo.projectLeader, headerInfo.apqpLeader, listItems, selectedUnit]
  );

  const [ptmRows, setPtmRows] = useState(() => {
    return initialPTMRows;
  });

  const formStateRef = useRef({ headerInfo, ptmRows });
  const historyRef = useRef({ undo: [], redo: [] });
  const [, refreshHistory] = useState(0);

  const updateFormState = (key, setter, update) => {
    const current = formStateRef.current;
    const resolved = typeof update === 'function' ? update(current[key]) : update;
    if (Object.is(resolved, current[key])) return;
    historyRef.current.undo.push(structuredClone(current));
    historyRef.current.redo = [];
    const next = { ...current, [key]: resolved };
    formStateRef.current = next;
    setter(resolved);
    refreshHistory((version) => version + 1);
  };

  const updateHeaderInfo = (update) => updateFormState('headerInfo', setHeaderInfo, update);
  const updatePtmRows = (update) => updateFormState('ptmRows', setPtmRows, update);

  const undoFormChange = () => {
    const previous = historyRef.current.undo.pop();
    if (!previous) return;
    historyRef.current.redo.push(structuredClone(formStateRef.current));
    formStateRef.current = previous;
    setHeaderInfo(previous.headerInfo);
    setPtmRows(previous.ptmRows);
    refreshHistory((version) => version + 1);
  };

  const redoFormChange = () => {
    const next = historyRef.current.redo.pop();
    if (!next) return;
    historyRef.current.redo.push(structuredClone(formStateRef.current));
    formStateRef.current = next;
    setHeaderInfo(next.headerInfo);
    setPtmRows(next.ptmRows);
    refreshHistory((version) => version + 1);
  };

  const saveFormChanges = async () => {
    if (!selectedUnit) return;

    // Validate mandatory fields
    const currentRows = formStateRef.current.ptmRows || [];
    for (let i = 0; i < currentRows.length; i++) {
      const r = currentRows[i];
      const hasContent = Boolean(
        r.phaseName || r.reqNo || r.customerEvent || r.activity || r.deliverable ||
        r.startDatePlan || r.endDatePlan || r.startDateActual || r.endDateActual
      );
      if (hasContent) {
        const endPlanVal = String(r.endDatePlan ?? '').trim();
        if (!endPlanVal || endPlanVal === '—' || endPlanVal === '-') {
          showToast(`⚠️ Row ${i + 1}: End Date (Plan) is mandatory.`);
          return;
        }
        if (r.status === 'Delay' || r.hitMiss === 'MISS') {
          const revVal = String(r.noOfTimesRevised ?? '').trim();
          if (!revVal || revVal === '0') {
            showToast(`⚠️ Row ${i + 1}: No. of Times Revised is mandatory when status is Delay / MISS.`);
            return;
          }
          const failVal = String(r.reasonOfFailure ?? '').trim();
          if (!failVal) {
            showToast(`⚠️ Row ${i + 1}: Reason of Failure is mandatory when status is Delay / MISS.`);
            return;
          }
        }
      }
    }

    try {
      const isCustomItem = selectedTopicItem?.isBlankPTM || (selectedTopicItem?.id && localStorage.getItem(`ptm_rows_item_${selectedTopicItem.id}`));
      const sheetKey = isCustomItem ? `item_${selectedTopicItem.id}` : `unit_${selectedUnit}`;

      if (isCustomItem) {
        localStorage.setItem(`ptm_header_info_item_${selectedTopicItem.id}`, JSON.stringify(formStateRef.current.headerInfo));
        localStorage.setItem(`ptm_rows_item_${selectedTopicItem.id}`, JSON.stringify(formStateRef.current.ptmRows));
      } else {
        localStorage.setItem(`ptm_header_info_${selectedUnit}`, JSON.stringify(formStateRef.current.headerInfo));
        localStorage.setItem(`ptm_rows_data_${selectedUnit}`, JSON.stringify(formStateRef.current.ptmRows));
      }

      await sheetApi.save(sheetKey, {
        headerInfo: formStateRef.current.headerInfo,
        rows: formStateRef.current.ptmRows,
      });

      showToast('Changes saved successfully.');
    } catch (error) {
      console.warn('Could not save PTM form changes', error);
      showToast('Changes saved locally.');
    }
  };

  const handleSelectUnit = (unit) => {
    const isAll = unit === 'All' || unit === 'All Units';
    const nextUnit = isAll ? 'All' : (VALID_UNITS.includes(unit) ? unit : 'Bawal');
    try {
      sessionStorage.setItem('ptm_selected_unit', nextUnit);
    } catch {}
    const targetUnit = isAll ? 'All Units' : nextUnit;
    const nextRows = loadUnitRows(targetUnit);
    const nextHeaderInfo = loadUnitHeaderInfo(targetUnit);
    setPtmRows(nextRows);
    setHeaderInfo(nextHeaderInfo);
    formStateRef.current = { ptmRows: nextRows, headerInfo: nextHeaderInfo };
    historyRef.current = { undo: [], redo: [] };
    setSelectedUnit(nextUnit);
    setCurrentPage(1);
    setCurrentView('list');
    setSelectedTopicItem(null);
  };

  const [ptmSearch, setPtmSearch] = useState('');
  const [ptmPhaseFilter, setPtmPhaseFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState(null);

  useEffect(() => {
    if (!selectedUnit) return;
    try {
      if (selectedTopicItem?.isBlankPTM || (selectedTopicItem?.id && localStorage.getItem(`ptm_rows_item_${selectedTopicItem.id}`))) {
        localStorage.setItem(`ptm_header_info_item_${selectedTopicItem.id}`, JSON.stringify(headerInfo));
      } else {
        localStorage.setItem(`ptm_header_info_${selectedUnit}`, JSON.stringify(headerInfo));
      }
    } catch (e) {
      console.warn('Could not save headerInfo to localStorage', e);
    }
  }, [headerInfo, selectedUnit, selectedTopicItem]);

  useEffect(() => {
    if (!selectedUnit) return;
    try {
      if (selectedTopicItem?.isBlankPTM || (selectedTopicItem?.id && localStorage.getItem(`ptm_rows_item_${selectedTopicItem.id}`))) {
        localStorage.setItem(`ptm_rows_item_${selectedTopicItem.id}`, JSON.stringify(ptmRows));
      } else {
        localStorage.setItem(`ptm_rows_data_${selectedUnit}`, JSON.stringify(ptmRows));
      }
    } catch (e) {
      console.warn('Could not save ptmRows to localStorage', e);
    }
  }, [ptmRows, selectedUnit, selectedTopicItem]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /* ── Handlers for PTM Dashboard List ── */
  const visibleListItems = useMemo(() => {
    return getPTMVisibleSheets(listItems, selectedUnit, activeTab, {
      currentUser,
      search: listSearch,
      fromDate,
      toDate
    });
  }, [listItems, selectedUnit, activeTab, currentUser, listSearch, fromDate, toDate]);

  const ptmSectionCounts = useMemo(() => {
    return getPTMSectionCounts(visibleListItems, activeTab, {
      currentUser
    });
  }, [visibleListItems, activeTab, currentUser]);

  const filteredListItems = useMemo(() => {
    return filterPTMRecordsBySection(visibleListItems, activeTab, activePtmSection, {
      currentUser
    });
  }, [visibleListItems, activeTab, activePtmSection, currentUser]);

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredListItems.slice(start, start + itemsPerPage);
  }, [filteredListItems, currentPage, itemsPerPage]);

  const handleOpenForm = async (item) => {
    if (!selectedUnit) return;
    setSelectedTopicItem(item);
    const hasCustomItemSheet = item?.isBlankPTM || Boolean(item?.id && getStoredJson(`ptm_rows_item_${item.id}`, null));
    const sheetKey = hasCustomItemSheet ? `item_${item.id}` : `unit_${selectedUnit === 'All Units' ? (item?.plant || 'All Units') : selectedUnit}`;

    let nextRows = null;
    let nextHeaderInfo = null;

    try {
      const res = await sheetApi.get(sheetKey);
      if (res && res.success && res.data) {
        if (Array.isArray(res.data.rows) && res.data.rows.length > 0) nextRows = res.data.rows;
        if (res.data.headerInfo) nextHeaderInfo = res.data.headerInfo;
      }
    } catch (e) {
      console.warn('Could not load sheet from backend API', e);
    }

    if (!nextRows || !nextHeaderInfo) {
      if (hasCustomItemSheet) {
        nextRows = nextRows || getStoredJson(`ptm_rows_item_${item.id}`, createDefaultBlankRows(10, item.plant));
        nextHeaderInfo = nextHeaderInfo || getStoredJson(`ptm_header_info_item_${item.id}`, createBlankHeaderInfo(item));
      } else {
        const targetUnit = selectedUnit === 'All Units' ? (item?.plant || 'All Units') : selectedUnit;
        nextRows = nextRows || loadUnitRows(targetUnit);
        nextHeaderInfo = nextHeaderInfo || loadUnitHeaderInfo(targetUnit);
      }
    }

    setPtmRows(nextRows);
    setHeaderInfo(nextHeaderInfo);
    formStateRef.current = { ptmRows: nextRows, headerInfo: nextHeaderInfo };
    historyRef.current = { undo: [], redo: [] };
    setCurrentView('form');
    showToast(`Opening PTM Form for: ${item.topic}`);
  };

  const handleAddListItem = async (newItem) => {
    const itemWithBlankSheet = { ...newItem, isBlankPTM: true };
    const blankRows = createDefaultBlankRows(10, newItem.plant);
    const blankHeader = createBlankHeaderInfo(newItem);
    try {
      localStorage.setItem(`ptm_rows_item_${newItem.id}`, JSON.stringify(blankRows));
      localStorage.setItem(`ptm_header_info_item_${newItem.id}`, JSON.stringify(blankHeader));
    } catch (e) {
      console.warn('Could not initialize blank PTM sheet in localStorage', e);
    }
    setListItems([itemWithBlankSheet, ...listItems]);
    showToast('✓ New PTM item created with 10 blank rows');

    // Sync to SQLite backend API
    try {
      await ptmApi.create(newItem);
      await sheetApi.save(`item_${newItem.id}`, { headerInfo: blankHeader, rows: blankRows });
    } catch (e) {
      console.warn('Could not sync created PTM item to backend API', e);
    }
  };

  const handleCopyListItem = (item) => {
    const newId = `PTM-${item.plant === 'Gujrat' ? 'GJ' : 'BW'}-${Math.floor(100 + Math.random() * 900)}`;
    const copied = {
      ...item,
      id: newId,
      topic: `${item.topic} (Copy)`,
    };
    if (item?.isBlankPTM || getStoredJson(`ptm_rows_item_${item.id}`, null)) {
      const existingRows = getStoredJson(`ptm_rows_item_${item.id}`, createDefaultBlankRows(10, item.plant));
      const existingHeader = getStoredJson(`ptm_header_info_item_${item.id}`, createBlankHeaderInfo(copied));
      try {
        localStorage.setItem(`ptm_rows_item_${newId}`, JSON.stringify(existingRows));
        localStorage.setItem(`ptm_header_info_item_${newId}`, JSON.stringify(existingHeader));
      } catch (e) {
        console.warn('Could not copy custom PTM sheet to localStorage', e);
      }
    }
    setListItems([copied, ...listItems]);
    showToast('✓ PTM item duplicated');
  };

  const handleDeleteListItem = async (id) => {
    if (!isAdmin) {
      showToast('❌ Only Admin has permission to delete PTM sheets');
      return;
    }
    setListItems((prev) => prev.filter((it) => it.id !== id));
    showToast('✓ PTM item deleted');
    try {
      await ptmApi.delete(id);
    } catch (e) {
      console.warn('Could not delete PTM item from backend API', e);
    }
  };

  const handleExportList = () => {
    if (!selectedUnit) {
      setUnitDropdownOpen(true);
      return;
    }
    const headers = ['S.No', 'ID', 'Topic', 'Description', 'Plant', 'Scope', 'Date', 'Time', 'Created By'];
    const rows = filteredListItems.map((it, idx) => [
      idx + 1,
      it.id,
      `"${(it.topic || '').replace(/"/g, '""')}"`,
      `"${(it.description || '').replace(/"/g, '""')}"`,
      it.plant,
      it.scope,
      it.date,
      it.time,
      `"${it.createdBy?.name || ''}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PTM_${selectedUnit || 'All'}_${activeTab}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Excel/CSV report exported');
  };

  /* ── Form Reset ── */
  const handleResetPTM = () => {
    if (window.confirm('Reset all PTM rows and headers to the default template?')) {
      setHeaderInfo(initialHeaderInfo);
      setPtmRows(initialPTMRows);
      formStateRef.current = { headerInfo: initialHeaderInfo, ptmRows: initialPTMRows };
      historyRef.current = { undo: [], redo: [] };
      showToast('✓ Reset to default template');
    }
  };

  const handleAddRowFromTop = () => {
    const newRow = {
      id: 'row-' + Date.now(),
      addedFrom: 'filters',
      rowType: 'parent',
      childrenHidden: false,
      phaseNo: '',
      phaseName: '',
      reqNo: '',
      reqName: '',
      customerEvent: '',
      rankA: '',
      rankB: '',
      rankC: '',
      rankS: '',
      critical: null,
      activity: '',
      departments: {
        FA: '',
        HR: '',
        MKT: '',
        DD: '',
        PE: '',
        PPC: '',
        PROD: '',
        SCM: '',
        Quality: '',
      },
      deliverableRequired: 'Yes',
      deliverable: '',
      duration: '',
      startDatePlan: '',
      startDateActual: '',
      endDatePlan: '',
      endDateActual: '',
      hitMiss: '',
      revisedDate: '',
      noOfTimesRevised: '',
      reasonOfFailure: '',
      actionTaken: '',
      status: 'Not-Started',
      remarks: '',
      unit: selectedUnit || 'Both',
    };
    updatePtmRows((currentRows) => {
      const parentRows = currentRows.filter((row) => !(
        row.rowType === 'child' || (row.addedFrom === 'form' && row.formGroupRole === 'child')
      ));
      const highestParentSerial = parentRows.reduce((highest, row, index) => {
        const serial = Number(row.parentSerialNo) || index + 1;
        return Math.max(highest, serial);
      }, 0);
      return [...currentRows, { ...newRow, parentSerialNo: highestParentSerial + 1 }];
    });
    showToast('✓ New parent row added at bottom');
  };

  const handleExportMatrixCSV = () => {
    const headers = [
      'Phase No. / Name',
      'AIAG Req No.',
      'AIAG Requirements',
      'Customer Event Name',
      'Rank A',
      'Rank B',
      'Rank C1 & C2',
      'Rank S',
      'Critical Activity',
      'Activity (New)',
      'F&A',
      'HR',
      'MKT',
      'D&D',
      'PE',
      'PPC',
      'PROD',
      'SCM',
      'Quality',
      'Deliverable Required Yes/No',
      'Deliverable Attachment',
      'Std. Duration in Hours',
      'Start Date (Plan)',
      'Start Date (Actual)',
      'End Date (Plan)',
      'End Date (Actual)',
      'HIT/MISS',
      'No. of Times Revised',
      'Reason of Failure',
      'Action Taken Against Failure',
      'Responsible Unit',
      'Responsible Dept',
      'Responsible Staff Name',
      'Status',
      'Remarks',
    ];

    const dataRows = ptmRows.map((r) => {
      const respUnitsStr = Array.isArray(r.respUnits) && r.respUnits.length > 0 ? r.respUnits.join(', ') : (r.respUnit || '');
      const respDeptsStr = r.responsiblePersonDept || (r.respDeptsByUnit ? Object.values(r.respDeptsByUnit).flat().join(', ') : '') || '';
      const respStaffStr = r.staffEmployee || r.staffName || '';

      return [
        `"${(r.phaseName || '').replace(/"/g, '""')}"`,
        `"${r.reqNo || ''}"`,
        `"${(r.reqName || '').replace(/"/g, '""')}"`,
        `"${(r.customerEvent || '').replace(/"/g, '""')}"`,
        `"${r.rankA || ''}"`,
        `"${r.rankB || ''}"`,
        `"${r.rankC || ''}"`,
        `"${r.rankS || ''}"`,
        `"${r.critical ? 'Yes' : 'No'}"`,
        `"${(r.activity || '').replace(/"/g, '""')}"`,
        `"${r.departments?.FA || ''}"`,
        `"${r.departments?.HR || ''}"`,
        `"${r.departments?.MKT || ''}"`,
        `"${r.departments?.DD || ''}"`,
        `"${r.departments?.PE || ''}"`,
        `"${r.departments?.PPC || ''}"`,
        `"${r.departments?.PROD || ''}"`,
        `"${r.departments?.SCM || ''}"`,
        `"${r.departments?.Quality || ''}"`,
        `"${r.deliverableRequired || 'Yes'}"`,
        `"${(r.deliverableFile?.name || r.deliverable || '').replace(/"/g, '""')}"`,
        `"${r.duration || ''}"`,
        `"${r.startDatePlan || ''}"`,
        `"${r.startDateActual || ''}"`,
        `"${r.endDatePlan || ''}"`,
        `"${r.endDateActual || ''}"`,
        `"${r.hitMiss || ''}"`,
        `"${r.noOfTimesRevised || ''}"`,
        `"${(r.reasonOfFailure || '').replace(/"/g, '""')}"`,
        `"${(r.actionTaken || '').replace(/"/g, '""')}"`,
        `"${respUnitsStr.replace(/"/g, '""')}"`,
        `"${respDeptsStr.replace(/"/g, '""')}"`,
        `"${respStaffStr.replace(/"/g, '""')}"`,
        `"${r.status || ''}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...dataRows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PTM_Matrix_${selectedUnit || 'All'}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('✓ Complete PTM CSV exported');
  };

  if (!currentUser && !embedded && !cmsIntegration) {
    return <LoginPage onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isFormFullScreen = currentView === 'form' || (currentView === 'process-audit' && isProcessAuditFormOpen);

  return (
    <div className={`${isFormFullScreen ? 'h-screen min-h-0 overflow-hidden' : 'min-h-screen'} bg-[#F4F6F9] text-slate-800 flex`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
          {toastMessage}
        </div>
      )}

      {/* Add PTM Modal */}
      <AddPTMModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddListItem}
        defaultUnit={selectedUnit}
        currentUser={currentUser}
      />

      {/* Left Sidebar (Only in standalone mode) */}
      {!embedded && !cmsIntegration && (
        <Sidebar
          collapsed={sidebarCollapsed}
          setCollapsed={setSidebarCollapsed}
          hidden={currentView === 'form'}
          currentView={currentView}
          setCurrentView={(view) => setCurrentView(view)}
          onLogout={handleLogout}
        />
      )}

      {/* Main Layout */}
      <div
        className={`flex-1 min-w-0 flex flex-col ${isFormFullScreen ? 'h-screen min-h-0 overflow-hidden' : 'min-h-screen'} transition-all duration-300 ${
          embedded || cmsIntegration || currentView === 'form' ? 'ml-0' : sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {/* Top Header (Only in standalone mode) */}
        {!embedded && !cmsIntegration && currentView !== 'form' && (
          <TopHeader
            currentView={currentView}
            currentUser={currentUser}
            onLogout={handleLogout}
            onExport={handleExportList}
            onBackToList={() => setCurrentView('list')}
          />
        )}

        {/* ── VIEW 1: PTM DASHBOARD LIST VIEW ── */}
        {currentView === 'list' && (
          <main className="ptm-page-root p-4 md:p-6 space-y-4 flex-1 w-full mx-auto max-w-[1600px]">
            {/* 1. Scope Tabs: Plant (with Dropdown), Department, Self PTM and Calendar Filter */}
            <div className="flex flex-wrap items-center gap-3">
              <PTMTabNavigation
                activeTab={activeTab}
                setActiveTab={(tab) => {
                  setActiveTab(tab);
                  setActivePtmSection('Ongoing');
                  setCurrentPage(1);
                }}
                selectedUnit={selectedUnit}
                setSelectedUnit={handleSelectUnit}
              />

              {/* Calendar Filter in the Green Marked Place */}
              <div id="ptm-date-filter-bar" className="flex flex-wrap items-center gap-2 bg-white rounded-2xl p-2 px-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3]">
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                  <span className="text-xs sm:text-sm font-bold text-slate-500">From Date</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={toDate || undefined}
                    onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                  <span className="text-xs sm:text-sm font-bold text-slate-500">To Date</span>
                  <input
                    type="date"
                    value={toDate}
                    min={fromDate || undefined}
                    onChange={e => { setToDate(e.target.value); setCurrentPage(1); }}
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </label>
                {(fromDate || toDate) && (
                  <button
                    type="button"
                    onClick={() => { setFromDate(''); setToDate(''); setCurrentPage(1); }}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Clear dates
                  </button>
                )}
                {fromDate && toDate && fromDate > toDate && (
                  <span role="alert" className="text-xs text-red-600 font-medium">From Date must not be later than To Date.</span>
                )}
              </div>
            </div>

            {/* 2. Section Navigation: Ongoing & Done (No sub-filter bar!) */}
            <div className="bg-white rounded-2xl p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActivePtmSection('Ongoing');
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
                    activePtmSection === 'Ongoing'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Ongoing</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-black ${
                      activePtmSection === 'Ongoing'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ptmSectionCounts.Ongoing}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePtmSection('Done');
                    setCurrentPage(1);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm sm:text-base font-bold transition-all cursor-pointer ${
                    activePtmSection === 'Done'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Done</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs sm:text-sm font-black ${
                      activePtmSection === 'Done'
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {ptmSectionCounts.Done}
                  </span>
                </button>
              </div>

              <div className="text-sm text-slate-600 font-medium">
                Showing <strong>{filteredListItems.length}</strong> {activePtmSection.toLowerCase()} {filteredListItems.length === 1 ? 'sheet' : 'sheets'}
              </div>
            </div>

            {/* 2. Search and Action Row: Search input + Export Excel + Add PTM */}
            <div className="sticky top-0 z-20 rounded-xl bg-[#F4F6F9] py-1">
              <FilterToolbar
                searchQuery={listSearch}
                setSearchQuery={(q) => {
                  setListSearch(q);
                  setCurrentPage(1);
                }}
                onExport={handleExportList}
                onOpenAddModal={() => {
                  if (selectedUnit) setIsAddModalOpen(true);
                  else setUnitDropdownOpen(true);
                }}
              />
            </div>

            {/* 3. Table matching user screenshot with BLUE clickable topic links */}
            <div>
              <PTMDashboardTable
                items={paginatedItems}
                unitSelected={Boolean(selectedUnit)}
                onOpenForm={handleOpenForm}
                onCopy={handleCopyListItem}
                onDelete={handleDeleteListItem}
                onExportRow={handleExportList}
                pageStartIndex={(currentPage - 1) * itemsPerPage}
                canDelete={isAdmin}
              />
            </div>

            {/* 4. Pagination */}
            {selectedUnit && (
              <div>
                <Pagination
                  totalItems={filteredListItems.length}
                  itemsPerPage={itemsPerPage}
                  currentPage={currentPage}
                  onPageChange={(p) => setCurrentPage(p)}
                />
              </div>
            )}
          </main>
        )}

        {/* ── VIEW: PROCESS AUDIT ── */}
        {currentView === 'process-audit' && (
          <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-slate-500">Loading Process Audit…</div>}>
            <ProcessAudit
              showToast={showToast}
              onFormOpenChange={setIsProcessAuditFormOpen}
            />
          </Suspense>
        )}

        {/* ── VIEW 2: PTM FORM MATRIX VIEW ── */}
        {currentView === 'form' && (
          <main className="ptm-page-root px-2 pb-2 pt-14 sm:px-3 sm:pb-3 md:px-4 md:pb-4 md:pt-14 space-y-3.5 flex-1 min-h-0 min-w-0 w-full mx-auto max-w-full flex flex-col overflow-hidden">
            {/* Top Toolbar */}
            <div className="ptm-top-toolbar fixed inset-x-0 top-0 z-[60] flex min-h-12 w-full flex-wrap items-center gap-2 border-b border-slate-300 bg-white px-4 py-2 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setCurrentView('list');
                  setSelectedTopicItem(null);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={undoFormChange}
                disabled={historyRef.current.undo.length === 0}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                title="Go to the previous form state"
              >
                <Undo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={redoFormChange}
                disabled={historyRef.current.redo.length === 0}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                title="Go to the next form state"
              >
                <Redo2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={saveFormChanges}
                className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 cursor-pointer"
                title="Save all current form changes"
              >
                <Save className="h-4 w-4" />
                <span>Save</span>
              </button>
              <button
                type="button"
                onClick={handleAddRowFromTop}
                className="flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 cursor-pointer"
                title="Add a new parent row at the bottom"
              >
                <Plus className="h-4 w-4" />
                <span>Add Row</span>
              </button>
              <button
                type="button"
                onClick={handleExportMatrixCSV}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                title="Export complete matrix to CSV"
              >
                <Download className="h-4 w-4 text-slate-500" />
                <span>Export CSV</span>
              </button>
              <FormZoomControls selector=".ptm-zoom-surface" rootSelector="main" />
            </div>

            {/* MERGED PTM FORM + MATRIX TABLE AS A SINGLE UNIFIED DOCUMENT */}
            <div className="relative z-0 flex-1 min-h-0 min-w-0 bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
              <div className="h-full min-h-0 min-w-0 overflow-auto overscroll-contain [scrollbar-gutter:stable]">
                <div className="min-w-[3200px] w-full ptm-zoom-surface">
                  <PTMHeader
                    headerInfo={headerInfo}
                    setHeaderInfo={updateHeaderInfo}
                    projectLeaderOptions={projectLeaderOptions}
                    isMerged={true}
                  />
                  <PTMTable
                    rows={ptmRows}
                    setRows={updatePtmRows}
                    onResetDefault={handleResetPTM}
                    searchQuery={ptmSearch}
                    setSearchQuery={setPtmSearch}
                    phaseFilter={ptmPhaseFilter}
                    setPhaseFilter={setPtmPhaseFilter}
                    deptFilter={deptFilter}
                    setDeptFilter={setDeptFilter}
                    showToast={showToast}
                    selectedUnit={selectedUnit}
                    onAddNewRow={handleAddRowFromTop}
                    isMerged={true}
                    isAdmin={isAdmin}
                  />
                </div>
              </div>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
