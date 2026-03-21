import { NextResponse } from "next/server";

export const runtime = "nodejs";

const URL = "https://mis.cept.gov.in/General/IPS_Track.aspx";

function pickHidden(html: string, name: string) {
  // matches: <input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="..."/>
  const re = new RegExp(
    `<input[^>]+name="${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}"[^>]*value="([^"]*)"`,
    "i"
  );
  const m = html.match(re);
  return m?.[1] ?? null;
}

function pickFirstMatch(html: string, re: RegExp) {
  const m = html.match(re);
  return m?.[1] ?? null;
}

function decodeHtmlEntities(s: string) {
  // minimal decode for common entities (good enough for numeric values)
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function stripTags(s: string) {
  return decodeHtmlEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Extract Article Value from the "Article Information" table:
 * We locate the column index of "Article Value" in header row,
 * then read same column cell from the first data row.
 */
function extractArticleValue(html: string) {
  // Grab the table that contains "Article Value" (first match)
  const tableHtml =
    pickFirstMatch(html, /<table[\s\S]*?<\/table>/i) ??
    null;

  // Better: find the specific table that includes "Article Value"
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  const target = tables.find(t => /Article\s*Value/i.test(t)) ?? null;
  if (!target) return null;

  // Find header cells (th)
  const headerRowMatch = target.match(/<tr[\s\S]*?<\/tr>/i);
  if (!headerRowMatch) return null;

  const headerRow = headerRowMatch[0];
  const ths = headerRow.match(/<th[\s\S]*?<\/th>/gi) ?? [];
  if (ths.length === 0) {
    // sometimes headers are td
    const tds = headerRow.match(/<td[\s\S]*?<\/td>/gi) ?? [];
    if (tds.length === 0) return null;
    const idx = tds.findIndex(c => /Article\s*Value/i.test(stripTags(c)));
    if (idx === -1) return null;
    const rows = target.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
    const dataRow = rows[1];
    if (!dataRow) return null;
    const dataCells = dataRow.match(/<td[\s\S]*?<\/td>/gi) ?? [];
    return dataCells[idx] ? stripTags(dataCells[idx]) : null;
  }

  const colIndex = ths.findIndex(c => /Article\s*Value/i.test(stripTags(c)));
  if (colIndex === -1) return null;

  const rows = target.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const dataRow = rows[1]; // first row after header
  if (!dataRow) return null;

  const dataTds = dataRow.match(/<td[\s\S]*?<\/td>/gi) ?? [];
  if (!dataTds[colIndex]) return null;

  return stripTags(dataTds[colIndex]);
}

export async function POST(req: Request) {
  const body = await req.json();
  const trackingNo = body?.trackingNo;
  const debug = body?.debug ?? false;

  if (!trackingNo || typeof trackingNo !== "string") {
    return NextResponse.json({ error: "trackingNo required" }, { status: 400 });
  }

  try {
    // 1) GET page to obtain WebForms hidden fields + session cookies
    const getRes = await fetch(URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Connection": "keep-alive",
      },
      redirect: "follow",
    });

    const setCookie = getRes.headers.get("set-cookie") || "";
    const cookieHeader = setCookie
      .split(",")
      .map(c => c.split(";")[0])
      .join("; ");

    const html1 = await getRes.text();

    const viewstate = pickHidden(html1, "__VIEWSTATE");
    const eventValidation = pickHidden(html1, "__EVENTVALIDATION");
    const viewstateGen = pickHidden(html1, "__VIEWSTATEGENERATOR");

    if (!viewstate || !eventValidation) {
      return NextResponse.json(
        {
          error: "Could not read VIEWSTATE/EVENTVALIDATION (page changed or blocked).",
          trackingNo,
          snippet: debug ? html1.slice(0, 2000) : undefined,
        },
        { status: 500 }
      );
    }

    // 2) POST back like the button does
    // From your HTML: name="ctl00$ContentPlaceHolder1$txtbx"
    // Button triggers __doPostBack('ctl00$ContentPlaceHolder1$ctl00', '')
    // We'll set __EVENTTARGET to that and include the textbox.
    const form = new URLSearchParams();
    form.set("__EVENTTARGET", "ctl00$ContentPlaceHolder1$ctl00");
    form.set("__EVENTARGUMENT", "");
    form.set("__VIEWSTATE", viewstate);
    if (viewstateGen) form.set("__VIEWSTATEGENERATOR", viewstateGen);
    form.set("__EVENTVALIDATION", eventValidation);

    // tracking input
    form.set("ctl00$ContentPlaceHolder1$txtbx", trackingNo.trim().toUpperCase());

    const postRes = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
        "Origin": "https://mis.cept.gov.in",
        "Referer": URL,
        "Cookie": cookieHeader, // keep same session
      },
      body: form.toString(),
      redirect: "follow",
    });

    const html2 = await postRes.text();

    // If server error page returned
    const titleMatch = html2.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? "";
    if (/Server Error|Object reference/i.test(title) || /System\.NullReferenceException/i.test(html2)) {
      return NextResponse.json(
        {
          error: "IPS server returned an error page after POST.",
          trackingNo,
          title,
          snippet: debug ? html2.slice(0, 2000) : undefined,
        },
        { status: 500 }
      );
    }

    const articleValue = extractArticleValue(html2);

    if (!articleValue) {
      return NextResponse.json(
        {
          error: "Article Value not found in response HTML (layout changed or no data).",
          trackingNo,
          title,
          snippet: debug ? html2.slice(0, 2000) : undefined,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({ trackingNo, articleValue });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Failed", trackingNo },
      { status: 500 }
    );
  }
}