"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Settings2, ChevronDown, Sparkles, Brain, Zap, Check, Building2, Upload, Loader2, AlertTriangle, BarChart3, Coins, Activity } from "lucide-react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";

interface ConfigPanelProps {
  prompt: string;
  onPromptChange: (prompt: string) => void;
  model: string;
  onModelChange: (model: string) => void;
  isProcessing?: boolean;
  onGenerate?: () => void;
  hasData?: boolean;
  ccEmail?: string;
  onCcEmailChange?: (val: string) => void;
  session: any;
  signature: string;
  onSignatureChange: (val: string) => void;
  ctaText: string;
  onCtaTextChange: (val: string) => void;
  ctaLink: string;
  onCtaLinkChange: (val: string) => void;
  includeHeaderImage: boolean;
  onIncludeHeaderImageChange: (val: boolean) => void;
  includeCta: boolean;
  onIncludeCtaChange: (val: boolean) => void;
  includeSignature: boolean;
  onIncludeSignatureChange: (val: boolean) => void;
  customHeaderImage?: string | null;
  onCustomHeaderImageChange?: (val: string | null) => void;
  customSignatureHtml?: string | null;
  onCustomSignatureHtmlChange?: (val: string | null) => void;
  brands: any[];
  selectedBrandId: string;
  onBrandChange: (val: string) => void;
  attachments?: { name: string, type: string, content: string }[];
  onAttachmentsChange?: (val: { name: string, type: string, content: string }[]) => void;
}

// Helper to handle image uploads to S3
const handleImageUploadToS3 = async (
  e: React.ChangeEvent<HTMLInputElement>,
  callback: (url: string) => void,
  setLoading?: (loading: boolean) => void
) => {
  const file = e.target.files?.[0];
  if (file) {
    if (setLoading) setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.url) {
        callback(data.url);
      } else {
        console.error("Upload failed:", data.error);
        alert("Upload failed: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed. Please try again.");
    } finally {
      if (setLoading) setLoading(false);
    }
  }
};

