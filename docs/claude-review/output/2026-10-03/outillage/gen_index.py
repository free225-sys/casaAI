"""Index légendé des comparaisons avant/après (HTML autonome, images locales)."""
import sys
from pathlib import Path
from html import escape as e

V = Path(sys.argv[1])

SCREENS = [
    {"id": "catalogue", "title": "Catalogue (visiteur)", "before": "avant-catalogue", "after": "apres-catalogue",
     "html": "apres/apres-catalogue.html",
     "changes": [
         ("Champ de recherche libellé, filtre de niveau et filtres de type en boutons à état (aria-pressed) avec compteurs.", "F-12"),
         ("Cartes porteuses de sens : type, niveau, durée, école ou profil (données déjà renvoyées par l’API, aujourd’hui non affichées).", "F-12"),
         ("Vue « Tout » limitée à 3/6/3 éléments par section avec « Voir les N » : hauteur de page d’environ 4 060 px à 1 430 px en desktop, et de 9 950 px à 3 090 px à 390 px.", "F-12"),
         ("État vide explicite avec action « Effacer la recherche » (voir états).", "F-12"),
         ("Pagination/compteurs fondés sur Page.total pour ne plus tronquer en silence au-delà de 50/20/20.", "F-13"),
     ],
     "deps": "Aucune extension API. Le nom court d’école utilise GET /api/schools (public, existant)."},
    {"id": "lecon", "title": "Leçon (apprenant)", "before": "avant-lecon", "after": "apres-lecon",
     "html": "apres/apres-lecon.html",
     "changes": [
         ("Barre de lecture placée sous l’en-tête (top = hauteur d’en-tête) au lieu d’être masquée par lui.", "F-09"),
         ("Colonne de lecture à 68 caractères, sections en flux (filets, numéros) plutôt qu’une carte ombrée par section.", "F-11"),
         ("Sommaire à droite en desktop, repliable sous le titre en mobile ; numérotation unique.", "F-10, F-11"),
         ("Plan du cours dans la colonne latérale et carte « Leçon suivante » : orientation sans bouton primaire concurrent.", "F-11"),
         ("Bloc « Fin de la leçon » : une seule action primaire, message d’erreur actionnable et « Réessayer » en cas d’échec.", "F-01"),
         ("Statut « En cours/Terminée » affiché d’après GET /api/me/progress (existant) ; bouton de mobile collant en bas d’écran.", "F-02"),
         ("Onglets d’approfondissement en tablist complet (tabpanel, flèches clavier) et défilement horizontal en mobile.", "F-18"),
     ],
     "deps": "Statut de leçon : appel supplémentaire GET /api/me/progress, ou EXTENSION (statut inclus dans GET /api/lessons/{id}) à arbitrer par le dev lead. Repositionnement à la reprise : à valider."},
    {"id": "dashboard", "title": "Dashboard (apprenant)", "before": "avant-dashboard", "after": "apres-dashboard",
     "html": "apres/apres-dashboard.html",
     "changes": [
         ("Carte « Reprendre » enrichie : cours, rang de la leçon, pourcentage lu, action primaire unique.", "F-22"),
         ("Synthèse chiffrée (leçons terminées, en cours, badges, compétences) calculée à partir des données déjà chargées.", "F-22"),
         ("Progression regroupée par cours avec barre x/y ; plus de liste plate illimitée.", "F-22"),
         ("Mise en page une colonne sous 960 px : supprime le débordement mesuré à 451 px pour un écran de 390 px.", "F-04"),
         ("Badges obtenus mis en avant, badges restants repliés ; plus de texte à opacité réduite (contraste).", "F-20"),
         ("Erreur de chargement distincte de l’état vide, avec « Réessayer » (voir états).", "F-03"),
         ("Bandeau « Nouveau badge » visible tant que l’utilisateur ne l’a pas vu, en cohérence avec la cloche.", "F-08"),
     ],
     "deps": "Titres de cours : GET /api/courses (public, existant) ou EXTENSION course_title dans /api/me/progress. Sémantique d’acquittement des badges : décision produit + dev lead (F-08)."},
    {"id": "admin", "title": "Administration : liste des cours (ADMIN)", "before": "avant-admin-cours", "after": "apres-admin-cours",
     "html": "apres/apres-admin-cours.html",
     "changes": [
         ("Tableau scannable : statut traduit avec pictogramme (Brouillon pointillé / Publié plein), nom d’école, date de mise à jour.", "F-19"),
         ("Filtre de statut segmenté avec état actif visible et aria-pressed ; compteurs.", "F-06"),
         ("Une action visible (« Gérer les leçons »), actions sensibles regroupées dans un menu « … » ; suppression confirmée par une boîte de dialogue explicite.", "F-15"),
         ("Lignes transformées en cartes empilées en mobile : plus de débordement (630 px mesurés aujourd’hui à 390 px).", "F-05"),
         ("Recherche honnête : sur la page tant que l’API n’offre pas de recherche, extension signalée.", "F-07"),
     ],
     "deps": "EXTENSION : paramètre de recherche serveur sur GET /api/admin/courses ; compteurs par statut (3 GET existants avec limit=1, ou extension). Les contrôles 403/400/409 restent côté API."},
    {"id": "pdf1", "title": "Import PDF — 1. Sélection (ADMIN)", "before": "avant-pdf-1-selection", "after": "apres-pdf-1-selection",
     "html": "apres/apres-pdf-1-selection.html",
     "changes": [
         ("Stepper à trois étapes avec état fait/en cours/à venir et aria-current.", "F-14"),
         ("Fichier présenté comme une pièce jointe avec « Changer » ; limite OCR annoncée avant l’analyse.", "F-14"),
         ("Choix « Un cours en brouillon / Un document de référence » en boutons radio explicites au lieu d’une case inversée.", "F-14"),
     ],
     "deps": "Aucune extension. Taille maximale de fichier : à décider côté API (dev lead)."},
    {"id": "pdf2", "title": "Import PDF — 2. Analyse et prévisualisation (ADMIN)", "before": "avant-pdf-2-previsualisation", "after": "apres-pdf-2-previsualisation",
     "html": "apres/apres-pdf-2-previsualisation.html",
     "changes": [
         ("Rappel de la cible (fichier, école, résultat produit) avec « Modifier ».", "F-14"),
         ("Points à vérifier visibles par défaut, référencés par page, couleur d’alerte dédiée (warning).", "F-14, F-20"),
         ("Arbre avec plages de pages (page_start/page_end existants) et badge « À vérifier » lisible.", "F-14"),
         ("Barre de confirmation collante : « Rien n’est encore enregistré » + ce qui sera créé.", "F-14"),
     ],
     "deps": "Aucune extension : report.anomalies, average_confidence et pages sont déjà renvoyés par POST preview-pdf."},
    {"id": "pdf3", "title": "Import PDF — 3. Confirmation et résultat (ADMIN)", "before": "avant-pdf-3-resultat", "after": "apres-pdf-3-resultat",
     "html": "apres/apres-pdf-3-resultat.html",
     "changes": [
         ("Résultat récapitulé (cours brouillon, leçon, école, pages) et rappel que rien n’est publié.", "F-14"),
         ("Action principale « Relire la leçon » vers l’éditeur (lesson_id est renvoyé) ; « Importer un autre PDF » réinitialise vraiment le formulaire.", "F-14"),
         ("Le formulaire de l’étape 1 n’est plus affiché désactivé sous le résultat.", "F-14"),
     ],
     "deps": "Aucune extension."},
]

