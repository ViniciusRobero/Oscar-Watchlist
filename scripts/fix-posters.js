/**
 * Re-download incorrect posters using Wikipedia page images.
 * Strategy: search Wikipedia for the film page, find the main infobox image.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const FILMS_PATH = path.join(__dirname, '..', 'data', 'editions', '2026', 'films.json');
const COVERS_DIR = path.join(__dirname, '..', 'client', 'public', 'assets', 'covers');

// Film ID → Wikipedia article title (exact)
const WIKI_TITLES = {
    'one-battle-after-another': 'One_Battle_After_Another',
    'frankenstein': 'Frankenstein_(2025_film)',
    'hamnet': 'Hamnet_(film)',
    'f1': 'F1_(film)',
    'the-secret-agent': 'The_Secret_Agent_(2025_film)',
    'train-dreams': 'Train_Dreams_(film)',
    'butcher-s-stain': null, // short film, unlikely on Wikipedia
    'children-no-more-were-and-are-gone': null,
    'butterfly': null, // animated short
    'elio': 'Elio_(film)',
    'jurassic-world-rebirth': 'Jurassic_World_Rebirth',
    'the-smashing-machine': 'The_Smashing_Machine_(2025_film)',
    'diane-warren-relentless': 'Diane_Warren:_Relentless',
    'mr-nobody-against-putin': null,
    'the-voice-of-hind-rajab': 'The_Voice_of_Hind_Rajab',
};

function httpGet(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const opts = { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'OscarWatchlistBot/1.0 (poster downloader)' } };
        https.get(opts, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return httpGet(res.headers.location).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
        }).on('error', reject);
    });
}

async function getWikipediaImage(wikiTitle) {
    // Use Wikipedia API to get page images
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=500`;
    try {
        const { body } = await httpGet(url);
        const data = JSON.parse(body.toString());
        const pages = data.query?.pages;
        if (!pages) return null;
        const page = Object.values(pages)[0];
        if (page && page.thumbnail && page.thumbnail.source) {
            // Get the original-resolution image (replace thumb path)
            let src = page.thumbnail.source;
            // If it's a thumb URL, try to get a larger version (w500)
            if (src.includes('/thumb/')) {
                // Get the 500px version
                const parts = src.split('/');
                parts[parts.length - 1] = '500px-' + parts[parts.length - 1].replace(/^\d+px-/, '');
                src = parts.join('/');
            }
            return src;
        }
    } catch (e) {
        console.error(`  Wikipedia API error for "${wikiTitle}":`, e.message);
    }
    return null;
}

async function downloadImage(url, filepath) {
    try {
        const { status, body } = await httpGet(url);
        if (status === 200 && body.length > 3000) {
            fs.writeFileSync(filepath, body);
            return true;
        }
        console.log(`  ⚠ HTTP ${status}, size ${body.length} bytes`);
    } catch (e) {
        console.error(`  Download error:`, e.message);
    }
    return false;
}

async function main() {
    const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf8'));
    let success = 0, failed = 0, skipped = 0;

    for (const [filmId, wikiTitle] of Object.entries(WIKI_TITLES)) {
        const film = films.find(f => f.id === filmId);
        if (!film) { console.log(`  ⚠ ${filmId} not found`); continue; }

        if (!wikiTitle) {
            console.log(`\n⏭  ${film.title} → No Wikipedia article, skipping`);
            skipped++;
            continue;
        }

        const dest = path.join(COVERS_DIR, `${filmId}.jpg`);
        console.log(`\n🔍 ${film.title} → Wikipedia: "${wikiTitle}"`);

        const imageUrl = await getWikipediaImage(wikiTitle);
        if (!imageUrl) {
            console.log(`  ❌ No image found`);
            failed++;
            continue;
        }

        console.log(`  📥 Downloading: ${imageUrl.substring(0, 80)}...`);
        const ok = await downloadImage(imageUrl, dest);
        if (ok) {
            film.poster = `/assets/covers/${filmId}.jpg`;
            const sizeKB = (fs.statSync(dest).size / 1024).toFixed(1);
            console.log(`  ✅ Saved! (${sizeKB} KB)`);
            success++;
        } else {
            console.log(`  ❌ Download failed`);
            failed++;
        }

        await new Promise(r => setTimeout(r, 500));
    }

    fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf8');
    console.log(`\n🏁 Done: ${success} downloaded, ${failed} failed, ${skipped} skipped`);
}

main().catch(console.error);
