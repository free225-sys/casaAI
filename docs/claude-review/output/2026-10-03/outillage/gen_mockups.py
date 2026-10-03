"""Génère les maquettes « après » dans docs/claude-review/output/<date>/visuels/apres/."""
import sys
from html import escape as e
from pathlib import Path

import mockapi as m
from gen_common import header, hash_state_script, icon, page

OUT = Path(sys.argv[1]); OUT.mkdir(parents=True, exist_ok=True)
SCHOOL = {s["id"]: s["short_name"] for s in m.SCHOOLS}


def dur(minutes):
    if not minutes: return None
    h, mn = divmod(int(minutes), 60)
    return f"{h} h {mn:02d}" if h and mn else (f"{h} h" if h else f"{mn} min")


def meta(*items):
    return "".join(f'<span class="tag">{e(str(i))}</span>' for i in items if i)


# ---------------------------------------------------------------- Catalogue
def catalogue():
    def card(kind, ic, href, title, desc, metas):
        return f"""<a class="card cat-card" href="{href}">
<span class="eyebrow">{icon(ic)}{kind}</span>
<h3>{e(title)}</h3><p class="desc">{e(desc or '')}</p>
<p class="metas">{metas}</p></a>"""
    pw = "".join(card("Parcours", "route", "#", p["title"], p["description"], meta(p["profile_label"], p["level"], p["duration_label"]))
                 for p in m.PATHWAYS[:3])
    co = "".join(card("Cours", "book", "#", c["title"], c["description"], meta(SCHOOL.get(c["school_id"]), c["level"], dur(c["duration_min"])))
                 for c in m.COURSES[:6])
    lb = "".join(card("Lab", "flask", "#", l["title"], l["description"], meta(l["level"], dur(l["duration_min"])))
                 for l in m.LABS[:3])
    levels = sorted({c["level"] for c in m.COURSES if c["level"]})
    body = f"""{header("visitor", "Catalogue")}
<main><div class="container">
<div class="cat-head">
  <div><h1>Catalogue</h1><p class="lead muted">11 parcours, 26 cours et 10 labs publiés. Les leçons s’ouvrent après connexion.</p></div>
</div>
<div class="toolbar" role="search">
  <div class="search grow"><label class="sr-only" for="q">Rechercher dans le catalogue</label>{icon("search")}<input id="q" class="input" type="search" placeholder="Rechercher un parcours, un cours, un lab…"></div>
  <label class="sr-only" for="lvl">Niveau</label>
  <select id="lvl" class="select lvl"><option>Tous les niveaux</option>{''.join(f'<option>{l}</option>' for l in levels)}</select>
</div>
<div class="row filters">
  <div class="segmented" role="group" aria-label="Type de contenu">
    <button type="button" aria-pressed="true">Tout <span class="n">47</span></button>
    <button type="button" aria-pressed="false">Parcours <span class="n">11</span></button>
    <button type="button" aria-pressed="false">Cours <span class="n">26</span></button>
    <button type="button" aria-pressed="false">Labs <span class="n">10</span></button>
  </div>
  <p class="muted small" role="status">47 résultats</p>
</div>

<div class="results">
<section class="cat-section"><div class="sec-head"><h2>Parcours</h2><a class="btn btn-ghost" href="#">Voir les 11 parcours {icon("arrow-right")}</a></div>
<div class="grid">{pw}</div></section>
<section class="cat-section"><div class="sec-head"><h2>Cours</h2><a class="btn btn-ghost" href="#">Voir les 26 cours {icon("arrow-right")}</a></div>
<div class="grid">{co}</div></section>
<section class="cat-section"><div class="sec-head"><h2>Labs</h2><a class="btn btn-ghost" href="#">Voir les 10 labs {icon("arrow-right")}</a></div>
<div class="grid">{lb}</div></section>
</div>

<div class="empty-state empty">
  <h2>Aucun résultat pour « blockchain »</h2>
  <p class="muted">Essayez un autre mot-clé ou retirez le filtre de niveau.</p>
  <p style="margin-top:16px"><button class="btn btn-secondary" type="button">Effacer la recherche</button></p>
</div>
</div></main>"""
    css = """
.cat-head{margin-bottom:var(--space-5)} .lead{margin-top:6px;font-size:1.0625rem}
.toolbar{display:flex;gap:var(--space-3);margin-bottom:var(--space-3)} .grow{flex:1;max-width:560px} .lvl{width:auto;min-width:180px}
.filters{justify-content:space-between;margin-bottom:var(--space-6)} .small{font-size:var(--text-sm)}
.cat-section+.cat-section{margin-top:var(--space-7)}
.sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin-bottom:var(--space-4)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--space-4)}
.cat-card{padding:20px;display:flex!important;flex-direction:column;gap:8px;min-height:188px}
.eyebrow{display:inline-flex;align-items:center;gap:6px;font:600 12px var(--font-body);color:var(--color-primary);text-transform:uppercase;letter-spacing:.06em}
.eyebrow svg{width:16px;height:16px}
.cat-card h3{font-size:1.05rem}
.desc{color:var(--color-text-muted);font-size:var(--text-sm);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.metas{margin-top:auto;padding-top:8px;border-top:1px solid var(--color-border);display:flex;flex-wrap:wrap;gap:4px}
.empty-state{display:none} .state-vide .results{display:none} .state-vide .empty-state{display:block}
@media(max-width:960px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:600px){.grid{grid-template-columns:1fr}.toolbar{flex-direction:column}.lvl{width:100%}.grow{max-width:none}
 .cat-card{min-height:0}.filters{flex-direction:column;align-items:stretch;gap:8px;margin-bottom:var(--space-5)} .nav-tools .btn-ghost{display:none}}
"""
    return page("Catalogue", "Catalogue (visiteur)", body, css, "", hash_state_script())


