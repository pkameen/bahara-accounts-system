// Netlify Serverless Function: Send Invoice via WhatsApp Business Cloud API
// Path: netlify/functions/send-invoice-whatsapp.js

export async function handler(event, context) {
  // CORS & Method check
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed. Use POST." }),
    };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const { invoiceNumber, customerName, customerPhone, pdfBase64 } = body;

    // 1. Basic Field Validation
    if (!customerPhone || !customerPhone.trim()) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Customer phone number is required." }),
      };
    }

    if (!pdfBase64) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invoice PDF document data is missing." }),
      };
    }

    // 2. Safe E.164 Phone Normalization
    let cleanPhone = customerPhone.replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+")) {
      // Default to India (+91) if 10 digits without country code
      if (cleanPhone.length === 10) {
        cleanPhone = "+91" + cleanPhone;
      } else {
        cleanPhone = "+" + cleanPhone;
      }
    }
    const whatsappRecipientNumber = cleanPhone.replace("+", "");

    // 3. Credentials Check
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return {
        statusCode: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "WhatsApp Business API credentials are not configured on Netlify environment.",
          code: "MISSING_CREDENTIALS",
        }),
      };
    }

    // 4. Convert Base64 PDF to Uint8Array Buffer
    const base64Clean = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const pdfBuffer = Buffer.from(base64Clean, "base64");

    // 5. Upload PDF to Meta WhatsApp Media API
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("type", "application/pdf");
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    const formattedInvNum = (invoiceNumber || "Invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Bahara_Invoice_${formattedInvNum}.pdf`;
    formData.append("file", pdfBlob, fileName);

    const mediaUploadRes = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    });

    const mediaUploadData = await mediaUploadRes.json();

    if (!mediaUploadRes.ok || !mediaUploadData.id) {
      console.error("Meta Media Upload Error:", mediaUploadData);
      return {
        statusCode: mediaUploadRes.status || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: mediaUploadData.error?.message || "Failed to upload invoice document to Meta WhatsApp server.",
          details: mediaUploadData.error || null,
        }),
      };
    }

    const mediaId = mediaUploadData.id;

    // 6. Send Document Message via Meta WhatsApp Cloud API
    const messagePayload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: whatsappRecipientNumber,
      type: "document",
      document: {
        id: mediaId,
        filename: fileName,
        caption: `Dear ${customerName || "Customer"},\n\nHere is your official invoice ${invoiceNumber || ""} from Bahara International.\n\nThank you for choosing Bahara!`,
      },
    };

    const sendMessageRes = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messagePayload),
    });

    const sendMessageData = await sendMessageRes.json();

    if (!sendMessageRes.ok || sendMessageData.error) {
      console.error("Meta Send Message Error:", sendMessageData);
      return {
        statusCode: sendMessageRes.status || 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: sendMessageData.error?.message || "WhatsApp API rejected the message delivery.",
          details: sendMessageData.error || null,
        }),
      };
    }

    const wamid = sendMessageData.messages?.[0]?.id || "wamid_success";

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        messageId: wamid,
        recipient: cleanPhone,
        message: `Invoice sent successfully to ${cleanPhone}`,
      }),
    };
  } catch (err) {
    console.error("Serverless Function Exception:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message || "An unexpected server error occurred." }),
    };
  }
}
