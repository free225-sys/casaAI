# CASA — contrats du chantier rôles, périmètres et validation officielle

Base commune : `a51b626dfc07d77e004d1ec9a88fb39b597381d1`.
Branche backend : `codex/roles-scopes-certification`. Lots backend 1–4 implémentés
et vérifiés ; intégration Claude et recette réelle finale encore ouvertes.
Ce document décrit les contrats actuels ; le journal précise les SHA publiés.

## Décisions utilisateur

Un administrateur ne suit pas de formation. ADMIN gère uniquement le catalogue
attribué par école et/ou parcours. SUPER_ADMIN attribue ces périmètres.
Les labs sont des entraînements. Une certification officielle nécessite une
approbation explicite de CASA Institut. Décision utilisateur validée : SUPER_ADMIN
représente CASA, sans délégation implicite à ADMIN et sans nouveau rôle.
Claude conserve intégralement design, frontend et mises à jour ; ChatGPT fournit
backend, migrations, contrats, tests et revue. Aucun merge ou déploiement.

## Lot 1 — séparation des espaces

Les endpoints de progression, leçons pédagogiques, quiz apprenants, tentatives,
labs soumis, portfolio, badges, onboarding pédagogique et certificats personnels
exigent LEARNER. ADMIN et SUPER_ADMIN reçoivent 403, y compris par URL/API directe.
Authentification, identité, mot de passe, notifications génériques et préférences
restent communs aux comptes actifs. Un compte inactif reçoit 401.
Les anciens acquis sont conservés ; changer de rôle ne supprime aucune donnée.
Les gardes existantes protégeant le dernier SUPER_ADMIN restent actives.

Claude : accueil/menu/profil distincts selon rôle ; ne plus monter le dashboard
apprenant ou appeler badges/progression pour les comptes administrateurs.
Ne pas traiter un 403 comme une session expirée. Les anciens tests prouvant
l'apprentissage ADMIN devront évoluer explicitement, sans suppression d'assertions.

## Lot 2 — attribution (implémenté et testé)

`GET /api/admin/me/scopes` : périmètres du compte administrateur.
`GET /api/admin/users/{user_id}/scopes` : SUPER_ADMIN seulement.
`PUT /api/admin/users/{user_id}/scopes` : SUPER_ADMIN seulement, remplacement
atomique avec payload `{school_ids: string[], pathway_ids: string[]}`.
Réponse : mêmes listes et métadonnées d'attribution (acteur/date).
Ressource inexistante : 422 ; cible non ADMIN : 409 ; rôle insuffisant : 403.
Aucune attribution initiale automatique. ADMIN sans périmètre voit des listes
vides et reçoit 404 sur les objets hors périmètre. SUPER_ADMIN reste global.

Modèle réel : un cours possède une école ; un parcours contient plusieurs cours
via une association many-to-many, sans école propre ; leçons héritent du cours.
Quiz peuvent référencer leçon, cours et/ou compétence (compétence liée à école).
Questions peuvent être partagées entre quiz. Les mutations doivent contrôler
ancien ET nouveau rattachement. Une attribution ne permet jamais de s'attribuer
des droits ni de modifier un objet hors portée indirectement.

**Règle validée par l'utilisateur** : lecture si école effectivement propriétaire
(Course.school_id) attribuée ou au moins un parcours attribué ; mutation si école
propriétaire attribuée ou tous les parcours contenant ce cours attribués.
Une couverture partielle autorise la lecture/aperçu, mais mutation partagée : 409.
Leçons héritent du cours. Les quiz contrôlent tous leurs parents explicites ; une
compétence de la même école qu'un parent autorisé hérite de celui-ci, tandis qu'un
quiz autonome de compétence exige l'attribution de cette école. Le remplacement
ou la suppression d'un quiz ne supprime jamais une question utilisée ailleurs :
remplacement par de nouvelles questions et conservation des questions partagées.

Liste courses/lessons/quizzes : filtrage SQL AVANT total/pagination ; hors scope :
404. Création cours : payload existant plus `pathway_id?: string | null`, réservé
à POST. ADMIN doit posséder l'école cible ou le parcours cible explicitement
fourni ; rattachement créé dans la même transaction. PUT avec pathway_id : 422,
pas d'API d'auto-réaffectation des parcours existants. Changement d'école/cours ou
de parents quiz : ancien ET nouveau scope contrôlés. SUPER_ADMIN garde accès global.

