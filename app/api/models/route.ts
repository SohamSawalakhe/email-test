import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { getFreshAccessToken } from "@/lib/google-auth";
import { sortModelsByRecency, isModelDeprecated } from "@/lib/gemini-models";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userAccessToken = await getFreshAccessToken(user.id);

    // Fetch ALL models with pagination (API may limit per-page results)
    let allRawModels: any[] = [];
    let nextPageToken: string | undefined;

    do {
      const url = new URL("https://generativelanguage.googleapis.com/v1beta/models");
      url.searchParams.set("pageSize", "100"); // Request max per page
      if (nextPageToken) url.searchParams.set("pageToken", nextPageToken);

      const response = await fetch(url.toString(), {
        headers: { "Authorization": `Bearer ${userAccessToken}` }
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Failed to fetch models");
      }

      const data = await response.json();
      allRawModels.push(...(data.models || []));
      nextPageToken = data.nextPageToken;
    } while (nextPageToken);

    console.log(`[Models API] Total raw models from API: ${allRawModels.length}`);

    // Include only Gemini models that support content generation
    const filteredModels = allRawModels
      .filter((m: any) => {
        const name = (m.name || "").toLowerCase();
        const methods = m.supportedGenerationMethods || [];

        // Must support content generation
        const supportsGenerate = methods.includes("generateContent");

        // Strictly verify it is a Gemini model
        const isGemini = name.includes("gemini");

        // Exclude embedding-only, TTS-only, image-only, and live models
        const isEmbedding = name.includes("embedding") || (methods.length > 0 && methods.every((m: string) => m === "embedContent"));
        const isTTS = name.includes("tts");
        const isImageGen = name.includes("imagen");
        const isLive = name.includes("live");

        return supportsGenerate && isGemini && !isEmbedding && !isTTS && !isImageGen && !isLive;
      })
      .map((m: any) => ({
        id: m.name,
        name: m.displayName || m.name.replace("models/", ""),
        description: m.description,
        isDeprecated: isModelDeprecated(m.name),
      }));

    console.log(`[Models API] After filtering: ${filteredModels.length} models`);

    // Sort: newest first (by version number), deprecated last
    const sortedModels = sortModelsByRecency(filteredModels);

    // Mark the first non-deprecated model as "latest" (it's the newest after sorting)
    const modelsWithLatest = sortedModels.map((m, i) => ({
      ...m,
      isLatest: i === 0 && !m.isDeprecated,
    }));

    return NextResponse.json({ models: modelsWithLatest });
  } catch (error: any) {
    console.error("Models API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