# ---------------------------------------------------------------- Leçon
def lecon():
    l = m.lesson_detail("vectors-tensors")
    course = m.course_detail("math-ai")
    lessons = course["lessons"]
    secs = "".join(f"""<section class="lsec" id="s{i+1}"><p class="secnum mono">{i+1:02d}</p><h2>{e(s['title'])}</h2>
<p class="body">{e(s['body'])}</p></section>""" for i, s in enumerate(l["sections"]))
    tabs = "".join(f'<button role="tab" aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}">{e(d["label"])}</button>'
                   for i, d in enumerate(l["depth_levels"]))
    d0 = l["depth_levels"][0]
    toc = "".join(f'<li><a href="#s{i+1}"{" aria-current=\"true\"" if i == 0 else ""}>{e(s["title"])}</a></li>' for i, s in enumerate(l["sections"]))
    plan = "".join(f'<li class="{"cur" if x["id"] == l["id"] else "todo"}"><span class="pdot" aria-hidden="true"></span><span>{e(x["title"])}</span>'
                   f'{"<span class=sr-only> (leçon actuelle)</span>" if x["id"] == l["id"] else ""}</li>' for x in lessons)
    nxt = lessons[1]
    obj = "".join(f"<li>{e(o)}</li>" for o in l["objectives"])
    body = f"""{header("learner", "")}
<div class="read-progress" role="progressbar" aria-label="Progression de lecture" aria-valuenow="32" aria-valuemin="0" aria-valuemax="100"><i style="width:32%"></i></div>
<main><div class="container lesson-wrap">
<nav class="crumbs" aria-label="Fil d’Ariane"><a href="#">Catalogue</a>{icon("chev-right")}<a href="#">{e(course['title'])}</a>{icon("chev-right")}<span aria-current="page">Leçon 1 sur {len(lessons)}</span></nav>
<div class="lesson-grid">
<article class="lesson-main">
  <header class="lhead">
    <p class="row lmeta"><span class="status status-progress">En cours</span><span class="tag">{icon("layers")} Niveau {l['level']}</span><span class="tag">{icon("clock")} {l['duration_min']} min</span></p>
    <h1>{e(l['title'])}</h1>
    <p class="summary">{e(l['summary'] or '')}</p>
  </header>
  <details class="toc-mobile"><summary>Sommaire de la leçon <span class="muted">· {len(l['sections'])} sections</span>{icon("chev-down")}</summary><ol>{toc}<li><a href="#deep">Approfondir</a></li></ol></details>
  <aside class="callout objective" aria-label="Objectifs"><p class="clabel">Objectifs de la leçon</p><ul>{obj}</ul></aside>
  {secs}
  <section class="deep" id="deep" aria-labelledby="deep-t"><h2 id="deep-t">Approfondir</h2>
   <p class="muted small">Six angles de lecture, du plus accessible au plus technique.</p>
   <div class="tabs" role="tablist" aria-label="Niveaux de profondeur">{tabs}</div>
   <div class="tabpanel" role="tabpanel"><h3>{e(d0['title'])}</h3><p class="body">{e(d0['body'])}</p></div>
  </section>
  <aside class="callout example"><p class="clabel">Exemple</p><p>{e(l['example'] or '')}</p></aside>

  <section class="finish panel" aria-labelledby="fin-t">
    <h2 id="fin-t">Fin de la leçon</h2>
    <div class="notice notice-error fail" role="alert">{icon("error")}<div><strong>La leçon n’a pas pu être enregistrée comme terminée.</strong><br>Votre lecture n’est pas perdue. Vérifiez la connexion puis réessayez.</div></div>
    <div class="row actions">
      <button class="btn btn-primary btn-lg btn-block-sm" type="button">{icon("check")} <span class="lbl-ok">Marquer comme terminée</span><span class="lbl-retry">Réessayer</span></button>
      <a class="btn btn-secondary btn-lg btn-block-sm" href="#">Passer le quiz de validation</a>
    </div>
    <p class="muted small">Le quiz de validation est facultatif pour terminer la leçon.</p>
  </section>
  <nav class="pager" aria-label="Leçons du cours">
    <span></span>
    <a class="card next" href="#"><span class="muted small">Leçon suivante · 2/{len(lessons)}</span><strong>{e(nxt['title'])}</strong>{icon("arrow-right")}</a>
  </nav>
</article>
<aside class="rail" aria-label="Navigation de la leçon">
  <div class="rail-box"><p class="rlabel">Dans cette leçon</p><ol class="toc">{toc}<li><a href="#deep">Approfondir</a></li></ol>
  <button class="btn btn-ghost" type="button">{icon("eye")} Mode lecture</button></div>
  <div class="rail-box"><p class="rlabel">{e(course['title'])}</p><ol class="plan">{plan}</ol></div>
</aside>
</div>
</div></main>
<div class="sticky-cta"><button class="btn btn-primary btn-lg" type="button">{icon("check")} <span class="lbl-ok">Marquer comme terminée</span><span class="lbl-retry">Réessayer</span></button></div>"""
    css = """
.read-progress{position:sticky;top:var(--header-h);z-index:19;height:3px;background:var(--color-border)} .read-progress i{display:block;height:100%;background:var(--color-primary)}
.crumbs{display:flex;align-items:center;flex-wrap:wrap;gap:4px;font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:var(--space-5)} .crumbs svg{width:14px;height:14px} .crumbs a{color:var(--color-text-muted)}
.lesson-wrap{max-width:1100px}
.lesson-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:var(--space-7);align-items:start}
.lesson-main{max-width:var(--reading-width)}
.lmeta{gap:12px;margin-bottom:12px} .tag svg{width:15px;height:15px}
.summary{font-size:1.125rem;line-height:1.6;color:var(--color-text-muted);margin-top:12px}
.lhead{padding-bottom:var(--space-5);border-bottom:1px solid var(--color-border);margin-bottom:var(--space-5)}
.callout{border:0;border-radius:var(--radius-md);padding:16px 20px;margin:var(--space-5) 0}
.callout ul{margin:0;padding-left:20px;line-height:1.7} .clabel{font:600 12px var(--font-body);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px}
.objective{background:var(--color-primary-soft)} .objective .clabel{color:#1d3f91}
.example{background:var(--color-surface-muted)} .example .clabel{color:var(--color-text-muted)} .example p:last-child{line-height:1.7}
.lsec{padding:var(--space-5) 0;scroll-margin-top:calc(var(--header-h) + 24px)} .lsec+.lsec{border-top:1px solid var(--color-border)}
.secnum{font-size:12px;color:var(--color-primary);margin-bottom:4px;letter-spacing:.08em}
.lsec h2{margin-bottom:12px}
.body{font-size:var(--text-read);line-height:var(--leading-read)}
.deep{margin-top:var(--space-6)} .small{font-size:var(--text-sm)} .deep .muted{margin:4px 0 16px}
.tabs{display:flex;flex-wrap:wrap;gap:4px;overflow-x:auto;border-bottom:1px solid var(--color-border);scrollbar-width:thin}
.tabs button{flex:none;border:0;background:none;padding:10px 14px;font:500 var(--text-sm) var(--font-body);color:var(--color-text-muted);border-bottom:2px solid transparent;margin-bottom:-1px;cursor:pointer;min-height:44px}
.tabs button[aria-selected=true]{color:var(--color-primary);border-color:var(--color-primary);font-weight:600}
.tabpanel{padding:var(--space-5) 0} .tabpanel h3{margin-bottom:8px}
.finish{margin-top:var(--space-6)} .finish h2{font-size:1.25rem;margin-bottom:var(--space-4)} .actions{margin:var(--space-4) 0 var(--space-3)}
.fail{display:none} .state-echec .fail{display:flex} .lbl-retry{display:none} .state-echec .lbl-retry{display:inline} .state-echec .lbl-ok{display:none}
.pager{display:grid;grid-template-columns:1fr 1fr;gap:var(--space-4);margin-top:var(--space-5)}
.next{padding:16px 18px;display:grid!important;grid-template-columns:1fr auto;gap:2px 12px;align-items:center} .next span{grid-column:1} .next strong{grid-column:1} .next svg{grid-column:2;grid-row:1/3;width:20px;color:var(--color-primary)}
.rail{position:sticky;top:calc(var(--header-h) + 24px);display:flex;flex-direction:column;gap:var(--space-4)}
.rail-box{border-left:1px solid var(--color-border);padding-left:var(--space-4)}
.rlabel{font:600 12px var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted);margin-bottom:8px}
.toc,.plan{list-style:none;margin:0 0 8px;padding:0;display:flex;flex-direction:column;gap:2px;font-size:var(--text-sm)}
.toc a{display:block;padding:6px 10px;border-radius:var(--radius-sm);text-decoration:none;color:var(--color-text-muted)}
.toc a[aria-current]{color:var(--color-primary);background:var(--color-primary-soft);font-weight:600}
.plan li{display:flex;gap:10px;align-items:flex-start;padding:6px 0;color:var(--color-text-muted)} .plan .cur{color:var(--color-text);font-weight:600}
.pdot{flex:none;width:12px;height:12px;border-radius:50%;border:2px solid var(--color-border-strong);margin-top:4px} .cur .pdot{border-color:var(--color-primary);background:var(--color-primary)}
.toc-mobile{display:none} .sticky-cta{display:none}
@media(max-width:960px){.lesson-grid{grid-template-columns:minmax(0,1fr)}.rail{display:none}.lesson-main{max-width:none}
 .toc-mobile{display:block;border:1px solid var(--color-border);border-radius:var(--radius-md);margin:0 0 var(--space-4)}
 .toc-mobile summary{list-style:none;display:flex;align-items:center;gap:6px;padding:12px 16px;min-height:48px;font-weight:600;cursor:pointer} .toc-mobile summary svg{width:18px;margin-left:auto}
 .toc-mobile ol{margin:0;padding:0 16px 12px 36px;line-height:2}}
@media(max-width:600px){.tabs{flex-wrap:nowrap}.pager{grid-template-columns:1fr}.pager>span{display:none}
 .sticky-cta{display:block;position:fixed;left:0;right:0;bottom:0;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.97);border-top:1px solid var(--color-border);z-index:15}
 .sticky-cta .btn{width:100%} main{padding-bottom:120px} .finish .btn-primary{display:none}}
"""
    return page("Leçon", "Leçon (apprenant)", body, css, "", hash_state_script())


