import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// SMTP configuration
const smtpConfig = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
};

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error(
    "Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
  );
}

if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
  throw new Error(
    "Missing SMTP environment variables. Please set SMTP_HOST, SMTP_USER, SMTP_PASSWORD"
  );
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Create nodemailer transporter
const transporter = nodemailer.createTransport(smtpConfig);

// --- EMAIL CONTENT (Follow-up version) ---
const emailSubject = "Following up — try our AI circuit builder";

const emailHtml = `
<div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;">
  <p>Hi there,</p>
  <p>Just following up on my previous email about our AI improvements.</p>
  <p>Our AI can now build entire circuits using plain English—from finding any of our 19,000+ components to connecting the pins.</p>
  <p>Give it a quick try. Log in and tell the agent:</p>
  <pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 15px;">"Find an NE555 timer and an LED, then connect pin 3 of the timer to the LED."</pre>
  <p>Would love to hear what you think.</p>
  <p>Cheers,<br>
  Abdulrohim<br>
  <a href="https://buildpcbs.com" style="color:#2563eb;text-decoration:none;">buildpcbs.com</a></p>
</div>
`;

const emailText = `Hi there,

Just following up on my previous email about our AI improvements.

Our AI can now build entire circuits using plain English—from finding any of our 19,000+ components to connecting the pins.

Give it a quick try. Log in and tell the agent:

"Find an NE555 timer and an LED, then connect pin 3 of the timer to the LED."

Would love to hear what you think.

Cheers,
Abdulrohim
buildpcbs.com
`;

// List of emails that failed in the first campaign
const failedEmails = [
  "zenix691@gmail.com",
  "sofia@ispacei.in",
  "tinamda760@gmail.com",
  "yu.yanfeng@zte.com.cn",
  "poc9.sc@gmail.com",
  "samsudeenafolabi@gmail.com",
  "mrabdulrohim1@gmail.com",
];

async function sendEmailToUser(email: string, index: number, total: number) {
  try {
    const mailOptions = {
      from: `"Abdulrohim from BuildPCBs" <${process.env.SMTP_FROM_EMAIL}>`,
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [${index + 1}/${total}] Follow-up sent to ${email}`);
    console.log(`   Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error(
      `❌ [${index + 1}/${total}] Failed to send follow-up to ${email}:`,
      error
    );
    return false;
  }
}

function getRandomDelay(
  minSeconds: number = 10,
  maxSeconds: number = 30
): number {
  return (
    Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) *
    1000
  );
}

async function sendFollowUpEmails() {
  try {
    console.log(
      "🔄 Sending follow-up emails to previously failed addresses..."
    );
    console.log(`📧 ${failedEmails.length} follow-up emails to send`);

    // Verify SMTP connection
    console.log("🔧 Verifying SMTP connection...");
    await transporter.verify();
    console.log("✅ SMTP connection verified");

    console.log(
      `🚀 Starting follow-up campaign to ${failedEmails.length} users...`
    );
    console.log("⏰ Using longer delays (10-30 seconds) for follow-up");
    console.log("─".repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < failedEmails.length; i++) {
      const email = failedEmails[i];
      const success = await sendEmailToUser(email, i, failedEmails.length);

      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Don't add delay after the last email
      if (i < failedEmails.length - 1) {
        const delay = getRandomDelay(10, 30);
        console.log(
          `⏳ Waiting ${delay / 1000} seconds before next follow-up...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log("─".repeat(60));
    console.log(`🎉 Follow-up campaign completed!`);
    console.log(`✅ Successfully sent: ${successCount} follow-ups`);
    console.log(`❌ Failed to send: ${failCount} follow-ups`);
    console.log(`📊 Total processed: ${failedEmails.length} users`);
  } catch (error) {
    console.error("❌ Unexpected error:", error);
  }
}

// Run the follow-up campaign
sendFollowUpEmails();
