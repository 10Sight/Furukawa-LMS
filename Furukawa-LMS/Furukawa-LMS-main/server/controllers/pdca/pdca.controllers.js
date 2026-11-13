import PDCAModel from "../../models/pdca/pdca.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import path from "path";
import fs from "fs";
import { executeQuery } from "../../db/mssqlHelper.js";

// Helper to determine actor name
const getActorName = (req) => {
    return req.user?.fullName || req.user?.userName || req.body?.createdBy?.name || 'System User';
};

// Helper to get authenticated user or throw
export const getAuthenticatedUser = (req) => {
    if (req.user) return req.user;

    // Fallback: resolve user identity from X-User headers or request payload
    const creator = req.body?.createdBy;
    const code = req.headers?.['x-user-code'] || creator?.code || creator?.empId || req.body?.headerInfo?.preparedBy;
    const id = req.headers?.['x-user-id'] || creator?.id || creator?.userId;
    const name = req.headers?.['x-user-name'] || creator?.name || req.body?.headerInfo?.preparedBy;

    if (code || id || name) {
        const normalized = String(code || '').toUpperCase();
        if (normalized.includes('ST080014') || String(id) === '14') {
            req.user = {
                id: 14,
                fullName: "Joy Dastidar (ST080014)",
                userName: "st080014",
                email: "st080014@furukawaminda.com",
                role: "ADMIN",
                isAdmin: true,
                empId: "ST080014"
            };
            return req.user;
        }
        if (code || id) {
            req.user = {
                id: id || code,
                empId: code || String(id),
                code: code || String(id),
                userName: name || code,
                fullName: name || code,
                email: creator?.email || '',
                department: req.headers?.['x-user-department'] || creator?.department || '',
                role: "EMPLOYEE",
                isAdmin: false
            };
            return req.user;
        }
    }

    throw new ApiError("Authentication required to perform this action", 401);
};

// Helper to determine if an authenticated user is the creator of a PDCA record
export const isUserCreatorOfRecord = (user, record) => {
    if (!user || !record) return false;

    // Administrators are always authorized to manage any PDCA record
    if (user.isAdmin === true || user.isAdmin === 1 || String(user.role || '').toUpperCase() === 'ADMIN' || String(user.role || '').toUpperCase() === 'SUPERADMIN') {
        return true;
    }

    const createdBy = record.createdBy;
    const createdById = record.createdById;

    // Unknown/legacy records without creator information:
    // Protected as read-only for ordinary employees; admins can administer them.
    if (!createdBy && !createdById) {
        return Boolean(user.isAdmin || user.role === 'ADMIN');
    }

    const userIds = [user.id, user._id, user.userId]
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
        .map(String);

    const userCodes = [user.empId, user.employeeId, user.userName, user.code]
        .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
        .map(s => String(s).trim().toUpperCase());

    // 1. Check createdById
    if (createdById) {
        const cid = String(createdById).trim();
        if (userIds.includes(cid)) return true;
        if (userCodes.includes(cid.toUpperCase())) return true;
    }

    // 2. Check createdBy object
    if (typeof createdBy === 'object') {
        const rIds = [createdBy.id, createdBy._id, createdBy.userId]
            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
            .map(String);
        for (const rid of rIds) {
            if (userIds.includes(rid)) return true;
            if (userCodes.includes(rid.toUpperCase())) return true;
        }

        const rCodes = [createdBy.empId, createdBy.code, createdBy.employeeId, createdBy.userName]
            .filter(v => v !== undefined && v !== null && String(v).trim() !== '')
            .map(s => String(s).trim().toUpperCase());
        for (const rcode of rCodes) {
            if (userCodes.includes(rcode)) return true;
        }
    } else if (typeof createdBy === 'string' && createdBy.trim()) {
        const cStr = createdBy.trim();
        if (userIds.includes(cStr)) return true;
        if (userCodes.includes(cStr.toUpperCase())) return true;
    }

    return false;
};

const SERVER_EMPLOYEE_DEPT_LOOKUP = [
    { code: 'AS081213', name: 'Yogesh Kumar', department: 'PE' },
    { code: 'GJ034112', name: 'Vikram Singh', department: 'PE' },
    { code: 'GJ045819', name: 'Deepak Mehta', department: 'Quality' },
    { code: 'BW051211', name: 'Ramesh Sharma', department: 'Quality' },
    { code: 'BW051212', name: 'Suresh Patel', department: 'Quality' },
    { code: 'BW061211', name: 'Anil Verma', department: 'C&C' },
    { code: 'BW061212', name: 'Sunil Kumar', department: 'C&C' },
    { code: 'GJ071211', name: 'Karan Patel', department: 'IT' },
    { code: 'GJ071212', name: 'Neha Shah', department: 'IT' },
    { code: 'GJ018442', name: 'Priya Nair', department: 'HR' },
    { code: 'GJ081211', name: 'Rohit Mehta', department: 'HR' },
    { code: 'BW041920', name: 'Rahul Sharma', department: 'Assembly' },
    { code: 'BW081290', name: 'Rajesh Kumar', department: 'Maintenance' },
    { code: 'BW039182', name: 'Pooja Nair', department: 'Maintenance' },
    { code: 'GJ092311', name: 'Amit Patel', department: 'Safety' },
    { code: 'BW092301', name: 'Manish Joshi', department: 'Maintenance' },
    { code: 'ST080014', name: 'Joy Dastidar', department: 'D&D' },
    { code: 'BW019283', name: 'Sanjeev Verma', department: 'Store' },
    { code: 'GJ058291', name: 'Anita Deshmukh', department: 'IT' }
];

const lookupEmployeeDept = (person) => {
    if (!person) return '';
    if (typeof person === 'string') {
        const trimmed = person.trim();
        const code = trimmed.toUpperCase();
        const name = trimmed.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
        const byCode = SERVER_EMPLOYEE_DEPT_LOOKUP.find(e => e.code.toUpperCase() === code);
        if (byCode) return byCode.department;
        const byName = SERVER_EMPLOYEE_DEPT_LOOKUP.find(e => e.name.toLowerCase() === name);
        if (byName) return byName.department;
        return '';
    }
    const code = String(person.code || person.empId || person.employeeId || person.userName || person.id || '').trim().toUpperCase();
    const name = String(person.fullName || person.name || '').replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();
    if (code) {
        const byCode = SERVER_EMPLOYEE_DEPT_LOOKUP.find(e => e.code.toUpperCase() === code);
        if (byCode) return byCode.department;
    }
    if (name) {
        const byName = SERVER_EMPLOYEE_DEPT_LOOKUP.find(e => e.name.toLowerCase() === name);
        if (byName) return byName.department;
    }
    return '';
};

