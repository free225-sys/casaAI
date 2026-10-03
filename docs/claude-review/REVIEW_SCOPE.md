# Périmètre et critères de la revue

## Contrat de travail

La revue porte sur la branche PR corrigée ; relever son SHA et comparer aux références du [README](README.md). Claude analyse et propose. L'utilisateur valide la direction et le périmètre ; le dev lead décide de l'implémentation technique et conduit sécurité, données, tests et livraison. Écritures limitées aux rapports et maquettes dans `output/`. Aucun lancement de runtime, mutation de données ou changement applicatif n'est implicitement autorisé par les parcours ci-dessous.

## Parcours à couvrir

Les chemins proviennent de [App.tsx](../../frontend/src/App.tsx), des [routes API](../../backend/app/api/) et des services. Revalider au SHA étudié. Les contrôles dynamiques qui impliquent une session ou une écriture attendent un environnement et une autorisation du dev lead.

| Parcours / rôle | Écrans et code de départ | Questions et preuves attendues |
| --- | --- | --- |
| Visiteur | `/`, `/login`, `/register`, `/catalog` ; `HomePage`, `Nav`, pages auth | Orientation, action principale, recherche/filtres Cours/Parcours/Labs, retours d'erreur, passage à la connexion ; la création de compte reste à analyser statiquement |
| Découverte de contenu | `/courses/:courseId`, `/pathways/:pathwayId`, `/labs/:labId` | Structure, niveau/durée, plan du cours, contenu publié seulement, liens et états vide/erreur |
| Apprenant : leçon | `/app/lessons/:lessonId` ; `LessonPage`, `LessonDocumentView`, `ProgressRail`, `RevealSection` | Sommaire et ancres, profondeur de lecture, contenu PDF, progression/reprise, prochain cours/leçon, navigation entre leçons sans réponse périmée ni état conservé |
| Apprenant : dashboard | `/app/dashboard` ; `DashboardPage`, `AchievementBadges`, `NotificationBell` | Prochaine action, progression intelligible, badge calculé lors de GET `/api/me/badges`, notification/acquittement, préférences et états vides |
| Apprenant : parcours annexes | `/app/profile`, `/app/quizzes`, `/app/portfolio`, `/app/certifications` | Cohérence et découvrabilité, limites réelles des fonctions ; approfondir si un problème affecte le parcours principal |
| ADMIN / SUPER_ADMIN : contenu | `/admin/courses`, `/admin/courses/:courseId`, édition leçon et quiz | Repérage brouillon/publié, listes/pagination, formulaires et erreurs ; pas de publication ni d'édition réelle pendant cette revue |
| ADMIN / SUPER_ADMIN : PDF | `/admin/import-pdf` ; `AdminImportPdfPage`, service admin, moteur PDF backend | Sélection fichier/école, analyse et arbre de prévisualisation, incertitudes, confirmation/import/résultat ; trois étapes visuelles cohérentes avec les contrats réels |
| SUPER_ADMIN seulement | `/admin/users`, `/admin/progress`, `/admin/certifications` | Recherche, filtres accessibles, actions explicites et garde-fous ; ADMIN contenu ne doit pas obtenir ces accès |

Invariants à préserver : bornes de progression, complétion idempotente sans doublon, séparation utilisateur, exclusion des brouillons, gestion de la leçon suivante et des réponses tardives ; auto-suppression/suspension/rétrogradation en 400, protection du dernier SUPER_ADMIN actif en 409, refus de rôle en 403. Les verrous transactionnels PostgreSQL de la branche ne sont pas une optimisation visuelle à supprimer. GET badges persiste badge/notification ; l'import PDF crée des lignes. Ne pas appeler ces routes sur une base existante sous prétexte de lecture.

## Matrice de preuve

