const { MongoClient } = require("mongodb");

const SECRET = process.env.MANYCHAT_INTEGRATION_TOKEN; // ver sección de env vars
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || "mydb";
const RESPONSES_COLLECTION = process.env.RESPONSES_COLLECTION || "responses";
const DEFAULT_REPLY =
  process.env.DEFAULT_REPLY || "Gracias — en breve le respondemos.";

let cachedClient = null;
let cachedDb = null;

async function connectToMongo() {
  if (cachedDb && cachedClient) return cachedDb;
  if (!MONGODB_URI)
    throw new Error("MONGODB_URI no configurada en variables de entorno");

  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  await client.connect();
  cachedClient = client;
  cachedDb = client.db(DB_NAME);
  return cachedDb;
}

/**
 * Lógica simple para elegir respuesta:
 * 1) Busca coincidencia exacta en campo "keywords" (array).
 * 2) Si no hay, busca por regex en campo "message" (texto) de collection.
 * 3) Si no hay, devuelve DEFAULT_REPLY.
 *
 * Estructura esperada por documento:
 * { keywords: ["hola","buenas"], message: "saludo general", response: "Hola — ¿en qué te ayudo?" }
 */
async function getReplyFromDB(userMessage) {
  if (!userMessage) return DEFAULT_REPLY;
  const db = await connectToMongo();
  const col = db.collection(RESPONSES_COLLECTION);

  const text = String(userMessage).trim().toLowerCase();

  // 1) buscar coincidencia en keywords
  const byKeyword = await col.findOne({ keywords: text });
  if (byKeyword && byKeyword.response) return byKeyword.response;

  // 2) intentar match parcial (regex) en 'message' o 'response' fields
  const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"); // escape
  const byMessage = await col.findOne({
    $or: [{ message: { $regex: regex } }, { keywords: { $in: [text] } }],
  });
  if (byMessage && byMessage.response) return byMessage.response;

  // 3) fallback: buscar por coincidencia por tokenización (palabras clave)
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length) {
    const match = await col.findOne({ keywords: { $in: tokens } });
    if (match && match.response) return match.response;
  }

  // 4) fallback general
  return DEFAULT_REPLY;
}

module.exports = async function (req, res) {
  // Sólo POST
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  // Autenticación simple mediante Bearer token
  const auth =
    req.headers["authorization"] || req.headers["Authorization"] || "";
  if (!SECRET || !auth.startsWith("Bearer ") || auth.split(" ")[1] !== SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let body;
  try {
    body =
      req.body ||
      (await (async () => {
        // Express-less environments: parse body manually
        return new Promise((resolve, reject) => {
          let data = "";
          req.on("data", (chunk) => {
            data += chunk;
          });
          req.on("end", () => {
            try {
              resolve(JSON.parse(data || "{}"));
            } catch (e) {
              reject(e);
            }
          });
          req.on("error", reject);
        });
      })());
  } catch (err) {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // Campos esperados desde ManyChat (configurables):
  // { contact_id, user_name, message }
  const contactId = body.contact_id || (body.contact && body.contact.id);
  const userName = body.user_name || (body.user && body.name) || "";
  const message = body.message || body.text || "";

  if (!contactId) {
    return res.status(400).json({ error: "Missing contact_id" });
  }

  try {
    const replyText = await getReplyFromDB(message);

    // Respuesta esperada por ManyChat: JSON con campo que mapees en External Request.
    // Aquí devolvemos { ok, reply, meta }.
    return res.status(200).json({
      ok: true,
      reply: replyText,
      meta: {
        contactId: contactId,
        userName: userName,
        receivedMessage: message,
      },
    });
  } catch (err) {
    console.error("manychat handler error:", err);
    return res.status(500).json({ error: "Server error" });
  }
};
