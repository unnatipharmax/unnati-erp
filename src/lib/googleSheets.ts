import { google } from "googleapis";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

type ServiceAccountCreds = {
  client_email: string;
  private_key: string;
};

function loadServiceAccountCreds(): ServiceAccountCreds {
  // 1) Preferred: base64 JSON (best for Vercel env)
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  if (b64) {
    const jsonStr = Buffer.from(b64, "base64").toString("utf8");
    const parsed = JSON.parse(jsonStr);
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error("Service account JSON missing client_email/private_key");
    }
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key,
    };
  }
  throw new Error(
    "Missing service account creds. Provide GOOGLE_SERVICE_ACCOUNT_JSON_B64 or GOOGLE_SERVICE_ACCOUNT_JSON or EMAIL/PRIVATE_KEY."
  );
}

function getJwtClient() {
  const { client_email, private_key } = loadServiceAccountCreds();

  const fixedKey = private_key.replace(/\\n/g, "\n");

  return new google.auth.JWT({
    email: client_email,
    key: fixedKey,
    scopes: SCOPES,
  });
}

export async function createClientAccountSheet(sheetTitle: string) {
  const auth = getJwtClient();

  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });

  const title = `Unnati - ${sheetTitle} - Orders`;

  // 1) Create spreadsheet
  let created;
  try {
    created = await sheets.spreadsheets.create({
      requestBody: {
        properties: { title },
        sheets: [
          { properties: { title: "Orders" } },
          { properties: { title: "Sales Entry" } },
          { properties: { title: "Ledger" } },
        ],
      },
    });
  } catch (e: any) {
    console.error("SHEETS_CREATE_FAILED:", JSON.stringify(e?.response?.data || e, null, 2));
    throw e;
  }

  const spreadsheetId = created.data.spreadsheetId!;
  const spreadsheetUrl = created.data.spreadsheetUrl!;

  // 2) Move to folder (optional)
  const folderId = process.env.GOOGLE_SHEETS_FOLDER_ID;
  if (folderId) {
    try {
      await drive.files.update({
        fileId: spreadsheetId,
        addParents: folderId,
        removeParents: "root",
        supportsAllDrives: true,
      });
    } catch (e: any) {
      console.error("DRIVE_MOVE_FAILED:", JSON.stringify(e?.response?.data || e, null, 2));
      // not fatal
    }
  }

  // 3) Share to admin email so you can see it (optional but recommended)
  const adminEmail = process.env.GOOGLE_SHEETS_ADMIN_EMAIL;
  if (adminEmail) {
    try {
      await drive.permissions.create({
        fileId: spreadsheetId,
        supportsAllDrives: true,
        sendNotificationEmail: false,
        requestBody: {
          type: "user",
          role: "writer",
          emailAddress: adminEmail,
        },
      });
    } catch (e: any) {
      console.error("DRIVE_SHARE_FAILED:", JSON.stringify(e?.response?.data || e, null, 2));
      // not fatal
    }
  }

  // 4) Headers
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
