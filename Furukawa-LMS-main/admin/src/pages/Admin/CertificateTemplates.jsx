import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import useTranslate from '@/hooks/useTranslate'
import {
  useGetCertificateTemplatesQuery,
  useDeleteCertificateTemplateMutation,
  useSetDefaultCertificateTemplateMutation,
  useCreateCertificateTemplateMutation,
  useUpdateCertificateTemplateMutation
} from '@/Redux/AllApi/CertificateTemplateApi'
import { useGetActiveConfigQuery } from '@/Redux/AllApi/CourseLevelConfigApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  Award,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Star,
  Copy,
  FileText
} from 'lucide-react'
import { toast } from 'sonner'

const CertificateTemplates = () => {
  const { t } = useTranslate()
  const navigate = useNavigate()
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    template: '',
    styles: '',
    isDefault: false
  })

  // API calls with proper error handling
  const {
    data: response,
    isLoading,
    error,
    refetch
  } = useGetCertificateTemplatesQuery()

  // Fetch active course level config
  const { data: configData, isLoading: configLoading } = useGetActiveConfigQuery()
  const activeConfig = configData?.data

  // Update form data when active config loads if opening create dialog
  useEffect(() => {
    if (showCreateDialog && activeConfig && !formData.name) {
      setFormData(prev => ({
        ...prev,
        template: generateDefaultTemplate(activeConfig),
        styles: generateDefaultStyles(activeConfig)
      }))
    }
  }, [activeConfig, showCreateDialog])

  const [deleteTemplate, { isLoading: isDeleting }] = useDeleteCertificateTemplateMutation()
  const [setDefaultTemplate, { isLoading: isSettingDefault }] = useSetDefaultCertificateTemplateMutation()
  const [createTemplate, { isLoading: isCreating }] = useCreateCertificateTemplateMutation()
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateCertificateTemplateMutation()

  // Extract templates from response
  const templates = response?.data || []

  // Generate dynamic template based on config
  const generateDefaultTemplate = (config) => {
    const levels = config?.levels || []
    const levelRows = levels.map(level => `
                    <tr style="background-color: ${level.color || '#cccccc'}; color: white;">
                        <td style="border: 1px solid #000; padding: 8px;">${level.name}</td>
                        <td style="border: 1px solid #000; padding: 8px;">{{level${level.order + 1}Date}}</td>
                    </tr>`).join('')

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DOJO Certificate</title>
</head>
<body>
    <div class="certificate-container">
        <!-- Header Section -->
        <div class="header">
            <div class="header-text">
                <h1>CERTIFICATION</h1>
                <h2>THIS IS TO CERTIFY THAT</h2>
            </div>
            <div class="brand-logo">
                <img src="/fme_transparent.png" alt="Marelli Motherson" />
            </div>
        </div>
    
        <div style="background-color: #fffbeb; padding: 20px;">
            <p>
                <strong>Mr. / Mrs.</strong> <span style="text-decoration: underline; padding: 0 10px;">{{studentName}}</span>
                &nbsp;&nbsp;&nbsp;
                <strong>Department</strong> <span style="text-decoration: underline; padding: 0 10px;">{{departmentName}}</span>
                &nbsp;&nbsp;&nbsp;
                <strong>Operator ID</strong> <span style="text-decoration: underline; padding: 0 10px;">{{employeeId}}</span>
            </p>

            <p>
                who had started his/her training from ( <span style="text-decoration: underline; padding: 0 10px;">{{startDate}}</span> )
                to ( <span style="text-decoration: underline; padding: 0 10px;">{{completionDate}}</span> )
            </p>
            
            <p>has successfully completed ( Integrated/ Refresher ) course through the following DOJO Gates.</p>
        </div>

        <div style="border: 2px solid #000; display: flex;">
            <div style="width: 50%; border-right: 2px solid #000;">
                <div style="background-color: #dbeafe; padding: 10px; font-weight: bold; text-align: center; border-bottom: 2px solid #000;">DOJO Gates</div>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr style="background-color: #eee;">
                        <th style="border: 1px solid #000; padding: 8px;">Level</th>
                        <th style="border: 1px solid #000; padding: 8px;">Level Certified Date</th>
                    </tr>
                    ${levelRows}
                </table>
            </div>
            
            <div style="width: 50%; background-color: #dbeafe; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                <div style="margin-bottom: 20px;">
                    <!-- User Image Square -->
                    <div style="width: 100px; height: 100px; border-radius: 12px; overflow: hidden; border: 2px solid #333; background: #fff; margin: 0 auto;">
                        <img src="{{userImage}}" alt="User" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/150'"/>
                    </div>
                </div>
                
                <!-- Pie Chart -->
                <div style="width: 60px; height: 60px; {{pieChart}}; border: 2px solid #333; margin-bottom: 10px;"></div>
                
                <div style="font-weight: bold;">Current Skill Level - {{level}}</div>
            </div>
        </div>

        <div style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; display: flex; justify-content: space-between;">
             <div>Note:- Review Frequency after 3 month</div>
             <div>
                 <span style="margin-right: 50px;">1st Review</span>
                 <span>4th review</span>
             </div>
        </div>
    </div>
</body>
</html>`
  }

  const generateDefaultStyles = (config) => {
    const levels = config?.levels || []
    const levelColors = levels.map(level => `
.lvl-${level.name.replace(/\s+/g, '-').toLowerCase()} { background-color: ${level.color || '#cccccc'}; }`).join('\n')

    // Find the current level color or default to blue for the box
    // For template default, we might key off a specific level or just use the first non-grey one
    const defaultBoxColor = levels.length > 1 ? levels[1].color : '#5b9bd5'

    return `* {
    box-sizing: border-box;
}

body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
}