# ---------------------------------------------------------------- Dashboard
def dashboard():
    rows = m.progress_rows()
    by_course = {}
    for r in rows: by_course.setdefault(r["course_id"], []).append(r)
    ctitle = {c["id"]: c["title"] for c in m.COURSES}
    groups = ""
    for cid, items in by_course.items():
        all_lessons = m.course_detail(cid)["lessons"]
        done = sum(1 for r in items if r["status"] == "COMPLETED")
        li = "".join(f"""<li><a href="#"><span class="status {'status-done' if r['status']=='COMPLETED' else 'status-progress'}">{'Terminée' if r['status']=='COMPLETED' else 'En cours'}</span><span class="lt">{e(r['lesson_title'])}</span>{icon("chev-right")}</a></li>""" for r in items)
        groups += f"""<div class="course-group"><div class="cg-head"><h3>{e(ctitle[cid])}</h3><span class="muted small">{done}/{len(all_lessons)} leçons terminées</span></div>
<div class="meter success" aria-hidden="true"><i style="width:{round(100*done/len(all_lessons))}%"></i></div><ul class="lrows">{li}</ul></div>"""
    skills = "".join(f"""<li><div class="sk-top"><span>{e(s['skill_name'])}</span><span class="mono small muted">{s['mastery_level']}/4</span></div>
<div class="meter" role="img" aria-label="Maîtrise {s['mastery_level']} sur 4"><i style="width:{s['mastery_level']*25}%"></i></div>
<a class="btn btn-ghost sk-act" href="#">S’entraîner</a></li>""" for s in m.SKILLS)
    earned = [b for b in m.badges() if b["earned"]]
    badges = "".join(f'<li class="bdg{" is-new" if b["new"] else ""}">{icon("award")}<span><strong>{e(b["title"])}</strong><br><span class="muted small">{e(b["description"])}</span></span>{"<span class=newtag>Nouveau</span>" if b["new"] else ""}</li>' for b in earned)
    resume = rows[0]
    body = f"""{header("learner", "Mon espace")}
<main><div class="container">
<div class="dash-head"><h1>Bonjour Awa</h1><p class="muted">Reprenez là où vous vous êtes arrêtée.</p></div>
<div class="notice notice-error err" role="alert">{icon("error")}<div><strong>Votre progression n’a pas pu être chargée.</strong> Ce n’est pas une remise à zéro : vos leçons terminées sont conservées.<div style="margin-top:10px"><button class="btn btn-secondary" type="button">{icon("refresh")} Réessayer</button></div></div></div>
<div class="ok">
<div class="notice notice-success newbadge" role="status">{icon("award")}<div><strong>Nouveau badge : Curieux.</strong> Vous avez terminé 3 leçons.</div></div>
<section class="resume panel" aria-labelledby="r-t">
  <div class="r-txt"><p class="eyebrow-l">Reprendre</p><h2 id="r-t">{e(resume['lesson_title'])}</h2>
  <p class="muted">{e(ctitle[resume['course_id']])} · Leçon 2 sur 4</p>
  <div class="r-meter"><div class="meter"><i style="width:{resume['progress_pct']}%"></i></div><span class="mono small">{resume['progress_pct']} % lu</span></div></div>
  <a class="btn btn-primary btn-lg btn-block-sm" href="#">Continuer la leçon {icon("arrow-right")}</a>
</section>
<ul class="kpis" aria-label="Synthèse">
  <li><strong>3</strong><span>leçons terminées</span></li><li><strong>2</strong><span>leçons en cours</span></li>
  <li><strong>4<small>/11</small></strong><span>badges obtenus</span></li><li><strong>4</strong><span>compétences suivies</span></li>
</ul>
<div class="dash-grid">
  <section class="panel" aria-labelledby="c-t"><div class="sec-head"><h2 id="c-t">Mes cours</h2><a class="btn btn-ghost" href="#">Catalogue {icon("arrow-right")}</a></div>{groups}</section>
  <div class="side">
   <section class="panel" aria-labelledby="s-t"><h2 id="s-t">Compétences</h2><p class="muted small">Niveau de maîtrise, de 0 à 4. Réussir un quiz fait progresser d’un niveau.</p><ul class="skills">{skills}</ul></section>
   <section class="panel" aria-labelledby="b-t"><div class="sec-head"><h2 id="b-t">Badges</h2><span class="muted small">4 sur 11</span></div><ul class="badges">{badges}</ul>
   <button class="btn btn-ghost" type="button">Voir les 7 badges à débloquer {icon("chev-down")}</button></section>
  </div>
</div>
</div>
</div></main>"""
    css = """
.dash-head{margin-bottom:var(--space-5)} .dash-head p{margin-top:4px}
.err{display:none;margin-bottom:var(--space-5)} .state-erreur .err{display:flex} .state-erreur .ok{display:none}
.newbadge{margin-bottom:var(--space-4)}
.resume{display:flex;align-items:center;gap:var(--space-5);justify-content:space-between}
.eyebrow-l{font:600 12px var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--color-primary);margin-bottom:4px}
.resume h2{font-size:1.375rem} .r-meter{display:flex;align-items:center;gap:12px;margin-top:12px;max-width:360px} .r-meter .meter{flex:1}
.kpis{list-style:none;padding:0;margin:var(--space-4) 0;display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-3)}
.kpis li{background:#fff;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:14px 16px;display:flex;flex-direction:column}
.kpis strong{font:700 1.5rem var(--font-display)} .kpis small{font-size:1rem;color:var(--color-text-muted)} .kpis span{font-size:var(--text-sm);color:var(--color-text-muted)}
.dash-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,1fr);gap:var(--space-4);align-items:start}
.side{display:flex;flex-direction:column;gap:var(--space-4)}
.sec-head{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:var(--space-3)} .panel h2{font-size:1.125rem}
.small{font-size:var(--text-sm)}
.course-group+.course-group{margin-top:var(--space-5);padding-top:var(--space-5);border-top:1px solid var(--color-border)}
.cg-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:8px;flex-wrap:wrap} .cg-head h3{font-size:1rem}
.lrows{list-style:none;margin:12px 0 0;padding:0} .lrows a{display:flex;align-items:center;gap:12px;padding:10px 8px;border-radius:var(--radius-sm);text-decoration:none;min-height:44px}
.lrows a:hover{background:var(--color-surface-muted)} .lrows .lt{flex:1} .lrows svg{width:18px;color:var(--color-text-muted)}
.lrows .status{min-width:92px;justify-content:center}
.skills{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column;gap:14px}
.skills li{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:center} .sk-top{display:flex;justify-content:space-between;gap:8px;grid-column:1} .skills .meter{grid-column:1} .sk-act{grid-column:2;grid-row:1/3}
.badges{list-style:none;margin:8px 0;padding:0;display:flex;flex-direction:column;gap:8px}
.bdg{display:flex;gap:12px;align-items:center;padding:10px 12px;border-radius:var(--radius-md);background:var(--color-achievement-soft)}
.bdg svg{flex:none;width:24px;height:24px;color:var(--color-achievement)} .bdg>span:nth-child(2){flex:1}
.newtag{font:700 11px var(--font-body);color:#fff;background:var(--color-achievement);border-radius:999px;padding:3px 8px}
@media(max-width:960px){.dash-grid{grid-template-columns:1fr}}
@media(max-width:600px){.resume{flex-direction:column;align-items:stretch}.kpis{grid-template-columns:1fr 1fr}.lrows .status{min-width:0}}
"""
    return page("Mon espace", "Dashboard apprenant", body, css, "canvas", hash_state_script())


