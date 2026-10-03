# Registre de preuves — revue du 3 octobre 2026

Chemins relatifs à `docs/claude-review/output/2026-10-03/`. Références de code au SHA `65bcde79f66af42553951fcfaa7fa7e656636114`, dont le code applicatif est identique à `d2e9d9a0e22e80ca400684e293818f38b6d7b042` (seuls 4 fichiers de `docs/claude-review/` diffèrent).

## Environnement d'observation (rendu isolé autorisé par l'utilisateur)

| Élément | Valeur |
| --- | --- |
| Autorisation | Choix explicite de l'utilisateur : « Rendu isolé cloud » (copie hors checkout, `npm ci --ignore-scripts`, build Vite, Chromium, API simulée). Aucune autre autorisation (QA locale, base, comptes) n'a été demandée ni utilisée. |
| Source | `git archive 65bcde7 frontend` extrait dans un répertoire temporaire hors du dépôt. Le checkout de revue n'a reçu aucune dépendance ni fichier de build. |
| Build | `VITE_API_URL=http://api.mock npm run build` : réussi (TypeScript + Vite 8.2), avertissement de chunk `react-three-fiber` 880,51 kB, identique au rapport versionné. |
| Lint / tests React | Réexécutés dans la même copie : `oxlint` 0 erreur, 1 avertissement (`only-export-components`, `authStore.tsx:97`) ; `vitest run` 9/9 réussis (happy-dom). Concordant avec `docs/VALIDATION_LEARNING_UX.md`. |
| Navigateur | Chromium headless fourni par l'environnement (Playwright), locale `fr-FR`, `prefers-reduced-motion: reduce`, échelle 1. |
| Réseau | Aucun serveur lancé. Les fichiers `dist/` et l'API sont servis par interception Playwright ; toute autre URL est bloquée et journalisée (0 requête bloquée). Les polices Google Fonts demandées par `index.html` sont remplacées par les mêmes familles (fontsource, OFL) servies localement. |
| Données | Synthétiques. Titres pédagogiques issus du seed public versionné `backend/data/casa_data.json`. Comptes fictifs (`apprenant@example.test`, `admin@example.test`). Aucune donnée de la QA, aucun secret, aucun `.env` lu. |
| Limites | Les réponses de l'API sont simulées : elles respectent les types de `frontend/src/types/api.ts` mais ne prouvent pas le comportement du backend réel. Les états dépendant du serveur (calcul des badges, acquittement, verrous) restent des constats statiques. Les sélecteurs de fichiers et listes déroulantes sont rendus par Chromium Linux (« Choose File » en anglais). |
| Outillage | Scripts reproduisibles dans `outillage/` (non applicatifs). |

## Preuves