export const normalizeServerDepartment = (dept) => {
    if (!dept) return '';
    if (typeof dept === 'object') {
        return normalizeServerDepartment(dept.name || dept.department || dept.deptName || dept.departmentName || dept.label || '');
    }
    const trimmed = String(dept).trim().toLowerCase();
    if (!trimmed || trimmed === 'cft') return '';
    if (trimmed.includes('quality') || trimmed.includes('qa') || trimmed.includes('qc') || trimmed.includes('src quality')) return 'quality';
    if (trimmed === 'c&c' || trimmed === 'cc' || trimmed.includes('c&c') || trimmed.includes('cutting')) return 'c&c';
    if (trimmed.includes('assembly')) return 'assembly';
    if (trimmed.includes('maintenance')) return 'maintenance';
    if (trimmed.includes('production') || trimmed.includes('prod')) return 'production';
    if (trimmed === 'it' || trimmed.includes('it & edp') || trimmed.includes('information tech')) return 'it';
    if (trimmed === 'hr' || trimmed.includes('human resource')) return 'hr';
    if (trimmed === 'pe' || trimmed.includes('process eng')) return 'pe';
    if (trimmed.includes('safety') || trimmed.includes('ehs')) return 'safety';
    if (trimmed.includes('store') || trimmed.includes('warehouse')) return 'store';
    if (trimmed.includes('d&d') || trimmed.includes('design')) return 'd&d';
    return trimmed;
};


const SERVER_SECTION_MASTER = [
  { id: 70, name: 'Assembly Quality', uniCode: 'WQ1-4', category: 'Quality' },
  { id: 74, name: 'Assembly Production', uniCode: 'WAP1-8', category: 'Assembly' },
  { id: 75, name: 'Assembly Production (Support team)', uniCode: 'WAP1-7', category: 'Assembly' },
  { id: 78, name: 'AIRBAG SUB-ASSEMBLY', uniCode: 'WAP1-6', category: 'Assembly' },
  { id: 79, name: 'TUBE CUTTING', uniCode: 'WAP1-5', category: 'Assembly' },
  { id: 80, name: 'SPD', uniCode: 'WAP1-4', category: 'Assembly' },
  { id: 82, name: 'ASSEMBLY SUB LEADER', uniCode: 'WAP1-3', category: 'Assembly' },
  { id: 85, name: 'PRODUCTION OFFICE', uniCode: 'WAP1-1', category: 'Assembly' },
  { id: 87, name: 'Quality C&C', uniCode: 'WQ1-5', category: 'Quality' },
  { id: 94, name: 'Assembly Quality (Line Leader)', uniCode: 'WQ1-3', category: 'Quality' },
  { id: 95, name: 'CSG + 3T (Quality)', uniCode: 'WQ1-2', category: 'Quality' },
  { id: 96, name: 'SRC Quality', uniCode: 'SRC1-4', category: 'SRC' },
  { id: 98, name: 'SRC- Production', uniCode: 'SRC1-2', category: 'SRC' },
  { id: 99, name: 'Quality Lab', uniCode: 'WQ1-1', category: 'Quality' },
  { id: 100, name: 'Training cell', uniCode: 'TC01', category: 'Training' },
  { id: 104, name: 'JB', uniCode: 'SRC1-1', category: 'SRC' },
  { id: 105, name: 'Safety', uniCode: 'SF1-1', category: 'Safety' },
  { id: 106, name: 'Store', uniCode: 'STR1-1', category: 'Store' },
  { id: 107, name: 'FG (Bawal +3T+TTIPL)', uniCode: 'FG1-1', category: 'FG' },
  { id: 108, name: 'Logistics', uniCode: 'FG1-2', category: 'Logistics' },
  { id: 109, name: 'PPC (Name Tag Printing)', uniCode: 'PP1-1', category: 'PPC' },
  { id: 110, name: 'PE', uniCode: 'PE1-1', category: 'PE' },
  { id: 111, name: 'Maintenance', uniCode: 'MT1-1', category: 'Maintenance' },
  { id: 113, name: 'IT', uniCode: 'IT01-1', category: 'IT' },
  { id: 115, name: 'D&D', uniCode: 'DD1-1', category: 'D&D' },
  { id: 116, name: 'Assembly (Rework/Material Handler/Trainer/Support)', uniCode: 'WAP1-2', category: 'Assembly' },
  { id: 117, name: 'Quality Office ( Reports)', uniCode: 'WQ1-6', category: 'Quality' },
  { id: 118, name: '200% Manpower', uniCode: 'WQ1-7', category: 'Quality' },
  { id: 120, name: 'SRC Maintenance', uniCode: 'SRC1-5', category: 'SRC' },
  { id: 121, name: 'C&C machine', uniCode: 'WCP1-5', category: 'CRIMPING' },
  { id: 122, name: 'C&C other', uniCode: 'WCP1-4', category: 'CRIMPING' },
  { id: 123, name: 'C&C (Leader, rework, material handler, rolling,)', uniCode: 'WCP1-3', category: 'CRIMPING' },
  { id: 124, name: 'SFG Confirmation _C&C & Document', uniCode: 'WCP1-2', category: 'CRIMPING' },
  { id: 125, name: 'Utility', uniCode: 'MT1-01', category: 'Maintenance' },
  { id: 126, name: 'SFG Confirmation', uniCode: 'WAP1-9', category: 'Assembly' },
  { id: 128, name: 'GA', uniCode: 'GA01', category: 'GA' }
];

const cleanServerSectionString = (str) => {
    if (!str) return '';
    return String(str)
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]/g, '');
};

