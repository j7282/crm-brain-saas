const axios = require('axios');
const cheerio = require('cheerio');

async function scrapeUrl(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);

        // Remover scripts, estilos y otros elementos no deseados
        $('script, style, nav, footer, header, iframe, noscript').remove();

        // Extraer texto limpio
        let text = $('body').text();
        
        // Limpiar espacios en blanco excesivos
        text = text.replace(/\s+/g, ' ').trim();

        // Limitar tamaño para evitar saturar el contexto si es muy grande
        const maxLength = 10000;
        if (text.length > maxLength) {
            text = text.substring(0, maxLength) + '... [Trunkated]';
        }

        return text;
    } catch (error) {
        console.error(`[Scraper] Error scraping ${url}:`, error.message);
        throw new Error('No se pudo leer el contenido de la URL.');
    }
}

module.exports = { scrapeUrl };
