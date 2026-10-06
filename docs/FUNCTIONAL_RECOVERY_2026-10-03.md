# Corrections fonctionnelles après revue UX

3 octobre 2026. Branche `codex/validate-learning-ux`, PR draft #1. Base de ce lot : `65bcde79f66af42553951fcfaa7fa7e656636114`. L'utilisateur a approuvé les corrections fonctionnelles, puis l'intégration écran par écran d'« Aurore lisible ». Ce lot couvre les corrections indépendantes des maquettes ; il ne constitue pas l'intégration complète du design.

## Comportement corrigé

- Leçon : échec de complétion annoncé avec nouvelle tentative manuelle, statut et pourcentage restaurés depuis POST start, distinction entre lecture de la page et progression enregistrée. Une réponse start ancienne ne peut pas annuler une complétion. Les réponses obsolètes après changement de route sont ignorées. Les erreurs de réseau sont distinctes d'un 404 et le chargement peut être relancé.
- Dashboard : chargements et erreurs indépendants pour progression, compétences et badges ; une panne ne devient pas un compte vide. Les sections réussies restent visibles et chaque section a son retry. Les badges sont acquittés uniquement via une action explicite ; la cloche recharge après calcul/acquittement et distingue erreur et absence de notification.
- Historique : GET `/api/me/progress` ajoute `is_available`. Les lignes des leçons dépubliées et leurs acquis restent présents ; le dashboard ne propose ni lien ni reprise pour ces lignes. Le repository partagé avec les badges n'est pas filtré, et un test PostgreSQL vérifie la conservation du badge acquis. L'ajout de champ ne nécessite pas de migration.
- Catalogue : les pages API sont chargées jusqu'au total annoncé, tous les contenus restent accessibles, recherche nommée, filtres à état accessible, état vide explicite et retry après échec.
- Administration : listes et éditeurs échouent avec un message et une nouvelle tentative, sans laisser un formulaire vide modifiable. Les lectures anciennes sont ignorées ; les éditeurs changent de session d'état à chaque route. Les pages admin se recalent si le total diminue. La recherche des cours reste honnêtement limitée à la page chargée ; aucun contrat de recherche globale n'est inventé.
- Import PDF : fichier, école, mode et nombre de points à vérifier sont rappelés au-dessus de la confirmation. Les anomalies sont ouvertes par défaut. Réinitialiser le fichier remet aussi l'input à zéro ; fichier/école/mode sont verrouillés pendant les appels. Un échec garde la prévisualisation pour un retry. Aucune nouvelle politique sur les PDF scannés n'est ajoutée.
- Accessibilité et mise en page : suppression de la double numérotation du sommaire, barre de lecture placée sous la hauteur réelle de l'en-tête, ancres décalées, contrôles à état pressé, dashboard en une colonne sur petit écran et actions admin repliables. Les contenus ne sont plus cachés dans l'attente d'une animation. Les ajustements de largeur restent à contrôler visuellement à 320/390 px et au zoom.

La complétion reste indépendante du quiz. Les rôles, protections serveur, bornes de progression, verrous PostgreSQL et garde du dernier SUPER_ADMIN restent conservés.

## Vérifications de ce lot

| Contrôle | Résultat |
| --- | --- |
| Tests React, happy-dom et services mockés | 27 réussis (9 existants, 18 supplémentaires) |
| Build TypeScript / Vite | Réussi |
| Lint frontend | Aucune erreur ; avertissement existant `only-export-components` dans authStore |
| Contrats backend à persistance substituée | 25 réussis, séparés de la suite native |
| Suite backend applicable sur la base de test dédiée | 380 réussis, 1 ignoré ; les 6 tests de concurrence sont exclus de cette exécution |
| Nouveau test PostgreSQL d'historique dépublié | Réussi ; compris dans le total backend |
| Préservation des identifiants des lignes QA avant/après la suite | Vérifiée sur les clés primaires des tables ; pas de reset ni suppression globale |

Un premier passage backend a échoué dans le scénario du dernier SUPER_ADMIN : son prérequis d'un seul SUPER_ADMIN actif n'est plus vrai depuis la création des comptes QA. Ce test vérifie maintenant explicitement son prérequis et est ignoré si d'autres administrateurs actifs existent. Aucun compte existant n'est suspendu ou supprimé pour satisfaire le test. Les six scénarios de concurrence exigent également une base vide ; ils ne sont pas rejoués sur cette base de recette remplie. Leurs résultats historiques restent dans [la validation précédente](VALIDATION_LEARNING_UX.md) et [le JSON précédent](NATIVE_TEST_RESULT.json), sans être présentés comme réexécutés ici.