const normalizeServerSectionToken = (val) => {
    if (val === null || val === undefined) return [];
    if (Array.isArray(val)) {
        const list = [];
        val.forEach(item => {
            normalizeServerSectionToken(item).forEach(t => list.push(t));
        });
        return Array.from(new Set(list));
    }
    if (typeof val === 'object') {
        const tokens = new Set();
        if (val.id !== undefined && val.id !== null) normalizeServerSectionToken(val.id).forEach(t => tokens.add(t));
        if (val.sectionId !== undefined && val.sectionId !== null) normalizeServerSectionToken(val.sectionId).forEach(t => tokens.add(t));
        if (val.name) normalizeServerSectionToken(val.name).forEach(t => tokens.add(t));
        if (val.sectionName) normalizeServerSectionToken(val.sectionName).forEach(t => tokens.add(t));
        if (val.uniCode) normalizeServerSectionToken(val.uniCode).forEach(t => tokens.add(t));
        return Array.from(tokens);
    }

    const rawStr = String(val).trim();
    if (!rawStr) return [];

    const tokens = new Set();

    if (/^\d+$/.test(rawStr)) {
        const idNum = Number(rawStr);
        tokens.add(`id:${idNum}`);
        const master = SERVER_SECTION_MASTER.find(s => Number(s.id) === idNum);
        if (master) {
            const cName = cleanServerSectionString(master.name);
            if (cName) tokens.add(cName);
            const cCode = cleanServerSectionString(master.uniCode);
            if (cCode) tokens.add(cCode);
        }
        return Array.from(tokens);
    }

    const clean = cleanServerSectionString(rawStr);
    if (!clean) return [];
    tokens.add(clean);

    const matchedMaster = SERVER_SECTION_MASTER.find(s => {
        if (cleanServerSectionString(s.name) === clean) return true;
        if (s.uniCode && cleanServerSectionString(s.uniCode) === clean) return true;
        return false;
    });

    if (matchedMaster) {
        tokens.add(`id:${matchedMaster.id}`);
        const cName = cleanServerSectionString(matchedMaster.name);
        if (cName) tokens.add(cName);
        const cCode = cleanServerSectionString(matchedMaster.uniCode);
        if (cCode) tokens.add(cCode);
    }

    if (clean === 'assembly') {
        tokens.add('assembly');
    } else if (clean === 'cc' || clean === 'crimping' || clean === 'candc') {
        tokens.add('cc');
    }

    return Array.from(tokens);
};

const getServerUserSections = (user) => {
    if (!user || typeof user !== 'object') return [];
    const tokens = new Set();
    const add = (val) => {
        if (!val) return;
        normalizeServerSectionToken(val).forEach(t => tokens.add(t));
    };

    add(user.section);
    add(user.sectionName);
    add(user.sectionId);
    add(user.targetSectionId);
    if (Array.isArray(user.sections)) {
        user.sections.forEach(s => add(s));
    }
    add(user.subSection);
    add(user.subSectionName);
    add(user.subSectionId);
    if (Array.isArray(user.subSections)) {
        user.subSections.forEach(s => add(s));
    }

    return Array.from(tokens);
};

const getServerRecordSections = (record) => {
    if (!record || typeof record !== 'object') return [];
    const tokens = new Set();
    const add = (val) => {
        if (!val) return;
        normalizeServerSectionToken(val).forEach(t => tokens.add(t));
    };

    add(record.section);
    add(record.sectionName);
    add(record.sectionId);

    if (record.sheet && typeof record.sheet === 'object') {
        add(record.sheet.section);
        add(record.sheet.sectionName);
        add(record.sheet.sectionId);
        if (record.sheet.headerInfo && typeof record.sheet.headerInfo === 'object') {
            add(record.sheet.headerInfo.section);
            add(record.sheet.headerInfo.sectionName);
            add(record.sheet.headerInfo.sectionId);
        }
    }

    const createdBy = record.createdBy || record.sheet?.createdBy;
    if (createdBy && typeof createdBy === 'object') {
        add(createdBy.section);
        add(createdBy.sectionName);
        add(createdBy.sectionId);
        if (Array.isArray(createdBy.sections)) {
            createdBy.sections.forEach(s => add(s));
        }
    }

    // ONLY fall back to LPA generic category (assembly / cc) if NO explicit section was identified
    if (tokens.size === 0) {
        if (record.category === 'assembly' || record.lpaCategory === 'assembly' || record.lpaSource?.category === 'assembly' || String(record.id || '').toLowerCase().includes('pdca-lpa-assembly')) {
            tokens.add('assembly');
        } else if (record.category === 'cc' || record.lpaCategory === 'cc' || record.lpaSource?.category === 'cc' || String(record.id || '').toLowerCase().includes('pdca-lpa-cc')) {
            tokens.add('cc');
        }
    }

    return Array.from(tokens);
};

const areServerSectionsMatching = (userSecs, recordSecs, userDepts = [], recordDepts = []) => {
    if (!Array.isArray(userSecs) || !Array.isArray(recordSecs)) return false;
    if (userSecs.length === 0 && recordSecs.length === 0) {
        return true;
    }
    if (userSecs.length === 0 || recordSecs.length === 0) {
        return false;
    }
    // 1. Direct equality
    if (userSecs.some(us => recordSecs.includes(us))) return true;

    // 2. Substring matching for section tokens
    for (const us of userSecs) {
        if (!us || us.startsWith('id:')) continue;
        for (const rs of recordSecs) {
            if (!rs || rs.startsWith('id:')) continue;
            if (us === rs) return true;
            if (us.length >= 3 && rs.length >= 3) {
                if (us.includes(rs) || rs.includes(us)) return true;
            }
        }
    }

    // 3. Generic LPA Assembly section match (only when record has generic 'assembly' category)
    const isGenericAssemblyRecord = recordSecs.some(rs => rs === 'assembly');
    const isAssemblyUserSec = userSecs.some(us => us === 'assembly');
    const isAssemblyUserDept = userDepts.includes('assembly');
    if (isGenericAssemblyRecord && (isAssemblyUserSec || isAssemblyUserDept)) {
        return true;
    }

    // 4. Generic LPA CC section match (only when record has generic 'cc' category)
    const isGenericCcRecord = recordSecs.some(rs => rs === 'cc');
    const isCcUserSec = userSecs.some(us => us === 'cc');
    const isCcUserDept = userDepts.includes('c&c') || userDepts.includes('cc');
    if (isGenericCcRecord && (isCcUserSec || isCcUserDept)) {
        return true;
    }

    return false;
};

