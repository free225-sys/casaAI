# Aurore — D10 appliquée aux schémas de leçon (MSG-20261003-011)

Branche `claude/integrate-aurore`, lot posé sur `71d00be19ec62039f9b2ebb899c68f229a8d765f`. Décision : l'utilisateur a confirmé (`2026-10-03` 20:50 UTC, relayée par `MSG-20261003-011`) l'option B, D10 s'applique aussi aux nœuds des schémas : bordures neutres, aucune exception.

## Changements

| Fichier | Changement |
| --- | --- |
| `frontend/src/components/MiniDiagram.tsx` | **Flux** : contour neutre (`--color-border-strong`), texte `--color-text`, étapes **numérotées** (« 1. », « 2. »…) pour que l'ordre ne dépende ni de la couleur ni des seules flèches ; passage à la ligne autorisé (plus de `nowrap`). **Hiérarchie** : le SVG, dont les libellés débordaient des cadres et se chevauchaient une fois le contour neutre, est remplacé par des boîtes imbriquées en HTML (contour neutre, fond alterné, texte à la ligne) ; l'inclusion se lit par l'imbrication, par le texte et par l'`aria-label` « A contient B contient C » (conservé). **Matrice** : texte des quadrants en `--color-text` au lieu du teal/or ; fonds doux conservés, quadrants nommés dans le texte, axes titrés. Aucune donnée, aucun type, aucun appel API modifié |
| `frontend/tests/learning-ux.test.tsx` | 2 tests ajoutés : aucune couleur d'accent (bordure, contour, texte) dans les trois types de schéma ; libellés et ordre lisibles sans couleur (étapes numérotées, `aria-label` de la hiérarchie, quadrants et axes). Les deux échouent sur l'ancien composant (vérifié) et réussissent sur le nouveau. Aucun test existant modifié |

## Vérifications exécutées

| Contrôle | Résultat | Limite |
| --- | --- | --- |
| `npx tsc -b` | Aucune erreur | — |
| `npm run lint` | 0 erreur, 1 avertissement existant (`authStore.tsx:97`) | — |
| `npm run test` | **38/38** réussis (36 + 2 ajoutés) | happy-dom, composant rendu seul |
| `npm run build` | Réussi, avertissement de chunk existant | — |
| **API simulée** : leçon synthétique contenant un schéma de chaque type, Chromium sur la build en prévisualisation Vite, 1440/390/320/720 px, `_mesures.json` | `scrollWidth` = `clientWidth` ; 0 violation axe-core WCAG 2.0/2.1 A/AA (contraste du texte compris) ; 0 erreur JS ; 0 bordure ou contour d'accent mesuré sur les schémas ; captures relues à 390 et 320 px : libellés entiers et non chevauchants | Données synthétiques ; ni FastAPI, ni PostgreSQL, ni QA 5184/8014 ; schémas fournis par un faux `/api/lessons/a` |

Un premier rendu avec contour neutre mais géométrie SVG inchangée montrait des libellés de hiérarchie qui se chevauchaient ; il a conduit au remplacement par des boîtes HTML imbriquées. Les captures publiées sont celles du second rendu.

Les fonds doux teal/or de la matrice sont conservés (fond, pas bordure) : D10 vise les bordures et liserés. À signaler si vous voulez aussi les neutraliser.

## Non vérifié

Données de leçons réelles (aucun schéma réel n'a été chargé), recette réelle, lecteur d'écran sur les schémas, zoom navigateur réel, CI GitHub. Ces captures ne sont **pas** une recette réelle.
