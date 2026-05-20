import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { isModelDeprecated } from "@/lib/gemini-models";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as any;
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query usage grouped by model
    const usageStats = await prisma.geminiUsage.groupBy({
      by: ["model"],
      where: {
        userId: user.id,
      },
      _sum: {
        tokensUsed: true,
      },
      _count: {
        id: true,
      },
    });

    // Map stats to UI-friendly model names and include deprecation status
    const stats = usageStats.map((stat) => {
      const rawModel = stat.model;
      const normalised = rawModel.startsWith("models/") ? rawModel : `models/${rawModel}`;
      
      // Simple cost estimator (Gemini 1.5/3.1 flash: ~$0.075 per 1M input tokens, we can use an average)
      const tokens = stat._sum.tokensUsed || 0;
      const estimatedCost = (tokens / 1000000) * 0.075; // USD

      return {
        modelId: normalised,
        name: rawModel.replace("gemini-", "Gemini ").replace("-", " "),
        tokensUsed: tokens,
        emailsGenerated: stat._count.id,
        isDeprecated: isModelDeprecated(normalised),
        costEst: estimatedCost,
      };
    });

    return NextResponse.json({ usage: stats });
  } catch (error: any) {
    console.error("Usage Stats API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
