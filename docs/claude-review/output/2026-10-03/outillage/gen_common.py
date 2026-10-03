"""Gabarits communs des maquettes « après » (HTML autonomes, aucun réseau)."""
from html import escape as e

ICONS = {
    "search": '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    "menu": '<path d="M4 6h16M4 12h16M4 18h16"/>',
    "check": '<path d="M20 6 9 17l-5-5"/>',
    "alert": '<path d="M12 3 2 21h20L12 3z"/><path d="M12 10v5M12 18h.01"/>',
    "error": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    "x": '<path d="M18 6 6 18M6 6l12 12"/>',
    "chev-right": '<path d="m9 18 6-6-6-6"/>',
    "chev-left": '<path d="m15 18-6-6 6-6"/>',
    "chev-down": '<path d="m6 9 6 6 6-6"/>',
    "arrow-right": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "file": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
    "upload": '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    "more": '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "layers": '<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>',
    "book": '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    "flask": '<path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7 15h10"/>',
    "route": '<circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8"/>',
    "award": '<circle cx="12" cy="9" r="6"/><path d="m8.5 14-1.5 7 5-3 5 3-1.5-7"/>',
    "refresh": '<path d="M20 12a8 8 0 1 1-2.3-5.7L20 8"/><path d="M20 3v5h-5"/>',
    "edit": '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    "trash": '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    "eye": '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
}


def icon(name, cls=""):
    return (f'<svg class="{cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>')


def page(title, screen, body, extra_css="", body_class="", script=""):
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} — maquette proposée</title>
<link rel="stylesheet" href="../assets/fonts.css">
<link rel="stylesheet" href="../assets/proposed.css">
<style>{extra_css}</style>
</head>
<body class="{body_class}">
<div class="mock-banner" role="note"><span>MAQUETTE PROPOSÉE, NON IMPLÉMENTÉE — {e(screen)}</span><span>Données synthétiques (titres issus du seed versionné). Les mentions « EXTENSION » signalent une dépendance API/produit à valider.</span></div>
{body}
<script>{script}</script>
</body>
</html>
"""


def header(role="visitor", current=""):
    def link(href, label):
        cur = ' aria-current="page"' if label == current else ""
        return f'<a href="{href}"{cur}>{label}</a>'
    if role == "visitor":
        links = link("#", "Catalogue")
        tools = '<a class="btn btn-ghost" href="#">Connexion</a><a class="btn btn-primary" href="#">S’inscrire</a>'
    else:
        links = "".join(link("#", l) for l in (["Catalogue", "Mon espace", "Quiz", "Portfolio", "Certifications"] +
                                                (["Administration"] if role == "admin" else [])))
        initials = "AE" if role == "learner" else "SC"
        tools = (f'<button class="icon-btn" type="button" aria-label="Notifications, 1 non lue">{icon("bell")}<span class="count" aria-hidden="true">1</span></button>'
                 f'<button class="icon-btn" type="button" aria-label="Compte : menu"><span class="avatar">{initials}</span></button>')
    menu = f'<button class="icon-btn menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav">{icon("menu")}<span class="menu-txt">Menu</span></button>'
    return f"""<header class="site-header"><div class="container nav-bar">
<a class="brand" href="#">CASA <b>AI</b> Institute</a>
<nav class="nav-links" id="nav" aria-label="Principal">{links}</nav>
<div class="nav-tools">{tools}{menu}</div>
</div></header>"""


def hash_state_script():
    return "if(location.hash){document.body.classList.add('state-'+location.hash.slice(1));}"
