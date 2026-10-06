# Outillage de reproduction (hors application)

Scripts utilisés pour produire les captures « avant », les maquettes « après » et les mesures de la revue du 3 octobre 2026. Ils ne sont importés par aucun module de l'application et n'appellent aucun backend.

| Script | Rôle |
| --- | --- |
| `mockapi.py` | API simulée (réponses typées comme `frontend/src/types/api.ts`, titres issus de `backend/data/casa_data.json`), journal des requêtes, erreurs forçables |
| `capture_before.py` | Sert la build `dist/` et l'API simulée par interception Playwright (aucun serveur), capture les scénarios, mesure les débordements et lance axe-core |
| `caption.py` | Ajoute la légende visible « capture réelle… » en tête des captures « avant » |
| `gen_common.py`, `gen_mockups.py` | Génèrent les maquettes HTML autonomes de `../visuels/apres/` |
| `capture_after.py` | Capture les maquettes (réseau bloqué) et mesure débordements et axe-core |
| `gen_index.py` | Génère la galerie `../visuels/index.html` |

## Rejouer dans un environnement isolé

À faire hors du checkout de travail, sur une copie au même SHA, sans `.env` :

```text
git archive <SHA> frontend | tar -x -C <copie>
cd <copie>/frontend && npm ci --ignore-scripts && VITE_API_URL=http://api.mock npm run build
cd <outils> && npm i @fontsource/ibm-plex-sans @fontsource/space-grotesk @fontsource/ibm-plex-mono axe-core
pip install playwright pillow    # Chromium fourni par l'environnement
CASA_RENDER_DIR=<copie> CASA_TOOLS_DIR=<outils> python capture_before.py <dossier de sortie>
python caption.py <dossier de sortie>
python gen_mockups.py <visuels>/apres
CASA_TOOLS_DIR=<outils> python capture_after.py <visuels>/apres <visuels>/apres
python gen_index.py <visuels>
```

Les scénarios incluent des clics sur « Analyser », « Valider et importer » et « Marquer comme terminée » : ils ne touchent que l'API simulée. Ne jamais pointer `VITE_API_URL` vers une API réelle avec ces scripts.
