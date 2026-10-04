# Lot 4 — aperçus d'administration sans écriture pédagogique, et labs sans note déclarée (frontend)

Branche `claude/roles-scopes-ui`, lot posé sur `f5caed56aacd5215514f229669e863d88161b06f`. Contrat lu : `codex/roles-scopes-certification` à **`de2be0569b484f12fe142356b07f6ffa251cbf9c`** (`docs/ROLES_SCOPES_CERTIFICATION.md`, section « Lot 4 », et OpenAPI : `AdminLessonOut`, `LessonDocumentOut`, `AdminQuizOut`). Aucun fichier backend modifié, aucune API parallèle. Rien n'a été exécuté contre ce backend.

## Routes utilisées

| Usage | Route | Schéma |
| --- | --- | --- |
| Aperçu d'une leçon | `GET /api/admin/preview/lessons/{id}` | `AdminLessonOut` (brouillons compris, soumis au périmètre) |
| Document d'origine d'une leçon importée | `GET /api/admin/preview/lessons/{id}/document` | `LessonDocumentOut` (404 si absent) |
| Aperçu d'un quiz avec corrigé | `GET /api/admin/preview/quizzes/{id}` | `AdminQuizOut` (`is_correct` inclus) |

Le contrat : refus LEARNER 403 ; ressource absente ou hors périmètre 404 ; aucun effet de bord en `GET`.

## Changements

| Fichier | Changement |
| --- | --- |
| `frontend/src/pages/admin/AdminPreviewLessonPage.tsx` (nouveau) | `/admin/preview/lessons/:lessonId` : leçon en **lecture seule**, brouillon compris, avec statut, objectifs, sections (paragraphes et image), niveaux d'approfondissement, exemple et **document d'origine** s'il existe. Bandeau : « sans créer de progression, de badge ni de tentative ; un apprenant ne voit cette leçon qu'une fois la leçon et son cours publiés ». Aucun champ de saisie, aucun bouton de complétion, **aucun appel aux services pédagogiques**. 404 (introuvable ou hors périmètre), 403 et panne sont trois états distincts avec retry ; l'absence de document (404) n'est pas une erreur, une panne du document a son propre retry |
| `frontend/src/pages/admin/AdminPreviewQuizPage.tsx` (nouveau) | `/admin/preview/quizzes/:quizId` : questions, options et corrigé en lecture seule ; la bonne réponse est signalée par le **texte « Bonne réponse »**, jamais par la couleur seule ; explication affichée ; aucune réponse saisissable, aucune tentative |
| `App.tsx`, `utils/roles.ts` | Routes réservées ADMIN et SUPER_ADMIN, ajoutées à la table des routes connues (le test de correspondance avec `App.tsx` les couvre) |
| `pages/admin/AdminCourseLessonsPage.tsx`, `AdminLessonEditPage.tsx`, `AdminQuizEditPage.tsx` | Liens « Aperçu » depuis la liste des leçons, l'éditeur de leçon (leçon et quiz de validation) et l'éditeur de quiz |
| `frontend/src/services/adminService.ts`, `styles/aurore-admin.css` | `previewLesson`, `previewLessonDocument`, `previewQuiz` (GET uniquement) ; styles d'options de quiz en lecture seule, sans bordure colorée (D10) |
| `frontend/src/pages/LabDetailPage.tsx` | **Le curseur « Auto-évaluation » et le `score` envoyé sont supprimés** : le serveur ignore désormais le score client (résultat `score=null`) ; la confirmation dit « Votre entraînement est enregistré. Il ne donne ni note ni certification » |
| `frontend/tests/preview-lot4.test.tsx` (nouveau), `tests/admin-service-forms.test.ts` | 7 tests, voir ci-dessous. Aucun test existant modifié |

## Tests exécutés

`npx tsc -b` sans erreur ; `npm run lint` 0 erreur et 1 avertissement existant (`authStore.tsx:98`) ; `npm run test` **105/105** (98 existants inchangés + 7 nouveaux) ; `npm run build` réussi. Les nouveaux tests couvrent : aperçu de leçon en brouillon sans champ de saisie, sans bouton de complétion et **sans aucun appel à `progressService`** ; document d'origine présent, absent (404) et en panne avec retry ; 404, 403 et panne distincts ; quiz avec corrigé en texte et sans réponse saisissable ni tentative ; lab sans score envoyé (la clé `score` n'est pas dans le corps) ; routes de lecture seule du service (aucun `POST` ni `PUT`). Limite : happy-dom et services simulés.

## Captures avec API simulée

Chromium sur la build en prévisualisation, API interceptée, rôle simulé par un faux `/api/auth/me` : 4 écrans × 1440, 390 et 320 px = 12 captures (`_mesures.json`) : aperçu de leçon avec document d'origine, aperçu de quiz avec corrigé, liste des leçons avec lien « Aperçu », page d'un lab sans curseur de score. `scrollWidth` = `clientWidth` dans les 12 cas, 0 violation axe-core WCAG 2.0/2.1 A/AA, 0 erreur JS ; **0 appel pédagogique émis** (`/api/me/*` hors notifications, leçons, quiz, portfolio) sur les trois écrans d'administration ; 0 champ de formulaire dans les deux aperçus ; aucun curseur sur la page du lab.

## Non vérifié et points à confirmer

- **Aucune vérification contre le vrai serveur** : ni FastAPI, ni PostgreSQL, ni le 404 hors périmètre, ni le 403 d'un apprenant, ni l'absence réelle d'effet de bord ; les messages reposent sur le contrat. Le comportement « aucun effet de bord » est observé côté client (aucun appel pédagogique émis), pas côté serveur.
- Les aperçus rendent le contenu de `AdminLessonOut` (sections, objectifs, niveaux, exemple) ; ils **n'affichent pas les schémas de leçon** (`diagram`) : `AdminLessonOut` ne les expose pas dans le contrat lu. À confirmer si l'aperçu doit les montrer.
- L'aperçu n'est pas une réplique pixel pour pixel de la page de l'apprenant (qui dépend de la progression) : c'est un rendu du contenu.
- Pas de lecteur d'écran, de zoom navigateur réel ni de clavier rejoué pour ce lot ; CI GitHub non consultée.
