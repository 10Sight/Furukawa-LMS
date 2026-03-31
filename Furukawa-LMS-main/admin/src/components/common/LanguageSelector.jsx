import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { languageOptions } from "@/localization/translations";
import { selectLanguage, setLanguage } from "@/Redux/Slice/LocalizationSlice";
import useTranslate from "@/hooks/useTranslate";

const LanguageSelector = () => {
  const dispatch = useDispatch();
  const currentLanguage = useSelector(selectLanguage);
  const { t } = useTranslate();

  const handleChange = (code) => {
    if (!code || code === currentLanguage) return;
    dispatch(setLanguage(code));
  };

  const active =
    languageOptions.find((l) => l.code === currentLanguage) || languageOptions[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-full hover:bg-gray-100 text-gray-600"
        >
          <Globe2 className="h-5 w-5" />
          <span className="sr-only">{t("label.language")}</span>
          <span className="absolute -bottom-1 right-0 text-[10px] font-semibold bg-white rounded-full px-1 shadow-sm">
            {active.shortLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-gray-500">
          {t("label.language")}
        </DropdownMenuLabel>
        {languageOptions.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleChange(lang.code)}
            className={
              lang.code === currentLanguage
                ? "bg-gray-100 font-medium cursor-default"
                : "cursor-pointer"
            }
          >
            <span className="mr-2 text-base leading-none">{lang.flag}</span>
            <span className="text-sm">{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
