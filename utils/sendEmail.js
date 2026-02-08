const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

// Set API Key
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.warn("⚠️ BREVO_API_KEY missing. Email skipped.");
      return;
    }

    const email = new Brevo.SendSmtpEmail();

    email.sender = {
      name: "MacroBox",
      email: process.env.BREVO_SENDER || "no-reply@macrobox.co.in",
    };

    email.to = [{ email: to }];
    email.subject = subject;
    email.htmlContent = html;

    console.log("📨 Sending Email To:", to);

    const response = await apiInstance.sendTransacEmail(email);
    console.log("✅ Email sent:", response.messageId || "OK");

    return response;
  } catch (error) {
    // 🚫 DO NOT THROW
    console.error(
      "❌ EMAIL FAILED:",
      error.response?.body || error.message || error
    );

    // Allow signup to continue
    return null;
  }
}

module.exports = sendEmail;
