// Languages offered for the explanation. "deepl" is DeepL's target code.
export const LANGUAGES: { code: string; label: string; name: string; deepl: string; speech: string; rtl?: boolean }[] = [
  { code: "en", label: "English", name: "English", deepl: "EN-US", speech: "en-US" },
  { code: "fr", label: "Français", name: "French", deepl: "FR", speech: "fr-FR" },
  { code: "es", label: "Español", name: "Spanish", deepl: "ES", speech: "es-ES" },
  { code: "ar", label: "العربية", name: "Arabic", deepl: "AR", speech: "ar-SA", rtl: true },
  { code: "zh", label: "中文", name: "Simplified Chinese", deepl: "ZH-HANS", speech: "zh-CN" },
  { code: "pt", label: "Português", name: "Portuguese (Brazil)", deepl: "PT-BR", speech: "pt-BR" },
  { code: "uk", label: "Українська", name: "Ukrainian", deepl: "UK", speech: "uk-UA" },
  { code: "tr", label: "Türkçe", name: "Turkish", deepl: "TR", speech: "tr-TR" },
];
