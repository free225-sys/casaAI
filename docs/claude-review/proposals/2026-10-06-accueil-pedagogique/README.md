# Proposition — accueil pédagogique « comment une IA répond à un message » (TASK-20261006-001)

Document de conception **sans aucun code**. Base auditée : frontend `9eb451495a4bebb38d644eb3a868301d3f8a4754`, backend `72261b84e2c0a457ef20aa290a89fcdf1c5bc2d6` (lecture statique des sources, `backend/scripts/seed.py` et `backend/data/casa_data.json`). Je n'ai exécuté ni navigateur, ni test, ni serveur, et je n'ai lu aucune recette : ce qui suit vient du code. Rien n'est à implémenter avant la validation du propriétaire (voir « Décisions à prendre »).

## 1. Ce que l'accueil fait aujourd'hui

`HomePage.tsx` (73 lignes) : un hero (titre, deux boutons « Créer un compte » vers `/register` et « Explorer le catalogue » vers `/catalog`, `HeroVisual`), le rail `ProgressRail` (séquence pédagogique du cahier des charges) puis trois cartes (parcours, laboratoires, certifications). Aucune notion d'IA n'est expliquée sur la page : un débutant voit une promesse, pas une première compréhension. `RegisterPage.tsx` envoie toujours vers `/app/dashboard` après l'inscription (ligne `navigate("/app/dashboard", …)`), sans retour possible vers ce que la personne regardait.

## 2. Réemploi ou nouveau, composant par composant

| Élément | Constat (lecture du code) | Verdict |
| --- | --- | --- |
| `HomePage` | Structure simple, sections indépendantes | **Réemployer** ; ajouter un seul teaser vers la découverte, ne pas la remplacer |
| `HeroVisual` / `HeroVisualStatic` | 3D chargée à la demande, repli SVG statique si WebGL absent ou `prefers-reduced-motion` | **Réemployer tel quel** ; ne pas ajouter de 3D à la découverte |
| `RevealSection` | Apparition au scroll, déjà prévue pour le mouvement réduit | **Réemployer** pour l'entrée des scènes |
| `ProgressRail` | `<ol>` sémantique, étapes `aria-hidden` avec `aria-label` sur chaque `<li>`, `aria-current` | **Réemployer le motif** (liste ordonnée, état courant annoncé) pour la navigation entre scènes ; pas le composant lui-même (il décrit la méthode de CASA, pas le pipeline) |
| `MiniDiagram` (flux, hiérarchie, matrice) | Sans couleur d'accent (D10), étapes numérotées, texte équivalent | **Réemployer le flux numéroté** pour la vue d'ensemble « 6 étapes » |
| `InteractiveStepPipeline` (616 lignes) | Données du lab `llm-request-pipeline` (7 étapes), SVG défilant, boutons Précédent/Suivant, bascule 3D chargée à la demande | **Ne pas réemployer pour le public** (voir l'écart d'accessibilité ci-dessous) ; **reprendre le texte** des étapes comme matière première |
| `LabDetailPage` | Réservé à la fiche d'un lab ; affiche le pipeline si `interactive_steps` existe | **Aucun changement** ; la découverte ne remplace pas le lab, elle y mène |
| Lab `llm-request-pipeline` (seed) | 7 étapes : réception, tokenisation, embeddings, attention, prefill/KV cache, décodage, détokenisation ; niveau N2–N3, 40 min | **Adapter** au débutant : fusion en 6 scènes, vocabulaire simplifié ; le lab reste le niveau « j'approfondis » |

**Écart d'accessibilité constaté dans `InteractiveStepPipeline` (lecture seule, non reproduit en navigateur).** Les nœuds du schéma sont des `<g onClick>` dans un SVG `role="img"`, sans `tabIndex`, sans rôle bouton ni gestion du clavier. La navigation reste possible au clavier grâce aux boutons Précédent/Suivant, donc ce n'est pas un blocage, mais les nœuds cliquables ne sont pas atteignables au clavier ni annoncés comme interactifs. Le conteneur du SVG défile horizontalement (`overflowX: auto`) : sur 320 px la liste de 7 nœuds se parcourt par défilement latéral. Je n'ai pas de capture qui confirme un défaut visible ; c'est un point à traiter si ce composant devenait public, et c'est une raison de ne pas le réemployer tel quel pour le débutant.

## 3. Avertissement pédagogique : le « N² → N » du KV cache

Le seed (étape « Prefill et cache clé-valeur », et le livrable du lab) affirme que sans cache générer N tokens coûte un calcul « proportionnel à N² » et que « avec lui, il devient proportionnel à N ». Cette promesse globale est trop forte : le cache évite de **recalculer** les clés et valeurs déjà calculées, mais chaque nouveau token doit toujours **lire** tout le cache, donc le coût par token, comme la mémoire utilisée, croissent avec la longueur du contexte. Je ne reprendrai pas cette formule dans la découverte et je propose de la reformuler dans le seed (contenu appartenant au lead backend, que je ne modifie pas). Formulation proposée pour la scène génération : « Le modèle garde en mémoire ce qu'il a déjà calculé sur votre texte pour ne pas tout refaire à chaque mot. Plus la conversation est longue, plus cette mémoire est grande. » Référence citée par ChatGPT : <https://huggingface.co/docs/transformers/cache_explanation>.

