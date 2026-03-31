import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetModuleByIdQuery, useUpdateModuleMutation } from "@/Redux/AllApi/moduleApi";
import { useGetCourseByIdQuery } from "@/Redux/AllApi/CourseApi";
import ModuleForm from "@/components/course/ModuleForm";
import { toast } from "sonner";

const EditModulePage = () => {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { data: moduleData, isFetching } = useGetModuleByIdQuery(moduleId, { skip: !moduleId });
  const [updateModule, { isLoading: isUpdating }] = useUpdateModuleMutation();

  const module = moduleData?.data;
  const courseId = module?.course?._id || module?.course || null;
  const { data: courseData } = useGetCourseByIdQuery(courseId, { skip: !courseId });
  const modules = courseData?.data?.modules || [];

  const [formData, setFormData] = useState({ title: "", description: "", order: 1 });
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    if (module) {
      setFormData({
        title: module.title || "",
        description: module.description || "",
        order: module.order || 1,
      });
    }
  }, [moduleId, module?.updatedAt]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: name === 'order' ? parseInt(value || 1, 10) : value }));
  };

  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Module title is required';
    if (formData.order < 1) errors.order = 'Order must be at least 1';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await updateModule({ moduleId, title: formData.title, description: formData.description, order: formData.order }).unwrap();
      toast.success('Module updated');
      navigate(-1);
    } catch (err) {
      toast.error(err?.data?.message || 'Failed to update module');
    }
  };

  const handleCancelEdit = () => navigate(-1);

  if (!moduleId) return <div className="p-4">Invalid module</div>;

  return (
    <div className="space-y-6">
      <ModuleForm
        formData={formData}
        formErrors={formErrors}
        editingModule={module}
        modules={modules}
        isCreating={false}
        isUpdating={isUpdating || isFetching}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        handleCancelEdit={handleCancelEdit}
        navigate={navigate}
      />
    </div>
  );
};

export default EditModulePage;
