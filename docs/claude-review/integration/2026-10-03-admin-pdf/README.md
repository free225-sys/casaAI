# Aurore — lot administration et import PDF (Claude)

Branche `claude/integrate-aurore`, base `91ee8cedcd8c16eb8b66a6b8c95e915303ba132e` (`codex/validate-learning-ux`). Lot limité aux écrans absents du WIP graphique non publié : aucun des huit fichiers WIP n'est modifié (`AchievementBadges.tsx`, `Nav.tsx`, `NotificationBell.tsx`, `index.css`, `RootLayout.tsx`, `CatalogPage.tsx`, `DashboardPage.tsx`, `LessonPage.tsx`).

## Fichiers applicatifs modifiés

| Fichier | Changement |
| --- | --- |
| `frontend/src/styles/aurore-admin.css` | Nouveau : styles des espaces d'administration, hors `index.css` pour éviter tout conflit avec le WIP. Aucune bordure colorée (D10) ; seuls l'onglet actif, l'étape courante et le focus sont colorés |
| `frontend/src/layouts/AdminLayout.tsx` | Onglets en classes CSS, indicateur sur `aria-current="page"`, rôle affiché, défilement horizontal en mobile ; importe `aurore-admin.css` |
| `frontend/src/pages/admin/AdminCoursesPage.tsx` | `PageHeader`, tableau devenant cartes en mobile, `Status` en français, nom d'école, filtre `Segmented` (`aria-pressed`), état vide, état « Enregistrement… » pendant publication, suppression via `ConfirmDialog`, compteur « N cours affiché(s) dans cette page » distinct de « 1–20 sur 27 » ; recherche toujours limitée à la page et libellée comme telle |
| `frontend/src/pages/admin/AdminCourseLessonsPage.tsx` | Même structure, statut du cours, état vide avec action, suppression via `ConfirmDialog` |
| `frontend/src/pages/admin/AdminImportPdfPage.tsx` | `Stepper` 3 étapes, choix du mode en boutons radio (au lieu d'une case inversée), indicateurs, anomalies dans un avertissement ouvert, arbre avec plages de pages, résumé de décision **dans le flux** après le résumé et les anomalies (aucune barre collante), résultat avec liens vers la leçon créée et le cours, « Importer un autre PDF ». Politique PDF scannés inchangée |
| `frontend/src/pages/admin/AdminUsersPage.tsx` | Tableau, rôles et statuts en français, confirmation avant changement de rôle, suspension/réactivation et suppression ; erreurs d'action séparées de l'erreur de chargement. Gardes serveur 400/403/409 inchangés |
| `frontend/tests/learning-ux.test.tsx` | 3 tests ajoutés (statut en français + confirmation de suppression, confirmation de changement de rôle, lien vers la leçon créée et retour à l'étape 1). Mock `adminService` complété par `deleteCourse` et `updateUser`. Aucun test existant modifié |

Contrats API, rôles, guards, progression et badges : inchangés. Aucun backend modifié. Le bouton « Importer un PDF » de l'en-tête des cours n'a pas été ajouté (l'onglet existe ; il aurait exigé un routeur dans les tests existants).

## Vérifications exécutées

| Contrôle | Résultat | Limite |
| --- | --- | --- |
| `npx tsc -b` | Aucune erreur | — |
| `npm run lint` | 0 erreur, 1 avertissement existant (`authStore.tsx:97`, Fast Refresh) | — |
| `npm run test` | 33 réussis (30 existants + 3 ajoutés) | happy-dom, services simulés |
| `npm run build` | Réussi ; avertissement de chunk 3D existant | — |
| Rendu Chromium de la build, API simulée | 21 captures 1440/390/320 dans ce dossier : 0 débordement horizontal, 0 violation axe-core WCAG 2.0/2.1 A/AA, 0 requête externe ([mesures](_mesures.json)) | Données synthétiques, pas de FastAPI ni PostgreSQL, pas de QA 5184/8014 ; clavier réel, lecteur d'écran et zoom 200 % non vérifiés |

## Captures

Administration des cours ([1440](integ-admin-cours--desktop-1440.png), [390](integ-admin-cours--mobile-390.png), [320](integ-admin-cours--mobile-320.png), [confirmation](integ-admin-cours-suppression--desktop-1440.png)), leçons d'un cours ([1440](integ-admin-lecons--desktop-1440.png), [390](integ-admin-lecons--mobile-390.png)), utilisateurs en SUPER_ADMIN ([1440](integ-admin-utilisateurs--desktop-1440.png), [390](integ-admin-utilisateurs--mobile-390.png)), import PDF : sélection ([1440](integ-pdf-1-selection--desktop-1440.png), [390](integ-pdf-1-selection--mobile-390.png)), prévisualisation ([1440](integ-pdf-2-previsualisation--desktop-1440.png), [390](integ-pdf-2-previsualisation--mobile-390.png), [premier écran 390](integ-pdf-2-ecran-initial--mobile-390.png)), résultat ([1440](integ-pdf-3-resultat--desktop-1440.png), [390](integ-pdf-3-resultat--mobile-390.png)).

## Reste à faire

Écrans du WIP (lecture, dashboard, navigation, catalogue) en attente du transfert demandé dans `CLAUDE_SYNC.md` ; éditeurs de leçon et de quiz, progression et certifications SUPER_ADMIN non traités dans ce lot ; recette réelle par rôle sur la QA (TASK-20261003-002/003).