export function BrandDesignPanel({
  session,
  signature,
  onSignatureChange,
  ctaText,
  onCtaTextChange,
  ctaLink,
  onCtaLinkChange,
  includeHeaderImage,
  onIncludeHeaderImageChange,
  includeCta,
  onIncludeCtaChange,
  includeSignature,
  onIncludeSignatureChange,
  customHeaderImage,
  onCustomHeaderImageChange,
  customSignatureHtml,
  onCustomSignatureHtmlChange,
  brands,
  selectedBrandId,
  onBrandChange,
  attachments,
  onAttachmentsChange,
}: Partial<ConfigPanelProps>) {
  const [openSection, setOpenSection] = useState<"header" | "cta" | "signature" | "attachments" | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const signatureRef = useRef<HTMLDivElement>(null);

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (onAttachmentsChange && attachments) {
          onAttachmentsChange([...attachments, { name: file.name, type: file.type, content: reader.result as string }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index: number) => {
    if (onAttachmentsChange && attachments) {
      const newAtt = [...attachments];
      newAtt.splice(index, 1);
      onAttachmentsChange(newAtt);
    }
  };

  const handleSignaturePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            document.execCommand('insertHTML', false, `<img src="${base64}" alt="Pasted Image" style="max-height: 100px; margin: 4px 0;" />`);
          };
          reader.readAsDataURL(file);
        }
        break;
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl shadow-accent/5 lg:h-full flex flex-col"
    >
      <div className="p-4 sm:p-6 lg:h-full flex flex-col min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.45fr] gap-6 lg:gap-8 lg:h-full min-h-0">
          <div className="flex flex-col space-y-6 lg:overflow-y-auto lg:pr-2 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
            {/* Brand Selection */}
            <div className="space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Brand Profile
                </label>
                <Link href="/brands" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline">
                  Manage Brands
                </Link>
              </div>
              <select
                value={selectedBrandId}
                onChange={(e) => onBrandChange?.(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
              >
                <option value="">No Brand (Manual Settings)</option>
                {brands?.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.brandName} {brand.industry ? `(${brand.industry})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Email Design Settings */}
            <div className="space-y-4 pt-4 border-t border-border shrink-0">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Email Design Settings
              </label>
              <div className="flex w-full border-b border-border overflow-x-auto scrollbar-hide">
                {["header", "cta", "signature"].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setOpenSection(openSection === sec ? null : sec as any)}
                    className={`flex-none sm:flex-1 flex justify-center px-4 sm:px-0 py-2.5 text-[11px] sm:text-xs font-medium border-b-2 transition-colors ${openSection === sec ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                  >
                    <span className={`inline-block whitespace-nowrap transition-all ${(sec === "header" && includeHeaderImage) ||
                      (sec === "cta" && includeCta) ||
                      (sec === "signature" && includeSignature)
                      ? "px-2 py-0.5 border border-success/50 rounded-full bg-success/10 text-success shadow-sm" : ""
                      }`}>
                      {sec === "header" ? "Header Image" : sec === "cta" ? "CTA Button" : "Signature"}
                    </span>
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {openSection && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="bg-card border border-border rounded-xl overflow-hidden mt-2">
                    {openSection === "header" && (
                      <div className="p-4 space-y-4">
                        <select
                          value={!includeHeaderImage ? "none" : (customHeaderImage === "manual" ? "manual" : (brands?.find(b => b.id === selectedBrandId)?.headers.find((h: any) => h.imageUrl === customHeaderImage)?.id || "manual"))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "none") { onIncludeHeaderImageChange?.(false); onCustomHeaderImageChange?.(null); }
                            else if (val === "manual") { onIncludeHeaderImageChange?.(true); onCustomHeaderImageChange?.("manual"); }
                            else {
                              const header = brands?.find(b => b.id === selectedBrandId)?.headers.find((h: any) => h.id === val);
                              if (header) { onIncludeHeaderImageChange?.(true); onCustomHeaderImageChange?.(header.imageUrl); }
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                        >
                          <option value="none">No Header Image</option>
                          {selectedBrandId && brands?.find(b => b.id === selectedBrandId)?.headers.map((h: any) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                          <option value="manual">Add Manually</option>
                        </select>
                        {includeHeaderImage && (
                          <div className="mt-2">
                            {customHeaderImage === "manual" && (
                              <label className="flex flex-col items-center justify-center w-full min-h-[100px] border-2 border-dashed border-border rounded-xl bg-secondary/5 hover:bg-secondary/10 transition-colors cursor-pointer relative overflow-hidden">
                                {isUploadingImage ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Uploading...</span>
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-xs font-medium text-muted-foreground">Click to upload header image</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleImageUploadToS3(e, (url) => onCustomHeaderImageChange?.(url), setIsUploadingImage)}
                                    />
                                  </>
                                )}
                              </label>
                            )}
                            {customHeaderImage && customHeaderImage !== "manual" && (
                              <div className="rounded-xl border border-border bg-secondary/5 p-4 flex flex-col items-center justify-center gap-3">
                                <img
                                  src={customHeaderImage}
                                  alt="Header Preview"
                                  className="max-w-full max-h-[120px] object-contain rounded-lg shadow-sm bg-white border border-border/50"
                                />
                                {!brands?.find(b => b.id === selectedBrandId)?.headers.find((h: any) => h.imageUrl === customHeaderImage) && (
                                  <label className="text-[10px] uppercase tracking-widest font-bold text-primary cursor-pointer hover:text-primary/80 transition-colors">
                                    Change Image
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => handleImageUploadToS3(e, (url) => onCustomHeaderImageChange?.(url), setIsUploadingImage)}
                                    />
                                  </label>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    {openSection === "cta" && (
                      <div className="p-4 space-y-4">
                        <select
                          value={!includeCta ? "none" : (brands?.find(b => b.id === selectedBrandId)?.ctas.find((c: any) => c.text === ctaText && c.link === ctaLink)?.id || "manual")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "none") onIncludeCtaChange?.(false);
                            else if (val === "manual") onIncludeCtaChange?.(true);
                            else {
                              const cta = brands?.find(b => b.id === selectedBrandId)?.ctas.find((c: any) => c.id === val);
                              if (cta) { onIncludeCtaChange?.(true); onCtaTextChange?.(cta.text); onCtaLinkChange?.(cta.link); }
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                        >
                          <option value="none">No CTA Button</option>
                          {selectedBrandId && brands?.find(b => b.id === selectedBrandId)?.ctas.map((cta: any) => (
                            <option key={cta.id} value={cta.id}>{cta.name}</option>
                          ))}
                          <option value="manual">Add Manually</option>
                        </select>
                        {includeCta && (
                          <>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <input type="text" value={ctaLink} onChange={(e) => onCtaLinkChange?.(e.target.value)} placeholder="Link URL" className="px-3 py-2 bg-input border border-border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
                              <input type="text" value={ctaText} onChange={(e) => onCtaTextChange?.(e.target.value)} placeholder="Button Text" className="px-3 py-2 bg-input border border-border text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50" />
                            </div>
                            {ctaText && (
                              <div className="mt-2 rounded-xl border border-border bg-secondary/5 p-3 flex flex-col items-center justify-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Button Preview</span>
                                <a
                                  href={ctaLink || "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs shadow-md shadow-primary/20 hover:opacity-90 transition-opacity mt-1"
                                >
                                  {ctaText}
                                </a>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {openSection === "signature" && (
                      <div className="p-4 space-y-4">
                        <select
                          value={!includeSignature ? "none" : (customSignatureHtml === "manual" ? "manual" : (brands?.find(b => b.id === selectedBrandId)?.signatures.find((s: any) => s.content === customSignatureHtml)?.id || "manual"))}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "none") { onIncludeSignatureChange?.(false); onCustomSignatureHtmlChange?.(null); }
                            else if (val === "manual") { onIncludeSignatureChange?.(true); onCustomSignatureHtmlChange?.("manual"); }
                            else {
                              const sig = brands?.find(b => b.id === selectedBrandId)?.signatures.find((s: any) => s.id === val);
                              if (sig) { onIncludeSignatureChange?.(true); onCustomSignatureHtmlChange?.(sig.content); }
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm"
                        >
                          <option value="none">No Signature</option>
                          {selectedBrandId && brands?.find(b => b.id === selectedBrandId)?.signatures.map((sig: any) => (
                            <option key={sig.id} value={sig.id}>{sig.name}</option>
                          ))}
                          <option value="manual">Add Manually</option>
                        </select>
                        {includeSignature && (
                          <div
                            ref={signatureRef}
                            contentEditable={customSignatureHtml === "manual"}
                            dangerouslySetInnerHTML={{ __html: customSignatureHtml === "manual" ? (signature?.replace(/\n/g, '<br/>') || "") : (customSignatureHtml || "") }}
                            onBlur={(e) => { if (customSignatureHtml === "manual") onSignatureChange?.(e.currentTarget.innerHTML); }}
                            onPaste={handleSignaturePaste}
                            className="w-full min-h-[6rem] p-3 rounded-lg border border-border text-sm bg-input"
                          />
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="lg:border-l lg:border-border lg:pl-8 flex flex-col min-w-0">
            <div className="mb-4">
              <label className="text-sm font-medium text-foreground">Attachments</label>
            </div>

            {/* Dashed Add Attachment Button */}
            <label className="cursor-pointer group flex flex-col items-center justify-center bg-secondary/5 rounded-2xl border border-dashed border-border py-8 px-6 mb-6 hover:border-primary/50 hover:bg-primary/5 transition-all">
              <input type="file" multiple className="hidden" onChange={handleAttachmentUpload} />
              <div className="w-14 h-14 mx-auto rounded-2xl bg-secondary flex items-center justify-center mb-4 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-inner">
                <Upload className="w-7 h-7 text-muted-foreground group-hover:text-primary" />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground group-hover:text-primary transition-colors text-center">
                Add Attachments
              </span>
            </label>

            {/* Uploaded Files List */}
            {attachments && attachments.length > 0 && (
              <div className="flex-1 flex flex-col min-w-0">
                <p className="text-[10px] text-muted-foreground mb-3 uppercase tracking-wider font-bold">Files for Email</p>
                <div className="flex flex-col gap-1.5 w-full overflow-y-auto max-h-[300px] hide-scrollbar">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-card border border-border text-foreground text-xs shadow-sm hover:border-primary/50 transition-all">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                        <span className="truncate flex-1" title={att.name}>{att.name}</span>
                      </div>
                      <button onClick={() => removeAttachment(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 px-1 text-base leading-none">&times;</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function ConfigPanel({
  prompt,
  onPromptChange,
  model,
  onModelChange,
  isProcessing,
  onGenerate,
  hasData,
  ccEmail,
  onCcEmailChange,
}: Partial<ConfigPanelProps>) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);

  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch("/api/models");
        const data = await res.json();
        if (data.models) {
          setAvailableModels(data.models.map((m: any) => ({
            id: m.id,
            name: m.name,
            description: m.description || "Gemini generative model",
            icon: m.id.includes("pro") ? Brain : (m.id.includes("flash") ? Zap : Sparkles),
            badge: m.isLatest ? "Latest" : m.isDeprecated ? "Deprecated" : (m.id.includes("preview") ? "Preview" : (m.id.includes("3") ? "New" : null)),
            color: m.isDeprecated
              ? "from-gray-400 to-gray-500"
              : m.isLatest
                ? "from-emerald-500 to-teal-500"
                : m.id.includes("pro") ? "from-violet-500 to-purple-500" : (m.id.includes("flash") ? "from-amber-500 to-orange-500" : "from-blue-500 to-cyan-500"),
            isDeprecated: m.isDeprecated || false,
            isLatest: m.isLatest || false,
          })));
        }
      } catch (e) { console.error(e); }
    }
    fetchModels();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [usageStats, setUsageStats] = useState<any[]>([]);
  const [showStats, setShowStats] = useState(false);

  const fetchUsageStats = async () => {
    try {
      const res = await fetch("/api/usage");
      const data = await res.json();
      if (data.usage) {
        setUsageStats(data.usage);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsageStats();
  }, [isProcessing]);

  const selectedModel = availableModels.find((m) => m.id === model) || availableModels[0] || { id: "", name: "Select Model", icon: Brain, color: "from-gray-500 to-gray-600", description: "Loading...", badge: null };

  const variables = [
    { label: "{{name}}", color: "from-blue-500 to-cyan-500", description: "Recipient's Name" },
    { label: "{{email}}", color: "from-emerald-500 to-teal-500", description: "Recipient's Email" },
    { label: "{{company}}", color: "from-orange-500 to-amber-500", description: "Company Name" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card shadow-xl shadow-accent/5">
      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-accent" />
              Master Prompt
            </label>
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              {prompt?.length || 0} / 2000
            </span>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => onPromptChange?.(e.target.value)}
            placeholder={`Tell the AI what to write.\n\nExample: "Write a professional outreach to {{name}} at {{company}}. Focus on our new services and keep the tone helpful but direct. Maintain a limit of 150 words."`}
            className="w-full h-32 px-4 py-4 rounded-2xl bg-input border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 transition-all placeholder:text-muted-foreground/50 custom-scrollbar"
          />
          <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <button
                  key={v.label}
                  onClick={() => onPromptChange?.(prompt + (prompt ? " " : "") + v.label)}
                  className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${v.color} text-white text-[11px] font-semibold shadow-sm hover:shadow-md transition-all`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onGenerate}
              disabled={!hasData || isProcessing}
              className="flex items-center justify-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-primary to-accent text-white text-sm font-bold shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Generating...</span></> : <><Sparkles className="w-4 h-4" /><span>Generate</span></>}
            </motion.button>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">AI Model</label>
            <button
              onClick={() => {
                setShowStats(!showStats);
                if (!showStats) fetchUsageStats();
              }}
              className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/80 transition-colors uppercase tracking-wider"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              {showStats ? "Hide Stats" : "Usage & Credits"}
            </button>
          </div>
          <div ref={dropdownRef} className="relative">
            <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-input border border-border hover:border-primary/50 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${selectedModel.color} flex items-center justify-center shadow-md`}>
                  <selectedModel.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium">{selectedModel.name}</p>
                </div>
              </div>
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            </button>
            <AnimatePresence>
              {isDropdownOpen && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute z-20 w-full mt-2 rounded-xl border border-border bg-popover shadow-2xl overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                  {availableModels.map((m) => (
                    <button key={m.id} onClick={() => { onModelChange?.(m.id); setIsDropdownOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-secondary transition-colors ${m.isDeprecated ? "opacity-50" : ""}`}>
                      <div className={`w-8 h-8 rounded-lg ${model === m.id ? `bg-gradient-to-br ${m.color}` : "bg-secondary"} flex items-center justify-center`}>
                        {m.isDeprecated ? (
                          <AlertTriangle className={`w-4 h-4 ${model === m.id ? "text-white" : "text-muted-foreground"}`} />
                        ) : (
                          <m.icon className={`w-4 h-4 ${model === m.id ? "text-white" : "text-muted-foreground"}`} />
                        )}
                      </div>
                      <div className="text-left flex-1">
                        <p className={`text-sm font-medium ${m.isDeprecated ? "line-through text-muted-foreground" : ""}`}>{m.name}</p>
                      </div>
                      {m.badge && (
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                          m.badge === "Latest" ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30" :
                          m.badge === "Deprecated" ? "bg-destructive/10 text-destructive border border-destructive/30" :
                          m.badge === "New" ? "bg-primary/10 text-primary border border-primary/30" :
                          "bg-secondary text-muted-foreground border border-border"
                        }`}>{m.badge}</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Collapsible Stats & Credits Panel */}
          <AnimatePresence>
            {showStats && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mt-3 rounded-xl border border-border bg-secondary/5 p-3.5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary animate-pulse" />
                    Model Analytics
                  </span>
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Total: {usageStats.reduce((acc, curr) => acc + (curr.emailsGenerated || 0), 0)} emails
                  </span>
                </div>

                {usageStats.length === 0 ? (
                  <p className="text-xs text-muted-foreground/75 italic py-1 text-center">No usage recorded yet. Generate emails to see model usage.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                    {usageStats.map((stat, i) => (
                      <div key={i} className="flex flex-col gap-1 p-2 rounded-lg bg-card border border-border/60 hover:border-border transition-all">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold truncate max-w-[160px] text-foreground">{stat.name}</span>
                          <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                            stat.isDeprecated 
                              ? "bg-destructive/10 text-destructive border border-destructive/20" 
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          }`}>
                            {stat.isDeprecated ? "Deprecated" : "Active"}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/30 text-[10px] text-muted-foreground">
                          <div>
                            <p className="font-bold text-foreground">{stat.emailsGenerated}</p>
                            <p className="text-[8px] uppercase tracking-wider font-semibold">Emails</p>
                          </div>
                          <div>
                            <p className="font-bold text-foreground">{(stat.tokensUsed / 1000).toFixed(1)}k</p>
                            <p className="text-[8px] uppercase tracking-wider font-semibold">Tokens</p>
                          </div>
                          <div>
                            <p className="font-bold text-success flex items-center gap-0.5">
                              <Coins className="w-3 h-3 text-success shrink-0" />
                              ${stat.costEst ? stat.costEst.toFixed(4) : "0.00"}
                            </p>
                            <p className="text-[8px] uppercase tracking-wider font-semibold">Cost Est</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2 pt-4 border-t border-border">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <Building2 className="w-3.5 h-3.5 text-primary" />
            CC Recipients (Optional)
          </label>
          <input
            type="email"
            value={ccEmail || ""}
            onChange={(e) => onCcEmailChange?.(e.target.value)}
            placeholder="colleague@company.com"
            className="w-full px-3 py-2 rounded-xl bg-input border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      </div>
    </motion.div>
  );
}