.certificate-container {
    width: 800px;
    margin: 0 auto;
    border: 2px solid #000;
    background-color: #fff9e6; /* Light yellow background */
    position: relative;
}

/* Header */
.header {
    background-color: #2b78c5; /* Blue header */
    color: white;
    padding: 20px;
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    border-bottom: 2px solid #000;
}

.header-text {
    text-align: center;
}

.header h1 {
    margin: 0;
    font-size: 32px;
    font-weight: bold;
    text-transform: uppercase;
}

.header h2 {
    margin: 5px 0 0 0;
    font-size: 24px;
    font-weight: bold;
    color: #000;
}

.brand-logo {
    position: absolute;
    right: 10px;
    top: 5px;
    background: white;
    padding: 5px;
}

.brand-logo img {
    height: 60px;
    width: auto;
}

/* Candidate Info */
.candidate-info {
    padding: 20px 30px;
    font-weight: bold;
    font-size: 14px;
    line-height: 1.8;
}

.label {
    margin-right: 5px;
}

.underline {
    display: inline-block;
    border-bottom: 1px solid #000;
    padding: 0 10px;
    margin-right: 15px;
    min-width: 50px;
    text-align: center;
}

.field-name { min-width: 200px; }
.field-dept { min-width: 150px; }
.field-id { min-width: 100px; }
.field-date { min-width: 80px; }

.training-declaration {
    margin-top: 15px;
}

/* Levels Table Grid */
.levels-container {
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
    background-color: #dbebf7; /* Light blueish background */
}

.level-header {
    text-align: center;
    font-weight: bold;
    font-size: 18px;
    padding: 8px;
    border-bottom: 2px solid #000;
}

.main-grid {
    display: flex;
}

.levels-table {
    width: 50%;
    border-right: 2px solid #000;
}

.table-row {
    display: flex;
    border-bottom: 1px solid #000;
    height: 45px;
}

.table-row:last-child {
    border-bottom: none;
}

.header-row {
    font-weight: bold;
    background-color: #dbebf7;
    height: 35px;
    align-items: center;
}

.col-level {
    width: 35%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    border-right: 1px solid #000;
    height: 100%;
}

