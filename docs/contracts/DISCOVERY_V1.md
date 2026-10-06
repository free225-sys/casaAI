# Accueil pédagogique CASA — contrat documentaire V1

Statut : contrat documentaire finalisé par le lead après revue complète de la proposition Claude révision 3 (62876ccb9ca0a0943447e450a3aafbb718856d8f). **Prêt à demander validation finale et GO distinct au propriétaire ; aucun GO accordé ici.** Les décisions finales du §12 prévalent sur les réserves du README R3. **Aucune route, migration ou implémentation ci-dessous n'est livrée par ce document.** Base backend 72261b84e2c0a457ef20aa290a89fcdf1c5bc2d6, frontend 9eb451495a4bebb38d644eb3a868301d3f8a4754. Proposition Claude revue : 62876ccb9ca0a0943447e450a3aafbb718856d8f, README de docs/claude-review/proposals/2026-10-06-accueil-pedagogique/. Tâche TASK-20261006-001.

## 1. Validation propriétaire et limite d'autorisation

Le 6 octobre à 10:49 UTC, « oui je valide » valide le scénario présenté : six scènes dans l'accueil, deux premières visibles puis quatre scènes dépliables sur place ; trois exemples guidés locaux ; aucune saisie libre ni API d'inférence en V1 ; associations de notions dans l'éditeur de leçon, avec les permissions/publications actuelles ; retour au cours choisi après inscription, dashboard si indisponible.

Cette décision autorise la **finalisation documentaire du contrat avant développement**, pas le code. Une page complémentaire reste facultative. Aurore, catalogue complet, signature, guards, rôles et progression restent la référence. Durée annoncée et formulations exactes sont à affiner sans rouvrir les principes validés.

## 2. Réemploi et registre de scènes

Réutiliser KnowledgeNode et knowledge_node_used_in_lessons, puis Lesson.course_id et Course. Les jointures existantes portent déjà les associations notion→leçon ; pas de nouvelle table discovery_scene_nodes, pas de mapping de cours dans le frontend, pas de nouvel éditeur global.

Un registre de référence versionné, commun au contrat backend/frontend, définit la découverte llm-answer, registry_version=1, et les scènes suivantes dans cet ordre. Il contient **uniquement des identifiants de notions**, jamais des IDs/titres de cours ou leçons. Le frontend connaît les clés de scènes mais reçoit leurs associations publiées du serveur.

| scene_key stable | Scène | KnowledgeNode.id, dans l'ordre |
| --- | --- | --- |
| message | Message et contexte | llm |
| tokens | Tokenisation | tokenization |
| representations | Représentations numériques | data-representation, embeddings |
| model | Traitement du modèle | attention, transformer |
| generation | Génération et mémoire de calcul | generation, kv-cache |
| response | Réponse lisible et limites | llm, generation |

Ce registre est confirmé pour V1 ; compatibilité définie au §12/R1. Une scène n'est pas un token de progression pédagogique. Les scènes restent visibles même si aucune association n'est publiée. Les cours sont obtenus exclusivement via les associations éditées sur les leçons ; leur regroupement ne dépend pas d'une recherche de titres, d'un ancien seed ni de leur appartenance à un parcours particulier.

## 3. Lecture publique groupée

**GET /api/discoveries/{discovery_key}/links** — sans authentification, seule clé V1 : llm-answer. Préfixe /api cohérent avec content.py ; pas de nouveau préfixe /api/public.

Schéma DiscoveryLinksOut :

- discovery_key : string, llm-answer ; registry_version : entier, 1.
- scenes : exactement six éléments ordonnés {scene_key: string, notion_ids: string[], course_ids: string[]}.
- notions : objets uniques {id: string, title: string}, dans l'ordre de première apparition dans le registre.
- courses : objets uniques {id: string, title: string, school_id: string, level: string|null, duration_min: integer|null}, ordonnés par Course.title puis Course.id, même ordre pour les course_ids de chaque scène.

Exemple **illustratif**, qui ne désigne aucun cours réel :

