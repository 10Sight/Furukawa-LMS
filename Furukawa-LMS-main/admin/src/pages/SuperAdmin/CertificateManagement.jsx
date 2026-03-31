import React, { useState, useEffect } from "react";
import {
  IconCertificate,
  IconPlus,
  IconSearch,
  IconFilter,
  IconDownload,
  IconEdit,
  IconTrash,
  IconEye,
  IconRefresh,
  IconTemplate,
  IconUsers,
  IconChevronDown,
  IconX,
  IconCheck,
  IconAlertTriangle,
  IconCalendar,
  IconStar,
  IconCopy,
  IconExternalLink,
  IconSettings,
  IconFileText,
  IconMail
} from "@tabler/icons-react";
import {
  useGetCertificateTemplatesQuery,
  useCreateCertificateTemplateMutation,
  useUpdateCertificateTemplateMutation,
  useDeleteCertificateTemplateMutation,
  useSetDefaultCertificateTemplateMutation
} from "@/Redux/AllApi/CertificateTemplateApi";
import {
  useIssueCertificateMutation,
  useRevokeCertificateMutation,
  useGetCourseCertificatesQuery,
  useGenerateCertificatePreviewMutation,
  useIssueCertificateWithTemplateMutation
} from "@/Redux/AllApi/CertificateApi";
import { useGetCoursesQuery } from "@/Redux/AllApi/CourseApi";
import { useGetAllUsersQuery } from "@/Redux/AllApi/SuperAdminApi";
import { useBulkGenerateCertificatesMutation } from "@/Redux/AllApi/SuperAdminApi";
import { toast } from "sonner";

