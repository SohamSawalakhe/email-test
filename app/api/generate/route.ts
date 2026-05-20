import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { getFreshAccessToken } from "@/lib/google-auth";
import { getModelFallbackChain, DEFAULT_MODEL, markModelDeprecated } from "@/lib/gemini-models";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, model, csvData, campaignName, include, config, campaignId, hasHeader, brandProfileId } = body;

    if (!prompt || !csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userAccessToken = await getFreshAccessToken((session!.user as any).id);

    // ── Fetch Brand Context ──────────────────────────────────────
    let brandContext: any = null;
    if (brandProfileId) {
      brandContext = await prisma.brandProfile.findUnique({
        where: { id: brandProfileId, userId: (session?.user as any).id }
      });
    }

    // ── Prepare Data ───────────────────────────────────────────────
    let headers: string[] = [];
    let dataToProcess: string[][] = [];

    const cleanCsvData = csvData.filter((row: any[]) =>
      row && Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== "")
    );

    if (cleanCsvData.length > 0) {
      const firstRow = cleanCsvData[0];

      if (hasHeader) {
        headers = firstRow.map((h: any) => String(h).trim());
        dataToProcess = cleanCsvData.slice(1);
      } else {
        dataToProcess = cleanCsvData;
        headers = dataToProcess[0].map((_, i) => `Column ${i + 1}`);
      }
    }

    if (dataToProcess.length === 0) return NextResponse.json({ error: "No valid recipient data found" }, { status: 400 });

    let campaign;
    if (campaignId) {
      campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    }

    if (!campaign) {
      campaign = await prisma.campaign.create({
        data: {
          userId: (session!.user as any).id,
          name: campaignName || `Campaign ${new Date().toLocaleDateString()}`,
          prompt,
          model: model || DEFAULT_MODEL,
          status: "generating",
        },
      });
    }

    // ── Robust Email Column Detection ─────────────────────────────
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const globalEmailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z0-9.-]+/g;

    const extractEmails = (val: any): string[] => {
      if (val === undefined || val === null) return [];
      const str = String(val).trim();
      if (!str) return [];
      const parts = str.split(/[\s,;\/]+/);
      const matched: string[] = [];
      parts.forEach(part => {
        const clean = part.trim();
        if (emailRegex.test(clean)) {
          matched.push(clean);
        }
      });
      if (matched.length === 0) {
        const matches = str.match(globalEmailRegex);
        if (matches) {
          matches.forEach(m => matched.push(m.trim()));
        }
      }
      return Array.from(new Set(matched));
    };

    let emailColIdx = headers.findIndex(h => /email|mail|address/i.test(h));

    if (emailColIdx === -1 || !dataToProcess.some(row => extractEmails(row[emailColIdx]).length > 0)) {
      // Deep scan all columns for the first one that has a high percentage of emails
      for (let j = 0; j < headers.length; j++) {
        let emailCount = 0;
        for (let r = 0; r < Math.min(dataToProcess.length, 10); r++) {
          if (extractEmails(dataToProcess[r][j]).length > 0) emailCount++;
        }
        if (emailCount >= 1) { // If at least one row in the sample matches
          emailColIdx = j;
          break;
        }
      }
    }

    // ── Batch Generation Logic ─────────────────────────────────────
    const BATCH_SIZE = 8; // Slightly smaller batches for higher quality
    const totalRecipients = dataToProcess.length;
    let allGeneratedEmails: any[] = [];
    let actualModelUsed = model || DEFAULT_MODEL;
    let totalTokensEstimate = 0;

    for (let i = 0; i < totalRecipients; i += BATCH_SIZE) {
      const batch = dataToProcess.slice(i, i + BATCH_SIZE);
      const batchContext = batch.map((row, idx) => {
        // Include ALL available columns in the context
        const map = Object.fromEntries(headers.map((h, j) => [h, row[j] || ""]));
        return `Recipient ${i + idx + 1}:\n${JSON.stringify(map, null, 2)}`;
      }).join("\n\n---\n\n");

      const brandSection = brandContext
        ? `
### BRAND CONTEXT
Brand Name: ${brandContext.brandName}
${brandContext.industry ? `Industry: ${brandContext.industry}` : ""}
${brandContext.companyDescription ? `Company Description: ${brandContext.companyDescription}` : ""}
${brandContext.targetAudience ? `Target Audience: ${brandContext.targetAudience}` : ""}
${brandContext.tone ? `Preferred Tone: ${brandContext.tone}` : ""}
${brandContext.primaryGoal ? `Primary Goal: ${brandContext.primaryGoal}` : ""}
${brandContext.defaultCtaText ? `Default CTA: ${brandContext.defaultCtaText}` : ""}
`
        : "";

      const batchPrompt = `You are a world-class AI email strategist specializing in hyper-personalization.
Your goal is to generate unique, high-converting emails based on a user strategy and raw recipient data.

${brandSection}

User Strategy: "${prompt}"

### GUIDELINES:
1. **PRIORITY**: If the **User Strategy** above contains specific instructions about the email's length, structure, word count, or styling (such as indentation or paragraph count), you MUST prioritize those instructions over the default rules below.
2. **SELF-DRIVEN DISCOVERY**: Analyze the keys and values in the JSON for each recipient. Identify the most interesting data points (e.g., Setup Cost, Revenue, City, USP) and weave them into the narrative automatically.
3. **NO PLACEHOLDERS**: Do not use generic phrases like "your work" if specific data is available.
4. **TONE**: Maintain the spirit of the ${brandContext?.tone ? "Preferred Tone" : "User Strategy"} while sounding like a real person.
5. **STRUCTURE**: Respect these UI settings:
   - Header Image: Handled by the system (Do NOT include image blocks in the JSON)
   - CTA: Handled by the system (Do NOT include CTA blocks in the JSON)
   - Signature: Handled by the system (Do NOT include signature blocks in the JSON)

6. **DEFAULT EMAIL BODY STRUCTURE** (Use ONLY if User Strategy is silent on structure):
   - The FIRST text block MUST be a warm, personalized greeting (e.g., "Dear [Name]," or "Hi [Name],"). Add a blank line after it.
   - The body MUST be split into AT LEAST 3 separate text blocks (paragraphs). Do NOT put the entire email into a single text block.
   - Paragraph 1: Hook — open with something specific to the recipient's data.
   - Paragraph 2: Value — explain the core benefit or opportunity.
   - Paragraph 3: Call to action / closing — wrap up and guide them.
   - Each paragraph text block (starting from Paragraph 1) MUST begin with exactly 4 spaces (indentation).
   - Each paragraph should be concise (2-4 sentences). Leave a blank line between paragraphs.

Recipients (${batch.length}):
${batchContext}

### OUTPUT FORMAT:
You MUST output ONLY a valid JSON array with ${batch.length} objects. No markdown. No intro/outro.
Each object MUST follow a multi-block structure. If the user requested a specific structure, follow that; otherwise, use the default greeting + 3-paragraph structure.
Example Default Structure:
{
  "subject": "Compelling, data-driven subject line",
  "blocks": [
    { "type": "text", "content": { "text": "Dear [Recipient Name]," } },
    { "type": "text", "content": { "text": "    [Paragraph 1]" } },
    { "type": "text", "content": { "text": "    [Paragraph 2]" } },
    { "type": "text", "content": { "text": "    [Paragraph 3]" } }
  ]
}
IMPORTANT: Never merge the entire email body into one block.`;

      // ── Smart Model Fallback (auto-fetch newest → oldest) ─────
      const modelsToTry = await getModelFallbackChain(model, `Bearer ${userAccessToken}`);

      let batchResult: any[] = [];

      for (const mId of modelsToTry) {
        console.log(`[Campaign ${campaign.id}] Batch ${Math.floor(i / BATCH_SIZE) + 1} using ${mId}...`);
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${userAccessToken}`
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: batchPrompt }] }],
              generationConfig: { responseMimeType: "application/json" }
            })
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const errMsg = err?.error?.message || "";
            const isDeprecatedError = res.status === 404 || errMsg.toLowerCase().includes("deprecated") || errMsg.toLowerCase().includes("not found");
            if (isDeprecatedError) {
              markModelDeprecated(mId);
              console.warn(`⚠️ Model ${mId} deprecated/removed (${res.status}): ${errMsg}. Falling back...`);
            } else {
              console.warn(`Model ${mId} failed: ${res.status}`, err);
            }
            continue;
          }

          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "";

          const match = text.match(/\[[\s\S]*\]/);
          batchResult = JSON.parse(match ? match[0] : text);

          if (Array.isArray(batchResult)) {
            totalTokensEstimate += Math.round((batchPrompt.length + text.length) / 4);
            actualModelUsed = mId;
            break;
          }
        } catch (e) {
          console.warn(`Batch logic error for ${mId}:`, e);
        }
      }

      // Fill with personalized placeholders if AI fails
      if (!Array.isArray(batchResult) || batchResult.length === 0) {
        batchResult = batch.map((row) => {
          const name = String(row[0] || "there");
          return {
            subject: `Regarding your work at ${row[2] || "your company"}`,
            blocks: [{ type: "text", content: { text: `Hello ${name}! I wanted to reach out regarding the data in our list. Let's connect.` } }]
          };
        });
      }

      allGeneratedEmails.push(...batchResult.slice(0, batch.length));
    }

    // ── Save Results (Filtered & Validated) ────────────────────────
    const draftData: any[] = [];
    dataToProcess.forEach((row, i) => {
      // Find ALL valid emails in this specific row across all columns
      const allEmailsInRow: string[] = [];
      row.forEach(cell => {
        allEmailsInRow.push(...extractEmails(cell));
      });
      const uniqueEmailsInRow = Array.from(new Set(allEmailsInRow));
      const targetEmails = uniqueEmailsInRow.length > 0 ? uniqueEmailsInRow : ["INVALID_EMAIL"];

      targetEmails.forEach(rawEmail => {
        const isValidEmail = rawEmail !== "INVALID_EMAIL";
        draftData.push({
          campaignId: campaign.id,
          recipientEmail: rawEmail,
          recipientData: JSON.stringify(Object.fromEntries(headers.map((h, j) => [h, row[j] || ""]))),
          generatedText: JSON.stringify(allGeneratedEmails[i] || { subject: "Hello", blocks: [] }),
          status: isValidEmail ? "ready" : "failed"
        });
      });
    });

    const savedDrafts = await prisma.$transaction(
      draftData.map(d => prisma.emailDraft.create({ data: d }))
    );
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "completed" } });

    await prisma.geminiUsage.create({
      data: {
        userId: (session!.user as any).id,
        campaignId: campaign.id,
        tokensUsed: totalTokensEstimate,
        model: actualModelUsed.replace("models/", ""),
      }
    });

    return NextResponse.json({
      results: savedDrafts.map((d, i) => ({
        id: d.id,
        original: JSON.parse(d.recipientData),
        generated: d.generatedText,
        status: d.status,
        recipientEmail: d.recipientEmail
      })),
      headers,
      campaignId: campaign.id
    });

  } catch (error: any) {
    console.error("Fatal API Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
