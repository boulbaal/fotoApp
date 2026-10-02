#!/usr/bin/env python3
# Kleine hulpsite voor de oude Linux: commando's kopiëren + uitvoer terugplakken.
# Alleen standaardbibliotheek. Plakwerk wordt opgeslagen in ~/fotoapp-helper/inbox/.
import html, json, os, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
INBOX = os.path.join(BASE, 'inbox')
CMDS = os.path.join(BASE, 'commands.json')
os.makedirs(INBOX, exist_ok=True)

def load_cmds():
    try:
        with open(CMDS) as f: return json.load(f)
    except Exception: return []

PAGE = """<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>FotoApp hulp</title>
<style>body{font-family:sans-serif;max-width:900px;margin:20px auto;padding:0 12px;background:#111;color:#eee}
h1{font-size:22px}.c{background:#1d1d24;border:1px solid #333;border-radius:8px;padding:12px;margin:12px 0}
pre{background:#000;color:#7f7;padding:10px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-size:15px}
button{font-size:16px;padding:8px 14px;border-radius:6px;border:0;background:#4a7cff;color:#fff;cursor:pointer}
textarea{width:100%;height:220px;background:#000;color:#eee;font-family:monospace;font-size:14px;border-radius:6px}
.ok{color:#7f7}</style></head><body>
<h1>FotoApp op de oude Linux — stap voor stap</h1>
<p>Klik <b>Kopieer</b>, plak in de terminal (Ctrl+Shift+V), druk Enter. Plak daarna de uitvoer onderaan en klik <b>Verstuur</b>. Deze pagina ververst zichzelf als er nieuwe stappen zijn.</p>
%CMDS%
<div class="c"><h2>Uitvoer terugsturen</h2>%MSG%
<form method="post" action="/plak"><textarea name="tekst" placeholder="Plak hier wat de terminal toonde..."></textarea><br><br>
<button type="submit">Verstuur naar Claude</button></form></div>
<script>
function kopieer(id,b){const t=document.getElementById(id).innerText;
 const done=()=>{b.innerText='Gekopieerd ✓';setTimeout(()=>b.innerText='Kopieer',1500)};
 if(navigator.clipboard&&window.isSecureContext){navigator.clipboard.writeText(t).then(done)}
 else{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');a.remove();done()}}
let v=%VER%;setInterval(()=>fetch('/versie').then(r=>r.text()).then(x=>{if(+x!==v&&!document.querySelector('textarea').value)location.reload()}),5000);
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype='text/html; charset=utf-8'):
        b = body.encode(); self.send_response(code)
        self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(b)))
        self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(b)
    def page(self, msg=''):
        cmds = load_cmds(); parts = []
        for i, c in enumerate(cmds):
            parts.append(f'<div class="c"><h3>Stap {i+1}: {html.escape(c["titel"])}</h3>'
                         f'<pre id="c{i}">{html.escape(c["cmd"])}</pre>'
                         f'<button onclick="kopieer(\'c{i}\',this)">Kopieer</button></div>')
        if not parts: parts = ['<div class="c">Nog geen stappen — even wachten.</div>']
        ver = int(os.path.getmtime(CMDS)) if os.path.exists(CMDS) else 0
        return PAGE.replace('%CMDS%', ''.join(parts)).replace('%MSG%', msg).replace('%VER%', str(ver))
    def do_GET(self):
        if self.path.startswith('/files/'):
            name = os.path.basename(self.path[len('/files/'):])
            fp = os.path.join(BASE, 'files', name)
            if not name or not os.path.isfile(fp):
                return self._send(404, 'niet gevonden', 'text/plain')
            with open(fp, 'rb') as f: data = f.read()
            self.send_response(200); self.send_header('Content-Type', 'application/octet-stream')
            self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data); return
        if self.path == '/versie':
            return self._send(200, str(int(os.path.getmtime(CMDS)) if os.path.exists(CMDS) else 0), 'text/plain')
        self._send(200, self.page())
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0) or 0)
        if n > 5_000_000: return self._send(413, 'te groot')
        tekst = parse_qs(self.rfile.read(n).decode('utf-8', 'replace')).get('tekst', [''])[0]
        if tekst.strip():
            fn = os.path.join(INBOX, time.strftime('%Y%m%d-%H%M%S') + '.txt')
            with open(fn, 'w') as f: f.write(f'# van {self.client_address[0]}\n{tekst}\n')
            msg = '<p class="ok">Ontvangen ✓ — Claude kan het nu lezen.</p>'
        else: msg = '<p>Er was niets geplakt.</p>'
        self._send(200, self.page(msg))
    def log_message(self, *a): pass

ThreadingHTTPServer(('0.0.0.0', int(os.environ.get('PORT', '8790'))), H).serve_forever()
