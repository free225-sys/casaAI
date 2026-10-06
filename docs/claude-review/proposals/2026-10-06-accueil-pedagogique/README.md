# Proposition — accueil pédagogique « comment une IA répond à un message » (TASK-20261006-001)

**Révision 2** (suite à `MSG-20261006-003`, décision du propriétaire du 6 octobre 10:33 UTC). Document de conception **sans aucun code**. Base auditée : frontend `9eb451495a4bebb38d644eb3a868301d3f8a4754`, backend `72261b84e2c0a457ef20aa290a89fcdf1c5bc2d6` (lecture statique des sources, `backend/scripts/seed.py` et `backend/data/casa_data.json`). Je n'ai exécuté ni navigateur, ni test, ni serveur, et je n'ai lu aucune recette : ce qui suit vient du code. Rien n'est à implémenter avant le GO explicite du propriétaire.

## 0. Ce qui est validé, ce qui ne l'est pas

| Élément | Statut |
| --- | --- |
| Une **première interaction pédagogique réelle directement dans l'accueil** (pas un simple teaser vers une autre page) ; une page complémentaire reste **facultative** | **Validé (principe)** |
| Les **liens notions → cours sont administrables dès la V1** (pas de tableau figé dans le code) | **Validé (principe)** |
| Les six scènes, la durée, les exemples guidés ou la saisie libre, la navigation, les textes scientifiques, le rôle de SUPER_ADMIN et l'édition globale | **Propositions non validées** |
| Tout code, prototype exécutable, dépendance, DB, migration, instance, merge, déploiement | **Interdit tant qu'il n'y a pas de GO explicite** |

Les routes et tables proposées au §6 **n'existent pas** : ce sont des propositions à soumettre au lead backend, non des acquis.

## 1. Ce que l'accueil fait aujourd'hui

`HomePage.tsx` (73 lignes) : un hero (titre, deux boutons « Créer un compte » vers `/register` et « Explorer le catalogue » vers `/catalog`, `HeroVisual`), le rail `ProgressRail` (séquence pédagogique du cahier des charges) puis trois cartes (parcours, laboratoires, certifications). Aucune notion d'IA n'est expliquée sur la page : un débutant voit une promesse, pas une première compréhension. `RegisterPage.tsx` envoie toujours vers `/app/dashboard` après l'inscription (ligne `navigate("/app/dashboard", …)`), sans retour possible vers ce que la personne regardait.

## 2. Réemploi ou nouveau, composant par composant

| Élément | Constat (lecture du code) | Verdict |
| --- | --- | --- |
| `HomePage` | Structure simple, sections indépendantes | **Réemployer** ; ajouter un seul teaser vers la découverte, ne pas la remplacer |
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

Exemples préétablis (3 au choix, dont un en français courant) : « Explique la photosynthèse à un enfant de dix ans. », « Écris un mail pour reporter une réunion. », « Que veut dire RGPD ? ».

| # | Scène | Ce que voit le débutant | Ce qu'il retient | Étiquette de prudence |
| --- | --- | --- | --- | --- |
| 1 | **Votre message** | Le texte choisi s'affiche, avec à côté ce qui s'y ajoute avant l'envoi (consignes de l'application, début de conversation) | Le modèle ne reçoit pas que votre phrase | « Exemple simplifié » |
| 2 | **Découpage en fragments (tokens)** | Le texte se découpe en pastilles de longueurs différentes, chacune avec un numéro | Un modèle lit des fragments, pas des mots ; un mot rare donne plusieurs fragments | « Découpage illustratif : chaque modèle a son propre découpage » ; numéros inventés |
| 3 | **Des fragments aux nombres** | Chaque numéro devient une liste de nombres (quelques valeurs affichées puis « … ») ; une carte à deux axes place « chat » près de « chaton » | Un numéro d'identifiant n'est **pas** un vecteur : le vecteur est une description numérique apprise ; la position dans la phrase est ajoutée | « Valeurs et carte illustratives ; un vrai vecteur compte des centaines ou milliers de nombres » |
| 4 | **Le calcul du modèle** | Des flèches entre pastilles montrent que chaque fragment pondère les autres ; un compteur « répété sur de nombreuses couches » | Beaucoup de calculs de pondération, pas une lecture de sens | « Schéma très simplifié de l'attention ; aucune interprétation interne n'est montrée » |
| 5 | **Écrire la réponse, fragment par fragment** | Une barre de candidats pour le prochain fragment, un seul est retenu, puis on recommence ; un curseur « prudent ↔ varié » change la répartition | La réponse se construit pas à pas ; le choix n'est pas toujours le plus probable ; la mémoire de calcul (cache) évite de tout refaire mais grossit avec la longueur | « Probabilités illustratives, non issues d'un vrai modèle » |
| 6 | **La réponse s'affiche** | Les fragments redeviennent du texte, affiché progressivement ; arrêt à la fin | Pourquoi une réponse s'écrit en direct ; pourquoi elle s'arrête | « Réponse d'exemple écrite à l'avance » |

