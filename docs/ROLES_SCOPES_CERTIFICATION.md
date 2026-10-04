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
Une demande unique par couple user/certification ; payload différent : 409.
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
