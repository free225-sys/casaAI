# Proposition — accueil pédagogique « comment une IA répond à un message » (TASK-20261006-001)

**Révision 3**, alignée sur le contrat du lead `docs/contracts/DISCOVERY_V1.md` (branche `codex/discovery-contract-v1`, SHA `0a1258f5b9e8979ada4926cd96e9d0184e616882`, `MSG-20261006-005`) et sur la validation du propriétaire du 6 octobre 10:49 UTC. Document de conception **sans aucun code**. Base auditée : frontend `9eb451495a4bebb38d644eb3a868301d3f8a4754`, backend `72261b84e2c0a457ef20aa290a89fcdf1c5bc2d6` (lecture statique des sources, `backend/scripts/seed.py` et `backend/data/casa_data.json`). Je n'ai exécuté ni navigateur, ni test, ni serveur, et je n'ai lu aucune recette : ce qui suit vient du code et du contrat. **Aucun GO code** : le propriétaire doit encore valider le document et le contrat final, puis donner un GO distinct.

## 0. Ce qui est validé, ce qui ne l'est pas

| Élément | Statut |
| --- | --- |
| **Six scènes directement dans l'accueil** : les deux premières visibles, les quatre suivantes dépliables sur place ; une page complémentaire reste **facultative et hors minimum V1** | **Validé** (6 oct. 10:49 UTC) |
| **Trois exemples guidés locaux** ; **aucune saisie libre ni API d'inférence** en V1 | **Validé** |
| **Associations de notions dans l'éditeur de leçon**, avec les permissions et la publication actuelles ; pas d'éditeur global | **Validé** |
| **Retour au cours choisi après l'inscription**, dashboard si indisponible | **Validé** |
| Durée annoncée, formulations exactes, textes scientifiques, détail de la navigation | À affiner, sans rouvrir les principes |
| Contrat V1 du lead (registre de scènes, routes, concurrence, statut initial des trois nouvelles notions) | **Proposé, à confirmer** ; mes réserves sont au §9 |
| Tout code, prototype exécutable, dépendance, DB, migration, instance, merge, déploiement | **Interdit tant que le propriétaire n'a pas validé le document final et donné un GO distinct** |

Aucune route ni migration citée n'existe : elles sont décrites par le contrat du lead comme propositions.

## 1. Ce que l'accueil fait aujourd'hui

`HomePage.tsx` (73 lignes) : un hero (titre, deux boutons « Créer un compte » vers `/register` et « Explorer le catalogue » vers `/catalog`, `HeroVisual`), le rail `ProgressRail` (séquence pédagogique du cahier des charges) puis trois cartes (parcours, laboratoires, certifications). Aucune notion d'IA n'est expliquée sur la page : un débutant voit une promesse, pas une première compréhension. `RegisterPage.tsx` envoie toujours vers `/app/dashboard` après l'inscription (ligne `navigate("/app/dashboard", …)`), sans retour possible vers ce que la personne regardait.

## 2. Réemploi ou nouveau, composant par composant

| Élément | Constat (lecture du code) | Verdict |
| --- | --- | --- |
| `HomePage` | Structure simple, sections indépendantes | **Réemployer** ; y insérer le module des six scènes sous le hero (les deux premières visibles, les quatre suivantes dépliables sur place), sans remplacer le reste |
| `HeroVisual` / `HeroVisualStatic` | 3D chargée à la demande, repli SVG statique si WebGL absent ou `prefers-reduced-motion` | **Réemployer tel quel** ; ne pas ajouter de 3D à la découverte |
| `RevealSection` | Apparition au scroll ; le mouvement réduit est traité par la CSS globale (`prefers-reduced-motion` dans `index.css`), pas par le composant | **Réemployer** pour l'entrée des scènes |
| `ProgressRail` | `<ol>` sémantique, étapes `aria-hidden` avec `aria-label` sur chaque `<li>`, `aria-current` | **Réemployer le motif** (liste ordonnée, état courant annoncé) pour la navigation entre scènes ; pas le composant lui-même (il décrit la méthode de CASA, pas le pipeline) |
| `MiniDiagram` (flux, hiérarchie, matrice) | Sans couleur d'accent (D10), étapes numérotées, texte équivalent | **Réemployer le flux numéroté** pour la vue d'ensemble « 6 étapes » |
| `InteractiveStepPipeline` (616 lignes) | Données du lab `llm-request-pipeline` (7 étapes), SVG défilant, boutons Précédent/Suivant, bascule 3D chargée à la demande | **Ne pas réemployer pour le public** (voir l'écart d'accessibilité ci-dessous) ; **reprendre le texte** des étapes comme matière première |
| `LabDetailPage` | Réservé à la fiche d'un lab ; affiche le pipeline si `interactive_steps` existe | **Aucun changement** ; la découverte ne remplace pas le lab, elle y mène |
| Lab `llm-request-pipeline` (seed) | 7 étapes : réception, tokenisation, embeddings, attention, prefill/KV cache, décodage, détokenisation ; niveau N2–N3, 40 min | **Adapter** au débutant : fusion en 6 scènes, vocabulaire simplifié ; le lab reste le niveau « j'approfondis » |

