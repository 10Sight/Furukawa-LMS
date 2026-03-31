import React, { useState, useEffect, useCallback } from 'react';
import { useLazyGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce'; // Assuming useDebounce exists or I'll implement a simple one

const OperatorAutocomplete = ({ 
  departmentId, 
  value, 
  onChange, 
  placeholder = "Search operator...", 
  disabled = false,
  className = "",
  compact = false
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const debouncedSearch = useDebounce(search, 500);
  const [trigger, { data, isFetching }] = useLazyGetAllStudentsQuery();

  useEffect(() => {
    if (open && debouncedSearch.length >= 2) {
      const searchParams = { 
        search: debouncedSearch, 
        limit: 10 
      };
      if (departmentId) {
        searchParams.departmentId = departmentId;
      }
      trigger(searchParams);
    }
  }, [debouncedSearch, departmentId, open, trigger]);

  // Sync internal search state with external value when it changes externally
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const handleSelect = (student) => {
    setSearch(student.fullName);
    setOpen(false);
    if (onChange) {
      onChange({
        fullName: student.fullName,
        empId: student.empId,
        currentLevel: student.currentLevel,
        fromInfo: student.fromInfo,
        departmentId: student.departmentId,
        deptName: student.deptName,
        lineName: student.lineName,
        machineName: student.machineName
      });
    }
  };

  const students = data?.data?.users || [];

  return (
    <div className={`relative w-full ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              disabled={disabled}
              placeholder={placeholder}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              className="h-7 py-0 px-1 text-[10px] text-center"
            />
            {!compact && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400">
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </div>
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 w-[250px]" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-[300px] overflow-y-auto">
            {isFetching && students.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            
            {!isFetching && search.length >= 2 && students.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No operators found.
              </div>
            )}

            {search.length < 2 && (
              <div className="p-4 text-center text-sm text-gray-500 text-xs">
                Type at least 2 characters to search...
              </div>
            )}

            {students.map((student) => (
              <div
                key={student._id}
                className="flex flex-col p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                onClick={() => handleSelect(student)}
              >
                <div className="font-medium text-sm flex items-center gap-2">
                  <User className="h-3 w-3 text-gray-400" />
                  {student.fullName}
                </div>
                <div className="text-xs text-gray-500 ml-5">
                  ID: {student.empId || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default OperatorAutocomplete;
