"use node";

import { v } from "convex/values";
import nodemailer from "nodemailer";
import { internalAction } from "./_generated/server";

/**
 * SMTP sender (Node action). Auth providers dispatch here; if SMTP_HOST is unset it's a
 * no-op (providers still log the code, so dev/log-fallback keeps working).
 * Local inbox: point SMTP_HOST/SMTP_PORT at Mailpit (default :1025).
 */
export const sendEmail = internalAction({
  args: { to: v.string(), subject: v.string(), text: v.string() },
  handler: async (_ctx, { to, subject, text }) => {
    const host = process.env.SMTP_HOST;
    if (!host) {
      if (process.env.RESEND_API_KEY) {
        // Direct fetch to Resend API to avoid dynamic import bundler issues
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.RESEND_SENDER_EMAIL_AUTH || "onboarding@resend.dev",
            to,
            subject,
            html: text,
            text,
          }),
        });
        if (!response.ok) {
          const errorData = await response.text();
          console.error("[email] Resend API error:", errorData);
          throw new Error("Failed to send email via Resend API");
        }
      } else {
        console.warn("[email] No SMTP_HOST or RESEND_API_KEY provided. Email not sent.");
      }
      return;
    }
    const transport = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? "1025"),
      secure: false,
      ...(process.env.SMTP_USER
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } }
        : {}),
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM ?? "auth@myos.local",
      to,
      subject,
      text,
    });
  },
});
