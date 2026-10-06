# Backend découverte V1

Implémente le [contrat final autorisé](https://github.com/free225-sys/casaAI/blob/bfe0d910f1f015ac75c27a470b64746d432b51d2/docs/contracts/DISCOVERY_V1.md). Aucun frontend, ancien lab KV cache ou service d'inférence modifié. Assemblage recette et revue indépendante restent nécessaires avant toute mise en production.

- GET public : une requête SQL, notions/leçons/cours PUBLISHED, métadonnées seulement, six scènes/registre1, dédoublonnage et no-store ; aucun cache serveur.
- GET référentiel : id/title/status et pagination seulement, ADMIN/SUPER_ADMIN actifs ; aucun lien ou compteur d'utilisation.
- GET/PUT d'une leçon : permissions ContentScopeService, cours partagés protégés ; PUT explicite avec révision, aucune synchronisation via les anciens PUT de leçon.
- Ordre d'écriture : verrou commun des scopes, acteur rechargé/verrouillé, leçon rechargée/verrouillée, références triées verrouillées. Révocation et scopes sont revérifiés avant tout retry idempotent. Ensemble identique →200 ; autre ensemble depuis une révision périmée →409 sans mutation.

## Migration0015 et protection des données

Upgrade insère seulement les IDs absents tokenization/generation/kv-cache, avec les titres du contrat, PUBLISHED sans liaisons. ON CONFLICT DO NOTHING conserve tous les champs/statuts existants. Aucun seed global, publication de cours ou reconstruction de liens.

**Downgrade volontairement non destructif :** conserve les trois références et leurs éventuels usages. Sans marqueur de provenance, supprimer ces IDs pourrait effacer un nœud préexistant ou adopté éditorialement. La révision Alembic revient à0014 mais les données ajoutées restent ; un nouvel upgrade les conserve. Aucun retrait de contenu n'est automatisé.

seed_knowledge_graph est désormais insert-only pour les notions et leurs métadonnées initiales ; il ne réimporte jamais usedIn, même sur une base neuve. Une répétition conserve les choix éditoriaux. **Le seed global des autres contenus reste un outil de bootstrap historique, pas un outil de synchronisation CMS : ne pas le relancer sur une recette éditée.** Aucun seed global exécuté pour ce lot.

## Contrat et vérification

L'export docs/DISCOVERY_API_CONTRACTS.openapi.json vient de l'application réelle et contient les trois chemins/quatre opérations de ce lot avec leurs schémas et erreurs. Depuis backend : python -m scripts.export_discovery_openapi ; l'export interdit les connexions SQL.

Tests dédiés : tests/test_discovery.py, test_discovery_concurrency.py, test_discovery_migration.py. Ils vérifient confidentialité/publication/permissions, ancien PUT préservant les liens, erreurs atomiques, révisions/retries, révocation après attente, suppression concurrente de référence, bootstrap répétable et migration réelle. Tests natifs de concurrence uniquement sur une base dédiée explicitement sélectionnée, connexions distinctes et nettoyage par IDs synthétiques exacts. Ne jamais exécuter une migration sur la base de recette ni reset une base QA. Les commandes/résultats effectifs seront consignés au journal ; cette liste ne prétend pas que les tests sont déjà passés.

## Résultats du 6 octobre 2026

Nouvelle base vide casa_discovery_v1_tests autorisée explicitement à11:56, identité/conteneur/port vérifiés avant toute écriture. Upgrade réel depuis le schéma vide jusqu'à0015 réussi, sans seed global. Tests HTTP via TestClient sur PostgreSQL réel, pas de serveur de recette modifié.

- Passage ciblé des quatre fichiers test_discovery* : **65/65 réussis** après correction de la configuration du seul test de panne500.
- Suite pytest configurée backend/tests complète, base isolée identique : **635/635 réussis**, zéro skip/échec, cinq avertissements de dépendances Starlette/slowapi.
- Export OpenAPI identique à l'application, génération SQL offline sans connexion DB, syntaxe Python et diff check valides.
- Vérifications du runner : base de tests explicitement sélectionnée, zéro compte résiduel ; version et compteurs users/courses/lessons de la QA connue inchangés avant/après. Aucun contrôle large des autres bases ni empreinte de leurs contenus effectués.

Aucun test navigateur, parcours UI réel, CI distante, assemblage frontend/backend ou déploiement effectué. Le downgrade est testé comme opération non destructive, pas comme suppression des données de référence. Revue indépendante et validation de recette encore requises.

## Correctif après revue indépendante : no-store sur les erreurs publiques

La revue statique de df12bac a identifié un écart P3 : une exception inattendue perdait le header porté par le Response normal. Le test de panne500 renforcé l'a reproduit (header absent).

Le correctif est limité à la classe de route du GET public de découverte. Chaque réponse porte no-store ; sur panne inattendue avant réponse, un corps500 générique est envoyé puis l'exception originale est relancée, conservant la remontée serveur sans exposer son détail au client. Les HTTPException gardent leur statut/headers, notamment405 et Allow. Aucune gestion globale des autres routes n'est modifiée. OpenAPI documente le header500 et est réexporté depuis l'application.

Les contrôles couvrent header500, corps sans détail privé, exception originale toujours observable,405 préservé et erreur de catalogue inchangée ; les67 tests ciblés ont réussi. Aucune migration ni changement de données requis. Les résultats de la suite complète et le SHA final sont consignés dans CLAUDE_SYNC.md.