~~~json
{
  "discovery_key": "llm-answer",
  "registry_version": 1,
  "scenes": [
    {"scene_key":"message","notion_ids":["llm"],"course_ids":["cours-exemple"]},
    {"scene_key":"tokens","notion_ids":[],"course_ids":[]},
    {"scene_key":"representations","notion_ids":[],"course_ids":[]},
    {"scene_key":"model","notion_ids":[],"course_ids":[]},
    {"scene_key":"generation","notion_ids":[],"course_ids":[]},
    {"scene_key":"response","notion_ids":["llm"],"course_ids":["cours-exemple"]}
  ],
  "notions": [{"id":"llm","title":"Modèle de langage"}],
  "courses": [{"id":"cours-exemple","title":"Cours illustratif","school_id":"ecole-exemple","level":null,"duration_min":null}]
}
~~~

Règles normatives :

1. Une notion n'est servie que si son KnowledgeNode.status vaut PUBLISHED et son ID figure dans le registre. Une notion publiée sans association reste une notion sans cours.
2. Un cours est proposé pour une scène si **au moins une** liaison du nœud de cette scène mène à une Lesson PUBLISHED dont Course est PUBLISHED. Les trois filtres sont serveur ; une autre leçon publiée sans cette liaison ne suffit pas.
3. Dédupliquer notions/cours globalement dans les métadonnées et course_ids par scène ; un même ID de cours peut être référencé dans plusieurs scènes. Aucun contenu, ID de leçon, statut non public, compteur de brouillons, compte ou acquis n'est exposé.
4. Lecture cohérente sur un même snapshot SQL, de préférence une requête groupée, pas six requêtes par scène ni une requête par cours. Coût proportionnel au nombre de liens de cette découverte ; pas de téléchargement de tout le catalogue.
5. Découverte connue sans données : 200, six scènes, listes vides appropriées. Clé inconnue : 404 {"detail":"Découverte introuvable."}. Panne : statut 5xx normal, jamais [] fabriqué pour masquer une panne.
6. Cache-Control: no-store pour ce nouveau endpoint ; aucun cache persistant frontend **ni cache serveur applicatif ou partagé/CDN des réponses** en V1. Un GET quand le module arrive à l'écran, retry explicite sur erreur, nouvelle lecture au retour de l'édition et contrôle de fiche au clic/retour d'inscription. Ce choix réduit l'obsolescence, il ne garantit pas qu'un lien restera disponible après la réponse.

## 4. Référentiel et associations dans l'administration

Tous les endpoints ci-dessous utilisent require_content_admin : ADMIN et SUPER_ADMIN actifs. Réutiliser get_current_user ; les droits viennent de la base, pas d'un rôle seulement affiché côté client.

**GET /api/admin/knowledge-nodes?limit=20&offset=0**

Référentiel de notions, pas une liste de leçons hors scope. Réponse paginée {items:[{id,title,status}], total, limit, offset}, ordre title puis id, limit 1..100 et offset>=0. Les trois statuts sont lisibles afin de comprendre une association devenue non publique. Aucun lien vers les leçons d'autres administrateurs. Lecture du référentiel commun autorisée aux deux rôles ; aucune création, édition de notion ni écriture globale par cette route.

**GET /api/admin/lessons/{lesson_id}/knowledge-nodes**

Autorisation ContentScopeService.lesson(lesson_id), y compris les leçons DRAFT/ARCHIVED accessibles. Réponse LessonKnowledgeNodesOut : {lesson_id:string, node_ids:string[], revision:string}. IDs uniques triés lexicographiquement, toutes publications, ensemble vide possible. Pas d'association d'autres leçons.

revision est un jeton opaque de 64 caractères hexadécimaux minuscules : SHA256 du JSON canonique UTF-8 {lesson_id, course_id, node_ids}, clés triées, listes triées, sans espaces, ensure_ascii=False. Le client le recopie, ne le calcule pas. Aucun champ ni table supplémentaire de révision.

**PUT /api/admin/lessons/{lesson_id}/knowledge-nodes**

Corps LessonKnowledgeNodesReplacement : {node_ids:string[], expected_revision:string}. Deux champs **requis**, champs supplémentaires refusés. Maximum 100 IDs, chaque ID non vide, maximum 200 caractères, sans espace périphérique ni caractère de contrôle ; doublons refusés. expected_revision doit avoir le format du jeton. [] explicite retire les associations ; absence de node_ids ne signifie jamais [].