# ---------------------------------------------------------------- Admin
def admin_shell(active, content, role_label="Admin contenu"):
    tabs = "".join(f'<a href="#"{" aria-current=\"page\"" if t == active else ""}>{t}</a>' for t in ["Cours", "Importer un PDF"])
    return f"""<div class="admin-top"><div><p class="eyebrow-l">Administration · {role_label}</p></div>
<nav class="admin-tabs" aria-label="Administration">{tabs}</nav></div>{content}"""


ADMIN_CSS = """
.eyebrow-l{font:600 12px var(--font-body);letter-spacing:.06em;text-transform:uppercase;color:var(--color-text-muted)}
.admin-top{display:flex;flex-direction:column;gap:8px;margin-bottom:var(--space-5)}
.admin-tabs{display:flex;gap:4px;border-bottom:1px solid var(--color-border);overflow-x:auto}
.admin-tabs a{flex:none;padding:10px 14px;text-decoration:none;color:var(--color-text-muted);font:500 var(--text-sm) var(--font-body);border-bottom:2px solid transparent;margin-bottom:-1px;min-height:44px;display:flex;align-items:center}
.admin-tabs a[aria-current]{color:var(--color-primary);border-color:var(--color-primary);font-weight:600}
.page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:var(--space-5)} .page-head p{margin-top:4px}
.small{font-size:var(--text-sm)}
"""