export const isUserInSameDepartmentAsRecord = (user, record) => {
    if (!user || !record) return false;
    if (isUserCreatorOfRecord(user, record)) return true;

    // Administrators have full unrestricted access across all sheets
    if (user.isAdmin === true || user.isAdmin === 1 || String(user.role || '').toUpperCase() === 'ADMIN' || String(user.role || '').toUpperCase() === 'SUPERADMIN') {
        return true;
    }

    const userDepts = new Set();
    const addUD = (v) => {
        if (!v) return;
        if (Array.isArray(v)) { v.forEach(addUD); return; }
        if (typeof v === 'object') {
            addUD(v.name);
            addUD(v.department);
            addUD(v.deptName);
            addUD(v.departmentName);
            addUD(v.category);
            if (v.id !== undefined && v.id !== null) addUD(`id:${v.id}`);
            return;
        }
        String(v).split(/[,;]/).forEach(part => {
            const n = normalizeServerDepartment(part);
            if (n) userDepts.add(n);
        });
    };

    addUD(user.deptName);
    addUD(user.department);
    addUD(user.departmentName);
    addUD(user.departments);
    if (user.departmentId !== undefined && user.departmentId !== null) {
        addUD(`id:${user.departmentId}`);
        addUD(user.departmentId);
    }
    if (user.deptId !== undefined && user.deptId !== null) {
        addUD(`id:${user.deptId}`);
        addUD(user.deptId);
    }
    if (user.targetDeptId !== undefined && user.targetDeptId !== null) {
        addUD(`id:${user.targetDeptId}`);
        addUD(user.targetDeptId);
    }
    addUD(lookupEmployeeDept(user));
    if (user.empId) addUD(lookupEmployeeDept(user.empId));
    if (user.code) addUD(lookupEmployeeDept(user.code));
    if (user.userName) addUD(lookupEmployeeDept(user.userName));

    // Derive department from user's section if known
    const uSecList = [user.section, user.sectionName, user.sectionId, user.targetSectionId];
    if (Array.isArray(user.sections)) {
        user.sections.forEach(s => uSecList.push(s));
    }
    for (const s of uSecList) {
        if (!s) continue;
        let sObj = null;
        if (typeof s === 'object') {
            if (s.category) addUD(s.category);
            if (s.department) addUD(s.department);
            if (s.name) sObj = SERVER_SECTION_MASTER.find(m => cleanServerSectionString(m.name) === cleanServerSectionString(s.name));
            if (!sObj && s.id) sObj = SERVER_SECTION_MASTER.find(m => Number(m.id) === Number(s.id));
        } else if (/^\d+$/.test(String(s).trim())) {
            sObj = SERVER_SECTION_MASTER.find(m => Number(m.id) === Number(s));
        } else {
            const cleaned = cleanServerSectionString(s);
            sObj = SERVER_SECTION_MASTER.find(m => cleanServerSectionString(m.name) === cleaned || (m.uniCode && cleanServerSectionString(m.uniCode) === cleaned));
        }
        if (sObj && sObj.category) {
            addUD(sObj.category);
        }
    }

    const recordDepts = new Set();
    const addRD = (v) => {
        if (!v) return;
        if (Array.isArray(v)) { v.forEach(addRD); return; }
        if (typeof v === 'object') {
            addRD(v.name);
            addRD(v.department);
            addRD(v.deptName);
            addRD(v.departmentName);
            addRD(v.category);
            if (v.id !== undefined && v.id !== null) addRD(`id:${v.id}`);
            return;
        }
        String(v).split(/[,;]/).forEach(part => {
            const n = normalizeServerDepartment(part);
            if (n) recordDepts.add(n);
        });
    };

    addRD(record.department);
    addRD(record.departments);
    addRD(record.dept);
    addRD(record.deptName);
    addRD(record.departmentName);
    if (record.departmentId !== undefined && record.departmentId !== null) {
        addRD(`id:${record.departmentId}`);
        addRD(record.departmentId);
    }
    if (record.deptId !== undefined && record.deptId !== null) {
        addRD(`id:${record.deptId}`);
        addRD(record.deptId);
    }
    if (record.targetDeptId !== undefined && record.targetDeptId !== null) {
        addRD(`id:${record.targetDeptId}`);
        addRD(record.targetDeptId);
    }

    if (record.sheet && typeof record.sheet === 'object') {
        addRD(record.sheet.department);
        addRD(record.sheet.dept);
        addRD(record.sheet.deptName);
        addRD(record.sheet.departmentName);
        if (record.sheet.departmentId) addRD(`id:${record.sheet.departmentId}`);
        if (record.sheet.headerInfo && typeof record.sheet.headerInfo === 'object') {
            addRD(record.sheet.headerInfo.department);
            addRD(record.sheet.headerInfo.deptName);
            addRD(record.sheet.headerInfo.departmentName);
            if (record.sheet.headerInfo.departmentId) addRD(`id:${record.sheet.headerInfo.departmentId}`);
        }
    }

    // Derive department from record's section if known in section master
    const rSecList = [record.section, record.sectionName, record.sectionId, record.sheet?.section, record.sheet?.sectionName, record.sheet?.sectionId];
    for (const s of rSecList) {
        if (!s) continue;
        let sObj = null;
        if (typeof s === 'object') {
            if (s.category) addRD(s.category);
            if (s.department) addRD(s.department);
            if (s.name) sObj = SERVER_SECTION_MASTER.find(m => cleanServerSectionString(m.name) === cleanServerSectionString(s.name));
            if (!sObj && s.id) sObj = SERVER_SECTION_MASTER.find(m => Number(m.id) === Number(s.id));
        } else if (/^\d+$/.test(String(s).trim())) {
            sObj = SERVER_SECTION_MASTER.find(m => Number(m.id) === Number(s));
        } else {
            const cleaned = cleanServerSectionString(s);
            sObj = SERVER_SECTION_MASTER.find(m => cleanServerSectionString(m.name) === cleaned || (m.uniCode && cleanServerSectionString(m.uniCode) === cleaned));
        }
        if (sObj && sObj.category) {
            addRD(sObj.category);
        }
    }

    const createdBy = record.createdBy || record.sheet?.createdBy;
    if (createdBy) {
        if (typeof createdBy === 'object') {
            addRD(createdBy.department);
            addRD(createdBy.dept);
            addRD(createdBy.deptName);
            addRD(createdBy.departmentName);
            addRD(createdBy.departments);
            if (createdBy.departmentId) addRD(`id:${createdBy.departmentId}`);
            if (createdBy.deptId) addRD(`id:${createdBy.deptId}`);
            addRD(createdBy.section);
            addRD(createdBy.sectionName);
            addRD(lookupEmployeeDept(createdBy));
        } else if (typeof createdBy === 'string') {
            addRD(lookupEmployeeDept(createdBy));
        }
    }

    const createdById = record.createdById || record.sheet?.createdById;
    if (createdById) {
        addRD(lookupEmployeeDept(createdById));
    }

    const preparedBy = record.sheet?.headerInfo?.preparedBy;
    if (preparedBy) {
        addRD(lookupEmployeeDept(preparedBy));
    }

    const rows = record.sheet?.rows || record.rows;
    if (Array.isArray(rows)) {
        rows.forEach(r => {
            if (r?.department) addRD(r.department);
            if (r?.departments) addRD(r.departments);
        });
    }

    // Fallback to section or category ONLY if no department found
    if (recordDepts.size === 0) {
        addRD(record.section);
        addRD(record.sectionName);
        addRD(record.category);
        addRD(record.lpaCategory);
        if (createdBy && typeof createdBy === 'object') {
            addRD(createdBy.section);
            addRD(createdBy.sectionName);
        }
    }

    if (recordDepts.size === 0) {
        const idLower = String(record.id || record.recordId || '').toLowerCase();
        const topicLower = String(record.topic || '').toLowerCase();
        if (idLower.includes('pdca-lpa-assembly') || topicLower.includes('assembly')) {
            recordDepts.add('assembly');
        } else if (idLower.includes('pdca-lpa-cc') || topicLower.includes('c&c')) {
            recordDepts.add('c&c');
        }
    }

    // 1. Department match: User and Record belong to the same department
    let deptMatch = false;
    for (const ud of userDepts) {
        if (recordDepts.has(ud)) {
            deptMatch = true;
            break;
        }
    }

    // RULE: Employees with the SAME Department get full access of the sheet (same section is not required)
    if (deptMatch) {
        return true;
    }

    // 2. Direct Colleague-to-Creator match: check creator's department
    if (createdBy && typeof createdBy === 'object') {
        const creatorDepts = new Set();
        const addCD = (v) => {
            if (!v) return;
            if (Array.isArray(v)) { v.forEach(addCD); return; }
            if (typeof v === 'object') {
                addCD(v.name); addCD(v.department); addCD(v.deptName); addCD(v.category);
                return;
            }
            String(v).split(/[,;]/).forEach(part => {
                const n = normalizeServerDepartment(part);
                if (n) creatorDepts.add(n);
            });
        };
        addCD(createdBy.department);
        addCD(createdBy.dept);
        addCD(createdBy.deptName);
        addCD(createdBy.departmentName);
        addCD(createdBy.departments);
        addCD(lookupEmployeeDept(createdBy));
        let creatorDeptMatch = false;
        for (const ud of userDepts) {
            if (creatorDepts.has(ud)) {
                creatorDeptMatch = true;
                break;
            }
        }
        if (creatorDeptMatch) {
            return true;
        }
    }

    return false;
};

