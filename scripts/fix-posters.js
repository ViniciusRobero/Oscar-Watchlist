const fs = require('fs');
const path = require('path');
const https = require('https');

const FILMS_PATH = path.join(__dirname, '..', 'data', 'editions', '2026', 'films.json');
const COVERS_DIR = path.join(__dirname, '..', 'client', 'public', 'assets', 'covers');

// URLs extracted from browser DOM/network requests on IMDb pages
const POSTER_URLS = {
    'hamnet': 'https://m.media-amazon.com/images/M/MV5BMDQ5ZmY0OWYtOTYzZi00Mzg5LWE3N2EtMjYwZTAzZmJhYjkyXkEyXkFqcGc@._V1_FMjpg_UX1080_.jpg',
    'f1': 'https://m.media-amazon.com/images/M/MV5BNGI0MDI4NjEtOWU3ZS00ODQyLWFhYTgtNGYxM2ZkM2Q2YjE3XkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
    'all-the-empty-rooms': 'https://m.media-amazon.com/images/M/MV5BNjg5ZTJjOGEtMThkMy00MTY0LTk2YjctMWY5ZmU5YTZjZjI0XkEyXkFqcGc@._V1_QL75_UY562_CR91,0,380,562_.jpg',
    'arco': 'https://m.media-amazon.com/images/M/MV5BNjNmYmEzZDAtMjcxYS00NmRjLWI5ZGEtY2NiMmQ2MTE3MTM0XkEyXkFqcGc@._V1_FMjpg_UY2048_.jpg',
    'butcher-s-stain': 'https://m.media-amazon.com/images/M/MV5BYTQ2NDM4MzYtYjM5ZS00YTcyLWI2ZjktN2U4YjdmMzAxZDEzXkEyXkFqcGc@._V1_QL75_UY562_CR35,0,380,562_.jpg',
    'butterfly': 'https://m.media-amazon.com/images/M/MV5BYTAyZDNkNDEtZTE4YS00YTM5LWI5YmUtYzNiNTQwZDEwMzY4XkEyXkFqcGc@._V1_QL75_UX380_CR0,4,380,562_.jpg',
    'children-no-more-were-and-are-gone': 'https://m.media-amazon.com/images/M/MV5BOGMwMDJlMzAtNThhMS00MTY0LTk2YjctMWY5ZmU5YTZjZjI0XkEyXkFqcGc@._V1_QL75_UY562_CR8,0,380,562_.jpg',
    'cutting-through-rocks': 'https://m.media-amazon.com/images/M/MV5BYmZkZmU2OTctM2U4Ny00NmMyLWFmZTktMjk4MDJkY2QyZDdiXkEyXkFqcGc@._V1_QL75_UY562_CR7,0,380,562_.jpg',
    'retirement-plan': 'https://m.media-amazon.com/images/M/MV5BZjkyYjUxYWEtZDU0NC00NmRkLThjOTYtZDgyZTlhMDI1OTQ4XkEyXkFqcGc@._V1_QL75_UY562_CR9,0,380,562_.jpg',
    'diane-warren-relentless': 'https://m.media-amazon.com/images/M/MV5BMTQ3YzZhMjctYTM3MC00YjZhLWE1ZjQtOGRlNjM2OTRmZGE3XkEyXkFqcGc@._V1_QL75_UY562_CR0,0,380,562_.jpg',
    'forevergreen': 'https://m.media-amazon.com/images/M/MV5BYzcxOGVhMzEtYWJkMi00MGY4LWFmYmMtZThhN2E1NzQ0Y2M4XkEyXkFqcGc@._V1_QL75_UY562_CR16,0,380,562_.jpg',
    'mr-nobody-against-putin': 'https://m.media-amazon.com/images/M/MV5BYWVjNGQ5NjYtZDk2My00NzgxLWE1NDMtOGEzYTQzMjAxODIxXkEyXkFqcGc@._V1_QL75_UY562_CR8,0,380,562_.jpg',
    'the-smashing-machine': 'https://m.media-amazon.com/images/M/MV5BMWZkMDAyOTItOWM5My00ODc4LTlkOGUtYWFiN2E3NDEwZWY3XkEyXkFqcGc@._V1_QL75_UY562_CR28,0,380,562_.jpg',
    'the-three-sisters': 'https://m.media-amazon.com/images/M/MV5BMzM3MjZlYjUtMTU3Ni00MWVjLWEzNjItODNiNDQ2NzFjYTdkXkEyXkFqcGc@._V1_QL75_UY562_CR9,0,380,562_.jpg',
    'the-voice-of-hind-rajab': 'https://m.media-amazon.com/images/M/MV5BZWVlM2RjYTctODU4Mi00NTQzLWEzMDktZGVmYTQ2NTEwOWFiXkEyXkFqcGc@._V1_QL75_UX380_CR0,0,380,562_.jpg',
};

function download(url) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        https.get({
            hostname: u.hostname,
            path: u.pathname + (u.search || ''),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.imdb.com/',
                'sec-ch-ua': '"Chromium";v="131", "Not_A Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'image',
                'sec-fetch-mode': 'no-cors',
                'sec-fetch-site': 'cross-site'
            }
        }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return download(res.headers.location).then(resolve).catch(reject);
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
        }).on('error', reject);
    });
}

async function main() {
    const films = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf8'));
    let ok = 0, fail = 0;

    for (const [filmId, url] of Object.entries(POSTER_URLS)) {
        const film = films.find(f => f.id === filmId);
        if (!film) { console.log(`⚠ ${filmId} not found`); continue; }
        const dest = path.join(COVERS_DIR, `${filmId}.jpg`);

        // Skip if already exists and is large enough
        if (fs.existsSync(dest) && fs.statSync(dest).size > 5000) {
            film.poster = `/assets/covers/${filmId}.jpg`;
            ok++;
            continue;
        }

        process.stdout.write(`📥 ${film.title}... `);
        try {
            const { status, body } = await download(url);
            if (status === 200 && body.length > 3000) {
                fs.writeFileSync(dest, body);
                film.poster = `/assets/covers/${filmId}.jpg`;
                console.log(`✅ ${(body.length / 1024).toFixed(0)} KB`);
                ok++;
            } else {
                console.log(`❌ HTTP ${status}, ${body.length} bytes`);
                fail++;
            }
        } catch (e) {
            console.log(`❌ ${e.message}`);
            fail++;
        }

        await new Promise(r => setTimeout(r, 200));
    }

    fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2), 'utf8');
    console.log(`\n🏁 ${ok} ok, ${fail} failed`);
    const still = films.filter(f => f.poster.endsWith('.svg'));
    if (still.length > 0) {
        console.log(`Still SVG (${still.length}): ${still.map(f => f.id).join(', ')}`);
    } else {
        console.log('🎉 ALL 50 films have poster images!');
    }
}

main();
