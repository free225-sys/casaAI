# Lot 3 — demande de certification officielle et décision CASA (frontend)

Branche `claude/roles-scopes-ui`, lot posé sur `205f97e1f48670ea5d3ae0fc7781ea3cdf391641`. Contrat lu : `codex/roles-scopes-certification` à **`de2be0569b484f12fe142356b07f6ffa251cbf9c`** (`docs/ROLES_SCOPES_CERTIFICATION.md`, section « Lot 3 », et OpenAPI : `CertificationRequestIn/Out`, `RequestListOut`, `DecisionIn`, `CourseCertificateOut`). Aucun fichier backend modifié, aucune API parallèle. Rien n'a été exécuté contre ce backend.

## Principe d'interface

L'interface sépare quatre choses que l'ancien parcours confondait : **l'entraînement** (quiz, labs), **l'éligibilité** (calcul indicatif, jamais une décision), **la demande** (déposée par l'apprenant) et **la décision de CASA** (explicite, motivée, terminale, prise par un SUPER_ADMIN). Aucune action de l'interface ne délivre un certificat.

## Routes utilisées

| Usage | Route |
| --- | --- |
| Déposer une demande (LEARNER) | `POST /api/me/certification-requests` `{certification_id, evidence_ids, statement}` |
| Mes demandes | `GET /api/me/certification-requests` (`limit` 1 à 100, `offset`), `GET /api/me/certification-requests/{id}` |
| File d'examen (SUPER_ADMIN) | `GET /api/admin/certification-requests?state=SUBMITTED\|APPROVED\|REJECTED&limit&offset`, `GET /api/admin/certification-requests/{id}` |
| Décision (SUPER_ADMIN) | `POST /api/admin/certification-requests/{id}/decision` `{decision: APPROVED\|REJECTED, reason}` |

## Changements

| Fichier | Changement |
| --- | --- |
| `frontend/src/components/CertificationRequestSection.tsx` (nouveau), `pages/CertificationDetailPage.tsx` | Sur la fiche d'une certification : l'éligibilité est présentée comme **indicative** (« elle ne délivre aucune certification ») ; section « Demande de certification officielle » : déclaration (≤ 10 000 caractères), preuves du portfolio facultatives (copiées à l'envoi), envoi explicite. Une demande existante remplace le formulaire (une seule demande par certification) ; **aucun bouton pour redemander ou rouvrir**, aucun lien de téléchargement inventé. Refus 409 (contenu différent d'une demande existante), 404 (preuve), 403, 422 et panne affichés **sans perdre la saisie** ; retry sur panne de chargement (jamais un formulaire vide) |
| `frontend/src/components/CertificationRequestView.tsx` (nouveau) | Lecture seule partagée : état, déclaration, **preuves figées au dépôt** (`evidence_snapshot`), décision de CASA (date, motif), identifiant du certificat officiel quand la demande est approuvée ; rappel que la décision est définitive |
| `frontend/src/pages/CertificationRequestsPage.tsx` (nouveau), `pages/CertificationsPage.tsx`, `App.tsx`, `utils/roles.ts` | Historique personnel `/app/certification-requests` (LEARNER), lien depuis la liste des certifications, route ajoutée à la table des routes connues |
| `frontend/src/pages/admin/AdminCertificationRequestsPage.tsx`, `AdminCertificationRequestDetailPage.tsx` (nouveaux), `layouts/AdminLayout.tsx` | Onglet « Demandes CASA » (SUPER_ADMIN seulement) : file filtrée côté serveur (« À examiner » par défaut), pagination, file vide distincte d'une panne ; détail avec décision (approuver ou refuser), **motif obligatoire**, boîte de confirmation de la conséquence (« émet un certificat officiel unique » ; « définitive »), refus 409/403/404/422 et panne expliqués sans enregistrer ni rejouer de décision, demande déjà décidée en lecture seule |
| `frontend/src/pages/CourseDetailPage.tsx` | **Le bouton « Obtenir mon certificat » est supprimé** : le serveur répond désormais 409 à `POST /api/courses/{id}/certificate`. Le bloc devient « Résultats aux quiz du cours », indique que le calcul est indicatif et renvoie vers les certifications ; un certificat déjà émis est signalé « Certificat historique délivré le … » |
| `frontend/src/pages/ProfilePage.tsx` | « Certificats obtenus » devient « Certificats historiques » |
| `frontend/src/services/certificationService.ts`, `types/api.ts`, `components/ui/index.tsx`, `utils/dates.ts`, `styles/aurore-admin.css` | Méthodes et types du contrat ; `issueCourseCertificate` supprimée (plus appelable) ; statuts « En attente de décision CASA », « Approuvée par CASA », « Refusée par CASA » (texte et pastille, pas de couleur seule) ; styles sans bordure ni liseré coloré (D10) |
| `frontend/tests/certification-lot3.test.tsx` (nouveau), `tests/admin-service-forms.test.ts` | 14 tests, voir ci-dessous. Aucun test existant modifié |

## Tests exécutés

`npx tsc -b` sans erreur ; `npm run lint` 0 erreur et 1 avertissement existant (`authStore.tsx:98`) ; `npm run test` **98/98** (84 existants inchangés + 14 nouveaux) ; `npm run build` réussi. Les nouveaux tests couvrent : envoi du corps exact (déclaration rognée, preuves), demande existante sans formulaire, refus visible sans bouton de réouverture, approbation avec identifiant sans lien de téléchargement, refus 409/404/422/panne avec saisie conservée, retry de chargement, éligibilité indicative, historique, fiche de cours sans émission ; file d'examen (filtre `state` envoyé au serveur, pagination, vide distinct de panne, retry), décision (désactivée sans choix ni motif, confirmation, corps exact `{decision, reason}`, conséquence affichée, 409 sans décision enregistrée ni rejouée, lecture seule si déjà décidée, retry) ; routes et corps du service. Limite : happy-dom et services simulés.

## Captures avec API simulée

Chromium sur la build en prévisualisation, API interceptée, rôle simulé par un faux `/api/auth/me` : 7 écrans × 1440, 390 et 320 px = 21 captures (`_mesures.json`) : formulaire de demande, demande en attente, refusée (avec motif), approuvée (historique), file CASA, décision, confirmation de décision. `scrollWidth` = `clientWidth` dans les 21 cas, 0 violation axe-core WCAG 2.0/2.1 A/AA, 0 erreur JS. Le navigateur a envoyé au `POST` simulé le corps exact `{"decision":"APPROVED","reason":"Dossier conforme."}`.

## Non vérifié et points à confirmer

- **Aucune vérification contre le vrai serveur** : ni FastAPI, ni PostgreSQL, ni les 409 réels (demande dupliquée, décision contradictoire, approbation impossible), ni l'idempotence, ni l'émission du certificat officiel. Les messages d'erreur reposent sur le contrat.
- Le demandeur est affiché par son identifiant (`user_id`) dans la file CASA : le contrat ne fournit ni nom ni e-mail, et je n'ai pas ajouté d'appel de recherche d'utilisateur. À confirmer si un nom est souhaité (cela demanderait une extension de contrat).
- Les demandes portent sur le catalogue des certifications ; il n'y a **aucune conversion cours → certification** (contrat). Les certificats de cours existants sont affichés comme historiques.
- Pas de lecteur d'écran, de zoom navigateur réel ni de clavier rejoué pour ce lot ; CI GitHub non consultée. Lot 4 (aperçus) non commencé.
