// Nivaara Realty WhatsApp Cloud API bot
//
// This Node.js server implements a simple WhatsApp bot for Nivaara Realty
// using Meta’s Cloud API.  The conversation flow mirrors the video
// example provided by the user: a welcome message with three
// interactive buttons, followed by a configuration list, a budget list,
// a reason selection, and a final summary with a link to the web site.
//
// ENVIRONMENT VARIABLES
// ----------------------
// WHATSAPP_TOKEN     – Your permanent system user token for the Cloud API
// PHONE_NUMBER_ID    – The phone number ID assigned by Meta when you
//                       register your WhatsApp business number with the
//                       WhatsApp Business Platform
// VERIFY_TOKEN       – An arbitrary string you supply to verify the
//                       webhook endpoint in the Meta developer console
// PORT               – Optional.  The port this Express app will listen on
//
// To start the server, run:
//    WHATSAPP_TOKEN="<your_token>" PHONE_NUMBER_ID="<id>" \
//    VERIFY_TOKEN="<secret>" node server.js
//
// See Meta’s “Get Started” guide for details on creating a developer
// app and onboarding your number【936842042855151†screenshot】.  Pricing for the
// Cloud API is based on template categories and only applies when
// template messages are delivered【200724241542217†screenshot】.  Normal text messages sent
// within the customer‑service window are free【200724241542217†screenshot】.

import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

// Pull values from environment
const {
  WHATSAPP_TOKEN,
  PHONE_NUMBER_ID,
  VERIFY_TOKEN,
  PORT = 3000,
} = process.env;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !VERIFY_TOKEN) {
  console.error(
    "Error: Missing required environment variables. Please set WHATSAPP_TOKEN, PHONE_NUMBER_ID and VERIFY_TOKEN."
  );
  process.exit(1);
}

// Base URL for the Graph API.  Version 20 is used here because it will
// remain stable through mid‑2026.
const GRAPH_BASE = "https://graph.facebook.com/v20.0";
const SEND_URL = `${GRAPH_BASE}/${PHONE_NUMBER_ID}/messages`;

// In‑memory conversation state.  In production you should store
// conversation data in a database or cache (e.g. Redis) keyed by
// WhatsApp user id to support multiple simultaneous users.
const state = new Map();

/**
 * Retrieve or initialise state for a given WhatsApp user (waId).
 *
 * @param {string} waId - The user’s WhatsApp ID (phone number id)
 * @returns {object} A mutable state object for this user
 */
function getUserState(waId) {
  if (!state.has(waId)) {
    // Default state when new user interacts
    state.set(waId, {
      step: "START",
      config: null,
      budget: null,
      reason: null,
    });
  }
  return state.get(waId);
}

/**
 * Send a message through the WhatsApp Cloud API.
 * The payload parameter must conform to the API specification.
 *
 * @param {object} payload - Message payload to POST
 */
async function sendMessage(payload) {
  await axios.post(SEND_URL, payload, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
  });
}

/**
 * Send the welcome message with three buttons: Search Property, Why Nivaara?,
 * and Talk to Expert.  This message is sent when a new user says
 * “hi” or when we want to present the main menu again after
 * completing a flow.
 *
 * @param {string} to - WhatsApp ID of the recipient
 */
async function sendWelcome(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text:
          "👋 Hi! Welcome to *Nivaara Realty* 🏡\n\n" +
          "We simplify your real estate journey across Pune and beyond.\n" +
          "Please choose an option below to get started ⬇️",
      },
      action: {
        buttons: [
          { type: "reply", reply: { id: "BTN_SEARCH", title: "Search Property" } },
          { type: "reply", reply: { id: "BTN_WHY", title: "Why Nivaara?" } },
          { type: "reply", reply: { id: "BTN_EXPERT", title: "Talk to Expert" } },
        ],
      },
    },
  };
  await sendMessage(payload);
}

/**
 * Send the configuration list (1 BHK, 2 BHK, etc.).  This mirrors
 * the dropdown list in the example video.  Each row has an ID we
 * recognise in our handler to update user state.
 *
 * @param {string} to - WhatsApp ID
 */
async function sendConfigList(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "🏠 Select configuration" },
      action: {
        button: "Choose",
        sections: [
          {
            title: "Configuration",
            rows: [
              { id: "CFG_1BHK", title: "1 BHK" },
              { id: "CFG_2BHK", title: "2 BHK" },
              { id: "CFG_3BHK", title: "3 BHK" },
              { id: "CFG_4PLUS", title: "4+ BHK" },
            ],
          },
        ],
      },
    },
  };
  await sendMessage(payload);
}

/**
 * Send the budget list.  The ranges here correspond to typical
 * property budgets in the Pune market but you can modify them to
 * better fit your inventory.  Each row has an ID prefixed with
 * BUD_ to identify the selection.
 *
 * @param {string} to - WhatsApp ID
 */
async function sendBudgetList(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "💰 Choose your price range" },
      action: {
        button: "Select",
        sections: [
          {
            title: "Price Range",
            rows: [
              { id: "BUD_BELOW_50", title: "Below ₹50L" },
              { id: "BUD_50_75", title: "₹50–75L" },
              { id: "BUD_75_1CR", title: "₹75L–1Cr" },
              { id: "BUD_1CR_PLUS", title: "₹1Cr+" },
            ],
          },
        ],
      },
    },
  };
  await sendMessage(payload);
}

/**
 * Send reason buttons (Self Use vs Investment).  These two options
 * correspond to most purchase intents we see in real estate.  You
 * could add more if required.
 *
 * @param {string} to - WhatsApp ID
 */
