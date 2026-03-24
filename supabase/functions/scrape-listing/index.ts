// v2 - Fixed fee extraction with non-breaking space handling
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function extractHemnetData(html: string): { price: number | null; fee: number | null } {
  let price: number | null = null;
  let fee: number | null = null;

  // Price: from JSON-LD schema.org data
  const priceMatch = html.match(/"price"\s*:\s*(\d+)/);
  if (priceMatch) {
    price = parseInt(priceMatch[1], 10);
  }

  // Fee: from Apollo state JSON - "fee":{"__typename":"Money","amount":2778}
  const feeAmountMatch = html.match(/"fee"\s*:\s*\{[^}]*?"amount"\s*:\s*(\d+)/);
  if (feeAmountMatch) {
    fee = parseInt(feeAmountMatch[1], 10);
    console.log('Fee found via Apollo amount:', fee);
  }

  // Fallback: HTML pattern with non-breaking spaces
  if (fee === null) {
    const feeHtmlMatch = html.match(/Avgift<\/div>[^>]*>[^>]*>([^<]+)kr/i);
    if (feeHtmlMatch) {
      const cleaned = feeHtmlMatch[1].replace(/[^\d]/g, '');
      if (cleaned) {
        fee = parseInt(cleaned, 10);
        console.log('Fee found via HTML pattern:', fee);
      }
    }
  }

  return { price, fee };
}

function extractBooliData(html: string): { price: number | null; fee: number | null } {
  let price: number | null = null;
  let fee: number | null = null;

  const priceMatch = html.match(/"listPrice"\s*:\s*(\d+)/) ||
                     html.match(/"price"\s*:\s*(\d+)/);
  if (priceMatch) {
    price = parseInt(priceMatch[1], 10);
  }

  const feeMatch = html.match(/"monthlyFee"\s*:\s*(\d+)/) ||
                   html.match(/"fee"\s*:\s*\{[^}]*?"amount"\s*:\s*(\d+)/);
  if (feeMatch) {
    fee = parseInt((feeMatch[2] || feeMatch[1]).replace(/\D/g, ''), 10);
  }

  return { price, fee };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL krävs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedUrl = new URL(url);
    const validDomains = ['hemnet.se', 'www.hemnet.se', 'booli.se', 'www.booli.se'];
    if (!validDomains.includes(parsedUrl.hostname)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Endast Hemnet och Booli-länkar stöds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('v2 - Fetching listing from:', url);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Kunde inte hämta sidan (${response.status})` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    const isHemnet = parsedUrl.hostname.includes('hemnet');
    const result = isHemnet ? extractHemnetData(html) : extractBooliData(html);

    console.log('v2 Extracted - Price:', result.price, 'Fee:', result.fee);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          price: result.price,
          fee: result.fee,
          source: isHemnet ? 'hemnet' : 'booli',
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error scraping listing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
