#!/usr/bin/env node
// Genereer video thumbnails voor alle videos zonder thumbnail
// Gebruik: node generate-video-thumbs.js

const { getDb } = require('./src/database');
const { spawnSync } = require('child_process');
const sharp = require('sharp');
const fs = require('fs');

// Controleer ffmpeg
const ffmpegCheck = spawnSync('which', ['ffmpeg'], { encoding: 'utf8' });
if (ffmpegCheck.status !== 0) {
  console.error('❌ ffmpeg niet gevonden. Installeer eerst: sudo apt install ffmpeg');
  process.exit(1);
}
console.log('✅ ffmpeg gevonden');

async function maakVideoThumbnail(bestandsPad) {
  try {
    const tmpPad = `/tmp/fotoapp_thumb_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
    const result = spawnSync('ffmpeg', [
      '-ss', '00:00:01', '-i', bestandsPad,
      '-vframes', '1', '-q:v', '5', '-y', tmpPad
    ], { timeout: 20000, stdio: 'pipe' });

    if (result.status === 0 && fs.existsSync(tmpPad)) {
      const buffer = await sharp(tmpPad)
        .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();
      fs.unlinkSync(tmpPad);
      return 'data:image/jpeg;base64,' + buffer.toString('base64');
    }
    if (fs.existsSync(tmpPad)) fs.unlinkSync(tmpPad);
  } catch (_) {}
  return null;
}

async function run() {
  const db = getDb();
  const videos = db.prepare(
    "SELECT id, volledig_pad, bestandsnaam FROM fotos WHERE is_video = 1 AND thumbnail IS NULL"
  ).all();
  db.close();

  console.log(`🎬 ${videos.length} videos zonder thumbnail gevonden`);
  if (videos.length === 0) {
    console.log('✅ Niets te doen.');
    return;
  }

  let geslaagd = 0, mislukt = 0;
  const update = getDb().prepare('UPDATE fotos SET thumbnail = ? WHERE id = ?');

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    process.stdout.write(`\r📷 ${i + 1}/${videos.length} — ${v.bestandsnaam.slice(0, 50).padEnd(50)}`);

    if (!fs.existsSync(v.volledig_pad)) { mislukt++; continue; }

    const thumb = await maakVideoThumbnail(v.volledig_pad);
    if (thumb) {
      update.run(thumb, v.id);
      geslaagd++;
    } else {
      mislukt++;
    }
  }

  update.database.close();
  console.log(`\n\n✅ Klaar: ${geslaagd} thumbnails aangemaakt, ${mislukt} mislukt`);
  console.log('Herlaad de Video\'s pagina in de app om de thumbnails te zien.');
}

run().catch(e => { console.error('❌ Fout:', e.message); process.exit(1); });
