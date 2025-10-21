require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const SheetsService = require("./services/sheetsReader");

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => res.send("Rules Engine: alive"));

app.post("/webhook", async (req, res) => {
  /**
   * Endpoint pensado para Dialogflow (v2) webhook.
   * Dialogflow envía: queryResult.intent.displayName o queryResult.parameters
   * Nuestra respuesta devolverá el JSON que Dialogflow espera.
   */
  try {
    const body = req.body;
    const intentName = body?.queryResult?.intent?.displayName || null;
    const params = body?.queryResult?.parameters || {};
    const session = body?.session || "unknown_session";

    if (!intentName) {
      // fallback
      return res.json({
        fulfillmentText:
          "Lo siento, no entendí su solicitud. ¿Desea que le conecte con un agente humano?",
      });
    }

    // Obtener respuesta desde Sheets (CMS)
    const responseObj = await SheetsService.getResponseByIntent(intentName);

    if (!responseObj) {
      return res.json({
        fulfillmentText:
          "Lo siento, no tengo una respuesta configurada. ¿Desea hablar con un agente?",
      });
    }

    // Si el response_type es 'form' o requiere recolección, podemos manejarlo aquí
    // Para el PoC devolvemos fulfillmentText simple
    const text = responseObj.response_text || "Respuesta no configurada";

    // Opcional: si requiere pedir campos, los devolvemos como parte del mensaje
    return res.json({
      fulfillmentText: text,
      source: "rules-engine",
    });
  } catch (err) {
    console.error("Webhook error", err);
    return res
      .status(500)
      .json({ fulfillmentText: "Error interno en el webhook." });
  }
});

app.post("/get-response", async (req, res) => {
  /**
   * Endpoint simple para probar: { intent_name: "reservar_mesa" }
   */
  try {
    const { intent_name } = req.body;
    if (!intent_name)
      return res.status(400).json({ error: "intent_name requerido" });

    const response = await SheetsService.getResponseByIntent(intent_name);
    if (!response)
      return res.status(404).json({ error: "Intent no encontrado" });

    return res.json({ ok: true, data: response });
  } catch (err) {
    console.error("get-response error", err);
    return res.status(500).json({ error: "Error interno" });
  }
});

app.listen(PORT, () => {
  console.log(`Rules Engine corriendo en puerto ${PORT}`);
});
