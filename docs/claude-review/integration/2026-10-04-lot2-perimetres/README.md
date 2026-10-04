# Lot 2 — attribution des périmètres, catalogue borné, import PDF et médias avec cible (frontend)

Branche `claude/roles-scopes-ui`, lot posé sur `05b18dcd81fa4cf7eeacf6d376170e82489ced78`. Contrat lu : `codex/roles-scopes-certification` à **`22d8eefd125b01474a64385d5753d80c7656b1ac`** (`docs/ROLES_SCOPES_CERTIFICATION.md` et `docs/ROLES_API_CONTRACTS.openapi.json`). **Réserve du dev lead (`MSG-20261004-003`) : ce SHA n'est pas validé pour l'intégration finale** (cascades administratives en correction côté backend, nouveau SHA annoncé). Ce lot n'utilise que les routes et schémas du contrat publié, sans API parallèle, et ne touche à aucune suppression de cours, de leçon ou de quiz.

## Routes et schémas utilisés (lus dans l'OpenAPI)

| Usage | Route | Schéma |
| --- | --- | --- |
| Périmètre personnel | `GET /api/admin/me/scopes` | `ScopesOut` (`school_ids`, `pathway_ids`, `grants`, `global_access`) |
| Lire un périmètre (SUPER_ADMIN) | `GET /api/admin/users/{user_id}/scopes` | `ScopesOut` |
| Remplacer un périmètre (SUPER_ADMIN) | `PUT /api/admin/users/{user_id}/scopes` | corps `ScopeReplacement` `{school_ids, pathway_ids}` → `ScopesOut` |
| Liste admin (déjà utilisée) | `GET /api/admin/courses` | `AdminCourseListResponse`, filtrée par le serveur avant total et pagination |
| Création de cours | `POST /api/admin/courses` | `AdminCourseIn` : `school_id`, `title` requis ; `pathway_id?` (rattachement atomique) |
| Aperçu PDF | `POST /api/admin/courses/preview-pdf` | multipart `file`, `school_id?`, `pathway_id?` |
| Import PDF | `POST /api/admin/courses/import-pdf` | multipart `school_id`, `file`, `create_course`, `pathway_id?` |
| Média | `POST /api/admin/media/images` | multipart `file`, `course_id?`, `school_id?` (exactement une cible) |

## Changements

| Fichier | Changement |
| --- | --- |
| `frontend/src/pages/admin/AdminUserScopesPage.tsx` (nouveau), `App.tsx`, `utils/roles.ts` | Écran SUPER_ADMIN `/admin/users/:userId/scopes` : écoles et parcours en cases à cocher, parcours filtrables (les cochés restent affichés), tous les parcours chargés jusqu'au total annoncé, enregistrement explicite du **remplacement complet**, indicateur de modifications non enregistrées, erreurs 409 (cible non ADMIN), 403, 422 et panne affichées sans perdre la sélection ni le périmètre précédent, retry sur panne de chargement (jamais un formulaire vide modifiable), identifiants inconnus conservés visibles pour ne pas les supprimer en silence, date de dernière attribution, rappel des règles validées (lecture si un parcours est attribué, modification si l'école ou tous les parcours le sont) présenté comme appliqué par le serveur. Route ajoutée à la table des routes connues |
| `frontend/src/pages/admin/AdminUsersPage.tsx` | Lien « Périmètre » uniquement sur les lignes ADMIN |
| `frontend/src/pages/admin/AdminCoursesPage.tsx`, `hooks/useMyScopes.ts`, `hooks/useScopedPathways.ts`, `utils/scopes.ts` (nouveaux) | Pour un ADMIN : lecture de `/api/admin/me/scopes`, bandeau « Votre périmètre : N école(s) et M parcours », **périmètre vide annoncé comme tel et distinct d'une panne** (« ce n'est pas une panne »), panne de lecture du périmètre avec retry sans masquer la liste serveur. **Création de cours selon le contrat** : « l'ADMIN possède l'école cible ou le parcours cible explicitement fourni » ; toutes les écoles sont proposées avec « (attribuée) » sur les siennes, une école attribuée est choisie par défaut, un parcours attribué facultatif est envoyé en `pathway_id`, et la création est bloquée avec une explication si l'école n'est pas attribuée et qu'aucun parcours n'est choisi. « Nouveau cours » n'est désactivé que sans aucun périmètre. SUPER_ADMIN : aucun appel `/me/scopes`, aucune restriction. La liste et ses compteurs viennent du serveur, l'écran ne les recalcule pas |
| `frontend/src/pages/admin/AdminImportPdfPage.tsx` | Pour un ADMIN, selon le contrat (« une école attribuée ou un parcours attribué ») : toutes les écoles avec « (attribuée) » sur les siennes, parcours facultatif parmi les parcours attribués, analyse bloquée avec explication si l'école n'est pas attribuée et qu'aucun parcours n'est choisi, ou sans aucun périmètre ; **corpus sans cours désactivé** (« Réservé aux super administrateurs »). École choisie toujours issue de la liste, une école attribuée par défaut. L'aperçu envoie `school_id` et `pathway_id` pour un ADMIN, rien pour un SUPER_ADMIN ; l'import envoie `pathway_id` quand il est choisi |
| `frontend/src/services/adminService.ts`, `components/SectionImageField.tsx`, `pages/admin/AdminLessonEditPage.tsx` | `getMyScopes`, `getUserScopes`, `setUserScopes` ; aperçu et import avec cible ; **le téléversement d'image envoie toujours le `course_id` de la leçon éditée** (une seule cible) |
| `frontend/src/utils/pagination.ts` (nouveau), `pages/CatalogPage.tsx` | `allPages` extrait du catalogue pour être partagé, comportement inchangé |
| `frontend/src/types/api.ts` | Types `ScopeGrant`, `AdminScopes`, `AdminScopeReplacement` |
| `frontend/tests/scopes-lot2.test.tsx`, `tests/admin-service-forms.test.ts` (nouveaux) | 19 tests, voir ci-dessous. Aucun test existant modifié |

