import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { fetchAvailableModels, markModelDeprecated, isModelDeprecated } from "@/lib/gemini-models";

const apiKey = process.env.GEMINI_API_KEY || "dummy_key";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: Request) {
  try {
    const { messages, csvData } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 },
      );
    }

    // Mock response if no valid API key is present
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "dummy_key") {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return NextResponse.json({
        reply: `Mock Mode: I understand you want to personalize cold emails. Based on your prompt, here is a suggested template:\n\n"Hi {name},\n\nI noticed {company} has been doing great things recently. I'd love to show you how our product can help..."\n\n(Provide a GEMINI_API_KEY to see real AI responses.)`,
      });
    }

    // Convert history into Gemini expected format
    let history = messages.slice(0, -1).map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    if (history.length > 0 && history[0].role === "model") {
      history.shift(); // Gemini requires the first message to be from 'user'
    }

    let contextDataSummary = "";
    if (csvData && csvData.length > 0) {
      contextDataSummary = `Context: We have uploaded a CSV with ${csvData.length} rows. The headers seem to be: ${csvData[0].join(", ")}.`;
    }

    const latestMessage = messages[messages.length - 1].content;
    const finalPrompt = `System Instruction: You are an AI Email Outreach Assistant. If you suggest an email draft, template, or a specific snippet of text for the user to use, you MUST wrap it completely inside a markdown code block (using triple backticks \`\`\`) so that it can be easily copied by the user. Do not just use bold text for templates, use code blocks.

${contextDataSummary}

User request: ${latestMessage}`;

    // ── Auto-fetch models & cascade newest → oldest ─────────────
    const allModels = await fetchAvailableModels(apiKey);
    const chatModels = allModels.map(m => m.replace("models/", ""));

    for (const modelId of chatModels) {
      try {
        console.log(`[Chat] Trying model ${modelId}...`);
        const aiModel = genAI.getGenerativeModel({ model: modelId });
        const chat = aiModel.startChat({ history });
        const result = await chat.sendMessage(finalPrompt);
        const reply = result.response.text();
        console.log(`[Chat] ✅ Success with model ${modelId}`);
        return NextResponse.json({ reply });
      } catch (modelError: any) {
        const errMsg = modelError?.message || "";
        const isDeprecated = errMsg.includes("404") || errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("deprecated");
        if (isDeprecated) markModelDeprecated(`models/${modelId}`);
        console.warn(`[Chat] ${isDeprecated ? "⚠️ Deprecated" : "❌ Failed"}: ${modelId} — ${errMsg}`);
        continue;
      }
    }

    // All models failed
    return NextResponse.json(
      { error: "All AI models failed. Please try again later." },
      { status: 503 },
    );
  } catch (error) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: "Failed to generate chat response" },
      { status: 500 },
    );
  }
}