def admin_cours():
    courses = m.admin_courses()[:8]
    def row(c, i):
        st = '<span class="status status-published">Publié</span>' if c["status"] == "PUBLISHED" else '<span class="status status-draft">Brouillon</span>'
        menu = ""
        if i == 0:
            menu = f"""<div class="menu" role="menu"><button role="menuitem">{icon("eye")} Publier</button><button role="menuitem">{icon("edit")} Modifier les infos</button><hr><button role="menuitem" class="danger">{icon("trash")} Supprimer…</button></div>"""
        return f"""<tr><td>{st}</td><td><a class="ct" href="#">{e(c['title'])}</a><span class="muted small sub">{e(SCHOOL.get(c['school_id'], c['school_id']))}{' · ' + c['level'] if c['level'] else ''}</span></td>
<td class="hide-md small muted">{'3 oct. 2026' if i < 2 else '28 sept. 2026'}</td>
<td class="act"><a class="btn btn-secondary" href="#">Gérer les leçons</a><span class="more-wrap"><button class="icon-btn" type="button" aria-label="Plus d’actions pour {e(c['title'])}" aria-haspopup="menu" aria-expanded="{'true' if i == 0 else 'false'}">{icon("more")}</button>{menu}</span></td></tr>"""
    rows = "".join(row(c, i) for i, c in enumerate(courses))
    content = f"""<div class="page-head"><div><h1>Cours</h1><p class="muted">27 cours · 7 brouillons à relire</p></div>
<div class="row"><a class="btn btn-secondary" href="#">{icon("upload")} Importer un PDF</a><button class="btn btn-primary" type="button">Nouveau cours</button></div></div>
<div class="panel tbl-panel">
<div class="toolbar">
 <div class="search"><label class="sr-only" for="q">Rechercher un cours</label>{icon("search")}<input id="q" class="input" type="search" placeholder="Rechercher un cours par titre"></div>
 <div class="segmented" role="group" aria-label="Statut"><button aria-pressed="true" type="button">Tous <span class="n">27</span></button><button aria-pressed="false" type="button">Publiés <span class="n">20</span></button><button aria-pressed="false" type="button">Brouillons <span class="n">7</span></button></div>
 <span class="ext" title="Recherche côté serveur : paramètre absent de GET /api/admin/courses">Extension : recherche sur tous les cours</span>
</div>
<table class="tbl"><thead><tr><th scope="col">Statut</th><th scope="col">Cours</th><th scope="col" class="hide-md">Mis à jour</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>{rows}</tbody></table>
<div class="pagination"><span class="muted small">1–20 sur 27</span><div class="row"><button class="btn btn-secondary" disabled type="button">{icon("chev-left")} Précédent</button><button class="btn btn-secondary" type="button">Suivant {icon("chev-right")}</button></div></div>
</div>
<div class="scrim"><div class="dialog panel" role="alertdialog" aria-modal="true" aria-labelledby="d-t" aria-describedby="d-d">
<h2 id="d-t">Supprimer « Guide interne RAG (import PDF) » ?</h2>
<p id="d-d" class="muted">Le cours et toutes ses leçons seront supprimés définitivement. Cette action ne peut pas être annulée. Pour un cours publié, la dépublication le retire du catalogue sans rien supprimer.</p>
<div class="row dlg-act"><button class="btn btn-secondary" type="button">Annuler</button><button class="btn btn-danger" type="button" style="background:var(--color-danger);color:#fff;border-color:var(--color-danger)">{icon("trash")} Supprimer définitivement</button></div></div></div>"""
    body = f"""{header("admin", "Administration")}<main><div class="container">{admin_shell("Cours", content)}</div></main>"""
    css = ADMIN_CSS + """
.tbl-panel{padding:0;overflow:visible}
.toolbar{display:flex;gap:var(--space-3);align-items:center;flex-wrap:wrap;padding:var(--space-4) var(--space-5);border-bottom:1px solid var(--color-border)} .toolbar .search{flex:1;min-width:220px;max-width:420px}
.tbl{width:100%;border-collapse:collapse} .tbl th{text-align:left;font:600 12px var(--font-body);letter-spacing:.05em;text-transform:uppercase;color:var(--color-text-muted);padding:10px var(--space-5);background:var(--color-surface-muted);border-bottom:1px solid var(--color-border)}
.tbl td{padding:12px var(--space-5);border-bottom:1px solid var(--color-border);vertical-align:middle} .tbl td:first-child{width:130px}
.ct{font-weight:600;text-decoration:none;display:block} .ct:hover{color:var(--color-primary);text-decoration:underline} .sub{display:block;margin-top:2px}
.act{text-align:right;white-space:nowrap} .act .btn{margin-right:6px}
.more-wrap{position:relative;display:inline-block}
.menu{position:absolute;right:0;top:calc(100% + 6px);z-index:5;background:#fff;border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:var(--shadow-2);padding:6px;min-width:210px;text-align:left}
.menu button{display:flex;align-items:center;gap:10px;width:100%;border:0;background:none;padding:9px 10px;border-radius:var(--radius-sm);font:500 var(--text-sm) var(--font-body);cursor:pointer;min-height:40px} .menu button:hover{background:var(--color-surface-muted)} .menu svg{width:16px;height:16px} .menu hr{border:0;border-top:1px solid var(--color-border);margin:4px 0} .menu .danger{color:var(--color-danger)}
.pagination{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:var(--space-4) var(--space-5);flex-wrap:wrap}
.scrim{display:none} .state-suppression .menu{display:none} .state-suppression .scrim{display:flex;position:fixed;inset:0;background:rgba(16,24,43,.45);align-items:center;justify-content:center;padding:16px;z-index:50}
.dialog{max-width:520px;box-shadow:var(--shadow-2)} .dialog h2{font-size:1.2rem;margin-bottom:8px} .dlg-act{justify-content:flex-end;margin-top:var(--space-5)}
@media(max-width:860px){.hide-md{display:none}}
@media(max-width:600px){.toolbar{padding:var(--space-4)} .toolbar .search{max-width:none;min-width:0;flex-basis:100%}
 .tbl thead{display:none} .tbl,.tbl tbody,.tbl tr,.tbl td{display:block;width:100%} .tbl tr{padding:14px var(--space-4);border-bottom:1px solid var(--color-border);display:grid;grid-template-columns:1fr auto;gap:8px}
 .tbl td{padding:0;border:0} .tbl td:first-child{width:auto;grid-column:1} .tbl td:nth-child(2){grid-column:1/3} .act{grid-column:1/3;display:flex!important;gap:8px} .act .btn{flex:1;margin:0}
 .pagination{padding:var(--space-4)} .page-head .row{width:100%} .page-head .row .btn{flex:1} .dlg-act .btn{width:100%}}
"""
    return page("Administration — Cours", "Administration du contenu : liste des cours (ADMIN)", body, css, "canvas", hash_state_script())


