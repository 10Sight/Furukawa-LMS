import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { IconClock } from "@tabler/icons-react";
import { useGetAllDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi';
import LazyContainer from "@/components/common/LazyContainer";
import useTranslate from "@/hooks/useTranslate";
import DepartmentQuizChart from "@/components/charts/DepartmentQuizChart";
import DojoHiringTrendChart from "@/components/charts/DojoHiringTrendChart";
import LeftUsersLeavingReasonChart from "@/components/charts/LeftUsersLeavingReasonChart";
import TestPaperPassChart from "@/components/charts/TestPaperPassChart";
import EfficiencyChart from "@/components/charts/EfficiencyChart";
import DojoHandoverComparisonChart from "@/components/charts/DojoHandoverComparisonChart";
import SixteenDayMonitoringComparisonChart from "@/components/charts/SixteenDayMonitoringComparisonChart";
import ThreeDayMonitoringComparisonChart from "@/components/charts/ThreeDayMonitoringComparisonChart";
import Cycle10ComparisonChart from "@/components/charts/Cycle10ComparisonChart";
import SkillMatrixCertificateComparisonChart from "@/components/charts/SkillMatrixCertificateComparisonChart";
import OperatorObservanceComparisonChart from "@/components/charts/OperatorObservanceComparisonChart";
import OnJobTrainingApprovedComparisonChart from "@/components/charts/OnJobTrainingApprovedComparisonChart";
import ContractorWiseOperatorChart from "@/components/charts/ContractorWiseOperatorChart";
import SkillUpgradationPlanComparisonChart from "@/components/charts/SkillUpgradationPlanComparisonChart";
import MultiSkillingPlanComparisonChart from "@/components/charts/MultiSkillingPlanComparisonChart";
import { useLogActionMutation } from '@/Redux/AllApi/AuditApi';
import { useIsTablet, useIsMobile } from "@/hooks/useIsTablet";

const DashboardClock = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-2 text-right">
      <IconClock className="h-4 w-4 text-gray-400 shrink-0" />
      <div>
        <div className="text-sm font-bold text-gray-800 tabular-nums">{format(now, 'hh:mm:ss a')}</div>
        <div className="text-xs text-gray-500">{format(now, 'EEEE, dd MMM yyyy')}</div>
      </div>
    </div>
  );
};

const Home = () => {
  const { t } = useTranslate();
  const isTablet = useIsTablet();
  const isMobile = useIsMobile();
  const [logAction] = useLogActionMutation();

  useEffect(() => {
    logAction({ action: "VIEW_DASHBOARD", details: { page: "Admin Home" } })
      .unwrap()
      .catch((err) => console.error("Failed to log page view:", err));
  }, [logAction]);

  // Shared across every chart below for department selection/metadata.
  const { data: departmentsData, isLoading: departmentsLoading } = useGetAllDepartmentsQuery();
  const departments = departmentsData?.data?.departments || [];

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-center gap-3">
          <img src="/fme_transparent.png" alt="FME" className="h-10 w-10 object-contain shrink-0" />
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{t('home.dashboardTitle')}</h1>
            <p className="text-xs text-gray-500">{t('home.dashboardSubtitle')}</p>
          </div>
        </div>
        <DashboardClock />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 gap-6">
        <LazyContainer minHeight={isTablet ? 600 : isMobile ? 420 : 460}>
          <DojoHiringTrendChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 600 : isMobile ? 420 : 460}>
          <LeftUsersLeavingReasonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <DojoHandoverComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <SixteenDayMonitoringComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <ThreeDayMonitoringComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <Cycle10ComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <SkillMatrixCertificateComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <OperatorObservanceComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <OnJobTrainingApprovedComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <SkillUpgradationPlanComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <MultiSkillingPlanComparisonChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <ContractorWiseOperatorChart />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 500}>
          <TestPaperPassChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={isTablet ? 580 : isMobile ? 560 : 640}>
          <DepartmentQuizChart departments={departments} departmentsLoading={departmentsLoading} />
        </LazyContainer>
        <LazyContainer minHeight={600}>
          <EfficiencyChart />
        </LazyContainer>
      </div>
    </div>
  );
};

export default Home;
