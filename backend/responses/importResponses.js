// importResponses.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser'); // npm install csv-parser
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || 'chatbot';

// --- Esquema Mongoose según CSV ---
const responseSchema = new mongoose.Schema({
  intent_id: { type: Number, required: true, unique: true },
  intent_name: { type: String, required: true },
  examples: { type: [String], default: [] },
  response_text: { type: String, required: true },
  collect_fields: { type: [String], default: [] },
  active: { type: Boolean, default: true },
}, { timestamps: true });

const Response = mongoose.model('Response', responseSchema);

// --- Función para leer CSV ---
function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// --- Transformar tipos ---
function transformRow(row) {
  return {
    intent_id: Number(row.intent_id),
    intent_name: row.intent_name || '',
    examples: row.examples ? row.examples.split('|').map(e => e.trim()) : [],
    response_text: row.response_text || '',
    collect_fields: row.collect_fields ? row.collect_fields.split('|').map(f => f.trim()) : [],
    active: row.active ? row.active.toString().toUpperCase() === 'TRUE' : true,
  };
}

// --- Función principal ---
async function run() {
  try {
    const filePath = path.resolve(__dirname, 'responses.csv'); // tu CSV
    const rawRows = await readCsv(filePath);
    console.log(`Filas leídas: ${rawRows.length}`);

    // Conectar a Mongo
    await mongoose.connect(MONGO_URI, { dbName: DB_NAME, useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Conectado a MongoDB');

    // Transformar y filtrar filas válidas
    const docs = rawRows.map(transformRow).filter(r => r.intent_id && r.intent_name);
    
    // Insertar con upsert para evitar duplicados por intent_id
    for (const doc of docs) {
      await Response.updateOne(
        { intent_id: doc.intent_id },
        { $set: doc },
        { upsert: true }
      );
      console.log(`Intent ID ${doc.intent_id} insertado/actualizado`);
    }

    console.log('Importación finalizada');
    mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

run();
