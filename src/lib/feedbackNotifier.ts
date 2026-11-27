import nodemailer from "nodemailer";

export interface FeedbackNotificationPayload {
  ticketNo: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  userName: string;
  userEmail: string;
  userRole: string;
  deviceInfo?: string;
  createdAt?: string;
}

const DEFAULT_TARGET_EMAIL = "jeetsatasiya993@gmail.com";

const CATEGORY_NAMES: Record<string, string> = {
  FEATURE_REQUEST: "💡 નવું ફીચર સૂચન (New Feature Request)",
  APP_IMPROVEMENT: "⚡ એપ સુધારો & સ્પીડ (App Improvement)",
  BUG_REPORT: "🐛 ભૂલ / ખામી રિપોર્ટ (Bug / Error Report)",
  GENERAL_FEEDBACK: "💬 સામાન્ય અભિપ્રાય (General Feedback)",
};

const PRIORITY_LABELS: Record<string, string> = {
  HIGH: "🔴 તાત્કાલિક (Urgent / High)",
  MEDIUM: "🟡 મહત્વનું (Important / Medium)",
  LOW: "🟢 સામાન્ય (Normal / Low)",
};

/**
 * Send an automated email notification to jeetsatasiya993@gmail.com
 * when a trustee submits a new feedback or feature request.
 */
export async function sendFeedbackEmailNotification(payload: FeedbackNotificationPayload): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  recipient: string;
}> {
  const recipient = process.env.FEEDBACK_NOTIFY_EMAIL || DEFAULT_TARGET_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT) || 465;

  const categoryLabel = CATEGORY_NAMES[payload.category] || payload.category;
  const priorityLabel = PRIORITY_LABELS[payload.priority] || payload.priority;
  const formattedDate = payload.createdAt
    ? new Date(payload.createdAt).toLocaleString("gu-IN", { timeZone: "Asia/Kolkata" })
    : new Date().toLocaleString("gu-IN", { timeZone: "Asia/Kolkata" });

  const subject = `[SSPS ફીડબેક] ${priorityLabel.split(" ")[0]} ${payload.title} (${payload.ticketNo})`;

  const textBody = `
નવું ટ્રસ્ટી ફીડબેક / ફીચર સૂચન પ્રાપ્ત થયું છે:
--------------------------------------------------
ટિકિટ નંબર: ${payload.ticketNo}
કેટેગરી: ${categoryLabel}
અગ્રતા: ${priorityLabel}
સૂચનકર્તા: ${payload.userName} (${payload.userRole})
ઈમેલ: ${payload.userEmail}
તારીખ/સમય: ${formattedDate}
ડિવાઇસ: ${payload.deviceInfo || "Admin Web Portal"}

વિષય:
${payload.title}

વિગતવાર વર્ણન:
${payload.description}
--------------------------------------------------
શ્રી સૌરાષ્ટ્ર પટેલ સમાજ, નિકોલ - નરોડા પ્રાઇવેટ એડમિન પોર્ટલ
`;

  const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 24px;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
    
    <!-- Header Banner -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%); padding: 24px 28px; color: #ffffff;">
      <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #93c5fd; margin-bottom: 6px;">
        🏛️ શ્રી સૌરાષ્ટ્ર પટેલ સમાજ, નિકોલ - નરોડા
      </div>
      <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">
        નવું ટ્રસ્ટી ફીડબેક / ફીચર સૂચન પ્રાપ્ત થયું
      </h2>
      <div style="margin-top: 6px; font-size: 12px; color: #bfdbfe;">
        ટિકિટ નંબર: <strong style="color: #fbbf24; font-family: monospace;">${payload.ticketNo}</strong>
      </div>
    </div>

    <!-- Details Card -->
    <div style="padding: 24px 28px;">
      
      <!-- Meta Badges -->
      <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 12px; background: #f1f5f9; border-radius: 8px; width: 50%;">
            <span style="font-size: 10px; color: #64748b; display: block; font-weight: bold;">સૂચનનો પ્રકાર</span>
            <span style="font-size: 13px; font-weight: bold; color: #0f172a;">${categoryLabel}</span>
          </td>
          <td style="width: 12px;"></td>
          <td style="padding: 8px 12px; background: #fef2f2; border-radius: 8px; width: 50%;">
            <span style="font-size: 10px; color: #64748b; display: block; font-weight: bold;">અગ્રતા (Priority)</span>
            <span style="font-size: 13px; font-weight: bold; color: #991b1b;">${priorityLabel}</span>
          </td>
        </tr>
      </table>

      <!-- Title & Description Section -->
      <div style="margin-bottom: 20px;">
        <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">
          વિષય (Subject):
        </div>
        <div style="font-size: 16px; font-weight: bold; color: #0f172a; padding: 10px 14px; background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px;">
          ${payload.title}
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase; margin-bottom: 4px;">
          વિગતવાર વર્ણન (Detailed Description):
        </div>
        <div style="font-size: 14px; line-height: 1.6; color: #334155; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; white-space: pre-wrap;">
${payload.description}
        </div>
      </div>

      <!-- Submitter Info Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; background: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 35%;">સૂચનકર્તા ટ્રસ્ટી:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${payload.userName} (${payload.userRole})</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">ટ્રસ્ટી ઈમેલ:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${payload.userEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">તારીખ અને સમય:</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a;">${formattedDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 12px; color: #64748b;">ડિવાઇસ / બ્રાઉઝર:</td>
          <td style="padding: 8px 12px; color: #0f172a;">${payload.deviceInfo || "Admin Web Portal"}</td>
        </tr>
      </table>

      <!-- Action Button -->
      <div style="text-align: center; margin-top: 10px;">
        <a href="https://shree-saurashtra-patel-samaj-booking.vercel.app/admin/feedback" 
           style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 13px;">
          વહીવટ પોર્ટલમાં ફીડબેક જુઓ &rarr;
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background: #f1f5f9; padding: 14px 28px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0;">
      આ ઈમેલ શ્રી સૌરાષ્ટ્ર પટેલ સમાજ (નિકોલ-નરોડા) બુકિંગ પોર્ટલ દ્વારા આપોઆપ મોકલવામાં આવેલ છે.<br>
      નોટિફિકેશન ઈમેલ: <strong style="color: #0f172a;">${recipient}</strong>
    </div>

  </div>
</body>
</html>
`;

  // If SMTP credentials are configured, send real email via nodemailer
  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: `"શ્રી સૌરાષ્ટ્ર પટેલ સમાજ બુકિંગ" <${smtpUser}>`,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`[Feedback Notification] Email sent successfully to ${recipient}. MessageId: ${info.messageId}`);
      return { success: true, messageId: info.messageId, recipient };
    } catch (err: any) {
      console.error("[Feedback Notification] SMTP send error:", err);
      return { success: false, error: err.message || "Failed to send email via SMTP", recipient };
    }
  } else {
    // If SMTP credentials are not yet set in environment, log to console for debugging
    console.warn(
      `[Feedback Notification] SMTP credentials (SMTP_USER, SMTP_PASS) not configured in .env. Target recipient is ${recipient}. Ticket: ${payload.ticketNo}. Set SMTP_USER & SMTP_PASS to enable automatic SMTP delivery.`
    );
    return {
      success: false,
      error: "SMTP_CREDENTIALS_MISSING",
      recipient,
    };
  }
}