## 4. Storyboard proposé : « De votre message à la réponse », 6 scènes

Principes : **simulation locale**, exemples préétablis, aucun appel réseau, aucune API payante, aucune saisie collectée, transmise ni mémorisée (pas même en stockage du navigateur). Tout découpage, identifiant, vecteur et probabilité affiché est **illustratif** et étiqueté ainsi dans l'écran, jamais présenté comme la sortie d'un vrai modèle. Aucune formulation du type « le modèle réfléchit » ou « comprend ». La découverte **ne valide aucun acquis, aucune compétence, aucun certificat**.

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

Fin de parcours : trois sorties, aucune obligatoire : « Voir le cours associé » (§6), « Refaire avec un autre exemple », « Créer un compte pour suivre le cours » (§7). Un rappel : « Cette découverte ne délivre ni note, ni compétence, ni certificat. »

### États et robustesse à prévoir

| Situation | Comportement proposé |
| --- | --- |
| Mouvement réduit demandé | Aucune animation automatique ; chaque scène avance par bouton « Étape suivante » ; texte équivalent complet affiché |
| Pas d'animation, lecteur d'écran, clavier seul | Parcours par liste ordonnée de scènes, boutons natifs, `aria-live` poli pour annoncer le changement de scène, chaque schéma accompagné d'un texte équivalent ; focus déplacé sur le titre de la scène |
| JavaScript lent ou composant en échec | Version texte statique des 6 scènes (même contenu, sans animation) affichée à la place, jamais une zone vide |
| 320, 390, 1440 px | Une scène à la fois sur mobile, schéma sous le texte ; aucune barre de défilement horizontale ; à 1440 le texte et le schéma côte à côte |
| Zoom 200 % | Pas de hauteur fixe ni de texte tronqué ; test rejoué avec viewport réduit |
| Cours associé dépublié ou retiré | Le lien est masqué et remplacé par « Voir le catalogue » ; jamais une page 404 |
| Mode sombre | Mêmes jetons que le reste de l'application |
| Performance | Aucune 3D, aucune dépendance nouvelle, aucune image lourde ; scènes en SVG/HTML ; chargement de la route à la demande |
| Saisie libre (si retenue, voir D3) | Traitée localement, sans envoi ni mémorisation ; limitée à ~140 caractères ; découpage **par règle simple et signalé comme tel** (je ne peux pas reproduire fidèlement un vrai tokenizer sans dépendance ni modèle) |

## 5. Où l'installer

| Option | Description | Avantages | Inconvénients |
| --- | --- | --- | --- |
| **A. Section dans `/`** | Les 6 scènes sous le hero | Visible tout de suite | Allonge fortement l'accueil ; mélange vitrine et découverte ; charge le chargement initial |
| **B. Route publique dédiée (recommandée)** | `/decouvrir/comment-repond-une-ia` ; sur `/`, un bloc d'accroche et un bouton « Voir comment une IA répond (≈ 4 min) » | Accueil léger ; découverte partageable par lien ; chargement à la demande ; pas de conflit avec les gardes | Une page de plus à maintenir ; un clic de plus |

Pour B : la route est publique, à ajouter à la table des routes connues (`utils/roles.ts`, dont le test de correspondance avec `App.tsx` la couvrirait), visible aussi d'un ADMIN et d'un SUPER_ADMIN (contenu public, comme le catalogue). La signature Relais IT et le pied de page existent déjà (RootLayout). Découverte publique ≠ profil d'onboarding : la première n'écrit rien nulle part ; le second est un questionnement d'inscription (niveau, objectif) à traiter séparément, en réutilisant le profil d'apprentissage déjà présent dans `ProfilePage`.

## 6. Des notions aux cours administrés

Contraintes lues dans le code : en public, seuls les contenus `PUBLISHED` sont visibles ; le contenu complet d'une leçon est réservé aux apprenants (`/app/lessons/:id` passe par `RequireLearner`) ; la fiche publique d'un cours est `/courses/:courseId`. Un lien public ne peut donc viser qu'un **cours**, pas une leçon. Les cours et leçons ci-dessous sont les **candidats du jeu de données historique** (`backend/data/casa_data.json`), à ne pas figer : les identifiants peuvent fusionner ou être renommés (le seed garde déjà des listes d'identifiants fusionnés), et la lecture de la recette par ChatGPT indique zéro cours public, donc **aucun lien n'a pu être validé en conditions réelles**.

| Scène | Cours candidat (identifiant, titre, niveau) | Leçon candidate | Approfondissement |
| --- | --- | --- | --- |
| 2 Découpage | `genai` — IA générative et prompt engineering, N1–N2 | `llm-basics` — Tokens, contexte et génération (N1, 28 min) | `llm-engineering` : `tokenizer-engineering` (N3) |
| 3 Nombres et vecteurs | `rag` — RAG et recherche documentaire, N2–N3 | `embeddings` — Embeddings et recherche sémantique (N2, 34 min) | `deep-learning` |
| 4 Calcul du modèle | `genai` | `llm-basics` | `llm-engineering` : `pretraining-objectives` |
| 5 Écriture de la réponse | `genai` | `llm-basics`, `prompt-anatomy` | `llm-systems` : `kv-cache-batching` (N4) |
| 6 Réponse | `genai` | `prompt-evaluation` | lab `llm-request-pipeline` |

