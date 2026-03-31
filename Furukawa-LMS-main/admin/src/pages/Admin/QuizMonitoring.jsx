import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AttemptReviewModal from "@/components/common/AttemptReviewModal";
import { useGetCoursesQuery } from "@/Redux/AllApi/CourseApi";
import { useGetQuizzesByCourseQuery } from "@/Redux/AllApi/QuizApi";
import { useGetAttemptsQuizQuery } from "@/Redux/AllApi/AttemptedQuizApi";
import { IconClipboardList, IconEye, IconRefresh, IconSearch } from "@tabler/icons-react";

const AdminQuizMonitoring = () => {
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedQuizId, setSelectedQuizId] = useState("");
  const [search, setSearch] = useState("");
  const [viewAttemptId, setViewAttemptId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: coursesData, isLoading: coursesLoading } = useGetCoursesQuery({ page: 1, limit: 100 });
  const courses = Array.isArray(coursesData?.data)
    ? coursesData?.data
    : Array.isArray(coursesData?.data?.courses)
    ? coursesData.data.courses
    : Array.isArray(coursesData?.data?.docs)
    ? coursesData.data.docs
    : [];

  const { data: quizzesData, isLoading: quizzesLoading } = useGetQuizzesByCourseQuery(selectedCourseId, { skip: !selectedCourseId });
  const quizzes = quizzesData?.data || [];

  const { data: attemptsData, isLoading: attemptsLoading, refetch } = useGetAttemptsQuizQuery(selectedQuizId, { skip: !selectedQuizId });
  const attempts = attemptsData?.data || [];

  const filteredAttempts = useMemo(() => {
    if (!search) return attempts;
    const q = search.toLowerCase();
    return attempts.filter((a) =>
      (a.student?.fullName || "").toLowerCase().includes(q) ||
      (a.student?.email || "").toLowerCase().includes(q)
    );
  }, [attempts, search]);

  const totalScoreFor = (attempt) => {
    const totalMarks = attempt.quiz?.questions?.reduce((sum, q) => sum + (q.marks || 1), 0) || 0;
    return totalMarks;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Test Monitoring</h1>
          <p className="text-muted-foreground text-sm">Review and adjust test attempts across all courses</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch?.()} disabled={!selectedQuizId}>
          <IconRefresh className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select a course and test to view attempts</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-600">Course</label>
            <Select value={selectedCourseId} onValueChange={(v) => { setSelectedCourseId(v); setSelectedQuizId(""); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={coursesLoading ? "Loading..." : "Select course"} />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c._id || c.id} value={c._id || c.id}>
                    {c.title || c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Quiz</label>
            <Select value={selectedQuizId} onValueChange={setSelectedQuizId} disabled={!selectedCourseId || quizzesLoading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={!selectedCourseId ? "Select course first" : quizzesLoading ? "Loading..." : "Select quiz"} />
              </SelectTrigger>
              <SelectContent>
                {quizzes.map((qz) => (
                  <SelectItem key={qz._id || qz.id} value={qz._id || qz.id}>
                    {qz.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Search student</label>
            <div className="flex gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or email" />
              <Button variant="secondary" size="icon"><IconSearch className="h-4 w-4" /></Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Attempts</CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedQuizId ? (
            <div className="text-center py-12">
              <IconClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select a course and test to view attempts.</p>
            </div>
          ) : attemptsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 animate-pulse rounded" />
              ))}
            </div>
          ) : filteredAttempts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attempted</TableHead>
                  <TableHead>Time Taken</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.map((attempt) => (
                  <TableRow key={attempt._id}>
                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium">{attempt.student?.fullName}</div>
                        <div className="text-xs text-muted-foreground">{attempt.student?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{attempt.score}/{totalScoreFor(attempt)}</span>
                        <span className="text-xs text-muted-foreground">
                          ({totalScoreFor(attempt) > 0 ? Math.round((attempt.score / totalScoreFor(attempt)) * 100) : 0}%)
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={attempt.status === 'PASSED' ? 'success' : 'destructive'}>{attempt.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(attempt.createdAt || attempt.completedAt).toLocaleString()}</TableCell>
                    <TableCell>{attempt.timeTaken ? `${Math.round(attempt.timeTaken / 60)} min` : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => { setViewAttemptId(attempt._id); setModalOpen(true); }}>
                        <IconEye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <IconClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No attempts found for this quiz.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admin can edit attempts */}
      <AttemptReviewModal attemptId={viewAttemptId} isOpen={modalOpen} onClose={() => setModalOpen(false)} canEdit={true} />
    </div>
  );
};

export default AdminQuizMonitoring;