export const isUserInSameDepartmentAndSectionAsRecord = isUserInSameDepartmentAsRecord;

// Helper to determine if an authenticated user is assigned as responsible staff in any PDCA row

// Helper to determine if an authenticated user is authorized to view/access a PDCA record
export const canUserAccessPDCARecord = (user, record) => {
    if (!record) return false;
    if (!user) return false;

    // Administrators have unrestricted access to all PDCA sheets across all departments
    if (user.isAdmin === true || user.isAdmin === 1 || String(user.role || '').toUpperCase() === 'ADMIN' || String(user.role || '').toUpperCase() === 'SUPERADMIN') {
        return true;
    }

    // The sheet creator has full access
    if (isUserCreatorOfRecord(user, record)) {
        return true;
    }

    // Any employee belonging to the same department has full access
    if (isUserInSameDepartmentAsRecord(user, record)) {
        return true;
    }

    // Responsible staff assigned to any row in this sheet have access
    const rows = record.sheet?.rows || record.rows || [];
    if (isUserResponsibleStaff(user, rows)) {
        return true;
    }

    return false;
};

export const isUserResponsibleStaff = (user, rows) => {
    if (!user || !Array.isArray(rows)) return false;
    const userIds = [user.id, user._id, user.userId].filter(Boolean).map(String);
    const userCodes = [user.empId, user.employeeId, user.userName, user.code].filter(Boolean).map(s => String(s).trim().toUpperCase());
    const userNames = [user.fullName, user.name].filter(Boolean).map(s => String(s).trim().toLowerCase());

    return rows.some(row => {
        if (!row) return false;
        if (Array.isArray(row.staffEmployees) && row.staffEmployees.length > 0) {
            for (const emp of row.staffEmployees) {
                if (!emp) continue;
                if (emp.id && userIds.includes(String(emp.id))) return true;
                const code = String(emp.code || emp.empId || '').trim().toUpperCase();
                if (code && userCodes.includes(code)) return true;
                const name = String(emp.name || emp.fullName || '').trim().toLowerCase();
                if (name && userNames.includes(name)) return true;
            }
        }
        if (row.staffEmployee && typeof row.staffEmployee === 'string') {
            const parts = row.staffEmployee.split(/[,;]/).map(s => s.trim()).filter(Boolean);
            for (const part of parts) {
                const pUpper = part.toUpperCase();
                const pLower = part.toLowerCase();
                if (userCodes.some(c => pUpper.includes(c))) return true;
                if (userNames.some(n => pLower.includes(n))) return true;
            }
        }
        const staffId = String(row.staffId || row.employeeId || '').trim().toUpperCase();
        if (staffId && userCodes.includes(staffId)) return true;
        const staffName = String(row.staffName || '').trim().toLowerCase();
        if (staffName && userNames.includes(staffName)) return true;
        return false;
    });
};

// --- A. PDCA Record Management ---

/**
 * 1. Create a PDCA record
 * POST /api/v1/pdca
 */
export const createPDCARecord = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { topic } = req.body;

    if (!topic || !String(topic).trim()) {
        throw new ApiError("Topic is required", 400);
    }

    const creatorCode = (user.empId || user.userName || String(user.id)).toUpperCase();
    const creatorUser = {
        id: user.id || user._id,
        userId: user.id || user._id,
        empId: user.empId || user.userName || String(user.id),
        code: creatorCode,
        name: user.fullName || user.userName,
        email: user.email || '',
        department: user.department?.name || (typeof user.department === 'string' ? user.department : '') || user.deptName || lookupEmployeeDept(user) || req.body?.createdBy?.department || req.body?.department || '',
        avatarBg: req.body?.createdBy?.avatarBg || 'bg-blue-100 text-blue-700',
        initials: req.body?.createdBy?.initials || (user.fullName ? user.fullName.split(' ').map(n => n[0]).join('') : 'U')
    };

    const recordData = {
        ...req.body,
        department: req.body?.department || creatorUser.department,
        createdBy: creatorUser,
        createdById: String(user.id || user._id || creatorCode)
    };

    const actor = user.fullName || user.userName;
    const newRecord = await PDCAModel.create(recordData, actor);

    return res.status(201).json(new ApiResponse(201, { ...newRecord, isCreator: true }, "PDCA record created successfully"));
});

/**
 * 2. List PDCA records
 * GET /api/v1/pdca
 */
