// backend/src/db/connection.js
const path = require("path");
const fs = require("fs");
const { MongoClient, ServerApiVersion } = require("mongodb");
const dotenv = require("dotenv");

// Rutas candidatas donde podría estar el .env
const candidates = [
  path.resolve(__dirname, "../../../.env"), // raiz del repo (lo que necesitas)
  path.resolve(__dirname, "../../.env"),   // backend/.env (fallback antiguo)
  path.resolve(process.cwd(), ".env"),     // cwd actual (si ejecutas desde raíz o backend)
];

let loaded = null;
for (const p of candidates) {
  if (fs.existsSync(p)) {
    console.log("🧭 Cargando .env desde:", p);
    loaded = dotenv.config({ path: p });
    break;
  }
}
if (!loaded) {
  console.warn("⚠️ No se encontró archivo .env en las rutas esperadas:", candidates);
  // No hacemos throw aún; esto permite ejecutar entornos donde las envs vienen de otra fuente.
}

const uri = process.env.MONGO_URI;

if (!uri) {
  console.error("❌ Error: MONGO_URI no está definido en las variables de entorno.");
  console.error("Asegúrate que .env contenga: MONGO_URI=tu_uri_sin_comillas");
  throw new Error("MONGO_URI no está definido en .env");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let _db = null;

async function connectToDatabase() {
  if (_db) return _db;
  try {
    await client.connect();
    _db = client.db();
    console.log("✅ Conectado correctamente a MongoDB Atlas");
    return _db;
  } catch (error) {
    console.error("❌ Error al conectar a MongoDB:", error);
    throw error;
  }
}

function getClient() {
  return client;
}

async function closeConnection() {
  await client.close();
  _db = null;
  console.log("🔌 Conexión a MongoDB cerrada");
}

module.exports = {
  connectToDatabase,
  getClient,
  closeConnection,
};
