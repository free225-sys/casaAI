# Rapport de revue fonctionnelle et proposition de design

> Modèle à copier sous `docs/claude-review/output/`. Remplacer les champs ; ne pas annoncer une observation ou un test non réalisé. Aucun contenu privé dans le dépôt public.

## 1. Cible, provenance et limites

- Date, branche, HEAD exact, référence main disponible et fraîcheur connue/inconnue : …
- Écart main/PR et depuis la référence applicative d2e9d9a ; corrections préservées : …
- État Git avant/après et fichiers produits uniquement dans le dossier autorisé : …
- Instructions lues, inventaire des ressources versionnées et brief utilisé : …
- Environnement réellement accessible, navigateur/outils, rôles et viewports : …
- Corpus privé absent et conséquences ; ne pas le joindre au rapport public : …
- Tests historiques cités avec liens, tests éventuellement réexécutés sous autorisation, contrôles non réalisés : …

## 2. Résultat utile à la décision

Décrire les principaux obstacles fonctionnels, la direction visuelle recommandée, les bénéfices attendus et les limites de confiance. Identifier ce qui nécessite une décision utilisateur avant toute implémentation.

## 3. Couverture des parcours et registre de preuves

| Parcours / rôle / état | Statique, dynamique ou non vérifié | Source au SHA / preuve | Résultat | Limite et contrôle restant |
| --- | --- | --- | --- | --- |
| … | … | … | … | … |

| ID preuve | Type : code, résultat historique, capture réelle, reconstruction, maquette | Chemin relatif / fichiers et lignes | Viewport, contexte et provenance | Expurgation / limites |
| --- | --- | --- | --- | --- |
| … | … | … | … | … |

## 4. Constats fonctionnels

Répéter cette fiche pour chaque constat ; différencier bug reproduit, risque statique et hypothèse.

### F-… — Titre concret

- Priorité : bloquant / important / amélioration ; confiance : …
- Parcours, rôle, préconditions synthétiques et environnement : …
- Étapes de reproduction : …
- Attendu / observé : …
- Fichiers et lignes au SHA étudié, contrat API concerné, IDs de preuves : …
- Impact utilisateur et étendue : …
- Recommandation, alternative, dépendances et risque de régression : …
- Critère d'acceptation et vérification proposée au dev lead : …

## 5. Audit du design existant

Documenter navigation, hiérarchie, lisibilité, mobile, clavier/focus, contrastes, feedback, états vides/erreurs et cohérence des composants. Relier chaque critique à un écran, un état, une preuve et un impact. Indiquer les mesures réalisées et les contrôles impossibles ; ne pas prétendre à une conformité globale.

## 6. Proposition de direction visuelle à valider

Direction recommandée, justification pédagogique, références internes, éléments conservés et changements proposés : …

| Token / composant | Existant (source) | Proposition | Raison et compromis | Décision requise |
| --- | --- | --- | --- | --- |
| Typographie, couleurs, espaces, rayons, mouvement, navigation, cartes, boutons, formulaires, tableaux, états… | … | … | … | … |

### Comparaisons avant/après

Un comparatif pour chacun des cinq écrans prioritaires, desktop et mobile ; pour le PDF, inclure les trois étapes. Contenu et viewport comparables. Légendes visibles « capture réelle », « reconstruction, non observée » ou « maquette proposée, non implémentée ».

| Écran / état / viewport | Avant : chemin et nature | Après : chemin de maquette | Changements et raisons | Contrats conservés / extensions proposées |
| --- | --- | --- | --- | --- |
| Catalogue | … | … | … | … |
| Leçon | … | … | … | … |
| Dashboard | … | … | … | … |
| Administration | … | … | … | … |
| PDF : sélection, prévisualisation, confirmation/résultat | … | … | … | … |

Inclure liens vers les fichiers visuels autonomes, variantes utiles, bénéfices attendus, coût de complexité et limites. Aucune maquette ne constitue une implémentation approuvée.

## 7. Recommandations priorisées

| ID | Fonctionnel / design | Priorité | Impact, preuve et confiance | Effort relatif | Dépendances / risques | Critère d'acceptation |
| --- | --- | --- | --- | --- | --- | --- |
| … | … | … | … | … | … | … |

## 8. Décisions requises de l'utilisateur

| Décision | Recommandation | Alternative utile | Effet sur périmètre / compromis | Statut : à valider / approuvé / refusé |
| --- | --- | --- | --- | --- |
| Direction visuelle, navigation, écrans prioritaires, extensions éventuelles… | … | … | … | À valider |

Ne remplir « approuvé » qu'à partir d'une décision explicite de l'utilisateur. Arrêter l'implémentation tant que direction et périmètre ne sont pas validés.

## 9. Plan de transmission au dev lead

| Étape après validation | Fichiers / composants concernés | API, données, sécurité : dépendances à examiner | Validation proposée | Acceptation / retour arrière |
| --- | --- | --- | --- | --- |
| Fondations de design | … | … | … | … |
| Composants communs | … | … | … | … |
| Écrans prioritaires | … | … | … | … |
| Recette desktop/mobile et non-régression | … | … | … | … |

Prévoir les parcours de changement de leçon, progression répétée, badges/notifications, rôles, brouillons et import PDF. Le dev lead choisit les tests adaptés, l'environnement isolé et les mutations synthétiques autorisées. Pas de réécriture Supabase implicite, migration ou livraison décidée par cette revue.

## 10. Livrables, limites restantes et prochaine action

- Index des rapports, preuves et visuels : …
- Questions ouvertes et corpus manquant : …
- Vérifications non effectuées, notamment navigateur, données réelles et environnement cloud/local : …
- Déclaration finale : seuls les rapports/propositions autorisés ont été écrits ; aucune implémentation, donnée, configuration, publication Git ou livraison modifiée.
- Prochaine action : validation utilisateur, puis reprise des tâches approuvées par le dev lead.
