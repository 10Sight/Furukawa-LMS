import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import axiosInstance from "@/Helper/axiosInstance";
import AccountStatusWrapper from "../../components/student/AccountStatusWrapper";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar, Users, BookOpen, Clock, AlertCircle, ArrowRight, ExternalLink, Target, Award, MapPin, BarChart3 } from "lucide-react";

const StudentDepartment = () => {
  const { isLoading: authLoading } = useSelector((state) => state.auth);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyDepartments = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get("/api/departments/me/my-departments");
        const data = res?.data?.data;
        const list = Array.isArray(data?.departments)
          ? data.departments
          : Array.isArray(data)
            ? data
            : [];
        setDepartments(list);
        setError(null);
      } catch (e) {
        setError("Failed to load department information. Please try again later.");
      } finally {
        setLoading(false);
      }
    };
    fetchMyDepartments();
  }, []);

  const getStatusVariant = (status) => {
    switch (status?.toUpperCase()) {
      case "ACTIVE":
        return "default";
      case "COMPLETED":
        return "secondary";
      case "UPCOMING":
        return "outline";
      case "CANCELLED":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateProgress = (department) => {
    if (!department?.startDate || !department?.endDate) return 0;

    const start = new Date(department.startDate);
    const end = new Date(department.endDate);
    const today = new Date();

    if (today >= end) return 100;
    if (today <= start) return 0;

    const totalDuration = end - start;
    const elapsed = today - start;
    return Math.round((elapsed / totalDuration) * 100);
  };

  const handleDepartmentClick = () => {
    navigate('/student/course');
  };

  const handleViewDetails = (e) => {
    e.stopPropagation();
    navigate('/student/course');
  };

  const handleQuickActions = (action, e) => {
    e.stopPropagation();
    navigate('/student/course');
  };

  if (loading || authLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="w-full">
          <CardHeader className="space-y-3">
            <Skeleton className="h-6 sm:h-8 w-48 sm:w-64" />
            <Skeleton className="h-3 sm:h-4 w-32 sm:w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  const normalizedDepartments = Array.isArray(departments) ? departments : [];

  if (!normalizedDepartments || normalizedDepartments.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card className="w-full border-dashed">
          <CardContent className="p-6 sm:p-8 text-center">
            <div className="relative mb-6">
              <Users className="h-16 w-16 sm:h-20 sm:w-20 text-muted-foreground mx-auto mb-4 opacity-50" />
              <div className="absolute inset-0 bg-gray-200 rounded-full blur-xl opacity-30"></div>
            </div>
            <h3 className="text-lg sm:text-xl font-bold mb-2 text-gray-900">No Section Assigned</h3>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              You are not currently assigned to any section. Please contact your administrator for course enrollment assistance.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-sm mx-auto">
              <Button
                onClick={() => navigate('/student/course')}
                variant="outline"
                className="flex-1"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Browse Courses</span>
                <span className="sm:hidden">Courses</span>
              </Button>
              <Button
                onClick={() => navigate('/student')}
                className="flex-1"
              >
                <Target className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AccountStatusWrapper allowPending={false}>
      <div className="space-y-4 sm:space-y-6">
        {normalizedDepartments.map((department) => {
          const progress = calculateProgress(department);
          const key = department._id || department.id || department.name;

          return (
            <Card
              key={key}
              className="w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-blue-200 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group overflow-hidden"
              onClick={handleDepartmentClick}
            >
              <CardHeader className="pb-4 relative">
                {/* Background decoration */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-200/30 to-transparent rounded-bl-full transform translate-x-8 -translate-y-8"></div>

                <div className="relative flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg sm:text-xl lg:text-2xl flex items-center gap-2 group-hover:text-blue-700 transition-colors leading-tight">
                      <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors duration-300">
                        <Users className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 group-hover:scale-110 transition-transform duration-300" />
                      </div>
                      <span className="break-words font-bold">{department.name}</span>
                      <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-1" />
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base mt-2 text-blue-700">
                      Your current learning program details
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    <Badge
                      variant={getStatusVariant(department.status)}
                      className={`text-xs sm:text-sm px-3 py-1.5 font-medium rounded-full ${department.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800 border-green-300'
                        : department.status === 'COMPLETED'
                          ? 'bg-gray-100 text-gray-800 border-gray-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300'
                        }`}
                    >
                      {department.status}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewDetails}
                      className="flex items-center gap-1 text-xs sm:text-sm bg-white/80 backdrop-blur-sm border-blue-200 hover:bg-blue-50 sm:opacity-0 group-hover:opacity-100 transition-all duration-300"
                    >
                      <span className="hidden sm:inline">View Course</span>
                      <span className="sm:hidden">View</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="relative space-y-6">
                {/* Info Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <BookOpen className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-blue-700 uppercase tracking-wide">Course</p>
                        <p className="font-bold text-sm sm:text-base text-gray-900 break-words leading-tight mt-1">
                          {department.course?.title || department.course?.name || department.courses?.[0]?.title || department.courses?.[0]?.name || "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <Calendar className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-green-700 uppercase tracking-wide">Start Date</p>
                        <p className="font-bold text-sm sm:text-base text-gray-900 break-words leading-tight mt-1">
                          {department.startDate ? formatDate(department.startDate) : "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <Clock className="h-4 w-4 text-red-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-red-700 uppercase tracking-wide">End Date</p>
                        <p className="font-bold text-sm sm:text-base text-gray-900 break-words leading-tight mt-1">
                          {department.endDate ? formatDate(department.endDate) : "Not specified"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 p-3 sm:p-4 bg-white/60 backdrop-blur-sm rounded-lg border border-white/50">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <MapPin className="h-4 w-4 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-purple-700 uppercase tracking-wide">Department ID</p>
                        <p className="font-mono font-bold text-sm break-all text-gray-900 mt-1">{department.name}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress Section */}
                {(department.startDate && department.endDate) && (
                  <div className="p-4 sm:p-6 bg-white/80 backdrop-blur-sm rounded-lg border border-white/50 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-600" />
                        <span className="font-bold text-sm sm:text-base text-gray-900">Department Progress</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl sm:text-2xl font-bold text-blue-600">{progress}%</span>
                        <div className="p-1 bg-blue-100 rounded-full">
                          <Award className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                        </div>
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>Started: {department.startDate ? formatDate(department.startDate) : 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span>Ends: {department.endDate ? formatDate(department.endDate) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    onClick={handleDepartmentClick}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
                    size="lg"
                  >
                    <BookOpen className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Continue Learning</span>
                    <span className="sm:hidden">Continue Course</span>
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>


                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </AccountStatusWrapper>
  );
};

export default StudentDepartment;