Les nœuds DRAFT/ARCHIVED existants restent sélectionnables : une association n'en publie ni la notion ni la leçon/cours. Un bandeau de l'éditeur explique pourquoi elle n'est pas visible sur l'accueil.

Réponse 200 : LessonKnowledgeNodesOut avec l'état réellement committé. L'ordre du corps n'est pas un ordre éditorial ; il est normalisé. Pour une nouvelle leçon, obtenir d'abord son ID via l'API de création existante, puis lire/enregistrer les notions. Aucun élargissement d'AdminLessonIn/Out requis en V1.

## 5. Atomicité, idempotence, concurrence et droits

Une seule transaction pour le PUT dédié :

1. Valider le schéma et les dépendances auth/rôle. Prendre d'abord le verrou transactionnel casa:content-scope-mutations (scope.lock_mutation), puis verrouiller/recharger la ligne de l'acteur User FOR UPDATE, en rafraîchissant réellement l'identité ORM. Revérifier statut actif et rôle courant : suspension/suppression →401, démotion hors ADMIN/SUPER_ADMIN →403. Construire le scope avec cet acteur frais, puis appeler **ContentScopeService.lesson(lesson_id, write=True)** ; ne pas mémoriser les grants frontend. Garder le verrou acteur jusqu'au commit : une révocation concurrente est ordonnée avant ou après cette transaction.
2. Respecter l'ordre de verrous commun → acteur → leçon → références triées. Verrouiller la ligne Lesson FOR UPDATE et relire son parent/les liaisons actuelles dans la transaction ; vérifier le périmètre courant et la règle des cours partagés après acquisition des verrous.
3. Valider l'existence de tous les node_ids avant suppression ; protéger les références contre une suppression concurrente (verrou de référence dans l'ordre des IDs ou mécanisme équivalent). Aucun remplacement partiel en cas d'erreur.
4. Si l'ensemble demandé est déjà l'ensemble courant, retourner 200 avec la révision courante, même si expected_revision est ancien : retry identique sans écriture.
5. Sinon, comparer expected_revision à la révision courante : divergence→409, sans changement. Puis appliquer uniquement la différence aux liaisons de **cette leçon**, commit unique et réponse canonique.

Deux éditeurs divergents depuis une même révision : le premier commit gagne, le second reçoit 409 et recharge ; aucune fusion ni écrasement silencieux. Deux PUT identiques donnent le même état/jeton. Une séquence A→B→A rend le même fingerprint : la condition porte sur l'état actuel, pas sur un numéro historique, ce qui n'écrase aucun état différent. Aucun effet progression, badge, certificat, publication ou texte du cours.

ADMIN peut lire dans son périmètre et écrire si son école est attribuée ou si tous les parcours partageant le cours sont couverts, conformément à ContentScopeService.course(write=True). SUPER_ADMIN bénéficie du périmètre global existant, pas d'un nouvel éditeur global. Les changements de grants et mutations parents utilisant le verrou commun sont sérialisés ; la nouvelle route ne doit pas contourner ces contrôles.

**Compatibilité :** les anciens POST/PUT de leçon et _replace_nested conservent les liaisons KnowledgeNode inchangées. Ne pas ajouter node_ids=[] par défaut à AdminLessonIn ni lancer une synchronisation implicite lors d'un ancien PUT. En V1, texte de leçon et notions ont deux enregistrements explicites : afficher chacun succès/erreur et garder la sélection non enregistrée si la seconde opération échoue.

## 6. Erreurs précises

| Route / situation | Statut et detail |
| --- | --- |
| Admin : absent/invalide/expiré/inactif | 401, mécanisme get_current_user/HTTPBearer existant ; token invalide/inactif : "Identifiants invalides ou expirés." |
| Admin : LEARNER ou rôle insuffisant | 403, "Accès refusé : rôle insuffisant." |
| Public : discovery_key inconnu | 404, "Découverte introuvable." |
| Admin : leçon inexistante | 404, "Leçon introuvable." |
| Admin : parent de leçon hors scope | 404, "Cours introuvable." (comportement ContentScopeService actuel) |
| PUT : cours partagé non entièrement couvert | 409, "Cours partagé : tous les parcours ou l’école doivent être attribués." |
| PUT : révision divergente et changement demandé | 409, "Les notions de cette leçon ont changé. Rechargez puis réessayez." |
| PUT : au moins un node_id inexistant | 422, "Notion introuvable." ; aucune écriture |
| Query/corps absent, malformé, doublon, trop long, revision invalide | 422, validation Pydantic/FastAPI standard (detail liste), pas 409 |
| Panne DB/transport | 5xx/erreur réseau ; ne pas transformer en succès, données vides ou cours définitivement retiré |

