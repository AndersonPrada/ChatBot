// src/testConnection.js
const {
  connectToDatabase,
  closeConnection,
  getClient,
} = require("./db/connection");

async function test() {
  try {
    const db = await connectToDatabase();
    // ping simple
    const admin = db.admin ? db.admin() : getClient().db("admin").admin();
    const res = await admin.command({ ping: 1 });
    console.log("Ping OK — conectado a MongoDB Atlas:", res);

    // opcional: listar bases de datos (solo para ver)
    // const dbs = await getClient().db().admin().listDatabases();
    // console.log('Bases de datos disponibles:', dbs.databases.map(d => d.name));
  } catch (err) {
    console.error("Error conectando a MongoDB Atlas:", err);
    process.exitCode = 1;
  } finally {
    await closeConnection();
  }
}
test();
