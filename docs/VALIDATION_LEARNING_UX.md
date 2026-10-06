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

La validation PostgreSQL native a ensuite révélé deux défauts supplémentaires,
corrigés dans cette même branche : la chaîne Alembic utilise désormais une
transaction par révision ; la création d'un badge fournit explicitement son UUID.

## Résultats exécutés sur ce checkout

| Contrôle | Résultat |
| --- | --- |
| `npm run build --prefix frontend` | Réussi : TypeScript et bundle Vite |
| `npm run lint --prefix frontend` | Aucune erreur ; un avertissement existant |
| `npm run test --prefix frontend` | 9 tests React réussis |
| `python -m pytest backend/contract_tests -q` | 25 tests HTTP/unitaires réussis |
| `python -m pytest tests -q` depuis backend, base de test explicite | 386 tests backend réussis : 350 existants, 14 parcours natifs, 6 courses concurrentes et 16 circuits PDF synthétiques |

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

La suite native est séparée : elle exécute désormais cette sélection sur de vraies
lignes PostgreSQL et vérifie qu'une leçon brouillon ou d'un autre cours est ignorée.
Les 25 contrats ci-dessus restent des tests à persistance substituée.

## Validation PostgreSQL native

Connexion vérifiée à `127.0.0.1:55432`, base `casa_pr1_test`, utilisateur synthétique
`casa_test`, PostgreSQL 16.15, pgvector 0.8.7. Au premier contrôle : aucune table
publique et aucun historique Alembic. Le conteneur, son volume et son réseau de
test ont été créés par Willy ; aucun accès Docker supplémentaire n'a été tenté.

