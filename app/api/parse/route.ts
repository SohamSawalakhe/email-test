import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getFreshAccessToken } from "@/lib/google-auth";
import { getModelFallbackChain, DEFAULT_MODEL, markModelDeprecated } from "@/lib/gemini-models";

export async function POST(request: Request) {
  try {
    const { csvData } = await request.json();

    if (!csvData || !Array.isArray(csvData) || csvData.length === 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    if (!(session?.user as any)?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userAccessToken = await getFreshAccessToken((session!.user as any).id);

    // Send up to 100 rows to AI to detect structure
    const sample = csvData.slice(0, 100);
    const prompt = `You are an expert data analyst. Analyze this 2D JSON array representing a raw spreadsheet or CSV.
Determine how to parse it into a standard tabular format (headers on the first row, data on subsequent rows).

CRITICAL RULES:
1. Determine if the data is transposed (vertical profile). If the first column consists exclusively of attribute labels (e.g. "Category", "Brand Name", "Email", "Phone", "Address") and the subsequent columns are the actual records (e.g. businesses or people), then "isTransposed" MUST be true. If it is a normal table, set it to false.
2. Identify the true header row index. If there are junk metadata rows at the top, skip them.
3. If there are NO headers at all, set "headerRowIndex" to -1.

Output JSON EXACTLY in this format:
{
  "isTransposed": boolean, // true if it is a vertical profile
  "headerRowIndex": number, // The row (0-indexed) containing column headers (evaluate this AFTER transposing if isTransposed is true). Use -1 if no headers exist.
  "dataStartRowIndex": number // The row (0-indexed) where the actual data starts (evaluate AFTER transposing).
}

Spreadsheet Data (showing up to 100 rows):
${JSON.stringify(sample, null, 2)}
`;

    // ── Smart Model Fallback (auto-fetch newest → oldest) ──────
    const modelsToTry = await getModelFallbackChain(DEFAULT_MODEL, `Bearer ${userAccessToken}`);
    const defaultRules = { isTransposed: false, headerRowIndex: 0, dataStartRowIndex: 1 };

    for (const mId of modelsToTry) {
      try {
        console.log(`[Parse] Trying model ${mId}...`);
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/${mId}:generateContent`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${userAccessToken}`
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const errMsg = err?.error?.message || "";
          const isDeprecated = res.status === 404 || errMsg.toLowerCase().includes("deprecated") || errMsg.toLowerCase().includes("not found");
          if (isDeprecated) markModelDeprecated(mId);
          console.warn(`${isDeprecated ? "⚠️ Deprecated" : "Failed"}: ${mId} (${res.status})${errMsg ? `: ${errMsg}` : ""}`);
          continue;
        }

        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const match = text.match(/\{[\s\S]*\}/);
        const rules = JSON.parse(match ? match[0] : text);

        console.log(`[Parse] Success with model ${mId}`);
        return NextResponse.json({ rules });
      } catch (e) {
        console.warn(`[Parse] Error with model ${mId}:`, e);
        continue;
      }
    }

    // All models failed — return safe defaults
    console.error("[Parse] All models failed, returning defaults");
    return NextResponse.json({ rules: defaultRules });
  } catch (error: any) {
    console.error("AI Parse route error:", error);
    return NextResponse.json({ rules: { isTransposed: false, headerRowIndex: 0, dataStartRowIndex: 1 } });
  }
}

