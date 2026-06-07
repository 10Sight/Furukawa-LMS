import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Users,
  Lock,
  Unlock,
  Shield,
  Trophy,
  AlertCircle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import axiosInstance from "@/Helper/axiosInstance";
import { useGetAllDepartmentsQuery, useGetDepartmentProgressQuery } from "@/Redux/AllApi/DepartmentApi";
import { useGetSectionsByDepartmentQuery } from "@/Redux/AllApi/SectionApi";
import { useGetLinesBySectionQuery } from "@/Redux/AllApi/LineApi";
import { useGetSubSectionsByLineQuery } from "@/Redux/AllApi/SubSectionApi";
import { useGetMachinesBySubSectionQuery } from "@/Redux/AllApi/MachineApi";
import { useGetActiveConfigQuery } from "@/Redux/AllApi/CourseLevelConfigApi";

const StudentLevelManager = () => {
  const [students, setStudents] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState(() => {
    try {
      return localStorage.getItem("selectedDepartmentId") || "";
    } catch {
      return "";
    }
  });
  const [selectedSection, setSelectedSection] = useState("");
  const [selectedLine, setSelectedLine] = useState("");
  const [selectedSubSection, setSelectedSubSection] = useState("");
  const [selectedStation, setSelectedStation] = useState("");

  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState({});

  // Fetch all departments using RTK Query
  const { data: departmentsData, isLoading: departmentsLoading } = useGetAllDepartmentsQuery({ limit: 100 });
  const departments = departmentsData?.data?.departments || [];

  // Fetch active level configuration
  const { data: levelConfigData, isLoading: configLoading } = useGetActiveConfigQuery();
  const levelConfig = levelConfigData?.data;
  // Fallback to empty array if not loaded, to prevent invalid options
  const availableLevels = levelConfig?.levels || [];

  // Get course ID from selected department
  const selectedDepartmentData = useMemo(() => {
    return departments.find(dept => 
      String(dept?._id || dept?.id) === String(selectedDepartment)
    );
  }, [departments, selectedDepartment]);

  const courseId = useMemo(() => {
    if (!selectedDepartmentData) return null;
    return (
      selectedDepartmentData.course?._id || 
      selectedDepartmentData.course?.id || 
      selectedDepartmentData.courseId || 
      selectedDepartmentData.course
    );
  }, [selectedDepartmentData]);

  // Auto-select first department if none selected or invalid selection
  useEffect(() => {
    if (!departmentsLoading && departments.length > 0) {
      const isValidSelection = departments.some(dept => String(dept?._id || dept?.id) === String(selectedDepartment));

      if (!selectedDepartment || !isValidSelection) {
        const firstDepartment = departments[0];
        const firstId = String(firstDepartment?._id || firstDepartment?.id || "");
        setSelectedDepartment(firstId);
        try { localStorage.setItem("selectedDepartmentId", firstId); } catch { }
      }
    }
  }, [departments, selectedDepartment, departmentsLoading]);

  // Hierarchy data fetching
  const { data: sectionsData, isLoading: sectionsLoading } = useGetSectionsByDepartmentQuery(selectedDepartment, { skip: !selectedDepartment });
  const { data: linesData, isLoading: linesLoading } = useGetLinesBySectionQuery(selectedSection, { skip: !selectedSection });
  const { data: subSectionsData, isLoading: subSectionsLoading } = useGetSubSectionsByLineQuery(selectedLine, { skip: !selectedLine });
  const { data: stationsData, isLoading: stationsLoading } = useGetMachinesBySubSectionQuery(selectedSubSection, { skip: !selectedSubSection });

  const sections = sectionsData?.data || [];
  const lines = linesData?.data || [];
  const subSections = subSectionsData?.data || [];
  const stations = stationsData?.data || [];

  // Fetch department progress using RTK Query with all hierarchy filters
  const { data: departmentProgressData, isLoading: progressLoading, refetch: refetchProgress } = useGetDepartmentProgressQuery(
    { 
      departmentId: selectedDepartment,
      sectionId: selectedSection && selectedSection !== "all_sections" ? selectedSection : undefined,
      lineId: selectedLine && selectedLine !== "all_lines" ? selectedLine : undefined,
      subSectionId: selectedSubSection && selectedSubSection !== "all_subsections" ? selectedSubSection : undefined,
      stationId: selectedStation && selectedStation !== "all_stations" ? selectedStation : undefined
    },
    { skip: !selectedDepartment }
  );

  // Update students when department progress data changes
  useEffect(() => {
    if (departmentProgressData?.data?.departmentProgress && Array.isArray(departmentProgressData.data.departmentProgress)) {
      const progressData = departmentProgressData.data.departmentProgress;

      // Transform progress data to include student info with actual level data from API
      const studentsWithProgress = progressData.map(progress => ({
        id: progress.student?._id || progress.student?.id,
        name: progress.student?.fullName || progress.student?.name || "Unknown",
        email: progress.student?.email || "No email",
        currentLevel: progress.currentLevel || "L1",
        levelLockEnabled: progress.levelLockEnabled || false,
        lockedLevel: progress.lockedLevel || null,
        progressPercent: progress.progressPercentage || 0,
        completedModules: progress.completedModules || 0,
        lastAccessed: progress.lastActivity,
        courseId: progress.courseId,
        courseTitle: progress.courseTitle,
        primaryLevel: progress.student?.primaryLevel,
        primaryStation: progress.student?.primaryStation
      }));

      setStudents(studentsWithProgress);
    } else if (selectedDepartment && !progressLoading) {
      setStudents([]);
    }
  }, [departmentProgressData, selectedDepartment, progressLoading, selectedDepartmentData]);

  // Handle hierarchy changes
  const handleDepartmentChange = (departmentId) => {
    setSelectedDepartment(departmentId);
    setSelectedSection("");
    setSelectedLine("");
    setSelectedSubSection("");
    setSelectedStation("");
    try { localStorage.setItem("selectedDepartmentId", departmentId || ""); } catch { }
  };

  const handleSectionChange = (sectionId) => {
    setSelectedSection(sectionId);
    setSelectedLine("");
    setSelectedSubSection("");
    setSelectedStation("");
  };

  const handleLineChange = (lineId) => {
    setSelectedLine(lineId);
    setSelectedSubSection("");
    setSelectedStation("");
  };

  const handleSubSectionChange = (subSectionId) => {
    setSelectedSubSection(subSectionId);
    setSelectedStation("");
  };

  const handleStationChange = (stationId) => {
    setSelectedStation(stationId);
  };

  // Set student level and lock status
  const handleSetStudentLevel = async (studentId, targetCourseId, level, lock) => {
    const updateKey = `${studentId}-${level}-${lock}`;
    setUpdating(prev => ({ ...prev, [updateKey]: true }));

    const finalCourseId = targetCourseId || courseId;
    
    try {
      const response = await axiosInstance.patch("/api/progress/admin/set-level", {
        studentId,
        courseId: finalCourseId,
        stationId: selectedStation && selectedStation !== "all_stations" ? selectedStation : undefined,
        level,
        lock
      });

      if (response.data.success) {
        toast.success(
          lock
            ? `Operator level locked to ${level}`
            : level
              ? `operator level set to ${level}`
              : "Level lock removed"
        );

        // Update the student in the local state
        setStudents(prev => prev.map(student =>
          student.id === studentId
            ? {
              ...student,
              currentLevel: level || student.currentLevel,
              levelLockEnabled: lock,
              lockedLevel: lock ? (level || student.currentLevel) : null
            }
            : student
        ));
      } else {
        throw new Error(response.data.message || "Failed to update operator level");
      }
    } catch (error) {
      console.error("Error setting operator level:", error);
      const errorMessage = error.response?.data?.message || error.message || "Failed to update operator level";
      toast.error(errorMessage);
    } finally {
      setUpdating(prev => ({ ...prev, [updateKey]: false }));
    }
  };

  // Quick actions
  const handleLockAtCurrentLevel = (student) => {
    handleSetStudentLevel(student.id, student.courseId, student.currentLevel, true);
  };

  const handleUnlockLevel = (student) => {
    handleSetStudentLevel(student.id, student.courseId, student.currentLevel, false);
  };

  const handleSetLevel = (student, level) => {
    handleSetStudentLevel(student.id, student.courseId, level, student.levelLockEnabled);
  };

  const getLevelColor = (levelName) => {
    const level = availableLevels.find(
      l => l.name.toUpperCase() === levelName?.toUpperCase()
    );

    if (!level) return "bg-gray-100 text-gray-800";

    // Convert hex color to tailwind-like classes (simplified)
    // For actual hex colors, we'll use inline styles
    return "";
  };

  const getLevelStyle = (levelName) => {
    const level = availableLevels.find(
      l => l.name.toUpperCase() === levelName?.toUpperCase()
    );

    if (!level) return {};

    return {
      backgroundColor: `${level.color}20`, // 20 is for 12.5% opacity
      color: level.color,
      borderColor: level.color,
    };
  };

  const formatLastAccessed = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            Operator Level Manager
          </CardTitle>
          <CardDescription>
            Control operator level progression and set level locks to prevent automatic promotions. Select a section to manage its operators.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="department-select">Department:</Label>
              <Select value={selectedDepartment} onValueChange={handleDepartmentChange} disabled={departmentsLoading}>
                <SelectTrigger id="department-select">
                  <SelectValue placeholder={departmentsLoading ? "Loading..." : "Choose Department"} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={String(dept?._id || dept?.id)} value={String(dept?._id || dept?.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="section-select">Section:</Label>
              <Select 
                value={selectedSection} 
                onValueChange={handleSectionChange} 
                disabled={!selectedDepartment || sectionsLoading}
              >
                <SelectTrigger id="section-select">
                  <SelectValue placeholder={!selectedDepartment ? "Select Department first" : sectionsLoading ? "Loading..." : "All Sections"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_sections">All Sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.sectionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="line-select">Line:</Label>
              <Select 
                value={selectedLine} 
                onValueChange={handleLineChange} 
                disabled={!selectedSection || selectedSection === "all_sections" || linesLoading}
              >
                <SelectTrigger id="line-select">
                  <SelectValue placeholder={!selectedSection ? "Select Section first" : linesLoading ? "Loading..." : "All Lines"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_lines">All Lines</SelectItem>
                  {lines.map((line) => (
                    <SelectItem key={line.id} value={line.id}>
                      {line.lineName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sub-section-select">Sub-Section:</Label>
              <Select 
                value={selectedSubSection} 
                onValueChange={handleSubSectionChange} 
                disabled={!selectedLine || selectedLine === "all_lines" || subSectionsLoading}
              >
                <SelectTrigger id="sub-section-select">
                  <SelectValue placeholder={!selectedLine ? "Select Line first" : subSectionsLoading ? "Loading..." : "All Sub-Sections"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_subsections">All Sub-Sections</SelectItem>
                  {subSections.map((ss) => (
                    <SelectItem key={ss.id} value={ss.id}>
                      {ss.subSectionName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="station-select">Station:</Label>
              <Select 
                value={selectedStation} 
                onValueChange={handleStationChange} 
                disabled={!selectedSubSection || selectedSubSection === "all_subsections" || stationsLoading}
              >
                <SelectTrigger id="station-select">
                  <SelectValue placeholder={!selectedSubSection ? "Select Sub-Section first" : stationsLoading ? "Loading..." : "All Stations"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_stations">All Stations</SelectItem>
                  {stations.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.stationName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => refetchProgress()}
                disabled={!selectedDepartment || progressLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${progressLoading ? 'animate-spin' : ''}`} />
                Refresh Progress
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Level Lock Info */}
      {selectedDepartment && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Level Lock:</strong> When enabled, prevents automatic level promotions when operators complete modules.
            The operator will remain at the locked level regardless of their progress.
          </AlertDescription>
        </Alert>
      )}

      {/* Students Table */}
      {selectedDepartment && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Operators ({students.length}) - {selectedDepartmentData?.name}
            </CardTitle>
            <CardDescription>
              Manage individual operator levels and lock settings for {selectedDepartmentData?.course?.title || 'this section'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {progressLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                Loading operators...
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No operators enrolled in this section
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operator</TableHead>
                    <TableHead>Primary Level</TableHead>
                    <TableHead>Station Skill</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Lock Status</TableHead>
                    <TableHead>Last Accessed</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student, idx) => (
                    <TableRow key={`${student.id}-${student.courseId || idx}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium text-blue-600">{student.courseTitle}</div>
                          <div className="font-medium">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.email}</div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge
                            className="border w-fit"
                            style={getLevelStyle(student.primaryLevel)}
                            variant="outline"
                          >
                            {student.primaryLevel || "L1"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                            {student.primaryStation || "No Station"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge
                          className="border"
                          style={getLevelStyle(student.currentLevel)}
                          variant={availableLevels.some(l => l.name === student.currentLevel) ? "outline" : "destructive"}
                        >
                          {student.currentLevel}
                          {!availableLevels.some(l => l.name === student.currentLevel) && " (Invalid)"}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">{student.progressPercent}% complete</div>
                          <div className="text-xs text-muted-foreground">
                            {student.completedModules} modules completed
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {student.levelLockEnabled ? (
                            <Badge variant="destructive" className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Locked at {student.lockedLevel}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Unlock className="h-3 w-3" />
                              Unlocked
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="text-sm">{formatLastAccessed(student.lastAccessed)}</div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          {/* Level Selection */}
                          <Select
                            value={student.currentLevel}
                            onValueChange={(level) => handleSetLevel(student, level)}
                            disabled={updating[`${student.id}-${student.currentLevel}-${student.levelLockEnabled}`]}
                          >
                            <SelectTrigger className="w-24">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableLevels.map((level) => (
                                <SelectItem key={level.name} value={level.name}>
                                  {level.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          {/* Lock/Unlock Toggle */}
                          {student.levelLockEnabled ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUnlockLevel(student)}
                              disabled={
                                updating[`${student.id}-${student.currentLevel}-false`] ||
                                !availableLevels.some(l => l.name === student.currentLevel)
                              }
                              title={!availableLevels.some(l => l.name === student.currentLevel) ? "Cannot unlock invalid level. Please change level first." : "Unlock level"}
                            >
                              {updating[`${student.id}-${student.currentLevel}-false`] ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Unlock className={`h-4 w-4 ${!availableLevels.some(l => l.name === student.currentLevel) ? "text-gray-300" : ""}`} />
                              )}
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleLockAtCurrentLevel(student)}
                              disabled={
                                updating[`${student.id}-${student.currentLevel}-true`] ||
                                !availableLevels.some(l => l.name === student.currentLevel)
                              }
                              title={!availableLevels.some(l => l.name === student.currentLevel) ? "Cannot lock invalid level. Please change level first." : "Lock at current level"}
                            >
                              {updating[`${student.id}-${student.currentLevel}-true`] ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Lock className={`h-4 w-4 ${!availableLevels.some(l => l.name === student.currentLevel) ? "text-gray-300" : ""}`} />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentLevelManager;