# ---------------------------------------------------------------- PDF
def stepper(cur):
    labels = ["Choisir le document", "Vérifier l’analyse", "Résultat"]
    out = ""
    for i, lab in enumerate(labels, 1):
        cls = "done" if i < cur or (cur == 3 and i == 3) else ""
        aria = ' aria-current="step"' if i == cur else ""
        dot = icon("check") if cls == "done" else str(i)
        out += f'<li class="{cls}"{aria}><span class="dot">{dot}</span><span class="txt">{lab}</span></li>'
    return f'<ol class="stepper" aria-label="Étapes de l’import">{out}</ol>'


PDF_CSS = ADMIN_CSS + """
.pdf-wrap{max-width:880px} .stepper{margin:0 0 var(--space-5)} .stepper .dot svg{width:16px;height:16px}
.drop{display:flex;align-items:center;gap:16px;border:2px dashed var(--color-border-strong);border-radius:var(--radius-md);padding:20px;background:var(--color-surface-muted)}
.drop>svg{width:32px;height:32px;color:var(--color-primary);flex:none}
.filechip{display:flex;align-items:center;gap:12px;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:12px 14px;background:#fff}
.filechip svg{width:24px;height:24px;color:var(--color-danger);flex:none} .filechip .fn{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.form{display:flex;flex-direction:column;gap:var(--space-5)}
fieldset{border:0;margin:0;padding:0} legend{font:600 var(--text-sm) var(--font-body);margin-bottom:8px}
.choices{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.choice{display:flex;gap:12px;align-items:flex-start;border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:14px 16px;cursor:pointer;background:#fff}
.choice input{margin-top:4px;width:18px;height:18px;accent-color:var(--color-primary)} .choice.on{background:var(--color-primary-soft)} .choice.on strong{color:#1d3f91}
.choice strong{display:block} .choice span span{font-size:var(--text-sm);color:var(--color-text-muted)}
.foot{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;border-top:1px solid var(--color-border);padding-top:var(--space-4)}
.recap svg{width:20px;height:20px;color:var(--color-danger)}
.recap{display:flex;flex-wrap:wrap;gap:8px 24px;align-items:center;font-size:var(--text-sm)} .recap b{font-weight:600}
.kpis{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(5,1fr);gap:var(--space-3)}
.kpis li{border:1px solid var(--color-border);border-radius:var(--radius-md);padding:12px 14px;background:#fff} .kpis strong{display:block;font:700 1.375rem var(--font-display)} .kpis span{font-size:var(--text-sm);color:var(--color-text-muted)}
.anoms{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px} .pg{font:600 12px var(--font-mono);background:#fff;border-radius:4px;padding:1px 6px;margin-right:8px}
.tree{list-style:none;margin:0;padding:0;font-size:var(--text-sm)} .tree ul{list-style:none;margin:0;padding:0 0 0 22px;border-left:1px solid var(--color-border);margin-left:8px}
.tree li{padding:4px 0} .node{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 8px;border-radius:var(--radius-sm)} .node.lvl1{font-weight:600}
.node .pages{font:500 12px var(--font-mono);color:var(--color-text-muted);margin-left:auto}
.blk{display:flex;gap:8px;padding:2px 8px 2px 30px;color:var(--color-text-muted)} .blk .k{flex:none;font:500 11px var(--font-mono);text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);border:1px solid var(--color-border);border-radius:4px;padding:1px 5px;height:fit-content;margin-top:2px}
.blk .t{color:var(--color-text);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}
.confirm-bar{position:sticky;bottom:0;margin-top:var(--space-5);background:#fff;border:1px solid var(--color-border);border-radius:var(--radius-md);box-shadow:0 -8px 24px -16px rgba(16,24,43,.25);padding:14px 18px;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}
.confirm-bar p{font-size:var(--text-sm)}
.success-head{display:flex;gap:16px;align-items:flex-start} .ok-ic{flex:none;width:44px;height:44px;border-radius:50%;background:var(--color-success-soft);color:var(--color-success);display:flex;align-items:center;justify-content:center} .ok-ic svg{width:24px}
.created{list-style:none;margin:var(--space-4) 0;padding:0;border:1px solid var(--color-border);border-radius:var(--radius-md)} .created li{display:flex;gap:12px;align-items:center;padding:12px 16px;flex-wrap:wrap} .created li+li{border-top:1px solid var(--color-border)} .created .k{width:140px;color:var(--color-text-muted);font-size:var(--text-sm)}
.gap{display:flex;flex-direction:column;gap:var(--space-4)}
@media(max-width:860px){.kpis{grid-template-columns:repeat(3,1fr)}}
@media(max-width:600px){.choices{grid-template-columns:1fr}.kpis{grid-template-columns:repeat(2,1fr)}.drop{flex-direction:column;text-align:center}
 .foot .btn,.confirm-bar .btn{width:100%} .confirm-bar .btn-secondary{display:none} .confirm-bar{position:sticky;bottom:0;border-radius:var(--radius-md) var(--radius-md) 0 0} .created .k{width:auto;flex-basis:100%}
 .node .pages{margin-left:0}}
"""


