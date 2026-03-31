import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { useSelector } from 'react-redux'
import { useGetStudentCertificatesQuery } from '@/Redux/AllApi/CertificateApi'
import { useGetMyDepartmentsQuery } from '@/Redux/AllApi/DepartmentApi'
import { useGetUserProfileQuery } from '@/Redux/AllApi/AuthApi'
import { useGetActiveConfigQuery } from '@/Redux/AllApi/CourseLevelConfigApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Award,
  Download,
  Eye,
  Calendar,
  GraduationCap,
  FileText,
  Printer
} from 'lucide-react'
import { toast } from 'sonner'
import { getMediaUrl } from '@/utils/mediaUtils'

const Certificates = () => {
  const [selectedCertificate, setSelectedCertificate] = useState(null)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)

  const { user } = useSelector((state) => state.auth)
  const { data: userProfileData } = useGetUserProfileQuery()
  const { data: deptData } = useGetMyDepartmentsQuery()
  const { data: activeConfigData } = useGetActiveConfigQuery() // Fetch active course levels
  const { data, isLoading, error } = useGetStudentCertificatesQuery()

  const certificates = data?.data || []
  const activeConfig = activeConfigData?.data;

  // Get current user details for preview - prioritize fresh profile fetch
  // userProfileData structure is { success, data: userObject, ... } based on API response
  const liveUser = userProfileData?.data || user;

  const currentEmployeeId = liveUser?.userName || liveUser?.employeeId;
  const currentUserImage = liveUser?.avatar?.url;
  // ... existing department logic ...
  // Enhanced Department Resolution
  // Prioritize: 1. Dept from API (My Depts) 2. User Profile Dept (if populated obj) 3. User Profile Dept Name (string)
  const myDeptName = deptData?.data?.departments?.[0]?.name;
  const userProfileDept = liveUser?.department?.name || (typeof liveUser?.department === 'string' ? liveUser?.department : null);
  const currentDepartmentName = myDeptName || userProfileDept;

  const formatDate = (dateString) => {
    if (!dateString) return '' // Return empty string instead of N/A for cleaner fallback
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getGradeBadgeColor = (grade) => {
    if (!grade) return 'bg-gray-100 text-gray-800';

    switch (grade.toString().toUpperCase()) {
      case 'A+':
      case 'A': return 'bg-green-100 text-green-800'
      case 'B+':
      case 'B': return 'bg-blue-100 text-blue-800'
      case 'C+':
      case 'C': return 'bg-yellow-100 text-yellow-800'
      case 'PASS': return 'bg-emerald-100 text-emerald-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleViewCertificate = (certificate) => {
    // Override metadata with current user details if available
    const updatedMetadata = {
      ...certificate.metadata,
      employeeId: currentEmployeeId || certificate.metadata?.employeeId,
      departmentName: currentDepartmentName || certificate.metadata?.departmentName,
      userImage: currentUserImage || certificate.metadata?.userImage
    };

    console.log('Live Data for Preview:', {
      fromRedux: user?.userName,
      fromQuery: userProfileData?.data?.userName,
      currentEmployeeId,
      currentUserImage,
      currentDepartmentName,
      activeLevels: activeConfig?.levels
    });

    let patchedHtml = certificate.metadata?.generatedHTML || '';

    // Standard placeholder replacements using global regex
    // This catches literals like {{employeeId}} commonly found in templates
    if (currentEmployeeId) {
      patchedHtml = patchedHtml.replace(/{{employeeId}}/g, currentEmployeeId);
      patchedHtml = patchedHtml.replace(/{{studentId}}/g, currentEmployeeId); // fallback
    }

    // Level Replacements from Active Config
    if (activeConfig?.levels && Array.isArray(activeConfig.levels)) {
      // 1. Join all levels with <br> for a list view
      const levelNamesList = activeConfig.levels.map(l => l.name).join('<br/>');
      patchedHtml = patchedHtml.replace(/{{levelNames}}/g, levelNamesList);
      patchedHtml = patchedHtml.replace(/{{levels}}/g, levelNamesList);

      // 2a. Dynamic Row Injection (The "Smart Fix")
      // Look for a table row containing {{level1}}
      // Regex failed for user, trying robust substring method
      let matchIndex = patchedHtml.search(/{{\s*level1\s*}}/);

      console.log('Dynamic Row Debug:', {
        hasLevel1: matchIndex !== -1,
        activeLevelCount: activeConfig.levels.length,
        levels: activeConfig.levels
      });

      let rowInjectionSuccess = false;

      if (matchIndex !== -1) {
        // Find the opening <tr before the placeholder (case insensitive search)
        const lowerHtml = patchedHtml.toLowerCase();
        const rowStartIndex = lowerHtml.lastIndexOf('<tr', matchIndex);
        const rowEndIndex = lowerHtml.indexOf('</tr>', matchIndex);

        if (rowStartIndex !== -1 && rowEndIndex !== -1) {
          const fullRowEndIndex = rowEndIndex + 5; // include </tr>
          const rowTemplate = patchedHtml.substring(rowStartIndex, fullRowEndIndex);

          console.log('Row Template Found:', rowTemplate);

          // Generate a big block of HTML for all levels
          const dynamicRows = activeConfig.levels.map((level, index) => {
            let rowHtml = rowTemplate;
            const levelNum = index + 1;

            // 1. Level Name Replacement
            // Handle specific {{level1}} and generic {{levelIndex}}
            // Note: rowTemplate might strictly have {{level1}}, so we replace that specific string.
            // Using case-insensitive global replacement safely.
            const levelNameRegex = new RegExp(`{{\\s*level1\\s*}}`, 'gi');
            rowHtml = rowHtml.replace(levelNameRegex, level.name);
            rowHtml = rowHtml.replace(/{{\s*levelIndex\s*}}/gi, levelNum);

            // 2. Level Date Replacement
            // Search logic with logging
            let dateStr = '-'; // Default to dash instead of empty if not found
            if (certificates && certificates.length > 0) {
              // Try multiple match strategies: exact name, ID, or courseLevelId
              const matchedCert = certificates.find(c => {
                const cLevelName = c.level || '';
                const cLevelId = c.levelId || c.courseLevelId;

                return (cLevelName.toLowerCase() === level.name.toLowerCase()) ||
                  (level._id && cLevelId === level._id);
              });

              if (matchedCert) {
                const d = matchedCert.issueDate || matchedCert.createdAt;
                if (d) {
                  dateStr = new Date(d).toLocaleDateString('en-GB', {
                    day: '2-digit', month: '2-digit', year: 'numeric'
                  });
                }
              }
            }

            // Console log to debug specific row
            // console.log(`Row ${levelNum} (${level.name}): Date = ${dateStr}`);

            // Replace {{level1Date}} or {{levelXDate}} in the template
            // The template likely has {{level1Date}} for the first row
            const dateRegex = new RegExp(`{{\\s*level1Date\\s*}}`, 'gi');
            rowHtml = rowHtml.replace(dateRegex, dateStr);

            // Also support generic {{levelDate}}
            rowHtml = rowHtml.replace(/{{\s*levelDate\\s*}}/gi, dateStr);

            return rowHtml;
          }).join('');

          // Replace the original Row 1 with our new Dynamic Stack
          patchedHtml = patchedHtml.slice(0, rowStartIndex) + dynamicRows + patchedHtml.slice(fullRowEndIndex);

          // cleanup: Remove original hardcoded rows for level2, level3, etc. to avoid duplicates
          // We assume they look similar or just target the placeholders
          // Safer: Find rows containing {{level2}}, {{level3}}... and remove them entirely
          for (let i = 2; i <= 15; i++) { // Increased limit to 15 just in case
            // More robust cleanup regex
            const nextRowPattern = new RegExp(`<tr[^>]*>[\\s\\S]*?{{\\s*level${i}\\s*}}[\\s\\S]*?<\\/tr>`, 'gi');
            patchedHtml = patchedHtml.replace(nextRowPattern, '');
          }
          rowInjectionSuccess = true;
        }
      }

      // --- PIE CHART GENERATION ---
      if (activeConfig.levels.length > 0) {
        const totalLevels = activeConfig.levels.length;
        // Determine current completed level index
        let completedLevelsCount = 0;

        if (certificates && certificates.length > 0) {
          // Count unique levels completed for this course
          // Filter by current course context if possible, or assume 'certificates' list is already filtered or relevant
          const uniqueLevels = new Set();
          certificates.forEach(c => {
            if (c.level) uniqueLevels.add(c.level);
          });
          completedLevelsCount = uniqueLevels.size;

          // If current certificate being viewed is new/preview, potentially add it
          if (certificate.level && !uniqueLevels.has(certificate.level)) {
            completedLevelsCount++;
          }
        } else {
          // Fallback if certificates list is empty but we have current certificate
          if (certificate.level) completedLevelsCount = 1;
        }

        // Clamp
        completedLevelsCount = Math.min(completedLevelsCount, totalLevels);

        // 1. Prepare Conic Gradient CSS (User's preferred "Pizza Slice" look for styles)
        const fillPercentage = Math.round((completedLevelsCount / totalLevels) * 100);
        // Standard Pizza Slice Colors: Orange filled, Gray empty
        const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;

        // 2. Prepare SVG Data URI (For img src)
        const size = 100;
        const center = size / 2;
        const radius = size / 2;
        let paths = [];
        for (let i = 0; i < totalLevels; i++) {
          const startAngle = (i * 360) / totalLevels;
          const endAngle = ((i + 1) * 360) / totalLevels;
          const x1 = center + radius * Math.cos(Math.PI * startAngle / 180);
          const y1 = center + radius * Math.sin(Math.PI * startAngle / 180);
          const x2 = center + radius * Math.cos(Math.PI * endAngle / 180);
          const y2 = center + radius * Math.sin(Math.PI * endAngle / 180);
          const isFilled = i < completedLevelsCount;
          const fillColor = isFilled ? activeConfig.levels[i]?.color || '#F97316' : '#FFFFFF';
          const strokeColor = '#000000';
          const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
          paths.push(`<path d="${d}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1" />`);
        }
        const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
        const svgDataUri = `data:image/svg+xml;base64,${btoa(svgContent)}`;

        // Smart Replacement based on Context
        // Case A: src="{{pieChart}}" -> Use Data URI
        if (patchedHtml.match(/src\s*=\s*['"]{{pieChart}}['"]/i)) {
          patchedHtml = patchedHtml.replace(/src\s*=\s*['"]{{pieChart}}['"]/gi, `src="${svgDataUri}"`);
        }
        // Case B: style="{{pieChart}}" -> Use CSS
        else if (patchedHtml.match(/style\s*=\s*['"][^'"]*{{pieChart}}[^'"]*['"]/i)) {
          patchedHtml = patchedHtml.replace(/{{pieChart}}/gi, pieChartCss);
        }
        // Case C: Just {{pieChart}} (likely expecting CSS or full Element?)
        // If the user saw "border:..." artifacts, it strongly suggests they injected SVG into a style tag.
        // We default to CSS string for safety if ambiguous, because injecting CSS into src breaks less visibly (just empty img) 
        // than injecting SVG into style (breaks layout).
        // BUT, if it's a standalone {{pieChart}}, maybe they want the component?
        // Let's assume generic replacement uses the CSS string to be safe against the "Code text on screen" bug.
        else {
          patchedHtml = patchedHtml.replace(/{{pieChart}}/gi, pieChartCss);
        }
      }

      // Fallback: If dynamic row injection failed (e.g. no <tr> found), just do simple string replacement
      // This ensures at least the text shows up, even if rows aren't duplicated
      if (!rowInjectionSuccess) {
        activeConfig.levels.forEach((level, index) => {
          const placeholder = new RegExp(`{{level${index + 1}}}`, 'gi'); // Case-insensitive
          patchedHtml = patchedHtml.replace(placeholder, level.name);
        });
      }

      // Cleanup unused level placeholders just in case (e.g. if template has {{level5}} but only 4 levels exist)
      // This is a bit aggressive but cleaner than showing {{level5}}
      for (let i = activeConfig.levels.length + 1; i <= 15; i++) { // Increased limit to 15
        const placeholder = new RegExp(`{{level${i}}}`, 'gi'); // Case-insensitive
        patchedHtml = patchedHtml.replace(placeholder, '');
      }
    }

    // Department replacement - ensure we have a value
    const deptToUse = currentDepartmentName || 'Department';
    if (deptToUse) {
      patchedHtml = patchedHtml.replace(/{{departmentName}}/g, deptToUse);
      patchedHtml = patchedHtml.replace(/{{department}}/g, deptToUse);
    }

    if (currentUserImage) {
      const resolvedUserImage = getMediaUrl(currentUserImage);
      patchedHtml = patchedHtml.replace(/{{userImage}}/g, resolvedUserImage);
      patchedHtml = patchedHtml.replace(/{{profileImage}}/g, resolvedUserImage);
    }

    // Date replacements
    // Try multiple sources for start date
    // Fallback to createdAt or issueDate if no explicit start date found to avoid empty placeholders
    // Dynamic Start Date Logic:
    // If this is a sequenced certificate (e.g. Skill Upgradation or Level based),
    // the start date should be the completion date (issueDate) of the PREVIOUS certificate.
    let derivedStartDate = null;

    // Check if we can find a predecessor
    if (certificates && certificates.length > 0) {
      // Filter for relevant certificates (same type or both have levels)
      const peers = certificates.filter(c => {
        // If current has level, match others with level
        if (certificate.level && c.level) return true;
        // If current is SKILL_UPGRADATION, match others
        if (certificate.type === 'SKILL_UPGRADATION' && c.type === 'SKILL_UPGRADATION') return true;
        return false;
      });

      // Sort by issueDate ascending
      peers.sort((a, b) => new Date(a.issueDate) - new Date(b.issueDate));

      const currentIndex = peers.findIndex(c => c._id === certificate._id);
      if (currentIndex > 0) {
        derivedStartDate = peers[currentIndex - 1].issueDate;
      }
    }

    const startDateRaw = derivedStartDate || certificate.startDate || certificate.metadata?.startDate || certificate.course?.startDate || certificate.createdAt;
    const formattedStartDate = formatDate(startDateRaw);

    // Try multiple sources for completion date
    const completionDateRaw = certificate.completionDate || certificate.issueDate || certificate.metadata?.completionDate;
    const formattedCompletionDate = formatDate(completionDateRaw);

    if (formattedStartDate) {
      patchedHtml = patchedHtml.replace(/{{startDate}}/g, formattedStartDate);
    } else {
      // If no date found, remove the placeholder entirely
      patchedHtml = patchedHtml.replace(/{{startDate}}/g, '');
    }

    if (formattedCompletionDate) {
      patchedHtml = patchedHtml.replace(/{{completionDate}}/g, formattedCompletionDate);
      patchedHtml = patchedHtml.replace(/{{endDate}}/g, formattedCompletionDate); // catch common alias
    } else {
      patchedHtml = patchedHtml.replace(/{{completionDate}}/g, '');
      patchedHtml = patchedHtml.replace(/{{endDate}}/g, '');
    }

    // Fallback: If placeholders were already substituted by backend (e.g. with "N/A"), find and replace those values
    if (certificate.metadata) {
      // Replace Department if metadata value differs from live value
      // This fixes the case where backend saved "N/A" and now we have "Assembly"
      if (currentDepartmentName && certificate.metadata.departmentName && certificate.metadata.departmentName !== currentDepartmentName) {
        const safePattern = certificate.metadata.departmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patchedHtml = patchedHtml.replace(new RegExp(safePattern, 'g'), currentDepartmentName);
      }

      // Replace EmployeeID similarly
      if (currentEmployeeId && certificate.metadata.employeeId && certificate.metadata.employeeId !== currentEmployeeId) {
        const safePattern = certificate.metadata.employeeId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        patchedHtml = patchedHtml.replace(new RegExp(safePattern, 'g'), currentEmployeeId);
      }
    }
    if (certificate.metadata) {
      if (currentEmployeeId && certificate.metadata.employeeId && typeof certificate.metadata.employeeId === 'string' && !certificate.metadata.employeeId.includes('{{')) {
        // Only replace if it looks like a value we want to swap out, though direct regex is safer
        // This part is risky if metadata.employeeId is the actual ID, we don't want to replace the ID with itself necessarily, 
        // but if the HTML has the *old* ID and we want the *new* one? 
        // For now, relying on regex placeholders is the primary fix for the reported issue.
      }
    }

    const displayCert = {
      ...certificate,
      metadata: {
        ...updatedMetadata,
        generatedHTML: patchedHtml
      }
    };

    setSelectedCertificate(displayCert)
    setShowPreviewDialog(true)
  }

  const handleDownloadCertificate = (certificate) => {
    // Generate the certificate HTML with styles for download/print
    const certificateData = certificate.metadata || {}
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Certificate - ${certificateData.studentName || 'Hello'}</title>
        <style>
          ${certificateData.styles || ''}
          @media print {
            body { margin: 0; }
            .certificate { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        ${certificateData.generatedHTML || '<p>Certificate content not available</p>'}
      </body>
      </html>
    `

    // Create a blob and download
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `certificate-${certificate.course?.title || 'course'}-${certificate.student?.fullName || 'student'}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Certificate downloaded successfully!')
  }

  const handlePrintCertificate = (certificate) => {
    const certificateData = certificate.metadata || {}
    const printContent = `
      <style>
        ${certificateData.styles || ''}
        @media print {
          body { margin: 0; }
          .certificate { box-shadow: none; }
        }
      </style>
      ${certificateData.generatedHTML || '<p>Certificate content not available</p>'}
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Certificate</title>
      </head>
      <body>
        ${printContent}
      </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <FileText className="h-4 w-4" />
        <AlertDescription>
          Failed to load certificates: {error?.data?.message || 'Unknown error'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
            <Award className="h-8 w-8 text-white" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Certificates</h1>
          <p className="text-lg text-muted-foreground mt-2">
            Your earned course completion certificates
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-lg mr-4">
              <Award className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{certificates.length}</p>
              <p className="text-sm text-muted-foreground">Total Certificates</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-lg mr-4">
              <GraduationCap className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {certificates.filter(c => c.status === 'ACTIVE').length}
              </p>
              <p className="text-sm text-muted-foreground">Active Certificates</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center p-6">
            <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-lg mr-4">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {certificates.length > 0
                  ? new Date(Math.max(...certificates.map(c => new Date(c.issueDate)))).getFullYear()
                  : 'N/A'
                }
              </p>
              <p className="text-sm text-muted-foreground">Latest Year</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Certificates Grid */}
      {
        certificates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {certificates.map((certificate) => (
              <Card key={certificate._id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg leading-6 mb-2">
                        {certificate.course?.title || 'Course Certificate'}
                        {certificate.level && <span className="block text-sm font-medium text-blue-600 mt-1">({certificate.level})</span>}
                        {certificate.type === 'SKILL_UPGRADATION' && !certificate.level && <span className="block text-sm font-medium text-blue-600 mt-1">(Skill Upgradation)</span>}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Calendar className="h-4 w-4" />
                        <span>Issued: {formatDate(certificate.issueDate)}</span>
                      </div>
                    </div>
                    <Badge className={getGradeBadgeColor(certificate.grade)}>
                      {certificate.grade || 'PASS'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Instructor:</span>
                      <span className="font-medium">
                        {certificate.issuedBy?.fullName || 'N/A'}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={certificate.status === 'ACTIVE' ? 'success' : 'secondary'}>
                        {certificate.status}
                      </Badge>
                    </div>

                    {certificate.expiryDate && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Expires:</span>
                        <span className="font-medium">
                          {formatDate(certificate.expiryDate)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewCertificate(certificate)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintCertificate(certificate)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadCertificate(certificate)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                  <Award className="h-8 w-8 text-gray-400" />
                </div>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Certificates Yet</h3>
              <p className="text-muted-foreground mb-4">
                Complete your courses to earn certificates that showcase your achievements!
              </p>
              <Button
                onClick={() => window.location.href = '/student/course'}
                variant="outline"
              >
                <GraduationCap className="h-4 w-4 mr-2" />
                Browse Courses
              </Button>
            </CardContent>
          </Card>
        )
      }

      {/* Custom Full Screen Preview Dialog - Rendered via Portal to be top-level */}
      {
        showPreviewDialog && createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop with "half glass blurred" effect (strong blur) */}
            <div
              className="fixed inset-0 bg-black/30 backdrop-blur-xl transition-all duration-200"
              onClick={() => setShowPreviewDialog(false)}
            />

            {/* Modal Content */}
            <div className="relative w-full h-full max-w-[95vw] max-h-[95vh] bg-white/95 shadow-2xl rounded-xl overflow-hidden flex flex-col border border-white/20 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                <h2 className="text-xl font-semibold text-gray-800">
                  Certificate - {selectedCertificate?.course?.title}
                </h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowPreviewDialog(false)}
                  className="hover:bg-gray-100 rounded-full h-8 w-8"
                >
                  <span className="sr-only">Close</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5 opacity-70"
                  >
                    <path d="M18 6 6 18" />
                    <path d="M6 6 18 18" />
                  </svg>
                </Button>
              </div>

              <div className="flex-1 overflow-auto bg-gray-50/50 p-4 sm:p-8 flex items-center justify-center">
                <div
                  className="w-full h-full bg-white shadow-sm border rounded-lg overflow-hidden flex items-center justify-center"
                  style={{ minHeight: '100%' }}
                >
                  {selectedCertificate?.metadata?.generatedHTML ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html>
                   <html>
                   <head>
                     <meta charset="utf-8">
                     <title>Certificate Preview</title>
                     <style>
                       body { 
                         margin: 0; 
                         padding: 20px; 
                         font-family: Arial, sans-serif; 
                         background: #f5f5f5;
                         display: flex;
                         justify-content: center;
                         align-items: flex-start;
                         min-height: 100vh;
                         overflow: auto;
                       }
                       .preview-container {
                         background: white;
                         padding: 0;
                         border-radius: 8px;
                         box-shadow: 0 5px 20px rgba(0,0,0,0.15);
                         /* Transform to fit */
                         zoom: 0.65;
                         margin-top: 20px;
                       }
                       @media (min-width: 768px) {
                         .preview-container { zoom: 0.8; }
                       }
                       @media (min-width: 1024px) {
                         .preview-container { zoom: 1.0; }
                       }
                       @media (min-width: 1536px) {
                         .preview-container { zoom: 1.15; }
                       }
                       /* Ensure certificate class doesn't override container behavior unless specific */
                       ${selectedCertificate.metadata.styles || ''}
                     </style>
                   </head>
                   <body>
                     <div class="preview-container">
                       ${selectedCertificate.metadata.generatedHTML}
                     </div>
                   </body>
                   </html>`}
                      className="w-full h-full border-0"
                      sandbox="allow-same-origin allow-scripts"
                      title="Certificate Preview"
                      loading="eager"
                    />
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Certificate preview not available</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-white/50 flex justify-end gap-3 backdrop-blur-sm">
                <Button onClick={() => handlePrintCertificate(selectedCertificate)}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </Button>
                <Button onClick={() => handleDownloadCertificate(selectedCertificate)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowPreviewDialog(false)}
                >
                  Close Preview
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div >
  )
}

export default Certificates
