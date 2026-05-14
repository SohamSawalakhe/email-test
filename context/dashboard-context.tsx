"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface EmailPreview {
  recipientEmail: string;
  generated: any;
  original: any;
  status?: "pending" | "sent" | "failed";
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
  setCsvData: (data: string[][]) => void;
  setHasDataHeader: (val: boolean) => void;
  setFileName: (name: string | null) => void;
  setActiveTab: (tab: "csv" | "manual" | "data") => void;
  setManualInput: (val: string) => void;
  setParsedData: (data: string[][]) => void;
  setTotalRecipients: (count: number) => void;
  setCcEmail: (val: string) => void;
  setPrompt: (val: string) => void;
  setModel: (val: string) => void;
  setPreviews: React.Dispatch<React.SetStateAction<EmailPreview[]>>;
  setHeaders: (headers: string[]) => void;
  setIsProcessing: (val: boolean) => void;
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
  const [model, setModel] = useState("models/gemini-2.0-flash-lite-preview-02-05");
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
