import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGetAllDepartmentsQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetAllQuizzesQuery, useDeleteQuizMutation } from "@/Redux/AllApi/QuizApi";
import { useGetSubSectionsQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetLinesQuery } from "@/Redux/AllApi/LineApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";
import { useGetStudentOJTsQuery } from "@/Redux/AllApi/OnJobTrainingApi";
import { useLogActionMutation } from "@/Redux/AllApi/AuditApi";
import {
  IconFileText,
  IconSearch,
  IconFilter,
  IconExternalLink,
  IconRefresh,
  IconClock,
  IconCertificate,
  IconPlayerPlay,
  IconLayoutGrid,
  IconEdit,
  IconTrash
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

import { useSelector } from "react-redux";
import { se } from "date-fns/locale";
import useTranslate from "@/hooks/useTranslate";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AdminQuizMonitoring from "./QuizMonitoring";
import CertificateTemplates from "./CertificateTemplates";

const VALID_TEST_PAPER_TABS = ["testPaper", "testMonitoring", "certificateTemplates"];

const TestPaper = ({ isDojo: forceDojo, isMultiSkilling: forceMultiSkilling, skillUpgradation: forceSkillUpgradation }) => {
  const { t } = useTranslate();
  const navigate = useNavigate();
  const currentUser = useSelector((state) => state.auth.user);

  const [searchParams, setSearchParams] = useSearchParams();

  // Use a dedicated `testPaperTab` param (instead of `tab`) so this component's own
  // internal tabs never collide with the parent page's `tab` param when embedded
  // inside SkillMatrix / MultiSkilling / DojoHiring (which each already own `?tab=`).
  const [activeTestPaperTab, setActiveTestPaperTab] = useState(() => {
    const tabFromUrl = searchParams.get('testPaperTab');
    return VALID_TEST_PAPER_TABS.includes(tabFromUrl) ? tabFromUrl : "testPaper";
  });

  const handleTestPaperTabChange = (tab) => {
    setActiveTestPaperTab(tab);
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('testPaperTab', tab);
      return next;
    }, { replace: true });
  };

  // Keep activeTestPaperTab in sync with the URL (e.g. browser back/forward, deep links)
  useEffect(() => {
    const tabFromUrl = searchParams.get('testPaperTab');
    if (VALID_TEST_PAPER_TABS.includes(tabFromUrl) && tabFromUrl !== activeTestPaperTab) {
      setActiveTestPaperTab(tabFromUrl);
    }
  }, [searchParams]);

  const [logAction] = useLogActionMutation();

  useEffect(() => {
    const actionByTab = {
      testPaper: "VIEW_TEST_PAPER_LIST",
      testMonitoring: "VIEW_TEST_MONITORING",
      certificateTemplates: "VIEW_CERTIFICATE_TEMPLATES",
    };
    const action = actionByTab[activeTestPaperTab];
    if (action) logAction({ action, details: {} });
  }, [activeTestPaperTab]);

  const hasPermission = (permission) => {
    if (currentUser?.role === "SUPERADMIN" || currentUser?.role === "ADMIN") return true;
    return currentUser?.customRole?.permissions?.includes(permission);
  };

  const canRead = hasPermission("test_paper:read") || currentUser?.role === "STUDENT" || currentUser?.isEmployee;
  const canManage = hasPermission("test_paper:create");

  const isAuthorizedToAccessAll = currentUser?.role === "SUPERADMIN" ||
    currentUser?.role === "ADMIN" ||
    hasPermission("test_paper:access_all");

  const canEdit = currentUser?.role === "SUPERADMIN" ||
    currentUser?.role === "ADMIN" ||
    hasPermission("test_paper:edit");

  const canDelete = currentUser?.role === "SUPERADMIN" ||
    currentUser?.role === "ADMIN" ||
    hasPermission("test_paper:delete");

  // Helper: normalise an ID that may be a primitive or an object with id/_id
  const normalizeId = (v) => {
    if (v && typeof v === 'object') return String(v.id || v._id || '');
    return String(v);
  };

  const assignedDepartments = useMemo(() => {
    const rawAssigned = Array.isArray(currentUser?.departments) ? [...currentUser.departments] : [];
    if (currentUser?.departmentId) rawAssigned.push(currentUser.departmentId);
    return [...new Set(rawAssigned.map(normalizeId))].filter(Boolean);
  }, [currentUser]);

  // Custom/restricted role users don't always carry role === "CUSTOM" (e.g. operators/employees
  // default to role "STUDENT" with a customRole attached) — detect by department restriction instead.
  const isCustomRoleUser = !isAuthorizedToAccessAll && assignedDepartments.length > 0;

  const assignedSections = useMemo(() => {
    const rawAssigned = Array.isArray(currentUser?.sections) ? [...currentUser.sections] : [];
    if (currentUser?.sectionId) rawAssigned.push(currentUser.sectionId);
    return [...new Set(rawAssigned.map(normalizeId))].filter(Boolean);
  }, [currentUser]);

  const assignedLines = useMemo(() => {
    const rawAssigned = Array.isArray(currentUser?.lines) ? [...currentUser.lines] : [];
    if (currentUser?.lineId) rawAssigned.push(currentUser.lineId);
    return [...new Set(rawAssigned.map(normalizeId))].filter(Boolean);
  }, [currentUser]);

  const assignedSubSections = useMemo(() => {
    const rawAssigned = Array.isArray(currentUser?.subSections) ? [...currentUser.subSections] : [];
    if (currentUser?.subSectionId) rawAssigned.push(currentUser.subSectionId);
    return [...new Set(rawAssigned.map(normalizeId))].filter(Boolean);
  }, [currentUser]);

  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    if (!isAuthorizedToAccessAll && assignedDepartments.length === 1) {
      return assignedDepartments[0];
    }
    return "ALL";
  });

  const [selectedSection, setSelectedSection] = useState(() => {
    if (!isAuthorizedToAccessAll && assignedSections.length === 1) {
      return assignedSections[0];
    }
    return "ALL";
  });

  const [selectedLine, setSelectedLine] = useState(() => {
    if (!isAuthorizedToAccessAll && assignedLines.length === 1) {
      return assignedLines[0];
    }
    return "ALL";
  });

  const [selectedSubSection, setSelectedSubSection] = useState(() => {
    if (!isAuthorizedToAccessAll && assignedSubSections.length === 1) {
      return assignedSubSections[0];
    }
    return "ALL";
  });
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [selectedTestType, setSelectedTestType] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);

  // Fetch Departments
  const { data: departmentsData, isLoading: departmentsLoading } = useGetAllDepartmentsQuery({ limit: 1000 });
  const rawAllDepartments = departmentsData?.data?.departments || [];

  // The API can return duplicate department rows (same id, or same name under a different id) —
  // dedupe before it reaches the Select, otherwise a single department appears twice in the list.
  const allDepartments = useMemo(() => {
    const seenIds = new Set();
    const seenNames = new Set();
    return rawAllDepartments.filter(dept => {
      const idStr = String(dept._id || dept.id || '');
      const nameStr = (dept.name || '').trim().toLowerCase();
      if (!idStr || seenIds.has(idStr) || seenNames.has(nameStr)) return false;
      seenIds.add(idStr);
      seenNames.add(nameStr);
      return true;
    });
  }, [rawAllDepartments]);

  // Filter departments to only those assigned to the current user (if restricted)
  const departments = useMemo(() => {
    const list = (isAuthorizedToAccessAll || assignedDepartments.length === 0)
      ? allDepartments
      : allDepartments.filter(dept => assignedDepartments.includes(String(dept._id || dept.id)));

    if (isCustomRoleUser) {
      return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [allDepartments, isAuthorizedToAccessAll, assignedDepartments, isCustomRoleUser]);

  // Auto-select the first department for custom role users once departments load
  useEffect(() => {
    if (isCustomRoleUser && departments.length > 0) {
      const isValid = departments.some(dept => String(dept._id || dept.id) === selectedDepartment);
      if (!isValid) {
        setSelectedDepartment(String(departments[0]._id || departments[0].id));
      }
    }
  }, [isCustomRoleUser, departments, selectedDepartment]);

  // Fetch Sections based on selected Department
  const { data: sectionsData, isLoading: sectionsLoading } = useGetSectionsByDepartmentQuery(
    selectedDepartment !== "ALL" ? selectedDepartment : null,
    { skip: selectedDepartment === "ALL" }
  );
  const rawSections = sectionsData?.data || [];

  const sections = useMemo(() => {
    if (isAuthorizedToAccessAll || assignedSections.length === 0) {
      return rawSections;
    }
    return rawSections.filter(sec => assignedSections.includes(String(sec.id || sec._id)));
  }, [rawSections, isAuthorizedToAccessAll, assignedSections]);

  // Fetch all lines
  const { data: linesData } = useGetLinesQuery();
  const allLines = linesData?.data || [];

  // Filtered lines based on selectedSection
  const lines = useMemo(() => {
    let result = allLines;
    if (selectedSection !== "ALL") {
      result = result.filter(l => String(l.sectionId || l._id) === selectedSection);
    } else if (selectedDepartment !== "ALL") {
      result = result.filter(l => String(l.department || l.departmentId) === selectedDepartment);
    }
    if (!isAuthorizedToAccessAll && assignedLines.length > 0) {
      result = result.filter(l => assignedLines.includes(String(l.id || l._id)));
    }
    return result;
  }, [allLines, selectedSection, selectedDepartment, isAuthorizedToAccessAll, assignedLines]);

  // Fetch all sub-sections for rendering names
  const { data: subSectionsData } = useGetSubSectionsQuery({ limit: 1000 });
  const subSections = Array.isArray(subSectionsData?.data)
    ? subSectionsData.data
    : (subSectionsData?.data?.subSections || []);

  // Filtered sub-sections options based on selectedLine
  const filteredSubSections = useMemo(() => {
    let result = subSections;
    if (selectedLine !== "ALL") {
      result = result.filter(s => String(s.lineId) === selectedLine);
    } else if (selectedSection !== "ALL") {
      // Find lines that belong to this section
      const sectionLineIds = allLines.filter(l => String(l.sectionId) === selectedSection).map(l => String(l.id || l._id));
      result = result.filter(s => sectionLineIds.includes(String(s.lineId)));
    }
    if (!isAuthorizedToAccessAll && assignedSubSections.length > 0) {
      result = result.filter(s => assignedSubSections.includes(String(s.id || s._id)));
    }
    return result;
  }, [subSections, selectedLine, selectedSection, allLines, isAuthorizedToAccessAll, assignedSubSections]);

  // Fetch active config levels
  const { data: activeConfigData } = useGetActiveConfigQuery();
  const activeLevels = activeConfigData?.data?.levels || [];

  // Fetch Quizzes with filters
  const { data: quizzesData, isLoading: quizzesLoading, refetch } = useGetAllQuizzesQuery({
    page,
    limit: 50,
    search: searchTerm,
    departmentId: selectedDepartment !== "ALL" ? selectedDepartment : undefined,
    sectionId: selectedSection !== "ALL" ? selectedSection : undefined,
    isDojo: forceDojo !== undefined ? forceDojo : (currentUser?.isTemporary ? true : undefined),
    ...(forceMultiSkilling !== undefined && { isMultiSkilling: forceMultiSkilling }),
    ...(forceSkillUpgradation !== undefined && { skillUpgradation: forceSkillUpgradation }),
  });

  const { data: ojtData } = useGetStudentOJTsQuery(currentUser?.id, {
    skip: !currentUser?.isTemporary || !currentUser?.id
  });

  const isOjtApproved = useMemo(() => {
    if (!currentUser?.isTemporary) return true;

    // Check real-time hook results
    const ojts = ojtData?.data || [];
    if (ojts.some(o => o.result === "Pass" || o.result === "Approved")) return true;

    // Fallback to profile user ojt array
    const userOjts = currentUser?.ojt || [];
    return Array.isArray(userOjts) && userOjts.some(o => o.result === "Pass" || o.result === "Approved");
  }, [ojtData, currentUser]);

  const [deleteQuiz] = useDeleteQuizMutation();

  const handleDelete = async (id) => {
    if (window.confirm(t("testPaper.confirm.delete"))) {
      try {
        await deleteQuiz(id).unwrap();
        toast.success(t("testPaper.toast.deleteSuccess"));
        refetch();
      } catch (err) {
        toast.error(err?.data?.message || t("testPaper.toast.deleteFailed"));
      }
    }
  };

  const rawQuizzes = quizzesData?.data?.quizzes || [];
  const pagination = quizzesData?.data?.pagination || {};

  const quizzes = useMemo(() => {
    return rawQuizzes.filter(quiz => {
      // 0a. Department restriction (local fallback for custom role users)
      if (!isAuthorizedToAccessAll && assignedDepartments.length > 0) {
        const quizDeptIds = (quiz.departmentId || []).map(String);
        if (quizDeptIds.length > 0 && !quizDeptIds.some(id => assignedDepartments.includes(id))) {
          return false;
        }
      }

      // 0b. Section restriction (local fallback for custom role users)
      if (!isAuthorizedToAccessAll && assignedSections.length > 0) {
        const quizSectIds = (quiz.sectionId || []).map(String);
        if (quizSectIds.length > 0 && !quizSectIds.some(id => assignedSections.includes(id))) {
          return false;
        }
      }

      // 1. Line Filter
      if (selectedLine !== "ALL") {
        const quizLineIds = (quiz.lineId || []).map(String);
        if (!quizLineIds.includes(selectedLine)) {
          return false;
        }
      }

      // 2. Sub-section Filter
      if (selectedSubSection !== "ALL") {
        const quizSubSectionIds = (quiz.subSectionId || []).map(String);
        if (!quizSubSectionIds.includes(selectedSubSection)) {
          return false;
        }
      }

      // 3. Level Filter
      if (selectedLevel !== "ALL") {
        if (quiz.level !== selectedLevel) {
          return false;
        }
      }

      // 4. Test Type Filter
      if (selectedTestType !== "ALL") {
        if (selectedTestType === "dojo" && !quiz.isDojo) return false;
        if (selectedTestType === "theoretical" && !quiz.isTheoretical) return false;
        if (selectedTestType === "multiskilling" && !quiz.isMultiSkilling) return false;
        if (selectedTestType === "practical" && (quiz.isDojo || quiz.isTheoretical || quiz.isMultiSkilling)) return false;
      }

      // 5. OJT Gating Filter for Non-Dojo quizzes
      if (!quiz.isDojo && currentUser?.isTemporary && !isOjtApproved) {
        return false;
      }

      return true;
    });
  }, [rawQuizzes, selectedLine, selectedSubSection, selectedLevel, selectedTestType, isOjtApproved, currentUser, isAuthorizedToAccessAll, assignedDepartments, assignedSections]);

  const handleReset = () => {
    if (isCustomRoleUser && departments.length > 0) {
      setSelectedDepartment(String(departments[0]._id || departments[0].id));
    } else {
      setSelectedDepartment(!isAuthorizedToAccessAll && assignedDepartments.length === 1 ? assignedDepartments[0] : "ALL");
    }
    setSelectedSection(!isAuthorizedToAccessAll && assignedSections.length === 1 ? assignedSections[0] : "ALL");
    setSelectedLine(!isAuthorizedToAccessAll && assignedLines.length === 1 ? assignedLines[0] : "ALL");
    setSelectedSubSection(!isAuthorizedToAccessAll && assignedSubSections.length === 1 ? assignedSubSections[0] : "ALL");
    setSelectedLevel("ALL");
    setSelectedTestType("ALL");
    setSearchTerm("");
    setPage(1);
  };

  if (!canRead) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
        <IconFileText className="w-12 h-12 text-slate-300" />
        <h2 className="text-2xl font-bold text-slate-900">{t("testPaper.accessDenied.title")}</h2>
        <p className="text-slate-500 max-w-md">{t("testPaper.accessDenied.desc")}</p>
      </div>
    );
  }

  // Candidate Assessment Center UI (isTemporary: true)
  if (currentUser?.isTemporary) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] pb-12">
        {/* Hero Section */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white py-12 px-8 mb-8 shadow-lg">
          <div className="max-w-6xl mx-auto">
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">{t("testPaper.hero.dojoCenter")}</h1>
            <p className="text-blue-100 text-lg opacity-90">
              {t("testPaper.hero.welcome", "Welcome, {name}! Here are your assigned assessments for the hiring process.").replace("{name}", currentUser.fullName)}
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t("testPaper.hero.available")}</h2>
              <p className="text-slate-500">{t("testPaper.hero.availableDesc")}</p>
            </div>
            <Button variant="outline" onClick={() => refetch()} className="bg-white hover:bg-slate-50 shadow-sm border-slate-200">
              <IconRefresh className="h-4 w-4 mr-2 text-blue-600" />
              {t("testPaper.refreshList")}
            </Button>
          </div>

          {quizzesLoading ? (
            <Card className="border-none shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">{t("testPaper.table.title")}</TableHead>
                      <TableHead>{t("testPaper.table.duration")}</TableHead>
                      <TableHead>{t("testPaper.table.questions")}</TableHead>
                      <TableHead>{t("testPaper.table.minScore")}</TableHead>
                      <TableHead className="text-right">{t("testPaper.table.actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[1, 2, 3].map((i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-10 w-24 ml-auto rounded-md" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : quizzes.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-200 bg-white/50 py-20">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <IconFileText className="h-10 w-10 text-slate-400" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">{t("testPaper.noAssessments")}</h3>
                <p className="text-slate-500 max-w-sm">
                  {t("testPaper.noAssessmentsDesc")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-none shadow-xl overflow-hidden rounded-2xl bg-white">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="border-b border-slate-100 h-14">
                    <TableHead className="pl-8 font-bold text-slate-900 text-sm uppercase tracking-wider">{t("testPaper.table.title")}</TableHead>
                    <TableHead className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center">{t("testPaper.table.duration")}</TableHead>
                    <TableHead className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center">{t("testPaper.table.questions")}</TableHead>
                    <TableHead className="font-bold text-slate-900 text-sm uppercase tracking-wider text-center">{t("testPaper.table.passScore")}</TableHead>
                    <TableHead className="pr-8 font-bold text-slate-900 text-sm uppercase tracking-wider text-right">{t("testPaper.table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quizzes.map((quiz) => (
                    <TableRow key={quiz._id} className="group hover:bg-blue-50/30 transition-colors border-slate-50 h-24">
                      <TableCell className="pl-8">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300">
                            <IconFileText size={24} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 text-lg leading-tight group-hover:text-blue-700 transition-colors">
                              {quiz.title}
                            </span>
                            <span className="text-sm text-slate-500 line-clamp-1 max-w-md">
                              {quiz.description || t("testPaper.descriptionFallback", "Assessment to evaluate skills for current position.")}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                           <IconClock size={18} className="text-blue-500" />
                          <span>{quiz.timeLimit || 0} {t("testPaper.mins")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5 font-semibold text-slate-700">
                          <IconLayoutGrid size={18} className="text-blue-500" />
                          <span>{quiz.questions?.length || 0} {t("testPaper.items")}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-slate-900 text-white font-bold px-3 py-1">
                          {quiz.passingScore}%
                        </Badge>
                      </TableCell>
                      <TableCell className="pr-8 text-right">
                        <Button
                          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold h-11 px-6 rounded-xl shadow-lg shadow-blue-100 group-hover:scale-105 transition-transform"
                          onClick={() => navigate(`/student/quiz/${quiz._id}`)}
                        >
                          <IconPlayerPlay className="h-4 w-4 mr-2" />
                          {t("testPaper.startTest")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Standard Admin/Student UI
  return (
    <Tabs value={activeTestPaperTab} onValueChange={handleTestPaperTabChange} className="w-full space-y-6">
      <TabsList className="bg-slate-100 p-1 rounded-xl h-11 w-fit">
        <TabsTrigger value="testPaper" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
          {t("testPaper.tabs.testPaper")}
        </TabsTrigger>
        <TabsTrigger value="testMonitoring" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
          {t("testPaper.tabs.testMonitoring")}
        </TabsTrigger>
        <TabsTrigger value="certificateTemplates" className="rounded-lg px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
          {t("testPaper.tabs.certificateTemplates")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="testPaper">
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("testPaper.title")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("testPaper.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <IconRefresh className="h-4 w-4" />
            {t("testPaper.refresh")}
          </Button>
          {canManage && (
            <Button onClick={() => {
              const base = "/" + (window.location.pathname.split('/')[1] || "admin");
              const queryParams = new URLSearchParams();
              if (selectedDepartment !== "ALL") queryParams.append("departmentId", selectedDepartment);
              if (selectedSection !== "ALL") queryParams.append("sectionId", selectedSection);
              if (selectedLine !== "ALL") queryParams.append("lineId", selectedLine);
              if (selectedSubSection !== "ALL") queryParams.append("subSectionId", selectedSubSection);
              const queryString = queryParams.toString();
              navigate(`${base}/add-test-paper${queryString ? `?${queryString}` : ""}`);
            }} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <IconFileText className="h-4 w-4" />
              {t("testPaper.createTestPaper")}
            </Button>
          )}
        </div>
      </div>

      <Card className="border-none shadow-sm bg-muted/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <IconFilter className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{t("testPaper.filterTitle")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblDepartment")}</label>
              <Select
                value={selectedDepartment}
                onValueChange={(val) => {
                  setSelectedDepartment(val);
                  setSelectedSection("ALL");
                  setSelectedLine("ALL");
                  setSelectedSubSection("ALL");
                }}
                disabled={!isAuthorizedToAccessAll && assignedDepartments.length === 1}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t("testPaper.phSelectDept")} />
                </SelectTrigger>
                <SelectContent>
                  {!isCustomRoleUser && (isAuthorizedToAccessAll || assignedDepartments.length !== 1) && (
                    <SelectItem value="ALL">{t("testPaper.optAllDepts")}</SelectItem>
                  )}
                  {departments.map((dept) => (
                    <SelectItem key={dept._id || dept.id} value={String(dept._id || dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblSection")}</label>
              <Select
                value={selectedSection}
                onValueChange={(val) => {
                  setSelectedSection(val);
                  setSelectedLine("ALL");
                  setSelectedSubSection("ALL");
                }}
                disabled={(!isAuthorizedToAccessAll && assignedSections.length === 1) || (selectedDepartment === "ALL" && assignedDepartments.length !== 1)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={selectedDepartment === "ALL" ? t("testPaper.phSelectDeptFirst") : t("testPaper.phSelectSection")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("testPaper.optAllSections")}</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec.id} value={String(sec.id)}>
                      {sec.name} ({sec.category})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblLine")}</label>
              <Select
                value={selectedLine}
                onValueChange={(val) => {
                  setSelectedLine(val);
                  setSelectedSubSection("ALL");
                }}
                disabled={(!isAuthorizedToAccessAll && assignedLines.length === 1) || (selectedSection === "ALL" && selectedDepartment === "ALL")}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={
                    selectedSection === "ALL" && selectedDepartment === "ALL"
                      ? t("testPaper.phSelectSecFirst")
                      : t("testPaper.phSelectLine")
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("testPaper.optAllLines")}</SelectItem>
                  {lines.map((line) => (
                    <SelectItem key={line.id || line._id} value={String(line.id || line._id)}>
                      {line.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblSubSection")}</label>
              <Select
                value={selectedSubSection}
                onValueChange={setSelectedSubSection}
                disabled={(!isAuthorizedToAccessAll && assignedSubSections.length === 1) || (selectedLine === "ALL" && selectedSection === "ALL")}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={
                    selectedLine === "ALL" && selectedSection === "ALL"
                      ? t("testPaper.phSelectLineFirst")
                      : t("testPaper.phSelectSubSec")
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("testPaper.optAllSubSecs")}</SelectItem>
                  {filteredSubSections.map((subSec) => (
                    <SelectItem key={subSec.id || subSec._id} value={String(subSec.id || subSec._id)}>
                      {subSec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblLevel")}</label>
              <Select
                value={selectedLevel}
                onValueChange={setSelectedLevel}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t("testPaper.phSelectLevel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("testPaper.optAllLevels")}</SelectItem>
                  <SelectItem value="L0">L0 (Dojo User)</SelectItem>
                  {activeLevels.map((lvl) => (
                    <SelectItem key={lvl.name} value={lvl.name}>
                      {lvl.name} {lvl.description ? `- ${lvl.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblTestType")}</label>
              <Select
                value={selectedTestType}
                onValueChange={setSelectedTestType}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={t("testPaper.phSelectType")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t("testPaper.optAllTypes")}</SelectItem>
                  <SelectItem value="dojo">{t("testPaper.badge.dojoHiring")}</SelectItem>
                  <SelectItem value="theoretical">{t("testPaper.badge.theoretical")}</SelectItem>
                  <SelectItem value="multiskilling">{t("testPaper.badge.multiSkilling")}</SelectItem>
                  <SelectItem value="practical">{t("testPaper.badge.practical")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("testPaper.lblSearch")}</label>
              <div className="relative">
                <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("testPaper.phSearch")}
                  className="pl-9 bg-background"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-end">
              <Button variant="ghost" onClick={handleReset} className="w-full text-muted-foreground hover:bg-slate-100">
                {t("testPaper.btnReset")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold">{t("testPaper.table.title")}</TableHead>
                <TableHead className="font-semibold">{t("testPaper.table.targetSubSec")}</TableHead>
                <TableHead className="font-semibold">{t("testPaper.table.testType")}</TableHead>
                <TableHead className="font-semibold">{t("testPaper.table.courseModule")}</TableHead>
                <TableHead className="font-semibold">{t("testPaper.table.passingCriteria")}</TableHead>
                <TableHead className="font-semibold">{t("testPaper.table.totalMarks")}</TableHead>
                <TableHead className="font-semibold text-right">{t("testPaper.table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizzesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto rounded-md" /></TableCell>
                  </TableRow>
                ))
              ) : quizzes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <IconFileText className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-lg font-medium">{t("testPaper.noTestPapersFound")}</p>
                      <p className="text-sm">{t("testPaper.adjustFilters")}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                quizzes.map((quiz) => {
                  const totalMarks = quiz.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;
                  const passingMarks = Math.ceil((totalMarks * (quiz.passingScore || 70)) / 100);

                  return (
                    <TableRow key={quiz._id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="align-middle">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground group-hover:text-primary transition-colors">
                            {quiz.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {quiz.questions?.length || 0} {t("testPaper.questionsShort")} • {quiz.timeLimit || 0} {t("testPaper.minsShort")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1 max-w-[200px]">
                          {(() => {
                            const quizSubSections = (quiz.subSectionId || [])
                              .map(id => subSections.find(s => String(s.id) === String(id))?.name)
                              .filter(Boolean);

                            if (quizSubSections.length > 0) {
                              return (
                                <div className="flex flex-wrap gap-1">
                                  {quizSubSections.map((name, index) => (
                                    <Badge key={index} variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] py-0 px-1 font-semibold truncate max-w-[120px]">
                                      {name}
                                    </Badge>
                                  ))}
                                </div>
                              );
                            }
                            return <span className="text-xs text-muted-foreground italic">{t("testPaper.noTarget")}</span>;
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-wrap gap-1">
                          {quiz.isDojo && (
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100/50 text-[10px] font-semibold tracking-wider">
                              {t("testPaper.badge.dojoHiring")}
                            </Badge>
                          )}
                          {quiz.isTheoretical && (
                            <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100/50 text-[10px] font-semibold tracking-wider">
                              {t("testPaper.badge.theoretical")}
                            </Badge>
                          )}
                          {quiz.isMultiSkilling && (
                            <Badge className="bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100/50 text-[10px] font-semibold tracking-wider">
                              {t("testPaper.badge.multiSkilling")}
                            </Badge>
                          )}
                          {!quiz.isDojo && !quiz.isTheoretical && !quiz.isMultiSkilling && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-semibold tracking-wider">
                              {t("testPaper.badge.practical")}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1">
                          <Badge variant="outline" className="w-fit font-normal text-[10px] uppercase tracking-wider">
                            {quiz.course?.title || t("testPaper.noCourse")}
                          </Badge>
                          {quiz.module && (
                            <span className="text-xs text-muted-foreground italic">
                              {quiz.module.title}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <IconClock size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-700">{quiz.passingScore}% ({passingMarks} {t("testPaper.marks")})</span>
                          </div>
                          {quiz.issueCertificate && (
                            <div className="flex items-center gap-1.5 text-green-600 font-medium">
                              <IconCertificate size={14} />
                              <span>{t("testPaper.certificate")}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-middle">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-foreground text-sm">
                            {totalMarks} {t("testPaper.marks")}
                          </span>
                          {quiz.level && (
                            <Badge variant="outline" className="w-fit bg-teal-50 text-teal-700 border-teal-200 uppercase font-semibold text-[10px] tracking-wider py-0 px-1.5">
                              {quiz.level}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              const base = "/" + (window.location.pathname.split('/')[1] || "admin");
                              const quizPath = base === "/student" ? "quiz" : "take-test";
                              navigate(`${base}/${quizPath}/${quiz._id}`, {
                                state: { from: window.location.pathname + window.location.search }
                              });
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all"
                          >
                            <IconPlayerPlay className="h-4 w-4" />
                            <span className="ml-2 font-semibold">{t("testPaper.btnTakeTest")}</span>
                          </Button>

                          {canEdit && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const base = "/" + (window.location.pathname.split('/')[1] || "admin");
                                navigate(`${base}/edit-test-paper/${quiz._id}`);
                              }}
                              className="border-slate-200 hover:bg-slate-50 text-slate-700"
                              title={t("testPaper.tooltip.edit")}
                            >
                              <IconEdit className="h-4 w-4 mr-1.5" />
                              {t("testPaper.btnEdit")}
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(quiz._id)}
                              className="border-red-200 hover:bg-red-50 text-red-600 hover:text-red-700"
                              title={t("testPaper.tooltip.delete")}
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
      </TabsContent>

      <TabsContent value="testMonitoring">
        <AdminQuizMonitoring isDojo={forceDojo} />
      </TabsContent>

      <TabsContent value="certificateTemplates">
        <CertificateTemplates />
      </TabsContent>
    </Tabs>
  );
};

// Helper for class names
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

export default TestPaper;
