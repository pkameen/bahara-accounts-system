// Netlify Serverless Function: Send Invoice via WhatsApp Business Cloud API
// Path: netlify/functions/send-invoice-whatsapp.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

export async function handler(event, context) {
  // 1. Preflight CORS check
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, message: "CORS preflight OK" }),
    };
  }

  // 2. HTTP Method check
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Method Not Allowed. Use POST.",
      }),
    };
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON request payload.",
        }),
      };
    }

    const { invoiceNumber, customerName, customerPhone, pdfBase64 } = body;

    // 3. Validation
    if (!customerPhone || !String(customerPhone).trim()) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Customer WhatsApp number is missing or invalid.",
        }),
      };
    }

    if (!pdfBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Unable to generate or access the invoice PDF.",
        }),
      };
    }

    // 4. Safe E.164 Phone Normalization
    let cleanPhone = String(customerPhone).replace(/[^\d+]/g, "");
    if (!cleanPhone.startsWith("+")) {
      if (cleanPhone.length === 10) {
        cleanPhone = "+91" + cleanPhone;
      } else {
        cleanPhone = "+" + cleanPhone;
      }
    }
    const whatsappRecipientNumber = cleanPhone.replace("+", "");

    if (whatsappRecipientNumber.length < 7) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Customer WhatsApp number is missing or invalid.",
        }),
      };
    }

    // 5. Environment Variables Check
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!accessToken || !phoneNumberId) {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "WhatsApp API configuration is incomplete.",
          code: "MISSING_CREDENTIALS",
        }),
      };
    }

    // 6. Convert Base64 PDF to Buffer safely
    let pdfBuffer;
    try {
      const base64Clean = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
      pdfBuffer = Buffer.from(base64Clean, "base64");
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error("Empty PDF buffer");
      }
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Unable to generate or access the invoice PDF.",
        }),
      };
    }

    // 7. Upload PDF to Meta WhatsApp Media API
    const formData = new FormData();
    formData.append("messaging_product", "whatsapp");
    formData.append("type", "application/pdf");
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });
    const formattedInvNum = (invoiceNumber || "Invoice").replace(/[^a-zA-Z0-9_-]/g, "_");
    const fileName = `Bahara_Invoice_${formattedInvNum}.pdf`;
    formData.append("file", pdfBlob, fileName);

    let mediaUploadRes;
    try {
      mediaUploadRes = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/media`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });
    } catch (netErr) {
      console.error("Meta Media Upload Network Exception:", netErr?.message || netErr);
      return {
        statusCode: 504,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Unable to connect to WhatsApp Business API.",
        }),
      };
    }

    let mediaUploadData = {};
    try {
      mediaUploadData = await mediaUploadRes.json();
    } catch {
      mediaUploadData = {};
    }

    if (!mediaUploadRes.ok || !mediaUploadData.id) {
      console.error("Meta Media Upload Error Status:", mediaUploadRes.status);
      const safeDetails = mediaUploadData.error?.message
        ? String(mediaUploadData.error.message).replace(accessToken, "[REDACTED]")
        : "Failed to upload invoice document to Meta WhatsApp server.";
      return {
        statusCode: mediaUploadRes.status || 502,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "WhatsApp API rejected the request.",
          details: safeDetails,
        }),
      };
    }

    const mediaId = mediaUploadData.id;

    // 8. Send Document Message via Meta WhatsApp Cloud API
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

    let sendMessageRes;
    try {
      sendMessageRes = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messagePayload),
      });
    } catch (netErr) {
      console.error("Meta Send Message Network Exception:", netErr?.message || netErr);
      return {
        statusCode: 504,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "Unable to connect to WhatsApp Business API.",
        }),
      };
    }

    let sendMessageData = {};
    try {
      sendMessageData = await sendMessageRes.json();
    } catch {
      sendMessageData = {};
    }

    if (!sendMessageRes.ok || sendMessageData.error) {
      console.error("Meta Send Message Error Status:", sendMessageRes.status);
      const safeDetails = sendMessageData.error?.message
        ? String(sendMessageData.error.message).replace(accessToken, "[REDACTED]")
        : "WhatsApp API rejected the message delivery.";
      return {
        statusCode: sendMessageRes.status || 502,
        headers: corsHeaders,
        body: JSON.stringify({
          success: false,
          error: "WhatsApp API rejected the request.",
          details: safeDetails,
        }),
      };
    }

    const wamid = sendMessageData.messages?.[0]?.id || "wamid_success";

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: "Invoice sent successfully",
        messageId: wamid,
        sentTo: cleanPhone,
        recipient: cleanPhone,
      }),
    };
  } catch (err) {
    console.error("Serverless Function Internal Exception:", err?.message || err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: "Unable to send invoice via WhatsApp.",
      }),
    };
  }
}
