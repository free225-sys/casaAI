# Aurore — reprise du WIP (lecture, dashboard, navigation, catalogue) et réserves R1/R2 (Claude)

Branche `claude/integrate-aurore`. Le snapshot `ce97d2d8a4a5a44e5628ae01ddd130bc38c11c90` (`codex/aurore-wip-handoff`, base `f2674dd`, huit fichiers) est repris tel quel dans le commit `e83adae` (cherry-pick, auteur d'origine conservé) ; les corrections de Claude sont dans un commit distinct par-dessus. Aucun fichier backend, service, type API, routeur ni manifeste modifié.

## Corrections de Claude (par-dessus le snapshot)

| Fichier | Changement |
| --- | --- |
| `frontend/src/pages/CatalogPage.tsx` | Filtre extrait en fonction pure `matchesFilters` hors du composant : les trois `useMemo` n'ont plus que des dépendances d'état (`[liste, q, level]`). Les six avertissements `exhaustive-deps` disparaissent, sans désactivation de règle. Comportement inchangé |
| `frontend/tests/learning-ux.test.tsx` | Le test « preserves main's next lesson link… » interrogeait le premier `a[href="/app/lessons/b"]`, qui est le lien du plan du cours. Il vérifie désormais **séparément** le lien d'action (`.lesson-actions a`) portant « Leçon suivante » et la présence du lien du plan (`.course-outline a`). L'assertion est plus précise, pas plus faible |
| `frontend/src/styles/aurore-admin.css` | **R1** : `td.admin-sub` redevient `table-cell` au-dessus de 720 px (mesuré : `table-cell` en 1440, `block` en cartes mobiles). Aucun changement ailleurs |
| `frontend/src/pages/admin/AdminLearnerProgressDetailPage.tsx`, `AdminCertificationsPage.tsx` | **R2** : `data-label` sur toutes les cellules de valeur (Avancement, Statut, Terminée le, Score, Résultat, Date, Soumis le, Critères reliés), affichés devant la valeur dans les cartes mobiles |
| `frontend/src/pages/CourseDetailPage.tsx`, `PathwayDetailPage.tsx`, `LabDetailPage.tsx` | **D10** : suppression du liseré gauche coloré des leçons/cours (`borderLeft`) et de la bordure verte du résultat de lab ; numéros en gris neutre. Les écrans de lecture, catalogue et dashboard du snapshot n'avaient aucune bordure colorée hors indicateurs actifs |

## Vérifications exécutées

| Contrôle | Résultat | Limite |
| --- | --- | --- |
| `npx tsc -b` | Aucune erreur | — |
| `npm run lint` | 0 erreur, **1 avertissement** (`authStore.tsx:97`, existant) ; les 6 avertissements du catalogue sont résolus | — |
| `npm run test` | 36 réussis, 0 échec (le test en échec du snapshot est corrigé) | happy-dom, services simulés |
| `npm run build` | Réussi, avertissement de chunk 3D existant | — |
| **API simulée** : Chromium sur la build servie par le serveur de prévisualisation Vite, 28 captures (7 écrans × 1440, 390, 320, zoom 200 % ≈ 720 px) et `_mesures.json` | `scrollWidth` = `clientWidth` partout ; 0 violation axe-core WCAG 2.0/2.1 A/AA ; 0 erreur JS ; catalogue : **167 cartes** pour 120 cours + 25 parcours + 22 labs servis par pages de 50/20/20 ; 0 bordure colorée hors indicateurs actifs (mesure sur styles calculés) ; import PDF : bouton de confirmation `position: static`, 0 chevauchement avec résumé/anomalies/structure, dans la largeur à 1440/390/320/720 ; dashboard : leçon dépubliée listée sans lien, « acquis conservés » ; dates `table-cell`/`block` et libellés mobiles présents | Données synthétiques ; ni FastAPI, ni PostgreSQL, ni QA 5184/8014 ; rôles simulés par un faux `/api/auth/me` |
| Clavier (Playwright, API simulée, page de leçon) | 24 tabulations par largeur sans indicateur de focus manquant ; menu mobile ouvert par Entrée et fermé par Échap avec retour du focus ; menu compte fermé par Échap ; onglets de profondeur avec `tabpanel` | Pas de test lecteur d'écran ; parcours limité à la leçon |

Le zoom 200 % est émulé par une fenêtre de 720 px de large, pas par un zoom navigateur réel.

## Non vérifié

Backend réel, PostgreSQL de recette, recette réelle par rôle, lecteur d'écran, zoom navigateur réel, CI GitHub, contraste mesuré hors axe. Les captures ci-contre ne sont **pas** des preuves de recette réelle.
