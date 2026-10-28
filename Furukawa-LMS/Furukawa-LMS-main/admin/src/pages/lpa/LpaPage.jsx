import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { Upload, Save, ArrowLeft, ZoomIn, ZoomOut, Trash2, Search, Download, ChevronDown, CalendarDays, ClipboardList, AlertTriangle, Plus, Eye, Mail, User, BarChart3 } from 'lucide-react';
import { listLPAWorkbooks, createLPAWorkbook, saveLPAWorkbook, deleteLPAWorkbook } from './lpaStore';
import { confirmFormDeletion } from '@components/shared/confirmFormDeletion';
import { columnName, editLPACell, importLPAWorkbook, extractWorkbookMetadata } from './lpaWorkbook';
import AssemblySheet from '../../components/lpa/AssemblySheet';
import { isAssemblyCheckSheet, upgradeAssemblyRecord, createBlankAssemblySheet, getActiveAuditColumns, syncSheetWithLatestSameDaySources, normalizeSourceSheets, sheetHasData } from '../../components/lpa/assemblySheetUtils';
import CcSheet from '../../components/lpa/CcSheet';
import assemblyTemplate from './assemblyTemplate.json' with { type: 'json' };
import { ccTemplate, isCcCheckSheet, upgradeCcTemplateRecord, createBlankCcSheet } from './ccTemplate';
import lpaApi from '@/services/api/lpaApi.js';
import pdcaApi from '@/services/api/pdcaApi.js';
import PDCASheet from '../../components/pdca/PDCASheet';
import AddPDCAModal from '../../components/pdca/AddPDCAModal';
import SendMailModal from '../../components/common/SendMailModal';
import CreateLpaModal from '../../components/lpa/CreateLpaModal';
import { usePDCA } from '@hooks/pdca/usePDCA.js';
import { PDCAProvider } from '../pdca/context/PDCAContext';
import { getLpaPdcaTopic, saveLpaPdcaSnapshot, extractObservationsFromSheet, createEmptyPdcaRow, getWorksheetScore, getWorksheetScoresList } from './lpaPdcaUtils';
import { isRecordCreator, canEditRecord } from '@pages/pdca/data/recordFilters.js';
import LpaTable from '../../components/lpa/LpaTable';
import { matchesLpaDateRange, normalizeLpaDate } from './lpaDateFilters.js';

const SECTIONS = [{ id: 'assembly', label: 'Assembly' }, { id: 'cc', label: 'C&C' }];
const UNITS = ['Bawal', 'Gujrat'];
const LEVELS = ['L1', 'L2', 'L3'];
const todayIso = new Date().toISOString().slice(0, 10);
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primary = button.replace('border-slate-200', 'border-blue-600').replace('bg-white', 'bg-blue-600').replace('text-slate-700', 'text-white').replace('hover:bg-slate-50', 'hover:bg-blue-700');
const errorText = error => error.message || 'Could not save LPA data. Your edits have been retained.';
const formatLpaDate = value => {
  if (!value) return '-';
  const raw = String(value).trim();
  let day; let month; let year;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  const local = raw.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (iso) [, year, month, day] = iso;
  else if (local) [, day, month, year] = local;
  else {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    day = parsed.getDate();
    month = parsed.getMonth() + 1;
    year = parsed.getFullYear();
  }
  return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
};

const isLpaRecordForSection = (rec, section, unit) => {
  if (!rec || rec.isDeleted) return false;
  const recId = String(rec.id || rec.recordId || '');
  const recPlant = String(rec.plant || rec.unit || '').toLowerCase();
  const currentUnit = String(unit || 'Bawal').toLowerCase();

  // Unit match (if specified on record)
  if (recPlant && recPlant !== 'all' && recPlant !== 'unit' && recPlant !== 'all plants' && recPlant !== currentUnit) {
    return false;
  }

  // Section / LPA match
  const sec = String(section || '').toLowerCase();
  const idLower = recId.toLowerCase();
  const topicLower = String(rec.topic || '').toLowerCase();
  const catLower = String(rec.category || rec.lpaCategory || '').toLowerCase();
  const deptLower = String(rec.department || '').toLowerCase();

  const isLpa = idLower.includes('lpa') || topicLower.includes('lpa') || catLower.includes('lpa') || rec.lpaSource != null;
  if (!isLpa && !idLower.startsWith('pdca-lpa-')) return false;

  if (sec === 'assembly') {
    if (idLower.includes('-cc-') || catLower === 'cc' || (topicLower.includes('c&c') && !topicLower.includes('assembly'))) {
      return false;
    }
    return idLower.includes('assembly') || topicLower.includes('assembly') || catLower.includes('assembly') || deptLower.includes('assembly');
  } else {
    if (idLower.includes('-assembly-') || catLower === 'assembly' || (topicLower.includes('assembly') && !topicLower.includes('c&c'))) {
      return false;
    }
    return idLower.includes('-cc-') || topicLower.includes('c&c') || topicLower.includes('cc') || catLower.includes('cc') || deptLower.includes('c&c') || deptLower.includes('cc');
  }
};

class PdcaErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('PDCA Sheet render error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50">
          <div className="max-w-md p-6 bg-white border border-rose-200 rounded-2xl shadow-sm space-y-4">
            <h3 className="text-base font-bold text-slate-900">Unable to display PDCA Sheet</h3>
            <p className="text-xs text-rose-600 font-mono bg-rose-50 p-2.5 rounded-lg text-left overflow-auto max-h-32">
              {String(this.state.error?.message || this.state.error)}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onBack?.();
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-sm transition-colors"
            >
              Return to LPA Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LpaPageContent({ viewContext }) {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutletContext();
  const layout = viewContext || outlet || {};
  const { setIsFormView = () => { } } = layout;
  const userId = useSelector(state => state.auth.user?.id || state.auth.user?._id || 'current');
  const { handleAddPDCA, handleUpdatePDCA, showToast, refreshData } = usePDCA();
  const [pdcaModalMode, setPdcaModalMode] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [editor, setEditor] = useState(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState('Bawal');
  const [selectedLevel, setSelectedLevel] = useState('L1');
  const [pdcaDate, setPdcaDate] = useState(new Date().toISOString().slice(0, 10));
  const [activeSection, setActiveSection] = useState('assembly');
  const [activeSubTab, setActiveSubTab] = useState('lpa');
  const [customPdcaTopic, setCustomPdcaTopic] = useState(null);
  const [isPdcaSheetOpen, setIsPdcaSheetOpen] = useState(false);
  const [pdcaSaveVersion, setPdcaSaveVersion] = useState(0);
  const [backendPdcaSheets, setBackendPdcaSheets] = useState([]);
  const [isPdcaLoading, setIsPdcaLoading] = useState(false);

  const loadBackendPdcaSheets = useCallback(async () => {
    try {
      setIsPdcaLoading(true);
      const res = await pdcaApi.getRecords({ limit: 100 });
      const recordsList = Array.isArray(res) ? res : (res?.records || []);
      setBackendPdcaSheets(recordsList);

      const hasContent = (s) => Array.isArray(s?.rows) && s.rows.some(r => Boolean(
        r?.date?.trim() || r?.observation?.trim() || r?.rootCause?.trim() || r?.counterMeasure?.trim() ||
        (r?.status && r?.status !== 'Not-Started') || r?.staffEmployee?.trim() || r?.department?.trim()
      ));

      const currentUnit = selectedUnit || 'Bawal';
      const baseSheetIds = [
        `PDCA-LPA-CC-${currentUnit}`,
        `PDCA-LPA-ASSEMBLY-${currentUnit}`
      ];
      for (const sId of baseSheetIds) {
        try {
          const sh = await pdcaApi.getSheet(sId);
          if (hasContent(sh)) {
            try {
              localStorage.setItem(`lpa_pdca_saved_${sId}`, JSON.stringify(sh));
            } catch {}
          }
        } catch {}
      }
    } catch (err) {
      console.warn('Could not fetch backend PDCA records:', err);
    } finally {
      setIsPdcaLoading(false);
    }
  }, [selectedUnit]);

  useEffect(() => {
    loadBackendPdcaSheets();
  }, [loadBackendPdcaSheets, activeSection, selectedUnit, pdcaSaveVersion]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isSendMailOpen, setIsSendMailOpen] = useState(false);
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false);
  const showUnsavedAlertRef = useRef(false);
  showUnsavedAlertRef.current = showUnsavedAlert;
  const initialSnapshotRef = useRef(null);
  const uploadSection = useRef('assembly');
  const fileInput = useRef(null);
  const requestInFlight = useRef(false);
  const seededSampleScopes = useRef(new Set());
  const dirtyRef = useRef(false);

  const hasUnsavedChanges = useCallback(() => {
    if (!dirty || !editor) return false;
    if (!initialSnapshotRef.current) return true;
    try {
      return JSON.stringify(editor) !== initialSnapshotRef.current;
    } catch {
      return true;
    }
  }, [dirty, editor]);

  dirtyRef.current = hasUnsavedChanges() || Boolean(pendingUpload) || busy;
  const draftKey = useCallback(id => `lpa_draft_${userId}_${id}`, [userId]);
  const uploadDraftKey = `lpa_upload_draft_${userId}`;

  useEffect(() => {
    try {
      const draft = JSON.parse(localStorage.getItem(uploadDraftKey) || 'null');
      if (draft && ['assembly', 'cc'].includes(draft.section) && Array.isArray(draft.sheets)) setPendingUpload(draft);
    } catch { /* Invalid recovery caches never replace saved workbooks. */ }
  }, [uploadDraftKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allWorkbooks = await listLPAWorkbooks(userId);
      const realWorkbooks = (allWorkbooks || []).filter(w => !w.sampleData);
      setRecords(realWorkbooks);
      setMessage(null);
    } catch (error) {
      setMessage({ error: true, text: errorText(error) });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const isEditorOpen = Boolean(editor);
  const isPdcaFormOpen = Boolean(customPdcaTopic) || isPdcaSheetOpen;
  const isFormViewActive = isEditorOpen || isPdcaFormOpen;
  useEffect(() => {
    setIsFormView(isFormViewActive);
    return () => setIsFormView(false);
  }, [isFormViewActive, setIsFormView]);
  useEffect(() => {
    const warn = event => { if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  useEffect(() => {
    if (!editor || !dirty) return;
    try { localStorage.setItem(draftKey(editor.id), JSON.stringify(editor)); }
    catch { /* The live editor is retained; Back still requires a successful save. */ }
  }, [editor, dirty, draftKey]);

  const openSheet = async (recordInput, index) => {
    let record = recordInput?.section === 'assembly' ? upgradeAssemblyRecord(recordInput) : recordInput;
    const needsTemplateUpgrade = Boolean(record._needsTemplateUpgrade);
    if (needsTemplateUpgrade) {
      record = { ...record };
      delete record._needsTemplateUpgrade;
    }
    if (!record.id) {
      if (requestInFlight.current) return;
      requestInFlight.current = true;
      setBusy(true);
      try {
        const saved = await createLPAWorkbook(userId, record);
        setRecords(previous => [saved, ...previous]);
        record = saved;
      } catch (error) { setMessage({ error: true, text: errorText(error) }); return; }
      finally { requestInFlight.current = false; setBusy(false); }
    }
    setDirty(false);
    let next = structuredClone(record);
    try {
      const raw = localStorage.getItem(draftKey(record.id));
      if (raw && window.confirm('An unsaved draft exists for this workbook. Recover it?')) {
        const draftRecord = upgradeCcTemplateRecord(JSON.parse(raw));
        const draft = { ...draftRecord };
        delete draft._needsTemplateUpgrade;
        if (draft.id === record.id && draft.section === record.section && Array.isArray(draft.sheets)) {
          if (draft.version !== record.version) {
            setMessage({ error: true, text: 'The saved workbook changed after this draft. The draft is retained locally; open the latest saved workbook before applying your edits.' });
            setDirty(false);
          } else { next = draft; setDirty(true); }
        }
      } else setDirty(needsTemplateUpgrade);
    } catch { setDirty(needsTemplateUpgrade); }
    // For Level 1 and Level 2 sheets, synchronize fetched columns with latest same-day source data
    const recTargetLevel = next.targetLevel || next.level || (next.levels?.includes('L1') ? 'L1' : next.levels?.includes('L2') ? 'L2' : 'L3');
    if (recTargetLevel === 'L1' || recTargetLevel === 'L2') {
      let sameDaySources = null;
      try {
        sameDaySources = await lpaApi.getSameDaySourceData({
          section: next.section,
          unit: next.unit || selectedUnit,
          auditDate: next.auditDate || next.date,
          department: next.department,
          line: next.line
        });
      } catch {
        const sameDayRecords = records.filter(r =>
          r.id !== next.id &&
          r.section === next.section &&
          (r.unit === next.unit || (!r.unit && (next.unit || selectedUnit) === 'Bawal')) &&
          (r.auditDate === (next.auditDate || next.date) || r.date === (next.auditDate || next.date))
        );
        sameDaySources = sameDayRecords;
      }

      if (sameDaySources && Array.isArray(next.sheets)) {
        next.sheets = next.sheets.map(sh =>
          syncSheetWithLatestSameDaySources(sh, sameDaySources, recTargetLevel, next.section === 'cc')
        );
      }
    }

    setSheetIndex(index);
    setZoom(150);
    setEditor(next);
    initialSnapshotRef.current = JSON.stringify(next);
  };
  const handledMailViewRef = useRef('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const workbookId = params.get('viewWorkbookId');
    const sheetIndex = Number(params.get('sheetIndex') || 0);
    const token = workbookId ? `${workbookId}:${sheetIndex}` : '';
    if (!token || loading || handledMailViewRef.current === token) return;
    const record = records.find((item) => String(item.id) === String(workbookId) && item.section === 'assembly');
    if (!record || !Array.isArray(record.sheets) || !record.sheets[sheetIndex]) return;
    handledMailViewRef.current = token;
    openSheet(record, sheetIndex).then(() => navigate('/cms/lpa', { replace: true }));
  }, [location.search, loading, records, navigate]);
  const authUser = useSelector(state => state.auth?.user);
  const effectiveAuthUser = useMemo(() => {
    if (authUser) return authUser;
    try {
      const stored = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
      if (stored) return JSON.parse(stored);
    } catch { }
    return null;
  }, [authUser]);

  const isAdmin = Boolean(
    effectiveAuthUser?.isAdmin === true ||
    effectiveAuthUser?.isAdmin === 1 ||
    String(effectiveAuthUser?.role || '').toUpperCase() === 'ADMIN' ||
    String(effectiveAuthUser?.role || '').toUpperCase() === 'SUPERADMIN'
  );

  const userPermissions = useMemo(() => {
    let u = effectiveAuthUser;
    let perms = u?.customRole?.permissions;
    if (!perms) {
      try {
        const stored = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('user') : null) ||
          (typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null);
        if (stored) {
          const parsed = JSON.parse(stored);
          perms = parsed?.customRole?.permissions;
        }
      } catch { }
    }
    if (Array.isArray(perms)) return perms;
    if (typeof perms === 'string') {
      try { return JSON.parse(perms); } catch { return []; }
    }
    return [];
  }, [effectiveAuthUser]);

  const hasPermission = useCallback((perm) => {
    if (isAdmin) return true;
    if (userPermissions.includes('lpa:manage') || userPermissions.includes('pdca:manage') || userPermissions.includes('pdca:full_access')) return true;
    return userPermissions.includes(perm);
  }, [isAdmin, userPermissions]);

  const hasExplicitAssembly = userPermissions.includes('lpa:assembly');
  const hasExplicitCc = userPermissions.includes('lpa:cc');
  const canAccessAssembly = Boolean(isAdmin || hasPermission('lpa:manage') || hasExplicitAssembly || (!hasExplicitAssembly && !hasExplicitCc));
  const canAccessCc = Boolean(isAdmin || hasPermission('lpa:manage') || hasExplicitCc || (!hasExplicitAssembly && !hasExplicitCc));

  const hasExplicitPdcaTab = userPermissions.includes('lpa:observation_pdca');
  const canAccessPdcaTab = Boolean(isAdmin || hasPermission('lpa:manage') || hasPermission('pdca:read') || hasExplicitPdcaTab || (!hasExplicitPdcaTab && !userPermissions.includes('lpa:lpa_tab_only')));

  const canCreateLpa = Boolean(isAdmin || hasPermission('lpa:manage') || hasPermission('lpa:create'));
  const canCreatePdca = Boolean(isAdmin || hasPermission('lpa:manage') || hasPermission('pdca:create') || hasPermission('pdca:create_sheet') || hasPermission('lpa:create'));

  useEffect(() => {
    if (!canAccessAssembly && canAccessCc && activeSection === 'assembly') {
      setActiveSection('cc');
    } else if (!canAccessCc && canAccessAssembly && activeSection === 'cc') {
      setActiveSection('assembly');
    }
  }, [canAccessAssembly, canAccessCc, activeSection]);

  useEffect(() => {
    if (!canAccessPdcaTab && activeSubTab === 'pdca') {
      setActiveSubTab('lpa');
    }
  }, [canAccessPdcaTab, activeSubTab]);

  const canEditCurrentRecord = useMemo(() => {
    if (isAdmin || hasPermission('lpa:manage') || hasPermission('lpa:update')) return true;
    if (!editor) return true;
    return canEditRecord(editor, effectiveAuthUser);
  }, [editor, effectiveAuthUser]);

  const updateSheetMetadata = useCallback((metadata) => {
    if (!canEditCurrentRecord) return;
    setEditor(previous => {
      if (!previous) return previous;
      const updatedSheets = previous.sheets.map((s, idx) => {
        if (idx !== sheetIndex) return s;
        const nextRows = [...s.rows];
        if (nextRows[0] && Array.isArray(nextRows[0])) {
          const row0 = [...nextRows[0]];
          if (metadata.date || metadata.shift) {
            const d = metadata.date || s.date || previous.auditDate || '';
            const sh = metadata.shift || s.shift || '';
            row0[0] = { ...row0[0], value: `Date: ${d} | Shift: ${sh}`, formatted: `Date: ${d} | Shift: ${sh}`, type: 's' };
          }
          if (metadata.auditors || metadata.department || metadata.sectionName || metadata.line) {
            const aud = (metadata.auditors || s.auditors || []).filter(Boolean).join(', ');
            const dept = metadata.department || s.department || '';
            const sec = metadata.sectionName || s.sectionName || '';
            const ln = metadata.line || s.line || '';
            row0[5] = { ...row0[5], value: `Auditor: ${aud} | Dept: ${dept}${sec ? ' | Sec: ' + sec : ''}${ln ? ' | Line: ' + ln : ''}`, formatted: `Auditor: ${aud} | Dept: ${dept}${sec ? ' | Sec: ' + sec : ''}${ln ? ' | Line: ' + ln : ''}`, type: 's' };
          }
          nextRows[0] = row0;
        }
        return {
          ...s,
          ...metadata,
          rows: nextRows
        };
      });
      return {
        ...previous,
        ...metadata,
        sheets: updatedSheets
      };
    });
    setDirty(true);
  }, [sheetIndex]);

  const saveEditor = async () => {
    if (!editor || requestInFlight.current) return false;

    if (!canEditCurrentRecord) {
      setMessage({ error: true, text: 'You are in view-only mode. Only the record creator or an administrator can edit and save changes.' });
      return false;
    }

    // Mandatory validation for Assembly check sheet: Date, Shift, Department
    if (editor.section === 'assembly' && isAssemblyCheckSheet(sheet)) {
      const formDate = sheet?.date || editor?.date || editor?.auditDate;
      const formShift = sheet?.shift || editor?.shift;
      const formDept = sheet?.department || editor?.department;

      if (!formDate) {
        setMessage({ error: true, text: 'Date is mandatory. Please select an audit date.' });
        return false;
      }
      if (!formShift) {
        setMessage({ error: true, text: 'Shift is mandatory. Please select a shift (A, B, C, or G).' });
        return false;
      }
      if (!formDept) {
        setMessage({ error: true, text: 'Department is mandatory. Please select a department.' });
        return false;
      }
    }

    requestInFlight.current = true;
    setBusy(true);
    try {
      const saved = await saveLPAWorkbook(userId, editor);
      setRecords(previous => previous.map(record => record.id === saved.id ? saved : record));
      setEditor(saved);
      setDirty(false);
      initialSnapshotRef.current = JSON.stringify(saved);
      try { localStorage.removeItem(draftKey(saved.id)); } catch { /* Browser storage save already succeeded. */ }
      setMessage({ text: 'LPA changes saved successfully.' });
      return true;
    } catch (error) { setMessage({ error: true, text: errorText(error) }); return false; }
    finally { requestInFlight.current = false; setBusy(false); }
  };
  const canDeleteWorkbook = (record) => {
    return Boolean(isAdmin || isRecordCreator(record, effectiveAuthUser) || hasPermission('lpa:manage') || hasPermission('lpa:delete'));
  };

  const deleteWorkbook = async record => {
    if (!record.id || requestInFlight.current) return;
    if (!canDeleteWorkbook(record)) {
      setMessage({ error: true, text: 'Only administrators and the sheet creator have permission to delete LPA records.' });
      return;
    }
    if (!confirmFormDeletion(`${record.name} and all its saved worksheets`)) return;
    requestInFlight.current = true;
    setBusy(true);
    try {
      await deleteLPAWorkbook(effectiveAuthUser?.id || effectiveAuthUser?._id || userId, record.id);
      setRecords(previous => previous.filter(item =>
        String(item.id) !== String(record.id) &&
        String(item.recordId || '') !== String(record.id) &&
        String(item._id || '') !== String(record.id)
      ));
      try { localStorage.removeItem(draftKey(record.id)); } catch { /* The saved workbook has already been removed. */ }
      if (editor?.id === record.id) { setEditor(null); setDirty(false); }
      setMessage({ text: `${record.name} was deleted.` });
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
    finally { requestInFlight.current = false; setBusy(false); }
  };
  const discardAndExit = useCallback(() => {
    setShowUnsavedAlert(false);
    if (editor?.id) {
      try { localStorage.removeItem(draftKey(editor.id)); } catch { /* Cleaned up local draft */ }
    }
    setEditor(null);
    setDirty(false);
    initialSnapshotRef.current = null;
  }, [editor?.id, draftKey]);

  const handleStayOnPage = useCallback(() => {
    setShowUnsavedAlert(false);
  }, []);

  const handleBack = useCallback(() => {
    if (busy) return;
    if (hasUnsavedChanges()) {
      setShowUnsavedAlert(true);
      return;
    }
    discardAndExit();
  }, [busy, hasUnsavedChanges, discardAndExit]);

  // Handle browser Back button popstate
  useEffect(() => {
    if (!editor) return;
    window.history.pushState({ lpaEditor: true }, '');
    const handlePopState = () => {
      if (hasUnsavedChanges()) {
        window.history.pushState({ lpaEditor: true }, '');
        if (!showUnsavedAlertRef.current) {
          setShowUnsavedAlert(true);
        }
      } else {
        discardAndExit();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [Boolean(editor), hasUnsavedChanges, discardAndExit]);
  const upload = async workbook => {
    if (!selectedUnit) { setMessage({ error: true, text: 'Please select Unit before uploading a workbook.' }); return; }
    if (workbook.unit && workbook.unit !== selectedUnit) { setMessage({ error: true, text: `Select ${workbook.unit} to retry this workbook upload.` }); return; }
    workbook = { ...workbook, unit: workbook.unit || selectedUnit, level: workbook.level || 'L1' };
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setBusy(true);
    setPendingUpload(workbook);
    try { localStorage.setItem(uploadDraftKey, JSON.stringify(workbook)); } catch { /* Retain the original file and in-memory retry data. */ }
    try {
      const saved = await createLPAWorkbook(userId, workbook);
      setRecords(previous => [saved, ...previous]);
      setPendingUpload(null);
      try { localStorage.removeItem(uploadDraftKey); } catch { /* Browser storage save already succeeded. */ }
      setDirty(false);
      setEditor(saved);
      setSheetIndex(0);
      setZoom(150);
      setMessage({ text: 'Excel uploaded and saved. Existing workbooks were preserved.' });
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
    finally { requestInFlight.current = false; setBusy(false); }
  };
  const selectFile = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (!isAdmin && !hasPermission('lpa:manage') && !hasPermission('lpa:upload_excel')) throw new Error('You do not have permission to upload Excel workbooks.');
      if (!selectedUnit) throw new Error('Please select Unit before uploading a workbook.');
      if (!/\.xlsx?$/i.test(file.name)) throw new Error('Please upload an .xlsx or .xls Excel file.');
      if (file.size > 15 * 1024 * 1024) throw new Error('The Excel file must be smaller than 15 MB.');
      let imported = { ...importLPAWorkbook(await file.arrayBuffer(), file.name, uploadSection.current), unit: selectedUnit, level: 'L1', auditDate: pdcaDate };
      if (uploadSection.current === 'assembly') {
        imported = upgradeAssemblyRecord(imported);
      }
      imported = extractWorkbookMetadata(imported, pdcaDate);
      await upload(imported);
    } catch (error) { setMessage({ error: true, text: errorText(error) }); }
  };

  const handleOpenCreateModal = () => {
    if (!canCreateLpa) {
      setMessage({ error: true, text: 'You do not have permission to create LPA check sheets.' });
      return;
    }
    if (!selectedUnit) {
      setMessage({ error: true, text: 'Please select Unit before creating an LPA check sheet.' });
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreateLPA = async (formData) => {
    setIsCreateModalOpen(false);
    const targetUnit = selectedUnit || formData.unit || 'Bawal';
    const isAssembly = formData.section === 'assembly';
    setActiveSection(formData.section);
    if (formData.date) {
      setPdcaDate(formData.date);
    }

    const targetLevel = formData.targetLevel || formData.level || 'L3';

    // 1. Fetch existing same-day data when creating Level 1 or Level 2:
    let sameDaySources = null;
    if (targetLevel === 'L1' || targetLevel === 'L2') {
      try {
        sameDaySources = await lpaApi.getSameDaySourceData({
          section: formData.section,
          unit: targetUnit,
          auditDate: formData.date,
          department: formData.department,
          line: formData.line
        });
      } catch (err) {
        console.warn('Backend same-day query fallback to memory records:', err);
      }

      if (!sameDaySources || (!sameDaySources.sourceSheets && !sameDaySources.records)) {
        const sameDayRecords = records.filter(rec =>
          rec.section === formData.section &&
          (rec.unit === targetUnit || (!rec.unit && targetUnit === 'Bawal')) &&
          (rec.auditDate === formData.date || rec.date === formData.date) &&
          (!formData.department || !rec.department || rec.department.toLowerCase() === formData.department.toLowerCase()) &&
          (!formData.line || !rec.line || rec.line === formData.line)
        );
        sameDaySources = sameDayRecords;
      }
    }

    // Inspect same-day sources: ONLY shifts with actual same-day data will be included!
    const normSources = normalizeSourceSheets(sameDaySources);
    const availableL3Shifts = ['A', 'B', 'C'].filter(sh => {
      const s = normSources[`L3_${sh}`];
      return Boolean(s && sheetHasData(s, sh));
    });
    const hasL2Data = Boolean(normSources.L2 && sheetHasData(normSources.L2));

    let targetLevels = [];
    let effectiveShifts = [];

    if (targetLevel === 'L2') {
      targetLevels = ['L3', 'L2'];
      effectiveShifts = availableL3Shifts.length > 0 ? availableL3Shifts : [formData.shift || 'G'];
    } else if (targetLevel === 'L1') {
      targetLevels = ['L3', 'L2', 'L1'];
      effectiveShifts = availableL3Shifts.length > 0 ? availableL3Shifts : [formData.shift || 'G'];
    } else {
      targetLevels = ['L3'];
      effectiveShifts = [formData.shift || 'A'];
    }

    // 2. Base Template & Clean New Sheet Creation
    const baseTpl = isAssembly ? assemblyTemplate : ccTemplate;
    const newSheets = baseTpl.sheets.map((baseSheet) => {
      const createdSheet = isAssembly
        ? createBlankAssemblySheet(baseSheet, formData.date, targetLevels, effectiveShifts, sameDaySources, targetLevel)
        : createBlankCcSheet(baseSheet, formData.date, targetLevels, effectiveShifts, sameDaySources, targetLevel);

      return {
        ...createdSheet,
        targetLevel,
        level: targetLevel,
        date: formData.date,
        shift: formData.shift,
        department: formData.department,
        sectionName: formData.sectionName || '',
        line: formData.line || '',
        auditors: [],
        auditor: ''
      };
    });

    const createdLevelName = targetLevel === 'L3'
      ? `Level 3 (Shift ${formData.shift || 'A'})`
      : targetLevel === 'L2'
        ? 'Level 2'
        : 'Level 1';

    const newRecord = {
      section: formData.section,
      name: `${isAssembly ? 'Assembly LPA Check Sheet' : 'C&C LPA Check Sheet'} · ${formData.date} (${createdLevelName}) · Shift ${formData.shift || (targetLevel === 'L3' ? 'A' : 'G')}`,
      unit: targetUnit,
      targetLevel,
      level: targetLevel,
      levels: [targetLevel],
      shifts: [formData.shift || (targetLevel === 'L3' ? 'A' : 'G')],
      auditDate: formData.date,
      date: formData.date,
      shift: formData.shift,
      department: formData.department,
      sectionName: formData.sectionName || '',
      line: formData.line || '',
      auditors: [],
      auditor: '',
      createdBy: effectiveAuthUser?.fullName || effectiveAuthUser?.name || effectiveAuthUser?.userName || 'User',
      createdById: effectiveAuthUser?.id || effectiveAuthUser?._id || userId,
      ownerId: effectiveAuthUser?.id || effectiveAuthUser?._id || userId,
      sheets: newSheets
    };

    let savedRecord = null;
    try {
      savedRecord = await createLPAWorkbook(userId, newRecord);
      setRecords(prev => [savedRecord, ...prev]);
      setMessage({ text: 'New LPA Check Sheet created successfully.' });
    } catch (err) {
      console.warn('Immediate creation of new LPA record failed:', err);
    }

    await openSheet(savedRecord || newRecord, 0);
  };
  const sheet = editor?.sheets?.[sheetIndex];
  const scopedRecords = records.filter(record => record.unit === selectedUnit);
  const sectionRecords = scopedRecords.filter(record => record.section === activeSection);
  const displayRecords = !selectedUnit ? [] : activeSection === 'assembly'
    ? sectionRecords.map(upgradeAssemblyRecord)
    : sectionRecords.map(record => (record.name === ccTemplate.name ? upgradeCcTemplateRecord(record) : record));
  const visibleRecords = displayRecords.filter(record =>
    record.unit === selectedUnit &&
    record.section === activeSection &&
    matchesLpaDateRange(record.auditDate || record.date, fromDate, toDate) &&
    `${record.name} ${record.sheets?.map(item => item.name).join(' ') || ''}`.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const exportAllRecords = () => {
    const rows = records.flatMap(record => record.sheets.map(current => ({
      Unit: record.unit || 'Bawal', Level: record.level || 'L1', Section: record.section === 'assembly' ? 'Assembly' : 'C&C',
      Form: record.name, Worksheet: current.name, Rows: current.rows.length,
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), 'LPA Records');
    XLSX.writeFile(book, 'LPA_All_Records.xlsx');
  };
  const mergeMap = useMemo(() => {
    const anchors = new Map();
    const hidden = new Set();
    for (const merge of sheet?.merges || []) {
      anchors.set(`${merge.s.r}:${merge.s.c}`, merge);
      for (let r = merge.s.r; r <= merge.e.r; r++) for (let c = merge.s.c; c <= merge.e.c; c++) {
        if (r !== merge.s.r || c !== merge.s.c) hidden.add(`${r}:${c}`);
      }
    }
    return { anchors, hidden };
  }, [sheet?.merges]);
  const changeCell = (rowIndex, columnIndex, value, extraUpdates = []) => {
    if (!canEditCurrentRecord) return;
    setEditor(previous => ({
      ...previous, sheets: previous.sheets.map((current, index) => index !== sheetIndex ? current : {
        ...current, rows: (() => {
          let newRows = [...current.rows];
          const allUpdates = [{ rowIndex, columnIndex, value }, ...(extraUpdates || [])];
          for (const upd of allUpdates) {
            const r = upd.rowIndex ?? upd.r;
            const c = upd.columnIndex ?? upd.c;
            const v = upd.value ?? upd.val;
            if (newRows[r]) {
              newRows[r] = Array.from({ length: current.columnCount }, (_, ci) => ci === c ? editLPACell(newRows[r][ci], v) : newRows[r][ci] || null);
            }
          }
          return newRows;
        })()
      })
    }));
    setDirty(true);
  };
  const status = message && <p role={message.error ? 'alert' : 'status'} className={`text-xs ${message.error ? 'text-red-600' : 'text-emerald-700'}`}>{message.text}</p>;
  const dateRangeControls = (
    <div className="flex flex-wrap items-end gap-2" aria-label="Filter by date range">
      <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-600">From Date<input type="date" value={fromDate} max={toDate || undefined} onChange={event => setFromDate(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" /></label>
      <label className="flex flex-col gap-1 text-[10px] font-semibold text-slate-600">To Date<input type="date" value={toDate} min={fromDate || undefined} onChange={event => setToDate(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs" /></label>
      {(fromDate || toDate) && <button type="button" onClick={() => { setFromDate(''); setToDate(''); }} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Clear dates</button>}
      {fromDate && toDate && fromDate > toDate && <span role="alert" className="pb-1 text-xs text-red-600">From Date must not be later than To Date.</span>}
    </div>
  );

  const pdcaTopic = useMemo(() => {
    if (customPdcaTopic) return customPdcaTopic;
    if (!selectedUnit) return null;
    return getLpaPdcaTopic({
      section: activeSection,
      unit: selectedUnit,
      level: 'L1',
      date: pdcaDate,
      records,
      templates: { assemblyTemplate, ccTemplate }
    });
  }, [customPdcaTopic, activeSection, selectedUnit, pdcaDate, records, pdcaSaveVersion]);

  // Custom PDCA Sheets created by Admin (isolated per section & plant)
  const [customPdcaSheets, setCustomPdcaSheets] = useState(() => {
    try {
      const saved = localStorage.getItem(`lpa_custom_pdca_sheets_${activeSection}_${selectedUnit || 'Bawal'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pdcaDeleteRevision, setPdcaDeleteRevision] = useState(0);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`lpa_custom_pdca_sheets_${activeSection}_${selectedUnit || 'Bawal'}`);
      setCustomPdcaSheets(saved ? JSON.parse(saved) : []);
    } catch {
      setCustomPdcaSheets([]);
    }
  }, [activeSection, selectedUnit]);

  const [isCreatePdcaModalOpen, setIsCreatePdcaModalOpen] = useState(false);
  const [newPdcaForm, setNewPdcaForm] = useState({
    title: '',
    date: todayIso,
    unit: 'Bawal',
    department: 'Assembly'
  });

  const allPdcaSheets = useMemo(() => {
    const isCc = activeSection === 'cc';
    const baseSheetId = `PDCA-LPA-${activeSection.toUpperCase()}-${selectedUnit || 'Bawal'}`;
    const baseSheet = {
      id: baseSheetId,
      title: `${activeSection === 'assembly' ? 'Assembly' : 'C&C'} - LPA Observation (PDCA)`,
      date: pdcaDate || todayIso,
      unit: selectedUnit || 'Bawal',
      department: activeSection === 'assembly' ? 'Assembly' : 'C&C',
      isDefault: true
    };
    let deletedDefaultIds = [];
    try {
      deletedDefaultIds = JSON.parse(localStorage.getItem(`lpa_deleted_default_pdca_sheets_${activeSection}_${selectedUnit || 'Bawal'}`) || '[]');
    } catch { /* An invalid removal cache never changes saved LPA records. */ }

    const matchingBackend = (backendPdcaSheets || [])
      .filter(rec => isLpaRecordForSection(rec, activeSection, selectedUnit))
      .map(rec => ({
        id: rec.id || rec.recordId,
        title: rec.topic || `${activeSection === 'assembly' ? 'Assembly' : 'C&C'} - LPA Observation (PDCA)`,
        date: normalizeLpaDate(rec.date) || rec.date || todayIso,
        unit: rec.plant || selectedUnit || 'Bawal',
        department: rec.department || (activeSection === 'assembly' ? 'Assembly' : 'C&C'),
        createdBy: rec.createdBy,
        createdById: rec.createdById,
        createdAt: rec.createdAt,
        isDefault: (rec.id || rec.recordId) === baseSheetId,
        sheet: rec.sheet
      }));

    const map = new Map();
    for (const b of matchingBackend) {
      if (!deletedDefaultIds.includes(b.id)) {
        map.set(b.id, b);
      }
    }

    if (!map.has(baseSheetId) && !deletedDefaultIds.includes(baseSheetId)) {
      map.set(baseSheetId, baseSheet);
    }

    for (const c of (customPdcaSheets || [])) {
      if (!map.has(c.id) && !deletedDefaultIds.includes(c.id)) {
        map.set(c.id, c);
      }
    }

    const result = Array.from(map.values());
    return result.sort((a, b) => {
      if (a.id === baseSheetId) return -1;
      if (b.id === baseSheetId) return 1;
      const dateA = a.createdAt || a.date || '';
      const dateB = b.createdAt || b.date || '';
      return String(dateB).localeCompare(String(dateA));
    });
  }, [activeSection, selectedUnit, pdcaDate, backendPdcaSheets, customPdcaSheets, pdcaDeleteRevision]);
  const visiblePdcaSheets = allPdcaSheets.filter(item => matchesLpaDateRange(item.date, fromDate, toDate));

  const emailPdcaSheets = useMemo(() => allPdcaSheets.map(item => {
    let sheetData = null;
    try {
      const saved = localStorage.getItem(`lpa_pdca_saved_${item.id}`);
      if (saved) sheetData = JSON.parse(saved);
    } catch { /* A corrupt saved snapshot is reported by the send flow. */ }
    if (!sheetData && item.sheet) {
      sheetData = item.sheet;
    }
    if (!sheetData) {
      sheetData = getLpaPdcaTopic({
        section: activeSection,
        unit: item.unit || selectedUnit,
        level: 'L1',
        date: item.date || pdcaDate,
        records,
        templates: { assemblyTemplate, ccTemplate }
      }).sheet;
    }
    return { ...item, source: 'lpa', section: activeSection, sheet: sheetData };
  }), [allPdcaSheets, activeSection, selectedUnit, pdcaDate, records, assemblyTemplate, ccTemplate]);

  const handleOpenSpecificPdcaSheet = async (sheetItem) => {
    let sheetData = null;
    const hasMeaningfulRows = (s) => Array.isArray(s?.rows) && s.rows.some(r => Boolean(
      r?.date?.trim() || r?.observation?.trim() || r?.rootCause?.trim() || r?.counterMeasure?.trim() ||
      (r?.status && r?.status !== 'Not-Started') || r?.staffEmployee?.trim() || r?.department?.trim()
    ));

    // 1. Fetch fresh sheet directly from backend API
    try {
      const fetched = await pdcaApi.getSheet(sheetItem.id);
      if (hasMeaningfulRows(fetched)) {
        sheetData = fetched;
        try {
          localStorage.setItem(`lpa_pdca_saved_${sheetItem.id}`, JSON.stringify(fetched));
        } catch {}
      }
    } catch (err) {
      console.warn('Could not fetch sheet from backend API:', err);
    }

    // 2. Check localStorage if backend didn't return meaningful rows
    if (!sheetData) {
      try {
        const saved = localStorage.getItem(`lpa_pdca_saved_${sheetItem.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (hasMeaningfulRows(parsed)) {
            sheetData = parsed;
          }
        }
      } catch (err) {
        console.error(err);
      }
    }

    // 3. Check sheetItem.sheet
    if (!sheetData && sheetItem.sheet && hasMeaningfulRows(sheetItem.sheet)) {
      sheetData = sheetItem.sheet;
    }

    // 4. Fallback to fetched backend or localStorage even if unstarted
    if (!sheetData) {
      try {
        const fetched = await pdcaApi.getSheet(sheetItem.id);
        if (fetched && Array.isArray(fetched.rows) && fetched.rows.length > 0) {
          sheetData = fetched;
        }
      } catch {}
    }

    if (!sheetData) {
      const fallbackTopic = getLpaPdcaTopic({
        section: activeSection,
        unit: sheetItem.unit || selectedUnit,
        level: 'L1',
        date: sheetItem.date || pdcaDate,
        records,
        templates: { assemblyTemplate, ccTemplate }
      });
      sheetData = fallbackTopic.sheet;
      if (sheetData?.headerInfo) {
        sheetData.headerInfo.topicName = sheetItem.title;
      }
    }
    setCustomPdcaTopic({
      id: sheetItem.id,
      topic: sheetItem.title,
      section: activeSection,
      scope: 'Company',
      plant: sheetItem.unit || selectedUnit || 'Bawal',
      createdBy: sheetItem.createdBy || sheetData?.createdBy,
      createdById: sheetItem.createdById || sheetData?.createdById,
      sheet: sheetData
    });
    setIsPdcaSheetOpen(true);
  };

  const handledPdcaViewRef = useRef('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sheetId = params.get('viewPdcaSheetId');
    if (!sheetId) return;
    const section = params.get('section') === 'cc' ? 'cc' : 'assembly';
    const unit = params.get('unit') || 'Bawal';
    const token = `${section}:${unit}:${sheetId}`;
    if (handledPdcaViewRef.current === token) return;
    if (activeSection !== section) {
      setActiveSection(section);
      return;
    }
    if (selectedUnit !== unit) {
      setSelectedUnit(unit);
      return;
    }
    const sheet = allPdcaSheets.find(item => String(item.id || item._id) === String(sheetId));
    if (!sheet) return;
    handledPdcaViewRef.current = token;
    setActiveSubTab('pdca');
    handleOpenSpecificPdcaSheet(sheet);
    navigate('/cms/lpa', { replace: true });
  }, [location.search, activeSection, selectedUnit, allPdcaSheets, navigate]);

  const handleCreateCustomPdcaSheet = async (e) => {
    e.preventDefault();
    const targetUnit = newPdcaForm.unit || selectedUnit || 'Bawal';
    const newId = `PDCA-LPA-${activeSection.toUpperCase()}-${targetUnit}-${Date.now()}`;
    const newSheet = {
      id: newId,
      recordId: newId,
      topic: newPdcaForm.title.trim() || `${activeSection === 'assembly' ? 'Assembly' : 'C&C'} - LPA Observation (PDCA)`,
      title: newPdcaForm.title.trim() || `${activeSection === 'assembly' ? 'Assembly' : 'C&C'} - LPA Observation (PDCA)`,
      date: newPdcaForm.date || pdcaDate || todayIso,
      plant: targetUnit,
      unit: targetUnit,
      department: newPdcaForm.department || (activeSection === 'assembly' ? 'Assembly' : 'C&C'),
      category: activeSection,
      lpaCategory: activeSection,
      scope: 'Company',
      createdAt: new Date().toISOString(),
      createdBy: effectiveAuthUser ? {
        id: effectiveAuthUser.id || effectiveAuthUser._id,
        name: effectiveAuthUser.name || effectiveAuthUser.userName,
        code: effectiveAuthUser.code || effectiveAuthUser.empCode,
        userName: effectiveAuthUser.userName
      } : {
        id: 'user_anonymous',
        name: 'User',
        userName: 'user'
      },
      createdById: effectiveAuthUser?.id || effectiveAuthUser?._id || 'user_anonymous'
    };

    const initialTopic = getLpaPdcaTopic({
      section: activeSection,
      unit: targetUnit,
      level: 'L1',
      date: newSheet.date,
      records,
      templates: { assemblyTemplate, ccTemplate }
    });
    const customSnapshot = {
      ...initialTopic.sheet,
      // A newly created sheet always starts completely blank (no copied dates, status, shifts or observations).
      rows: Array.from({ length: 10 }, () => createEmptyPdcaRow()),
      headerInfo: {
        ...(initialTopic.sheet?.headerInfo || {}),
        topicName: newSheet.title,
        preparedBy: effectiveAuthUser?.name || effectiveAuthUser?.userName || ''
      },
      createdBy: newSheet.createdBy,
      createdById: newSheet.createdById
    };
    saveLpaPdcaSnapshot(newId, customSnapshot);

    const updated = [...customPdcaSheets, newSheet];
    setCustomPdcaSheets(updated);
    try {
      localStorage.setItem(`lpa_custom_pdca_sheets_${activeSection}_${selectedUnit || 'Bawal'}`, JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }

    // Persist to backend database via API
    try {
      await pdcaApi.createRecord({
        ...newSheet,
        sheet: customSnapshot
      });
      await pdcaApi.saveSheet(newId, customSnapshot);
      await loadBackendPdcaSheets();
    } catch (apiErr) {
      console.warn('Backend record creation failed (saved locally):', apiErr);
    }

    setIsCreatePdcaModalOpen(false);
    setMessage({ text: `✓ PDCA Sheet "${newSheet.title}" created successfully.` });
  };

  const canDeletePdcaSheet = (sheet) => {
    return Boolean(isAdmin || isRecordCreator(sheet, effectiveAuthUser) || hasPermission('lpa:manage') || hasPermission('pdca:delete') || hasPermission('lpa:delete'));
  };

  const handleDeletePdcaSheet = async (sheet) => {
    if (!canDeletePdcaSheet(sheet)) {
      alert('Only administrators and the sheet creator have permission to delete this PDCA sheet.');
      return;
    }
    if (!confirm(`Are you sure you want to delete "${sheet.title}"?`)) return;
    try {
      if (sheet.isDefault) {
        const key = `lpa_deleted_default_pdca_sheets_${activeSection}_${selectedUnit || 'Bawal'}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        const deletedIds = Array.isArray(existing) ? existing : [];
        if (!deletedIds.includes(sheet.id)) deletedIds.push(sheet.id);
        localStorage.setItem(key, JSON.stringify(deletedIds));
        setPdcaDeleteRevision(revision => revision + 1);
      } else {
        const updated = customPdcaSheets.filter(item => item.id !== sheet.id);
        setCustomPdcaSheets(updated);
        localStorage.setItem(`lpa_custom_pdca_sheets_${activeSection}_${selectedUnit || 'Bawal'}`, JSON.stringify(updated));
      }
      try {
        await pdcaApi.deleteRecord(sheet.id);
      } catch (apiErr) {
        console.warn('Backend delete error:', apiErr);
      }
      localStorage.removeItem(`lpa_pdca_saved_${sheet.id}`);
      await loadBackendPdcaSheets();
    } catch (err) {
      console.error(err);
      setMessage({ error: true, text: 'The PDCA sheet could not be deleted from this browser.' });
      return;
    }
    setMessage({ text: 'PDCA sheet deleted.' });
  };

  const handleBackFromPDCA = () => {
    setCustomPdcaTopic(null);
    setIsPdcaSheetOpen(false);
    setIsFormView(false);
  };

  const handleOpenPdcaRecord = (row) => {
    setCustomPdcaTopic(row);
  };

  const handleEditPdcaRecord = (row) => {
    setPdcaModalMode(row);
  };

  const handleCreateNewPdca = () => {
    setPdcaModalMode('add');
  };

  const handleSaveNewPdca = (newRecord) => {
    const recordToSave = {
      ...newRecord,
      category: activeSection,
      lpaCategory: activeSection,
      department: newRecord.department || (activeSection === 'assembly' ? 'Assembly' : 'C&C'),
      lpaSource: {
        category: activeSection,
        unit: selectedUnit,
        date: pdcaDate
      }
    };
    handleAddPDCA(recordToSave);
    setPdcaModalMode(null);
    showToast?.('✓ PDCA record created successfully');
    refreshData?.();
  };

  const handleUpdatePdca = (updatedRecord) => {
    handleUpdatePDCA(updatedRecord);
    setPdcaModalMode(null);
    showToast?.('✓ PDCA record updated successfully');
    refreshData?.();
  };

  const handleSavePDCA = async (sheetSnapshot) => {
    if (!pdcaTopic?.id) return;
    saveLpaPdcaSnapshot(pdcaTopic.id, sheetSnapshot);
    try {
      await pdcaApi.saveSheet(pdcaTopic.id, sheetSnapshot);
    } catch (err) {
      console.warn('Backend saveSheet error:', err);
    }
    if (customPdcaTopic) {
      setCustomPdcaTopic(prev => prev ? { ...prev, sheet: sheetSnapshot } : null);
    }
    setPdcaSaveVersion(v => v + 1);
    await loadBackendPdcaSheets();
    setMessage({ text: 'PDCA form saved successfully.' });
  };

  const openRecordPDCA = (record, worksheetIndex) => {
    const baseTopic = getLpaPdcaTopic({
      section: record.section || activeSection,
      unit: record.unit || selectedUnit,
      level: record.level || selectedLevel,
      date: record.auditDate || pdcaDate,
      records: [record],
      templates: { assemblyTemplate, ccTemplate }
    });
    const recordTopicId = `PDCA-LPA-REC-${record.id || 'tpl'}-${worksheetIndex}-${record.auditDate || pdcaDate}`;
    let loadedSheet = baseTopic.sheet;
    try {
      const saved = localStorage.getItem(`lpa_pdca_saved_${recordTopicId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.rows) loadedSheet = parsed;
      }
    } catch { }
    const secName = (record.section || activeSection) === 'cc' ? 'C&C' : 'Assembly';
    setCustomPdcaTopic({
      id: recordTopicId,
      topic: `${secName} - LPA Observation (PDCA)`,
      scope: 'Company',
      plant: record.unit || selectedUnit || 'Bawal',
      createdBy: record.createdBy,
      createdById: record.createdById,
      sheet: loadedSheet
    });
    setActiveSubTab('pdca');
  };

  if (isPdcaFormOpen && pdcaTopic) return (
    <div className="fixed inset-0 z-40 h-dvh w-full bg-white text-slate-800 flex flex-col overflow-hidden p-1.5 sm:p-2 pb-0.5 sm:pb-1">
      <PdcaErrorBoundary onBack={handleBackFromPDCA}>
        <PDCASheet
          key={pdcaTopic.id}
          topic={pdcaTopic}
          onBack={handleBackFromPDCA}
          onSave={handleSavePDCA}
          currentDate={pdcaDate}
          onDateChange={setPdcaDate}
          currentUser={effectiveAuthUser}
          isAdmin={isAdmin}
          isCreator={isAdmin || isRecordCreator(pdcaTopic, effectiveAuthUser)}
          emailPdcaSheets={[{
            id: pdcaTopic.id,
            title: pdcaTopic.topic,
            topic: pdcaTopic.topic,
            section: activeSection,
            unit: pdcaTopic.plant || selectedUnit,
            date: pdcaDate
          }]}
        />
      </PdcaErrorBoundary>
    </div>
  );

  if (editor && sheet) return <div className="fixed inset-0 z-40 h-dvh w-full bg-white text-slate-800 flex flex-col overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2 bg-white shrink-0">
      {canEditCurrentRecord ? (
        <button type="button" disabled={busy} onClick={saveEditor} className={primary}><Save size={16} />{busy ? 'Saving…' : 'Save'}</button>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold" title="Only the creator and admin can edit this form">
          <Eye size={14} className="text-amber-600" />
          View Only
        </span>
      )}
      <button type="button" disabled={busy} onClick={handleBack} className={button}><ArrowLeft size={16} />Back</button>
      <span className="text-xs text-slate-500 truncate max-w-xs">{editor.name} · {sheet.name}{dirty ? ' · Unsaved changes' : ''}</span>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={() => setZoom(value => Math.min(200, value + 10))} disabled={zoom >= 200} className={button} title="Zoom In"><ZoomIn size={16} /><span className="sr-only">Zoom In</span></button>
        <span className="text-xs w-10 text-center">{zoom}%</span>
        <button type="button" onClick={() => setZoom(value => Math.max(50, value - 10))} disabled={zoom <= 50} className={button} title="Zoom Out"><ZoomOut size={16} /><span className="sr-only">Zoom Out</span></button>
      </div>
      {message && <div className="w-full">{status}</div>}
    </div>
    <div className="flex-1 min-h-0 overflow-auto overscroll-contain">
      {editor.section === 'assembly' && isAssemblyCheckSheet(sheet) ? <div style={{ zoom: `${zoom}%` }}>
        <AssemblySheet
          sheet={sheet}
          editor={editor}
          disabled={busy || !canEditCurrentRecord}
          onChange={changeCell}
          onMetadataChange={updateSheetMetadata}
          isAdmin={isAdmin}
        />
      </div> : editor.section === 'cc' && isCcCheckSheet(sheet) ? <div className="cc-form-stage">
        <div style={{ zoom: `${zoom}%` }}>
          <CcSheet
            sheet={sheet}
            editor={editor}
            disabled={busy || !canEditCurrentRecord}
            onChange={changeCell}
            onMetadataChange={updateSheetMetadata}
            isAdmin={isAdmin}
          />
        </div>
      </div> : <div style={{ zoom: `${zoom}%` }} className="min-w-full w-max">
        <LpaTable sheet={sheet} onChange={changeCell} disabled={busy || !canEditCurrentRecord} zoom={zoom} />
      </div>}
    </div>

    {/* Unsaved Changes Confirmation Modal */}
    {showUnsavedAlert && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-alert-title"
      >
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-amber-100 text-amber-600 shrink-0">
              <AlertTriangle size={22} />
            </div>
            <div>
              <h3 id="unsaved-alert-title" className="text-base font-semibold text-slate-900">
                Unsaved Changes
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                You have unsaved changes. Are you sure you want to go back without saving?
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleStayOnPage}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Stay on Page
            </button>
            <button
              type="button"
              onClick={discardAndExit}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )}

  </div>;

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm text-slate-800">
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-2 border-b border-slate-100">
        <div className="flex flex-col gap-3">
          {/* Unit Option */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">Unit</label>
            <div className="relative inline-flex items-center">
              <select
                value={selectedUnit}
                onChange={event => setSelectedUnit(event.target.value)}
                className={`${button} min-w-[200px] appearance-none pr-9 text-left font-medium`}
                aria-label="Select unit"
              >
                <option value="">Select Unit</option>
                {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/cms/lpa/graphs')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 hover:shadow-md transition-all cursor-pointer"
            title="Open LPA Analytics & Graphs (Assembly & C&C Sheets)"
          >
            <BarChart3 size={16} />
            <span>Graph trend</span>
          </button>
        </div>
      </div>
      <input ref={fileInput} type="file" accept=".xlsx,.xls" onChange={selectFile} className="hidden" aria-label="Upload LPA Excel" />
      {loading ? <p role="status" className="text-sm text-slate-500">Loading saved LPA workbooks…</p> : <section className="space-y-5">
        {status}
        {pendingUpload && selectedUnit && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span>{pendingUpload.name} has not been saved.</span><button type="button" disabled={busy || (pendingUpload.unit && pendingUpload.unit !== selectedUnit)} onClick={() => upload(pendingUpload)} className={button}>Retry Upload</button></div>}
        {!selectedUnit ? (
          <p className="rounded-xl border border-blue-100 bg-blue-50 p-8 text-center text-sm font-medium text-blue-800">
            Please select Unit to view data.
          </p>
        ) : <>
          <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full" role="tablist" aria-label="LPA pages">
            {SECTIONS.filter(s => (s.id === 'assembly' ? canAccessAssembly : s.id === 'cc' ? canAccessCc : true)).map(section => {
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => {
                    setActiveSection(section.id);
                    setActiveSubTab('lpa');
                    setCustomPdcaTopic(null);
                    setIsPdcaSheetOpen(false);
                  }}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${isActive
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                    }`}
                >
                  <span>{section.label}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-5">
            {['assembly', 'cc'].includes(activeSection) && (
              <div className="bg-white rounded-2xl p-2 shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-[#ECEFF3] inline-flex flex-wrap items-center gap-1.5 max-w-full" role="tablist" aria-label={`${activeSection === 'assembly' ? 'Assembly' : 'C&C'} form views`}>
                {[
                  { id: 'lpa', label: 'LPA' },
                  { id: 'pdca', label: 'LPA Observation (PDCA)' }
                ].filter(tab => (tab.id === 'pdca' ? canAccessPdcaTab : true)).map(tab => {
                  const isActive = activeSubTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => {
                        setActiveSubTab(tab.id);
                        setCustomPdcaTopic(null);
                        setIsPdcaSheetOpen(false);
                      }}
                      className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-6 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${isActive
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80 ring-1 ring-black/5 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                        }`}
                    >
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {['assembly', 'cc'].includes(activeSection) && activeSubTab === 'pdca' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 bg-white">
                  <div className="flex flex-wrap items-center gap-3 flex-1">
                    {dateRangeControls}
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                      <CalendarDays size={17} />
                      <span>Audit date</span>
                      <input
                        type="date"
                        value={pdcaDate}
                        onChange={event => setPdcaDate(event.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="relative min-w-[240px] flex-1 max-w-md">
                      <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={event => setSearchQuery(event.target.value)}
                        placeholder="Search by worksheet or department…"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2.5">
                    {/* Create PDCA Option - Available to all users */}
                    <button
                      type="button"
                      onClick={() => {
                        setNewPdcaForm({
                          title: '',
                          date: pdcaDate || todayIso,
                          unit: selectedUnit || 'Bawal',
                          department: activeSection === 'assembly' ? 'Assembly' : 'C&C'
                        });
                        setIsCreatePdcaModalOpen(true);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-all cursor-pointer shadow-xs active:scale-98 ${!canCreatePdca ? 'hidden' : ''}`}
                      title="Create new PDCA Sheet"
                    >
                      <Plus size={15} />
                      <span>Create PDCA</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-[#ECEFF3] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">S.NO.</th>
                        <th className="px-4 py-3 text-left">Worksheet</th>
                        <th className="px-4 py-3 text-left">Unit</th>
                        <th className="px-4 py-3 text-left">department</th>
                        <th className="px-4 py-3 text-left">Observations</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const query = searchQuery.trim().toLowerCase();
                        const filteredSheets = visiblePdcaSheets.filter(sh => {
                          if (!query) return true;
                          return (
                            sh.title.toLowerCase().includes(query) ||
                            (sh.unit || '').toLowerCase().includes(query) ||
                            (sh.department || '').toLowerCase().includes(query)
                          );
                        });

                        if (filteredSheets.length === 0) {
                          return (
                            <tr>
                              <td colSpan={7} className="p-8 text-center text-sm text-slate-500">
                                No PDCA sheets matching "{searchQuery}".
                              </td>
                            </tr>
                          );
                        }

                        return filteredSheets.map((sh, idx) => {
                          let rows = [];
                          try {
                            const saved = localStorage.getItem(`lpa_pdca_saved_${sh.id}`);
                            if (saved) {
                              rows = JSON.parse(saved)?.rows || [];
                            } else if (sh.sheet?.rows) {
                              rows = sh.sheet.rows;
                            } else if (sh.isDefault) {
                              rows = pdcaTopic?.sheet?.rows || [];
                            }
                          } catch {}

                          const activeCount = rows.filter(r =>
                            Boolean(
                              r.observation?.trim() ||
                              r.lineArea?.trim() ||
                              (Array.isArray(r.lineAreas) && r.lineAreas.some(l => l?.lineArea?.trim())) ||
                              r.rootCause?.trim() ||
                              r.counterMeasure?.trim()
                            )
                          ).length;

                          return (
                            <tr key={sh.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-4 py-4 text-slate-500 font-medium">{idx + 1}</td>
                              <td className="px-4 py-4 font-semibold">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSpecificPdcaSheet(sh)}
                                  className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                                  title={`Open ${sh.title}`}
                                >
                                  {sh.title}
                                </button>
                              </td>
                              <td className="px-4 py-4 text-slate-700">{sh.unit || selectedUnit || 'Bawal'}</td>
                              <td className="px-4 py-4 text-slate-700">{sh.department || (activeSection === 'assembly' ? 'Assembly' : 'C&C')}</td>
                              <td className="px-4 py-4 text-slate-700">
                                {activeCount > 0 ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                    {activeCount} active observation{activeCount === 1 ? '' : 's'} ({rows.length} total rows)
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                    {rows.length || 10} rows (Click to add observations)
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  Active
                                </span>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSpecificPdcaSheet(sh)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 bg-blue-600 text-white hover:bg-blue-700 text-xs font-semibold cursor-pointer transition-colors shadow-xs"
                                    title="Open PDCA Sheet"
                                  >
                                    <Eye size={14} /> Open
                                  </button>
                                  {canDeletePdcaSheet(sh) && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeletePdcaSheet(sh)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold cursor-pointer transition-colors"
                                      title="Delete PDCA Sheet"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-nowrap items-center gap-2 rounded-xl border border-slate-100 p-3 overflow-x-auto">
                  <div className="shrink-0">{dateRangeControls}</div>
                  <label className="relative min-w-[180px] flex-1">
                    <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchQuery}
                      onChange={event => setSearchQuery(event.target.value)}
                      placeholder="Search by form or worksheet name…"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-400"
                    />
                  </label>
                  <button type="button" onClick={() => setIsSendMailOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Mail size={15} />Send Mail</button>
                  <button
                    type="button"
                    disabled={busy || !selectedUnit}
                    onClick={handleOpenCreateModal}
                    className={`${primary} shrink-0 ${!canCreateLpa ? 'hidden' : ''}`}
                    title="Create a new blank LPA check sheet"
                  >
                    <Plus size={16} />Create LPA
                  </button>
                  <button type="button" onClick={exportAllRecords} className={`${button} shrink-0`}>
                    <Download size={16} />Export Excel
                  </button>
                  {(isAdmin || hasPermission('lpa:manage') || hasPermission('lpa:upload_excel')) && (
                    <button
                      type="button"
                      disabled={busy || !selectedUnit}
                      onClick={() => { uploadSection.current = activeSection; fileInput.current?.click(); }}
                      className={`${button} shrink-0`}
                      title="Upload Excel workbook (Admin only)"
                    >
                      <Upload size={16} />Upload Excel
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">S.NO.</th>
                        <th className="px-4 py-3 text-left">Worksheet</th>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Unit</th>
                        <th className="px-4 py-3 text-left">Auditor Name</th>
                        <th className="px-4 py-3 text-left">Score</th>
                        <th className="px-4 py-3 text-left">Department</th>
                        <th className="px-4 py-3 text-left">Section</th>
                        <th className="px-4 py-3 text-left">Line</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {visibleRecords.flatMap((record) => record.sheets.map((current, index) => ({ record, current, index }))).map(({ record, current, index }, rowIndex) => {
                        const unitVal = record.unit || selectedUnit || 'Bawal';
                        const dateVal = formatLpaDate(record.auditDate || record.date || current.auditDate || current.date);
                        const scoresList = getWorksheetScoresList(current, record);
                        const deptVal = current.department || record.department || '-';
                        const secVal = current.sectionName || current.section || record.sectionName || record.section || '-';
                        const lineVal = current.line || record.line || '-';
                        const auditorVal = (current.auditors && current.auditors.length > 0 && current.auditors.some(Boolean))
                          ? current.auditors.filter(Boolean).join(', ')
                          : (current.auditor || (record.auditors && record.auditors.length > 0 && record.auditors.some(Boolean))
                            ? record.auditors.filter(Boolean).join(', ')
                            : record.auditor || record.createdBy || '-');

                        const levelsList = Array.isArray(record.levels) && record.levels.length > 0
                          ? record.levels
                          : (record.level ? [record.level] : ['L3']);

                        const shiftDisplay = Array.isArray(record.shifts) && record.shifts.length > 0
                          ? record.shifts.join(', ')
                          : (record.shift || current.shift || 'A');

                        return (
                          <tr key={`${record.id || 'template'}-${index}`} className="hover:bg-slate-50">
                            <td className="px-4 py-4 text-slate-500 font-medium">{rowIndex + 1}</td>
                            <td className="px-4 py-4 font-semibold">
                              <button
                                type="button"
                                onClick={() => openSheet(record, index)}
                                className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors block text-sm"
                                title={`Open ${current.name}`}
                              >
                                {current.name}
                              </button>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {levelsList.map(lvl => (
                                  <span key={lvl} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                    {lvl === 'L3' ? 'Level 3' : lvl === 'L2' ? 'Level 2' : lvl === 'L1' ? 'Level 1' : lvl}
                                  </span>
                                ))}
                                {shiftDisplay && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    Shift {shiftDisplay}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-slate-700 whitespace-nowrap">{dateVal}</td>
                            <td className="px-4 py-4 text-slate-700">{unitVal}</td>
                            <td className="px-4 py-4 text-slate-700">
                              <div className="flex items-center gap-1.5 font-medium text-xs text-slate-800">
                                <User size={13} className="text-slate-400 shrink-0" />
                                <span className="truncate max-w-[170px]" title={auditorVal}>{auditorVal}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-col gap-0.5 text-xs">
                                {scoresList.map(s => (
                                  <div key={s.label} className="whitespace-nowrap leading-tight">
                                    <span className="text-slate-500 font-semibold">{s.label} - </span>
                                    <span className="font-bold text-slate-900">{s.percentage}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-slate-700">{deptVal}</td>
                            <td className="px-4 py-4 text-slate-700">{secVal}</td>
                            <td className="px-4 py-4 text-slate-700">{lineVal}</td>
                            <td className="px-4 py-4 text-right">
                              {record.id && canDeleteWorkbook(record) ? (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => deleteWorkbook(record)}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 cursor-pointer transition-colors"
                                  title="Delete form"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visibleRecords.length === 0 && (
                    <p className="p-8 text-center text-sm text-slate-500">
                      No {activeSection === 'assembly' ? 'Assembly' : 'C&C'} forms for {selectedUnit}. Click "+ Create LPA" to create a check sheet.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </>}
        <p className="text-xs text-slate-500">Supports .xlsx and .xls. Uploaded forms are saved separately.</p>
      </section>}
      {!loading && message?.error && <button type="button" onClick={load} className={button}>Reload Saved Workbooks</button>}

      {/* Add / Edit PDCA Modal */}
      <AddPDCAModal
        isOpen={pdcaModalMode !== null}
        onClose={() => setPdcaModalMode(null)}
        defaultPlant={selectedUnit}
        defaultScope="Company"
        onAdd={handleSaveNewPdca}
        editData={pdcaModalMode !== 'add' ? pdcaModalMode : null}
        onUpdate={handleUpdatePdca}
      />

      {/* Create LPA Modal */}
      <CreateLpaModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleConfirmCreateLPA}
        initialSection={activeSection}
        initialUnit={selectedUnit}
        initialDate={pdcaDate}
      />

      {/* Create New PDCA Sheet Modal - Available to all users */}
      {isCreatePdcaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <ClipboardList className="text-blue-600" size={18} />
                <span>Create New PDCA Sheet</span>
              </h3>
            </div>
            <form onSubmit={handleCreateCustomPdcaSheet} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sheet / Topic Title</label>
                <input
                  type="text"
                  required
                  value={newPdcaForm.title}
                  onChange={e => setNewPdcaForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder={`e.g. ${activeSection === 'assembly' ? 'Assembly' : 'C&C'} - LPA Observation (PDCA) #2`}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Date</label>
                  <input
                    type="date"
                    required
                    value={newPdcaForm.date}
                    onChange={e => setNewPdcaForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={newPdcaForm.unit}
                    onChange={e => setNewPdcaForm(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none cursor-pointer"
                  >
                    {UNITS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={newPdcaForm.department}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed select-none focus:outline-none"
                  title="Department is locked based on the active section"
                />
              </div>
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatePdcaModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  Create Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <SendMailModal
        isOpen={isSendMailOpen}
        onClose={() => setIsSendMailOpen(false)}
        formType={activeSubTab === 'pdca' ? 'pdca' : (activeSection === 'cc' ? 'cc' : 'assembly')}
        pdcaOnly={activeSubTab === 'pdca'}
        title={`${activeSection === 'cc' ? 'C&C' : 'Assembly'} ${activeSubTab === 'pdca' ? 'PDCA' : 'LPA'} Sheet`}
        metadata={{ auditDate: pdcaDate, unit: selectedUnit, section: activeSection, sectionName: activeSection === 'cc' ? 'C&C' : 'Assembly' }}
        pdcaLabel="LPA Observation PDCA"
        assemblySheets={visibleRecords}
        pdcaSheets={emailPdcaSheets}
        onViewAssemblySheet={({ record, sheetIndex: selectedSheetIndex }) => {
          setIsSendMailOpen(false);
          openSheet(record, selectedSheetIndex);
        }}
        onViewPDCASheet={sheet => {
          setIsSendMailOpen(false);
          if (sheet.source === 'lpa') {
            handleOpenSpecificPdcaSheet(sheet);
          } else {
            navigate(`/cms/pdca?sheet=${encodeURIComponent(sheet.id || sheet._id)}`);
          }
        }}
      />
    </div>
  </div>;
}

export default function LpaPage({ viewContext }) {
  return (
    <PDCAProvider>
      <LpaPageContent viewContext={viewContext} />
    </PDCAProvider>
  );
}
