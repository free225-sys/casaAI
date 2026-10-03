# Revue fonctionnelle et design « Aurore lisible » — livrables

Livrables de la revue Claude du 3 octobre 2026, publiés sur la branche `claude/design-review-aurore` pour l'intégration du design. Ce dossier ne contient que de la documentation, des images, des maquettes HTML autonomes, un CSS de démonstration, des polices libres et des scripts de reproduction. Aucun fichier applicatif n'est modifié.

## Provenance et portée (à lire avant d'intégrer)

- **Commit revu : `65bcde79f66af42553951fcfaa7fa7e656636114`** (code applicatif identique à `d2e9d9a`). Tous les constats F-01 à F-22 du rapport décrivent ce commit.
- **Base de cette branche : `29a57011a09def9d9b3138a7f7af593876772a55`**, tête de `origin/codex/validate-learning-ux` au moment de la publication. Elle contient `5a3f47a`, `6809361` et `29a5701`, qui corrigent plusieurs constats d'après `docs/FUNCTIONAL_RECOVERY_2026-10-03.md`. **Ces corrections n'ont pas été revérifiées par Claude** : le rapport ne doit pas être lu comme un état du commit actuel.
- **Captures « avant »** : rendu du frontend de `65bcde7` dans Chromium avec une **API simulée** et des données synthétiques. Ce ne sont ni des captures de la QA ni des réponses du backend réel.
- **Maquettes « après »** : pages HTML statiques, **non implémentées et non validées avec le backend réel**. Leurs données sont fictives ; elles ne prouvent ni la faisabilité ni le comportement.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| [RAPPORT.md](RAPPORT.md) | Rapport complet : cible, constats F-01 à F-22, audit, direction « Aurore lisible », tokens, recommandations, décisions D-01 à D-10, plan d'intégration |
| [REGISTRE_PREUVES.md](REGISTRE_PREUVES.md) | Environnement d'observation, preuves P-01 à P-19, limites, expurgation |
| [visuels/index.html](visuels/index.html) | Galerie légendée avant/après, desktop 1440 et mobile 390 (contrôle 320), états d'erreur, vide et confirmation. S'ouvre hors ligne |
| [visuels/avant/](visuels/avant/) | 27 captures du code de 65bcde7 (API simulée) + [`_mesures-avant.json`](visuels/avant/_mesures-avant.json) (débordements, axe-core, requêtes simulées) |
| [visuels/apres/](visuels/apres/) | 7 maquettes HTML et leurs captures + [`_mesures-apres.json`](visuels/apres/_mesures-apres.json) |
| [visuels/assets/proposed.css](visuels/assets/proposed.css) | Tokens et composants proposés, commentés (démonstration, à porter dans `frontend/src/index.css`) |
| [visuels/assets/fonts.css](visuels/assets/fonts.css), [visuels/assets/fonts/](visuels/assets/fonts/) | IBM Plex Sans/Mono et Space Grotesk, sous-ensemble latin, licence SIL OFL 1.1 ([IBM Plex](visuels/assets/fonts/OFL-IBM-Plex.txt), [Space Grotesk](visuels/assets/fonts/OFL-Space-Grotesk.txt)) |
| [outillage/](outillage/README.md) | Scripts de reproduction : API simulée, captures, mesures (non applicatifs) |

Maquettes par écran :

