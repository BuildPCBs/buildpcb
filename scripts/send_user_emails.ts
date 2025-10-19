import dotenv from "dotenv";
dotenv.config({ path: ".env" });
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";

// --- SAFETY SWITCH ---
const IS_PRODUCTION_RUN = false;

// ... (Supabase and SMTP configuration remains the same) ...

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const smtpConfig = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
};
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase environment variables.");
}
if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
  throw new Error("Missing SMTP environment variables.");
}
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
const transporter = nodemailer.createTransport(smtpConfig);

// --- EMAIL CONTENT (Minimalist HTML to avoid Promotions tab) ---
const emailSubject = "19,000 new components + a smarter AI for you";

const emailHtml = `
<div style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.6;">
  <p>Hi there,</p>

  <p>My name is Abdulrohim, founder of buildpcbs.com. I'm writing to you personally because you were one of the very first people to sign up and give our idea a shot. Thank you for that.</p>

  <p>Frankly, our platform was very early-stage back then. Based on the vision of our first users (including you!), we've been working non-stop to build an AI agent that truly delivers on its promise.</p>

  <p>I'm excited to share that we've shipped some major updates. The agent is now a real co-pilot for your designs:</p>

  <p>
    - <b>Build with a massive library:</b> We've integrated over 19,000 KiCad standard components, so you can find almost any part you need.<br>
    - <b>Use natural language:</b> Instead of searching menus, you can now build faster by simply telling the agent what to do. Ask it to find components or even connect specific pins for you.<br>
    - <b>Get smarter suggestions:</b> The AI is now context-aware, understanding what's on your canvas and providing more intelligent suggestions to help you complete your circuit.
  </p>

  <p>I would be thrilled if you could spare two minutes to see it in action. Just log back in, start a project, and tell the agent:</p>

  <pre style="background: #f4f4f4; padding: 12px; border-radius: 4px; font-family: monospace; font-size: 15px;">"Find an NE555 timer and an LED, then connect pin 3 of the timer to the LED."</pre>

  <p>As an early user, your opinion is worth more than a thousand new signups. Any feedback you have on the new experience would be incredibly valuable to us.</p>

  <p>Thanks again for being there at the start.</p>

  <p>Best,<br>
  Abdulrohim<br>
  Founder, buildpcbs.com</p>

  <p><b>P.S.</b> We're all-in on your success. We now offer 24/7 support to every single user, so you'll never get stuck.</p>
</div>
`;

// This plain text version is a fallback and should match the HTML content.
const emailText = `
Hi there,

My name is Abdulrohim, founder of buildpcbs.com. I'm writing to you personally because you were one of the very first people to sign up and give our idea a shot. Thank you for that.

Frankly, our platform was very early-stage back then. Based on the vision of our first users (including you!), we've been working non-stop to build an AI agent that truly delivers on its promise.

I'm excited to share that we've shipped some major updates. The agent is now a real co-pilot for your designs:

- Build with a massive library: We've integrated over 19,000 KiCad standard components, so you can find almost any part you need.
- Use natural language: Instead of searching menus, you can now build faster by simply telling the agent what to do. Ask it to find components or even connect specific pins for you.
- Get smarter suggestions: The AI is now context-aware, understanding what's on your canvas and providing more intelligent suggestions to help you complete your circuit.

I would be thrilled if you could spare two minutes to see it in action. Just log back in, start a project, and tell the agent:

"Find an NE555 timer and an LED, then connect pin 3 of the timer to the LED."

As an early user, your opinion is worth more than a thousand new signups. Any feedback you have on the new experience would be incredibly valuable to us.

Thanks again for being there at the start.

Best,
Abdulrohim
Founder, buildpcbs.com

P.S. We're all-in on your success. We now offer 24/7 support to every single user, so you'll never get stuck.
`;

// ... (The rest of the script, including sendEmailToUser and sendEmailsToAllUsers, remains the same) ...

async function sendEmailToUser(email: string, index: number, total: number) {
  try {
    const mailOptions = {
      from: `"${process.env.SMTP_SENDER_NAME || "BuildPCBs"}" <${
        process.env.SMTP_FROM_EMAIL
      }>`,
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(
      `✅ [${index + 1}/${total}] Email sent successfully to ${email}`
    );
    console.log(`   Message ID: ${info.messageId}`);

    return true;
  } catch (error) {
    console.error(
      `❌ [${index + 1}/${total}] Failed to send email to ${email}:`,
      error
    );
    return false;
  }
}

function getRandomDelay(
  minSeconds: number = 5,
  maxSeconds: number = 25
): number {
  return (
    Math.floor(Math.random() * (maxSeconds - minSeconds + 1) + minSeconds) *
    1000
  );
}

async function sendEmailsToAllUsers() {
  try {
    console.log("🔧 Verifying SMTP connection...");
    await transporter.verify();
    console.log("✅ SMTP connection verified");

    let usersToSendTo: string[] = [];

    if (IS_PRODUCTION_RUN) {
      console.log("🚀 PRODUCTION MODE: Fetching all users from Supabase...");
      const {
        data: { users },
        error,
      } = await supabase.auth.admin.listUsers();
      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      const emails = users
        .map((user) => user.email)
        .filter(Boolean) as string[];
      usersToSendTo = emails;

      console.log(`👥 Found ${usersToSendTo.length} users to email.`);
    } else {
      console.log("🧪 TEST MODE: Sending to test emails only.");
      usersToSendTo = [
        "doyextech@gmail.com",
        "combotxtech@gmail.com",
        "wabre25@gmail.com",
        "mrabdulrohim1@gmail.com",
        "buildpcbai@gmail.com",
      ]; // Add your test emails here
      console.log(`📧 Test recipients: ${usersToSendTo.join(", ")}`);
    }

    if (usersToSendTo.length === 0) {
      console.log("🤷 No users to email. Exiting.");
      return;
    }

    console.log(
      `🚀 Starting email campaign to ${usersToSendTo.length} users...`
    );
    console.log("─".repeat(60));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < usersToSendTo.length; i++) {
      const email = usersToSendTo[i];
      const success = await sendEmailToUser(email, i, usersToSendTo.length);

      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      if (i < usersToSendTo.length - 1) {
        const delay = IS_PRODUCTION_RUN ? getRandomDelay() : 2000;
        console.log(`⏳ Waiting ${delay / 1000} seconds before next email...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    console.log("─".repeat(60));
    console.log(`🎉 Email campaign completed!`);
    console.log(`✅ Successfully sent: ${successCount} emails`);
    console.log(`❌ Failed to send: ${failCount} emails`);
    console.log(`📊 Total processed: ${usersToSendTo.length} users`);
  } catch (error) {
    console.error("❌ An unexpected error occurred:", error);
  }
}

sendEmailsToAllUsers();
