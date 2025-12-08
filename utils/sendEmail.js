const Brevo = require("@getbrevo/brevo");

const apiInstance = new Brevo.TransactionalEmailsApi();

apiInstance.setApiKey(
  Brevo.TransactionalEmailsApiApiKeys.apiKey,
  process.env.BREVO_API_KEY
);

async function sendEmail(to, subject, html) {
  const email = new Brevo.SendSmtpEmail();

  email.sender = {
    name: "MacroBox",
    email: process.env.BREVO_SENDER,
  };

  email.to = [{ email: to }];

  email.subject = subject;
  email.htmlContent = html;

  try {
    console.log("📨 Sending Email To:", to);

    const response = await apiInstance.sendTransacEmail(email);
    console.log("✅ Email sent:", response);

    return response;
  } catch (error) {
    console.error("❌ EMAIL ERROR:", error.response?.data || error);
    throw error;
  }
}

module.exports = sendEmail;