| Écran | Maquette | Captures après | Captures avant |
| --- | --- | --- | --- |
| Catalogue | [apres-catalogue.html](visuels/apres/apres-catalogue.html) (`#vide` pour l'état vide) | [desktop](visuels/apres/apres-catalogue--desktop-1440.png) · [390](visuels/apres/apres-catalogue--mobile-390.png) | [desktop](visuels/avant/avant-catalogue--desktop-1440.png) · [390](visuels/avant/avant-catalogue--mobile-390.png) |
| Leçon | [apres-lecon.html](visuels/apres/apres-lecon.html) (`#echec`) | [desktop](visuels/apres/apres-lecon--desktop-1440.png) · [390](visuels/apres/apres-lecon--mobile-390.png) | [desktop](visuels/avant/avant-lecon--desktop-1440.png) · [390](visuels/avant/avant-lecon--mobile-390.png) |
| Dashboard | [apres-dashboard.html](visuels/apres/apres-dashboard.html) (`#erreur`) | [desktop](visuels/apres/apres-dashboard--desktop-1440.png) · [390](visuels/apres/apres-dashboard--mobile-390.png) | [desktop](visuels/avant/avant-dashboard--desktop-1440.png) · [390](visuels/avant/avant-dashboard--mobile-390.png) |
| Admin cours | [apres-admin-cours.html](visuels/apres/apres-admin-cours.html) (`#suppression`) | [desktop](visuels/apres/apres-admin-cours--desktop-1440.png) · [390](visuels/apres/apres-admin-cours--mobile-390.png) | [desktop](visuels/avant/avant-admin-cours--desktop-1440.png) · [390](visuels/avant/avant-admin-cours--mobile-390.png) |
| Import PDF 1 | [apres-pdf-1-selection.html](visuels/apres/apres-pdf-1-selection.html) | [desktop](visuels/apres/apres-pdf-1-selection--desktop-1440.png) · [390](visuels/apres/apres-pdf-1-selection--mobile-390.png) | [desktop](visuels/avant/avant-pdf-1-selection--desktop-1440.png) · [390](visuels/avant/avant-pdf-1-selection--mobile-390.png) |
| Import PDF 2 | [apres-pdf-2-previsualisation.html](visuels/apres/apres-pdf-2-previsualisation.html) | [desktop](visuels/apres/apres-pdf-2-previsualisation--desktop-1440.png) · [390](visuels/apres/apres-pdf-2-previsualisation--mobile-390.png) | [desktop](visuels/avant/avant-pdf-2-previsualisation--desktop-1440.png) · [390](visuels/avant/avant-pdf-2-previsualisation--mobile-390.png) |
| Import PDF 3 | [apres-pdf-3-resultat.html](visuels/apres/apres-pdf-3-resultat.html) | [desktop](visuels/apres/apres-pdf-3-resultat--desktop-1440.png) · [390](visuels/apres/apres-pdf-3-resultat--mobile-390.png) | [desktop](visuels/avant/avant-pdf-3-resultat--desktop-1440.png) · [390](visuels/avant/avant-pdf-3-resultat--mobile-390.png) |

## Réserves retenues pour l'intégration

1. **Import PDF en mobile** : le rappel de la cible, le résumé et la liste des anomalies restent visibles ; le bouton de confirmation ne les recouvre jamais. Dans la maquette, la barre de confirmation est collante en desktop seulement et revient dans le flux sous 600 px, après les anomalies ([capture du premier écran](visuels/apres/apres-pdf-2-previsualisation-ecran-initial--mobile-390.png)). À contrôler aussi à 320 px et au zoom 200 %.
2. **Catalogue : accès évident à tous les contenus.** La vue « Tout » de la maquette montre un extrait par section avec « Voir les N » (décision D-03, non approuvée). À l'intégration, chaque type doit rester joignable en un geste visible (filtre ou lien « Voir les N »), et aucun contenu ne doit disparaître en silence : le catalogue charge déjà jusqu'au total annoncé depuis `5a3f47a`.
3. **Lignes affichées et pagination concordantes.** L'indication « 1–20 sur 27 » doit correspondre exactement aux lignes visibles. Une recherche limitée à la page chargée doit le dire et ne pas laisser croire que le compteur porte sur les résultats filtrés. La maquette admin affiche désormais 20 lignes pour « 1–20 sur 27 ».
4. **Leçons dépubliées : historique des acquis conservé.** Les lignes renvoyées avec `is_available: false` restent visibles dans la progression et comptent dans les acquis et badges, sans lien de reprise ni d'ouverture. La maquette du dashboard ne représente pas ce cas : il faut prévoir une ligne « Leçon retirée du catalogue » non cliquable.
5. **Test du fonctionnement réel après intégration.** Recette navigateur avec FastAPI et PostgreSQL de recette, par rôle (visiteur, LEARNER, ADMIN, SUPER_ADMIN), à 1440, 390 et 320 px : complétion et erreurs, reprise, badges et notifications, filtres et pagination, import PDF complet, clavier et zoom. Les captures et mesures de ce dossier ne remplacent pas cette recette.

## Intégrer le design

1. **Tokens d'abord.** Porter les variables de [proposed.css](visuels/assets/proposed.css) dans `frontend/src/index.css`, en gardant les anciens noms comme alias le temps de la migration. Les familles de polices ne changent pas (le frontend les charge déjà depuis Google Fonts) ; les fichiers de `visuels/assets/fonts/` ne servent qu'aux maquettes hors ligne.
2. **Règle approuvée (D-10)** : aucune bordure ni liseré coloré sur les cartes, encadrés, messages et badges. L'état passe par le fond teinté, le pictogramme et le texte. Seuls les indicateurs d'état actif (onglet, étape, focus) restent colorés.
3. **Composants partagés** : statut (pastille + texte français), message (`notice` erreur, avertissement, succès, info), état vide avec action, filtre segmenté `aria-pressed`, dialogue de confirmation, stepper, tableau qui devient des cartes en mobile. Classes de référence dans `proposed.css`.
4. **Écrans** dans l'ordre du rapport (§9), un par PR, en conservant les contrats API, les rôles, les brouillons, les bornes de progression et les verrous PostgreSQL. Les extensions marquées « EXTENSION » dans les maquettes (recherche serveur des cours, compteurs par statut) ne sont pas des fonctions existantes.
5. Les décisions D-01 à D-09 restent à valider ; seule D-10 est approuvée ([RAPPORT.md §8](RAPPORT.md#8-décisions-requises-de-lutilisateur)).

## Contrôles effectués avant publication

- Aucun `.env`, mot de passe, jeton, identifiant de connexion, journal privé ni donnée personnelle : comptes simulés en `example.test`, titres pédagogiques issus du seed public `backend/data/casa_data.json`.
- Ressources redistribuables uniquement : polices sous SIL OFL 1.1, licences jointes ; les icônes des maquettes sont dessinées dans ce dossier ; aucune bibliothèque tierce copiée (axe-core et les paquets de polices ont servi à la production, ils ne sont pas inclus).
- Maquettes : 0 débordement horizontal à 1440, 390 et 320 px, 0 violation axe-core (WCAG 2.0/2.1 A et AA), 0 requête réseau. Ce sont des mesures automatiques sur des pages statiques.
