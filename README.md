# Sevn Systems — site web

Site multi-pages, en français, hébergé sur Railway.

## 📂 Structure

| Fichier / dossier | Page |
|---|---|
| **index.html** | Accueil |
| **methode.html** | Notre méthode (les 7 systèmes) |
| **secteurs.html** | Secteurs |
| **cas-clients.html** | Cas clients |
| **pourquoi.html** | Pourquoi nous + offre + FAQ |
| **contact.html** | Devis / contact |
| **blog.html** | Liste des articles |
| **blog/** | Les articles de blog |
| **assets/style.css** | Le design de TOUT le site (une seule feuille) |
| **assets/*.svg** | Logos et favicon |
| package.json, .gitignore | Technique — ne pas toucher |

👉 **Le design de tout le site est dans `assets/style.css`.** Une modif de couleur ou d'espacement là-dedans s'applique à toutes les pages d'un coup.

## ✏️ Modifs fréquentes

- **Chiffres de la page d'accueil** : dans `index.html`, cherche `100+` (commentaire « Remplace ces chiffres »).
- **Cas clients** : dans `cas-clients.html`, cherche le commentaire « REMPLACE ces cas » — mets tes vrais résultats.
- **Articles de blog** : ajoute un fichier dans `blog/` en copiant un article existant, puis ajoute une carte dans `blog.html`.
- **Email de contact** : cherche `hello@sevnsystems.com`.

## 🔌 Brancher le formulaire au CRM

Dans `index.html` ET `contact.html`, en bas, il y a :
```js
const CRM_ENDPOINT = "";
const CRM_API_KEY = "";
```
Une fois le CRM déployé, mets l'URL du CRM (`https://.../api/leads`) et ta clé API.
Les leads du formulaire arriveront alors directement dans le CRM.

## 🚀 Déploiement Railway

Nouveau repo GitHub → New Project → Deploy from GitHub repo → Generate Domain (port 8080).
Puis brancher le domaine `sevnsystems.com` (Settings → Domains).

## 🌍 Version anglaise

Le site est en français (marché FR + SEO). Pour le marché US, on ajoutera
des versions anglaises des pages le moment venu.
