import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { getValidTokens } from "@/lib/auth-utils";
import { authOptions } from "../auth/[...nextauth]/route";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { to, cc, emailData, draftId, attachments } = await req.json();
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const tokens = await getValidTokens(user.id);

    if (!tokens || !tokens.refreshToken) {
      return NextResponse.json(
        { error: "Gmail connection expired. Please sign out and sign in again to reconnect." },
        { status: 401 }
      );
    }

    const OAuth2 = google.auth.OAuth2;
    const oauth2Client = new OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    // Google API client automatically handles access token generation if refresh_token is provided
    oauth2Client.setCredentials({
      refresh_token: tokens.refreshToken,
    });

    // Robust email validation before sending
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      console.warn(`Skipping invalid email address: "${to}"`);
      return NextResponse.json({ 
        error: `The recipient address "${to}" is not a valid email format. Please check your CSV data.` 
      }, { status: 400 });
    }

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Ensure we have a valid parsed emailData
    const blockData = typeof emailData === 'string' ? JSON.parse(emailData) : emailData;
    const subject = blockData?.subject || "Personalized Outreach";
    
    // Construct HTML out of the JSON blocks
    let htmlContent = "";
    if (blockData?.blocks && Array.isArray(blockData.blocks)) {
      blockData.blocks.forEach((block: any) => {
        if (block.type === 'text') {
           const text = (block.content?.text || '');
           // Replace leading spaces with non-breaking spaces for email client compatibility
           const indentedText = text.replace(/^ +/gm, (match) => '&nbsp;'.repeat(match.length));
           htmlContent += `<p style="margin: 0 0 16px 0; text-align: ${block.styles?.alignment || 'left'}; font-size: ${block.styles?.fontSize || '15px'}; color: ${block.styles?.color || '#1f2937'}; white-space: pre-wrap;">${indentedText.replace(/\n/g, "<br />")}</p>`;
        } else if (block.type === 'image') {
           htmlContent += `<div style="text-align: ${block.styles?.alignment || 'center'}; margin: 16px 0;"><img src="${block.content?.url || 'https://images.unsplash.com/photo-1579389083078-4e7018379f7e?w=800&q=80'}" alt="Header" style="max-width: 100%; height: auto; border-radius: 8px;" /></div>`;
        } else if (block.type === 'cta') {
           const btnColor = block.styles?.backgroundColor || '#2563eb';
           htmlContent += `<div style="text-align: ${block.styles?.alignment || 'center'}; margin: 36px 0;">
             <a href="${block.content?.link || '#'}" style="display: inline-block; padding: 12px 32px; background-color: ${btnColor}; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">${block.content?.text || 'Click Here'}</a>
           </div>`;
        } else if (block.type === 'signature') {
           htmlContent += `<div style="margin-top: 40px; padding-top: 24px; border-top: 1px solid #e5e7eb; text-align: ${block.styles?.alignment || 'left'}; font-size: 14px; color: #374151; line-height: 1.6;">${(block.content?.text || '').replace(/\n/g, "<br />")}</div>`;
        }
      });
    } else {
      // Fallback if not structured
      htmlContent = `<p>${JSON.stringify(emailData)}</p>`;
    }

    const htmlBodyRaw = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6;">
        ${htmlContent}
      </div>
    `;

    // Convert base64 inline images to cid attachments
    const inlineImages: any[] = [];
    const htmlBody = htmlBodyRaw.replace(/src="data:image\/([^;]+);base64,([^"]+)"/g, (match, type, data) => {
      const cid = `inline_${inlineImages.length}@email`;
      inlineImages.push({ cid, type: `image/${type}`, base64Data: data });
      return `src="cid:${cid}"`;
    });

    // Properly format the email as MIME for Gmail API
    const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
    const boundary = "boundary_" + Math.random().toString(36).substring(2);

    const messageParts = [
      `From: ${session.user.name ?? "Outreach"} <${session.user.email}>`,
      `To: ${to}`,
      ...(cc ? [`Cc: ${cc}`] : []),
      `Subject: ${utf8Subject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "",
      htmlBody,
    ];

    if (inlineImages.length > 0) {
      inlineImages.forEach((img: any) => {
        messageParts.push(
          `--${boundary}`,
          `Content-Type: ${img.type}; name="${img.cid}"`,
          `Content-ID: <${img.cid}>`,
          `Content-Disposition: inline; filename="${img.cid}"`,
          "Content-Transfer-Encoding: base64",
          "",
          img.base64Data
        );
      });
    }

    if (attachments && Array.isArray(attachments)) {
      attachments.forEach((att: any) => {
        const base64Data = att.content.includes(',') ? att.content.split(',')[1] : att.content;
        messageParts.push(
          `--${boundary}`,
          `Content-Type: ${att.type || 'application/octet-stream'}; name="${att.name}"`,
          `Content-Disposition: attachment; filename="${att.name}"`,
          "Content-Transfer-Encoding: base64",
          "",
          base64Data
        );
      });
    }

    messageParts.push(`--${boundary}--`);
    const message = messageParts.join("\r\n");

    // Base64url encode the message as required by Gmail API
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    // Send the email via native Gmail API rather than SMTP
    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
      },
    });

    if (draftId) {
      await prisma.emailDraft.update({
        where: { id: draftId },
        data: { status: "sent", sentAt: new Date() },
      });
    }

    return NextResponse.json({ success: true, messageId: response.data.id });
  } catch (error: any) {
    console.error("Email send error:", error);
    
    let errorMessage = error.message || "Failed to send email";
    if (errorMessage.includes("535") || errorMessage.includes("BadCredentials") || errorMessage.includes("invalid_grant")) {
      errorMessage = "Gmail Authentication Failed. Please Sign Out and Sign In again, ensuring you check the 'Send email' permission box.";
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