**Écart d'accessibilité constaté dans `InteractiveStepPipeline` (lecture seule, non reproduit en navigateur).** Les nœuds du schéma sont des `<g onClick>` dans un SVG `role="img"`, sans `tabIndex`, sans rôle bouton ni gestion du clavier. La navigation reste possible au clavier grâce aux boutons Précédent/Suivant, donc ce n'est pas un blocage, mais les nœuds cliquables ne sont pas atteignables au clavier ni annoncés comme interactifs. Le conteneur du SVG défile horizontalement (`overflowX: auto`) : sur 320 px la liste de 7 nœuds se parcourt par défilement latéral. Je n'ai pas de capture qui confirme un défaut visible ; c'est un point à traiter si ce composant devenait public, et c'est une raison de ne pas le réemployer tel quel pour le débutant.

## 3. Avertissement pédagogique : le « N² → N » du KV cache

Le seed (étape « Prefill et cache clé-valeur », et le livrable du lab) affirme que sans cache générer N tokens coûte un calcul « proportionnel à N² » et que « avec lui, il devient proportionnel à N ». Cette promesse globale est trop forte : le cache évite de **recalculer** les clés et valeurs déjà calculées, mais chaque nouveau token doit toujours **lire** tout le cache, donc le coût par token, comme la mémoire utilisée, croissent avec la longueur du contexte. Je ne reprendrai pas cette formule dans la découverte et je propose de la reformuler dans le seed (contenu appartenant au lead backend, que je ne modifie pas). Formulation proposée pour la scène génération : « Le modèle garde en mémoire ce qu'il a déjà calculé sur votre texte pour ne pas tout refaire à chaque mot. Plus la conversation est longue, plus cette mémoire est grande. » Référence citée par ChatGPT : <https://huggingface.co/docs/transformers/cache_explanation>.

## 4. Storyboard proposé : « De votre message à la réponse », 6 scènes

Principes : **simulation locale**, exemples préétablis, aucune API payante, aucune génération côté serveur, et **aucune entrée de la simulation transmise, collectée ni mémorisée** (pas même en stockage du navigateur). Ces garanties portent sur les **entrées de la simulation**, pas sur « aucun réseau » : la SPA charge normalement ses fichiers et lit (GET) les cours et associations publiés (§6) ; ces lectures n'envoient aucun contenu saisi par la personne. Tout découpage, identifiant, vecteur et probabilité affiché est **illustratif** et étiqueté ainsi dans l'écran, jamais présenté comme la sortie d'un vrai modèle. Aucune formulation du type « le modèle réfléchit » ou « comprend ». La découverte **ne valide aucun acquis, aucune compétence, aucun certificat**.

Exemples guidés locaux (3 au choix, aucune saisie libre en V1, dont un en français courant ; textes exacts à relire avec le lead) : « Explique la photosynthèse à un enfant de dix ans. », « Écris un mail pour reporter une réunion. », « Que veut dire RGPD ? ».

