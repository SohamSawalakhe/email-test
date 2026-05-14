"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { InputSection } from "@/components/dashboard/input-section";
import { ConfigPanel, BrandDesignPanel } from "@/components/dashboard/config-panel";
import { ChatInterface } from "@/components/dashboard/chat-interface";
import { PreviewGrid } from "@/components/dashboard/preview-grid";
import { ActionBar } from "@/components/dashboard/action-bar";

interface EmailPreview {
  original: any;
  generated: string;
  status?: string;
  recipientEmail?: string;
}

import { useDashboard } from "../context/dashboard-context";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 1. Use Global Context for Campaign Data
  const {
    csvData, hasDataHeader, prompt, model, previews, headers,
    totalRecipients, activeTab, fileName, manualInput, parsedData,
    failedEmails, isProcessing, ccEmail,
    setCsvData, setHasDataHeader, setPrompt, setModel, setPreviews,
    setHeaders, setIsProcessing, setFailedEmails, setTotalRecipients,
    setFileName, setActiveTab, setManualInput, setParsedData, setCcEmail,
    handleDataChange
  } = useDashboard();

  // 2. Local Component States (Safe to reset or kept simple)
  const [isSending, setIsSending] = useState(false);
  const [sentEmails, setSentEmails] = useState(0);
  const [brands, setBrands] = useState<any[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("");

  // Email Design Settings
  const [signature, setSignature] = useState("Best regards,\n" + (session?.user?.name || "The Team"));
  const [ctaText, setCtaText] = useState("Book a Meeting");
  const [ctaLink, setCtaLink] = useState("https://calendly.com/your-link");
  const [includeHeaderImage, setIncludeHeaderImage] = useState(false);
  const [includeCta, setIncludeCta] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(true);

  // Custom Uploads
  const [customHeaderImage, setCustomHeaderImage] = useState<string | null>(null);
  const [customSignatureHtml, setCustomSignatureHtml] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<{ name: string, type: string, content: string }[]>([]);

  useEffect(() => {
    if (status === "authenticated") {
      axios.get("/api/user/settings").then((res) => {
        if (res.data.headerImage) setCustomHeaderImage(res.data.headerImage);
        if (res.data.signatureHtml) setCustomSignatureHtml(res.data.signatureHtml);
      }).catch(err => console.error("Failed to load settings", err));

      axios.get("/api/brands").then((res) => {
        setBrands(res.data.brands);
      }).catch(err => console.error("Failed to load brands", err));
    }
  }, [status]);

  const saveSettings = async (headerImg: string | null, sigHtml: string | null) => {
    try {
      await axios.post("/api/user/settings", {
        headerImage: headerImg,
        signatureHtml: sigHtml
      });
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  };

  const calculateRecipientCount = useCallback((data: string[][]) => {
    if (data.length === 0) return 0;
    return hasDataHeader ? Math.max(0, data.length - 1) : data.length;
  }, [hasDataHeader]);

  useEffect(() => {
    if (!selectedBrandId) {
      setIncludeSignature(false);
      setIncludeCta(false);
      setIncludeHeaderImage(false);
      setCustomSignatureHtml(null);
      setCustomHeaderImage(null);
      return;
    }
    const brand = brands.find(b => b.id === selectedBrandId);
    if (!brand) return;

    // Apply basic brand context
    if (brand.tone) setPrompt(p => p.includes(`Tone: ${brand.tone}`) ? p : `${p}\n\nTone: ${brand.tone}`);

    // Apply default CTA if set
    if (brand.defaultCtaText) setCtaText(brand.defaultCtaText);
    if (brand.defaultCtaLink) setCtaLink(brand.defaultCtaLink);
    if (brand.defaultCtaText || brand.defaultCtaLink) setIncludeCta(true);

    // Apply Brand Assets (new system)
    const defaultSig = brand.signatures?.find((s: any) => s.isDefault);
    if (defaultSig) {
      setCustomSignatureHtml(defaultSig.content);
      setIncludeSignature(true);
    } else if (brand.defaultSignature) {
      setSignature(brand.defaultSignature);
      setIncludeSignature(true);
    } else {
      setIncludeSignature(false);
    }

    const defaultCta = brand.ctas?.find((c: any) => c.isDefault);
    if (defaultCta) {
      setCtaText(defaultCta.text);
      setCtaLink(defaultCta.link);
      setIncludeCta(true);
    } else {
      setIncludeCta(false);
    }

    const defaultHeader = brand.headers?.find((h: any) => h.isDefault);
    if (defaultHeader) {
      setCustomHeaderImage(defaultHeader.imageUrl);
      setIncludeHeaderImage(true);
    } else {
      setIncludeHeaderImage(false);
    }
  }, [selectedBrandId, brands]);

  const handleProcess = useCallback(async () => {
    if (csvData.length === 0) return;
    setIsProcessing(true);
    setPreviews([]);
    setHeaders([]);

    try {
      const hasHeader = hasDataHeader;
      const dataRows = hasHeader ? csvData.slice(1) : csvData;
      setTotalRecipients(dataRows.length);
      let currentCampaignId: string | undefined = undefined;
      const BATCH_SIZE = 4;

      for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
        const batchRows = dataRows.slice(i, i + BATCH_SIZE);
        const batchCsvData = hasHeader ? [csvData[0], ...batchRows] : batchRows;

        const response: any = await axios.post("/api/generate", {
          prompt,
          model,
          csvData: batchCsvData,
          hasHeader,
          campaignId: currentCampaignId,
          brandProfileId: selectedBrandId,
          include: { headerImage: includeHeaderImage, cta: includeCta, signature: includeSignature },
          config: { signature, ctaText, ctaLink }
        });

        const { results, headers: returnedHeaders, campaignId: returnedCampaignId } = response.data;
        if (!currentCampaignId && returnedCampaignId) {
          currentCampaignId = returnedCampaignId;
        }

        if (i === 0) {
          setHeaders(returnedHeaders || []);
        }

        const processedPreviews: EmailPreview[] = results;
        setPreviews((prev) => [...prev, ...processedPreviews]);

        setFailedEmails((prev) => {
          const newFailed = new Set(prev);
          processedPreviews.forEach((p, idx) => {
            if (p.status === "failed") {
              newFailed.add(i + idx);
            }
          });
          return newFailed;
        });
      }
    } catch (error: any) {
      console.error("Error generating emails:", error);
      const msg = error.response?.data?.error || error.message;
      if (msg.includes("503") || msg.includes("high demand")) {
        alert("The AI service is currently busy (High Demand). Please wait a minute and try again.");
      } else {
        alert("Failed to generate emails: " + msg);
      }
    } finally {
      setIsProcessing(false);
    }
  }, [csvData, prompt, model, includeHeaderImage, includeCta, includeSignature, signature, ctaText, ctaLink]);

  const handlePreviewEdit = useCallback((index: number, newGenerated: string) => {
    setPreviews((prev) => {
      const newPreviews = [...prev];
      newPreviews[index] = { ...newPreviews[index], generated: newGenerated };
      return newPreviews;
    });
  }, []);

  const handleSendAll = useCallback(async () => {
    if (previews.length === 0) return;
    if (!session) {
      alert("Please connect your Gmail account first.");
      return;
    }

    setIsSending(true);
    setSentEmails(0);
    setFailedEmails(new Set());

    // Find the email index from headers
    const emailIdx = headers.findIndex(h => h.toLowerCase().includes("email"));
    const emailHeaderKey = headers.find(h => h.toLowerCase().includes("email"));

    for (let i = 0; i < previews.length; i++) {
      const preview = previews[i];
      try {
        let recipientEmail = preview.recipientEmail && preview.recipientEmail !== "INVALID_EMAIL"
          ? preview.recipientEmail
          : "";

        if (!recipientEmail) {
          if (Array.isArray(preview.original)) {
            recipientEmail = emailIdx >= 0 ? preview.original[emailIdx] : preview.original[0];
          } else if (typeof preview.original === 'object' && preview.original !== null) {
            recipientEmail = emailHeaderKey ? preview.original[emailHeaderKey] : Object.values(preview.original)[0] as string;
          }
        }

        let parsedPayload = typeof preview.generated === 'string' ? JSON.parse(preview.generated) : preview.generated;

        // Filter out blocks if user explicitly disabled them
        if (parsedPayload && parsedPayload.blocks) {
          if (!includeHeaderImage) {
            parsedPayload.blocks = parsedPayload.blocks.filter((b: any) => b.type !== 'image');
          }
          if (!includeCta) {
            parsedPayload.blocks = parsedPayload.blocks.filter((b: any) => b.type !== 'cta');
          }
          if (!includeSignature) {
            parsedPayload.blocks = parsedPayload.blocks.filter((b: any) => b.type !== 'signature');
          }

          // Inject custom header and signature if applicable
          parsedPayload.blocks = parsedPayload.blocks.filter((b: any) => b.type !== 'image');
          if (includeHeaderImage && customHeaderImage) {
            parsedPayload.blocks.unshift({ type: 'image', content: { url: customHeaderImage }, styles: { alignment: 'center' } });
          }
          // Enforce CTA before signature
          parsedPayload.blocks = parsedPayload.blocks.filter((b: any) => b.type !== 'cta');
          if (includeCta && (ctaText || ctaLink)) {
            parsedPayload.blocks.push({ type: 'cta', content: { text: ctaText, link: ctaLink } });
          }

          if (includeSignature) {
            const sigHtml = (customSignatureHtml && customSignatureHtml !== "manual")
              ? customSignatureHtml
              : signature.replace(/\n/g, '<br/>');

            if (sigHtml) {
              const sigBlock = parsedPayload.blocks.find((b: any) => b.type === 'signature');
              if (sigBlock) {
                sigBlock.content.text = sigHtml;
                sigBlock.isHtml = true;
              } else {
                parsedPayload.blocks.push({ type: 'signature', content: { text: sigHtml }, isHtml: true });
              }
            }
          }
        }

        await axios.post("/api/send-email", {
          to: recipientEmail || "unknown@example.com",
          cc: ccEmail,
          emailData: parsedPayload,
          attachments: attachments
        });
        setSentEmails((prev) => prev + 1);
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error("Failed to send email to index", i, error);
        setFailedEmails((prev) => new Set(prev).add(i));
      }
    }
    setIsSending(false);
  }, [previews, session, headers, signature, ctaText, ctaLink]);

  // 2. Redirect Logic Effect
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  // 3. Conditional Returns After Hooks
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse text-primary border border-primary/20">
            AI
          </div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Checking connection...</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") return null;

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-background">

      <main className="max-w-7xl mx-auto px-6 py-8 pb-36">
        <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-4xl font-extrabold text-foreground tracking-tight">
              Hello, <span className="text-primary">{session?.user?.name?.split(" ")[0]}</span>!
            </h1>
            <p className="mt-3 text-base text-muted-foreground max-w-2xl">
              Your personalized outreach dashboard is ready. Upload your CSV and let AI do the work.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-6 py-3 rounded-full bg-success/5 border border-success/20 flex items-center gap-4 shadow-sm"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-success" />
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-success uppercase tracking-widest leading-tight">Sender:</span>
              <span className="text-[10px] font-bold text-success uppercase tracking-widest leading-tight">{session?.user?.email}</span>
            </div>
          </motion.div>
        </div>

        <div className="space-y-8">
          {/* Top Row: Data Input & Brand Assets (Aligned Heights) */}
          <div className="grid gap-8 xl:grid-cols-2 grid-cols-1">
            <div className="h-auto xl:h-[520px]">
              <InputSection 
                onDataChange={handleDataChange} 
                activeTab={activeTab}
                fileName={fileName}
                parsedData={parsedData}
                manualInput={manualInput}
                onManualInputChange={setManualInput}
              />
            </div>
            <div className="h-auto xl:h-[520px]">
              <BrandDesignPanel
                session={session}
                signature={signature}
                onSignatureChange={setSignature}
                ctaText={ctaText}
                onCtaTextChange={setCtaText}
                ctaLink={ctaLink}
                onCtaLinkChange={setCtaLink}
                includeHeaderImage={includeHeaderImage}
                onIncludeHeaderImageChange={setIncludeHeaderImage}
                includeCta={includeCta}
                onIncludeCtaChange={setIncludeCta}
                includeSignature={includeSignature}
                onIncludeSignatureChange={setIncludeSignature}
                customHeaderImage={customHeaderImage}
                onCustomHeaderImageChange={(val) => {
                  setCustomHeaderImage(val);
                  saveSettings(val, customSignatureHtml);
                }}
                customSignatureHtml={customSignatureHtml}
                onCustomSignatureHtmlChange={(val) => {
                  setCustomSignatureHtml(val);
                  saveSettings(customHeaderImage, val);
                }}
                brands={brands}
                selectedBrandId={selectedBrandId}
                onBrandChange={setSelectedBrandId}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
              />
            </div>
          </div>

          {/* Bottom Row: Configuration & Preview */}
          <div className="grid gap-8 xl:grid-cols-2 grid-cols-1">
            <div className="space-y-8">
              <ConfigPanel
                prompt={prompt}
                onPromptChange={setPrompt}
                model={model}
                onModelChange={setModel}
                ccEmail={ccEmail}
                onCcEmailChange={setCcEmail}
                isProcessing={isProcessing}
                onGenerate={handleProcess}
                hasData={csvData.length > 0}
              />
              <ChatInterface
                onApplyPrompt={setPrompt}
                csvHeaders={csvData.length > 0 ? csvData[0] : []}
                session={session}
              />
            </div>

            <div className="relative hidden xl:block">
              <div className="absolute inset-0">
                <PreviewGrid
                  previews={previews}
                  isProcessing={isProcessing}
                  totalRecipients={totalRecipients}
                  onPreviewEdit={handlePreviewEdit}
                  hasData={csvData.length > 0}
                  signature={signature}
                  ctaText={ctaText}
                  ctaLink={ctaLink}
                  customHeaderImage={customHeaderImage}
                  customSignatureHtml={customSignatureHtml}
                  includeHeaderImage={includeHeaderImage}
                  includeCta={includeCta}
                  includeSignature={includeSignature}
                  failedIndices={failedEmails}
                  ccEmail={ccEmail}
                />
              </div>
            </div>
            {/* Mobile/Tablet fallback where it shouldn't be absolute */}
            <div className="xl:hidden h-[800px]">
              <PreviewGrid
                previews={previews}
                isProcessing={isProcessing}
                totalRecipients={totalRecipients}
                onPreviewEdit={handlePreviewEdit}
                hasData={csvData.length > 0}
                signature={signature}
                ctaText={ctaText}
                ctaLink={ctaLink}
                customHeaderImage={customHeaderImage}
                customSignatureHtml={customSignatureHtml}
                includeHeaderImage={includeHeaderImage}
                includeCta={includeCta}
                includeSignature={includeSignature}
                failedIndices={failedEmails}
                ccEmail={ccEmail}
              />
            </div>
          </div>
        </div>
      </main>

      {totalRecipients > 0 && previews.length === totalRecipients && !isProcessing && (
        <ActionBar
          totalEmails={totalRecipients}
          sentEmails={sentEmails}
          failedEmails={failedEmails.size}
          isSending={isSending}
          onSendAll={handleSendAll}
          hasGeneratedPreviews={previews.length > 0}
        />
      )}
    </div>
  );
}
