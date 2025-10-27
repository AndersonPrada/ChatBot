const { google } = require("googleapis");

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const RANGE = process.env.SHEETS_RANGE || "responses!A:G";

let sheetsClient;

function getJwtClient() {
  if (sheetsClient) return sheetsClient;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
  // Ajustar si los saltos de linea vienen escapados
  privateKey = privateKey.replace(/\\n/g, "\n");

  const jwtClient = new google.auth.JWT(clientEmail, null, privateKey, [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ]);
  sheetsClient = jwtClient;
  return jwtClient;
}

async function getSheetRows() {
  const auth = getJwtClient();
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
  });
  // resp.data.values is an array of rows
  const rows = resp.data.values || [];
  // first row is headers
  const headers = rows.shift() || [];
  const parsed = rows.map((r) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = r[i] !== undefined ? r[i] : "";
    });
    return obj;
  });
  return parsed;
}

async function getResponseByIntent(intentName) {
  const rows = await getSheetRows();
  // buscamos por intent_name o intent_id
  const match = rows.find(
    (r) =>
      (r.intent_name &&
        r.intent_name.toString().toLowerCase() ===
          intentName.toString().toLowerCase()) ||
      (r.intent_id && r.intent_id.toString() === intentName.toString())
  );
  return match || null;
}

module.exports = {
  getSheetRows,
  getResponseByIntent,
};
