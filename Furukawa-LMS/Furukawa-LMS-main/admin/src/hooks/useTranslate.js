import { useCallback } from "react";
import { useSelector } from "react-redux";
import { selectLanguage } from "@/context/state/slices/LocalizationSlice.js";
import { translations } from "@/constants/localization/translations.js";

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
