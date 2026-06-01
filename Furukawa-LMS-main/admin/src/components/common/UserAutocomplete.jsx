import React, { useState, useEffect } from 'react';
import { useLazyGetAllStudentsQuery } from '@/Redux/AllApi/InstructorApi';
import { useLazyGetAllUsersQuery } from '@/Redux/AllApi/UserApi';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Search, User } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { cn } from '@/lib/utils';

const UserAutocomplete = ({
  departmentId,
  value,
  onChange,
  placeholder = "Search user...",
  disabled = false,
  className = "",
  compact = false,
  inputClassName = "",
  clearOnSelect = false,
  mode = "student", // "student" or "all"
  excludeTrainers = false,
  excludeAdmins = false,
  includeTemporary = false,
  onTextChange = null
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const debouncedSearch = useDebounce(search, 500);

  const [triggerStudents, { data: studentsData, isFetching: isFetchingStudents }] = useLazyGetAllStudentsQuery();
  const [triggerAll, { data: allUsersData, isFetching: isFetchingAll }] = useLazyGetAllUsersQuery();

  const isFetching = mode === "all" ? isFetchingAll : isFetchingStudents;
  const data = mode === "all" ? allUsersData : studentsData;

  useEffect(() => {
    if (open && debouncedSearch.length >= 2) {
      const searchParams = {
        search: debouncedSearch,
        limit: 10
      };
      if (departmentId) {
        searchParams.departmentId = departmentId;
      }

      if (mode === "all") {
        if (excludeTrainers) searchParams.excludeTrainers = "true";
        if (excludeAdmins) searchParams.excludeAdmins = "true";
        if (includeTemporary) searchParams.includeTemporary = String(includeTemporary);
        triggerAll(searchParams);
      } else {
        if (includeTemporary) searchParams.includeTemporary = String(includeTemporary);
        triggerStudents(searchParams);
      }
    }
  }, [debouncedSearch, departmentId, open, triggerAll, triggerStudents, mode, excludeTrainers, excludeAdmins]);

  // Sync internal search state with external value when it changes externally
  useEffect(() => {
    setSearch(value || "");
  }, [value]);

  const handleSelect = (user) => {
    if (clearOnSelect) {
      setSearch("");
    } else {
      setSearch(user.fullName);
    }
    setOpen(false);
    if (onChange) {
      onChange({
        ...user,
        fullName: user.fullName,
        empId: user.empId,
        userName: user.userName,
        currentLevel: user.currentLevel,
        fromInfo: user.fromInfo,
        departmentId: user.departmentId,
        deptName: user.deptName,
        lineName: user.lineName,
        machineName: user.machineName || user.stationName,
        stationName: user.stationName || user.machineName,
        id: user.id || user._id
      });
    }
  };

  const users = data?.data?.users || [];

  return (
    <div className={cn("relative w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              disabled={disabled}
              placeholder={placeholder}
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                setOpen(true);
                if (onTextChange) onTextChange(val);
              }}
              onFocus={() => setOpen(true)}
              className={cn(compact ? "h-7 py-0 px-0 text-[10px] text-center" : "h-9", inputClassName)}
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
          className="p-0 w-[250px] z-[9999]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="max-h-[300px] overflow-y-auto bg-white rounded-md shadow-lg border">
            {isFetching && users.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}

            {!isFetching && debouncedSearch.length >= 2 && users.length === 0 && (
              <div className="p-4 text-center text-sm text-gray-500">
                No users found.
              </div>
            )}

            {debouncedSearch.length < 2 && (
              <div className="p-4 text-center text-sm text-gray-500 text-xs">
                Type at least 2 characters to search...
              </div>
            )}

            {users.map((user) => (
              <div
                key={user._id || user.id}
                className="flex flex-col p-2 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                onClick={() => handleSelect(user)}
              >
                <div className="font-medium text-sm flex items-center gap-2">
                  <User className="h-3 w-3 text-gray-400" />
                  {user.fullName}
                </div>
                <div className="text-xs text-gray-500 ml-5">
                  ID: {user.empId || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default UserAutocomplete;