PDF : POST preview-pdf accepte `file`, `school_id?`, `pathway_id?` multipart ; ADMIN
fournit une école attribuée ou un parcours attribué. SUPER_ADMIN peut analyser un
PDF sans cible (analyse seule, aucune importation). POST import-pdf exige file et
school_id réel ; create_course bool par défaut true, pathway_id facultatif. ADMIN
importe dans son école attribuée ou un parcours attribué explicitement fourni.
Association du cours au parcours atomique. Corpus (create_course=false) : SUPER_ADMIN
seul, document rattaché à l'école réelle ; pathway_id avec corpus : 422.

Médias : POST /api/admin/media/images multipart file plus EXACTEMENT un course_id
ou school_id, pour tous les rôles administrateurs. Cours cible exige permission de
mutation (donc couverture totale s'il est partagé), école cible exige attribution
ADMIN. SUPER_ADMIN reste global mais fournit aussi une cible réelle. Métadonnées
school_id/course_id/uploaded_by/date enregistrées dans scoped_media ; pas de faux
rattachement école. Absence/double cible : 422 ; hors scope : 404. Réponse existante
{url, content_type, size_bytes} conservée. Les anciens fichiers restent accessibles,
aucune requalification automatique. La lecture statique des images reste publique.

GET /api/admin/me/scopes renvoie {school_ids, pathway_ids, grants, global_access}.
Chaque grant contient school_id, pathway_id, assigned_by UUID|null, assigned_at ISO.
PUT remplace atomiquement les affectations, doublons d'entrée normalisés ; même
ensemble répété conserve les métadonnées. Listes par défaut vides, chacune ≤100.
La révocation sérialise avec les mutations de contenu par verrou transactionnel.
Les menus/frontend ne constituent jamais la source d'autorisation.


Claude : prévoir gestion des périmètres dans l'espace SUPER_ADMIN, et catalogue
administratif limité par les réponses serveur, compteurs compris.

## Lot 3 — certification officielle (implémenté et testé)

Le résultat d'un quiz/lab ne délivre plus automatiquement de certificat.
`POST /api/courses/{course_id}/certificate` ne doit jamais émettre automatiquement
un nouveau certificat : retourne 409 et demande une décision CASA. Un certificat
historique déjà existant est renvoyé à son propriétaire avec provenance
`LEGACY_AUTOMATIC`, identifiant/date/score inchangés. GET historique reste disponible.
Les réponses d’éligibilité ajoutent `official_decision_required: true` : calcul
indicatif, aucune approbation implicite. Les nouvelles demandes portent sur le
catalogue Certification ; aucune conversion automatique cours→Certification.

`POST /api/me/certification-requests` LEARNER :
`{certification_id: string, evidence_ids: UUID[], statement: string}`.
`GET /api/me/certification-requests` et `GET /api/me/certification-requests/{id}` :
propres demandes seulement, 404 si autre propriétaire.
`GET /api/admin/certification-requests` et détail : SUPER_ADMIN seulement.
`POST /api/admin/certification-requests/{id}/decision` :
`{decision: "APPROVED" | "REJECTED", reason: string}`.
Réponses : HTTP 200 pour création ou répétition idempotente de demande.
Un dossier SUBMITTED ou APPROVED au maximum par couple user/certification ; les REJECTED restent historiques. Nouveau dossier corrigé après refus selon le protocole previous_request_id ci-dessous ; payload différent pour un retry : 409.
États : SUBMITTED → APPROVED ou REJECTED, décision terminale ; même décision ET
même motif répétés idempotents, changement de décision ou motif : 409.
Pas de réouverture automatique après refus. Motif et statement non blancs, ≤10000
caractères ; evidence_ids ≤100, dédupliqués. Certification publiée requise ; preuves
appartenant au demandeur, sinon 404. Copies des champs des preuves conservées au
moment de la demande pour examen stable : evidence_snapshot. Les champs de décision
fournis par le client apprenant ne sont pas appliqués. Une approbation exige encore
un demandeur LEARNER actif et une certification publiée (sinon 409).
Listes : {items, total, limit, offset}, limit 1..100 défaut20, offset≥0. File admin
filtrable par `state=SUBMITTED|APPROVED|REJECTED` ; état invalide 422.
Objet : id UUID, user_id UUID, certification_id, statement, evidence_ids UUID[],
evidence_snapshot objets {id,title,context,problem,role,deliverable,result,metrics,feedback},
status, submitted_at ISO, decided_by UUID|null, decided_at ISO|null, reason|null,
official_certificate_id UUID|null. Pas de lien de téléchargement PDF inventé. APPROVED produit une émission
officielle unique dans la même transaction. Acteur, date, motif et identifiant
d'émission sont stockés. Aucune auto-approbation, score client ou permission ADMIN.
L'éligibilité automatique est indicative, pas une décision officielle CASA.
Les certificats existants restent historiques, sans révocation ni requalification.
Leurs réponses devront distinguer explicitement leur provenance historique.

Claude : distinguer entraînement, éligibilité, demande et décision CASA ; file
d'examen SUPER_ADMIN et historique personnel, selon schémas effectivement publiés.

## Lot 4 — aperçu et publication (implémenté et testé)

GET dédiés `/api/admin/preview/lessons/{id}` (AdminLessonOut),
`/api/admin/preview/lessons/{id}/document` (LessonDocumentOut),
`/api/admin/preview/quizzes/{id}` (AdminQuizOut, corrigé administrateur inclus),
autorisés selon périmètre, sans appel aux services de progression/badges.
Pas de tentative persistante ni certificat depuis l'aperçu. Les objets publiés
ne sont accessibles aux apprenants que si leurs parents pertinents sont publiés.
L'aperçu peut lire les brouillons autorisés. Aucun effet de bord en GET d'aperçu.
Refus LEARNER : 403 ; ressource absente/hors scope ou document absent : 404.
Leçons, quiz et labs liés ne sont publics/apprenants que si tous leurs parents
explicites leçon/cours sont publiés. Les historiques conservent leurs lignes,
avec is_available=false pour les leçons dont le cours est dépublié.
POST labs/submit ignore désormais score client (nouveau résultat score=null) ;
completed signifie entraînement soumis, jamais certification officielle. Les anciens
scores de lab restent conservés.

## Migration et preuves exigées

Migration additive et réversible, cible de tests supplémentaire explicitement
vérifiée avant DDL ; jamais migration/reset de QA ou de base préexistante de projet.
Ne pas supprimer les historiques. Downgrade signale la perte des nouvelles
attributions/demandes, pas celle des données historiques antérieures.
Tests positifs/négatifs par rôle, statut inactif, ownership/périmètres, objets
partagés, changements d'attribution, aperçu sans écriture, émission approuvée
seulement, idempotence/concurrence et dernier SUPER_ADMIN. Suites existantes à
rejouer ; attentes anciennes incompatibles rapportées explicitement.
Chaque lot publie routes/payloads/erreurs réellement implémentés et preuves.
La livraison exige ensuite intégration Claude et recette navigateur réelle.


## Publication du Lot 1 backend

Implémenté : `require_learner` sur toutes les routes pédagogiques personnelles
listées au Lot 1, y compris leurs lectures. Préférences GET/PATCH et notifications
GET restent communes ; compte/sécurité inchangés. Refus 403 pour staff, 401 pour
compte inactif. 61 tests PostgreSQL dédiés réussis sur base supplémentaire isolée.
Aucune migration requise pour ce lot ; aucun acquis historique supprimé.
Périmètres, nouveaux flux CASA et aperçu ne sont pas livrés par ce premier lot.
Leur code et leurs migrations restent séparés, en cours de vérification.


## Validation finale backend et migrations

499 tests PostgreSQL réussis, dont 110 nouveaux (61 séparation, 29 périmètres/aperçu,
16 décisions CASA, 4 concurrences governance) et 389 existants ; 25 contrats sans SQL
réussis séparément. Dix scénarios de concurrence : six existants + quatre nouveaux,
deux connexions PostgreSQL indépendantes. TestClient en processus, pas navigateur ni
recette HTTP réseau d'intégration frontend. Avertissements Starlette/slowapi existants.

Migrations 0011 (attributions/demandes/émissions), 0012 (défauts UUID), 0013 (médias)
additives, appliquées exclusivement à la base supplémentaire de tests, cible vérifiée
avant DDL. 0012 corrige le défaut UUID trouvé au premier rejeu 0011 ; aucune migration
QA ou données historiques modifiées. Downgrade supprime seulement nouvelles tables/
défauts ; export obligatoire des nouvelles demandes/émissions/affectations avant
retour arrière, aucun downgrade réel ou reset exécuté. Anciens fichiers médias et
certificats restent intacts. Ne pas appliquer ces migrations à une stack existante
sans autorisation de livraison.

Anciennes attentes explicitement adaptées après observation de 18 échecs : head
0010→0013 (1 test), 16 fixtures PDF roundtrip + 1 aperçu nécessitent maintenant école
attribuée et school_id multipart. Acteur CASA synthétique et attributions explicites,
assertions de contenu/rapport/arbre/import/lecture conservées. Les gardes de tests
natifs/concurrence utilisent CASA_TEST_DATABASE explicite en gardant host/port/user ;
aucun reset ni changement système. Données fixtures transactionnelles annulées ;
concurrence nettoie uniquement ses IDs synthétiques propres.

Pour Claude : intégrer les lots 2–4 sur ces contrats seulement après SHA publié.
Le design et les interfaces restent intégralement de sa responsabilité. Tests et
recette finale contre frontend intégré + backend réel encore requis ; pas de merge,
déploiement, nouvelle PR ou certificat réel délivré par ce chantier.

Schémas OpenAPI exacts (références transitives) : [ROLES_API_CONTRACTS.openapi.json](ROLES_API_CONTRACTS.openapi.json).
Downgrade généré et vérifié hors ligne 0013→0010 : seules les nouvelles structures
sont supprimées ; aucune connexion ni exécution DDL de downgrade sur la base.

## Correctif de suppressions et conservation ciblée (après 22d8eef)

Une suppression administrative n'est pas une opération d'archivage. Avant de supprimer physiquement un cours ou une leçon, le serveur contrôle tous les quiz dépendants (y compris brouillons, parents mixtes et dépendance indirecte par la leçon) avec les droits d'écriture effectifs. Une dépendance non modifiable entraîne **409**, sans divulguer son identité. Les droits ne sont pas élargis.

Les suppressions de cours avec certificat historique, critère de certification, rattachement parcours/prérequis ou média rattaché sont refusées par **409**. Les suppressions de leçons avec progression, lab ou document rattaché sont également refusées, ainsi que celles de leurs cours parents. Les suppressions de quiz avec tentatives sont refusées, pour ADMIN comme SUPER_ADMIN, même si l'ancien apprenant est devenu administrateur. Préférer la dépublication ; aucun nettoyage historique automatique ni migration destructive.

Une réaffectation de `Course.school_id` ou `Lesson.course_id` avec quiz dépendants est refusée (**409**) : elle pourrait modifier leur périmètre ou leur couverture implicite de compétence. Les modifications avec parent inchangé restent possibles, ainsi que les déplacements autorisés sans quiz dépendant. La réaffectation complexe de dépendances nécessite un workflow distinct, non inventé ici.

La sauvegarde d'un quiz remplace son assemblage courant, mais conserve inchangées les anciennes questions/options référencées par des réponses, même sans autre quiz courant. La purge protège aussi les références historiques passant seulement par `selected_option_id`. Verrous de lignes sur parents, quiz, questions et options concernés avant vérification/destruction ; insertion FK concurrente bloquée puis, si la cible a été supprimée, rejetée plutôt que validée avec référence perdue. Aucune réponse déjà validée n'est purgée par ces chemins.

Portée de la preuve : opérations administratives cours/leçons/quiz de ce correctif, historique de progression/tentatives/réponses/certificats concernés et comptes promus. Ce n'est pas une garantie de conservation de toutes les données par toute opération de l'application : suppression d'utilisateur, autres opérations de catalogue et concurrence d'une décision CASA avec suspension/changement de rôle ne sont pas validées par ce correctif. Aucun mécanisme de versionnement intégral du quiz ni instantané de tous ses anciens métadonnées n'est ajouté.

## Extension implémentée : nouveau dossier après refus, identité CASA et référentiel de parcours

Décision utilisateur du 4 octobre : autoriser une nouvelle demande corrigée après refus, historique conservé. Une décision reste terminale pour son dossier ; ce n'est pas une réouverture. Aucun nouveau dossier après approbation.

### Dépôt et retry réseau

POST `/api/me/certification-requests` reste réservé à LEARNER actif. Champs inchangés `certification_id`, `statement`, `evidence_ids`, plus `previous_request_id: UUID | null` facultatif. Pour le premier dépôt, omettre ce champ ou envoyer null. Pour une correction, fournir l'identifiant du **dernier dossier refusé sans successeur** du même utilisateur et de la même certification.

- Retry initial sans previous_request_id : même déclaration et mêmes IDs de preuves normalisés → même dossier initial, même s'il a depuis été décidé ; payload différent → 409. Une absence de lien ne crée jamais automatiquement un nouveau dossier après refus.
- Correction explicite : précédent réel, possédé, même certification, REJECTED et sans successeur ; aucune autre demande SUBMITTED/APPROVED. Crée une nouvelle ligne SUBMITTED avec nouveau UUID, nouveau dépôt et nouvel instantané ; ne modifie aucune ancienne ligne, preuve ou décision.
- Retry de correction : même previous_request_id et même payload → même successeur, même s'il a depuis été décidé ; payload différent → 409. Réutiliser un ancien refus ayant déjà un successeur ne crée jamais une branche.
- Au moins déclaration, sélection de preuves ou contenu figé doit avoir été corrigé par rapport au refus. Même déclaration et mêmes preuves inchangées → 409 ; une preuve existante réellement mise à jour peut être recopiée avec les mêmes IDs sans toucher l'ancien instantané.
- Précédent étranger/inexistant ou d'une autre certification → 404. Précédent SUBMITTED/APPROVED, absence de correction, autre dossier actif/approuvé, ou retry différent → 409. Certification non publiée/preuve étrangère → 404 ; corps invalide → 422. ADMIN/SUPER_ADMIN ne déposent pas de demandes personnelles.

Toutes les réponses de demandes ajoutent previous_request_id, null pour les anciennes et premières demandes. GET `/me/certification-requests` reste un historique paginé, **toutes** les lignes, non une liste d'une ligne par certification. Tri date de dépôt décroissante puis UUID. Utiliser les liens previous_request_id pour déterminer le dernier dossier ; ne pas confondre le retry d'un ancien dossier avec une création. Le frontend doit proposer la correction seulement sur le refus courant, puis conserver les dossiers précédents en lecture seule.

Soumission et décision partagent un verrou transactionnel sur utilisateur/certification. Le serveur revérifie rôle/statut actuels sous verrou de ligne pour déposer, et rôle/statut/publication avant approbation ; instantané de preuves possédées lu sous verrou. Une approbation crée toujours un seul reçu pour son dossier. Les décisions/motifs anciens ne sont jamais remplaçables et une décision idempotente ne réémet aucun reçu. La DB impose en plus une seule ligne non-REJECTED par paire et un seul successeur par précédent.

### Migration 0014 et historique

Migration additive 0014 : colonne previous_request_id nullable (anciens dossiers inchangés), référence self-FK différée sans suppression du précédent, unicité de successeur, index unique partiel sur SUBMITTED/APPROVED ; remplacement de l'ancienne unicité de paire. Aucune suppression/mise à jour des lignes historiques, aucune migration des anciens certificats. Appliquée uniquement à la base supplémentaire vérifiée. Downgrade refuse explicitement si plusieurs dossiers historiques existent pour une paire ; **ne jamais supprimer des refus pour forcer ce retour**. Aucun downgrade réellement exécuté dans cette tâche.

### Nom lisible CASA

Liste, détail et réponse de décision sous `/api/admin/certification-requests` utilisent AdminCertificationRequestOut et ajoutent `applicant_display_name: string | null`. Nom actuel composé de User.first_name/last_name, déjà autorisés au SUPER_ADMIN par les API utilisateurs ; aucun email/statut/rôle ajouté. Fallback user_id si null/vide. La liste charge les noms par jointure SQL, sans lookup frontend par demande et sans N+1 ; détail/décision ont lecture bornée. Réponses /me inchangées sur cette identité, aucune identité d'autrui exposée aux apprenants ou ADMIN. Un changement de nom peut changer ce libellé, pas l'instantané du dossier ni sa décision.

### Référentiel administratif de parcours

GET `/api/admin/pathways?limit=20&offset=0`, ADMIN/SUPER_ADMIN actifs. Réponse `{items:[{id,title,status}],total,limit,offset}` ; limit 1..100, offset >=0. SUPER_ADMIN : tous statuts. ADMIN : seulement les parcours **explicitement attribués**, tous statuts, sans inférence à partir d'une école ou d'un cours. Filtrage avant total/pagination ; ordre title/id. LEARNER 403, anonyme/inactif 401. Catalogue public inchangé : brouillons non exposés. Utiliser ce référentiel pour les attributions SUPER_ADMIN et les titres/cibles ADMIN, avec panne/retry explicites.

Pour créer avec seul scope parcours : school_id est une école réelle choisie comme propriétaire du nouveau cours, pathway_id le parcours explicitement attribué ; create_course=true en PDF. Aucun champ school_id de Pathway n'existe et aucun scope école n'est ajouté. Les administrateurs de l'école propriétaire conservent leurs droits sur ses cours.

### Validation de l'extension

Suite complète de travail : 542 tests backend + 25 contrats sans SQL, tous réussis (567), cinq avertissements de dépendances. Dix-neuf nouveaux cas : redépôt/historique/retries/ownership, nom administratif et coût de requêtes constant, référentiel DRAFT borné, unicité DB native, double dépôt corrigé concurrent (identique et conflit), retry contre approbation, refus concurrents après approbation, approbation bloquée puis refusée après suspension/promotion concurrente du demandeur. Les tests précédents restent présents, seule l'attente du head migratoire passe de 0013 à 0014. Premières préparations corrigées : cache d'authentification différent dans la mesure SQL et date serveur now() identique au sein de la transaction de test ; dépôt daté explicitement au moment de sa création. Cible supplémentaire vide et QA inchangée après les suites. Publication finale exige vérification du commit propre et son SHA dans CLAUDE_SYNC.md.

### Révocation concurrente de l'examinateur CASA

L'autorisation SUPER_ADMIN obtenue avant une attente de verrou ne suffit plus à décider. Après les verrous de paire et de dossier, la route recharge l'examinateur avec populate_existing et verrouille sa ligne User jusqu'au commit/rollback. Compte supprimé ou inactif : 401 avec WWW-Authenticate ; rôle actuel différent de SUPER_ADMIN : 403. Ces contrôles précèdent approbation, refus et réponse idempotente d'une décision terminale. Une révocation déjà validée pendant l'attente interdit donc la décision sans modifier dossier ni reçu. Si la décision a déjà verrouillé l'examinateur, UPDATE/DELETE attend son commit ; une révocation ultérieure ne réécrit pas la décision historique. La suppression conserve le comportement FK existant decided_by SET NULL.

Pour une approbation, examinateur et demandeur sont verrouillés dans l'ordre stable de leurs UUID, puis les conditions du demandeur et de publication restent vérifiées. Cela évite un interblocage de deux examens réciproques sur des dossiers déposés avant promotion. Aucun nouveau rôle, endpoint, champ, migration ou droit ; OpenAPI v2 inchangée après régénération sans connexion SQL.

Reproduction avant correction : examinateur authentifié puis bloqué sur le verrou de paire, suspension validée par AdminUserService sur une autre connexion, ancienne route renvoyant 200 avec APPROVED et reçu officiel. Après correction, 28 nouveaux tests PostgreSQL isolés couvrent suspension/rétrogradation/suppression, attentes sur verrou de paire et ligne examinateur, approbation/refus/rejeu terminal, deux ordres de révocation et décision, examens réciproques ; les approbations concurrentes existantes passent toujours. Suite complète : 570 backend + 25 contrats = 595 réussis, cinq avertissements de dépendances ; fixtures exactes nettoyées, cible supplémentaire à zéro utilisateur et QA inchangée. Cette validation concerne la route de décision CASA et les mutations User correspondantes, pas une revue exhaustive de toutes les routes administratives.