.col-date {
    width: 65%;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
}

/* Level Colors - Dynamic */
${levelColors}

/* Visual Section */
.visual-section {
    width: 50%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

.blue-box {
    width: 120px;
    height: 120px;
    background-color: ${defaultBoxColor};
    border-radius: 15px;
    border: 1px solid #333;
    margin-bottom: 20px;
}

.chart-box {
    width: 80px;
    height: 80px;
    background: white;
    border: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
}

.pie-chart {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: conic-gradient(black 0% 25%, white 25% 100%); /* Static pie chart example */
    border: 1px solid black;
}

.skill-level-text {
    font-weight: bold;
    font-size: 16px;
}

/* Footer Table */
.footer-table {
    display: flex;
    height: 60px;
}

.note-col {
    width: 50%;
    border-right: 2px solid #000;
    display: flex;
    align-items: center;
    padding-left: 10px;
    font-weight: bold;
    font-size: 14px;
}

.review-col {
    width: 50%;
    display: flex;
    flex-direction: column;
}

.review-header, .review-body {
    display: flex;
    height: 50%;
}

.review-header {
    border-bottom: 1px solid #000;
}

.r-cell {
    width: 50%;
    border-right: 1px solid #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
}

.r-cell:last-child {
    border-right: none;
}
`
  }

  const handleCreateTemplate = async () => {
    if (!formData.name.trim() || !formData.template.trim()) {
      toast.error(t('certificateTemplates.toast.requiredFields'))
      return
    }

    try {
      const result = await createTemplate({
        name: formData.name.trim(),
        description: formData.description.trim(),
        template: formData.template || generateDefaultTemplate(activeConfig),
        styles: formData.styles || generateDefaultStyles(activeConfig),
        isDefault: formData.isDefault
      }).unwrap()

      if (result.success) {
        toast.success(t('certificateTemplates.toast.createSuccess'))
        setShowCreateDialog(false)
        setFormData({
          name: '',
          description: '',
          template: '',
          styles: '',
          isDefault: false
        })
        refetch() // Refresh the list
      } else {
        toast.error(result.message || t('certificateTemplates.toast.createFail'))
      }
    } catch (error) {
      console.error('Create template error:', error)
      toast.error(error?.data?.message || t('certificateTemplates.toast.createFail'))
    }
  }

  const handleDeleteTemplate = async (templateId, templateName) => {
    if (!confirm(t('certificateTemplates.confirmDelete').replace('{name}', templateName))) return

    try {
      const result = await deleteTemplate(templateId).unwrap()
      if (result.success) {
        toast.success(t('certificateTemplates.toast.deleteSuccess'))
        refetch() // Refresh the list
      } else {
        toast.error(result.message || t('certificateTemplates.toast.deleteFail'))
      }
    } catch (error) {
      console.error('Delete template error:', error)
      toast.error(error?.data?.message || t('certificateTemplates.toast.deleteFail'))
    }
  }

  const handleSetDefault = async (templateId) => {
    try {
      const result = await setDefaultTemplate(templateId).unwrap()
      if (result.success) {
        toast.success(t('certificateTemplates.toast.defaultSuccess'))
        refetch() // Refresh the list to update default status
      } else {
        toast.error(result.message || t('certificateTemplates.toast.defaultFail'))
      }
    } catch (error) {
      console.error('Set default error:', error)
      toast.error(error?.data?.message || t('certificateTemplates.toast.defaultFail'))
    }
  }

  const handlePreview = (template) => {
    try {
      if (!template?.template) {
        toast.error(t('certificateTemplates.toast.emptyTemplate'))
        return
      }

      const sampleData = {
        studentName: 'John Doe',
        courseName: 'Advanced Web Development',
        departmentName: 'Spring 2024',
        instructorName: 'Dr. Sarah Johnson',
        level: 'L3',
        grade: 'A+',
        employeeId: 'EMP-2024-001',
        startDate: '01/01/2024',
        completionDate: '31/03/2024',
        level1Date: '15/01/2024',
        level2Date: '15/02/2024',
        level3Date: 'Pending',
        level4Date: '',
        level5Date: '',
        issueDate: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }

      // Add dynamic dates for other levels if they exist in config
      if (activeConfig?.levels) {
        activeConfig.levels.forEach((l, i) => {
          const dateKey = `level${i + 1}Date`
          if (!sampleData[dateKey]) {
            sampleData[dateKey] = i < 2 ? '01/01/2024' : '' // Mock some data
          }
        })
      }



      // 1. Initial simple replacement for basic fields
      let previewContent = template.template.toString()
      const templateStyles = template.styles || generateDefaultStyles(activeConfig)

      // Replace basic placeholders
      Object.keys(sampleData).forEach(key => {
        const placeholder = `{{${key}}}`
        const value = sampleData[key]
        previewContent = previewContent.split(placeholder).join(value)
      })

      // 2. Dynamic Row Injection (The "Smart Fix")
      // Only runs if we have active config levels and specific {{level1}} placeholder is present
      if (activeConfig?.levels) {
        // Regex/Substring logic to find row template
        let matchIndex = previewContent.search(/{{\s*level1\s*}}/);

        if (matchIndex !== -1) {
          const lowerHtml = previewContent.toLowerCase();
          const rowStartIndex = lowerHtml.lastIndexOf('<tr', matchIndex);
          const rowEndIndex = lowerHtml.indexOf('</tr>', matchIndex);

          if (rowStartIndex !== -1 && rowEndIndex !== -1) {
            const fullRowEndIndex = rowEndIndex + 5;
            const rowTemplate = previewContent.substring(rowStartIndex, fullRowEndIndex);

            const dynamicRows = activeConfig.levels.map((level, index) => {
              let rowHtml = rowTemplate;
              const levelNum = index + 1;

              // Name Replacement
              const levelNameRegex = new RegExp(`{{\\s*level1\\s*}}`, 'gi');
              rowHtml = rowHtml.replace(levelNameRegex, level.name);
              rowHtml = rowHtml.replace(/{{\s*levelIndex\\s*}}/gi, levelNum);

              // Date Replacement (Mock Data for Preview)
              // We use sampleData[`level${i}Date`]
              const dateKey = `level${levelNum}Date`;
              const dateStr = sampleData[dateKey] || (index < 2 ? '01/01/2024' : '-'); // Mock logic

              const dateRegex = new RegExp(`{{\\s*level1Date\\s*}}`, 'gi');
              rowHtml = rowHtml.replace(dateRegex, dateStr);
              rowHtml = rowHtml.replace(/{{\s*levelDate\\s*}}/gi, dateStr);

              return rowHtml;
            }).join('');

            previewContent = previewContent.slice(0, rowStartIndex) + dynamicRows + previewContent.slice(fullRowEndIndex);

            // Cleanup unused rows level2...15
            for (let i = 2; i <= 15; i++) {
              const nextRowPattern = new RegExp(`<tr[^>]*>[\\s\\S]*?{{\\s*level${i}\\s*}}[\\s\\S]*?<\\/tr>`, 'gi');
              previewContent = previewContent.replace(nextRowPattern, '');
            }
          }
        }
      }

      // 3. Dynamic Pie Chart (Pizza Slice Style)
      if (activeConfig?.levels) {
        const totalLevels = activeConfig.levels.length;
        // Mock a specific progress for preview 
        // e.g. L3 user = 3 completed levels
        let completedLevelsCount = 0;
        if (sampleData.level === 'L3') completedLevelsCount = 3;
        else if (sampleData.level === 'L2') completedLevelsCount = 2;
        else completedLevelsCount = 1;

        completedLevelsCount = Math.min(completedLevelsCount, totalLevels);

        // A. CSS Conic Gradient
        const fillPercentage = Math.round((completedLevelsCount / totalLevels) * 100);
        const pieChartCss = `background: conic-gradient(#F97316 0% ${fillPercentage}%, #E5E7EB ${fillPercentage}% 100%); border-radius: 50%;`;

        // B. SVG (Pizza Slices with Black Borders)
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
          const strokeColor = '#000000'; // Black borders as requested

          // Path
          const d = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
          paths.push(`<path d="${d}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1" />`);
        }

        const svgContent = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
        const svgDataUri = `data:image/svg+xml;base64,${btoa(svgContent)}`;

        // Smart Replacement
        if (previewContent.match(/src\s*=\s*['"]{{pieChart}}['"]/i)) {
          previewContent = previewContent.replace(/src\s*=\s*['"]{{pieChart}}['"]/gi, `src="${svgDataUri}"`);
        }
        else if (previewContent.match(/style\s*=\s*['"][^'"]*{{pieChart}}[^'"]*['"]/i)) {
          previewContent = previewContent.replace(/{{pieChart}}/gi, pieChartCss);
        }
        else {
          // Fallback to SVG if not in style tag, likely standalone div
          previewContent = previewContent.replace(/{{pieChart}}/gi, svgContent);
        }
      }

      // Clean any remaining placeholders
      previewContent = previewContent.replace(/\{\{.*?\}\}/g, 'Sample Data')

      const finalHtml = `<!DOCTYPE html>
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
      /* Transform to fit if needed, but centering is key */
      transform: scale(0.70);
      transform-origin: center top;
      margin-top: 20px;
    }
    /* Ensure certificate class doesn't override container behavior unless specific */
    ${templateStyles}
  </style>
</head>
<body>
  <div class="preview-container">
    ${previewContent}
  </div>
</body>
</html>`

      setPreviewHtml(finalHtml)
      setShowPreviewDialog(true)
    } catch (error) {
      console.error('Preview generation error:', error)
      toast.error(t('certificateTemplates.toast.previewFail'))
    }
  }

  const handleCopyTemplate = (template) => {
    setFormData({
      name: `${template.name} (Copy)`,
      description: template.description || '',
      template: template.template || generateDefaultTemplate(activeConfig),
      styles: template.styles || generateDefaultStyles(activeConfig),
      isDefault: false
    })
    setShowCreateDialog(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      template: generateDefaultTemplate(activeConfig),
      styles: generateDefaultStyles(activeConfig),
      isDefault: false
    })
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <FileText className="h-4 w-4" />
        <AlertDescription>
          <div className="flex flex-col space-y-2">
            <span>{t("certificateTemplates.error.failedLoad")}</span>
            <span className="text-sm">
              {t("certificateTemplates.error.prefix")}{error?.data?.message || error?.message || 'Unknown error occurred'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              className="mt-2 w-fit"
            >
              {t("certificateTemplates.error.retry")}
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background p-1 rounded-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Award className="h-6 w-6" />
            {t("certificateTemplates.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("certificateTemplates.subtitle")}
          </p>
        </div>

        <Button onClick={() => {
          resetForm()
          setShowCreateDialog(true)
        }}>
          <Plus className="h-4 w-4 mr-2" />
          {t("certificateTemplates.btnCreate")}
        </Button>

        <Dialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          className="max-w-4xl"
        >
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("certificateTemplates.dialog.createTitle")}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="name">{t("certificateTemplates.label.name")}</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("certificateTemplates.placeholder.name")}
                />
              </div>
              <div>
                <Label htmlFor="description">{t("certificateTemplates.label.description")}</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("certificateTemplates.placeholder.description")}
                />
              </div>
              <div>
                <Label htmlFor="template">{t("certificateTemplates.label.html")}</Label>
                <Textarea
                  id="template"
                  value={formData.template}
                  onChange={(e) => setFormData({ ...formData, template: e.target.value })}
                  placeholder={t("certificateTemplates.placeholder.html")}
                  className="h-64 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {t("certificateTemplates.placeholder.info")} {'{{studentName}}'}, {'{{courseName}}'}, {'{{departmentName}}'}, {'{{instructorName}}'}, {'{{level}}'}, {'{{grade}}'}, {'{{issueDate}}'}
                </p>
              </div>
              <div>
                <Label htmlFor="styles">{t("certificateTemplates.label.css")}</Label>
                <Textarea
                  id="styles"
                  value={formData.styles}
                  onChange={(e) => setFormData({ ...formData, styles: e.target.value })}
                  placeholder={t("certificateTemplates.placeholder.css")}
                  className="h-32 font-mono text-sm"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="isDefault" className="text-sm">
                  {t("certificateTemplates.checkbox.default")}
                </Label>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={isCreating}
                >
                  {t("certificateTemplates.btn.cancel")}
                </Button>
                <Button
                  onClick={handleCreateTemplate}
                  disabled={isCreating || !formData.name.trim() || !formData.template.trim()}
                >
                  {isCreating ? t("certificateTemplates.btn.creating") : t("certificateTemplates.btn.create")}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("certificateTemplates.table.title").replace("{count}", templates.length)}</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("certificateTemplates.table.name")}</TableHead>
                  <TableHead>{t("certificateTemplates.table.description")}</TableHead>
                  <TableHead>{t("certificateTemplates.table.status")}</TableHead>
                  <TableHead>{t("certificateTemplates.table.created")}</TableHead>
                  <TableHead className="text-right">{t("certificateTemplates.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{template.name}</span>
                        {template.isDefault && (
                          <Badge variant="secondary" className="ml-2">
                            <Star className="h-3 w-3 mr-1 fill-yellow-400" />
                            {t("certificateTemplates.badge.default")}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground line-clamp-2 max-w-md">
                        {template.description || t("certificateTemplates.noDescription")}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? t("certificateTemplates.badge.active") : t("certificateTemplates.badge.inactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">{t("certificateTemplates.menu.open")}</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handlePreview(template)}>
                            <Eye className="h-4 w-4 mr-2" />
                            {t("certificateTemplates.menu.preview")}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyTemplate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            {t("certificateTemplates.menu.duplicate")}
                          </DropdownMenuItem>
                          {!template.isDefault && (
                            <DropdownMenuItem
                              onClick={() => handleSetDefault(template._id)}
                              disabled={isSettingDefault}
                            >
                              <Star className="h-4 w-4 mr-2" />
                              {isSettingDefault ? t("certificateTemplates.menu.setting") : t("certificateTemplates.menu.setDefault")}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDeleteTemplate(template._id, template.name)}
                            className="text-destructive focus:text-destructive"
                            disabled={template.isDefault || isDeleting}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {isDeleting ? t("certificateTemplates.menu.deleting") : t("certificateTemplates.menu.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">{t("certificateTemplates.empty.title")}</h3>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {t("certificateTemplates.empty.desc")}
              </p>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                {t("certificateTemplates.empty.btn")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom Full Screen Preview Dialog - Rendered via Portal to be top-level */}
      {showPreviewDialog && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop with "half glass blurred" effect (strong blur) */}
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-xl transition-all duration-200"
            onClick={() => setShowPreviewDialog(false)}
          />

          {/* Modal Content */}
          <div className="relative w-full h-full max-w-[90vw] max-h-[90vh] bg-white/95 shadow-2xl rounded-xl overflow-hidden flex flex-col border border-white/20 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
              <h2 className="text-xl font-semibold text-gray-800">{t("certificateTemplates.preview.title")}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPreviewDialog(false)}
                className="hover:bg-gray-100 rounded-full h-8 w-8"
              >
                <span className="sr-only">{t("certificateTemplates.preview.srClose")}</span>
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
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  sandbox="allow-same-origin allow-scripts"
                  title={t("certificateTemplates.preview.title")}
                  loading="eager"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-white/50 flex justify-end gap-3 backdrop-blur-sm">
              <Button
                variant="outline"
                onClick={() => setShowPreviewDialog(false)}
              >
                {t("certificateTemplates.preview.close")}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default CertificateTemplates