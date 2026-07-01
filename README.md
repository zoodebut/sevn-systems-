# Sevn Systems — site vitrine

Site d'une page, bilingue FR/EN, hébergé sur Railway.

## 📂 Les fichiers (et ce que tu touches ou pas)

| Fichier | C'est quoi | Tu y touches ?|
|---|---|---|
| **index.html** | TOUT le site : design, textes, formulaire | ✅ OUI — c'est le seul fichier à modifier |
| package.json | Dit à Railway comment lancer le site | ❌ NON — ne jamais toucher |
| .gitignore | Ignore les fichiers techniques | ❌ NON |
| README.md | Ce fichier | — |

👉 **Règle simple : pour changer le site, tu modifies UNIQUEMENT `index.html`. Le reste, tu n'y touches jamais.**

## 🚀 Mettre en ligne (première fois)

1. Créer un repo GitHub, y déposer ces 4 fichiers
2. Sur Railway : New Project → Deploy from GitHub repo → choisir ce repo
3. Railway détecte `package.json` et lance tout seul
4. Une URL Railway est générée → ton site est en ligne

## 🔄 Faire une modif

1. Modifier `index.html`
2. `git add . && git commit -m "ma modif" && git push`
3. Railway redéploie automatiquement en ~1 min

## 🌐 Brancher le domaine sevnsystems.com

Dans Railway → Settings → Domains → Custom Domain → `sevnsystems.com`
Railway te donne une valeur à copier dans les DNS OVH (CNAME).

## ✏️ Modifs les plus fréquentes (repères dans index.html)

- **Nombre de clients** : chercher `[XXX]` → remplacer par ton chiffre
- **Témoignages** : chercher `tcard` → dupliquer un bloc
- **Email de contact** : chercher `hello@sevnsystems.com`
- **Le formulaire** : chercher `formcard` (voir note ci-dessous)

## ⚠️ Le formulaire

Le formulaire est visuel : il ne renvoie encore les données nulle part.
Pour recevoir les prospects, il faut le brancher à Tally, Formspree ou Calendly.
(À faire dans un second temps.)