Lien avec le seed : réception → 1 ; tokenisation → 2 ; embeddings et position → 3 ; attention et prefill/KV cache → 4 (la mémoire de calcul est évoquée en 5) ; décodage → 5 ; détokenisation → 6.

Fin de parcours (dans l'accueil ou sur la page complémentaire) : trois sorties, aucune obligatoire : « Voir le cours associé » (§6), « Refaire avec un autre exemple », « Créer un compte pour suivre le cours » (§7). Un rappel : « Cette découverte ne délivre ni note, ni compétence, ni certificat. »

### États et robustesse à prévoir

| Situation | Comportement proposé |
| --- | --- |
| Mouvement réduit demandé | Aucune animation automatique ; chaque scène avance par bouton « Étape suivante » ; texte équivalent complet affiché |
| Pas d'animation, lecteur d'écran, clavier seul | Parcours par liste ordonnée de scènes, boutons natifs, `aria-live` poli pour annoncer le changement de scène, chaque schéma accompagné d'un texte équivalent ; focus déplacé sur le titre de la scène |
| Composant de simulation en échec (erreur de chargement du module ou d'exécution) | Version texte des 6 scènes, **rendue par l'application elle-même**, affichée à la place, jamais une zone vide ; ce n'est **pas** un repli « sans JavaScript » (voir §5) |
| 320, 390, 1440 px | Une scène à la fois sur mobile, schéma sous le texte ; aucune barre de défilement horizontale ; à 1440 le texte et le schéma côte à côte |
| Zoom 200 % | Pas de hauteur fixe ni de texte tronqué ; test rejoué avec viewport réduit |
| Cours associé dépublié ou retiré | Le lien est masqué et remplacé par « Voir le catalogue » ; jamais une page 404 |
| Mode sombre | Mêmes jetons que le reste de l'application |
| Performance | Aucune 3D, aucune dépendance nouvelle, aucune image lourde ; scènes en SVG/HTML ; le module est chargé à la demande (§5) |
| Saisie libre (si retenue, voir D3) | Traitée localement, sans envoi ni mémorisation ; limitée à ~140 caractères ; découpage **par règle simple et signalé comme tel** (je ne peux pas reproduire fidèlement un vrai tokenizer sans dépendance ni modèle) |

## 5. Où l'installer (révisé : l'interaction est dans l'accueil)

**Proposition.** Un module « Voyez comment une IA répond » directement sous le hero de `/`, qui porte une vraie interaction dès l'arrivée, sans changer de page :

1. **Dans l'accueil, au premier écran de contenu** : choix d'un exemple (3 boutons) puis scènes 1 et 2 vivantes (le message, puis son découpage en fragments qui apparaît). C'est la « première interaction pédagogique réelle » validée.
2. Un bouton « Continuer : les 4 scènes suivantes » **déroule la suite dans l'accueil même** (scènes 3 à 6) ; pas de navigation obligatoire.
3. Une **page complémentaire facultative** `/decouvrir/comment-repond-une-ia` reprend **le même composant** en pleine page, pour un lien partageable ou une lecture plus posée. Elle n'est pas nécessaire au parcours ; on peut la livrer plus tard ou ne jamais la livrer (voir « Choix ouverts »).

**Poids de l'accueil.** Le module est chargé à la demande : un emplacement de hauteur réservée (sans saut de mise en page) s'affiche d'abord, le code du module est chargé quand le bloc approche de l'écran ou à l'inactivité du navigateur ; en cas d'échec, la version texte (§4). Aucune 3D. La signature Relais IT et le pied de page restent ceux de `RootLayout`. L'ancienne section de cartes et le rail de progression sont conservés, déplacés sous le module.

**Garde-fous.** Visible de tout visiteur, apprenant, ADMIN et SUPER_ADMIN (contenu public, comme le catalogue). Aucun appel pédagogique privé, aucune progression, aucune distinction de rôle. Si la page complémentaire existe, elle s'ajoute à la table des routes connues (`utils/roles.ts`) et au test de correspondance avec `App.tsx`. Découverte publique ≠ profil d'onboarding : la première n'écrit rien ; le second est un questionnement d'inscription séparé, qui réutiliserait le profil d'apprentissage déjà présent dans `ProfilePage`.

**Ce que « repli » veut dire ici, sans en promettre plus.** L'application est une **SPA** (Vite, rendu côté navigateur) : sans JavaScript, l'accueil actuel ne s'affiche déjà pas, et ce n'est pas un défaut propre à ce module. Il n'existe ni rendu côté serveur, ni pages statiques pré-générées. Je ne promets donc **pas** « fonctionne sans JavaScript ». Ce que je propose réellement : (a) mouvement réduit respecté ; (b) version texte rendue par l'application quand le **module** échoue ; (c) rien de plus. Obtenir un vrai contenu lisible sans JavaScript (pré-rendu statique, SSR ou balise `<noscript>`) serait un chantier d'infrastructure à part, à décider séparément : je ne l'inclus pas.

## 6. Des notions aux cours : liens administrables dès la V1 (contrat à proposer au lead)

### Ce que contient déjà le code (lu, rien exposé)

- Modèle `KnowledgeNode` (`backend/app/models/knowledge.py`) : `id`, `title`, `stage`, `formula`, `guiding_question`, `status` (`ContentStatus`, donc publication possible), applications, dépendances, et les tables `knowledge_node_used_in_lessons` (nœud → leçons), `knowledge_node_demos`, `knowledge_node_labs`. Le seed (`seed_knowledge_graph`) les remplit à partir de 16 nœuds du jeu historique.
- **Aucune route ne les expose**, ni en lecture publique ni en administration (aucun fichier de `backend/app/api/` ne les mentionne hors `progress.py` pour d'autres sujets) ; `course_skills` non plus.
- Les 16 nœuds du jeu historique ne recouvrent pas les six scènes : on y trouve `data-representation`, `embeddings`, `attention`, `transformer`, `llm`, mais **ni « découpage en fragments », ni « génération/échantillonnage », ni « cache clé-valeur »**. Il faudra soit des nœuds nouveaux (administrés), soit accepter qu'une scène n'ait pas de nœud. Ces nœuds et leurs leçons restent des **candidats à vérifier**, pas des associations validées.

### Principe de réemploi

Un nœud de connaissance représente une **notion**. Une **scène** de la découverte est associée à une ou plusieurs notions (nœuds). Chaque notion est reliée à des **leçons** (table existante), et le cours à proposer est celui de la leçon (`lesson.course_id`). Pas de nouvelle taxonomie : on ajoute seulement l'association « scène → notion ».

### Contrat proposé (à valider avec le lead ; **non existant**)

| Élément | Proposition | Notes |
| --- | --- | --- |
| Donnée à ajouter | Une association `discovery_scene_nodes(scene_key, node_id, position)` pour une ou des découvertes nommées (clé stable, p. ex. `llm-answer`) | `scene_key` est un identifiant stable de scène (valeurs fixées par le frontend, 6 au départ) ; nommer plutôt que numéroter permet de réordonner |
| Lecture publique | `GET /api/public/discoveries/{discovery_key}/links` → pour chaque scène : notions (`id`, `title`, `guiding_question`) et cours liés (`id`, `title`, `level`) | N'expose **que** les nœuds `PUBLISHED`, et seulement les cours/leçons `PUBLISHED` ; jamais le contenu d'une leçon ; aucune donnée utilisateur ; réponse mise en cache côté client |
| États | `[]` pour une scène sans lien (pas d'erreur) ; 404 si la découverte n'existe pas ; erreur réseau → l'interface affiche « Voir le catalogue » | Lien retiré ou dépublié : absent de la réponse, jamais un lien mort |
| Lecture admin | `GET /api/admin/discoveries/{key}/links` (toutes publications, avec statut) | Réservé aux rôles autorisés |
| Écriture admin | `PUT /api/admin/discoveries/{key}/scenes/{scene_key}/links` : remplacement atomique de la liste de notions de la scène | Même modèle que `PUT /api/admin/users/{id}/scopes` ; refus 422 si nœud inexistant, 409 si doublon, 404 si scène inconnue |
| Édition des notions/leçons | Réutiliser, plus tard, une gestion des nœuds (création, statut, leçons liées) ; **hors périmètre de la V1** si les nœuds existants suffisent | À arbitrer |
| Validation des références | Le backend refuse un nœud ou une leçon inexistants ; il **ne refuse pas** un nœud non publié (il reste administrable en brouillon) mais ne le sert pas en public | |
| Permissions et gouvernance | **À arbitrer** : un ADMIN limité à ses écoles ou parcours peut-il lier une notion ? Le texte d'accueil étant global, je recommande **SUPER_ADMIN seul** pour l'écriture en V1, avec lecture pour ADMIN ; un cours partagé entre parcours ne doit pas devenir lié par un ADMIN qui ne le couvre pas (mêmes protections que les cours partagés du Lot 2) | Rôle de SUPER_ADMIN et édition globale : décision du propriétaire |
| Migration | Une migration (nouvelle table) ; aucune donnée existante modifiée | Calendrier et recette : lead |

Je ne présente aucune de ces routes comme existante ni ne prétends qu'elles sont validées : c'est une **demande de contrat**. Côté frontend, je prévois : un service `discoveryService` (lecture publique), un écran d'administration « Liens de la découverte » (liste des scènes, ajout/retrait/ordre des notions, état de chaque lien : publié, brouillon, retiré), et dans l'accueil des liens « Aller plus loin : <cours> » qui disparaissent d'eux-mêmes s'il n'y a rien de publié.

### Candidats du jeu historique (à vérifier avant tout lien)

Seulement pour fixer les idées ; **aucun n'est validé** : cours `genai` (IA générative et prompt engineering, N1–N2), leçons `llm-basics`, `prompt-anatomy`, `prompt-evaluation` ; cours `rag`, leçon `embeddings` ; cours `llm-engineering`, leçons `tokenizer-engineering`, `pretraining-objectives` ; cours `llm-systems`, leçon `kv-cache-batching` (N4) ; nœuds `data-representation`, `embeddings`, `attention`, `transformer`, `llm`. La recette (ChatGPT) ne contient aucun cours public et ne confirme aucun de ces liens ; le seed garde une liste d'identifiants fusionnés, preuve que les identifiants bougent.

### Contraintes à préserver

Seuls les contenus `PUBLISHED` sont visibles en public ; le contenu complet d'une leçon reste réservé aux apprenants (`RequireLearner`) : un lien public mène à la fiche publique `/courses/:id`, jamais à une leçon ; scopes école/parcours et protections des cours partagés respectés pour l'écriture ; une scène sans lien reste valable.

## 7. Après l'inscription

Aujourd'hui l'inscription mène toujours à `/app/dashboard`. Proposition : transmettre le cours visé (état du routeur, comme `ProtectedRoute` le fait déjà pour `state.from`) du lien « Créer un compte pour suivre ce cours » à l'inscription, puis revenir à `/courses/:id` **uniquement** si la destination est une **route interne connue, accessible à un apprenant** (même filtre que `postLoginPath`). Aucune URL externe ni chemin libre n'est suivi (pas de redirection ouverte) ; un identifiant de cours inexistant ou dépublié retombe sur le comportement actuel. Un nouveau compte étant LEARNER, les gardes de rôle restent inchangés.

## 8. Critères d'acceptation (à rejouer à l'implémentation)

- Tout est faisable **au clavier** ; ordre de tabulation et focus visibles ; chaque schéma a un texte équivalent ; l'ordre des étapes ne repose ni sur la couleur ni sur une animation seule ; annonce du changement de scène (`aria-live` poli) et focus sur le titre.
- Mouvement réduit respecté, pause possible si une animation existe.
- 320, 390, 1440 px et zoom 200 % : pas de débordement horizontal ni de texte tronqué ; rejoué en navigateur réel (`scrollWidth`, axe-core), en distinguant émulation et zoom natif.
- **Performance** : pas de saut de mise en page à l'arrivée du module (hauteur réservée) ; poids ajouté à l'accueil mesuré (taille du fragment chargé à la demande) et temps de chargement avant/après ; aucune 3D.
- **Réseau** : aucune requête n'emporte le texte d'un exemple ou d'une saisie ; seules les lectures GET des liens publiés et le chargement normal de la SPA sont observées (vérifié dans le navigateur).
- Aucune formulation qui prête une pensée au modèle ; chaque donnée illustrative est étiquetée ; l'attention est présentée comme causale (un fragment ne regarde que les précédents pour la génération) et le cache comme évitant des recalculs sans supprimer la croissance avec le contexte.
- États : chargement, échec du module (version texte), lien retiré ou dépublié, aucune association, erreur réseau des liens.
- D10 respecté ; tests de composants (liste ordonnée, étiquettes, version texte, disparition d'un lien retiré, absence de requête avec le texte saisi, filtre de destination après inscription) et tests du service de liens.

## 9. Choix encore ouverts, avec impacts

| # | Question | Impact si l'on choisit… | Recommandation |
| --- | --- | --- | --- |
| O1 | Nombre et contenu des scènes (6 proposées) | Moins de scènes : accueil plus léger, moins d'explication ; plus : parcours plus long | À valider avec le propriétaire ; commencer à 6 |
| O2 | Quelles scènes sont jouables **dans l'accueil** et lesquelles seulement dans l'extension | Tout dans l'accueil : page longue ; seulement 1–2 : l'accueil reste léger, la suite dans la page facultative | Scènes 1 et 2 vivantes + suite dépliable dans l'accueil |
| O3 | Page complémentaire `/decouvrir/…` : oui ou non, maintenant ou plus tard | Oui : lien partageable, une route de plus à maintenir ; non : tout dans `/` | Plus tard, sur besoin de partage |
| O4 | Durée annoncée (≈ 4 min) et niveau (N1) | Texte d'accueil et critères | À valider |
| O5 | Exemples guidés seulement ou aussi saisie libre | Saisie libre : découpage simplifié obligatoire et signalé (pas de vrai tokenizer sans dépendance ni modèle), plus de cas limites | Exemples guidés d'abord |
| O6 | Navigation : un bouton « suivant » ou aussi un accès direct à chaque scène | Accès direct : plus de contrôles à rendre accessibles | Liste ordonnée + « suivant/précédent » |
| O7 | Textes scientifiques (formulations tokens/vecteurs, attention, cache) | Chaque phrase engage la rigueur de l'accueil | Revue par le lead avant toute mise en ligne |
| O8 | Contrat de liens (§6) : routes, table, périmètre de la V1 | Détermine le délai : sans lecture publique, aucun lien ne peut s'afficher | À arbitrer avec le lead |
| O9 | Gouvernance : qui écrit les liens et les textes (SUPER_ADMIN seul ? ADMIN dans son périmètre ?) | Écriture ADMIN : règles de périmètre à concevoir ; SUPER_ADMIN seul : simple mais centralisé | SUPER_ADMIN seul en V1 |
| O10 | Reformuler le « N² → N » du seed (§3) | Cohérence du lab et de l'accueil | Oui, par le lead backend ; je fournis le texte |
| O11 | Retour au cours après inscription (§7) | Un paramètre de plus à valider côté frontend | Oui |
| O12 | Repli sans JavaScript (pré-rendu, SSR) | Chantier d'infrastructure sans rapport avec ce module | Non pour l'instant |

## 10. Limites

Lecture statique seulement : pas de navigateur, de capture ni de recette ; CI non consultée. Le contrat du §6 est une **proposition**, aucune route ni table n'existe ; il n'a pas été confronté au lead. Les correspondances notions → cours viennent du jeu de données historique, non de la recette. L'écart d'accessibilité du §2 est une lecture de code, non reproduite. Le storyboard n'a pas de prototype. Aucune dépendance, écriture en base, migration ni changement d'instance ; aucun merge, déploiement ni PR.
