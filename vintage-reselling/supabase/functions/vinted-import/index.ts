import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://kartoffelneutrum.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const clean = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const result = value.replace(/\s+/g, " ").trim();
  return result ? result : null;
};

function walk(value: unknown, visit: (item: Record<string, unknown>) => void) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
  } else if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    visit(item);
    for (const child of Object.values(item)) walk(child, visit);
  }
}

function parseJsonLd(raw: unknown): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const values = Array.isArray(raw) ? raw : [raw];
  for (const value of values) {
    if (typeof value !== "string") continue;
    try {
      const parsed = JSON.parse(value);
      walk(parsed, (item) => found.push(item));
    } catch {
      // Ignore non-JSON-LD script contents.
    }
  }
  return found;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const result = clean(value);
    if (result) return result;
  }
  return null;
}

function nestedName(value: unknown): string | null {
  if (typeof value === "string") return clean(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return firstString(obj.name, obj.title);
  }
  return null;
}

function findProperty(nodes: Record<string, unknown>[], keys: string[]): unknown {
  for (const node of nodes) {
    for (const key of keys) {
      if (node[key] !== undefined && node[key] !== null) return node[key];
    }
  }
  return null;
}

function parsePrice(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (typeof value === "string") {
      const match = value.replace(/\s/g, "").match(/\d+(?:[.,]\d{1,2})?/);
      if (match) {
        const parsed = Number(match[0].replace(",", "."));
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    }
  }
  return null;
}

function imagesFrom(value: unknown): string[] {
  const candidates = Array.isArray(value) ? value : [value];
  return [...new Set(candidates.flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (entry && typeof entry === "object") {
      const obj = entry as Record<string, unknown>;
      return [obj.url, obj.contentUrl].filter((v): v is string => typeof v === "string");
    }
    return [];
  }).filter((url) => /^https:\/\//i.test(url) && /vinted|images/i.test(url)))].slice(0, 12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const ujeebuKey = Deno.env.get("UJEEBU_API_KEY");
    if (!supabaseUrl || !anonKey) return json({ error: "Supabase function is not configured." }, 500);
    if (!ujeebuKey) return json({ error: "UJEEBU_API_KEY fehlt. Bitte als Supabase Function Secret hinterlegen." }, 503);

    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ error: "Anmeldung erforderlich." }, 401);
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sitzung ungültig. Bitte erneut anmelden." }, 401);

    const body = await req.json();
    const target = new URL(String(body?.url || ""));
    if (
      target.protocol !== "https:" ||
      !["vinted.de", "www.vinted.de"].includes(target.hostname) ||
      !/^\/items\/\d+/.test(target.pathname)
    ) return json({ error: "Nur öffentliche Vinted-Angebotslinks von vinted.de sind erlaubt." }, 400);

    const extract_rules = {
      title: { selector: 'meta[property="og:title"]', type: "attr", attribute: "content" },
      description: { selector: 'meta[property="og:description"]', type: "attr", attribute: "content" },
      image: { selector: 'meta[property="og:image"]', type: "attr", attribute: "content" },
      price: { selector: 'meta[property="product:price:amount"]', type: "attr", attribute: "content" },
      currency: { selector: 'meta[property="product:price:currency"]', type: "attr", attribute: "content" },
      brand: { selector: 'meta[property="product:brand"]', type: "attr", attribute: "content" },
      heading: { selector: "h1", type: "text" },
      jsonld: { selector: 'script[type="application/ld+json"]', type: "text", multiple: true },
      bodyText: { selector: "body", type: "text" },
      images: { selector: "img", type: "image", multiple: true },
    };

    const upstream = await fetch("https://api.ujeebu.com/scrape", {
      method: "POST",
      headers: { "ApiKey": ujeebuKey, "Content-Type": "application/json" },
      body: JSON.stringify({ url: target.href, js: true, timeout: 60, extract_rules }),
      signal: AbortSignal.timeout(65000),
    });
    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok || payload?.success === false) {
      return json({ error: payload?.message || payload?.error || `Abrufdienst meldet HTTP ${upstream.status}.` }, 502);
    }

    const extracted = payload?.result || {};
    const nodes = parseJsonLd(extracted.jsonld);
    const productNodes = nodes.filter((node) => {
      const type = node["@type"];
      return (Array.isArray(type) ? type : [type]).some((t) => String(t).toLowerCase() === "product");
    });
    const structured = productNodes.length ? productNodes : nodes;
    const offer = findProperty(structured, ["offers"]);
    const offerPrice = Array.isArray(offer)
      ? (offer[0] as Record<string, unknown> | undefined)?.price
      : offer && typeof offer === "object" ? (offer as Record<string, unknown>).price : null;
    const rawName = firstString(findProperty(structured, ["name"]), extracted.heading, extracted.title);
    const name = rawName?.replace(/\s*[|–-]\s*Vinted.*$/i, "").trim() || null;
    const rawBrand = findProperty(structured, ["brand"]) ?? extracted.brand;
    const brand = nestedName(rawBrand);
    const category = firstString(findProperty(structured, ["category"]));
    const description = firstString(findProperty(structured, ["description"]), extracted.description);
    const price = parsePrice(findProperty(structured, ["price"]), offerPrice, extracted.price);
    const imageValues = [
      findProperty(structured, ["image"]),
      extracted.image,
      ...(Array.isArray(extracted.images) ? extracted.images : []),
    ];
    const images = imagesFrom(imageValues);
    const bodyText = clean(extracted.bodyText) || "";
    const sizeFromStructured = firstString(findProperty(structured, ["size"]), findProperty(structured, ["size_name"]));
    const sizeMatch = bodyText.match(/(?:Kindergröße|Größe|Size)\s*[:：-]?\s*([A-Za-z0-9][A-Za-z0-9./ -]{0,12})/i);
    const size = sizeFromStructured || (sizeMatch ? sizeMatch[1].trim().replace(/[.,;:]$/, "") : null);

    const fields = {
      name,
      brand,
      category,
      size,
      price,
      description,
      image_url: images[0] || firstString(extracted.image),
      image_urls: images,
      currency: firstString(findProperty(structured, ["priceCurrency"]), extracted.currency) || "EUR",
      vinted_url: target.href,
    };
    const missing = Object.entries(fields)
      .filter(([key, value]) => !["image_urls", "currency", "vinted_url"].includes(key) && (value === null || value === ""))
      .map(([key]) => key);

    if (!fields.name && !fields.image_url && !fields.price) {
      return json({ error: "Die öffentliche Seite wurde erreicht, aber Vinted hat keine verwertbaren Artikeldaten geliefert. Bitte später erneut versuchen oder die Angaben manuell eintragen." }, 422);
    }

    return json({ fields, missing, source: "public-vinted-page" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return json({ error: message }, 500);
  }
});