Les libellés de permissions existants doivent rester ceux du service à l'implémentation. Aucune existence hors périmètre n'est révélée par une route nouvelle.

## 7. Retrait, publication, cours partagé et amorçage ciblé

Retirer une liaison sur une leçon ne retire aucune liaison des autres leçons. Si une autre liaison publiée du même cours justifie encore ce cours pour la scène, il reste proposé. Dépublier/archiver la notion, la leçon ou son cours retire le chemin concerné de la prochaine réponse publique ; les associations restent éditables et conservées en administration. Une suppression autorisée réutilise les gardes actuelles et les FK existantes ; aucun DELETE global ajouté ici. Publication d'un parcours n'est pas un filtre supplémentaire du cours public : respecter la règle actuelle de content_repository, qui expose un cours PUBLISHED indépendamment du statut de ses parcours.

Une future migration de données **ciblée et ponctuelle**, non exécutée ici, provisionne les seuls nœuds manquants du registre : tokenization ("Tokenisation"), generation ("Génération de texte"), kv-cache ("Cache clé-valeur"). Les autres IDs doivent être constatés, pas restaurés aveuglément depuis le seed.

Proposition technique : insérer les trois nouveaux référentiels en PUBLISHED seulement s'ils n'existent pas, sans liaison ; ils n'exposent aucun cours à eux seuls. ON CONFLICT(id) DO NOTHING préserve tous les champs/statuts d'un nœud existant, y compris DRAFT/ARCHIVED. Le lead confirme ce statut initial PUBLISHED sans liaison pour ces trois nouveaux nœuds ; il ne republie aucun choix existant. Les titres initiaux ci-dessus sont confirmés ; aucun changement de titre par une nouvelle route V1. Une évolution de titre ultérieure serait une tâche distincte, explicitement revue et appliquée par migration ciblée, sans changer implicitement statut ni associations. L'ajout initial conserve intégralement les nœuds déjà présents.

**Ne jamais** rejouer seed_knowledge_graph/seed global, ajouter des liens depuis usedIn historique, republier un cours/leçon/nœud existant, restaurer une liaison retirée, renommer/fusionner des IDs ou faire une réconciliation au démarrage. Les futures associations sont éditées explicitement par un administrateur dans la leçon. La migration forward n'est exécutée qu'une fois ; un downgrade éventuel ne doit pas supprimer un nœud désormais référencé par du contenu éditorial. Aucun index/table/migration exécutable fourni par cette livraison documentaire.

## 8. Accueil, inscription et indisponibilité

Claude ajoute le sélecteur **Notions** à l'éditeur de leçon, pas un écran global "Liens de la découverte". Il charge le référentiel et l'état de la leçon, conserve les associations non visibles/anciennes, signale les statuts et conflits, n'efface rien pendant un chargement/panne. Les contrôles frontend assistent l'utilisateur ; le serveur décide des droits.

La simulation est locale sur trois exemples, sans saisie libre, envoi de prompt, stockage persistant des entrées ou API d'inférence. Les GET de métadonnées et le trafic normal auth/assets restent permis ; les choix d'exemple/scène ne déclenchent pas de télémétrie par défaut. Les listes de liens peuvent charger/échouer indépendamment des scènes ; état vide et erreur ont des textes distincts.

Après inscription/session établie et identité/rôle à jour (attendre le rafraîchissement auth, ne pas lire un ancien user capturé) : porter seulement un return_course_id en état du routeur, pas une URL libre. Construire une route interne à segment encodé, la faire passer par postLoginPath/les rôles actuels, puis **revalider GET /api/courses/{id}** et l'ID retourné. Cours publié et destination permise→fiche cours ; absent/retiré, ID invalide ou disponibilité non vérifiable→/app/dashboard avec message distinct selon le cas. Ne pas relancer l'inscription après un échec de ce GET. Pour une connexion d'un compte existant, conserver homePathFor si son rôle ne permet pas la destination ; jamais envoyer un ADMIN vers une activité apprenante.

