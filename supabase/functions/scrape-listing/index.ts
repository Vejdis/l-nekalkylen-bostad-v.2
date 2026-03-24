const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

    // Validate URL is from Hemnet or Booli
    const parsedUrl = new URL(url);
    const validDomains = ['hemnet.se', 'www.hemnet.se', 'booli.se', 'www.booli.se'];
    if (!validDomains.includes(parsedUrl.hostname)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Endast Hemnet och Booli-länkar stöds' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching listing from:', url);

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
    let price: number | null = null;
    let fee: number | null = null;

    if (parsedUrl.hostname.includes('hemnet.se')) {
      // Hemnet: extract from JSON-LD or meta tags
      const priceMatch = html.match(/"selling_price":\s*(\d+)/) ||
                         html.match(/property-info__price[^>]*>[\s\S]*?([\d\s]+)\s*kr/i) ||
                         html.match(/"price":\s*(\d+)/);
      if (priceMatch) {
        price = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
      }
      
      // Try utgångspris/begärt pris patterns
      if (!price) {
        const askingMatch = html.match(/Utgångspris[^<]*<[^>]*>[\s\S]*?([\d\s]+)\s*kr/i) ||
                           html.match(/Begärt pris[^<]*<[^>]*>[\s\S]*?([\d\s]+)\s*kr/i) ||
                           html.match(/([\d\s]{5,})\s*kr/);
        if (askingMatch) {
          price = parseInt(askingMatch[1].replace(/\s/g, ''), 10);
        }
      }

      const feeMatch = html.match(/Avgift\/månad[^<]*<[^>]*>[\s\S]*?([\d\s]+)\s*kr/i) ||
                       html.match(/"fee":\s*"?([\d\s]+)"?/) ||
                       html.match(/avgift[^<]*<[^>]*>[^<]*([\d\s]+)\s*kr\/mån/i);
      if (feeMatch) {
        fee = parseInt(feeMatch[1].replace(/\s/g, ''), 10);
      }
    } else if (parsedUrl.hostname.includes('booli.se')) {
      // Booli: extract price and fee
      const priceMatch = html.match(/"listPrice":\s*(\d+)/) ||
                         html.match(/Pris[^<]*<[^>]*>[\s\S]*?([\d\s]+)\s*kr/i) ||
                         html.match(/([\d\s]{5,})\s*kr/);
      if (priceMatch) {
        price = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
      }

      const feeMatch = html.match(/Avgift[^<]*<[^>]*>[\s\S]*?([\d\s]+)\s*kr/i) ||
                       html.match(/"monthlyFee":\s*"?([\d\s]+)"?/);
      if (feeMatch) {
        fee = parseInt(feeMatch[1].replace(/\s/g, ''), 10);
      }
    }

    console.log('Extracted - Price:', price, 'Fee:', fee);

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          price,
          fee,
          source: parsedUrl.hostname.includes('hemnet') ? 'hemnet' : 'booli',
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