`alembic upgrade head` échouait en 0003 avec `UnsafeNewEnumValueUsage` : la valeur
SUPER_ADMIN ajoutée en 0002 était utilisée avant le commit. Le rollback a laissé
la base sans table publique. L'option `transaction_per_migration=True` corrige la
frontière de transaction conformément à la [documentation Alembic](https://alembic.sqlalchemy.org/en/latest/api/runtime.html#alembic.runtime.environment.EnvironmentContext.configure).
Un nouvel `upgrade head` a ensuite appliqué 0001 à 0010. Chaque révision est
atomique ; une série complète peut désormais être partiellement appliquée si une
révision ultérieure échoue, avec une version Alembic permettant sa reprise.

Deux nouveaux tests natifs échouaient ensuite sur `user_badges.id NOT NULL` : la
migration 0010 ne fournit pas le défaut UUID attendu par le modèle. Le service
génère désormais l'UUID lors de l'attribution ; aucun fichier de migration déjà
appliqué n'a été réécrit et aucune nouvelle migration n'est requise.

Résultat final : 386 tests passent ensemble. La suite mêle tests unitaires et
intégration ; ce total ne signifie pas 386 scénarios SQL. Les 14 tests natifs de
parcours exercent le vrai schéma migré, les
vraies routes HTTP/JWT et les requêtes SQL, sans remplacement des repositories.
Ils vérifient progression et répétitions, isolation utilisateur, bornes 422,
refus des brouillons, badges/notifications/acquittement, préférence persistée,
rôles 403 et auto-modification 400. Le garde du dernier SUPER_ADMIN est exercé
directement au niveau service avec un comptage SQL réel ; il ne simule pas un
acteur HTTP autorisé lorsque seul un autre SUPER_ADMIN actif existe.

Les fixtures ouvrent une transaction externe et utilisent des savepoints. Après
les tests, les tables users/courses/lessons/progression/badges/notifications sont
confirmées vides. La base reste à 0010 ; aucun conteneur, volume ou schéma n'a été
supprimé ou réinitialisé. [Résultat structuré](NATIVE_TEST_RESULT.json).

## Concurrence et PDF synthétiques

Six courses ont été reproduites avant correction avec des connexions et des
transactions indépendantes. Deux SUPER_ADMIN réels, tous deux authentifiés avant
les écritures, pouvaient chacun rétrograder, suspendre ou supprimer l'autre :
les deux appels réussissaient et le comptage final était zéro. Les doubles appels
start/complete et GET badges produisaient une violation d'unicité SQL.

Des [verrous PostgreSQL limités à la transaction](https://www.postgresql.org/docs/16/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS)
sérialisent désormais le contrôle et l'écriture : une clé globale pour les
mutations administrateur, une clé utilisateur/leçon pour la progression et une
clé utilisateur pour l'attribution des badges. Ils sont libérés au commit ou au
rollback, sans verrou de session persistant ni changement de schéma. Le hachage
stable sur 64 bits est commun à tous les processus. Une collision rare ne fait
que sérialiser deux opérations indépendantes. Les validations de rôle restent
les mêmes ; aucune permission supplémentaire n'est accordée.

Après correction, les trois courses admin donnent une réussite et un 409,
avec un SUPER_ADMIN actif conservé. Les trois courses progression/badges donnent
deux 200 sans doublon de progression, badge ou notification. Les gardes 400 pour
l'auto-modification passent toujours dans la suite native. La preuve porte sur
ces six scénarios à deux requêtes, en READ COMMITTED ; elle ne constitue pas un
test de charge ou une preuve de toutes les courses possibles, ni une promesse
d'horodatage strictement inchangé après complétions répétées.

Ces tests doivent rendre leurs lignes visibles à plusieurs connexions : ils
commitent uniquement leurs fixtures synthétiques, puis retirent uniquement les
UUID et identifiants créés par leur propre fixture. Aucun truncate/drop/reset.
Ils refusent les écritures si la cible n'est pas la base jetable exacte ou si
des utilisateurs y sont déjà présents. Les comptages finaux, y compris écoles
et tables documentaires, sont confirmés nuls.

Les 16 générateurs PDF existants sont exécutés localement, sans installation
supplémentaire. Un nouveau test paramétré passe pour chacun : multipart HTTP de
prévisualisation sans création de cours, import avec persistance PostgreSQL,
parité titre/pages/rapport, puis publication du contenu synthétique et lecture
de l'arbre documentaire par un utilisateur LEARNER. Cela vérifie la cohérence
du circuit sur des PDF contrôlés ; cela ne certifie ni les PDF clients, ni une
extraction parfaite, ni une validation éditoriale de tout le contenu.

## Sémantique du dépôt et limites

L'auto-suppression, l'auto-suspension et l'auto-rétrogradation renvoient **400**,
avant le comptage des SUPER_ADMIN. Le garde du dernier SUPER_ADMIN actif renvoie
**409** pour une autre cible. Ces règles de main sont conservées et testées
séparément. Le fixture 409 impose artificiellement un comptage de un : il vérifie
le garde, pas l'existence de cette situation sous une authentification réelle.

Les badges sont calculés/persistés à GET `/api/me/badges`, pas à la complétion de
la leçon. Les tests vérifient cette séquence et l'absence de doublons séquentiels,
sans prouver la concurrence ou les contraintes PostgreSQL.

L'application Alembic et les parcours décrits sont maintenant vérifiés sur
PostgreSQL local isolé. Cette PR ne constitue pas une recette Supabase hébergée,
une preuve générale de concurrence, une validation des PDF réels, des comptes réels ou du
navigateur. Aucun outil navigateur pris en charge n'est disponible : les neuf
tests React utilisent toujours happy-dom. Aucune autre base n'a été contactée.
Les résultats des anciennes copies locales ne valident pas ce dépôt.

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

Pour la suite native, dans un processus distinct des contrats et uniquement
après sélection explicite du nouveau PostgreSQL de test, définir DATABASE_URL
vers `casa_test@127.0.0.1:55432/casa_pr1_test` avec ses identifiants synthétiques,
SECRET_KEY de test et MEDIA_ROOT dans un dossier de test. Depuis backend :

```text
../.venv-ux-tests/Scripts/python.exe -m alembic upgrade head
../.venv-ux-tests/Scripts/python.exe -m pytest tests -q
```

Les tests natifs ajoutés sont ignorés si cette cible jetable exacte n'est pas
sélectionnée. Aucune valeur issue d'un `.env` existant n'a été lue.
