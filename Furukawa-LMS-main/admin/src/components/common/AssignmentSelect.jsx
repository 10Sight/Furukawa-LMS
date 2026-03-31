import React, { useState, useEffect } from 'react';
import axiosInstance from '@/Helper/axiosInstance';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const AssignmentSelect = ({ 
  departmentId, 
  role, 
  value, 
  onChange, 
  placeholder = "Select...", 
  disabled = false,
  className = "" 
}) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchAssignments = async () => {
      if (!departmentId || !role) return;
      
      setLoading(true);
      try {
        const response = await axiosInstance.get(`/api/daily-5m/assignments/${departmentId}?role=${role}`);
        if (response.data.success) {
          setAssignments(response.data.data);
        }
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [departmentId, role]);

  return (
    <div className={cn("relative w-full", className)}>
      <select
        disabled={disabled || loading}
        className={cn(
          "w-full text-center bg-transparent outline-none cursor-pointer h-7 text-[10px]",
          loading && "opacity-50"
        )}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{loading ? "Loading..." : placeholder}</option>
        {assignments.map((assignment) => (
          <option key={assignment.id} value={assignment.userName}>
            {assignment.userName}
          </option>
        ))}
      </select>
      {loading && (
        <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none">
          <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};

export default AssignmentSelect;