async function sendReasonButtons(to) {
  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: "Almost done! Why are you looking to buy?" },
      action: {
        buttons: [
          { type: "reply", reply: { id: "RSN_SELF", title: "Self Use" } },
          { type: "reply", reply: { id: "RSN_INVEST", title: "Investment" } },
        ],
      },
    },
  };
  await sendMessage(payload);
}

/**
 * Send the final summary and call‑to‑action once the user has
 * selected configuration, budget and reason.  The summary repeats
 * their selections to confirm and provides a link to your web site.
 * After sending this message we call sendWelcome again so that the
 * user sees the main menu at the bottom of the thread.
 *
 * @param {string} to - WhatsApp ID
 * @param {object} userState - The user’s conversation state
 */
async function sendFinal(to, userState) {
  const link = "https://nivaararealty.com/"; // default property listing page
  const summary =
    `✅ Great! Here’s what you selected:\n` +
    `• Configuration: ${userState.config || "-"}\n` +
    `• Budget: ${userState.budget || "-"}\n` +
    `• Purpose: ${userState.reason || "-"}\n\n`;

  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body:
        summary +
        "👉 Browse matching properties here: " + link + "\n" +
        "Or type *CALLBACK* to connect with our expert."
    },
  });
  // Present the main menu again
  await sendWelcome(to);
}

/**
 * Respond to the user’s request for information about Nivaara.
 * This function sends a short explanation drawn from the company’s
 * web site.  Nivaara is positioned as an end‑to‑end real estate
 * consultancy operating across India and internationally, with
 * expertise in Pune and a focus on trust and transparency【222220955652304†L43-L47】【222220955652304†L94-L110】.
 *
 * @param {string} to - WhatsApp ID
 */
async function sendWhyNivaara(to) {
  const text =
    "✅ *Why choose Nivaara?*\n" +
    "• Comprehensive real estate consultancy across residential, commercial, land and investment deals.\n" +
    "• Operates pan‑India and internationally, with a base in Pune and deep market expertise【222220955652304†L43-L47】.\n" +
    "• End‑to‑end service: from search to paperwork, we manage everything【222220955652304†L94-L110】.\n" +
    "• Trust & transparency with verified properties and honest guidance【222220955652304†L94-L110】.\n" +
    "\nTap *Search Property* to explore listings or *Talk to Expert* for personalised advice.";
  await sendMessage({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
  // Show menu again
  await sendWelcome(to);
}

/**
 * Webhook verification endpoint.  Meta will send a GET request to
 * verify your endpoint when you configure the webhook in the
 * developer portal.  Respond with the challenge value if the
 * supplied token matches your VERIFY_TOKEN.
 */
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * Main webhook endpoint for incoming messages.  This handler
 * processes both text and interactive reply messages and routes
 * between the different steps of the conversation flow.
 */
app.post("/webhook", async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];
    if (!message) return res.sendStatus(200);
    const from = message.from;
    const userState = getUserState(from);
    // Determine if the message is an interactive reply
    let incomingId = null;
    if (message.type === "interactive") {
      const interactive = message.interactive;
      if (interactive.type === "button_reply") {
        incomingId = interactive.button_reply.id;
      } else if (interactive.type === "list_reply") {
        incomingId = interactive.list_reply.id;
      }
    }
    // Text input
    const text = message.type === "text" ? (message.text?.body || "").trim() : "";
    // Commands: user can type HI to restart or CALLBACK to request a call
    if (/^(hi|hello)$/i.test(text) || userState.step === "START") {
      userState.step = "MENU";
      await sendWelcome(from);
      return res.sendStatus(200);
    }
    if (/^callback$/i.test(text)) {
      await sendMessage({
        messaging_product: "whatsapp",
        to: from,
        type: "text",
        text: {
          body: "📞 Please share your *Name + Preferred Area + Budget* and our advisor will call you shortly."
        },
      });
      userState.step = "LEAD_CAPTURE";
      return res.sendStatus(200);
    }
    // Route based on incoming interactive ID
    switch (incomingId) {
      case "BTN_SEARCH":
        userState.step = "ASK_CONFIG";
        await sendConfigList(from);
        break;
      case "BTN_WHY":
        await sendWhyNivaara(from);
        break;
      case "BTN_EXPERT":
        userState.step = "LEAD_CAPTURE";
        await sendMessage({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: "📞 Sure — please share your *Name + Preferred Area + Budget* and we’ll call you."
          },
        });
        break;
      // Configuration selection
      case "CFG_1BHK":
      case "CFG_2BHK":
      case "CFG_3BHK":
      case "CFG_4PLUS":
        userState.config = incomingId.replace("CFG_", "");
        userState.step = "ASK_BUDGET";
        await sendBudgetList(from);
        break;
      // Budget selection
      case "BUD_BELOW_50":
      case "BUD_50_75":
      case "BUD_75_1CR":
      case "BUD_1CR_PLUS":
        userState.budget = incomingId.replace("BUD_", "").replaceAll("_", " ");
        userState.step = "ASK_REASON";
        await sendReasonButtons(from);
        break;
      // Reason selection
      case "RSN_SELF":
      case "RSN_INVEST":
        userState.reason = incomingId === "RSN_SELF" ? "Self Use" : "Investment";
        userState.step = "DONE";
        await sendFinal(from, userState);
        break;
      default:
        // Any other interactive ID or raw text triggers a gentle prompt
        await sendMessage({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: "Type *HI* to start over, or *CALLBACK* for an expert call."
          },
        });
        break;
    }
    return res.sendStatus(200);
  } catch (err) {
    console.error(err?.response?.data || err);
    return res.sendStatus(200);
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Nivaara bot is listening on port ${PORT}`);
});