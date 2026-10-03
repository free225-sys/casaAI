# CASA — contrats du chantier rôles, périmètres et validation officielle

Base commune : `a51b626dfc07d77e004d1ec9a88fb39b597381d1`.
Branche backend : `codex/roles-scopes-certification`. Statut : contrats proposés,
implémentation par lots ; aucune livraison ou intégration frontend encore validée.

## Décisions utilisateur

Un administrateur ne suit pas de formation. ADMIN gère uniquement le catalogue
attribué par école et/ou parcours. SUPER_ADMIN attribue ces périmètres.
Les labs sont des entraînements. Une certification officielle nécessite une
approbation explicite de CASA Institut. Proposition conservatrice : SUPER_ADMIN
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

## Lot 2 — attribution (contrats prévus, non encore disponibles)

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

**Arbitrage ouvert avant fixation** : cours partagé entre parcours ; proposition
de lecture si au moins un parcours attribué, mutation seulement si école attribuée
ou tous les parcours couverts. Questions partagées : remplacement sans suppression
des questions utilisées ailleurs, ou mutation réservée SUPER_ADMIN tant que le
contrat d'édition ne sait pas les isoler. Import corpus sans cours et upload média
sans rattachement doivent être refusés à ADMIN ou recevoir une cible explicite
autorisée. Ne pas implémenter de contournement global.

Claude : prévoir gestion des périmètres dans l'espace SUPER_ADMIN, et catalogue
administratif limité par les réponses serveur, compteurs compris.

## Lot 3 — certification officielle (contrats prévus)

Le résultat d'un quiz/lab ne délivre plus automatiquement de certificat.
`POST /api/courses/{course_id}/certificate` ne doit jamais émettre automatiquement
un nouveau certificat ; contrat de transition à préciser dans le lot.

`POST /api/me/certification-requests` LEARNER :
`{certification_id: string, evidence_ids: UUID[], statement: string}`.
`GET /api/me/certification-requests` et `GET /api/me/certification-requests/{id}` :
propres demandes seulement, 404 si autre propriétaire.
`GET /api/admin/certification-requests` et détail : SUPER_ADMIN seulement.
`POST /api/admin/certification-requests/{id}/decision` :
`{decision: "APPROVED" | "REJECTED", reason: string}`.
États : SUBMITTED → APPROVED ou REJECTED, décision terminale ; même décision
répétée idempotente, décision contradictoire 409. APPROVED produit une émission
officielle unique dans la même transaction. Acteur, date, motif et identifiant
d'émission sont stockés. Aucune auto-approbation, score client ou permission ADMIN.
L'éligibilité automatique est indicative, pas une décision officielle CASA.
Les certificats existants restent historiques, sans révocation ni requalification.
Leurs réponses devront distinguer explicitement leur provenance historique.

Claude : distinguer entraînement, éligibilité, demande et décision CASA ; file
d'examen SUPER_ADMIN et historique personnel, selon schémas effectivement publiés.

## Lot 4 — aperçu et publication

Prévoir des GET dédiés `/api/admin/preview/lessons/{id}` et quiz associés,
autorisés selon périmètre, sans appel aux services de progression/badges.
Pas de tentative persistante ni certificat depuis l'aperçu. Les objets publiés
ne sont accessibles aux apprenants que si leurs parents pertinents sont publiés.
L'aperçu peut lire les brouillons autorisés. Aucun effet de bord en GET d'aperçu.

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
