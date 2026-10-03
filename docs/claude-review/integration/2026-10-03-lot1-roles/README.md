# Lot 1 — séparation des espaces par rôle (frontend), branche `claude/roles-scopes-ui`

Base : `a51b626dfc07d77e004d1ec9a88fb39b597381d1` (base commune de `codex/roles-scopes-certification`, contrat lu au commit `658af4c452e7e8ba2ddc1e7aa86e58aed10cbe1f`). Périmètre : frontend uniquement, aucun contrat API ni fichier backend modifié, aucune API parallèle. Le Lot 1 backend n'est pas déclaré implémenté dans le journal ; ce lot ne le suppose pas et ne dépend d'aucun nouvel endpoint.

## Hypothèses notées (réponses de ChatGPT et de l'utilisateur non reçues au moment du démarrage, `MSG-20261003-018`)

| Question | Hypothèse appliquée |
| --- | --- |
| (a) Accueil d'un administrateur après connexion | ADMIN : `/admin/courses` ; SUPER_ADMIN : `/admin/users` ; aucune nouvelle page avant le Lot 2 |
| (b) Administrateur sur une URL `/app/...` | État explicite « Espace réservé aux apprenants » avec lien vers son espace ; pas de redirection, pas de déconnexion |
| (c) Catalogue public `/catalog` pour un administrateur | Visible (contenu public, sans donnée personnelle) |

Elles sont isolées dans `frontend/src/utils/roles.ts` : les changer ne touche qu'un fichier.

## Changements

| Fichier | Changement |
| --- | --- |
| `frontend/src/utils/roles.ts` (nouveau) | `homePathFor(role)`, `isLearnerOnlyPath(path)`, `postLoginPath(role, from)` |
| `frontend/src/components/RequireLearner.tsx` (nouveau) | Garde de route : un apprenant passe, un visiteur va à la connexion (via `ProtectedRoute`), un ADMIN ou SUPER_ADMIN voit l'état réservé. La page pédagogique n'est **pas montée**, donc aucun appel progression, badges, compétences ou quiz |
| `frontend/src/App.tsx` | Les huit routes pédagogiques (`/app/dashboard`, leçons, entraînement par compétence, quiz, portfolio, certifications) passent par `RequireLearner`. `/app/profile` reste commun |
| `frontend/src/components/Nav.tsx` | Liens « Mon espace », Quiz, Portfolio, Certifications pour LEARNER seulement ; ADMIN et SUPER_ADMIN : Catalogue et Administration (vers leur accueil) |
| `frontend/src/stores/authStore.tsx`, `pages/LoginPage.tsx` | `login` renvoie l'utilisateur ; la connexion redirige vers l'URL d'origine si le rôle y a droit, sinon vers son accueil |
| `frontend/src/pages/ProfilePage.tsx` | Pour un administrateur : informations du compte et sécurité seulement ; profil d'apprentissage, préférence de badges et vue d'ensemble masqués et leurs lectures non lancées |
| `frontend/src/pages/CourseDetailPage.tsx`, `LabDetailPage.tsx`, `components/ProgressRail.tsx` | Éligibilité au certificat, lien « Ouvrir », quiz final, soumission de lab et étape courante de l'accueil réservés aux apprenants ; message « les labs sont des entraînements » pour un administrateur |
| `frontend/tests/roles-scopes.test.tsx` (nouveau) | 14 tests, voir ci-dessous. Aucun test existant modifié |

Les fins de ligne CRLF de `App.tsx`, `LoginPage.tsx` et `authStore.tsx` sont conservées pour un diff minimal.

## Tests exécutés

`npx tsc -b` sans erreur ; `npm run lint` 0 erreur et 1 avertissement existant (`authStore.tsx:98`, Fast Refresh) ; `npm run test` **52/52** (38 existants inchangés + 14 nouveaux) ; `npm run build` réussi (avertissement de chunk existant). Les 14 nouveaux tests couvrent : accueil et redirection par rôle (dont URL d'apprenant demandée par un administrateur), menus par rôle et visiteur, garde de route (apprenant, ADMIN, SUPER_ADMIN, visiteur), **un 403 n'appelle ni la déconnexion ni le rafraîchissement du jeton**, profil sans lecture pédagogique pour un administrateur et inchangé pour un apprenant, fiche de cours, lab. Six d'entre eux échouent sur le code de `a51b626` (vérifié) et réussissent maintenant. Limite : happy-dom, services simulés.

## Captures et mesures avec API simulée

Chromium sur la build servie en prévisualisation, API interceptée et rôle simulé par un faux `/api/auth/me` : 3 rôles × 7 écrans (espace apprenant, leçon, quiz, profil, accueil d'administration, catalogue, fiche de cours) × 1440, 390 et 320 px = 63 captures, plus 3 connexions réelles par formulaire (`_mesures.json`).

| Mesure | Résultat |
| --- | --- |
| Débordement horizontal | `scrollWidth` = `clientWidth` dans les 63 cas |
| axe-core WCAG 2.0/2.1 A/AA | 0 violation dans les 63 cas |
| Erreurs JavaScript | 0 |
| Appels pédagogiques d'un ADMIN ou SUPER_ADMIN (`/api/me/*` hors notifications, leçons, quiz, portfolio, éligibilité de certificat, compétences) | **0** sur les 42 cas d'administration |
| Menus | LEARNER : 5 liens ; ADMIN : Catalogue et Administration → `/admin/courses` ; SUPER_ADMIN : Catalogue et Administration → `/admin/users` |
| Connexion depuis `/app/quizzes` | LEARNER → `/app/quizzes` ; ADMIN → `/admin/courses` ; SUPER_ADMIN → `/admin/users` |

Un premier passage montrait une erreur JS sur la fiche de cours d'un apprenant : elle venait de mon mock (éligibilité renvoyée sous forme de tableau), pas du code ; le mock est corrigé et les résultats ci-dessus sont ceux du second passage.

## Non vérifié

Backend : le Lot 1 n'est pas déclaré implémenté, donc **aucune vérification avec le vrai 403 serveur** ; mes mesures prouvent seulement que le frontend n'émet plus ces appels. Pas de FastAPI, PostgreSQL ni recette réelle par rôle ; pas de lecteur d'écran ni de zoom navigateur réel ; clavier non rejoué pour ce lot ; CI GitHub non consultée. Lots 2 à 4 (périmètres, demandes et validation CASA, aperçu) non commencés : leurs contrats ne sont pas déclarés implémentés. La page de l'administration n'a pas de lien « aperçu » d'un cours (Lot 4).