Le build conserve l'avertissement sur le chunk 3D ; les tests backend conservent les avertissements de dépréciation Starlette/slowapi. Les tests React utilisent des services substitués : ils ne constituent pas une recette E2E avec FastAPI.

## Limites et suite du design

Le rapport Claude a été lu via Library. Les « avant » de cette revue sont des rendus du frontend avec API simulée ; les « après » sont des maquettes. Le transfert local du ZIP reste bloqué sous Windows : le helper Library officiel appelle `os.setxattr`, indisponible dans ce runtime. Les PNG et `proposed.css` n'ont donc pas pu être inspectés/importés ; aucune intégration prétendue fidèle à ces assets n'est publiée dans ce lot.

Le skill Windows Computer Use est présent, mais son runtime `node_repl`/`@oai/sky` n'est pas exposé à cette tâche. Aucune capture navigateur n'a été produite, aucune mesure réelle de débordement/contraste n'est annoncée. La vérification visuelle et l'intégration « Aurore lisible » attendent l'accès aux visuels et un workflow navigateur supporté.

Les services QA dédiés ont depuis été redémarrés de façon ciblée sur loopback 5184/8014. L'API a servi le SHA `6809361c9b893253868b229fb4a0fece365c7d2d` lors des contrôles HTTP : health, connexion synthétique et historique ont répondu 200 ; CORS, l'URL API du frontend et le champ `is_available` ont été vérifiés. Le nouveau module de leçon est servi par Vite. Aucun nouveau jeu de données n'a été créé pour ces contrôles ; les instances 5173/8000 restent intactes. Il s'agit de vérifications HTTP et de modules servis, pas d'une recette navigateur.

Prochaine étape : rendre les livrables Claude accessibles sur une branche dédiée, inspecter réellement les PNG, puis intégrer et vérifier les écrans approuvés en conservant résumé/anomalies PDF sur mobile, accès évident à toutes les cartes, pagination cohérente, clavier, zoom et contenus pédagogiques visibles. Aucun merge ni déploiement n'est effectué.


## Complément : courses de progression après 5a3f47a

Les constats indépendants ont été reproduits avant correction : un start en attente restait ignoré après échec de complete ; une réponse de sauvegarde ancienne remplaçait 80 % par 30 % dans l'interface ; une écriture HTTP tardive abaissait PostgreSQL de 80 % à 35 %.

Le frontend restaure désormais toute réponse utile tant que la route est active et que la complétion n'est pas confirmée, et conserve le maximum acquis. Les erreurs de synchronisation appartiennent à la requête la plus récente. L'échec d'une tentative de complétion n'invalide plus une restauration encore en attente ; la complétion confirmée continue de protéger les 100 %. Le pourcentage de la position actuelle dans la page reste distinct de la progression acquise.

Le serveur conserve également le maximum, après plafonnement à 99 % tant que la leçon n'est pas terminée. La ligne existante est rafraîchie sous le verrou transactionnel pour éviter qu'un objet déjà chargé dans la session masque une progression ou une complétion enregistrée par une autre session. Le verrou, les bornes 422 et les contrats de complétion restent conservés.

Vérifications : 29 tests React, 25 contrats mockés séparés, 382 tests backend réussis, build/lint réussis avec les avertissements existants. Un test dernier SUPER_ADMIN est toujours ignoré et les six anciens scénarios exigeant une base vide restent exclus pour préserver les comptes QA. Les nouvelles preuves comprennent deux réponses save résolues dans l'ordre inverse, start résolu après échec de complete, HTTP 80 puis 35/10, et deux sessions PostgreSQL réutilisant une ligne en cache avant progression/complétion par l'autre session. Le dernier test crée des identifiants synthétiques uniques, les journalise et ne retire que ses propres lignes. Les clés primaires QA avant/après la suite restent identiques. Ce sont des interleavings contrôlés, pas un test de charge ni une preuve de toutes les courses possibles.


### Dernier ajustement : erreur tardive après complétion confirmée

Un test a reproduit le cas suivant : complete est en attente, start confirme COMPLETED à 100 %, puis complete échoue. Le rejet tardif ne doit pas afficher « la leçon n'a pas pu être marquée » à côté d'une complétion déjà confirmée par le serveur. Le catch vérifie maintenant l'état confirmé ; les erreurs de complétion sans confirmation restent visibles et réessayables.

La suite frontend compte désormais 30 tests React réussis ; build et lint sont revérifiés pour cet ajustement. L'API et les données ne changent pas dans cet ajustement final ; les 25 contrats et 382 tests backend du complément précédent restent les résultats de cette validation récente, sans être présentés comme exécutés une fois de plus.