Un cours peut disparaître **après** cette vérification ou après le GET groupé. Un GET 404 de fiche est donc normal : afficher un état « Cours indisponible » avec issue catalogue/dashboard, pas une page cassée ni promesse "jamais404". Une erreur réseau/5xx est un état réessayable, pas une preuve de dépublication.

Repli du module : texte disponible dans le bundle React principal, indépendant du chargement/exécution du module de simulation ; frontière d'erreur et mouvement réduit. Ce n'est pas une garantie sans JavaScript pour la SPA. La page complémentaire éventuelle réemploie le même composant ; aucun chantier SSR/prérendu inclus.

## 9. Douze choix Claude : statut sans rouvrir les décisions

| Choix README révision2 | Statut pour la suite documentaire |
| --- | --- |
| O1 six scènes | Validé 10:49 ; clés stables du §2 à aligner |
| O2 deux scènes puis suite | Validé : 1–2 visibles, 3–6 dépliables **dans l'accueil**, pas seulement ailleurs |
| O3 page complémentaire | Facultative, hors minimum V1 ; aucune décision supplémentaire requise pour l'accueil |
| O4 durée/niveau annoncés | Durée à mesurer ; pas de promesse4 min arbitraire ; découverte débutant acquise |
| O5 exemples/saisie | Validé : trois exemples locaux, aucune saisie libre/API inférence en V1 ; textes exacts à relire |
| O6 navigation | Détail frontend/design Claude, dans les contraintes clavier/pause/ordre ; ne pas rouvrir le placement |
| O7 textes scientifiques | Relecture lead/Claude obligatoire : token≠mot/embedding, masque causal, position selon architecture, cache non magique ; pas de raisonnement interne prétendu |
| O8 routes/table/scope | Contrat §2–7 : table existante, registre versionné, trois lectures/un PUT ; réserves tranchées au §12 puis validation propriétaire |
| O9 gouvernance | ADMIN dans son scope, SUPER_ADMIN global, associations dans la leçon ; aucun éditeur global V1 |
| O10 correction ancien texte seed | Point éditorial signalé ; toute correction du lab existant reste une tâche lead distincte à borner avant GO, aucun reseed |
| O11 retour inscription | Validé : cours choisi revalidé, dashboard si indisponible ; retrait concurrent couvert |
| O12 sansJS | Aucun engagement SSR/sansJS V1 ; repli React et mouvement réduit seulement |

Corriger les restes contradictoires du README : §2 "seul teaser", §6 qui exclut notion→leçon de V1, nouvelle table/éditeur global, promesse "jamais404", formulations "chaque mot"/attention à des tokens futurs ou position toujours ajoutée. Les principes ne sont pas remis au vote.

## 10. Vérification future avant acceptation

Cette livraison ne prétend exécuter aucune de ces vérifications ; elles seront requises après GO et implémentation.

- Backend : triple filtre PUBLISHED ; notion publiée sans liens ; dépublication/retrait/plusieurs leçons d'un cours ; dédoublonnage/ordre ; métadonnées seules ; découverte inconnue et panne non masquée.
- API admin : 401/403/404, école/parcours/sans scope, cours partagé409, SUPER_ADMIN, référence inconnue422 sans mutation, [] explicite, corps incomplet422, ancien PUT conservant les liens, retry identique, deux éditeurs divergents409, droits/parent modifiés pendant attente de verrou, suspension/démotion de l'acteur avant acquisition et ordre de verrous sans interblocage.
- Données : migration ciblée réexécutée sans altération ; statuts existants conservés ; aucune liaison remise ; aucun reseed ; données/volumes de recette préservés.
- Frontend : sélecteur avec plus d'une page du référentiel, chargement/erreur/409 sans perte de sélection, états cours vide/retiré/erreur, inscription réussie puis vérification en panne, destination invalide/externe/encodée refusée, course entre vérification et navigation.
- Navigateur : 320/390/1440px **et panneau étroit**, clavier réel/focus/équivalent textuel, mouvement réduit, erreur de chargement et d'exécution du module, mesure du poids/chargement. **Zoom natif navigateur 200%** à tester et distinguer du viewport réduit/DPR ; axe-core et mesures seules ne remplacent pas la recette. Aucun trafic/persistance contenant les entrées de simulation.

