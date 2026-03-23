import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

import en from "@/locales/en.json";
import pa from "@/locales/pa.json";

export type Language = "en" | "pa";

type Translations = typeof en;

interface LanguageContextType {
  language: Language;
  t: Translations;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const TRANSLATIONS: Record<Language, Translations> = { en, pa };

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLangState] = useState<Language>("en");

  useEffect(() => {
    AsyncStorage.getItem("app_language").then((stored) => {
      if (stored === "en" || stored === "pa") setLangState(stored);
    });
  }, []);

  function setLanguage(lang: Language) {
    setLangState(lang);
    AsyncStorage.setItem("app_language", lang);
  }

  function toggleLanguage() {
    setLanguage(language === "en" ? "pa" : "en");
  }

  return (
    <LanguageContext.Provider value={{ language, t: TRANSLATIONS[language], toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
