# Aurore — R3 : bordures colorées restantes (résultat de quiz, éligibilité de certification)

Branche `claude/integrate-aurore`, lot posé sur `6aaa0a6b0e6a11af3d868ac2125e1d31b65650ab`. Répond à la réserve R3 de `MSG-20261003-008` : deux bordures colorées préexistantes que l'audit D10 précédent n'avait pas couvertes.

## Changements

| Fichier | Changement |
| --- | --- |
| `frontend/src/pages/QuizTakePage.tsx` | Suppression de `borderColor` (teal si réussite, coral sinon) sur la carte de résultat. L'état reste porté par le badge texte « ✓ Réussi » / « Non atteint », le score et les réponses détaillées, inchangés |
| `frontend/src/pages/CertificationDetailPage.tsx` | Suppression de `borderColor` (teal si éligible) sur la carte d'éligibilité. L'état reste porté par le badge texte « Conditions remplies » / « Conditions non encore remplies » |

Aucune donnée, aucun handler, aucun libellé, aucun appel API modifié. Aucun test modifié.

## Audit D10 élargi

Recherche de toute occurrence de `border*` associée à une couleur d'accent, d'état ou à une interpolation dans `frontend/src` (TSX, TS, CSS). Restent, volontairement : focus de champ (`index.css:341`), pastille de quiz répondue/courante (`:903`, `:907`), onglet de profondeur actif, onglet d'administration actif, étape courante du stepper, étape courante de `ProgressRail` : ce sont des indicateurs actifs autorisés par D10.

**Point à arbitrer, non modifié** : `components/MiniDiagram.tsx:88` donne aux nœuds d'un schéma de leçon une bordure `1px` de la couleur d'accent du nœud. C'est une illustration de contenu, pas une carte, un encadré, un message ou un badge ; je ne l'ai pas changée sans décision explicite.

## Vérifications exécutées

| Contrôle | Résultat | Limite |
| --- | --- | --- |
| `npx tsc -b` | Aucune erreur | — |
| `npm run lint` | 0 erreur, 1 avertissement existant (`authStore.tsx:97`) | — |
| `npm run test` | 36/36 réussis | happy-dom, services simulés |
| `npm run build` | Réussi | avertissement de chunk existant |
| **API simulée** : Chromium sur la build en prévisualisation Vite, 4 états (quiz réussi, quiz échoué, certification éligible, non éligible) × 1440/390/320, `_mesures.json` | Bordure calculée de la carte `rgb(225, 231, 239)` (token neutre `--color-border`) dans les 12 cas, épaisseur 1 px ; `scrollWidth` = `clientWidth` ; 0 violation axe-core WCAG 2.0/2.1 A/AA ; 0 erreur JS | Données synthétiques ; ni FastAPI, ni PostgreSQL, ni QA 5184/8014 ; résultat de quiz obtenu par réponse simulée du faux `/api/quizzes/q1/attempt` |

Ces captures ne sont pas une recette réelle.
