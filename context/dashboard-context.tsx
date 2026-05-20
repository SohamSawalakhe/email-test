"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { DEFAULT_MODEL } from "@/lib/gemini-models";

export interface EmailPreview {
  id?: string;
  recipientEmail?: string;
  generated: any;
  original: any;
  status?: string;
}

interface DashboardContextType {
  // Data State
  csvData: string[][];
  hasDataHeader: boolean;
  fileName: string | null;
  activeTab: "csv" | "manual" | "data";
  manualInput: string;
  parsedData: string[][];
  totalRecipients: number;
  ccEmail: string;
  
  // Generation State
  prompt: string;
  model: string;
  previews: EmailPreview[];
  headers: string[];
  isProcessing: boolean;
  failedEmails: Set<number>;

  // Setters
  setCsvData: React.Dispatch<React.SetStateAction<string[][]>>;
  setHasDataHeader: React.Dispatch<React.SetStateAction<boolean>>;
  setFileName: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveTab: React.Dispatch<React.SetStateAction<"csv" | "manual" | "data">>;
  setManualInput: React.Dispatch<React.SetStateAction<string>>;
  setParsedData: React.Dispatch<React.SetStateAction<string[][]>>;
  setTotalRecipients: React.Dispatch<React.SetStateAction<number>>;
  setCcEmail: React.Dispatch<React.SetStateAction<string>>;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  setPreviews: React.Dispatch<React.SetStateAction<EmailPreview[]>>;
  setHeaders: React.Dispatch<React.SetStateAction<string[]>>;
  setIsProcessing: React.Dispatch<React.SetStateAction<boolean>>;
  setFailedEmails: React.Dispatch<React.SetStateAction<Set<number>>>;
  
  // Helpers
  handleDataChange: (data: string[][], isHeader: boolean, fName: string | null, tab: "csv" | "manual" | "data") => void;
  resetGeneration: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [hasDataHeader, setHasDataHeader] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"csv" | "manual" | "data">("csv");
  const [manualInput, setManualInput] = useState("");
  const [parsedData, setParsedData] = useState<string[][]>([]);
  const [totalRecipients, setTotalRecipients] = useState(0);
  const [ccEmail, setCcEmail] = useState("");

  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [previews, setPreviews] = useState<EmailPreview[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [failedEmails, setFailedEmails] = useState<Set<number>>(new Set());

  const handleDataChange = useCallback((data: string[][], isHeader: boolean = true, fName: string | null = null, tab: "csv" | "manual" | "data" = "csv") => {
    setCsvData(data);
    setParsedData(data);
    setHasDataHeader(isHeader);
    setFileName(fName);
    setActiveTab(tab);
    setPreviews([]);
    setHeaders([]);
    setFailedEmails(new Set());
    const count = isHeader ? Math.max(0, data.length - 1) : data.length;
    setTotalRecipients(count);
  }, []);

  const resetGeneration = useCallback(() => {
    setPreviews([]);
    setFailedEmails(new Set());
  }, []);

  return (
    <DashboardContext.Provider value={{
      csvData, hasDataHeader, fileName, activeTab, manualInput, parsedData, totalRecipients, ccEmail,
      prompt, model, previews, headers, isProcessing, failedEmails,
      setCsvData, setHasDataHeader, setFileName, setActiveTab, setManualInput, setParsedData, setTotalRecipients, setCcEmail,
      setPrompt, setModel, setPreviews, setHeaders, setIsProcessing, setFailedEmails,
      handleDataChange, resetGeneration
    }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
