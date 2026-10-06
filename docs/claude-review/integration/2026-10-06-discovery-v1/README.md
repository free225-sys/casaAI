# Découverte pédagogique V1 — frontend (TASK-20261006-001)

Branche `claude/discovery-v1-ui`, posée sur `9eb451495a4bebb38d644eb3a868301d3f8a4754`. Contrat suivi : `docs/contracts/DISCOVERY_V1.md` à `bfe0d910f1f015ac75c27a470b64746d432b51d2` (§12 réserves, §13 textes). **Aucun fichier backend, seed ni migration modifié.** Les routes du contrat n'existent pas encore côté serveur : rien ici n'a été exécuté contre elles.

## Ce qui est livré

| Zone | Changement |
| --- | --- |
| Accueil (`HomePage`) | Module « Comment une IA répond à un message » sous le hero : six scènes, les deux premières visibles, les quatre suivantes dépliées sur place par un bouton (focus sur la scène 3, annonce « Scènes 3 à 6 affichées »). Trois exemples guidés, aucune saisie libre. Textes du §13 repris tels quels. Simulation locale : aucun appel à un modèle, aucun stockage. Aucune animation automatique |
| Repli | Le texte des six scènes vit dans le bundle principal (`discoveryContent.ts`, `DiscoveryTextFallback`) ; une frontière d'erreur l'affiche si le module chargé à la demande échoue au chargement **ou** à l'exécution. Ce n'est pas un repli « sans JavaScript » (SPA) |
| Registre version 1 | `utils/discoveryRegistry.ts` : six clés dans l'ordre, notions par scène. La réponse du serveur est validée (version, clé, six scènes, structure, notions = sous-ensemble ordonné du registre, références présentes). Sinon : « Liens momentanément incompatibles. Réessayez après actualisation. », scènes toujours utilisables, jamais un état vide |
| Liens publiés | `GET /api/discoveries/llm-answer/links` (public, sans cache frontend), lu une fois **à l'approche du module** ; états : chargement, panne réessayable, incompatible, aucun cours, liste dédupliquée ; lien vers `/courses/:id`, « Créer un compte pour suivre ce cours » pour les visiteurs |
| Éditeur de leçon | Section « Notions de la découverte » (`LessonNotionsSection`) : référentiel paginé complet, recherche, statuts, enregistrement **distinct** de celui de la leçon, `PUT` avec `expected_revision` recopiée, liste vide explicite, 409 de révision → relecture de l'état sans toucher à la sélection, écart affiché, deux actions conscientes, **aucun renvoi automatique** ; 409 de cours partagé reconnu (même révision) ; 422, 403, panne réseau avec retry identique ; associations absentes du référentiel conservées. Après création d'une leçon : on reste sur l'éditeur de l'identifiant renvoyé (`replace`), sans second `POST` ; enregistrer le texte d'une leçon avec des notions non enregistrées ne quitte pas la page |
| Inscription | `register` renvoie l'utilisateur (identité fraîche, comme `login`) ; refus 4xx relayés ; réponse perdue ou 5xx → « Création non confirmée : essayez de vous connecter. » sans relance ; création confirmée puis connexion en échec → « Compte créé : connectez-vous. », session partielle nettoyée, création jamais rejouée, mot de passe vidé. Seul `return_course_id` voyage dans l'état du routeur ; identifiant filtré, destination reconstruite et soumise au filtre de rôle, cours **revalidé** par `GET /api/courses/{id}` ; cours retiré / invalide / non vérifiable → tableau de bord avec un message distinct. La connexion applique la même règle (une URL d'origine garde la priorité) |
| Défauts existants corrigés | L'accueil débordait horizontalement sous ~550 px : grille de trois cartes en ligne fixe (devenue `.home-cards`, une colonne sous 760 px) et rail de huit stations en positionnement absolu (liste en rangées sous 760 px, bascule 3D masquée). Hors périmètre du contrat mais nécessaire pour tenir « aucun débordement à 320/390 px » |

## Tests exécutés

`npx tsc -b` sans erreur ; `npm run lint` : 0 erreur, 1 avertissement existant (`authStore.tsx`, ligne déplacée à 114 par mes ajouts) ; `npm run test` **191/191** (117 avant, 74 ajoutés, 1 fichier de test existant adapté : `refusals-409`, dont le mock du service admin reçoit les trois nouvelles méthodes) ; `npm run build` réussi.

Nouveaux fichiers : `discovery-module.test.tsx` (validation du registre : 13 refus, textes, états, scènes, réglage), `discovery-fallback.test.tsx` (échec d'exécution), `discovery-network.test.tsx` (une seule lecture `GET`, sans corps ni autorisation, aucun texte d'exemple dans les requêtes, stockage et cookies inchangés), `knowledge-notions.test.tsx` (sélecteur, conflits, éditeur), `register-return.test.tsx` (retour au cours, inscription, connexion), `home-responsive.test.tsx`.

## Mesures navigateur — **API simulée**, pas le vrai serveur

Chromium sur la build de prévisualisation (`VITE_API_URL=http://api.test`, API interceptée) ; `_mesures.json` contient les valeurs.

| Mesure | Résultat |
| --- | --- |
| Débordement horizontal (`scrollWidth` = `clientWidth`) | Oui à 1440, 390, 320 px, 720 px à ratio de pixels 2, 390 px avec mouvement réduit, repliée et dépliée |
| axe-core WCAG 2.0/2.1 A/AA sur le module | 0 violation dans ces cinq configurations, repliée et dépliée ; 0 sur les trois états des liens et sur la section Notions (1440 et 390) |
| Clavier réel (Tab, Entrée) | Le bouton « Continuer » est atteint et le focus arrive sur le titre de la scène 3 dans les cinq cas |
| Réseau pendant tout le parcours | Un seul `GET /api/discoveries/llm-answer/links` ; aucun envoi ni texte d'exemple |
| Décalage de mise en page (CLS) | 0 à 0,003 après réservation de hauteur (0,09 avant) |
| Poids | Bundle principal 459,4 → 478,8 ko (127,5 → 133,2 ko gzip), soit +19,4 ko ; simulation chargée à la demande 11,0 ko (3,8 gzip) ; CSS 43,7 → 48,3 ko |
| Inscription depuis l'accueil | Cours valide → `/courses/cours-test` ; 404 → tableau de bord avec « n'est plus disponible » ; 503 → « non vérifiable » ; une seule création dans les trois cas |
| Éditeur | 409 de révision : un seul `PUT`, aucune relance, écart affiché |

## Non vérifié, limites

- **Aucune vérification contre le vrai serveur** : ni routes de découverte, ni référentiel de notions, ni `PUT` atomique, ni migration des trois notions ; les messages d'erreur et les statuts reposent sur le contrat.
- **Zoom natif à 200 % non testé** : mon outillage pilote Chromium en émulant taille et densité (720 px à ratio 2), il n'applique pas le zoom de l'interface du navigateur. À valider dans un navigateur interactif.
- Pas de lecteur d'écran réel ; clavier rejoué sur la page d'accueil (pas dans l'éditeur) ; navigateur unique (Chromium) ; pas de CI GitHub consultée.
- La durée n'est pas annoncée (à mesurer sur des essais réels). Page complémentaire non faite (hors minimum V1).
- Les liens de cours dépendent entièrement des associations éditées et publiées côté serveur : aucun identifiant de cours n'est connu du frontend.
- Le message de destination (« cours plus disponible ») n'est affiché que sur le tableau de bord apprenant ; un compte non apprenant qui se connecte avec un cours choisi retombe sur son accueil sans message.

## Révision après la revue indépendante (MSG-20261006-012 et 013)

Quatre réserves P2 reçues, **lues dans le code par le lead, non reproduites par lui** : je les ai d'abord reproduites par des tests à promesses différées (7 échecs avant correction sur les cas de latence et d'abandon, 9 sur les autres), puis corrigées.

| Réserve | Cause confirmée | Correction |
| --- | --- | --- |
| `CourseDetailPage` : toute erreur devenait « introuvable » | Un seul état d'erreur ; l'ancien cours ou l'ancienne erreur survivaient à un changement d'identifiant | Trois états : **404 → « Ce cours n'est plus disponible »** avec issues catalogue et accueil (ou espace du rôle), **réseau/5xx → panne réessayable** (« Ce n'est pas un retrait »), lecture invalidée à chaque changement d'identifiant |
| Sélection de notions perdue pendant la latence | La réponse du `PUT` remplace la sélection alors que les cases restaient actives ; le texte de la leçon décidait de naviguer sur un état « notions modifiées » capturé avant l'attente | Cases **verrouillées** pendant l'enregistrement ; l'état « notions non enregistrées » est lu **après** l'enregistrement du texte (référence mutable) : une notion cochée pendant la latence garde la page ouverte |
| Navigation tardive après abandon | `resolveReturnDestination` se terminait après le démontage de la page et imposait sa destination | Garde de montage sur `RegisterPage` et `LoginPage` : plus de navigation si la page a été quittée, résolution ou rejet tardifs ; aucune recréation de compte |
| Registre : orphelins acceptés | La validation n'allait que de la scène vers les métadonnées | Contrôle **inverse** : toute notion ou tout cours de métadonnées doit être référencé par une scène, sinon la réponse est incompatible (« Liens momentanément incompatibles… ») |

Tests : **209/209** (191 + 18), `npx tsc -b` sans erreur, lint 0 erreur (1 avertissement existant), build réussi. Navigateur (API simulée) : les états « plus disponible » et « panne » de la fiche de cours à 1440 et 390 px, sans débordement horizontal et sans violation axe-core ; ce sont les seules vérifications navigateur refaites pour cette révision. Mêmes limites que ci-dessus : aucun serveur réel, zoom natif non testé, CI non consultée.
