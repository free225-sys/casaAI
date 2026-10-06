# Revue fonctionnelle et propositions de design pour Claude Code

Ce dossier prépare une revue de CASA AI Institute, plateforme de formation. Claude Code examine le fonctionnement et propose une direction visuelle cohérente, avec comparaisons avant/après et justifications. Toute modification de l'application attend la validation de l'utilisateur. Le dev lead garde la responsabilité de l'API, des données, de la sécurité, des tests et de la livraison.

## Commencer

1. Ouvrir le dépôt `free225-sys/casaAI`, branche `codex/validate-learning-ux` (PR #1).
2. Lire le [prompt prêt à copier](PROMPT_CLAUDE_CODE.md), le [périmètre](REVIEW_SCOPE.md) et le [modèle de rapport](REPORT_TEMPLATE.md).
3. Vérifier le SHA, l'état du checkout et l'écart avec main avant toute analyse. Produire uniquement le rapport et les propositions dans `docs/claude-review/output/`.

## Provenance et cible

Préparation le 3 octobre 2026. Référence du chantier de base sur main : `d0e17ba445c3a49d8a3678230c7d3704c823cc39`. Référence applicative de la branche PR : `d2e9d9a0e22e80ca400684e293818f38b6d7b042`. Le commit ajoutant ce dossier peut être un descendant de cette référence ; documenter le HEAD exact et vérifier les écarts intervenus depuis. La branche PR est la cible de la revue : elle conserve les corrections PostgreSQL, de concurrence et de progression absentes du chantier de base.

Ces références sont datées, pas une affirmation sur le dernier main au moment de la future revue. Vérifier les références distantes disponibles ; si leur fraîcheur est inconnue, le signaler sans changer de branche ni réinitialiser le checkout.

## Ressources versionnées

| Ressource | Usage |
| --- | --- |
| [README du dépôt](../../README.md), [backend](../../backend/README.md), [frontend](../../frontend/README.md) | Architecture et consignes de projet ; les commandes de mutation ne sont pas autorisées par cette mission |
| [Rapport de validation](../VALIDATION_LEARNING_UX.md), [résultat structuré](../NATIVE_TEST_RESULT.json) | Preuves historiques et limites |
| [Routes React](../../frontend/src/App.tsx), [pages](../../frontend/src/pages/), [composants](../../frontend/src/components/), [styles et tokens](../../frontend/src/index.css) | Écrans, navigation et système visuel existants |
| [Services frontend](../../frontend/src/services/), [types API](../../frontend/src/types/api.ts) | Contrats consommés par l'interface |
| [Routes API](../../backend/app/api/), [services métier](../../backend/app/services/), [modèles](../../backend/app/models/) | Rôles, progression, badges, import PDF et invariants |
| [Schéma](../../db/schema.sql), [migrations](../../backend/migrations/) | Contexte de données en lecture seule |
| [Tests React](../../frontend/tests/), [contrats mockés](../../backend/contract_tests/), [tests backend](../../backend/tests/) | Couverture et scénarios ; distinguer mock, PostgreSQL et navigateur |

Les sources rapportent 386 tests backend (350 existants, 14 parcours natifs, 6 scénarios de concurrence et 16 circuits PDF synthétiques), 25 contrats à persistance substituée séparés, 9 tests React, build réussi et lint sans erreur avec un avertissement. Ils ne prouvent ni une CI actuelle ni une recette visuelle. Vérifier les chiffres dans les fichiers ; ne pas présenter ces résultats comme réexécutés par Claude.

## Contexte de recette, sans données privées

Une instance QA séparée existe sur le PC de l'utilisateur : frontend `http://127.0.0.1:5184`, API `http://127.0.0.1:8014`, PostgreSQL local sur le port `55432`. Ces adresses désignent ce PC et ne sont pas accessibles depuis un environnement cloud Claude. Elles ne sont ni une URL publique ni une preuve que Claude a ouvert l'application. Les lanceurs, comptes, mots de passe, journaux locaux et données de recette ne font pas partie de ce dossier public.

« Toutes les ressources » signifie ici le code, les rapports versionnés et ce brief produit non confidentiel. Les cahiers des charges privés, pièces jointes et captures privées doivent être fournis séparément par l'utilisateur si nécessaires ; leur absence constitue une limite à indiquer. Ne pas les rechercher dans d'autres projets ni les publier.

## Livrables et validation

Attendus : rapport exploitable, inventaire des preuves, propositions visuelles avant/après desktop et mobile, tokens/composants proposés, recommandations classées, décisions à faire valider et plan de transmission au dev lead. Les maquettes restent isolées dans `output/` et ne remplacent aucun écran. Aucun commit, push, merge ou déploiement n'est demandé à Claude.