## 11. Sources et prochaine étape

Sources lues : backend/app/models/knowledge.py ; models/content.py ; api/deps.py ; api/content.py ; api/admin_content.py ; schemas/admin.py ; services/content_scope_service.py ; repositories/content_repository.py et admin_content_repository.py ; frontend/src/pages/RegisterPage.tsx, CourseDetailPage.tsx, admin/AdminLessonEditPage.tsx ; utils/roles.ts ; stores/authStore.tsx. Le catalogue de recette sans contenu public constaté précédemment n'autorise aucune sélection de cours du seed.

La proposition Claude R3 est revue intégralement ; ses réserves sont tranchées au §12, sans nouveau questionnaire. Ce contrat et la proposition R3 corrigée par les textes du §13 constituent le dossier documentaire final. Le propriétaire peut maintenant valider ce dossier puis accorder un GO code distinct. Lead : backend/contrats/qualité ; Claude : frontend/design. **Aucun merge, déploiement ou changement applicatif autorisé par cette publication.**

## 12. Réponses finales aux réserves R1–R10 de Claude R3

| Réserve | Décision lead pour V1 |
| --- | --- |
| R1 compatibilité | Frontend compatible **registry_version=1 seulement** : vérifier version, clé découverte, six clés uniques et ordre du registre, structure des métadonnées/références. Version différente ou réponse incompatible : ne consommer aucun lien, afficher « Liens momentanément incompatibles. Réessayez après actualisation. », garder les six scènes locales utilisables. Ce n'est ni un état vide ni une donnée à ignorer silencieusement. Renommer/réordonner une scène ou changer le mapping de notions implique une nouvelle version et un frontend compatible avant consommation. Une variation de publication/liens ne change pas la version du registre. |
| R2 nouveaux nœuds | Confirmés PUBLISHED sans liens, titres fixés au §7, ajout ciblé seulement si absents. Préserver titres/statuts existants ; aucune publication de cours ni restauration de liens. Pas d'éditeur global ni de changement de titre dans V1. |
| R3 lecture/cache | Lecture à l'arrivée du module à l'écran confirmée ; no-store inclut V1 sans cache de réponse serveur/CDN. Pas de nouveau mécanisme de limitation de débit dans ce lot : réemploi des protections d'infrastructure existantes, requête groupée et chargement borné. Toute optimisation future devra préserver les retraits/publications, après mesure ; aucun TTL admis implicitement. |
| R4 retry/conflit | Révision périmée + ensemble demandé égal à l'état courant →200 **uniquement après validation du payload, identité/rôle, scope et règle des cours partagés**. Sinon, révision divergente →409 sans mutation ; un ancien droit n'est jamais rétabli par le retry. Après 409, GET explicite sans perte de sélection locale ; ne jamais réémettre automatiquement avec la nouvelle révision. Toute nouvelle sauvegarde exige une action consciente après présentation de l'écart. |
| R5 référentiel | Métadonnées communes seulement id/title/status, pagination/total du référentiel. Aucun compte, auteur, leçon, cours, scope, lien ou compteur d'utilisation ; aucun statut de cours ni information permettant de déduire leurs associations. Le statut exposé est celui de la notion uniquement. |
| R6 inscription | Le futur contrat **frontend** de register renvoie Promise<UserPublic>, en retournant l'identité fraîche obtenue par login/me, comme login ; aucune modification API backend. Distinguer la création confirmée de l'auto-connexion : si la première réussit puis login/me échoue, signaler « Compte créé : connectez-vous », ne pas rejouer la création, ne pas naviguer comme authentifié. Nettoyer une session partielle produite par cette tentative et offrir une connexion normale, avec seulement return_course_id conservé en état du routeur puis revalidé après connexion. Aucun mot de passe conservé pour un retry automatique. Si la réponse de création elle-même est perdue, ne pas affirmer que le compte est créé ni répéter automatiquement le POST : état « Création non confirmée : essayez de vous connecter ». |
| R7 nouvelle leçon | Rester sur l'éditeur après création, remplacer la route new par l'ID renvoyé (navigation replace interne), charger la révision puis permettre l'enregistrement indépendant des notions. Aucun deuxième POST de création. Droits inchangés ; panne de lecture/sauvegarde des notions ne remet pas en cause la création réussie. |
| R8 textes | Les six formulations finales du §13 corrigent les généralisations du README R3 et prévalent pour la découverte. Illustrations étiquetées, aucun raisonnement interne ni mesure de confiance prétendue. |
| R9 lab KV | Hors chantier V1 : aucun changement au lab, seed ou formule historique. Sujet séparé, pas un prérequis pour demander GO de cette découverte qui ne la reprend pas. |
| R10 durée | Pas de durée annoncée avant mesure après GO ; aucun prototype autorisé par cette revue. |

