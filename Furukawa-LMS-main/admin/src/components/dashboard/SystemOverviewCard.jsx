import React, { useMemo } from 'react';
import { useGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import { useGetCoursesQuery } from '@/Redux/AllApi/CourseApi';
import { useGetAllAuditsQuery } from '@/Redux/AllApi/AuditApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { IconClipboardCheck } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";

// Queries here mirror the ones the top stat cards already trigger on mount,
// so RTK Query serves this card from cache instead of firing new requests.
const SystemOverviewCard = () => {
  const { t } = useTranslate();

  const { data: studentsData } = useGetAllStudentsQuery();
  const { data: departmentsData } = useGetAllDepartmentsQuery();
  const { data: coursesData } = useGetCoursesQuery({
    page: 1,
    limit: 1000,
    search: "",
    category: ""
  });
  const { data: auditsData } = useGetAllAuditsQuery({ page: 1, limit: 10 });

  const activeStudents = useMemo(() => {
    if (!studentsData?.data?.users) return 0;
    return studentsData.data.users.filter(student => student.status === 'ACTIVE').length;
  }, [studentsData]);

  const activeDepartments = useMemo(() => {
    if (!departmentsData?.data?.departments) return 0;
    return departmentsData.data.departments.filter(department => department.status === 'COMPLETED').length;
  }, [departmentsData]);

  const publishedCourses = useMemo(() => {
    if (!coursesData?.data?.courses) return 0;
    return coursesData.data.courses.length;
  }, [coursesData]);

  const recentActivitiesCount = auditsData?.data?.audits?.length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconClipboardCheck className="h-5 w-5" />
          {t('home.systemOverview')}
        </CardTitle>
        <CardDescription>{t('home.kpi')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">{activeStudents}</div>
            <div className="text-sm text-gray-500">{t('home.activeOperators')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-blue-600">{activeDepartments}</div>
            <div className="text-sm text-gray-500">{t('home.runningDepartments')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-purple-600">{publishedCourses}</div>
            <div className="text-sm text-gray-500">{t('home.publishedCourses')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{recentActivitiesCount}</div>
            <div className="text-sm text-gray-500">{t('home.recentActivities')}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SystemOverviewCard;