def pdf_page(step):
    p = m.PDF_PREVIEW; r = p["report"]
    if step == 1:
        inner = f"""<form class="panel form" onsubmit="return false">
<div class="field"><span class="label" id="f-l">Document PDF</span>
 <div class="filechip">{icon("file")}<span class="fn">support-synthetique.pdf</span><span class="muted small">12 Ko</span><label class="btn btn-ghost" for="file">Changer</label><input id="file" class="sr-only" type="file" accept="application/pdf" aria-labelledby="f-l"></div>
 <p class="hint">PDF avec couche texte. Les PDF scannés (sans texte) ne sont pas pris en charge : l’OCR n’existe pas encore.</p></div>
<div class="field"><label for="school">École de rattachement</label><select id="school" class="select"><option>{e(m.SCHOOLS[6]['name'])}</option></select></div>
<fieldset><legend>Que doit produire l’import ?</legend><div class="choices">
<label class="choice on"><input type="radio" name="mode" checked><span><strong>Un cours en brouillon</strong><span>Cours + leçon créés en brouillon, à relire puis publier. Recommandé pour un support de formation.</span></span></label>
<label class="choice"><input type="radio" name="mode"><span><strong>Un document de référence</strong><span>Versé au corpus documentaire, aucun cours créé. Pour un ouvrage entier.</span></span></label>
</div></fieldset>
<div class="notice notice-info">{icon("info")}<div>L’analyse ne crée rien. Vous verrez la structure détectée et les points à vérifier avant de confirmer.</div></div>
<div class="foot"><span class="muted small">Étape 1 sur 3</span><button class="btn btn-primary btn-lg" type="submit">Analyser le document {icon("arrow-right")}</button></div>
</form>"""
    elif step == 2:
        def tree(sections, lvl=1):
            out = ""
            for s in sections:
                warn = '<span class="status status-warning">À vérifier</span>' if s["confidence"] < 0.6 else ""
                pages = f'p. {s["page_start"]+1}' + (f'–{s["page_end"]+1}' if s["page_end"] != s["page_start"] else "")
                blks = "".join(f'<div class="blk"><span class="k">{m_kind(b["kind"])}</span><span class="t">{e(b["preview"])}</span></div>' for b in s["blocks"])
                kids = f"<ul>{tree(s['children'], lvl+1)}</ul>" if s["children"] else ""
                out += f'<li><div class="node lvl{lvl}">{e(s["title"])} {warn}<span class="pages">{pages}</span></div>{blks}{kids}</li>'
            return out
        anoms = "".join(f'<li><span class="pg">p. {a["page"]+1}</span>{e(a["message"])}</li>' for a in r["anomalies"])
        inner = f"""<div class="gap">
<div class="panel recap"><span>{icon("file")}</span><span><b>support-synthetique.pdf</b></span><span>École : <b>{e(m.SCHOOLS[6]['short_name'])}</b></span><span>Produira : <b>un cours en brouillon</b></span><a class="btn btn-ghost" href="#">Modifier</a></div>
<section class="panel" aria-labelledby="a-t"><h2 id="a-t" style="font-size:1.2rem">{e(p['title'])}</h2><p class="muted small" style="margin:4px 0 16px">{p['pages']} pages analysées · document numérique · confiance moyenne {round(r['average_confidence']*100)} %</p>
<ul class="kpis"><li><strong>{r['sections']}</strong><span>sections</span></li><li><strong>{r['subsections']}</strong><span>sous-sections</span></li><li><strong>{r['blocks']}</strong><span>blocs</span></li><li><strong>{r['tables']}</strong><span>tableau</span></li><li><strong>{r['code_blocks']+r['formulas']}</strong><span>code / formule</span></li></ul></section>
<div class="notice notice-warning" role="status">{icon("alert")}<div><strong>{len(r['anomalies'])} points à vérifier avant d’importer</strong><ul class="anoms">{anoms}</ul></div></div>
<section class="panel" aria-labelledby="t-t"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h2 id="t-t" style="font-size:1.1rem">Structure détectée</h2><button class="btn btn-ghost" type="button">Tout replier</button></div><ul class="tree">{tree(p['sections'])}</ul></section>
<div class="confirm-bar"><p><strong>Rien n’est encore enregistré.</strong> L’import créera 1 cours brouillon et 1 leçon ({r['blocks']} blocs).</p><div class="row"><button class="btn btn-secondary" type="button">Choisir un autre fichier</button><button class="btn btn-primary btn-lg" type="button">Confirmer l’import</button></div></div>
</div>"""
    else:
        inner = f"""<section class="panel" aria-labelledby="ok-t">
<div class="success-head"><span class="ok-ic">{icon("check")}</span><div><h2 id="ok-t" style="font-size:1.3rem">Import terminé : brouillon créé</h2><p class="muted">Le contenu n’est pas visible des apprenants tant qu’il n’est pas publié.</p></div></div>
<ul class="created"><li><span class="k">Cours</span><strong>{e(p['title'])}</strong><span class="status status-draft">Brouillon</span></li>
<li><span class="k">Leçon</span><span>1 leçon · {r['blocks']} blocs</span></li><li><span class="k">École</span><span>{e(m.SCHOOLS[6]['name'])}</span></li><li><span class="k">Pages extraites</span><span>{p['pages']}</span></li></ul>
<div class="row"><a class="btn btn-primary btn-lg btn-block-sm" href="#">{icon("edit")} Relire la leçon</a><a class="btn btn-secondary btn-lg btn-block-sm" href="#">Voir le cours</a><a class="btn btn-ghost btn-block-sm" href="#">{icon("upload")} Importer un autre PDF</a></div>
</section>"""
    titles = {1: "Import PDF — 1. Sélection", 2: "Import PDF — 2. Analyse et prévisualisation", 3: "Import PDF — 3. Confirmation et résultat"}
    content = f"""<div class="pdf-wrap"><div class="page-head"><div><h1>Importer un PDF</h1><p class="muted">Créez un cours brouillon à partir d’un support existant.</p></div></div>{stepper(step)}{inner}</div>"""
    body = f"""{header("admin", "Administration")}<main><div class="container">{admin_shell("Importer un PDF", content)}</div></main>"""
    return page(titles[step], titles[step] + " (ADMIN)", body, PDF_CSS, "canvas", "")


def m_kind(k):
    return {"TEXT": "texte", "LIST": "liste", "CODE": "code", "TABLE": "tableau", "FORMULA": "formule", "CAPTION": "légende"}.get(k, k.lower())


FILES = {
    "apres-catalogue.html": catalogue(), "apres-lecon.html": lecon(), "apres-dashboard.html": dashboard(),
    "apres-admin-cours.html": admin_cours(), "apres-pdf-1-selection.html": pdf_page(1),
    "apres-pdf-2-previsualisation.html": pdf_page(2), "apres-pdf-3-resultat.html": pdf_page(3),
}
for name, html in FILES.items():
    (OUT / name).write_text(html, encoding="utf-8")
print("ok", list(FILES))
