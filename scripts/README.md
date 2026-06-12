# FotoApp Scripts — Samenwerking met Claude

## Hoe het werkt

```
Claude schrijft script → jij runt het → output gaat naar output/ → Claude leest en schrijft volgend script
```

## Stap 1: Watcher starten (één keer)

Open een terminal in deze map en start:

```bash
bash scripts/watcher.sh
```

Laat die terminal openstaan. De watcher pikt automatisch nieuwe scripts op die Claude schrijft in `scripts/queue/`.

## Stap 2: Scripts handmatig uitvoeren (alternatief)

Als je de watcher niet wil gebruiken, kun je ook handmatig runnen:

```bash
bash scripts/01_github_stats.sh
bash scripts/02_devto_setup.sh
bash scripts/03_devto_post.sh
bash scripts/04_reddit_setup.sh
```

Output staat altijd in `scripts/output/`.

## Hoe Claude meekijkt

Claude leest de bestanden in `scripts/output/` en schrijft dan het volgende script in `scripts/queue/`. De watcher voert dat automatisch uit.

## Bestanden

| Bestand | Wat het doet |
|---|---|
| `watcher.sh` | Bewaakt queue/, voert scripts uit, logt output |
| `01_github_stats.sh` | GitHub download statistieken ophalen |
| `02_devto_setup.sh` | dev.to API key testen |
| `03_devto_post.sh` | Artikel posten op dev.to |
| `04_reddit_setup.sh` | Reddit API setup + post in r/selfhosted |
| `output/*.log` | Resultaten van elk script |
| `queue/` | Hier schrijft Claude nieuwe scripts naar toe |