### Architecture à comparer

| | **A. Correspondances éditoriales à identifiants stables** | **B. Gestion par l'administration** |
| --- | --- | --- |
| Principe | Un petit tableau versionné dans le frontend associe chaque scène à un ou plusieurs identifiants de cours ; à l'affichage on interroge la fiche publique `/courses/:id` ; absent ou non publié → repli sur le catalogue | Les liens deviennent des données, éditables par un administrateur, en réutilisant `KnowledgeNode` et `knowledge_node_used_in_lessons` plutôt qu'une seconde taxonomie |
| Contrat backend | Aucun nouveau | Il en faudrait un : le graphe de connaissance et `course_skills` ne sont pas exposés ni éditables par les API actuelles ; à concevoir avec le lead (périmètres école/parcours, cours partagés, SUPER_ADMIN) |
| Risque | Lien mort si un cours disparaît, couvert par le repli ; édition par une personne qui sait modifier le code | Contrat, migration, droits ; gouvernance à arbitrer |
| Délai | Court | Long |
| Recommandation | **À faire d'abord**, avec une interface de lecture qui ne dépend pas du choix | À reprendre après usage réel, **seulement** si l'édition fréquente le justifie |

Gouvernance globale de l'accueil (qui peut changer les textes, les exemples et les liens, notamment SUPER_ADMIN seul) : à arbitrer, voir D7.

## 7. Après l'inscription

Aujourd'hui l'inscription mène toujours à `/app/dashboard`. Proposition : passer le cours visé (par `state` du routeur, comme le fait déjà `ProtectedRoute` avec `state.from`) du bouton « Créer un compte pour suivre ce cours » à l'inscription, et revenir à `/courses/:id` si la destination est une route connue **de la même application et accessible à un apprenant** (le même filtre que `postLoginPath`). Aucune URL externe ni chemin libre n'est jamais suivi : pas de redirection ouverte. Sans destination valide, le comportement actuel est conservé. Un nouveau compte étant LEARNER, le garde de rôle est respecté.

## 8. Critères d'acceptation (à rejouer au moment de l'implémentation)

- Tout est faisable **au clavier** ; ordre de tabulation et focus visibles ; chaque schéma a un texte équivalent ; l'ordre des étapes ne repose ni sur la couleur ni sur une animation seule.
- Mouvement réduit respecté, pause possible si une animation existe.
- 320, 390, 1440 px et zoom 200 % : pas de débordement horizontal, pas de texte tronqué ; rejoué en navigateur réel (mesure de `scrollWidth`, axe-core), et l'écart entre émulation et navigation réelle déclaré.
- Aucune requête réseau, aucun cookie ni stockage de saisie pendant la découverte (vérifié en observant les requêtes du navigateur).
- Aucune formulation qui prête une pensée ou un raisonnement au modèle ; chaque donnée illustrative est étiquetée.
- États : chargement, échec, cours retiré, JavaScript en échec (version texte).
- Aucun D10 transgressé (pas de liseré coloré) ; tests de composants pour la liste ordonnée, les étiquettes, la version sans animation, le repli du lien de cours ; test d'absence d'appel réseau.

## 9. Décisions à prendre (propriétaire)

| # | Question | Ma recommandation |
| --- | --- | --- |
| D1 | Placement : section sur `/` (A) ou page dédiée avec accroche (B) | **B** |
| D2 | Durée et niveau annoncés | « ≈ 4 minutes, aucun prérequis, niveau découverte (N1) » |
| D3 | Exemples préétablis seulement, ou aussi une saisie libre | **Exemples préétablis seulement** en première version ; saisie libre plus tard si voulue, avec découpage simplifié signalé |
| D4 | Cours retenus pour chaque scène (§6) | Valider ou remplacer la liste des candidats, après vérification des cours réellement publiés |
| D5 | Édition des liens : A (tableau versionné) ou B (administration) | **A**, B réévalué après usage |
| D6 | Retour au cours après inscription (§7) | **Oui** |
| D7 | Qui gouverne les textes de l'accueil et de la découverte | À trancher : équipe de développement par défaut, ou SUPER_ADMIN avec contrat dédié ensuite |
| D8 | Reformuler dans le seed la promesse « N² → N » (§3) | **Oui**, par le lead backend ; je fournis le texte |

## 10. Limites

Lecture statique seulement : pas de navigateur, pas de capture, pas de recette, CI non consultée. Les correspondances du §6 viennent du jeu de données historique, non de la recette. L'écart d'accessibilité du §2 est une lecture de code, non reproduite. Le storyboard est une proposition sans prototype ; aucune dépendance, aucune écriture en base, aucune migration, aucune instance modifiée.
