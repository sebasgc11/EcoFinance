import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@EcoFinanceApp:currency";

export interface CurrencyOption {
  code: string;
  label: string;
  locale: string;
}

export const currencyOptions: CurrencyOption[] = [
  { code: "COP", label: "Peso colombiano", locale: "es-CO" },
  { code: "MXN", label: "Peso mexicano", locale: "es-MX" },
  { code: "USD", label: "Dólar estadounidense", locale: "en-US" },
  { code: "EUR", label: "Euro", locale: "es-ES" },
  { code: "ARS", label: "Peso argentino", locale: "es-AR" },
  { code: "PEN", label: "Sol peruano", locale: "es-PE" },
];

interface CurrencyContextData {
  currency: CurrencyOption;
  setCurrencyCode: (code: string) => Promise<void>;
  formatCurrency: (value: number) => string;
  loading: boolean;
}

const defaultCurrency = currencyOptions[0];

const CurrencyContext = createContext<CurrencyContextData | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyOption>(defaultCurrency);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreCurrency = async () => {
      try {
        const storedCode = await AsyncStorage.getItem(STORAGE_KEY);
        if (!storedCode) {
          return;
        }

        const matched = currencyOptions.find((item) => item.code === storedCode);
        if (matched) {
          setCurrency(matched);
        }
      } finally {
        setLoading(false);
      }
    };

    restoreCurrency();
  }, []);

  const setCurrencyCode = async (code: string) => {
    const matched = currencyOptions.find((item) => item.code === code);
    if (!matched) {
      return;
    }

    setCurrency(matched);
    await AsyncStorage.setItem(STORAGE_KEY, matched.code);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat(currency.locale, {
      style: "currency",
      currency: currency.code,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));

  const value = useMemo(
    () => ({
      currency,
      setCurrencyCode,
      formatCurrency,
      loading,
    }),
    [currency, loading]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);

  if (!context) {
    throw new Error("useCurrency debe usarse dentro de CurrencyProvider.");
  }

  return context;
}