| Niveau | Ce qu'il permet de conclure | Ce qu'il ne prouve pas |
| --- | --- | --- |
| Code au SHA, fichier et lignes | Contrat, état géré ou risque déduit ; marquer « analyse statique » | Rendu, reproduction utilisateur ou résultat HTTP réel |
| Rapport de tests versionné | Résultat historique et périmètre indiqué, avec provenance | Réexécution par Claude, CI actuelle ou état de la base actuelle |
| Contrats mockés / React happy-dom | Cas couverts avec persistance/services substitués | PostgreSQL réel, rendu navigateur ou accessibilité complète |
| Tests natifs rapportés | Parcours PostgreSQL et scénarios explicitement couverts | Charge, toutes les courses concurrentes ou PDF clients |
| Observation dynamique autorisée | Résultat exact, rôle, viewport, environnement, étapes et preuve expurgée | Généralisation à tous les rôles et états |
| Capture réelle | Rendu observé au viewport et à l'état documentés | Fonctionnement de toutes les actions visibles |
| Reconstruction / maquette | Comparaison de disposition ou intention de design | Rendu existant observé, fonctionnalité implémentée ou test réussi |

Pour chaque ligne de parcours, inscrire : analysé statiquement / observé dynamiquement / non vérifié, source, preuve manquante et impact sur la confiance. Les captures réelles et les maquettes portent une légende visible ; aucun avant reconstruit ne sera nommé « capture réelle ». Rapporter 386 backend et 25 contrats séparément, pas comme un total de scénarios SQL. Les 9 React ne constituent pas une recette visuelle. Les sources sont [rapport](../VALIDATION_LEARNING_UX.md) et [JSON](../NATIVE_TEST_RESULT.json).

## Critères de design et livrables visuels

| Dimension | Critères d'évaluation proposés |
| --- | --- |
| Orientation | Navigation stable par rôle, repère de page, retour au catalogue/cours et reprise d'apprentissage explicites |
| Hiérarchie | Une action principale claire par état, informations pédagogiques lisibles, administration dense mais scannable |
| Mobile | Comparaisons à 390 px et contrôle à 320 px ; éviter débordements et actions masquées, traiter tableaux/sommaires/navigation ; desktop de référence à 1440 px |
| Accessibilité | Parcours clavier, focus visible, noms accessibles, ordre de lecture, contrastes mesurés si possible, statuts sans couleur seule, zoom et réduction des animations ; indiquer les contrôles non réalisés |
| Système visuel | Partir des tokens existants dans `index.css` (palette Aurore bleu/jaune, couleurs sémantiques, typographie, espaces, rayons, ombres, mouvement) ; proposer des tokens cohérents plutôt que des exceptions par écran |
| États et feedback | Chargement, vide, erreur, succès, désactivation et nouvelle tentative ; messages actionnables et confirmation des actions sensibles |
| Fidélité produit | Utiliser uniquement les données/actions existantes ; isoler les extensions proposées et leurs dépendances API/produit |

Minimum : comparatifs avant/après pour catalogue, leçon, dashboard, admin et PDF, chacun avec desktop et mobile. Pour le PDF, représenter sélection, prévisualisation et confirmation/résultat. Si inaccessible : avant reconstruit du code, explicitement déclaré. Livrer visuels autonomes sous `output/`, un index légendé, une proposition de tokens/composants et les raisons/compromis de chaque changement. Pas de fausses captures, de promesse d'IA/tuteur déjà disponible ou de contenu privé.

## Priorisation et transfert

- **Bloquant** : empêche un parcours essentiel ou compromet un invariant ; fournir un scénario précis et une preuve ou signaler l'hypothèse à confirmer par le dev lead.
- **Important** : friction fréquente, compréhension ou accessibilité dégradée avec solution de contournement.
- **Amélioration** : cohérence, confort ou polish sans blocage du parcours.

Séparer sévérité, confiance, effort et dépendances. Proposer un ordre d'implémentation après validation : fondations de design, composants réutilisables, écrans prioritaires, puis vérification des parcours. Les critères d'acceptation et les tests appropriés reviennent au dev lead. Ne pas exécuter migrations/seed, créer des comptes, lancer des services ou rejouer des tests qui écrivent ; fournir le plan de vérification à la place.