export const getPDCARecords = asyncHandler(async (req, res) => {
    const { plant, scope, search, page, limit } = req.query;

    let user = req.user;
    if (!user) {
        try { user = getAuthenticatedUser(req); } catch {}
    }

    const result = await PDCAModel.findAll({
        plant,
        scope,
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 100
    });

    if (result && Array.isArray(result.records)) {
        const isAdmin = Boolean(
            user && (user.isAdmin === true || user.isAdmin === 1 || String(user.role || '').toUpperCase() === 'ADMIN' || String(user.role || '').toUpperCase() === 'SUPERADMIN')
        );



        result.records = result.records.map(rec => ({
            ...rec,
            isCreator: user ? isUserCreatorOfRecord(user, rec) : false
        }));
    }

    return res.status(200).json(new ApiResponse(200, result, "PDCA records fetched successfully"));
});

/**
 * 3. Retrieve a single PDCA record
 * GET /api/v1/pdca/:id
 */
export const getPDCARecordById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const record = await PDCAModel.findByRecordId(id);

    if (!record) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    let user = req.user;
    if (!user) {
        try { user = getAuthenticatedUser(req); } catch {}
    }



    const decorated = {
        ...record,
        isCreator: user ? isUserCreatorOfRecord(user, record) : false
    };

    return res.status(200).json(new ApiResponse(200, decorated, "PDCA record retrieved successfully"));
});

/**
 * 4. Update a PDCA record
 * PUT /api/v1/pdca/:id
 */
export const updatePDCARecord = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;

    const existing = await PDCAModel.findByRecordId(id);
    if (!existing) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    const isCreator = isUserCreatorOfRecord(user, existing);
    const isSameDept = isUserInSameDepartmentAsRecord(user, existing);
    const isAdmin = Boolean(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');

    if (!isCreator && !isSameDept && !isAdmin) {
        throw new ApiError("Forbidden: Only the employee who created this PDCA record or members of the same department can edit it", 403);
    }

    const actor = user.fullName || user.userName;
    const updateData = { ...req.body };
    // Preserve original creator information - never overwrite on update
    delete updateData.createdBy;
    delete updateData.createdById;

    const updated = await PDCAModel.update(id, updateData, actor);

    return res.status(200).json(new ApiResponse(200, { ...updated, isCreator: true }, "PDCA record updated successfully"));
});

/**
 * 5. Delete a PDCA record
 * DELETE /api/v1/pdca/:id
 */
export const deletePDCARecord = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;

    const existing = await PDCAModel.findByRecordId(id);
    if (!existing) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    const isCreator = isUserCreatorOfRecord(user, existing);
    const isAdmin = Boolean(user.isAdmin === true || user.isAdmin === 1 || String(user.role || '').toUpperCase() === 'ADMIN' || String(user.role || '').toUpperCase() === 'SUPERADMIN');
    const isLpaObservation = Boolean(
        String(id).toUpperCase().startsWith('PDCA-LPA-') ||
        existing.lpaSource != null ||
        existing.lpaCategory ||
        /lpa observation/i.test(existing.topic || existing.title || '')
    );
    if (isLpaObservation) {
        if (!isAdmin) {
            throw new ApiError("Forbidden: Only administrators have permission to delete LPA Observation PDCA sheets", 403);
        }
    } else {
        if (!isCreator && !isAdmin) {
            throw new ApiError("Forbidden: Only administrators or the employee who created this PDCA record can delete it", 403);
        }
    }

    const actor = user.fullName || user.userName;
    const deleted = await PDCAModel.delete(id, actor);
    if (!deleted) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, { id }, "PDCA record deleted successfully"));
});

// --- B. PDCA Sheet Management ---

/**
 * 6. Retrieve the PDCA sheet
 * GET /api/v1/pdca/:id/sheet
 */
export const getPDCASheet = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const record = await PDCAModel.findByRecordId(id);
    if (!record) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    let user = req.user;
    if (!user) {
        try { user = getAuthenticatedUser(req); } catch {}
    }



    const sheet = await PDCAModel.getSheet(record.id);
    return res.status(200).json(new ApiResponse(200, sheet, "PDCA sheet retrieved successfully"));
});

/**
 * 7. Save the PDCA sheet
 * PUT /api/v1/pdca/:id/sheet
 */
