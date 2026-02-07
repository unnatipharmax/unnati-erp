import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

function getAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing GOOGLE service account env vars");
  }

  privateKey = privateKey.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: SCOPES,
  });
}

export async function createClientAccountSheet(sheetTitle: string) {
  const auth = getAuth();

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const title = `Unnati - ${sheetTitle} - Orders`;

  // 1️⃣ CREATE spreadsheet
  const created = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [
        { properties: { title: "Orders" } },
        { properties: { title: "Sales Entry" } },
        { properties: { title: "Ledger" } },
      ],
    },
  });

  const spreadsheetId = created.data.spreadsheetId!;
  const spreadsheetUrl = created.data.spreadsheetUrl!;

  // 2️⃣ MOVE spreadsheet into your Drive folder  ✅ ADD THIS HERE
  await drive.files.update({
    fileId: spreadsheetId,
    addParents: process.env.GOOGLE_SHEETS_FOLDER_ID,
    removeParents: "root",
  });

  // 3️⃣ ADD HEADERS
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Orders!A1:K1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "ORDER_ID",
        "CREATED_AT",
        "CUSTOMER_NAME",
        "EMAIL",
        "PHONE",
        "ADDRESS",
        "CITY",
        "STATE",
        "PINCODE",
        "COUNTRY",
        "STATUS",
      ]],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Sales Entry!A1:H1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "ORDER_ID",
        "UPDATED_AT",
        "ITEMS_TOTAL",
        "SHIPPING",
        "ORDER_TOTAL",
        "SHIPMENT_MODE",
        "NOTES",
        "STATUS",
      ]],
    },
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Ledger!A1:G1",
    valueInputOption: "RAW",
    requestBody: {
      values: [[
        "LEDGER_ID",
        "CREATED_AT",
        "TYPE",
        "AMOUNT",
        "ORDER_ID",
        "NOTE",
        "BALANCE_AFTER",
      ]],
    },
  });

  return { spreadsheetId, spreadsheetUrl };
}