STATES = [
    ("avant/avant-catalogue-recherche-vide--desktop-1440.png", "Avant — recherche sans résultat : titres vides, aucun message (F-12)"),
    ("apres/apres-catalogue-vide--desktop-1440.png", "Après — état vide explicite"),
    ("avant/avant-lecon-defilement--desktop-1440.png", "Avant — après défilement : la barre de lecture est sous l’en-tête (F-09) ; « 1. 1. » (F-10)"),
    ("avant/avant-lecon-echec-completion--desktop-1440.png", "Avant — POST complete en 500 simulé : aucun message, rejet non géré (F-01)"),
    ("apres/apres-lecon-echec--desktop-1440.png", "Après — erreur actionnable + Réessayer"),
    ("apres/apres-lecon-ecran-initial--mobile-390.png", "Après — premier écran mobile, action collante"),
    ("avant/avant-dashboard-erreur-api--desktop-1440.png", "Avant — 3 API en 500 simulé : faux état vide (F-03)"),
    ("apres/apres-dashboard-erreur--desktop-1440.png", "Après — erreur distincte de l’état vide"),
    ("avant/avant-admin-cours-filtre-brouillons--desktop-1440.png", "Avant — filtre « Brouillons » actif sans aucun repère visuel (F-06)"),
    ("apres/apres-admin-cours-suppression--desktop-1440.png", "Après — confirmation de suppression explicite (F-15)"),
    ("apres/apres-admin-cours-suppression--mobile-390.png", "Après — confirmation mobile"),
    ("apres/apres-pdf-2-previsualisation-ecran-initial--mobile-390.png", "Après — premier écran mobile de la prévisualisation"),
]


def fig(path, kind, cap):
    cls = "real" if kind == "real" else "mock"
    label = "Capture réelle · rendu isolé, API simulée" if kind == "real" else "Maquette proposée, non implémentée"
    return f'''<figure class="{cls}"><figcaption><span class="pill">{label}</span> {e(cap)}</figcaption>
<a href="{path}" class="frame"><img loading="lazy" src="{path}" alt="{e(label + ' — ' + cap)}"></a></figure>'''