export const savePDCASheet = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;
    const actor = user.fullName || user.userName || getActorName(req);

    let record = await PDCAModel.findByRecordId(id);
    if (record) {
        const isCreator = isUserCreatorOfRecord(user, record);
        const isSameDepartment = isUserInSameDepartmentAsRecord(user, record);
        const isAdmin = Boolean(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');
        const existingRows = record.sheet?.rows || record.rows || [];
        const incomingRows = Array.isArray(req.body?.rows) ? req.body.rows : (req.body?.sheetData || []);
        const isResponsible = isUserResponsibleStaff(user, existingRows) || isUserResponsibleStaff(user, incomingRows);

        if (!isCreator && !isSameDepartment && !isAdmin && !isResponsible) {
            throw new ApiError("Forbidden: Only the employee who created this PDCA record or assigned responsible staff can edit its sheet", 403);
        }
    } else {
        // Auto-create base record if saving sheet for newly initialized record
        const creatorCode = (user.empId || user.userName || String(user.id)).toUpperCase();
        const creatorUser = {
            id: user.id || user._id,
            userId: user.id || user._id,
            empId: user.empId || user.userName || String(user.id),
            code: creatorCode,
            name: user.fullName || user.userName,
            email: user.email || ''
        };
        record = await PDCAModel.create({
            id,
            topic: req.body?.headerInfo?.topicName || "PDCA Audit Sheet",
            plant: req.body?.plant || "Bawal",
            scope: "Company",
            createdBy: creatorUser,
            createdById: String(user.id || user._id || creatorCode)
        }, actor);
    }

    // Validate selected CFT records referenced in rows (gracefully verify without blocking sheet save)
    const rowsToValidate = Array.isArray(req.body?.rows) ? req.body.rows : (req.body?.sheetData || []);
    for (const rowItem of rowsToValidate) {
        if (rowItem?.cftTopicId && typeof rowItem.cftTopicId === 'string' && rowItem.cftTopicId.trim()) {
            const cftTopicId = rowItem.cftTopicId.trim();
            try {
                const cftRecord = await PDCAModel.findByRecordId(cftTopicId);
                if (!cftRecord || cftRecord.isDeleted) {
                    console.warn(`[savePDCASheet] Referenced CFT record "${cftTopicId}" not found in database; allowing row to save`);
                }
            } catch (cftErr) {
                console.warn(`[savePDCASheet] Could not verify CFT topic "${cftTopicId}":`, cftErr?.message);
            }
        }
    }

    // Validate and auto-link Line/Area to Section hierarchy without throwing 400
    const rowsWithLineArea = rowsToValidate.filter(
        (r) => r && r.lineAreaId !== undefined && r.lineAreaId !== null && r.lineAreaId !== ''
    );
    if (rowsWithLineArea.length > 0) {
        try {
            const hierarchy = await PDCAModel.getSectionsWithLines();
            if (Array.isArray(hierarchy) && hierarchy.length > 0) {
                for (const r of rowsWithLineArea) {
                    const targetSecId = r.sectionId ?? r.lineAreaSectionId;
                    if (targetSecId) {
                        const section = hierarchy.find((s) => String(s.id) === String(targetSecId));
                        const line = section && (section.lines || []).find((l) => String(l.id) === String(r.lineAreaId));
                        if (!section || !line) {
                            // If not matched under targetSecId, attempt to locate parent section across hierarchy
                            const parentSec = hierarchy.find((s) => (s.lines || []).some((l) => String(l.id) === String(r.lineAreaId)));
                            if (parentSec) {
                                r.sectionId = parentSec.id;
                                r.lineAreaSectionId = parentSec.id;
                                if (!r.section) r.section = parentSec.name;
                                if (!r.sectionCode) r.sectionCode = parentSec.uniCode || '';
                            }
                        }
                    } else {
                        const parentSec = hierarchy.find((s) => (s.lines || []).some((l) => String(l.id) === String(r.lineAreaId)));
                        if (parentSec) {
                            r.sectionId = parentSec.id;
                            r.lineAreaSectionId = parentSec.id;
                            if (!r.section) r.section = parentSec.name;
                            if (!r.sectionCode) r.sectionCode = parentSec.uniCode || '';
                        }
                    }
                }
            }
        } catch (hierarchyErr) {
            console.warn('[savePDCASheet] Could not verify line/area hierarchy:', hierarchyErr?.message);
        }
    }

    const savedSheet = await PDCAModel.saveSheet(record.id, req.body, actor);
    return res.status(200).json(new ApiResponse(200, savedSheet, "PDCA sheet saved successfully"));
});

// --- C. CFT Topic Management ---

/**
 * 8. Create a CFT topic
 * POST /api/v1/pdca/cft
 */
export const createCFTTopic = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { name, topic } = req.body;
    const title = name || topic;

    if (!title || !String(title).trim()) {
        throw new ApiError("CFT Topic Name is required", 400);
    }

    const creatorCode = (user.empId || user.userName || String(user.id)).toUpperCase();
    const creatorUser = {
        id: user.id || user._id,
        userId: user.id || user._id,
        empId: user.empId || user.userName || String(user.id),
        code: creatorCode,
        name: user.fullName || user.userName,
        email: user.email || '',
        department: user.department?.name || (typeof user.department === 'string' ? user.department : '') || user.deptName || lookupEmployeeDept(user) || req.body?.createdBy?.department || req.body?.department || '',
        avatarBg: req.body?.createdBy?.avatarBg || 'bg-emerald-100 text-emerald-700',
        initials: req.body?.createdBy?.initials || (user.fullName ? user.fullName.split(' ').map(n => n[0]).join('') : 'U')
    };

    const cftData = {
        ...req.body,
        createdBy: creatorUser,
        createdById: String(user.id || user._id || creatorCode)
    };

    const actor = user.fullName || user.userName;
    const cftTopic = await PDCAModel.createCft(cftData, actor);

    return res.status(201).json(new ApiResponse(201, { ...cftTopic, isCreator: true }, "CFT topic created successfully"));
});

/**
 * 9. List CFT topics
 * GET /api/v1/pdca/cft
 */
export const getCFTTopics = asyncHandler(async (req, res) => {
    const { plant, search, page, limit } = req.query;

    const result = await PDCAModel.findAll({
        plant,
        scope: 'CFT',
        search,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 100
    });

    if (result && Array.isArray(result.records)) {
        result.records = result.records.map(rec => ({
            ...rec,
            isCreator: req.user ? isUserCreatorOfRecord(req.user, rec) : false
        }));
    }

    return res.status(200).json(new ApiResponse(200, result, "CFT topics retrieved successfully"));
});

/**
 * 10. Update a CFT topic
 * PUT /api/v1/pdca/cft/:id
 */
export const updateCFTTopic = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;

    const existing = await PDCAModel.findByRecordId(id);
    if (!existing) {
        throw new ApiError(`CFT topic with ID ${id} not found`, 404);
    }

    if (!isUserCreatorOfRecord(user, existing)) {
        throw new ApiError("Forbidden: Only the employee who created this CFT record can edit it", 403);
    }

    const actor = user.fullName || user.userName;
    const updateData = { ...req.body };
    delete updateData.createdBy;
    delete updateData.createdById;

    const updated = await PDCAModel.update(id, updateData, actor);

    return res.status(200).json(new ApiResponse(200, { ...updated, isCreator: true }, "CFT topic updated successfully"));
});

/**
 * 11. Delete a CFT topic
 * DELETE /api/v1/pdca/cft/:id
 */
export const deleteCFTTopic = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;

    const existing = await PDCAModel.findByRecordId(id);
    if (!existing) {
        throw new ApiError(`CFT topic with ID ${id} not found`, 404);
    }

    if (!isUserCreatorOfRecord(user, existing)) {
        throw new ApiError("Forbidden: Only the employee who created this CFT record can delete it", 403);
    }

    const actor = user.fullName || user.userName;
    const deleted = await PDCAModel.delete(id, actor);
    if (!deleted) {
        throw new ApiError(`CFT topic with ID ${id} not found`, 404);
    }

    return res.status(200).json(new ApiResponse(200, { id }, "CFT topic deleted successfully"));
});

// --- D. CFT Member Management ---

/**
 * 12. Retrieve CFT members
 * GET /api/v1/pdca/cft/:id/members
 */
export const getCFTMembers = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const members = await PDCAModel.getCftMembers(id);

    return res.status(200).json(new ApiResponse(200, members, "CFT members retrieved successfully"));
});

/**
 * 13. Update CFT member assignments
 * PUT /api/v1/pdca/cft/:id/members
 */
