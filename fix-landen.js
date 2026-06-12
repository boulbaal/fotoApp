#!/usr/bin/env node
/**
 * fix-landen.js
 * Haalt alle unieke GPS-coördinaten op uit de database en
 * updatet gps_land (en gps_stad, gps_adres) naar Engelse namen.
 *
 * Gebruik: node fix-landen.js
 */

const https = require('https');
const { getDb } = require('./src/database');

function wacht(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function haalEngelsAdresOp(lat, lon) {
  return new Promise((resolve) => {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'FotoApp/1.0', 'Accept-Language': 'en' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const addr = json.address || {};
          const landCode = (addr.country_code || '').toUpperCase();
          resolve({
            gps_adres: json.display_name || null,
            gps_stad: addr.city || addr.town || addr.village || addr.municipality || null,
            gps_land: addr.country || null,
            gps_land_code: landCode || null
          });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(5000, () => { req.destroy(); resolve(null); });
  });
}

async function main() {
  const db = getDb();

  // Alleen coördinaten waar het land niet-ASCII tekens bevat (= niet Engels)
  const punten = db.prepare(`
    SELECT ROUND(gps_lat, 3) as lat, ROUND(gps_lon, 3) as lon, COUNT(*) as n,
           MAX(gps_land) as huidig_land
    FROM fotos
    WHERE gps_lat IS NOT NULL AND gps_lon IS NOT NULL
      AND (
        gps_land IS NULL
        OR gps_land GLOB '*[^ -~]*'
        OR gps_stad GLOB '*[^ -~]*'
      )
    GROUP BY ROUND(gps_lat, 3), ROUND(gps_lon, 3)
    ORDER BY n DESC
  `).all();

  console.log(`🌍 ${punten.length} unieke locaties te updaten...`);

  const updateStmt = db.prepare(`
    UPDATE fotos
    SET gps_land = ?, gps_stad = ?, gps_adres = ?, gps_land_code = ?
    WHERE ROUND(gps_lat, 3) = ? AND ROUND(gps_lon, 3) = ?
  `);

  let gedaan = 0;
  let gewijzigd = 0;

  for (const punt of punten) {
    gedaan++;
    const adres = await haalEngelsAdresOp(punt.lat, punt.lon);

    if (adres && adres.gps_land) {
      const info = updateStmt.run(adres.gps_land, adres.gps_stad, adres.gps_adres, adres.gps_land_code, punt.lat, punt.lon);
      gewijzigd += info.changes;
      process.stdout.write(`\r✅ ${gedaan}/${punten.length} — ${adres.gps_land}${' '.repeat(20)}`);
    } else {
      process.stdout.write(`\r⚠️  ${gedaan}/${punten.length} — geen resultaat${' '.repeat(20)}`);
    }

    // Max 1 request per seconde (Nominatim policy)
    await wacht(1100);
  }

  db.close();
  console.log(`\n\n✅ Klaar! ${gewijzigd} records bijgewerkt naar Engelse landnamen.`);
}

main().catch(console.error);