| # | Scène | Ce que voit le débutant | Ce qu'il retient | Étiquette de prudence |
| --- | --- | --- | --- | --- |
| 1 | **Votre message** | Le texte choisi s'affiche, avec à côté ce qui s'y ajoute avant l'envoi (consignes de l'application, début de conversation) | Le modèle ne reçoit pas que votre phrase | « Exemple simplifié » |
| 2 | **Découpage en fragments (tokens)** | Le texte se découpe en pastilles de longueurs différentes, chacune avec un numéro | Un modèle lit des fragments, pas des mots ; un mot rare donne plusieurs fragments | « Découpage illustratif : chaque modèle a son propre découpage » ; numéros inventés |
| 3 | **Des fragments aux nombres** | Chaque numéro devient une liste de nombres (quelques valeurs affichées puis « … ») ; une carte à deux axes place « chat » près de « chaton » | Un numéro d'identifiant n'est **pas** un vecteur : le vecteur est une description numérique apprise ; l'ordre des fragments est pris en compte, **selon l'architecture** du modèle (sans prétendre que « la position est ajoutée » partout) | « Valeurs et carte illustratives ; un vrai vecteur compte des centaines ou milliers de nombres » |
| 4 | **Le calcul du modèle** | Des flèches vont **de chaque fragment vers les fragments qui le précèdent et lui-même, jamais vers ceux qui suivent** (masque causal d'un modèle qui écrit à la suite d'un texte) ; un compteur « répété sur de nombreuses couches » | Beaucoup de calculs de pondération sur ce qui précède, pas une lecture de sens | « Schéma très simplifié de l'attention ; aucune interprétation interne n'est montrée » |
| 5 | **Écrire la réponse, fragment par fragment** | Une barre de candidats pour le prochain fragment, un seul est retenu, puis on recommence ; un curseur « prudent ↔ varié » change la répartition | La réponse se construit pas à pas ; le choix n'est pas toujours le plus probable ; le cache de calcul évite de **recalculer** ce qui est déjà fait, sans rendre la génération gratuite : il grossit et coûte toujours plus avec la longueur du contexte | « Probabilités illustratives, non issues d'un vrai modèle » |
| 6 | **La réponse s'affiche** | Les fragments redeviennent du texte, affiché progressivement ; arrêt à la fin | Pourquoi une réponse s'écrit en direct ; pourquoi elle s'arrête | « Réponse d'exemple écrite à l'avance » |

**Clés de scène stables** (registre du contrat, §6) : 1 `message`, 2 `tokens`, 3 `representations`, 4 `model`, 5 `generation`, 6 `response`. Lien avec le lab du seed : réception → 1 ; tokenisation → 2 ; embeddings → 3 ; attention et prefill → 4 ; décodage et cache → 5 ; détokenisation → 6. Vocabulaire à tenir partout : un fragment (token) n'est pas un mot, un numéro n'est pas un vecteur, le modèle n'« écrit pas chaque mot » mais **un fragment à la fois**, et aucun raisonnement interne n'est montré ni prétendu.