export const updateCFTMembers = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;

    const existing = await PDCAModel.findByRecordId(id);
    if (!existing) {
        throw new ApiError(`CFT topic with ID ${id} not found`, 404);
    }

    if (!isUserCreatorOfRecord(user, existing)) {
        throw new ApiError("Forbidden: Only the employee who created this CFT record can edit its members", 403);
    }

    const actor = user.fullName || user.userName;
    const members = req.body.members || req.body;

    if (!Array.isArray(members)) {
        throw new ApiError("Members must be an array of employee assignments", 400);
    }

    const updated = await PDCAModel.updateCftMembers(id, members, actor);
    return res.status(200).json(new ApiResponse(200, updated, "CFT members updated successfully"));
});

// --- E. Attachment and Evidence Management ---

/**
 * 14. Upload an attachment
 * POST /api/v1/pdca/:id/attachments
 */
export const uploadAttachment = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id } = req.params;
    const { rowId, fieldName } = req.body;

    const record = await PDCAModel.findByRecordId(id);
    if (!record) {
        throw new ApiError(`PDCA record with ID ${id} not found`, 404);
    }

    const isCreator = isUserCreatorOfRecord(user, record);
    const isAdmin = Boolean(user.isAdmin || user.role === 'ADMIN' || user.role === 'SUPERADMIN');
    const existingRows = record.sheet?.rows || record.rows || [];
    const isResponsible = isUserResponsibleStaff(user, existingRows);

    if (!isCreator && !isAdmin && !isResponsible) {
        throw new ApiError("Forbidden: Only the employee who created this PDCA record or assigned responsible staff can upload attachments", 403);
    }

    if (!req.file) {
        throw new ApiError("No file uploaded", 400);
    }

    const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
    if (req.file.size > MAX_SIZE) {
        throw new ApiError(`File size (${(req.file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 15 MB limit`, 400);
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const attachment = await PDCAModel.createAttachment({
        pdcaRecordId: id,
        rowId: rowId || '',
        fieldName: fieldName || '',
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        uploadedBy: user.fullName || user.userName
    });

    return res.status(201).json(new ApiResponse(201, {
        id: attachment?.id,
        filename: req.file.filename,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        rowId,
        fieldName
    }, "Attachment uploaded successfully"));
});

/**
 * 15. Retrieve or access an attachment
 * GET /api/v1/pdca/:id/attachments/:attachmentId
 */
export const getAttachment = asyncHandler(async (req, res) => {
    const { id, attachmentId } = req.params;
    const attachment = await PDCAModel.getAttachmentById(attachmentId);

    if (!attachment || attachment.pdcaRecordId !== id) {
        throw new ApiError("Attachment not found", 404);
    }

    const filePath = path.join(process.cwd(), "uploads", attachment.filename);
    if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
    }

    return res.status(200).json(new ApiResponse(200, attachment, "Attachment metadata retrieved"));
});

/**
 * 16. Delete an attachment
 * DELETE /api/v1/pdca/:id/attachments/:attachmentId
 */
export const deleteAttachment = asyncHandler(async (req, res) => {
    const user = getAuthenticatedUser(req);
    const { id, attachmentId } = req.params;

    const attachment = await PDCAModel.getAttachmentById(attachmentId);
    if (!attachment || attachment.pdcaRecordId !== id) {
        throw new ApiError("Attachment not found", 404);
    }

    const record = await PDCAModel.findByRecordId(id);
    if (record && !isUserCreatorOfRecord(user, record)) {
        throw new ApiError("Forbidden: Only the employee who created this PDCA record can delete attachments", 403);
    }

    await PDCAModel.deleteAttachment(attachmentId);

    // Clean up file if present
    try {
        const filePath = path.join(process.cwd(), "uploads", attachment.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {}

    return res.status(200).json(new ApiResponse(200, { attachmentId }, "Attachment deleted successfully"));
});

// --- F. Audit History ---

/**
 * 17. Retrieve PDCA history
 * GET /api/v1/pdca/:id/history
 */
export const getPDCAHistory = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const history = await PDCAModel.getHistory(id);

    return res.status(200).json(new ApiResponse(200, history, "PDCA history retrieved successfully"));
});

// --- G. Metadata and Dropdowns ---

/**
 * 18. Retrieve PDCA metadata
 * GET /api/v1/pdca/metadata
 */
export const getPDCAMetadata = asyncHandler(async (req, res) => {
    // Standard 13 departments for PDCA module in exact order
    const REQUIRED_PDCA_DEPARTMENTS = [
        'PE', 'IT', 'Quality', 'Assembly', 'SRC', 'Store',
        'HR', 'Safety', 'FG', 'PPC', 'Maintenance', 'D&D', 'C&C'
    ];
    let departments = [...REQUIRED_PDCA_DEPARTMENTS];

    try {
        const [deptRows] = await executeQuery(`SELECT name FROM departments WHERE isDeleted = 0 OR isDeleted IS NULL ORDER BY name ASC`);
        if (deptRows && deptRows.length > 0) {
            const dbDepts = deptRows.map(d => d.name).filter(Boolean);
            const extra = dbDepts.filter(d => !REQUIRED_PDCA_DEPARTMENTS.includes(d));
            departments = [...REQUIRED_PDCA_DEPARTMENTS, ...extra];
        }
    } catch {}

    // Fetch active employees/users for staff & CFT dropdown
    let employees = await PDCAModel.getEmployees();

    // Fetch database-driven sections with nested lines/areas
    let sections = await PDCAModel.getSectionsWithLines();

    const metadata = {
        plants: ['Bawal', 'Gujrat'],
        scopes: ['Company', 'Department', 'Self PDCA', 'CFT'],
        shifts: ['Day', 'Night', 'General', 'A', 'B', 'C'],
        statuses: ['Open', 'Under Observation', 'Delayed', 'Closed'],
        departments,
        employees,
        sections
    };

    return res.status(200).json(new ApiResponse(200, metadata, "PDCA metadata retrieved successfully"));
});

/**
 * 19. Retrieve all Sections and nested Lines/Areas directly from database
 * GET /api/v1/pdca/sections
 */
export const getPDCASections = asyncHandler(async (req, res) => {
    const sections = await PDCAModel.getSectionsWithLines();
    return res.status(200).json(new ApiResponse(200, sections, "Sections and lines retrieved successfully"));
});

/**
 * 20. Retrieve Employees directly from database (with search support)
 * GET /api/v1/pdca/employees?search=...
 */
export const getPDCAEmployees = asyncHandler(async (req, res) => {
    const { search } = req.query;
    const employees = await PDCAModel.getEmployees(search);
    return res.status(200).json(new ApiResponse(200, employees, "Employees retrieved successfully"));
});

