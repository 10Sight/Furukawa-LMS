import React from "react";
import { Button } from "@/components/ui/button";
import { IconX } from "@tabler/icons-react";
import useTranslate from "@/hooks/useTranslate";

const FilterBar = ({
  filters = [],
  onClearFilters,
  className = "",
}) => {
  const { t } = useTranslate();
  if (filters.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">{t("ui.filters")}</span>
      {filters.map((filter, index) => (
        <div
          key={index}
          className="inline-flex items-center gap-1 px-3 py-1 text-sm bg-muted rounded-full"
        >
          <span className="font-medium">{filter.label}:</span>
          <span>{filter.value}</span>
        </div>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearFilters}
        className="h-8 gap-1"
      >
        <IconX className="h-3 w-3" />
        {t("ui.clearAll")}
      </Button>
    </div>
  );
};

export default FilterBar;