const CertificateManagement = () => {
  const [activeTab, setActiveTab] = useState("templates");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCourse, setSelectedCourse] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // Form states
  const [templateForm, setTemplateForm] = useState({
    name: "",
    description: "",
    template: "",
    styles: "",
    placeholders: [
      { key: "studentName", description: "Student's full name", required: true },
      { key: "courseName", description: "Course title", required: true },
      { key: "departmentName", description: "Department name", required: true },
      { key: "instructorName", description: "Instructor's full name", required: true },
      { key: "level", description: "Student's completion level", required: true },
      { key: "issueDate", description: "Certificate issue date", required: true },
      { key: "grade", description: "Grade or score", required: false }
    ],
    isDefault: false
  });

  const [issueForm, setIssueForm] = useState({
    studentId: "",
    courseId: "",
    templateId: "",
    grade: "PASS"
  });

  const [bulkForm, setBulkForm] = useState({
    userIds: [],
    courseId: "",
    templateId: "",
    departmentId: "",
    criteria: "completion"
  });

  // API hooks
  const { data: templatesData, isLoading: templatesLoading, refetch: refetchTemplates } = useGetCertificateTemplatesQuery();
  const { data: coursesData } = useGetCoursesQuery({ limit: 1000 });
  const { data: usersData } = useGetAllUsersQuery({ limit: 1000, role: "STUDENT" });
  const { data: certificatesData, refetch: refetchCertificates } = useGetCourseCertificatesQuery(selectedCourse, {
    skip: !selectedCourse
  });

  const [createTemplate, { isLoading: creating }] = useCreateCertificateTemplateMutation();
  const [updateTemplate, { isLoading: updating }] = useUpdateCertificateTemplateMutation();
  const [deleteTemplate, { isLoading: deleting }] = useDeleteCertificateTemplateMutation();
  const [setDefaultTemplate] = useSetDefaultCertificateTemplateMutation();
  const [issueCertificate, { isLoading: issuing }] = useIssueCertificateWithTemplateMutation();
  const [revokeCertificate] = useRevokeCertificateMutation();
  const [bulkGenerate, { isLoading: bulkGenerating }] = useBulkGenerateCertificatesMutation();
  const [generatePreview] = useGenerateCertificatePreviewMutation();

  const templates = templatesData?.data || [];
  const courses = coursesData?.data?.courses || [];
  const users = usersData?.data?.users || [];
  const certificates = certificatesData?.data || [];

  // Filter certificates based on search and filters
  const filteredCertificates = certificates.filter(cert => {
    const matchesSearch = !searchTerm ||
      cert.student?.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cert.course?.title?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = !selectedStatus || cert.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const handleCreateTemplate = async () => {
    try {
      await createTemplate(templateForm).unwrap();
      toast.success("Certificate template created successfully!");
      setShowTemplateModal(false);
      resetTemplateForm();
      refetchTemplates();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to create template");
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      await updateTemplate({ id: selectedTemplate._id, ...templateForm }).unwrap();
      toast.success("Certificate template updated successfully!");
      setShowTemplateModal(false);
      resetTemplateForm();
      refetchTemplates();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to update template");
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm("Are you sure you want to delete this template?")) {
      try {
        await deleteTemplate(templateId).unwrap();
        toast.success("Certificate template deleted successfully!");
        refetchTemplates();
      } catch (error) {
        toast.error(error?.data?.message || "Failed to delete template");
      }
    }
  };

  const handleSetDefault = async (templateId) => {
    try {
      await setDefaultTemplate(templateId).unwrap();
      toast.success("Default template updated successfully!");
      refetchTemplates();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to set default template");
    }
  };

  const handleIssueCertificate = async () => {
    try {
      await issueCertificate(issueForm).unwrap();
      toast.success("Certificate issued successfully!");
      setShowIssueModal(false);
      resetIssueForm();
      refetchCertificates();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to issue certificate");
    }
  };

  const handleBulkGenerate = async () => {
    try {
      const result = await bulkGenerate(bulkForm).unwrap();
      toast.success(`Bulk generation completed! ${result.summary?.successful || 0} certificates generated successfully.`);
      setShowBulkModal(false);
      resetBulkForm();
      refetchCertificates();
    } catch (error) {
      toast.error(error?.data?.message || "Failed to generate certificates");
    }
  };

  const handleRevoke = async (certificateId) => {
    if (window.confirm("Are you sure you want to revoke this certificate?")) {
      try {
        await revokeCertificate(certificateId).unwrap();
        toast.success("Certificate revoked successfully!");
        refetchCertificates();
      } catch (error) {
        toast.error(error?.data?.message || "Failed to revoke certificate");
      }
    }
  };

  const handlePreview = async (templateId) => {
    try {
      const sampleData = {
        studentId: users[0]?._id,
        courseId: courses[0]?._id,
        templateId
      };
      const result = await generatePreview(sampleData).unwrap();
      setPreviewHtml(result.data.html);
      setShowPreview(true);
    } catch (error) {
      toast.error("Failed to generate preview");
    }
  };

  const resetTemplateForm = () => {
    setTemplateForm({
      name: "",
      description: "",
      template: "",
      styles: "",
      placeholders: [
        { key: "studentName", description: "Student's full name", required: true },
        { key: "courseName", description: "Course title", required: true },
        { key: "departmentName", description: "Department name", required: true },
        { key: "instructorName", description: "Instructor's full name", required: true },
        { key: "level", description: "Student's completion level", required: true },
        { key: "issueDate", description: "Certificate issue date", required: true },
        { key: "grade", description: "Grade or score", required: false }
      ],
      isDefault: false
    });
    setSelectedTemplate(null);
  };

  const resetIssueForm = () => {
    setIssueForm({
      studentId: "",
      courseId: "",
      templateId: "",
      grade: "PASS"
    });
  };

  const resetBulkForm = () => {
    setBulkForm({
      userIds: [],
      courseId: "",
      templateId: "",
      departmentId: "",
      criteria: "completion"
    });
  };

  const openTemplateModal = (template = null) => {
    if (template) {
      setSelectedTemplate(template);
      setTemplateForm({
        name: template.name,
        description: template.description || "",
        template: template.template,
        styles: template.styles || "",
        placeholders: template.placeholders || [],
        isDefault: template.isDefault
      });
    } else {
      resetTemplateForm();
    }
    setShowTemplateModal(true);
  };

  const addPlaceholder = () => {
    setTemplateForm(prev => ({
      ...prev,
      placeholders: [...prev.placeholders, { key: "", description: "", required: false }]
    }));
  };

  const removePlaceholder = (index) => {
    setTemplateForm(prev => ({
      ...prev,
      placeholders: prev.placeholders.filter((_, i) => i !== index)
    }));
  };

  const updatePlaceholder = (index, field, value) => {
    setTemplateForm(prev => ({
      ...prev,
      placeholders: prev.placeholders.map((placeholder, i) =>
        i === index ? { ...placeholder, [field]: value } : placeholder
      )
    }));
  };

  const tabs = [
    { id: "templates", label: "Templates", icon: IconTemplate },
    { id: "certificates", label: "Certificates", icon: IconCertificate },
    { id: "issue", label: "Issue Certificate", icon: IconPlus },
    { id: "bulk", label: "Bulk Generate", icon: IconUsers }
  ];

  const defaultTemplate = `
    <div style="width: 800px; height: 600px; border: 2px solid #2563eb; padding: 40px; text-align: center; font-family: 'Georgia', serif; background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);">
      <h1 style="color: #1e40af; font-size: 36px; margin-bottom: 10px; font-weight: bold;">Certificate of Achievement</h1>
      <p style="color: #64748b; font-size: 16px; margin-bottom: 30px;">This is to certify that</p>
      <h2 style="color: #0f172a; font-size: 28px; margin-bottom: 20px; font-weight: bold; text-decoration: underline;">{{studentName}}</h2>
      <p style="color: #475569; font-size: 18px; margin-bottom: 10px;">has successfully completed the course</p>
      <h3 style="color: #1e40af; font-size: 24px; margin-bottom: 20px; font-weight: bold;">{{courseName}}</h3>
      <p style="color: #64748b; font-size: 16px; margin-bottom: 10px;">in {{departmentName}} department</p>
      <p style="color: #64748b; font-size: 16px; margin-bottom: 30px;">under the guidance of {{instructorName}}</p>
      <p style="color: #475569; font-size: 16px; margin-bottom: 10px;">Level: {{level}} | Grade: {{grade}}</p>
      <p style="color: #64748b; font-size: 14px; margin-top: 40px;">Issued on {{issueDate}}</p>
      <div style="margin-top: 40px; display: flex; justify-content: space-between; align-items: center;">
        <div style="text-align: left;">
          <div style="border-top: 1px solid #94a3b8; width: 150px; margin-bottom: 5px;"></div>
          <p style="color: #64748b; font-size: 12px;">Director Signature</p>
        </div>
        <div style="width: 80px; height: 80px; border: 2px solid #2563eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #dbeafe;">
          <span style="color: #1e40af; font-size: 12px; font-weight: bold;">OFFICIAL<br>SEAL</span>
        </div>
        <div style="text-align: right;">
          <div style="border-top: 1px solid #94a3b8; width: 150px; margin-bottom: 5px;"></div>
          <p style="color: #64748b; font-size: 12px;">Institution Seal</p>
        </div>
      </div>
    </div>
  `;

  // Template Modal Component
  const TemplateModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedTemplate ? "Edit Template" : "Create New Template"}
          </h3>
          <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Template Name</label>
              <input
                type="text"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Certificate Template Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <input
                type="text"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Template description"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">HTML Template</label>
            <textarea
              value={templateForm.template || defaultTemplate}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, template: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={12}
              placeholder="HTML template with placeholders like {{studentName}}, {{courseName}}, etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              Use placeholders like {{ studentName }}, {{ courseName }}, {{ departmentName }}, {{ instructorName }}, {{ level }}, {{ issueDate }}, {{ grade }}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CSS Styles (Optional)</label>
            <textarea
              value={templateForm.styles}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, styles: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Additional CSS styles for the certificate"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block text-sm font-medium text-gray-700">Placeholders</label>
              <button
                type="button"
                onClick={addPlaceholder}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                <IconPlus className="w-4 h-4" />
                <span>Add Placeholder</span>
              </button>
            </div>
            <div className="space-y-3 max-h-40 overflow-y-auto">
              {templateForm.placeholders.map((placeholder, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-md">
                  <input
                    type="text"
                    value={placeholder.key}
                    onChange={(e) => updatePlaceholder(index, 'key', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Placeholder key (e.g., studentName)"
                  />
                  <input
                    type="text"
                    value={placeholder.description}
                    onChange={(e) => updatePlaceholder(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Description"
                  />
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={placeholder.required}
                      onChange={(e) => updatePlaceholder(index, 'required', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">Required</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => removePlaceholder(index)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <IconTrash className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              checked={templateForm.isDefault}
              onChange={(e) => setTemplateForm(prev => ({ ...prev, isDefault: e.target.checked }))}
              className="mr-2"
            />
            <label className="text-sm text-gray-700">Set as default template</label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t">
          <button
            onClick={() => setShowTemplateModal(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={selectedTemplate ? handleUpdateTemplate : handleCreateTemplate}
            disabled={creating || updating}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating || updating ? "Saving..." : selectedTemplate ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );

  // Issue Certificate Modal
  const IssueModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Issue Certificate</h3>
          <button onClick={() => setShowIssueModal(false)} className="text-gray-400 hover:text-gray-600">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
            <select
              value={issueForm.studentId}
              onChange={(e) => setIssueForm(prev => ({ ...prev, studentId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Student</option>
              {users.map(user => (
                <option key={user._id} value={user._id}>{user.fullName} ({user.email})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
            <select
              value={issueForm.courseId}
              onChange={(e) => setIssueForm(prev => ({ ...prev, courseId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Course</option>
              {courses.map(course => (
                <option key={course._id} value={course._id}>{course.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
            <select
              value={issueForm.templateId}
              onChange={(e) => setIssueForm(prev => ({ ...prev, templateId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Template</option>
              {templates.map(template => (
                <option key={template._id} value={template._id}>
                  {template.name} {template.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
            <select
              value={issueForm.grade}
              onChange={(e) => setIssueForm(prev => ({ ...prev, grade: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="A+">A+</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="PASS">PASS</option>
              <option value="FAIL">FAIL</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t">
          <button
            onClick={() => setShowIssueModal(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleIssueCertificate}
            disabled={issuing || !issueForm.studentId || !issueForm.courseId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {issuing ? "Issuing..." : "Issue Certificate"}
          </button>
        </div>
      </div>
    </div>
  );

  // Bulk Generate Modal
  const BulkModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Bulk Generate Certificates</h3>
          <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
            <select
              value={bulkForm.courseId}
              onChange={(e) => setBulkForm(prev => ({ ...prev, courseId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Course</option>
              {courses.map(course => (
                <option key={course._id} value={course._id}>{course.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
            <select
              value={bulkForm.templateId}
              onChange={(e) => setBulkForm(prev => ({ ...prev, templateId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Template</option>
              {templates.map(template => (
                <option key={template._id} value={template._id}>
                  {template.name} {template.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Generation Criteria</label>
            <select
              value={bulkForm.criteria}
              onChange={(e) => setBulkForm(prev => ({ ...prev, criteria: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="completion">Course Completion</option>
              <option value="passing_grade">Passing Grade</option>
              <option value="all_enrolled">All Enrolled Students</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t">
          <button
            onClick={() => setShowBulkModal(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerating || !bulkForm.courseId || !bulkForm.templateId}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkGenerating ? "Generating..." : "Generate Certificates"}
          </button>
        </div>
      </div>
    </div>
  );

  // Preview Modal
  const PreviewModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Certificate Preview</h3>
          <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">
            <IconX className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificate Management</h1>
          <p className="text-gray-600 mt-1">
            Advanced certificate management with template design and bulk generation
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => refetchTemplates()}
            className="flex items-center space-x-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
          >
            <IconRefresh className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Templates Tab */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <IconSearch className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => openTemplateModal()}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <IconPlus className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          </div>

          {templatesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <div key={template._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 flex items-center">
                        {template.name}
                        {template.isDefault && (
                          <IconStar className="w-4 h-4 text-yellow-500 ml-2 fill-current" />
                        )}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handlePreview(template._id)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Preview"
                      >
                        <IconEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openTemplateModal(template)}
                        className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                        title="Edit"
                      >
                        <IconEdit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template._id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Delete"
                      >
                        <IconTrash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                      <span>Placeholders: {template.placeholders?.length || 0}</span>
                      <span>Active: {template.isActive ? 'Yes' : 'No'}</span>
                    </div>

                    {!template.isDefault && (
                      <button
                        onClick={() => handleSetDefault(template._id)}
                        className="w-full py-2 px-3 text-sm bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md hover:bg-yellow-100"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Certificates Tab */}
      {activeTab === "certificates" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <IconSearch className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search certificates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Courses</option>
                {courses.map(course => (
                  <option key={course._id} value={course._id}>{course.title}</option>
                ))}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="REVOKED">Revoked</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
            <button
              onClick={() => setShowIssueModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <IconPlus className="w-4 h-4" />
              <span>Issue Certificate</span>
            </button>
          </div>

          {selectedCourse ? (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Course</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Grade</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCertificates.map((certificate) => (
                      <tr key={certificate._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {certificate.student?.fullName}
                              </div>
                              <div className="text-sm text-gray-500">{certificate.student?.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {certificate.course?.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${certificate.grade === 'A+' || certificate.grade === 'A'
                              ? 'bg-green-100 text-green-800'
                              : certificate.grade === 'B'
                                ? 'bg-yellow-100 text-yellow-800'
                                : certificate.grade === 'C'
                                  ? 'bg-orange-100 text-orange-800'
                                  : 'bg-blue-100 text-blue-800'
                            }`}>
                            {certificate.grade}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(certificate.issueDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${certificate.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-800'
                              : certificate.status === 'REVOKED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                            {certificate.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button
                              className="text-blue-600 hover:text-blue-900"
                              title="View"
                            >
                              <IconEye className="w-4 h-4" />
                            </button>
                            <button
                              className="text-green-600 hover:text-green-900"
                              title="Download"
                            >
                              <IconDownload className="w-4 h-4" />
                            </button>
                            {certificate.status === 'ACTIVE' && (
                              <button
                                onClick={() => handleRevoke(certificate._id)}
                                className="text-red-600 hover:text-red-900"
                                title="Revoke"
                              >
                                <IconX className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
              <IconCertificate className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Course</h3>
              <p className="text-gray-500">Choose a course to view its certificates</p>
            </div>
          )}
        </div>
      )}

      {/* Issue Certificate Tab */}
      {activeTab === "issue" && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Issue New Certificate</h3>

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Student</label>
                  <select
                    value={issueForm.studentId}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, studentId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Student</option>
                    {users.map(user => (
                      <option key={user._id} value={user._id}>{user.fullName} ({user.email})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                  <select
                    value={issueForm.courseId}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, courseId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Course</option>
                    {courses.map(course => (
                      <option key={course._id} value={course._id}>{course.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <select
                    value={issueForm.templateId}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, templateId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Template</option>
                    {templates.map(template => (
                      <option key={template._id} value={template._id}>
                        {template.name} {template.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Grade</label>
                  <select
                    value={issueForm.grade}
                    onChange={(e) => setIssueForm(prev => ({ ...prev, grade: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A+">A+</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="PASS">PASS</option>
                    <option value="FAIL">FAIL</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleIssueCertificate}
                  disabled={issuing || !issueForm.studentId || !issueForm.courseId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {issuing ? "Issuing..." : "Issue Certificate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Generate Tab */}
      {activeTab === "bulk" && (
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-6">Bulk Generate Certificates</h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Course</label>
                <select
                  value={bulkForm.courseId}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, courseId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Course</option>
                  {courses.map(course => (
                    <option key={course._id} value={course._id}>{course.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                <select
                  value={bulkForm.templateId}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, templateId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Template</option>
                  {templates.map(template => (
                    <option key={template._id} value={template._id}>
                      {template.name} {template.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Generation Criteria</label>
                <select
                  value={bulkForm.criteria}
                  onChange={(e) => setBulkForm(prev => ({ ...prev, criteria: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="completion">Course Completion</option>
                  <option value="passing_grade">Passing Grade</option>
                  <option value="all_enrolled">All Enrolled Students</option>
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <IconAlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">Bulk Generation Notice</h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        This will generate certificates for all students meeting the selected criteria.
                        Please review your selection carefully before proceeding.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleBulkGenerate}
                  disabled={bulkGenerating || !bulkForm.courseId || !bulkForm.templateId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {bulkGenerating ? "Generating..." : "Generate Certificates"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showTemplateModal && <TemplateModal />}
      {showIssueModal && <IssueModal />}
      {showBulkModal && <BulkModal />}
      {showPreview && <PreviewModal />}
    </div>
  );
};

export default CertificateManagement;
