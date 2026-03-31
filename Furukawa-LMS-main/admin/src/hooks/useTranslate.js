import { useCallback } from "react";
import { useSelector } from "react-redux";
import { selectLanguage } from "@/Redux/Slice/LocalizationSlice";
import { translations } from "@/localization/translations";

export default function useTranslate() {
  const language = useSelector(selectLanguage);

  const t = useCallback(
    (key) => {
      if (!key) return "";
      return (
        translations[language]?.[key] ??
        translations.en?.[key] ??
        key
      );
    },
    [language]
  );

  return { t, language };
}
