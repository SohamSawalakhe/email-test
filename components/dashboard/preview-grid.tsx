"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Loader2, Mail, FileText, Eye, Edit2, CheckCircle2, AlertTriangle, SendHorizonal } from "lucide-react";

interface EmailPreview {
  original: any;
  generated: string;
  status?: string;
  recipientEmail?: string;
}

interface PreviewGridProps {
  previews: EmailPreview[];
  isProcessing?: boolean;
  totalRecipients?: number;
  onPreviewEdit?: (index: number, newGenerated: string) => void;
  hasData: boolean;
  signature?: string;
  ctaText?: string;
  ctaLink?: string;
  customHeaderImage?: string | null;
  customSignatureHtml?: string | null;
  includeHeaderImage?: boolean;
  includeCta?: boolean;
  includeSignature?: boolean;
  failedIndices?: Set<number>;
  ccEmail?: string;
}

export function PreviewGrid({
  previews,
  isProcessing = false,
  totalRecipients = 0,
  onPreviewEdit,
  hasData,
  signature = "",
  ctaText = "",
  ctaLink = "",
  customHeaderImage,
  customSignatureHtml,
  includeHeaderImage,
  includeCta,
  includeSignature,
  failedIndices = new Set(),
  ccEmail,
}: PreviewGridProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editState, setEditState] = useState<any>(null);

  const startEditing = (index: number, parsed: any) => {
    setEditingIndex(index);
    setEditState(typeof parsed === 'string' ? parsed : JSON.parse(JSON.stringify(parsed)));
  };

  const saveEditing = (index: number) => {
    if (onPreviewEdit) {
      onPreviewEdit(index, typeof editState === 'string' ? editState : JSON.stringify(editState));
    }
    setEditingIndex(null);
    setEditState(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl border border-border bg-card overflow-hidden shadow-xl shadow-primary/5 dark:shadow-none h-full flex flex-col"
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 via-accent/5 to-transparent dark:from-primary/10 dark:via-accent/10 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/20">
            <Eye className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Preview</h2>
            <p className="text-xs text-muted-foreground">AI-generated emails</p>
          </div>
        </div>
      </div>

      {/* Generation Progress Bar */}
      {(isProcessing || (previews.length > 0 && totalRecipients > 0 && previews.length < totalRecipients)) && (
        <div className="px-4 sm:px-6 py-3 border-b border-border bg-secondary/20 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-[11px] font-semibold text-accent uppercase tracking-wider">Generating...</span>
            </div>
            <span className="text-[11px] font-semibold text-foreground tabular-nums">
              {previews.length} <span className="text-muted-foreground font-normal">/ {totalRecipients} emails</span>
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: totalRecipients > 0 ? `${(previews.length / totalRecipients) * 100}%` : '0%' }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            />
          </div>
        </div>
      )}

      <div className="p-4 sm:p-6 flex-1 overflow-y-auto min-h-0">
        {previews.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
                opacity: [0.5, 0.8, 0.5]
              }}
              transition={{ duration: 3, repeat: Infinity }}
              className="flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 mb-6"
            >
              <Sparkles className="w-9 h-9 text-primary dark:text-accent" />
            </motion.div>
            <h3 className="text-base font-medium text-foreground mb-2">
              {hasData ? "Ready to generate" : "No recipients yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {hasData
                ? "Click \"Generate\" to preview AI-generated emails for your recipients"
                : "Upload a CSV or manually enter recipients to get started"}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {previews.map((preview, index) => {
                let parsed: any;
                try {
                  parsed = typeof preview.generated === 'string' ? JSON.parse(preview.generated) : preview.generated;
                } catch (e) {
                  parsed = preview.generated;
                }
                const isEditing = editingIndex === index;

                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: 0.4,
                      delay: index * 0.1,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                    className={`rounded-xl border ${preview.status === "failed" ? "border-destructive/30 bg-destructive/5" : "border-border bg-gradient-to-br from-secondary/30 to-transparent"} overflow-hidden`}
                  >
                    {/* Card Header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${preview.status === "failed" ? "border-destructive/20 bg-destructive/10" : "border-border bg-gradient-to-r from-primary/5 to-accent/5 dark:from-primary/10 dark:to-accent/10"}`}>
                      <div className="flex items-center gap-2">
                        <Mail className={`w-4 h-4 ${preview.status === "failed" ? "text-destructive" : "text-primary"}`} />
                        <span className="text-xs font-medium text-foreground">
                          Email #{index + 1}
                        </span>
                        {(failedIndices.has(index) || preview.status === "failed") && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-destructive/10 border border-destructive/30 text-destructive text-[10px] font-semibold">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {preview.status === "failed" ? "Invalid Email" : "Send Failed"}
                          </span>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full ${preview.status === "failed" ? "bg-destructive/10 text-destructive" : "bg-gradient-to-r from-primary/10 to-accent/10 text-primary dark:text-accent"} text-[10px] font-semibold`}>
                        {preview.status === "failed" ? "Failed" : "AI Generated"}
                      </span>
                    </div>

                    <div className="grid md:grid-cols-3 relative">
                      {/* Original Data */}
                      <div className="p-4 border-b md:border-b-0 md:border-r border-border md:col-span-1">
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Source Data
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-input border border-border">
                          {preview.recipientEmail && preview.recipientEmail !== "INVALID_EMAIL" && (
                            <div className="mb-2 pb-2 border-b border-border/50">
                              <span className="text-[10px] font-semibold text-primary block mb-0.5">Extracted Email:</span>
                              <span className="text-[11px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded break-all">{preview.recipientEmail}</span>
                            </div>
                          )}
                          <code className="text-[10px] text-muted-foreground font-mono break-all whitespace-pre-wrap flex flex-col gap-1">
                            {Array.isArray(preview.original)
                              ? preview.original.join(", ")
                              : typeof preview.original === 'object'
                                ? Object.entries(preview.original).map(([k, v]) => (
                                  <span key={k}>
                                    <span className="font-semibold text-foreground/70">{k}:</span> {String(v)}
                                  </span>
                                ))
                                : String(preview.original)}
                          </code>
                        </div>
                      </div>

                      {/* Arrow indicator (hidden on mobile) */}
                      <div className="hidden md:flex absolute left-[33.333%] top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-primary to-accent shadow-lg">
                          <ArrowRight className="w-4 h-4 text-white" />
                        </div>
                      </div>

                      {/* Generated Email */}
                      <div className="p-4 md:col-span-2">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Sparkles className="w-3.5 h-3.5 text-accent" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">
                              Generated Email
                            </span>
                            {preview.recipientEmail && preview.recipientEmail !== "INVALID_EMAIL" && (
                              <>
                                <span className="text-muted-foreground/30">•</span>
                                <div className="flex flex-col gap-1">
                                  <span className="text-[11px] font-medium text-foreground px-2 py-0.5 rounded bg-secondary/50 border border-border/50 flex items-center gap-1.5">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase">To:</span>
                                    {preview.recipientEmail}
                                  </span>
                                  {ccEmail && (
                                    <span className="text-[11px] font-medium text-foreground px-2 py-0.5 rounded bg-secondary/30 border border-border/30 flex items-center gap-1.5">
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">Cc:</span>
                                      {ccEmail}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          {isEditing ? (
                            <button onClick={() => saveEditing(index)} className="flex items-center gap-1.5 px-3 py-1.5 bg-success text-white text-[10px] font-semibold uppercase tracking-wider rounded-lg shadow-md hover:bg-success/90 transition-colors">
                              <CheckCircle2 className="w-3 h-3" />
                              Confirm
                            </button>
                          ) : (
                            <button onClick={() => startEditing(index, parsed)} className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-border hover:bg-secondary/80 transition-colors">
                              <Edit2 className="w-3 h-3" />
                              Edit
                            </button>
                          )}
                        </div>
                        <div className="p-3 rounded-lg bg-input border border-border flex flex-col gap-3">
                          {isEditing ? (
                            typeof editState === 'string' ? (
                              <textarea
                                value={editState}
                                onChange={(e) => setEditState(e.target.value)}
                                className="w-full min-h-[150px] p-3 text-sm bg-background text-foreground border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                              />
                            ) : (
                              <div className="flex flex-col gap-4">
                                {editState?.subject !== undefined && (
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Subject</label>
                                    <input
                                      type="text"
                                      value={editState.subject}
                                      onChange={(e) => setEditState({ ...editState, subject: e.target.value })}
                                      className="w-full p-2.5 text-sm font-medium bg-background text-foreground border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50"
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col gap-3">
                                  {editState?.blocks?.map((block: any, idx: number) => {
                                    if (block.type === 'text') {
                                      return (
                                        <div key={idx} className="space-y-1.5">
                                          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Body Text</label>
                                          <textarea
                                            value={block.content?.text || ''}
                                            onChange={(e) => {
                                              const newBlocks = [...editState.blocks];
                                              newBlocks[idx] = { ...newBlocks[idx], content: { ...newBlocks[idx].content, text: e.target.value } };
                                              setEditState({ ...editState, blocks: newBlocks });
                                            }}
                                            className="w-full min-h-[120px] p-3 text-sm bg-background text-foreground border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/50 leading-relaxed"
                                          />
                                        </div>
                                      );
                                    }
                                    if (block.type === 'image' && includeHeaderImage !== false) return <div key={idx} className="text-[10px] text-muted-foreground border border-dashed border-border/50 py-2 text-center rounded bg-secondary/20">[Header Image Placeholder]</div>;
                                    if (block.type === 'cta' && includeCta !== false) return <div key={idx} className="text-[10px] text-muted-foreground border border-dashed border-border/50 py-2 text-center rounded bg-secondary/20">[CTA Placeholder]</div>;
                                    if (block.type === 'signature' && includeSignature !== false) return <div key={idx} className="text-[10px] text-muted-foreground border border-dashed border-border/50 py-2 text-center rounded bg-secondary/20">[Signature Placeholder]</div>;
                                    return null;
                                  })}
                                </div>
                              </div>
                            )
                          ) : (
                            (() => {
                              if (!parsed || !parsed.blocks) {
                                return <p className="text-sm text-foreground/90 whitespace-pre-wrap">{preview.generated}</p>;
                              }

                              return (
                                <div className="flex flex-col gap-4">
                                  {parsed.subject && (
                                    <div className="text-sm font-bold text-foreground border-b border-border pb-2">
                                      Subject: <span className="font-normal text-muted-foreground">{parsed.subject}</span>
                                    </div>
                                  )}

                                  <div className="flex flex-col gap-4 pt-1">
                                    {/* Persistent Header — always at the top */}
                                    {includeHeaderImage !== false && (customHeaderImage || (parsed.blocks?.find((b: any) => b.type === 'image')?.content?.url)) && (
                                      <div className="mb-2 text-center">
                                        <img
                                          src={customHeaderImage || parsed.blocks?.find((b: any) => b.type === 'image')?.content?.url}
                                          alt="Header"
                                          className="max-w-full h-auto rounded-lg"
                                          style={{ maxHeight: '200px', objectFit: 'cover', display: 'inline-block' }}
                                        />
                                      </div>
                                    )}

                                    {parsed.blocks.map((block: any, idx: number) => {
                                      if (block.type === 'text') {
                                        const isGreeting = idx === 0;
                                        return (
                                          <p
                                            key={idx}
                                            style={{ textAlign: block.styles?.alignment || 'left', fontSize: block.styles?.fontSize || '14px' }}
                                            className={`whitespace-pre-wrap leading-relaxed text-foreground ${isGreeting ? 'mb-1 font-medium' : 'mt-1'}`}
                                          >
                                            {block.content?.text}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })}

                                    {/* Persistent CTA — always after the body */}
                                    {includeCta !== false && (ctaText || ctaLink) && (
                                      <div className="mt-6 mb-4 text-center">
                                        <a
                                          href={ctaLink || "#"}
                                          style={{
                                            backgroundColor: '#2563eb',
                                            color: '#ffffff',
                                            fontSize: '14px',
                                            padding: '12px 32px',
                                            fontWeight: '600',
                                            borderRadius: '12px',
                                            textDecoration: 'none',
                                            display: 'inline-block',
                                            boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)',
                                            transition: 'all 0.2s ease'
                                          }}
                                          className="hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                                        >
                                          {ctaText || 'Click Here'}
                                        </a>
                                      </div>
                                    )}
                                  </div>

                                  {/* Persistent Signature — always shown if enabled */}
                                  {includeSignature !== false && (customSignatureHtml || signature) && (
                                    <div className="mt-4 pt-4 border-t border-border">
                                      {customSignatureHtml && customSignatureHtml !== "manual" ? (
                                        <div
                                          className="text-sm text-foreground dark:[&_*]:!text-foreground leading-relaxed"
                                          dangerouslySetInnerHTML={{ __html: customSignatureHtml }}
                                        />
                                      ) : (
                                        <div
                                          className="text-sm text-foreground dark:[&_*]:!text-foreground leading-relaxed"
                                          dangerouslySetInnerHTML={{ __html: signature.replace(/\n/g, '<br/>') }}
                                        />
                                      )}
                                    </div>
                                  )}


                                </div>
                              );
                            })()
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