Fin de parcours (dans l'accueil ou sur la page complémentaire) : trois sorties, aucune obligatoire : « Voir le cours associé » (§6), « Refaire avec un autre exemple », « Créer un compte pour suivre le cours » (§7). Un rappel : « Cette découverte ne délivre ni note, ni compétence, ni certificat. »

### États et robustesse à prévoir

| Situation | Comportement proposé |
| --- | --- |
| Mouvement réduit demandé | Aucune animation automatique ; chaque scène avance par bouton « Étape suivante » ; texte équivalent complet affiché |
| Pas d'animation, lecteur d'écran, clavier seul | Parcours par liste ordonnée de scènes, boutons natifs, `aria-live` poli pour annoncer le changement de scène, chaque schéma accompagné d'un texte équivalent ; focus déplacé sur le titre de la scène |
| Composant de simulation en échec (erreur de chargement du module ou d'exécution) | Version texte des 6 scènes, **rendue par l'application elle-même**, affichée à la place, jamais une zone vide ; ce n'est **pas** un repli « sans JavaScript » (voir §5) |
| 320, 390, 1440 px | Une scène à la fois sur mobile, schéma sous le texte ; aucune barre de défilement horizontale ; à 1440 le texte et le schéma côte à côte |
| Zoom 200 % | Pas de hauteur fixe ni de texte tronqué ; le **zoom natif du navigateur** est à tester et se distingue d'un viewport réduit ou d'un ratio de pixels émulé (§8) |
| Cours associé retiré ou dépublié **après** la lecture des liens | La fiche peut répondre 404 : afficher un état **« Cours indisponible »** avec issues « Voir le catalogue » et « Mon espace » ; aucune promesse « jamais de 404 » |
| Lecture des liens en erreur (réseau, 5xx) | Message d'erreur **réessayable**, distinct de « aucun cours associé » (état vide) ; les scènes restent utilisables ; une erreur n'est jamais présentée comme une dépublication |
| Mode sombre | Mêmes jetons que le reste de l'application |
| Performance | Aucune 3D, aucune dépendance nouvelle, aucune image lourde ; scènes en SVG/HTML ; le module est chargé à la demande (§5) |
| Saisie libre | **Hors V1** (décision du propriétaire) ; aucun champ de saisie dans le module |

## 5. Où l'installer (révisé : l'interaction est dans l'accueil)

**Proposition.** Un module « Voyez comment une IA répond » directement sous le hero de `/`, qui porte une vraie interaction dès l'arrivée, sans changer de page :

1. **Dans l'accueil, au premier écran de contenu** : choix d'un exemple guidé (3 boutons) puis scènes 1 et 2 vivantes et visibles (le message, puis son découpage en fragments qui apparaît). C'est la « première interaction pédagogique réelle » validée.
2. Un bouton « Continuer : les 4 scènes suivantes » **déplie les scènes 3 à 6 dans l'accueil même** ; pas de navigation obligatoire. Les six scènes restent affichées même si aucune association de cours n'est publiée.
3. Une **page complémentaire facultative** `/decouvrir/comment-repond-une-ia` reprend **le même composant** en pleine page, pour un lien partageable ou une lecture plus posée. Elle n'est pas nécessaire au parcours ; on peut la livrer plus tard ou ne jamais la livrer (voir « Choix ouverts »).

**Poids de l'accueil.** Le module est chargé à la demande : un emplacement de hauteur réservée (sans saut de mise en page) s'affiche d'abord, le code du module est chargé quand le bloc approche de l'écran ou à l'inactivité du navigateur ; en cas d'échec, la version texte (§4). Aucune 3D. La signature Relais IT et le pied de page restent ceux de `RootLayout`. L'ancienne section de cartes et le rail de progression sont conservés, déplacés sous le module.

**Garde-fous.** Visible de tout visiteur, apprenant, ADMIN et SUPER_ADMIN (contenu public, comme le catalogue). Aucun appel pédagogique privé, aucune progression, aucune distinction de rôle. Si la page complémentaire existe, elle s'ajoute à la table des routes connues (`utils/roles.ts`) et au test de correspondance avec `App.tsx`. Découverte publique ≠ profil d'onboarding : la première n'écrit rien ; le second est un questionnement d'inscription séparé, qui réutiliserait le profil d'apprentissage déjà présent dans `ProfilePage`.

**Ce que « repli » veut dire ici, sans en promettre plus.** L'application est une **SPA** (Vite, rendu côté navigateur) : sans JavaScript, l'accueil actuel ne s'affiche déjà pas, et ce n'est pas un défaut propre à ce module. Il n'existe ni rendu côté serveur, ni pages statiques pré-générées. Je ne promets donc **pas** « fonctionne sans JavaScript ». Ce que je propose réellement : (a) mouvement réduit respecté ; (b) version texte rendue par l'application quand le **module** échoue ; (c) rien de plus. Obtenir un vrai contenu lisible sans JavaScript (pré-rendu statique, SSR ou balise `<noscript>`) serait un chantier d'infrastructure à part, à décider séparément : je ne l'inclus pas.

## 6. Notions, leçons et cours : mon alignement sur le contrat du lead

Source : `DISCOVERY_V1.md` (SHA `0a1258f…`). **Rien de ce qui suit n'est livré** : routes, migration et registre sont des propositions du lead que je consomme sans les présupposer.

### 6.1 Principe retenu

Les notions sont les `KnowledgeNode` existants ; l'association **notion → leçon** (`knowledge_node_used_in_lessons`) est éditée dans **l'éditeur de leçon** ; le cours proposé est celui de la leçon (`Lesson.course_id`). Pas de table `discovery_scene_nodes`, pas de correspondance de cours dans le frontend, pas d'écran global « Liens de la découverte ». Ma révision 2 (association scène → notion en base, lecture admin globale) est **abandonnée** au profit de ce modèle.

### 6.2 Registre de scènes (versionné, commun backend/frontend)

Découverte `llm-answer`, `registry_version = 1`, uniquement des identifiants de notions :

| `scene_key` | Scène | Notions (dans l'ordre) |
| --- | --- | --- |
| `message` | Message et contexte | `llm` |
| `tokens` | Tokenisation | `tokenization` |
| `representations` | Représentations numériques | `data-representation`, `embeddings` |
| `model` | Traitement du modèle | `attention`, `transformer` |
| `generation` | Génération et mémoire de calcul | `generation`, `kv-cache` |
| `response` | Réponse lisible et limites | `llm`, `generation` |

Le frontend ne connaît que les **clés et l'ordre** des scènes et reçoit leurs associations du serveur. Il n'embarque aucun identifiant ou titre de cours ou de leçon. Une scène n'est pas un jalon de progression.

### 6.3 Ce que le frontend lit et écrit

| Usage | Route proposée | Comportement frontend |
| --- | --- | --- |
| Liens publics de l'accueil | `GET /api/discoveries/llm-answer/links`, sans authentification, `Cache-Control: no-store` | Une lecture à l'affichage du module ; **aucun cache persistant** ; `retry` explicite sur erreur ; nouvelle lecture au retour de l'édition ; liste vide = « aucun cours associé » (état propre) ; erreur = état distinct réessayable ; 404 = découverte inconnue |
| Référentiel de notions (éditeur) | `GET /api/admin/knowledge-nodes?limit&offset` (1 à 100) | Toutes les pages sont lues (même utilitaire de pagination que pour les parcours) ; recherche par titre côté client ; statut visible (publié, brouillon, archivé) |
| Notions d'une leçon | `GET /api/admin/lessons/{id}/knowledge-nodes` → `{lesson_id, node_ids, revision}` | `revision` est recopié tel quel, jamais calculé |
| Enregistrer | `PUT` même chemin, `{node_ids, expected_revision}` | Remplacement atomique ; `[]` explicite pour retirer ; 200 = état committé |

### 6.4 Sélecteur « Notions » dans `AdminLessonEditPage`

- **Hors du formulaire de la leçon** : une section distincte avec son propre bouton « Enregistrer les notions » (le contrat impose **deux enregistrements explicites** : le texte de la leçon et les notions). Chaque opération affiche son propre succès ou échec ; si la seconde échoue, **la sélection reste affichée et non effacée**.
- **Leçon nouvelle** : l'identifiant n'existe qu'après création. Aujourd'hui l'éditeur retourne au cours après enregistrement. Le service de création renvoie déjà l'identifiant ; je propose, à valider, de **rester sur l'éditeur de la leçon créée** pour que la section Notions soit disponible tout de suite. Sinon : message « Enregistrez la leçon pour associer des notions ».
- **Chargement et panne** : le référentiel et l'état de la leçon sont lus séparément ; une panne affiche une erreur avec « Réessayer » sans vider la sélection ; rien n'est modifiable tant que la révision n'est pas lue.
- **Notions non publiques** : une notion brouillon ou archivée est sélectionnable ; le texte du bandeau est celui du contrat (l'association ne publie ni la notion, ni la leçon, ni le cours, donc rien n'apparaît sur l'accueil).
- **Associations « anciennes » ou invisibles** (par exemple d'un nœud dépublié) : conservées et signalées, jamais retirées par l'interface.
- **Erreurs** (textes du serveur affichés, avec ma formulation d'accompagnement) : 409 cours partagé non couvert ; 409 révision divergente (« Rechargez puis réessayez ») : l'interface **recharge l'état serveur sans écraser la sélection locale**, affiche l'écart (notions ajoutées ou retirées par l'autre éditeur) et laisse la personne décider ; 422 notion introuvable (aucune écriture) ; 403 et 404 comme pour les autres écrans d'administration. Un retry identique après panne réseau renvoie le même état : l'interface le présente comme un succès, pas comme un conflit.
- **Droits** : ADMIN dans son périmètre école ou parcours, SUPER_ADMIN global, cours partagé protégé. L'interface masque ou désactive ce que le serveur refuserait ; **c'est le serveur qui décide**.

### 6.5 Accueil : liens vers les cours

Une fois les scènes dépliées, un bloc « Aller plus loin » liste les cours **dédupliqués** reçus pour la découverte, avec leurs notions. `llm` figure dans deux scènes et `generation` dans deux : un même cours peut revenir, il n'est affiché qu'une fois dans le bloc ; par scène, seuls les cours propres à la scène sont rappelés sous le texte de la scène. Lien vers `/courses/:id`, sans contenu de leçon (réservé aux apprenants).

## 7. Après l'inscription

Le contrat demande : porter **seulement `return_course_id`** en état du routeur (pas d'URL libre), attendre une session et une identité à jour, construire une route interne à segment encodé, la faire passer par le même filtre que `postLoginPath`, puis **revalider `GET /api/courses/{id}`** avant d'y aller.

Ce que j'ai lu dans le code : `register` appelle `authService.register` puis `login`, et **ne renvoie rien** (`login` renvoie l'utilisateur depuis le Lot 1). Pour respecter « identité à jour », `register` devrait renvoyer l'utilisateur comme `login` le fait : petit changement frontend, sans effet de contrat. Autres cas à couvrir :

| Cas | Comportement |
| --- | --- |
| Inscription réussie, cours publié, destination permise | Fiche du cours |
| Cours retiré (404), identifiant invalide ou non vérifiable | `/app/dashboard` avec un message **distinct** selon le cas (retiré / invalide / vérification impossible) ; **l'inscription n'est jamais relancée** après un échec de la vérification |
| Réseau ou 5xx pendant la vérification | État réessayable, pas une preuve de dépublication |
| Cours disparu entre la vérification et l'arrivée | La fiche affiche « Cours indisponible » (issues catalogue et dashboard), pas une page cassée |
| Inscription réussie puis connexion automatique en échec | Cas existant : l'erreur actuelle est générique, et un nouvel essai d'inscription répondrait « email déjà utilisé » ; je propose un message « Compte créé : connectez-vous » (hors contrat, frontend seul) |
| Connexion d'un compte existant | Destination soumise au filtre de rôle ; un ADMIN n'est jamais envoyé vers une activité apprenante |

## 8. Critères d'acceptation (après GO, jamais maintenant)

- **Clavier et lecteurs d'écran** : tout est faisable au clavier ; focus visibles ; texte équivalent pour chaque schéma ; ordre des étapes porté par la structure, pas par la couleur ni par l'animation ; annonce du changement de scène (`aria-live` poli) et focus sur le titre.
- **Mouvement réduit** respecté ; pause possible si une animation existe.
- **Largeurs** : 320, 390, 1440 px **et panneau étroit** ; aucun débordement horizontal ni texte tronqué.
- **Zoom** : zoom natif du navigateur à 200 % **à tester et à ne pas confondre** avec un viewport réduit ou un ratio de pixels émulé ; mon outillage (Chromium piloté par script) émule la taille et la densité mais **n'applique pas le zoom natif de l'interface** : à valider en navigateur réel par une personne ou un outil qui le permet, et à déclarer comme tel.
- **Repli du module** : le texte des six scènes vit dans le bundle React principal, **indépendant du chargement et de l'exécution** du module de simulation ; il couvre l'erreur de chargement **et** l'erreur d'exécution (frontière d'erreur). Ce n'est **pas** une garantie « sans JavaScript » : l'application est une SPA, aucun SSR ni pré-rendu.
- **Performance** : hauteur réservée (pas de saut de mise en page), poids du fragment chargé à la demande et temps de chargement mesurés avant et après ; aucune 3D ; **durée annoncée à mesurer** sur des essais réels, sans promesse arbitraire.
- **Réseau** : aucune requête n'emporte les choix d'exemple ou de scène ; seuls le chargement normal de la SPA et les GET de métadonnées sont observés ; aucune télémétrie par défaut ni stockage persistant d'entrée de simulation.
- **États** : chargement, liste vide, erreur réessayable, cours indisponible, retour d'inscription (§7), module en erreur.
- **Frontend (tests)** : sélecteur avec plus d'une page du référentiel ; chargement, erreur et 409 sans perte de sélection ; deux enregistrements indépendants ; retry identique ; destination invalide, externe ou encodée refusée ; cours qui disparaît entre vérification et navigation ; absence de requête contenant les choix.
- D10 respecté ; aucune dépendance nouvelle.

## 9. Réserves et confirmations techniques concrètes (à l'attention du lead)

| # | Point | Position |
| --- | --- | --- |
| R1 | **Registre de scènes** | **Confirmé** : clés et ordre du §6.2 adoptés. Réserve : prévoir que le frontend **ignore sans erreur** un `registry_version` supérieur à celui qu'il connaît (les scènes s'affichent, sans liens) et que le serveur ne **réordonne ni ne renomme** une clé sans incrémenter la version |
| R2 | **Statut initial des trois nouvelles notions** (`tokenization`, `generation`, `kv-cache`) | **Confirmé PUBLISHED**, sans liaison : elles ne rendent aucun cours visible à elles seules. Réserve : le lead précise que le **titre** ne change pas sans migration, car il est servi publiquement par le GET groupé |
| R3 | **Routes** | Confirmées. Réserve : `GET /api/discoveries/{key}/links` est public et `no-store` ; le frontend ne l'appelle qu'à **l'arrivée du module à l'écran** (pas à chaque chargement de l'accueil) pour ne pas solliciter la base pour les visiteurs qui repartent aussitôt. Le lead juge si une limite de débit ou un cache **serveur** court est souhaitable (le contrat interdit seulement le cache **frontend** persistant) |
| R4 | **Concurrence** | Confirmée. Réserve : après un 409, le frontend recharge `GET` et **n'envoie jamais** automatiquement une nouvelle `revision` avec la sélection locale ; il faut une action explicite de la personne. À confirmer que le retry identique **avec une révision périmée** renvoie bien 200 (§5 point 4 du contrat) |
| R5 | **Permissions** | Confirmées. Réserve : l'ADMIN lit le référentiel commun (`GET /api/admin/knowledge-nodes`) sans voir de lien vers les leçons d'autres administrateurs ; confirmer que cette route **ne renvoie aucun champ** permettant de les déduire |
| R6 | **Retour d'inscription** | Confirmé (§7). Réserve : `register` doit renvoyer l'utilisateur (changement frontend seulement, sans contrat) ; pas de changement backend |
| R7 | **Création de leçon** | Réserve d'ergonomie : rester sur l'éditeur après création, pour associer des notions sans détour. Aucun contrat touché |
| R8 | **Textes scientifiques** (O7) | Je soumets les textes des six scènes à la relecture du lead **avant** tout GO : token ≠ mot, numéro ≠ vecteur, masque causal, ordre selon l'architecture, cache non magique, aucun raisonnement interne prétendu |
| R9 | **Ancien texte du lab KV cache** (O10) | Reste une tâche lead distincte à borner : l'accueil ne reprend pas la formule N² → N ; je ne touche ni au seed ni au lab |
| R10 | **Durée** (O4) | Pas de « ≈ 4 minutes » : à mesurer après prototype validé |

Statut des douze choix (tableau du lead §9) : O1, O2, O5, O9, O11 validés ; O3 (page complémentaire) facultative et hors V1 ; O4 et O10 reportés comme ci-dessus ; O6 (navigation) : liste ordonnée avec « précédent / suivant » et dépliage des scènes 3 à 6, dans les contraintes clavier, relevant du design ; O7 R8 ; O8 R1 à R5 ; O12 aucun engagement sans JavaScript.

## 10. Limites

Lecture statique des sources et du contrat ; aucune route ni migration n'existe ; mes réserves sont des lectures de code et de document, non des essais. Pas de navigateur, de capture, de prototype ni de CI. Le zoom natif à 200 % ne peut pas être validé avec mon outillage actuel. Les cours historiques du seed restent sans valeur d'association : aucune sélection de cours n'est faite. Aucune dépendance, écriture en base, migration ni changement d'instance ; aucun merge, déploiement ni PR.
