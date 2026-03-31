import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { IconSearch, IconX } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";

const SearchInput = ({
  placeholder,
  value,
  onChange,
  debounceTime = 500,
  className = "",
  ...props
}) => {
  const { t } = useTranslate();
  const effectivePlaceholder = placeholder || t("ui.searchPlaceholder");
  const [searchTerm, setSearchTerm] = useState(value || "");

  // Debounce the search term
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(searchTerm);
    }, debounceTime);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceTime, onChange]);

  // Update internal state if external value changes
  useEffect(() => {
    setSearchTerm(value || "");
  }, [value]);

  const handleClear = () => {
    setSearchTerm("");
    onChange("");
  };

  return (
    <div className={`relative ${className}`}>
      <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
      <Input
        placeholder={effectivePlaceholder}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="pl-10 pr-10"
        {...props}
      />
      {searchTerm && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <IconX className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export default SearchInput;