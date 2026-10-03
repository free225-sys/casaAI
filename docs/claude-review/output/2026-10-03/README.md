# Revue fonctionnelle et design — 3 octobre 2026

Cible : `free225-sys/casaAI`, branche `codex/validate-learning-ux`, HEAD `65bcde7` (code applicatif identique à `d2e9d9a`). Rien n'est implémenté : ces fichiers attendent la validation de l'utilisateur, puis la reprise par le dev lead.

| Fichier | Contenu |
| --- | --- |
| [RAPPORT.md](RAPPORT.md) | Rapport complet selon `REPORT_TEMPLATE.md` : cible, constats F-01 à F-22, audit, direction « Aurore lisible », recommandations, décisions D-01 à D-10 (D-10 approuvée), plan dev lead |
| [REGISTRE_PREUVES.md](REGISTRE_PREUVES.md) | Environnement d'observation, preuves P-01 à P-19, limites et expurgation |
| [visuels/index.html](visuels/index.html) | Galerie légendée avant/après, desktop 1440 et mobile 390 (contrôle 320), états d'erreur/vide/confirmation |
| `visuels/avant/` | Captures réelles du code au SHA (rendu isolé, API simulée, données synthétiques) + `_mesures-avant.json` |
| `visuels/apres/` | Maquettes HTML autonomes (non implémentées) + captures + `_mesures-apres.json` |
| [visuels/assets/proposed.css](visuels/assets/proposed.css) | Tokens et composants proposés (démonstration, non importé par l'application) |
| `visuels/assets/fonts/` | Polices de l'application en local (licence SIL OFL 1.1) pour que les maquettes ne chargent aucun service externe |
| [outillage/](outillage/README.md) | Scripts de reproduction (API simulée, captures, mesures) |

Ouvrir `visuels/index.html` directement dans un navigateur : aucune connexion n'est nécessaire.

Décisions attendues : voir [RAPPORT.md §8](RAPPORT.md#8-décisions-requises-de-lutilisateur).
