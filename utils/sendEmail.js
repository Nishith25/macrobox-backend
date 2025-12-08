const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

// Set API Key
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendEmail(to, subject, html) {
  try {
    const email = new Brevo.SendSmtpEmail();

    email.sender = {
      name: "MacroBox",
      email: process.env.BREVO_SENDER || "no-reply@macrobox.com",
    };

    email.to = [{ email: to }];
    email.subject = subject;
    email.htmlContent = html;

    console.log("📨 Sending Email To:", to);
    console.log("📧 Subject:", subject);

    const response = await apiInstance.sendTransacEmail(email);
    console.log("✅ Email sent successfully:", response.messageId || response);

    return response;
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error.response?.data || error.message || error);
    throw new Error("Email sending failed");
  }
}

module.exports = sendEmail;