## Tests exécutés

`npx tsc -b` sans erreur ; `npm run lint` 0 erreur et 1 avertissement existant (`authStore.tsx:98`) ; `npm run test` **80/80** (61 existants inchangés + 19 nouveaux) ; `npm run build` réussi. Les nouveaux tests couvrent : affichage du périmètre, enregistrement seulement après action avec le corps exact, refus 409/422/panne sans perte, retry de chargement, identifiants inconnus et filtre, chargement de 45 parcours, lien « Périmètre » limité aux ADMIN ; catalogue d'ADMIN (bandeau, création avec école attribuée ou parcours attribué et corps envoyé, parcours seul, périmètre vide, panne et retry) et SUPER_ADMIN sans appel ; import PDF d'ADMIN (école attribuée par défaut, parcours, école non attribuée bloquée puis permise par un parcours, corpus désactivé, aucun périmètre) et de SUPER_ADMIN ; contenu exact des formulaires multipart (aperçu, import, média à cible unique) et des routes de périmètres. Limite : happy-dom et services simulés.

## Captures avec API simulée

Chromium sur la build servie en prévisualisation, API interceptée, rôle simulé par un faux `/api/auth/me` : 8 écrans × 1440, 390 et 320 px = 24 captures (`_mesures.json`) : attribution (avant et après enregistrement), liste des utilisateurs, catalogue d'ADMIN avec périmètre et sans périmètre, création de cours dans une école non attribuée, import PDF d'ADMIN avec école et parcours, import sans périmètre. Résultats : `scrollWidth` = `clientWidth` dans les 24 cas, 0 violation axe-core WCAG 2.0/2.1 A/AA, 0 erreur JS. Le navigateur a envoyé le corps réel `{"school_ids":["s1","s2"],"pathway_ids":["p2","p3"]}` au `PUT` simulé et les champs `school_id=s2`, `pathway_id=p3` dans l'aperçu PDF.

## Non vérifié et points à confirmer

