# Intégration du backend 72261b84 (dossier corrigé, noms, référentiel des parcours) + R9/R10

Branche `claude/roles-scopes-ui`. Contrat lu : `codex/roles-scopes-certification` à `72261b84e2c0a457ef20aa290a89fcdf1c5bc2d6`. Aucun fichier backend modifié.

## Changements
- **Dossier corrigé (0014)** : après un refus, l'ancien dossier et sa décision restent affichés et un formulaire « dossier corrigé » (déclaration et preuves préremplies) envoie `previous_request_id`. Dossier courant = celui sans successeur ; historique repliable ; liens vers le dossier précédent/suivant. 409 : message « Dépôt refusé par le serveur… aucun dossier créé ni remplacé », la saisie est conservée. Panne : nouvel essai avec le même contenu.
- **Noms** : `applicant_display_name` affiché dans la file CASA et le détail (identifiant en repli).
- **Référentiel des parcours** : `GET /api/admin/pathways` (tous statuts) utilisé par attribution des périmètres, création de cours et import PDF ; étiquettes « (brouillon) » / « (archivé) » ; identifiant attribué mais absent du référentiel : « Parcours attribué introuvable (id) ».
- **R9** : l'aperçu de leçon affiche le `diagram` des sections (`AdminLessonOut` l'expose : ma mention contraire du Lot 4 était fausse).
- **R10** : `evidence.metrics` rendu de façon structurée et échappée dans la vue de demande.

## Vérifications
`npx tsc -b` sans erreur ; lint 0 erreur, 1 avertissement existant ; `npm run test` 114/114 ; `npm run build` réussi. Tests ajoutés : dépôt corrigé avec `previous_request_id`, dossier courant/historique, premier dépôt sans lien, métriques échappées, schéma en aperçu, statuts du référentiel.

## Non vérifié
Rien contre le vrai serveur (happy-dom et services simulés) ; pas de nouvelles captures navigateur ; recette combinée à faire par le dev lead sur 72261b84.