Critères à ajouter aux contrôles futurs du §10 : version inconnue/incompatible visible sans liens ; absence de cache serveur ; retry identique après révocation refusé ; auto-connexion échouée après création confirmée sans nouveau POST ; résultat de création incertain sans retry automatique ; création de leçon suivie de l'édition des notions sur l'ID réel. Aucune de ces vérifications n'est déclarée exécutée ici.

## 13. Textes pédagogiques finaux des six scènes

Ces textes précisent le contenu, sans imposer le design de Claude. Les trois exemples guidés du README R3 sont confirmés ; toute sortie est préécrite et étiquetée « Simulation illustrative, sans appel à un modèle ».

1. **Votre message.** « Le modèle reçoit votre message, et peut aussi recevoir des consignes de l'application et des éléments de la conversation. Ici, nous montrons un contexte simplifié. » Ne pas laisser croire à un véritable envoi dans cette simulation locale.
2. **Découpage en fragments (tokens).** « Le texte est découpé en unités appelées tokens : un token peut représenter un mot, une partie de mot ou un signe. Un mot peut produire plusieurs tokens. Le découpage dépend du tokenizer utilisé. Chaque token possède un identifiant ; les numéros montrés ici sont inventés. » Remplace « des fragments, pas des mots » et « un mot rare donne plusieurs fragments », trop absolus.
3. **Des fragments aux nombres.** « À chaque identifiant correspond une représentation numérique apprise : un vecteur. Le numéro d'identifiant n'est pas ce vecteur. L'ordre des tokens est pris en compte selon l'architecture. Les valeurs et la carte à deux axes sont illustratives, pas une carte réelle de ce que comprend un modèle. »
4. **Le calcul du modèle.** « Dans ce modèle illustratif qui prédit la suite d'un texte, chaque position peut utiliser les tokens précédents et le token à cette position, sans regarder les tokens futurs. L'attention pondère des informations et se répète dans plusieurs couches de calcul. Ce schéma simplifié ne montre aucun raisonnement interne. » Masque causal conservé ; aucune flèche future.
5. **Écrire la réponse, token par token.** « Le modèle calcule des scores pour le prochain token. Selon le réglage, il retient le plus probable ou fait un choix parmi plusieurs candidats, puis recommence. Le cache clé-valeur réutilise des calculs d'attention déjà faits ; il ne supprime pas le travail sur le contexte. Dans l'exemple d'un cache qui conserve tous les tokens, mémoire et coût d'attention par étape augmentent avec sa longueur. » Curseur « moins varié ↔ plus varié », **pas « prudent »** : variabilité ne mesure ni exactitude ni confiance. Probabilités illustratives, jamais issues d'une inférence réelle.
6. **La réponse s'affiche.** « Les tokens sont reconvertis en texte, parfois affiché au fur et à mesure. La génération peut s'arrêter sur un token de fin ou une limite fixée par l'application. Ici, la réponse a été écrite à l'avance. Une réponse plausible peut être inexacte : vérifiez les informations importantes. » L'arrêt ne signifie pas que le modèle sait sa réponse complète ou correcte.

Références primaires de vérification : [tokenisation, documentation Hugging Face](https://huggingface.co/docs/transformers/tokenizer_summary), [attention causale et cache, documentation Hugging Face](https://huggingface.co/docs/transformers/cache_explanation). Le cache dynamique complet est l'exemple simplifié ; ne pas généraliser sa croissance aux caches bornés/fenêtres glissantes.

**Verdict documentaire : prêt à demander validation finale et GO au propriétaire, aucun bloquant documentaire restant. Aucun GO code, prototype, migration, instance, merge ou déploiement accordé par ce verdict.**
