"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Upload, Users, FileSpreadsheet, X, CheckCircle2, Maximize, Layers } from "lucide-react";
import { useState, useCallback } from "react";
import * as XLSX from "xlsx";

interface InputSectionProps {
  onDataChange: (data: string[][], hasHeader: boolean, fileName: string | null, tab: "csv" | "manual" | "data") => void;
  activeTab: "csv" | "manual" | "data";
  fileName: string | null;
  parsedData: string[][];
  manualInput: string;
  onManualInputChange: (val: string) => void;
}

export function InputSection({ 
  onDataChange, 
  activeTab, 
  fileName, 
  parsedData, 
  manualInput, 
  onManualInputChange 
}: InputSectionProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [rowCount, setRowCount] = useState(0);
  const [hasHeaderRow, setHasHeaderRow] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  // Sync rowCount locally when global parsedData changes
  const [localParsedData, setLocalParsedData] = useState<string[][]>([]);
  
  const setActiveTab = (tab: "csv" | "manual" | "data") => {
    onDataChange(parsedData, hasHeaderRow, fileName, tab);
  };



  const aiSmartParse = async (raw: any[][]): Promise<{ cleaned: string[][], hasHeader: boolean }> => {
    setIsParsing(true);
    let processed = raw.map(row =>
      row.map(cell => (cell === null || cell === undefined) ? "" : String(cell).trim())
    );
    processed = processed.filter(row => row.some(cell => cell !== ""));
    if (processed.length === 0) {
      setIsParsing(false);
      return { cleaned: [], hasHeader: false };
    }

    let hasHeader = false;

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData: processed.slice(0, 100) })
      });
      if (res.ok) {
        const { rules } = await res.json();
        
        if (rules.isTransposed) {
          const maxCols = Math.max(...processed.map(r => r.length));
          const transposed: string[][] = [];
          for (let c = 0; c < maxCols; c++) {
            const newRow: string[] = [];
            for (let r = 0; r < processed.length; r++) {
              let val = processed[r][c] || "";
              if (c === 0) val = String(val).replace(/:$/, "");
              newRow.push(val);
            }
            transposed.push(newRow);
          }
          processed = transposed;
          processed = processed.filter(row => row.some(cell => cell !== ""));
        }

        hasHeader = rules.headerRowIndex !== -1;
        
        const hIdx = rules.headerRowIndex !== undefined ? rules.headerRowIndex : 0;
        const dIdx = rules.dataStartRowIndex !== undefined ? rules.dataStartRowIndex : Math.max(0, hIdx + 1);
        
        if (hIdx >= 0 && hIdx < processed.length && dIdx < processed.length) {
          const headers = processed[hIdx];
          const dataRows = processed.slice(dIdx);
          processed = [headers, ...dataRows];
        } else if (hIdx >= 0 && hIdx < processed.length) {
          processed = processed.slice(hIdx);
        }
      }
    } catch (e) {
      console.error("AI parse failed, using fallback", e);
      // Fallback
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (processed.length > 1) {
        const firstRowHasEmail = processed[0].some(c => emailRegex.test(c));
        const secondRowHasEmail = processed[1].some(c => emailRegex.test(c));
        hasHeader = !(firstRowHasEmail && !secondRowHasEmail);
      } else {
        hasHeader = true;
      }
    }

    const maxCols = Math.max(...processed.map(r => r.length));
    processed = processed.map(r => {
      const newRow = [...r];
      while (newRow.length < maxCols) newRow.push("");
      return newRow;
    });

    setIsParsing(false);
    return { cleaned: processed, hasHeader };
  };

  const applySheetData = useCallback(async (wb: XLSX.WorkBook, sheetName: string, fName: string | null = fileName) => {
    const sheet = wb.Sheets[sheetName];
    const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as any[][];
    const { cleaned, hasHeader } = await aiSmartParse(raw);

    setHasHeaderRow(hasHeader);
    setCurrentPage(1);
    setActiveSheet(sheetName);
    onDataChange(cleaned, hasHeader, fName, "data");
  }, [onDataChange, fileName]);

  const processFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "buffer" });
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      await applySheetData(wb, wb.SheetNames[0], file.name);
    } catch (err) {
      console.error("Failed to parse file:", err);
      onDataChange([], false, null, "csv");
      setRowCount(0);
      alert("Could not read file. Please ensure it is a valid CSV or Excel file.");
    }
  }, [applySheetData, onDataChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }, [processFile]);

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      const emails = manualInput
        .split(/[\n,]/)
        .map((email) => email.trim())
        .filter((email) => email && email.includes("@"));
      const data = [["Email"], ...emails.map(e => [e])];
      onDataChange(data, true, "Manual Entry", "data");
    }
  };

  const clearFile = () => {
    setWorkbook(null);
    setSheetNames([]);
    setActiveSheet(null);
    onDataChange([], false, null, "csv");
  };

  const tabs = [
    { id: "csv" as const, label: "Upload File", icon: Upload },
    { id: "manual" as const, label: "Manual Entry", icon: Users },
    ...(parsedData.length > 0 ? [{ id: "data" as const, label: "Parsed Data", icon: FileSpreadsheet }] : []),
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl shadow-primary/5 dark:shadow-none flex flex-col h-full"
    >
      <div className="px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-accent/5 to-transparent dark:from-primary/10 dark:via-accent/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recipients</h2>
              <p className="text-xs text-muted-foreground">Import your contact list</p>
            </div>
          </div>
          {rowCount > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20"
            >
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                {rowCount} {rowCount === 1 ? 'Recipient' : 'Recipients'} Found
              </span>
            </motion.div>
          )}
        </div>
      </div>

      <div className="flex border-b border-border bg-secondary/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium transition-all ${activeTab === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground/80"
              }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <motion.div
                layoutId="inputActiveTab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-accent"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6">
        <AnimatePresence mode="wait">
          {activeTab === "csv" ? (
            <motion.div
              key="csv"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {isParsing ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                    className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full mb-4"
                  />
                  <p className="text-sm font-medium text-foreground">AI is organizing your data...</p>
                </div>
              ) : fileName ? (
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-between p-5 rounded-xl bg-gradient-to-r from-success/10 to-success/5 border border-success/20"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-success/20 shadow-lg shadow-success/10">
                        <FileSpreadsheet className="w-6 h-6 text-success" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{fileName}</p>
                          <CheckCircle2 className="w-4 h-4 text-success" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rowCount} Recipients found
                          {sheetNames.length > 1 && ` · ${sheetNames.length} sheets`}
                        </p>
                      </div>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={clearFile}
                      className="p-2 rounded-lg hover:bg-secondary transition-colors"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </motion.button>
                  </motion.div>

                  {workbook && sheetNames.length > 1 && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Select Sheet
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {sheetNames.map((name) => (
                          <button
                            key={name}
                            onClick={() => applySheetData(workbook, name)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${activeSheet === name
                              ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                              : "bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                              }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </div>
              ) : (
                <motion.label
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className={`flex flex-col items-center justify-center gap-4 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${isDragging
                    ? "border-primary bg-gradient-to-br from-primary/10 to-accent/10"
                    : "border-border hover:border-primary/50 bg-secondary/20 hover:bg-gradient-to-br hover:from-primary/5 hover:to-accent/5"
                    }`}
                >
                  <motion.div
                    animate={isDragging ? { y: -8, scale: 1.1 } : { y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className={`flex items-center justify-center w-16 h-16 rounded-2xl transition-all ${isDragging
                      ? "bg-gradient-to-br from-primary to-accent shadow-xl shadow-primary/30"
                      : "bg-secondary"
                      }`}
                  >
                    <Upload className={`w-7 h-7 ${isDragging ? "text-white" : "text-muted-foreground"}`} />
                  </motion.div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Drop your file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse from your computer</p>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-xs text-muted-foreground">
                    <span>Supports: .csv, .xlsx, .xls</span>
                  </div>
                  <div className="px-6 py-2.5 mt-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-md shadow-primary/20 transition-all hover:bg-primary/90 cursor-pointer">
                    Browse Files
                  </div>
                  <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} className="hidden" />
                </motion.label>
              )}
            </motion.div>
          ) : activeTab === "data" ? (
            <motion.div
              key="data"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {parsedData.length > 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card overflow-hidden text-xs shadow-sm"
                >
                  <div className="overflow-x-auto max-h-[350px] hide-scrollbar">
                    <table className="w-full text-left">
                      <thead className="bg-secondary/50 sticky top-0 z-10 backdrop-blur-sm shadow-sm">
                        <tr>
                          <th className="px-4 py-2 font-semibold text-muted-foreground w-12 text-center border-r border-border/50">#</th>
                          {hasHeaderRow ? (
                            parsedData[0].map((header, i) => (
                              <th key={i} className="px-4 py-2 font-semibold whitespace-nowrap text-muted-foreground">
                                {String(header)}
                              </th>
                            ))
                          ) : (
                            parsedData[0].map((_, i) => (
                              <th key={i} className="px-4 py-2 font-semibold whitespace-nowrap text-muted-foreground">
                                Column {i + 1}
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {(() => {
                          const dataRows = hasHeaderRow ? parsedData.slice(1) : parsedData;
                          const startIndex = (currentPage - 1) * rowsPerPage;
                          const currentRows = dataRows.slice(startIndex, startIndex + rowsPerPage);
                          return currentRows.map((row, i) => {
                            const originalRowIndex = hasHeaderRow ? startIndex + i + 1 : startIndex + i;
                            return (
                              <tr key={originalRowIndex} className="transition-colors hover:bg-secondary/20">
                                <td className="px-4 py-2 text-muted-foreground/60 text-center border-r border-border/50 font-mono text-[10px]">{startIndex + i + 1}</td>
                                {row.map((cell, j) => {
                                  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(cell).trim());
                                  return (
                                    <td key={j} className={`px-4 py-2 whitespace-nowrap max-w-[250px] truncate ${isEmail ? "text-primary font-medium bg-primary/5" : "text-foreground"}`} title={String(cell)}>{String(cell)}</td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-secondary/30 border-t border-border">
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-4">
                      {(() => {
                        const dataRows = hasHeaderRow ? parsedData.slice(1) : parsedData;
                        const totalPages = Math.ceil(dataRows.length / rowsPerPage);
                        const startIndex = (currentPage - 1) * rowsPerPage;
                        return (
                          <>
                            <span>
                              Showing {Math.min(startIndex + 1, dataRows.length)}-{Math.min(startIndex + rowsPerPage, dataRows.length)} of {dataRows.length} rows
                            </span>
                            {totalPages > 1 && (
                              <div className="flex items-center gap-2 ml-2">
                                <button
                                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                  disabled={currentPage === 1}
                                  className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                                >
                                  Prev
                                </button>
                                <span>{currentPage} / {totalPages}</span>
                                <button
                                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                  disabled={currentPage === totalPages}
                                  className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 disabled:opacity-50 transition-colors"
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    <button onClick={() => setIsFullscreen(true)} className="flex items-center gap-1 px-2 py-1 text-[10px] uppercase tracking-wider font-bold text-primary hover:bg-primary/10 rounded transition-colors">
                      <Maximize className="w-3 h-3" />
                      Fullscreen
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="p-10 text-center text-muted-foreground">No data available</div>
              )}
            </motion.div>
          ) : activeTab === "manual" ? (
            <motion.div
              key="manual"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <textarea
                value={manualInput}
                onChange={(e) => onManualInputChange(e.target.value)}
                placeholder={"Enter email addresses, one per line:\n\njohn@company.com\njane@startup.io\ncontact@business.com"}
                className="w-full h-44 px-4 py-4 rounded-xl bg-input border border-border text-foreground placeholder-muted-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all font-mono"
              />
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={handleManualSubmit}
                disabled={!manualInput.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
              >
                Add Recipients
              </motion.button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {isFullscreen && parsedData.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-background/80 backdrop-blur-sm p-6"
          >
            <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between p-4 border-b border-border bg-secondary/50">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-success" />
                  <h3 className="font-semibold text-foreground">
                    {fileName}{activeSheet ? ` · ${activeSheet}` : ""} — Data Preview
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground ml-2">
                    {parsedData.length - (hasHeaderRow ? 1 : 0)} rows
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {workbook && sheetNames.length > 1 && (
                    <div className="flex items-center gap-1.5">
                      {sheetNames.map((name) => (
                        <button
                          key={name}
                          onClick={() => applySheetData(workbook, name)}
                          className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${activeSheet === name
                            ? "bg-primary text-white border-primary"
                            : "bg-card text-muted-foreground border-border hover:border-primary/50"
                            }`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setIsFullscreen(false)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-card hide-scrollbar">
                <table className="w-full text-left text-sm">
                  <thead className="bg-secondary/50 sticky top-0 z-10 backdrop-blur-md shadow-sm">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-muted-foreground w-12 text-center border-r border-border/50">#</th>
                      {hasHeaderRow ? (
                        parsedData[0].map((header, i) => (
                          <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap border-b border-border text-muted-foreground">
                            {String(header)}
                          </th>
                        ))
                      ) : (
                        parsedData[0].map((_, i) => (
                          <th key={i} className="px-4 py-3 font-semibold whitespace-nowrap border-b border-border text-muted-foreground">
                            Column {i + 1}
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(hasHeaderRow ? parsedData.slice(1) : parsedData).map((row, i) => {
                      const originalRowIndex = hasHeaderRow ? i + 1 : i;
                      return (
                        <tr key={originalRowIndex} className="transition-colors hover:bg-secondary/20">
                          <td className="px-4 py-2 text-muted-foreground/60 text-center border-r border-border/50 font-mono text-xs">{i + 1}</td>
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 whitespace-nowrap max-w-[400px] truncate text-foreground" title={cell}>{cell}</td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
