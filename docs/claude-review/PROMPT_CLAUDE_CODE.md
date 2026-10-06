# Prompt prêt à copier dans Claude Code

Tu interviens comme reviewer fonctionnel et designer UX/UI de CASA AI Institute, plateforme de formation. Je veux une revue argumentée et une proposition de meilleur design, avec visuels avant/après. Ne modifie pas l'implémentation avant ma validation. Le dev lead reste responsable de l'API, des données, de la sécurité, des tests et de la livraison.

## Vérifie la cible avant de travailler

Dépôt `free225-sys/casaAI`, branche `codex/validate-learning-ux`, PR #1. Référence applicative attendue : `d2e9d9a0e22e80ca400684e293818f38b6d7b042` ; référence datée du chantier main : `d0e17ba445c3a49d8a3678230c7d3704c823cc39`. Le HEAD peut inclure le commit de documentation qui t'apporte ce prompt. Lis les instructions de projet applicables, puis relève la branche, le HEAD, l'état Git, la référence main disponible et le diff main/PR. Vérifie que la référence applicative est conservée et explique tout écart. Si tu es sur une autre branche ou si un écart applicatif est inexpliqué, signale-le avant de poursuivre ; ne fais pas de checkout forcé, reset, stash ni remplacement des travaux.

Lis `docs/claude-review/README.md`, `REVIEW_SCOPE.md`, `REPORT_TEMPLATE.md`, `docs/VALIDATION_LEARNING_UX.md` et `docs/NATIVE_TEST_RESULT.json`. Fais l'inventaire du code et des ressources versionnées pertinentes. Confronte les README aux routes et services réels. Le code de la branche PR est la cible, pas main seul : il contient les corrections natives PostgreSQL et de concurrence à préserver.

## Mission fonctionnelle

Analyse les parcours visiteur, apprenant, ADMIN et SUPER_ADMIN : navigation, catalogue/filtres, cours/leçons, progression/reprise, dashboard, badges/notifications, administration du contenu et import PDF. Examine les états de chargement, vide, erreur, succès, accès refusé et changement de route. Pour chaque défaut, indique rôle, préconditions, étapes, attendu/observé, fichiers/lignes au SHA analysé, preuves, impact, priorité et recommandation. Sépare constat reproduit, constat statique, hypothèse et limite. Préserve les contrats API, les rôles, les brouillons, la progression et les invariants de concurrence ; ne suggère pas de contournement pour simplifier une maquette.

## Mission design : proposer, pas seulement critiquer

Propose une direction visuelle cohérente pour l'apprentissage : hiérarchie, navigation desktop/mobile, lisibilité, accessibilité, typographie, palette, espaces, composants et tokens. Pars des choix existants et justifie ce que tu conserves ou changes. Priorise catalogue, leçon, dashboard, administration et import PDF en trois étapes (sélection, analyse/prévisualisation, confirmation/résultat). N'invente pas des fonctions disponibles : marque explicitement toute extension comme proposition avec dépendances à discuter.

Produis pour chacun de ces cinq écrans une comparaison avant/après à contenu et viewport comparables, incluant une variante mobile. L'avant est une capture réelle seulement si tu as pu observer le rendu ; sinon, une reconstruction du code clairement étiquetée « reconstruction, non observée ». L'après est toujours une « maquette proposée, non implémentée ». Fournis des visuels consultables (SVG/PNG ou HTML autonome isolé), pas uniquement du texte. Pour le PDF, montre les trois états du flux. Relie chaque changement aux difficultés observées et explique ses bénéfices, ses compromis et les éléments à valider. Les maquettes ne doivent charger ni services externes ni données privées et ne doivent pas importer les modules de l'application pour exécuter des mutations.

## Environnement et limites

L'architecture actuelle est React/Vite + FastAPI + Alembic + PostgreSQL. Supabase est une cible future de base de données, pas une instruction de réécrire l'application ou de remplacer les contrats FastAPI.

La QA locale de l'utilisateur utilise `http://127.0.0.1:5184` et l'API `http://127.0.0.1:8014`, avec PostgreSQL sur `55432`. Depuis un cloud, ton localhost ne désigne pas le PC utilisateur. N'affirme pas avoir visité cette QA si elle est inaccessible. Ne touche pas aux instances 5173/8000 ni à d'autres projets. Ne lis aucun `.env`, secret ou fichier d'identifiants.

Cette mission ne permet ni migrations, ni seed, ni création de compte, ni mutation de données, ni destruction, ni publication de contenu. Même GET badges peut écrire en base : un intitulé GET ne suffit pas à garantir une lecture seule. Si l'observation dynamique nécessite un nouvel environnement, propose au dev lead un plan isolé (checkout de même SHA, ports libres loopback, configuration dédiée sans secrets existants, base jetable identifiée, données synthétiques et comptes préparés par le dev lead, journal d'IDs, arrêt ciblé). Attends sa préparation et son autorisation avant d'utiliser une session susceptible de muter des données. En attendant, avance sur l'analyse statique et les maquettes isolées ; marque les vérifications dynamiques non effectuées.

Les fichiers rapportent 386 tests backend, dont 6 de concurrence et 16 circuits PDF synthétiques ; 25 contrats mockés séparés et 9 tests React, build/lint réussis avec les limites détaillées. Vérifie ces sources et rapporte leur provenance : ce ne sont pas des tests réexécutés par toi ni une preuve de CI ou de rendu navigateur. N'exécute pas de commande qui peut connecter une base non explicitement autorisée, installer/lancer des services ou modifier le checkout.

## Confidentialité et livrables

Le dépôt est public. N'inclus aucun mot de passe, identifiant de compte, adresse privée, chemin de profil utilisateur, journal interne, donnée personnelle, lien d'email, cahier des charges privé, pièce jointe ou capture privée. « Toutes les ressources » désigne seulement le corpus versionné et le brief non confidentiel. Si le CDC privé manque, précise les décisions qu'il pourrait changer et demande qu'il soit fourni par l'utilisateur dans un canal privé, sans le publier.

Seules écritures autorisées : rapport, registre de preuves et propositions autonomes sous `docs/claude-review/output/`. Ne change ni code applicatif, ni configuration, dépendances, migrations, tests, fichiers d'instructions ou autres documents. N'écrase pas un rapport existant ; utilise un sous-dossier daté si nécessaire. Aucun commit, push, merge, déploiement ou contact d'un tiers.

Utilise le modèle de rapport fourni. Livrer des priorités « bloquant / important / amélioration », une direction recommandée et ses alternatives utiles, un tableau de décisions utilisateur, puis un plan d'implémentation pour le dev lead avec risques, dépendances, tests de non-régression et critères d'acceptation. Finis par les chemins des livrables et la liste des décisions requises. Arrête-toi avant l'implémentation : j'approuve d'abord le design et le périmètre.
