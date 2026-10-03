# Validation du chantier apprenant de main

3 octobre 2026. Base finale : `d0e17ba445c3a49d8a3678230c7d3704c823cc39`,
branche de travail `codex/validate-learning-ux`, dépôt `free225-sys/casaAI`.
Le commit de référence initial était `c14e3325279b2ee5a710259b9a8d06b377119193`.

## Corrections reproduites

À la référence initiale c14e332, la compilation échouait avec sept erreurs TypeScript : cinq états
inutilisés dans le formulaire de création de cours, le setter du filtre de rôle
inutilisé et la prop `id` absente de `RevealSection`.

Six tests React échouaient sur c14e332 et passent après : les labs
restaient visibles sous les filtres Cours/Parcours ; les ancres du sommaire
n'étaient pas transmises au DOM ; la navigation entre leçons conservait la
complétion, le lien suivant, le document importé ou l'erreur précédente ; une
réponse tardive pouvait remplacer la leçon affichée ou la marquer terminée.

Le nouveau main d0e17ba corrige déjà les erreurs de compilation, le filtre Labs,
les ancres et les listes admin. Il ajoute aussi le lien suivant à partir du plan
ordonné du cours. Ces changements sont intégrés et conservés, sans les remplacer
par ceux préparés sur c14e332.

Cette PR ajoute uniquement les corrections complémentaires : le contenu de chaque
leçon est monté avec une clé de route distincte ; les lectures asynchrones ignorent
les réponses après démontage ; le sélecteur de rôle dispose d'un libellé accessible.
Elle ajoute les tests et le présent rapport. La structure, les styles et les
composants du chantier de main sont conservés.

## Résultats exécutés sur ce checkout

| Contrôle | Résultat |
| --- | --- |
| `npm run build --prefix frontend` | Réussi : TypeScript et bundle Vite |
| `npm run lint --prefix frontend` | Aucune erreur ; un avertissement existant |
| `npm run test --prefix frontend` | 9 tests React réussis |
| `python -m pytest backend/contract_tests -q` | 25 tests HTTP/unitaires réussis |

Le lint conserve l'avertissement `only-export-components` dans `authStore`.
Le correctif déjà publié sur main retire celui de `AdminCoursesPage`. Vite avertit sur le chunk 3D de
880,51 kB. Starlette avertit de la dépréciation de son transport de test httpx.

Les tests React utilisent happy-dom et des services remplacés. Ils rendent les
composants et utilisent une vraie navigation React Router ; ils ne prouvent pas
le rendu visuel ou les appels réseau dans un navigateur réel.

Les contrats backend utilisent les vrais routeurs FastAPI, la validation et la
sérialisation HTTP. Les mutations de progression et le service de badges sont
exécutés avec une session de substitution. Certaines lectures sont remplacées.
Un garde-fou interdit toute connexion SQL. Aucun compte réel n'est utilisé.

Les réponses exercées comprennent GET leçon, POST start/complete, PATCH progress,
GET badges, POST badges/ack, GET/PATCH notification-settings et GET notifications.
Les tests couvrent les bornes 422, le 404 avant écriture, les requêtes répétées,
l'isolation par utilisateur, les rôles admin 403, les erreurs 400/409, les badges
sans doublons séquentiels, leur acquittement et la désactivation des notifications.
Le SQL de sélection de la leçon suivante est inspecté pour son cours, son statut
publié, sa position et son ordre ; il n'est pas exécuté sur PostgreSQL.

## Sémantique du dépôt et limites

L'auto-suppression, l'auto-suspension et l'auto-rétrogradation renvoient **400**,
avant le comptage des SUPER_ADMIN. Le garde du dernier SUPER_ADMIN actif renvoie
**409** pour une autre cible. Ces règles de main sont conservées et testées
séparément. Le fixture 409 impose artificiellement un comptage de un : il vérifie
le garde, pas l'existence de cette situation sous une authentification réelle.

Les badges sont calculés/persistés à GET `/api/me/badges`, pas à la complétion de
la leçon. Les tests vérifient cette séquence et l'absence de doublons séquentiels,
sans prouver la concurrence ou les contraintes PostgreSQL.

Cette PR ne constitue pas une recette PostgreSQL/Supabase native, une preuve
d'application Alembic, une validation des PDF réels, de l'authentification avec
comptes réels ou une recette navigateur. L'accès Docker depuis cette session
reste indisponible ; aucun accès à une base existante n'a été tenté. Les résultats
des anciennes copies locales ne sont pas utilisés pour valider ce dépôt.

L'architecture reste React/Vite + FastAPI/Alembic + PostgreSQL. `VITE_API_URL`
doit désigner l'API FastAPI réellement choisie ; les origines CORS de production
doivent correspondre au frontend autorisé. Aucune adresse distante n'a été
inventée et aucune configuration de compte Supabase/Netlify n'a été modifiée.

## Rejouer les contrats sans base

Depuis la racine du checkout, sans fichier `.env` :

```text
npm ci --prefix frontend --ignore-scripts
npm run build --prefix frontend
npm run lint --prefix frontend
npm run test --prefix frontend
python -m venv .venv-ux-tests
# Utiliser le python de .venv-ux-tests/Scripts sous Windows, bin sous Linux.
.venv-ux-tests/Scripts/python.exe -m pip install -r backend/contract_tests/requirements.txt
.venv-ux-tests/Scripts/python.exe -m pytest backend/contract_tests -q
```

Versions de la vérification : Node 24.16.0, Python 3.14.5, Vite 8.2.1,
Vitest 5.0.0, happy-dom 20.14.0, FastAPI 0.142.2, SQLAlchemy 2.1.3,
Pydantic 2.13.5, pytest 9.1.1, httpx 0.28.1, Starlette 1.7.0.
Le lockfile npm fixe les nouvelles dépendances de test ; les contraintes backend
existantes restent ouvertes. Aucun déploiement ni merge n'est effectué.