| ID | Type | Chemin / fichiers et lignes | Viewport, contexte | Limites |
| --- | --- | --- | --- | --- |
| P-01 | Code (statique) | `frontend/src/App.tsx:40-207` (routes, gardes) | — | — |
| P-02 | Diff Git | `git diff origin/main..HEAD` : 26 fichiers, +1733/−14 ; applicatif : `backend/app/db/locks.py` (nouveau), `progress_repository.py`, `admin_user_service.py`, `badge_service.py`, `migrations/env.py`, `frontend/src/pages/LessonPage.tsx`, `AdminUsersPage.tsx` | `origin/main` = `d0e17ba` (ancêtre de HEAD, aucun commit de main absent de la PR) | Fraîcheur de `origin/main` : lue le 3 octobre 2026 à la revue |
| P-03 | Résultat historique | `docs/VALIDATION_LEARNING_UX.md`, `docs/NATIVE_TEST_RESULT.json` | Tests natifs exécutés par l'équipe sur PostgreSQL 16 local | Non réexécutés par Claude (backend, contrats, natifs) |
| P-04 | Comptage statique des tests | `backend/contract_tests/test_learning_http.py` (11 fonctions dont 5 paramétrées = 23 cas) + `test_badge_service.py` (2) = 25 ; `tests/test_learning_native.py` 14 cas ; `tests/test_learning_concurrency.py` 6 cas ; `tests/test_pdf_native_roundtrip.py` × 16 fixtures | Lecture des décorateurs `parametrize` | Le total de 386 n'a pas été recompté (collecte pytest non lancée, elle importerait la configuration de base) |
| P-05 | Capture réelle | `visuels/avant/avant-catalogue--{desktop-1440,mobile-390,mobile-320}.png` | Visiteur, `/catalog` | API simulée |
| P-06 | Capture réelle | `visuels/avant/avant-catalogue-recherche-vide--desktop-1440.png` | Saisie « blockchain » | — |
| P-07 | Capture réelle | `visuels/avant/avant-lecon--*.png` | Apprenant, `/app/lessons/vectors-tensors` | Capture pleine page après défilement (révélation au scroll) |
| P-08 | Capture réelle | `visuels/avant/avant-lecon-defilement--{desktop-1440,mobile-390}.png` | Écran après `scrollTo(0,700)` | — |
| P-09 | Reproduction | `visuels/avant/avant-lecon-echec-completion--desktop-1440.png` ; `visuels/avant/_mesures-avant.json` (console : `pageerror: Erreur simulée`) | POST `/complete` forcé en 500 | Erreur simulée |
| P-10 | Capture réelle + mesure | `visuels/avant/avant-dashboard--*.png` ; `_mesures-avant.json` : `scrollWidth` 451 pour 390 et 320 | Apprenant, progression synthétique | — |
| P-11 | Reproduction | `visuels/avant/avant-dashboard-erreur-api--desktop-1440.png` | GET `/api/me/progress`, `/skills`, `/badges` forcés en 500 | Erreur simulée |
| P-12 | Capture réelle + mesure | `visuels/avant/avant-admin-cours--*.png` ; `scrollWidth` 630 pour 390 et 320 | ADMIN, 27 cours synthétiques | — |
| P-13 | Reproduction | `visuels/avant/avant-admin-cours-filtre-brouillons--desktop-1440.png` | Clic « Brouillons », pointeur déplacé hors du bouton | — |
| P-14 | Captures réelles | `visuels/avant/avant-pdf-{1-selection,2-previsualisation,3-resultat}--*.png` | ADMIN, fichier PDF factice, réponses preview/import simulées | Le moteur PDF réel n'est pas exercé |
| P-15 | Reproduction (journal) | Session Playwright : après « Choisir un autre fichier », `input#file.files.length = 1` (nom toujours affiché) et bouton « Analyser » désactivé | ADMIN, desktop | Le cas « re-sélection du même fichier sans évènement change » reste une hypothèse navigateur |
| P-16 | Mesure accessibilité automatisée | `_mesures-avant.json` : axe-core 4.x (WCAG 2.0/2.1 A/AA) ; `color-contrast` 14 nœuds (dashboard), 7 nœuds (aperçu PDF) ; 0 autre violation détectée | Tous écrans « avant » | axe ne couvre qu'une partie des critères ; parcours clavier et lecteur d'écran non testés |
| P-17 | Maquettes + mesures | `visuels/apres/*.html`, `*.png`, `_mesures-apres.json` : 0 violation axe, 0 débordement à 1440/390/320, 0 requête réseau | Fichiers locaux | Maquettes : ne prouvent ni faisabilité ni comportement |
| P-18 | Calcul de contraste | Script de rapport WCAG sur les tokens proposés (voir `RAPPORT.md` §6) | — | Contrastes calculés, pas mesurés à l'écran |
| P-19 | Code (statique) | `backend/app/services/badge_service.py:95-153`, `frontend/src/pages/DashboardPage.tsx:16-23`, `frontend/src/components/NotificationBell.tsx:11-17,32` | Séquence badges/notifications | Non exécuté sur backend réel |

## Expurgation

Aucune capture de la QA utilisateur. Aucun identifiant, mot de passe, adresse, chemin de profil ou journal privé. Les noms et adresses des comptes simulés sont fictifs (domaine réservé `example.test`). Le prénom d'une personne cité dans le rapport de validation versionné n'est pas repris.