sections = ""
for s in SCREENS:
    ch = "".join(f"<li>{e(t)} <span class=fid>{e(f)}</span></li>" for t, f in s["changes"])
    sections += f'''<section id="{s['id']}"><h2>{e(s['title'])}</h2>
<div class="pair">
 <div><h3>Avant</h3>{fig(f"avant/{s['before']}--desktop-1440.png", "real", "Desktop 1440 px")}{fig(f"avant/{s['before']}--mobile-390.png", "real", "Mobile 390 px")}</div>
 <div><h3>Après <a class="open" href="{s['html']}">ouvrir la maquette HTML</a></h3>{fig(f"apres/{s['after']}--desktop-1440.png", "mock", "Desktop 1440 px")}{fig(f"apres/{s['after']}--mobile-390.png", "mock", "Mobile 390 px")}</div>
</div>
<div class="why"><h3>Changements et raisons</h3><ul>{ch}</ul><p class="deps"><strong>Contrats et dépendances :</strong> {e(s['deps'])}</p>
<p class="ctl">Contrôle 320 px : <a href="avant/{s['before']}--mobile-320.png">avant</a> · <a href="apres/{s['after']}--mobile-320.png">après</a></p></div>
</section>'''

states = "".join(fig(p, "real" if p.startswith("avant") else "mock", c) for p, c in STATES)
toc = "".join(f'<a href="#{s["id"]}">{e(s["title"])}</a>' for s in SCREENS)

html = f'''<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Comparaisons avant/après — revue CASA AI</title>
<link rel="stylesheet" href="assets/fonts.css">
<style>
:root{{--ink:#10182b;--muted:#5b6478;--line:#e1e7ef;--real:#8a4600;--real-soft:#fff1df;--mock:#1d3f91;--mock-soft:#e8eefc;--bg:#f4f6fa}}
*{{box-sizing:border-box}} body{{margin:0;font:400 15px/1.55 "IBM Plex Sans",system-ui,sans-serif;color:var(--ink);background:var(--bg)}}
header{{background:#fff;border-bottom:1px solid var(--line);padding:24px 16px}} .wrap{{max-width:1320px;margin:0 auto;padding:0 16px}}
h1,h2,h3{{font-family:"Space Grotesk",system-ui,sans-serif;margin:0}} h1{{font-size:1.75rem}} h2{{font-size:1.4rem;margin-bottom:16px}} h3{{font-size:1rem;margin-bottom:10px}}
.legend{{display:flex;flex-wrap:wrap;gap:12px;margin-top:14px;font-size:14px}} .legend span{{padding:6px 10px;border-radius:8px}}
.l-real{{background:var(--real-soft);color:var(--real)}} .l-mock{{background:var(--mock-soft);color:var(--mock)}}
nav.toc{{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}} nav.toc a{{font-size:14px;color:var(--mock);background:#fff;border:1px solid var(--line);border-radius:999px;padding:4px 12px;text-decoration:none}}
section{{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;margin:24px 0}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:24px}} figure{{margin:0 0 16px}} figcaption{{font-size:13px;color:var(--muted);margin-bottom:6px}}
.pill{{display:inline-block;font-weight:600;border-radius:6px;padding:2px 8px;margin-right:6px}} .real .pill{{background:var(--real-soft);color:var(--real)}} .mock .pill{{background:var(--mock-soft);color:var(--mock)}}
.frame{{display:block;max-height:560px;overflow:auto;border:1px solid var(--line);border-radius:10px;background:#fff}}
.frame img{{display:block;width:100%;height:auto}} .open{{font:500 13px "IBM Plex Sans";margin-left:8px;color:var(--mock)}}
.why{{border-top:1px solid var(--line);margin-top:8px;padding-top:16px}} .why ul{{margin:0 0 10px;padding-left:20px}} .fid{{font:500 12px "IBM Plex Mono",monospace;color:var(--muted);white-space:nowrap}}
.deps,.ctl{{font-size:14px;color:var(--muted);margin:6px 0 0}}
.states{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px}} .states .frame{{max-height:420px}}
footer{{font-size:13px;color:var(--muted);padding:24px 0 48px}}
@media(max-width:800px){{.pair{{grid-template-columns:1fr}} section{{padding:16px}}}}
</style></head><body>
<header><div class="wrap"><h1>CASA AI — comparaisons avant/après</h1>
<p>Revue du 3 octobre 2026, branche <code>codex/validate-learning-ux</code>, HEAD 65bcde7 (code applicatif identique à d2e9d9a). Rapport : <a href="../RAPPORT.md">RAPPORT.md</a> · Registre de preuves : <a href="../REGISTRE_PREUVES.md">REGISTRE_PREUVES.md</a></p>
<div class="legend"><span class="l-real"><strong>Capture réelle</strong> : build Vite du code au SHA rendue dans Chromium, API simulée par interception, données synthétiques. Non observé sur la QA locale 5184.</span>
<span class="l-mock"><strong>Maquette proposée, non implémentée</strong> : HTML autonome de ce dossier, aucun module applicatif importé, aucun réseau.</span></div>
<nav class="toc" aria-label="Écrans">{toc}<a href="#etats">États d’erreur, vide, confirmation</a></nav></div></header>
<main class="wrap">{sections}
<section id="etats"><h2>États complémentaires</h2><div class="states">{states}</div></section>
<footer>Captures pleine page : en « après », les barres collantes sont replacées dans le flux pour la capture ; les fichiers « écran initial » montrent leur position réelle. Polices IBM Plex et Space Grotesk servies localement (licence OFL, assets/fonts).</footer>
</main></body></html>'''
(V / "index.html").write_text(html, encoding="utf-8")
print("index ok")
