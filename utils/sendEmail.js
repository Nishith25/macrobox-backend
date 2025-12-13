const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

// ✅ Set Brevo API Key
apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

/**
 * Send transactional email using Brevo
 * @param {string} to - Receiver email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 */
async function sendEmail(to, subject, html) {
  try {
    const email = new Brevo.SendSmtpEmail();

    // ✅ VERIFIED sender (MUST match Brevo sender exactly)
    email.sender = {
      name: "MacroBox",
      email: process.env.EMAIL_FROM, // no-reply@macrobox.co.in
    };

    email.to = [
      {
        email: to,
      },
    ];

    email.subject = subject;
    email.htmlContent = html;

    console.log("📨 Sending email to:", to);

    const response = await apiInstance.sendTransacEmail(email);

    console.log("✅ Email sent successfully:", response.messageId || response);
    return response;
  } catch (error) {
    console.error(
      "❌ Email error:",
      error.response?.data || error.message || error
    );
    throw new Error("Email sending failed");
  }
}

module.exports = sendEmail;