- **Aucune vérification contre le vrai serveur** : ni FastAPI, ni PostgreSQL, ni les 404 hors périmètre, ni les 403/409/422 réels. Les messages d'erreur reposent sur le contrat (409 cible non ADMIN, 422 ressource inexistante, 403 rôle insuffisant) et non sur des réponses observées.
- **Backend non validé** (cascades en correction) : rien de ce lot ne doit être considéré comme intégré avant le prochain SHA backend.
- **Correction faite avant publication** : une première version limitait l'ADMIN aux écoles attribuées, ce qui contredisait le contrat (« école cible ou parcours cible explicitement fourni ») ; elle a été remplacée et ses tests réécrits. Le contrat ne dit pas quel `school_id` fournir quand l'ADMIN n'a qu'un parcours : l'écran propose toutes les écoles réelles et laisse le serveur trancher ; à confirmer.
- Le blocage « école non attribuée sans parcours » reproduit une règle du contrat côté interface pour éviter un aller-retour inutile ; le serveur reste l'autorité (un refus serait affiché tel quel).
- Pas de lecteur d'écran, de zoom navigateur réel ni de clavier rejoué pour ce lot ; CI GitHub non consultée. Lots 3 et 4 non commencés.

## Mise à jour : backend `de2be05` et refus 409 (`MSG-20261004-004`)

Le dev lead a remplacé `22d8eef` par **`de2be0569b484f12fe142356b07f6ffa251cbf9c`** pour ces lots (cascades de suppression corrigées ; routes et payloads **inchangés** : le diff de `ROLES_API_CONTRACTS.openapi.json` entre `22d8eef` et `de2be05` est vide, seul le document de contrat a 12 lignes ajoutées). Les écrans ci-dessus restent donc valides contre ce contrat ; ils n'ont toujours pas été exécutés contre ce backend.

Nouveauté côté interface : le serveur refuse désormais en **409** une suppression de cours, de leçon ou de quiz qui détruirait un historique ou une dépendance, et une réaffectation qui toucherait des quiz dépendants. `frontend/src/utils/adminErrors.ts` (`adminRefusal`) distingue suppression refusée (« Rien n'a été supprimé. Dépubliez-le plutôt »), modification refusée (« Rien n'a été modifié »), 404 (hors périmètre) et 403, **rapporte le message du serveur** et ne propose jamais de contourner (pas de nouvelle tentative, pas de suppression des dépendances). Utilisé par les suppressions de cours, de leçon et de quiz, la bascule de publication et l'enregistrement de leçon et de quiz. 4 tests ajoutés (`tests/refusals-409.test.tsx`) : les trois écrans gardent leur contenu, n'appellent la suppression qu'une fois et ne rechargent pas la liste ; suite à **84/84**, tsc, lint (1 avertissement existant) et build réussis. Aucune nouvelle capture : changement de message d'erreur uniquement. Limite : refus simulés, pas de vrai 409 serveur observé.

## Mise à jour : réserves R7 et R8 de la revue (`MSG-20261004-007` de ChatGPT)

- **R8 (cible d'import modifiable après l'aperçu)** : pour un ADMIN, l'aperçu est maintenant lié à la cible analysée (école et parcours). Changer l'école ou le parcours après l'analyse **invalide l'aperçu**, retire le bouton de validation et affiche « La cible de l'import a changé : lancez l'analyse de nouveau ». L'import revérifie aussi la cible (périmètre vide, école non attribuée sans parcours, aperçu périmé) avant d'appeler le serveur, et le résumé avant import affiche le **parcours**.
- **R7 (parcours attribué non publié, panne confondue avec absence)** : `useScopedPathways` charge le catalogue public (qui ne contient que les parcours publiés). Un parcours **attribué mais non publié** reste proposé sous l'étiquette « Parcours attribué non publié (identifiant) » au lieu d'être perdu ; une panne du référentiel est un **état d'erreur avec « Réessayer les parcours »** dans la création de cours et l'import, plus une liste vide silencieuse. Limite assumée : le SUPER_ADMIN ne peut pas encore *choisir* de nouveaux parcours en brouillon à attribuer, faute de référentiel administratif ; `GET /api/admin/pathways` est proposé par le dev lead et **non implémenté**, je ne l'ai pas appelé.
- 5 tests ajoutés dans `tests/scopes-lot2.test.tsx` (analyse, changement de parcours, nouvelle analyse puis import ; changement d'école ; parcours non publié envoyé à l'aperçu ; panne et retry dans l'import et dans la création). Suite à **110/110**, tsc, lint (1 avertissement existant) et build réussis. Pas de nouvelle capture. Limite : services simulés, aucune vérification contre le vrai serveur.
