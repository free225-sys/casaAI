# Rapport de revue fonctionnelle et proposition de design — CASA AI Institute

Revue du 3 octobre 2026. Auteur : Claude (revue demandée par l'utilisateur, à transmettre au dev lead). Aucune modification applicative : ce dossier ne contient que des rapports, des preuves et des maquettes isolées.

> **Portée.** Ce rapport décrit le commit `65bcde79f66af42553951fcfaa7fa7e656636114`. Il est publié sur `claude/design-review-aurore`, branche créée depuis `29a5701` : les commits `5a3f47a`, `6809361` et `29a5701` corrigent plusieurs constats selon `docs/FUNCTIONAL_RECOVERY_2026-10-03.md`, mais **ces corrections n'ont pas été revérifiées par Claude**. Les captures « avant » utilisent une API simulée ; les maquettes « après » ne sont pas validées avec le backend réel. Réserves d'intégration : [README.md](README.md#réserves-retenues-pour-lintégration).

Livrables : ce rapport · [registre de preuves](REGISTRE_PREUVES.md) · [galerie avant/après](visuels/index.html) · [tokens proposés](visuels/assets/proposed.css) · [maquettes HTML](visuels/apres/) · [outillage de reproduction](outillage/README.md).

---

## 1. Cible, provenance et limites

- **Dépôt, branche, HEAD** : `free225-sys/casaAI`, branche `codex/validate-learning-ux` (PR #1), HEAD `65bcde79f66af42553951fcfaa7fa7e656636114` (3 oct. 2026, « docs: prepare Claude functional and design review »).
- **Référence applicative** : `d2e9d9a` est un ancêtre direct de HEAD. `git diff d2e9d9a..HEAD` ne touche que les 4 fichiers de `docs/claude-review/`. **Le code analysé est donc exactement celui de d2e9d9a.** Écart expliqué, aucun écart inexpliqué.
- **Main** : `origin/main` = `d0e17ba445c3a49d8a3678230c7d3704c823cc39`, merge-base de la PR. Aucun commit de main absent de la branche. Fraîcheur : références distantes lues le jour de la revue.
- **Écart main → PR (applicatif)** : verrous transactionnels PostgreSQL (`backend/app/db/locks.py`, appelés dans `progress_repository.start_lesson/mark_lesson_complete`, `admin_user_service.update_user/delete_user`, `badge_service._persist_and_notify`) ; UUID explicite pour `UserBadge` ; `transaction_per_migration=True` dans `migrations/env.py` ; `LessonPage` monté avec une clé par route et lectures ignorées après démontage ; libellé accessible du filtre de rôle dans `AdminUsersPage`. S'y ajoutent les tests (contrats, natifs, concurrence, PDF, React) et les rapports. **Toutes ces corrections sont préservées par les recommandations ci-dessous** ; aucune proposition ne les contourne.
- **État Git** : checkout propre avant la revue. Après la revue, seuls des fichiers non suivis sous `docs/claude-review/output/2026-10-03/` existent. Aucun commit, push, merge ni déploiement.
- **Instructions lues** : `docs/claude-review/{PROMPT_CLAUDE_CODE,README,REVIEW_SCOPE,REPORT_TEMPLATE}.md`, `README.md`, `backend/README.md`, `frontend/README.md`, `docs/VALIDATION_LEARNING_UX.md`, `docs/NATIVE_TEST_RESULT.json`. Aucun `CLAUDE.md`/`AGENTS.md` dans le dépôt. `.env*` non lus.
- **Environnement réellement accessible** : rendu isolé dans le cloud, **autorisé explicitement par l'utilisateur pendant la revue** : extraction du frontend au SHA hors du checkout, `npm ci --ignore-scripts`, build Vite, Chromium headless, API simulée par interception réseau, données synthétiques. Aucun backend, aucune base, aucun compte réel. Détails : [registre](REGISTRE_PREUVES.md#environnement-dobservation-rendu-isolé-autorisé-par-lutilisateur).
- **QA locale (5184/8014/55432)** : non visitée. Les captures « avant » ne sont pas des captures de la QA.
- **Rôles et viewports** : visiteur, LEARNER, ADMIN (simulés). SUPER_ADMIN : analyse statique seulement. Viewports 1440, 390, contrôle à 320.
- **Corpus privé** : le cahier des charges fonctionnel/technique cité par les README n'est pas versionné. Décisions qu'il pourrait changer : règles d'acquittement des badges (F-08), obligation de quiz pour terminer une leçon, comportement attendu pour un PDF scanné, nomenclature des niveaux N1–N3, charte graphique officielle. À fournir par l'utilisateur dans un canal privé si ces points doivent être arbitrés ; il n'est pas joint ici.
- **Tests** : les 386 tests backend, 25 contrats et 14/6/16 tests natifs sont **cités** depuis `docs/VALIDATION_LEARNING_UX.md` et `docs/NATIVE_TEST_RESULT.json`, non réexécutés. Les décompositions 25, 14, 6 et 16 ont été recomptées statiquement (P-04). **Réexécutés par Claude** dans la copie isolée : build (réussi, chunk 880,51 kB), lint (0 erreur, 1 avertissement), 9 tests React (réussis). Aucun de ces résultats ne prouve une CI actuelle.

## 2. Résultat utile à la décision

**Constat d'ensemble.** Les corrections de la PR tiennent : le rendu isolé confirme les ancres du sommaire, le filtre Labs et l'isolation entre leçons, et les invariants serveur (bornes, idempotence, rôles, brouillons, verrous) ne sont pas en cause. Les difficultés restantes sont surtout d'expérience : **aucun écran n'est bloqué**, mais plusieurs états trompent l'utilisateur ou cassent la mise en page mobile.

**Les six problèmes les plus coûteux, tous reproduits sur le rendu réel du code :**

1. **Échec silencieux de « Marquer comme terminée »** (F-01) : en cas d'erreur serveur, rien ne s'affiche et une exception non gérée part en console.
2. **Le dashboard présente une panne comme un compte vierge** (F-03) : « Vous n'avez pas encore commencé de leçon ».
3. **Débordements mobiles** du dashboard (451 px pour 390) et de l'administration des cours (630 px) (F-04, F-05).
4. **La barre de progression de lecture est cachée sous l'en-tête** (F-09) et le sommaire affiche « 1. 1. » (F-10).
5. **Le filtre de statut admin n'a aucun état actif visible** (F-06), et la recherche admin ne porte que sur la page affichée (F-07).
6. **L'import PDF masque l'essentiel au moment de confirmer** : anomalies repliées, école et mode non rappelés, réinitialisation incohérente du fichier (F-14).

Un point est **à arbitrer avec le dev lead** car il touche la sémantique serveur : les notifications de badge sont créées puis acquittées par le même chargement du dashboard, si bien que la cloche ne peut presque jamais afficher un badge non lu (F-08, statique).

**Direction recommandée : « Aurore lisible ».** On conserve la palette Aurore, IBM Plex Sans, Space Grotesk et l'échelle typographique. On réserve l'or aux réussites, on donne un vrai statut aux brouillons, on lit les leçons en colonne de 68 caractères plutôt qu'en cartes, on construit les espaces de travail (dashboard, admin) sur un fond « canvas », et on standardise les composants d'état (erreur, vide, confirmation, filtres à état). Bénéfices attendus : moins d'ambiguïté sur l'état (terminé, brouillon, erreur), des pages plus courtes (catalogue desktop ≈ 4 060 → 1 430 px), aucun débordement mesuré à 320 px, et 0 violation axe sur les maquettes. Limite : ce sont des maquettes, pas une preuve de faisabilité.

**Décisions nécessaires avant toute implémentation** : direction visuelle, périmètre et ordre des écrans, traitement de F-08, extensions API éventuelles (recherche admin, statut de leçon, titres de cours). Voir le §8.

## 3. Couverture des parcours et registre de preuves

| Parcours / rôle / état | Niveau | Source au SHA / preuve | Résultat | Limite et contrôle restant |
| --- | --- | --- | --- | --- |
| Visiteur : catalogue, recherche, filtres, vide | Observé (rendu isolé) | `CatalogPage.tsx` ; P-05, P-06 | Filtres corrects ; état vide absent ; métadonnées non affichées | Données réelles > 50 cours non testées |
| Visiteur : accueil, connexion, inscription | Statique | `HomePage.tsx`, `LoginPage.tsx`, `RegisterPage.tsx` | Grille d'accueil 3 colonnes sans point de rupture ; retour après connexion perdu depuis une fiche cours (F-17) | Inscription non exercée (mutation) |
| Découverte : cours, parcours, lab | Statique | `CourseDetailPage.tsx`, `PathwayDetailPage.tsx`, `LabDetailPage.tsx` | Toute erreur réseau affichée comme « introuvable » ; pas de statut de leçon | À observer avec données |
| Apprenant : leçon, sommaire, approfondir, fin | Observé | `LessonPage.tsx` ; P-07, P-08, P-09 | F-01, F-02, F-09, F-10, F-11 | Document importé (`has_document`) non rendu dans les captures |
| Apprenant : changement de leçon, réponses tardives | Historique + statique | Tests React (9/9 réexécutés), `LessonPage.tsx:24-28,63-89` | Clé par route et garde `active` conformes | Navigateur réel non testé sur réseau lent |
| Apprenant : dashboard, reprise, badges | Observé + statique | `DashboardPage.tsx` ; P-10, P-11, P-19 | F-03, F-04, F-08, F-20, F-22 | Calcul serveur des badges non exercé |
| Apprenant : notifications | Observé (cloche) + statique | `NotificationBell.tsx`, `notifications.py` | F-08, F-18 | Marquage lu inexistant côté API |
| Apprenant : profil, quiz, portfolio, certifications | Statique (survol) | pages correspondantes | Pas de défaut bloquant relevé sur le parcours principal | Non approfondi, hors priorité |
| ADMIN : liste des cours, filtres, pagination | Observé | `AdminCoursesPage.tsx` ; P-12, P-13 | F-05, F-06, F-07, F-15, F-19 | Publication/suppression non exécutées |
| ADMIN : leçons d'un cours, éditeur, quiz | Statique | `AdminCourseLessonsPage.tsx`, `AdminLessonEditPage.tsx`, `AdminQuizEditPage.tsx` | Chargements sans gestion d'erreur (F-16) | Édition non exercée |
| ADMIN : import PDF (3 étapes) | Observé (API simulée) | `AdminImportPdfPage.tsx` ; P-14, P-15 | F-14, F-20 | Moteur PDF réel non exercé |
| SUPER_ADMIN : utilisateurs, progression, certifications | Statique | `AdminUsersPage.tsx`, `RequireRole.tsx`, `admin_user_service.py` | F-15 (rôle/suspension sans confirmation) ; gardes 400/409/403 intacts | Aucune session SUPER_ADMIN observée |
| Accès refusé, changement de route | Statique | `RequireRole.tsx`, `ProtectedRoute.tsx` | Message clair ; `from` non transmis par `RequireRole` (F-17) | — |

Registre détaillé des preuves P-01 à P-19 : [REGISTRE_PREUVES.md](REGISTRE_PREUVES.md).

## 4. Constats fonctionnels

Légende : **reproduit** = observé sur le rendu isolé du code au SHA (API simulée) ; **statique** = déduit du code ; **hypothèse** = à confirmer par le dev lead.

### F-01 — Échec de complétion de leçon silencieux
- Priorité : **important** ; confiance : haute (reproduit).
- Rôle : LEARNER, leçon publiée ; erreur réseau ou serveur sur `POST /api/lessons/{id}/complete`.
- Étapes : ouvrir une leçon → « Marquer comme terminée » → le serveur répond 500.
- Attendu : message d'erreur et possibilité de réessayer. Observé : le bouton revient à son libellé initial sans aucun message ; `pageerror: Erreur simulée` (rejet non géré).
- Code : `frontend/src/pages/LessonPage.tsx:103-113` (`try/finally` sans `catch`). Preuve : P-09.
- Impact : l'apprenant croit avoir terminé ; progression et badges non mis à jour.
- Recommandation : `catch` avec message actionnable et « Réessayer » ; garder le bouton désactivé pendant l'appel (déjà fait). Ne pas réessayer automatiquement : l'idempotence et le verrou serveur (`mark_lesson_complete`) rendent un nouvel essai manuel sûr.
- Acceptation : sur réponse ≥ 400, un message `role="alert"` apparaît et le bouton reste utilisable ; aucun rejet non géré. Test React proposé : service `completeLesson` rejeté → message visible.

### F-02 — Statut et reprise de la leçon non restitués
- Priorité : **important** ; confiance : haute (statique).
- Précondition : leçon déjà terminée ou commencée.
- Observé (code) : `LessonDetail` ne porte aucun statut (`types/api.ts:172-189`, `api/progress.py:45-63`) ; `completed` est un état local initialisé à `false` (`LessonPage.tsx:36`). Une leçon terminée réaffiche donc « Marquer comme terminée ». Le `progress_pct` envoyé au défilement (`LessonPage.tsx:42-61`) n'est jamais relu pour repositionner l'apprenant. Deux écouteurs de défilement calculent la progression avec des formules différentes (`:46-50` et `:92-101`). La fiche cours n'indique pas non plus quelles leçons sont terminées.
- Impact : reprise peu fiable, doute sur l'état réel ; un nouvel appel `complete` réécrit `completed_at` (comportement documenté dans le rapport de validation).
- Recommandation : afficher le statut d'après `GET /api/me/progress` (existant, lecture seule) ou, en **extension**, renvoyer le statut dans `GET /api/lessons/{id}`. Repositionnement à la reprise : décision produit (D-06). Un seul écouteur de défilement.
- Acceptation : une leçon `COMPLETED` s'ouvre avec le statut « Terminée » et sans bouton primaire de complétion.

### F-03 — Panne de chargement présentée comme un état vide
- Priorité : **important** ; confiance : haute (reproduit, P-11).
- Étapes : dashboard avec `GET /api/me/progress`, `/skills`, `/badges` en erreur.
- Observé : « Vous n'avez pas encore commencé de leçon », section Badges vide sans texte, « 0 leçon terminée ».
- Code : `DashboardPage.tsx:17-22` (`catch(() => set…([]))`), `AchievementBadges.tsx:5`.
- Impact : l'apprenant pense avoir perdu sa progression.
- Recommandation : distinguer `error` de `[]`, message rassurant et « Réessayer ».
- Acceptation : en erreur, aucun texte d'état vide ; un bouton relance les lectures.

### F-04 — Dashboard : débordement horizontal en mobile
- Priorité : **important** ; confiance : haute (mesuré : `scrollWidth` 451 px à 390 et 320, P-10).
- Code : `DashboardPage.tsx:58` (`gridTemplateColumns: "2fr 1fr"` inline, sans point de rupture).
- Recommandation : une colonne sous 960 px ; ordre Reprendre → synthèse → cours → compétences → badges.

### F-05 — Administration des cours : débordement mobile
- Priorité : **important** pour ADMIN sur tablette/mobile ; confiance : haute (mesuré : 630 px, P-12).
- Code : `AdminCoursesPage.tsx:120-143` (ligne flex de 3 boutons non repliable) ; même structure dans `AdminCourseLessonsPage.tsx:81-105` et `AdminUsersPage.tsx:139-187` (statique).
- Recommandation : lignes en cartes empilées sous 600 px, une action visible et un menu d'actions.

### F-06 — Filtre de statut admin sans état actif
- Priorité : **important** ; confiance : haute (reproduit, P-13).
- Code : `AdminCoursesPage.tsx:89-99` ajoute `is-on` à `.btn`, mais `index.css` ne définit que `.chip.is-on` (`:1065`). Pas d'`aria-pressed`.
- Impact : l'admin ne sait pas si la liste est filtrée.
- Recommandation : composant de filtre segmenté (`aria-pressed`, état visuel non coloré seulement).

### F-07 — Recherche admin limitée à la page courante
- Priorité : **important** ; confiance : haute (statique).
- Code : filtre client sur les 20 éléments chargés (`AdminCoursesPage.tsx:72-75`) ; `GET /api/admin/courses` n'accepte pas de paramètre de recherche (`admin_content.py:57-71`). Le compteur « 1–20 sur 27 » reste affiché pendant une recherche.
- Recommandation : **extension** API `search` (dev lead) ; en attendant, libeller « Rechercher dans cette page ».

### F-08 — Notifications de badge acquittées au moment même de leur création
- Priorité : **important** ; confiance : moyenne (statique, séquence serveur non exécutée).
- Séquence : la cloche charge `/api/me/notifications` au montage de la navigation (`NotificationBell.tsx:11-17`) ; le dashboard appelle `GET /api/me/badges`, qui crée badge et notification (`badge_service.py:95-134`), puis, s'il existe un badge `new`, `POST /api/me/badges/ack` (`DashboardPage.tsx:19-22`) qui passe ces notifications à `read=True` (`badge_service.py:136-153`). La cloche ne recharge qu'à l'ouverture. Aucune route ne marque une notification lue (`notifications.py`) ; ouvrir la cloche ne change rien.
- Impact : le compteur de la cloche ne reflète quasiment jamais un nouveau badge ; le signal « Nouveau » n'est visible qu'une fois, sur le dashboard.
- Recommandation : décision produit (D-05) : soit l'acquittement suit une action de l'utilisateur (fermeture du bandeau, ouverture de la cloche), soit la cloche n'affiche pas les badges. À implémenter par le dev lead en conservant le verrou `casa:badges:{user}` et l'absence de doublon.
- Hypothèse à confirmer : comportement identique en production (ordre des requêtes).

### F-09 — Barre de progression de lecture masquée par l'en-tête
- Priorité : amélioration (fonction visible annoncée mais invisible) ; confiance : haute (reproduit, P-08).
- Code : `.reading-progress-track { position: sticky; top: 0; z-index: 5 }` (`index.css:563-571`) sous `.site-header { position: sticky; top: 0; z-index: 10 }` (`:1048`).
- Recommandation : `top: var(--header-h)` ou intégration au bas de l'en-tête ; `role="progressbar"` avec valeur.

### F-10 — Sommaire numéroté deux fois
- Priorité : amélioration ; confiance : haute (reproduit : « 1. 1. Concept central »).
- Code : `<ol>` + préfixe `{i + 1}.` (`LessonPage.tsx:162-166`). Les ancres n'ont pas de `scroll-margin-top` : le titre visé passe sous l'en-tête collant (statique).

### F-11 — Leçon : ordre et hiérarchie en mobile
- Priorité : **important** (mobile) ; confiance : haute (reproduit, P-07).
- Observé : en mobile, le sommaire précède le titre ; les boutons de fin de leçon se décalent (`marginLeft: 12` sur retour à la ligne) ; deux boutons primaires (« Marquer comme terminée », « Leçon suivante ») sont en concurrence ; chaque section est une carte ombrée, à l'encontre de l'intention documentée dans `index.css:590-594`. La colonne de lecture desktop ne fait qu'environ 512 px utiles (220 px de sommaire dans un `max-width: 760px`).
- Code : `LessonPage.tsx:152-169, 192-218, 281-298` ; `index.css:586-588, 1056-1061`.

### F-12 — Catalogue : orientation, état vide et accessibilité des filtres
- Priorité : amélioration ; confiance : haute (reproduit, P-05, P-06).
- Observé : 47 cartes sur une page (≈ 4 060 px desktop, ≈ 9 950 px à 390) ; niveau, durée, profil et école renvoyés par l'API mais non affichés ; recherche sans résultat = trois titres vides ; champ libellé par son seul placeholder ; filtres sans `aria-pressed`, état actif signalé par la couleur or.
- Code : `CatalogPage.tsx:58-128`.

### F-13 — Catalogue tronqué en silence au-delà des limites fixes
- Priorité : amélioration (latent) ; confiance : haute (statique). Données actuelles : 26/11/10, sous les limites 50/20/20.
- Code : `CatalogPage.tsx:27-31` ; `Page.total` ignoré.

### F-14 — Import PDF : informations de décision masquées et réinitialisation incohérente
- Priorité : **important** ; confiance : haute pour l'interface (reproduit, P-14, P-15), moyenne pour la re-sélection du même fichier (hypothèse navigateur).
- Observé : anomalies repliées dans un `<details>` fermé (`AdminImportPdfPage.tsx:269-286`) ; école et mode non rappelés à la confirmation ; option « Document de référence uniquement » exprimée en case inversée (`:195-211`) ; « Choisir un autre fichier » vide l'état mais pas `<input type="file">`, qui affiche toujours le nom alors que « Analyser » est désactivé (`:115-120, 316`) ; badge « à vérifier » neutre ; textes à opacité 0,6–0,75 (contraste, F-20) ; résultat sans lien direct vers la leçon (`lesson_id` est renvoyé), rapport ignoré, formulaire désactivé laissé au-dessus (`:332-351`). PDF scanné : avertissement mais import possible.
- Recommandation : flux en trois étapes explicites (maquettes) ; réinitialiser l'input par clé ou ref ; politique pour les PDF scannés (D-08).
- Hors périmètre design, à examiner par le dev lead : `preview-pdf` et `import-pdf` lisent le fichier entier sans limite de taille visible (`admin_content.py:215-277`), contrairement aux images (`storage_service.py:55`).

### F-15 — Actions sensibles sans garde-fou cohérent dans l'interface
- Priorité : **important** ; confiance : haute (statique).
- Observé : publication/dépublication en un clic, sans confirmation ni indicateur de chargement (`AdminCoursesPage.tsx:48-59, 137-139`) ; changement de rôle, y compris promotion SUPER_ADMIN, déclenché dès le changement du `<select>` (`AdminUsersPage.tsx:56-65, 159-175`) ; suspension sans confirmation (`:67-75`) ; suppressions via `window.confirm` natif.
- Invariants préservés : les gardes serveur 400 (auto-modification), 409 (dernier SUPER_ADMIN actif), 403 (rôle) et le verrou `casa:super-admin-mutations` restent la source de vérité ; l'interface doit afficher leurs messages, pas les dupliquer.
- Recommandation : menu d'actions, boîte de dialogue de confirmation pour suppression, rétrogradation, promotion et suspension ; bouton désactivé pendant l'appel.

### F-16 — Chargements bloqués en cas d'erreur
- Priorité : amélioration ; confiance : haute (statique).
- Code : `AdminCoursesPage.tsx:24, 40-42, 114-115` (squelette infini + message) ; `AdminCourseLessonsPage.tsx:17-22` (promesses sans `catch`, « Chargement… » infini) ; `AdminUsersPage.tsx:48-50, 133-134` ; `AdminImportPdfPage.tsx:108-113` ; `CourseDetailPage.tsx:23-27` (toute erreur = « introuvable »).

### F-17 — Retour à la page d'origine perdu après connexion
- Priorité : amélioration ; confiance : haute (statique).
- Code : liens « Se connecter » de la fiche cours sans `state.from` (`CourseDetailPage.tsx:97, 112`) ; `RequireRole.tsx:30` redirige sans `from`.

### F-18 — Navigation et composants ARIA incomplets
- Priorité : amélioration ; confiance : haute (reproduit visuellement + statique).
- Observé : bouton « Menu » mobile natif non stylé (`Nav.tsx:34-42`) ; cloche « Notif (1) » dont l'`aria-label="Notifications"` masque le compteur (WCAG 2.5.3) (`NotificationBell.tsx:32`) ; panneaux `role="menu"` sans `menuitem` ni fermeture par Échap ; onglets « Approfondir » en `tablist` sans `tabpanel` ni flèches clavier (`LessonPage.tsx:242-262`) ; onglets d'administration non repliables en mobile (`AdminLayout.tsx:29`).

### F-19 — Libellés techniques exposés en administration
- Priorité : amélioration ; confiance : haute (reproduit).
- Observé : statuts « DRAFT/PUBLISHED » en anglais, école affichée par identifiant (`AdminCoursesPage.tsx:128-132`), alors que les écoles sont déjà chargées ; ADMIN et LEARNER partagent la même couleur de badge (`AdminUsersPage.tsx:16-20`).

### F-20 — Contrastes insuffisants mesurés
- Priorité : amélioration ; confiance : haute (axe-core, P-16).
- Observé : `color-contrast` sur 14 nœuds du dashboard (badges non obtenus à `opacity: .55`, `index.css:1035`) et 7 nœuds de l'aperçu PDF (opacités 0,6–0,75). Les champs de saisie ont une bordure `#e1e7ef` sur fond `#eef2f8` (contraste 1,1:1, WCAG 1.4.11 à examiner).

### F-21 — Contenu principal masqué jusqu'au défilement
- Priorité : amélioration ; confiance : moyenne (observé indirectement : la capture pleine page exige de faire défiler).
- Code : `RevealSection` + `useScrollReveal` (`opacity: 0` jusqu'à intersection) appliqués aux sections de leçon, cartes et listes. Risques : impression, captures, sauts d'ancre, lecteurs qui lisent visuellement.
- Recommandation : réserver l'animation au décor (accueil) ; contenu pédagogique visible d'emblée.

### F-22 — Dashboard peu orienté vers la prochaine action
- Priorité : amélioration ; confiance : haute (reproduit).
- Observé : « Reprendre » sans cours ni avancement ; liste plate et illimitée de toutes les leçons touchées ; 11 badges en tête de page qui repoussent la progression (≈ 1 000 px en mobile).
- Statique lié : `list_user_progress` (`progress_repository.py:109-116`) ne filtre pas le statut de publication ; une leçon dépubliée reste listée et mène à un 404.

## 5. Audit du design existant

**Ce qui fonctionne et doit être conservé.** Palette Aurore documentée et contrastée pour le texte (`index.css:4-25`) ; familles IBM Plex Sans / Space Grotesk / Plex Mono ; échelle h1–h4 en `clamp()` ; durées et courbes de mouvement communes ; respect de `prefers-reduced-motion`, y compris pour les View Transitions ; lien d'évitement ; focus visible ; callouts pédagogiques ; squelettes de chargement ; options de quiz qui ne reposent pas sur la seule couleur.

**Ce qui dégrade l'expérience.**
- *Système contourné* : 566 attributs `style={…}` inline dans `frontend/src` ; titres redimensionnés au cas par cas (`h1` à 1.6/1.8/2.6 rem selon la page) alors que l'échelle prétend être définie une fois ; aucun token d'espacement ; couleurs de statut recalculées dans chaque page.
- *Sémantique des couleurs ambiguë* : l'or sert à la fois aux brouillons, aux leçons « En cours », au filtre actif du catalogue, aux numéros de section, aux badges et à l'objectif pédagogique. Il ne signale donc plus rien de précis.
- *Hiérarchie* : cartes ombrées partout (sections de leçon, rangées admin, tableau de bord), deux boutons primaires côte à côte en fin de leçon.
- *Mobile* : deux débordements mesurés, ordre de lecture inversé dans la leçon, bouton de menu natif, actions admin non repliables.
- *États* : erreurs muettes ou déguisées en état vide (F-01, F-03, F-16) ; pas d'état vide de recherche ; confirmations natives.
- *Accessibilité* : 21 nœuds en défaut de contraste (axe) ; filtres sans `aria-pressed` ; composants ARIA partiels. Non réalisé : parcours clavier complet, lecteur d'écran, zoom 200 %, mesure des contrastes non textuels hors bordures de champs.

## 6. Proposition de direction visuelle à valider

**Direction recommandée : « Aurore lisible »**, une évolution et non une refonte. Justification pédagogique : sur une plateforme d'apprentissage, l'écran doit d'abord dire *où j'en suis* et *quelle est la prochaine action*, puis laisser le contenu respirer. On garde l'identité existante, on renforce les signaux d'état, et on réduit le décor là où l'on apprend. Référence interne : les intentions déjà écrites dans `index.css` (« le contenu pédagogique est le héros », « pas une carte autour de chaque phrase ») sont appliquées jusqu'au bout.

**Alternatives utiles.**
- *A. Correctifs ciblés seulement* : F-01, F-03 à F-06, F-09, F-10, F-14 sans changement de tokens. Coût minimal, cohérence inchangée.
- *B. Aurore lisible* (recommandée) : tokens et composants communs, puis les cinq écrans.
- *C. Navigation latérale d'application* (barre latérale pour l'espace apprenant et l'admin) : plus d'espace de navigation, mais refonte du layout et du mobile ; non maquettée, à envisager si le périmètre fonctionnel s'élargit (bibliothèque, analytics).

| Token / composant | Existant (source) | Proposition | Raison et compromis | Décision requise |
| --- | --- | --- | --- | --- |
| Couleur primaire | `--color-accent-blue #2f63e0` (`index.css:18`) | Conservée ; survol `#2552c4` au lieu d'une opacité | Lisibilité au survol (6,8:1) | Non |
| Or | `--color-accent-gold #8a6100`, usages multiples | Réservé aux badges et certifications (`--color-achievement`) | Redonne un sens à l'or ; objectif pédagogique passe en bleu | Oui (D-01) |
| Brouillon | Or (`AdminCoursesPage.tsx:124`) | `--color-draft #4a5468` sur `#edf0f5`, pastille pointillée | Brouillon ≠ réussite ; pictogramme en plus de la couleur (6,7:1) | Oui (D-01) |
| Avertissement | Absent (corail ou neutre) | `--color-warning #8f4a00` sur `#fff1df` (6,0:1) | « À vérifier », anomalies PDF | Non |
| Erreur | `#c0392b` | `#b42318` (6,6:1 sur blanc) | Plus contrasté, distinct de l'avertissement | Non |
| Fond de travail | Blanc partout | `--color-canvas #f4f6fa` pour dashboard/admin ; lecture sur blanc | Sépare espaces de travail et lecture ; muted reste à 5,5:1 | Oui (D-01) |
| Contour de champ | `#e1e7ef` sur `#eef2f8` (1,1:1) | `--color-border-strong #858fa1` (3,3:1) sur champ blanc | WCAG 1.4.11 ; contours plus marqués | Non |
| Typographie | Plex Sans / Space Grotesk / Plex Mono, h1 clamp jusqu'à 2,5 rem | Familles conservées ; h1 plafonné à 2,25 rem ; plancher 13 px ; corps de leçon 17 px / 1,7 | Une seule échelle, pas de surcharge par page | Non |
| Espacement | Valeurs inline libres | Échelle 4 px (`--space-1…8`) | Rythme cohérent, revue plus simple | Non |
| Contrôles | Hauteur libre | 40 px desktop, 44 px mobile | Cibles tactiles | Non |
| Mouvement | Révélation au défilement sur le contenu | Conservé pour la page d'accueil ; supprimé sur le contenu pédagogique et les listes | F-21 | Oui (D-07) |
| Navigation | Liens texte, « Menu » natif, « Notif (n) » | Lien actif sur fond doux + `aria-current`, cloche avec compteur annoncé, avatar/menu compte, menu mobile stylé | F-18 | Non |
| Filtres | `.chip.is-on` or ; `.btn.is-on` sans style | Contrôle segmenté avec `aria-pressed` et compteurs | F-06, F-12 | Non |
| Statuts | Badges recolorés inline | Composant `status` : pastille + texte français + couleur sémantique | F-19 | Non |
| États | Texte coral ou état vide trompeur | Composants `notice` (erreur, avertissement, succès, info) et `empty` avec action | F-01, F-03, F-12 | Non |
| Confirmation | `window.confirm` | Boîte de dialogue `alertdialog` avec conséquence explicite | F-15 | Non |
| Stepper | Texte « 1. Fichier 2. Aperçu 3. Import » | Pastilles fait/en cours/à venir, `aria-current="step"`, libellé seul en mobile | F-14 | Non |
| Bordures colorées | Liserés colorés sur callouts et retours de quiz (`index.css:595-657, 749-759`), lignes de leçon (`CourseDetailPage.tsx:81`, `PathwayDetailPage.tsx:57`), bordure or des badges obtenus et du filtre actif (`index.css:1036, 1065`) | Supprimés partout : cartes, encadrés, messages, badges, choix et cadres de la galerie n'ont que des bordures neutres ou aucune ; l'état passe par le fond teinté, le pictogramme et le texte. Restent colorés les seuls indicateurs (onglet actif, étape du stepper, anneau de focus) | Consigne de l'utilisateur ; moins de bruit visuel, hiérarchie portée par le fond et la typographie | **Approuvé** (D-10) |
| Tableau admin | Rangées flex | Tableau desktop, cartes en mobile, une action visible + menu « … » | F-05 | Non |

Fichier de démonstration : [visuels/assets/proposed.css](visuels/assets/proposed.css) (commenté, non importé par l'application).

### Comparaisons avant/après

Toutes les images sont dans la [galerie](visuels/index.html), avec légendes visibles. « Avant » = **capture réelle du code au SHA dans un rendu isolé avec API simulée** (pas la QA). « Après » = **maquette proposée, non implémentée**.

| Écran / état / viewport | Avant : chemin et nature | Après : chemin de maquette | Changements et raisons | Contrats conservés / extensions proposées |
| --- | --- | --- | --- | --- |
| Catalogue — 1440, 390 (+320) | `visuels/avant/avant-catalogue--*.png`, capture réelle | `visuels/apres/apres-catalogue.html` (+ `#vide`) | Recherche libellée, filtres à état, métadonnées, sections limitées avec « Voir les N », état vide (F-12, F-13) | GET publics existants ; aucune extension |
| Leçon — 1440, 390 (+320) | `visuels/avant/avant-lecon--*.png`, `…-defilement`, `…-echec-completion`, captures réelles | `visuels/apres/apres-lecon.html` (+ `#echec`) | Barre de lecture visible, colonne 68 caractères, sommaire latéral ou repliable, plan du cours, fin de leçon à action unique, erreur + Réessayer (F-01, F-02, F-09 à F-11) | `start`/`progress`/`complete` inchangés ; statut via `GET /api/me/progress` ; extension possible : statut dans `GET /api/lessons/{id}` |
| Dashboard — 1440, 390 (+320) | `visuels/avant/avant-dashboard--*.png`, `…-erreur-api`, captures réelles | `visuels/apres/apres-dashboard.html` (+ `#erreur`) | Reprendre enrichi, synthèse, progression par cours, une colonne en mobile, erreur distincte, badges compacts (F-03, F-04, F-08, F-20, F-22) | Mêmes lectures ; titres de cours via `GET /api/courses` ou extension ; règle d'acquittement à décider (D-05) |
| Administration des cours (ADMIN) — 1440, 390 (+320) | `visuels/avant/avant-admin-cours--*.png`, `…-filtre-brouillons`, captures réelles | `visuels/apres/apres-admin-cours.html` (+ `#suppression`) | Tableau, statuts traduits, filtre à état, menu d'actions, confirmation, cartes mobiles (F-05 à F-07, F-15, F-19) | `PUT`/`DELETE` inchangés ; extension : recherche serveur, compteurs par statut |
| Import PDF : sélection, prévisualisation, résultat — 1440, 390 (+320) | `visuels/avant/avant-pdf-{1,2,3}-*.png`, captures réelles | `visuels/apres/apres-pdf-{1-selection,2-previsualisation,3-resultat}.html` | Stepper, choix explicite du mode, rappel de la cible, anomalies visibles, barre de confirmation, résultat orienté action (F-14, F-20) | `preview-pdf` (sans écriture) puis `import-pdf` (crée des lignes) inchangés ; aucune extension |

Bénéfices mesurés sur les maquettes : 0 débordement à 1440, 390 et 320 ; 0 violation axe (WCAG A/AA) ; 0 requête réseau. Coût : refonte CSS des cinq écrans et création de 8 composants partagés. Limites : contenu synthétique, pas d'interactions réelles, rendu des contrôles natifs dépendant du navigateur.

## 7. Recommandations priorisées

Effort relatif : S (< 1 j), M (1–3 j), L (> 3 j), pour un développeur front, hors recette.

| ID | Fonctionnel / design | Priorité | Impact, preuve et confiance | Effort | Dépendances / risques | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Erreur de complétion (F-01) | Important | Progression perçue fausse ; P-09 ; haute | S | Aucune | Message + Réessayer sur ≥ 400, aucun rejet non géré |
| R-02 | Erreur ≠ vide sur dashboard (F-03) | Important | Panique utilisateur ; P-11 ; haute | S | Aucune | Aucun état vide affiché en erreur |
| R-03 | Débordements mobiles (F-04, F-05) | Important | Mesurés 451/630 px ; haute | S–M | Composant tableau/cartes (R-10) | `scrollWidth ≤ clientWidth` à 320 et 390 |
| R-04 | Filtre admin à état + libellé de recherche (F-06, F-07) | Important | P-13 ; haute | S | Extension recherche optionnelle | `aria-pressed` correct ; recherche libellée selon sa portée |
| R-05 | Flux PDF en 3 étapes (F-14) | Important | P-14, P-15 ; haute | M | Politique PDF scanné (D-08) | Anomalies visibles avant confirmation ; réinitialisation complète |
| R-06 | Confirmations admin (F-15) | Important | Statique ; haute | M | Composant dialogue | Rôle, suspension, suppression demandent confirmation ; messages 400/409 affichés |
| R-07 | Badges/notifications (F-08) | Important | Statique ; moyenne | M | Décision produit + dev lead (back) | Un nouveau badge apparaît non lu dans la cloche jusqu'à action |
| R-08 | Statut de leçon et reprise (F-02) | Important | Statique ; haute | S–M | Appel `/api/me/progress` ou extension | Leçon terminée affichée comme telle |
| R-09 | Leçon : barre, sommaire, hiérarchie (F-09 à F-11, F-21) | Amélioration / important mobile | P-07, P-08 ; haute | M | Tokens (R-10) | Barre visible, numérotation unique, une action primaire |
| R-10 | Fondations : tokens, composants partagés | Amélioration (socle) | Audit §5 | M | Validation D-01 | Plus de couleurs de statut inline ; composants réutilisés |
| R-11 | Catalogue (F-12, F-13) | Amélioration | P-05, P-06 ; haute | M | — | État vide, filtres `aria-pressed`, métadonnées affichées |
| R-12 | Dashboard orienté action (F-22) | Amélioration | P-10 ; haute | M | Titres de cours | Reprendre avec cours et avancement ; regroupement par cours |
| R-13 | Gestion des erreurs de chargement (F-16, F-17) | Amélioration | Statique | S | — | Aucun « Chargement… » infini sur erreur |
| R-14 | Navigation, ARIA, contrastes (F-18 à F-20) | Amélioration | P-16 ; haute | S–M | Tokens | 0 violation axe sur les écrans prioritaires |

## 8. Décisions requises de l'utilisateur

| ID | Décision | Recommandation | Alternative utile | Effet sur périmètre / compromis | Statut |
| --- | --- | --- | --- | --- | --- |
| D-01 | Direction visuelle | « Aurore lisible » (or réservé aux réussites, statut brouillon neutre, canvas pour les espaces de travail) | A : correctifs seuls ; C : navigation latérale | B ajoute des fondations (R-10) avant les écrans ; A est plus rapide mais garde l'ambiguïté des couleurs | À valider |
| D-02 | Périmètre et ordre | Lot 1 : R-01 à R-06 ; lot 2 : R-10, R-09, R-12 ; lot 3 : R-11, R-13, R-14 | Tout en un lot | Le lot 1 corrige les défauts reproduits sans attendre les tokens | À valider |
| D-03 | Catalogue « Tout » limité par section | 3/6/3 éléments + « Voir les N » | Liste complète avec pagination | Page plus courte, un clic de plus pour tout voir | À valider |
| D-04 | Extensions API | Seulement si le dev lead les juge utiles : recherche admin, statut dans le détail de leçon, titre de cours dans la progression | Utiliser les GET existants (appels supplémentaires) | Les extensions touchent contrats et tests : responsabilité du dev lead | À valider |
| D-05 | Règle d'acquittement des badges | Acquitter sur action de l'utilisateur (fermeture du bandeau ou ouverture de la cloche) | Retirer les badges de la cloche | Modifie un comportement serveur testé (contrats, natifs, concurrence) | À valider |
| D-06 | Reprise de lecture | Afficher le pourcentage lu ; proposer « Reprendre où j'en étais » sans défilement automatique | Repositionnement automatique | Le `progress_pct` mesure un défilement, pas une compréhension | À valider |
| D-07 | Animations de révélation | Les retirer du contenu pédagogique et des listes | Les garder avec affichage immédiat sans IntersectionObserver | Moins d'effet, plus de robustesse | À valider |
| D-08 | PDF scanné | Bloquer « Confirmer » tant qu'une case « J'ai compris que la leçon sera vide » n'est pas cochée | Bloquer complètement l'import | Évite des brouillons vides ; dépend du CDC privé | À valider |
| D-09 | Quiz de validation et complétion | Garder la complétion indépendante du quiz (comportement actuel), le dire à l'écran | Exiger le quiz | Dépend du CDC privé | À valider |
| D-10 | Bordures et liserés colorés | Les supprimer partout (cartes, encadrés, messages, badges) ; garder les indicateurs d'état actif | — | Appliqué aux maquettes et aux tokens proposés | **Approuvé** par l'utilisateur le 3 oct. 2026 |

Seule D-10 est marquée « approuvé », sur consigne explicite de l'utilisateur. Les autres décisions restent à valider.

## 9. Plan de transmission au dev lead

| Étape après validation | Fichiers / composants concernés | API, données, sécurité : dépendances à examiner | Validation proposée | Acceptation / retour arrière |
| --- | --- | --- | --- | --- |
| 0. Correctifs reproduits (lot 1) | `LessonPage.tsx`, `DashboardPage.tsx`, `AchievementBadges.tsx`, `AdminCoursesPage.tsx`, `AdminCourseLessonsPage.tsx`, `AdminUsersPage.tsx`, `AdminImportPdfPage.tsx`, `index.css` | Aucune ; ne pas toucher aux verrous ni aux codes 400/403/409 | Tests React : complétion rejetée, dashboard en erreur, filtre `aria-pressed`, réinitialisation PDF ; rendu 320/390 | PR séparée et réversible ; critères R-01 à R-06 |
| 1. Fondations de design | `index.css` (tokens), nouveau dossier `components/ui/` (Status, Notice, EmptyState, Segmented, Dialog, Stepper, DataTable, PageHeader) | Aucune | Revue visuelle desktop/mobile ; axe sur une page de démonstration | Tokens additifs d'abord, alias des anciens noms pour éviter une bascule brutale ; appliquer D-10 (aucune bordure colorée) dès cette étape |
| 2. Composants communs | `Nav.tsx`, `NotificationBell.tsx`, `AdminLayout.tsx`, `RevealSection` | F-08 si D-05 retenu : `badge_service.py`, éventuelle route de lecture des notifications | Clavier (Tab, Échap, flèches), lecteur d'écran sur la navigation | Feature flag ou PR dédiée |
| 3. Écrans prioritaires | Leçon, dashboard, admin cours, import PDF, catalogue | Extensions D-04 éventuelles (contrats, schémas, tests) | Parcours apprenant complet sur base jetable : démarrage, défilement, complétion répétée, changement de leçon A→B→A, réponse tardive | Écran par écran ; captures avant/après conservées |
| 4. Recette desktop/mobile et non-régression | Ensemble | Base PostgreSQL jetable préparée par le dev lead, comptes synthétiques, journal des IDs | Rejouer les 386 tests backend, 25 contrats, 9+ tests React ; recette navigateur 1440/390/320 par rôle (visiteur, LEARNER, ADMIN, SUPER_ADMIN) ; brouillons invisibles ; import des 16 PDF synthétiques | Aucun changement d'invariant ; retour arrière par revert de PR |

Parcours de non-régression à couvrir : changement de leçon et réponses tardives (tests existants à conserver), complétion répétée sans doublon, badges calculés au GET et acquittement, rôles et gardes 400/409/403, exclusion des brouillons, import PDF prévisualisation sans écriture puis import. Pas de réécriture Supabase, pas de migration décidée par cette revue.

## 10. Livrables, limites restantes et prochaine action

- **Index** : [README du dossier](README.md) · [RAPPORT.md](RAPPORT.md) · [REGISTRE_PREUVES.md](REGISTRE_PREUVES.md) · [visuels/index.html](visuels/index.html) · `visuels/avant/` (28 fichiers dont mesures) · `visuels/apres/` (7 maquettes HTML, captures, mesures) · `visuels/assets/` (tokens, polices OFL) · `outillage/` (scripts de reproduction).
- **Questions ouvertes** : D-01 à D-09 ; CDC privé à fournir hors dépôt si D-05, D-08 ou D-09 doivent être tranchés selon lui.
- **Vérifications non effectuées** : QA locale ; backend réel et PostgreSQL ; rôles SUPER_ADMIN observés ; parcours clavier complet et lecteur d'écran ; zoom 200 % ; navigateurs autres que Chromium ; PDF clients ; données au-delà du seed.
- **Déclaration** : seuls des rapports, preuves et maquettes ont été écrits, sous `docs/claude-review/output/2026-10-03/`. Aucune implémentation, donnée, configuration, dépendance, migration, publication Git ni livraison n'a été modifiée. Le rendu isolé a utilisé une copie du frontend hors du checkout, avec l'accord explicite de l'utilisateur.
- **Prochaine action** : l'utilisateur valide la direction (D-01) et le périmètre (D-02) ; le dev lead reprend ensuite les tâches approuvées.
