/* ============================================================
   SEVN SYSTEMS — CRM · serveur principal (v3)

   Circuits :
     - Prospects Sevn Systems (formulaires sevnsystems.com) → admin uniquement
     - Leads clients (les leads DE TES CLIENTS)             → un espace par client

   Fonctionnalités v3 :
     - Montant du deal (€) + raison si perdu → CA & taux de conversion (partout)
     - Champs personnalisés par client (fondation "sur-mesure")
     - Webhook Calendly (heure de RDV en horodatage universel, jamais de calcul manuel)
     - Notifications email (Resend) + SMS (Twilio), on/off par client
     - Historique des changements par lead

   ⚙️  Variables d'environnement (Railway → Variables) :
     ADMIN_PASSWORD, API_KEY, SECRET, DATA_DIR   → comme avant
     ADMIN_EMAIL                                 → pour être notifiée de tes prospects
     RESEND_API_KEY, RESEND_FROM                 → email (optionnel)
     TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
     TWILIO_FROM_NUMBER                          → SMS (optionnel)
     ADMIN_PHONE                                 → ton numéro, pour SMS sur tes prospects
     CALENDLY_WEBHOOK_SECRET                     → (optionnel) signature du webhook Calendly
   ============================================================ */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 8080;

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'sevn2026';
const API_KEY = process.env.API_KEY || 'sevn-lead-key-2026';
const SECRET = process.env.SECRET || 'change-moi-en-prod';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM = process.env.RESEND_FROM || 'Sevn Systems <onboarding@resend.dev>';
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM_NUMBER || '';
const CALENDLY_WEBHOOK_SECRET = process.env.CALENDLY_WEBHOOK_SECRET || '';

const PROSPECTS_FILE = path.join(DATA_DIR, 'prospects.json');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const CLIENT_LEADS_FILE = path.join(DATA_DIR, 'client_leads.json');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || '';
const META_GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v19.0';

const STATUTS = ['nouveau', 'a_rappeler', 'rdv_pris', 'gagne', 'perdu'];

// --- stockage -----------------------------------------------------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
function ensureFile(file, initial) { if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2)); }
ensureFile(PROSPECTS_FILE, { leads: [] });
ensureFile(CLIENTS_FILE, { clients: [] });
ensureFile(CLIENT_LEADS_FILE, { leads: [] });
ensureFile(CAMPAIGNS_FILE, { campaigns: [] });

function readJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; } }
function writeJSON(file, data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
const readProspects = () => readJSON(PROSPECTS_FILE, { leads: [] });
const writeProspects = (d) => writeJSON(PROSPECTS_FILE, d);
const readClients = () => readJSON(CLIENTS_FILE, { clients: [] });
const writeClients = (d) => writeJSON(CLIENTS_FILE, d);
const readClientLeads = () => readJSON(CLIENT_LEADS_FILE, { leads: [] });
const writeClientLeads = (d) => writeJSON(CLIENT_LEADS_FILE, d);
const readCampaigns = () => readJSON(CAMPAIGNS_FILE, { campaigns: [] });
const writeCampaigns = (d) => writeJSON(CAMPAIGNS_FILE, d);

// --- sécurité -------------------------------------------------------
const hash = (s) => crypto.createHash('sha256').update(s + SECRET).digest('hex');
const adminToken = () => hash('admin:' + ADMIN_PASSWORD);
const clientToken = (id) => id + '.' + hash('client:' + id);
function parseClientToken(token) {
  if (!token) return null;
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const id = token.slice(0, idx);
  if (hash('client:' + id) !== token.slice(idx + 1)) return null;
  return id;
}
const genKey = (prefix, len = 20) => prefix + '_' + crypto.randomBytes(len).toString('hex').slice(0, len);
const genPassword = () => crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 9);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://sevnsystems.com');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- notifications (best-effort, jamais bloquant) -------------------
async function sendEmail(to, subject, text) {
  if (!RESEND_API_KEY || !to) return { skipped: true };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, text })
    });
    if (!r.ok) console.error('Resend error', r.status, await r.text());
    return { ok: r.ok };
  } catch (e) { console.error('Erreur email', e.message); return { ok: false }; }
}
async function sendSMS(to, body) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !to) return { skipped: true };
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body })
    });
    if (!r.ok) console.error('Twilio error', r.status, await r.text());
    return { ok: r.ok };
  } catch (e) { console.error('Erreur SMS', e.message); return { ok: false }; }
}

// --- helpers métier --------------------------------------------------
function pushHistory(lead, field, from, to) {
  lead.history = lead.history || [];
  lead.history.push({ at: new Date().toISOString(), field, from, to });
  if (lead.history.length > 50) lead.history = lead.history.slice(-50); // borne la taille
}
function applyPatch(lead, body, allowedFields) {
  allowedFields.forEach(k => {
    if (!(k in body)) return;
    if (k === 'statut' && !STATUTS.includes(body[k])) return;
    if (body[k] !== lead[k]) { pushHistory(lead, k, lead[k], body[k]); lead[k] = body[k]; }
  });
  return lead;
}
function computeStats(leads) {
  const total = leads.length;
  const gagne = leads.filter(l => l.statut === 'gagne');
  const perdu = leads.filter(l => l.statut === 'perdu');
  const decided = gagne.length + perdu.length;
  const revenue = gagne.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);
  const byMonth = {};
  gagne.forEach(l => {
    const d = l.won_at || l.created_at;
    const key = new Date(d).toISOString().slice(0, 7); // YYYY-MM
    byMonth[key] = (byMonth[key] || 0) + (Number(l.deal_value) || 0);
  });
  return {
    total,
    nouveau: leads.filter(l => l.statut === 'nouveau').length,
    a_rappeler: leads.filter(l => l.statut === 'a_rappeler').length,
    rdv_pris: leads.filter(l => l.statut === 'rdv_pris').length,
    gagne: gagne.length,
    perdu: perdu.length,
    conversion_rate: decided ? Math.round((gagne.length / decided) * 1000) / 10 : null,
    revenue_total: revenue,
    revenue_by_month: byMonth
  };
}

// --- performance par campagne (coût/lead, coût/RDV, ROI) --------------
function computeCampaignStats(campaigns, leads) {
  const rows = campaigns.map(camp => {
    const mine = leads.filter(l => l.campaign_id === camp.id);
    const rdv = mine.filter(l => ['rdv_pris', 'gagne', 'perdu'].includes(l.statut) || l.meeting_at);
    const gagne = mine.filter(l => l.statut === 'gagne');
    const perdu = mine.filter(l => l.statut === 'perdu');
    const decided = gagne.length + perdu.length;
    const revenue = gagne.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);
    const budget = Number(camp.budget) || 0;
    return {
      id: camp.id, nom: camp.nom, plateforme: camp.plateforme, statut: camp.statut,
      budget, meta_campaign_id: camp.meta_campaign_id || '', created_at: camp.created_at,
      leads_count: mine.length,
      rdv_count: rdv.length,
      gagne_count: gagne.length,
      perdu_count: perdu.length,
      conversion_rate: decided ? Math.round((gagne.length / decided) * 1000) / 10 : null,
      revenue,
      cost_per_lead: mine.length ? Math.round((budget / mine.length) * 100) / 100 : null,
      cost_per_rdv: rdv.length ? Math.round((budget / rdv.length) * 100) / 100 : null,
      roi: budget > 0 ? Math.round(((revenue - budget) / budget) * 1000) / 10 : null
    };
  });
  const unattributed = leads.filter(l => !l.campaign_id);
  return { campaigns: rows, unattributed_count: unattributed.length };
}

// --- middlewares d'auth ------------------------------------------------
function requireAdmin(req, res, next) {
  if (req.cookies && req.cookies.sevn_auth === adminToken()) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'non autorisé' });
  return res.redirect('/login');
}
function requireClient(req, res, next) {
  const clientId = parseClientToken(req.cookies && req.cookies.sevn_client_auth);
  if (!clientId) { if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'non autorisé' }); return res.redirect('/client/login'); }
  const client = readClients().clients.find(c => c.id === clientId && c.active !== false);
  if (!client) { if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'compte désactivé' }); return res.redirect('/client/login'); }
  req.client = client;
  next();
}

const LEAD_FIELDS = ['nom', 'email', 'telephone', 'secteur', 'zone', 'notes', 'statut', 'deal_value', 'lost_reason', 'meeting_at', 'custom', 'campaign_id'];

/* ============================================================
   1) PROSPECTS SEVN SYSTEMS
   ============================================================ */
app.post('/api/leads', async (req, res) => {
  const key = req.headers['x-api-key'] || (req.body && req.body.api_key);
  if (key !== API_KEY) return res.status(401).json({ error: 'clé API invalide' });
  const b = req.body || {};
  const data = readProspects();
  const lead = {
    id: crypto.randomUUID(), nom: b.nom || b.name || '', email: b.email || '',
    telephone: b.telephone || b.phone || b.tel || '', secteur: b.secteur || b.sector || '',
    zone: b.zone || b.ville || b.city || '', notes: b.notes || '', statut: 'nouveau',
    deal_value: null, lost_reason: '', meeting_at: null, custom: {},
    source: b.source || 'site', created_at: new Date().toISOString(), history: []
  };
  if (!lead.nom && !lead.email && !lead.telephone) return res.status(400).json({ error: 'lead vide' });
  data.leads.unshift(lead);
  writeProspects(data);
  sendEmail(ADMIN_EMAIL, `Nouveau prospect — ${lead.nom || lead.email}`, `Secteur : ${lead.secteur}\nZone : ${lead.zone}\nTéléphone : ${lead.telephone}\n\nDashboard : connecte-toi pour le traiter.`);
  sendSMS(ADMIN_PHONE, `Nouveau prospect Sevn Systems: ${lead.nom || lead.email} (${lead.secteur||'?'}) - ${lead.telephone}`);
  res.json({ ok: true, id: lead.id });
});

app.post('/api/login', (req, res) => {
  if ((req.body || {}).password === ADMIN_PASSWORD) {
    res.cookie('sevn_auth', adminToken(), { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 2592000000 });
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'mot de passe incorrect' });
});
app.post('/api/logout', (req, res) => { res.clearCookie('sevn_auth'); res.json({ ok: true }); });

app.get('/api/leads', requireAdmin, (req, res) => res.json(readProspects().leads));
app.get('/api/stats', requireAdmin, (req, res) => res.json(computeStats(readProspects().leads)));

app.post('/api/leads/manual', requireAdmin, (req, res) => {
  const b = req.body || {};
  const data = readProspects();
  const lead = {
    id: crypto.randomUUID(), nom: b.nom || '', email: b.email || '', telephone: b.telephone || '',
    secteur: b.secteur || '', zone: b.zone || '', notes: b.notes || '',
    statut: STATUTS.includes(b.statut) ? b.statut : 'nouveau',
    deal_value: null, lost_reason: '', meeting_at: null, custom: {},
    source: 'manuel', created_at: new Date().toISOString(), history: []
  };
  data.leads.unshift(lead);
  writeProspects(data);
  res.json({ ok: true, lead });
});
app.patch('/api/leads/:id', requireAdmin, (req, res) => {
  const data = readProspects();
  const lead = data.leads.find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'introuvable' });
  const wasGagne = lead.statut === 'gagne';
  applyPatch(lead, req.body, LEAD_FIELDS);
  if (!wasGagne && lead.statut === 'gagne') lead.won_at = new Date().toISOString();
  writeProspects(data);
  res.json({ ok: true, lead });
});
app.delete('/api/leads/:id', requireAdmin, (req, res) => {
  const data = readProspects();
  data.leads = data.leads.filter(l => l.id !== req.params.id);
  writeProspects(data);
  res.json({ ok: true });
});

/* ============================================================
   2) CLIENTS — gestion (admin)
   ============================================================ */
app.get('/api/clients', requireAdmin, (req, res) => {
  const clients = readClients().clients;
  const allLeads = readClientLeads().leads;
  res.json(clients.map(c => {
    const mine = allLeads.filter(l => l.client_id === c.id);
    const stats = computeStats(mine);
    return { ...c, password_hash: undefined, leads_count: mine.length, stats };
  }));
});
app.post('/api/clients', requireAdmin, async (req, res) => {
  const b = req.body || {};
  if (!b.nom || !b.email) return res.status(400).json({ error: 'nom et email requis' });
  const data = readClients();
  if (data.clients.some(c => c.email.toLowerCase() === b.email.toLowerCase())) return res.status(409).json({ error: 'un client avec cet email existe déjà' });
  const password = genPassword();
  const client = {
    id: crypto.randomUUID(), nom: b.nom, email: b.email, secteur: b.secteur || '',
    telephone: b.telephone || '', password_hash: hash('pwd:' + password), api_key: genKey('client'),
    active: true, sms_enabled: false, email_enabled: true, custom_fields: [],
    calendly_event_slug: '', meta_page_id: b.meta_page_id || '', meta_page_token: b.meta_page_token || '',
    created_at: new Date().toISOString()
  };
  data.clients.push(client);
  writeClients(data);
  const emailResult = await sendEmail(client.email, 'Vos accès Sevn Systems',
    `Bonjour ${client.nom},\n\nVotre espace leads est prêt.\n\nConnexion : ${req.protocol}://${req.get('host')}/client/login\nEmail : ${client.email}\nMot de passe : ${password}\n\nÀ bientôt,\nSevn Systems`);
  res.json({ ok: true, client: { ...client, password_hash: undefined }, password, email_sent: !!emailResult.ok });
});
app.patch('/api/clients/:id', requireAdmin, (req, res) => {
  const data = readClients();
  const client = data.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'introuvable' });
  const b = req.body || {};
  ['nom', 'email', 'secteur', 'telephone', 'active', 'sms_enabled', 'email_enabled', 'custom_fields', 'calendly_event_slug', 'meta_page_id', 'meta_page_token'].forEach(k => { if (k in b) client[k] = b[k]; });
  if (b.reset_password) client.password_hash = hash('pwd:' + b.reset_password);
  if (b.regenerate_key) client.api_key = genKey('client');
  writeClients(data);
  res.json({ ok: true, client: { ...client, password_hash: undefined } });
});
app.delete('/api/clients/:id', requireAdmin, (req, res) => {
  const data = readClients();
  data.clients = data.clients.filter(c => c.id !== req.params.id);
  writeClients(data);
  const ld = readClientLeads();
  ld.leads = ld.leads.filter(l => l.client_id !== req.params.id);
  writeClientLeads(ld);
  res.json({ ok: true });
});
app.get('/api/clients/:id/leads', requireAdmin, (req, res) => res.json(readClientLeads().leads.filter(l => l.client_id === req.params.id)));
app.get('/api/clients/:id/stats', requireAdmin, (req, res) => res.json(computeStats(readClientLeads().leads.filter(l => l.client_id === req.params.id))));
app.patch('/api/clients/:cid/leads/:lid', requireAdmin, (req, res) => {
  const data = readClientLeads();
  const lead = data.leads.find(l => l.id === req.params.lid && l.client_id === req.params.cid);
  if (!lead) return res.status(404).json({ error: 'introuvable' });
  const wasGagne = lead.statut === 'gagne';
  applyPatch(lead, req.body, LEAD_FIELDS);
  if (!wasGagne && lead.statut === 'gagne') lead.won_at = new Date().toISOString();
  writeClientLeads(data);
  res.json({ ok: true, lead });
});
app.delete('/api/clients/:cid/leads/:lid', requireAdmin, (req, res) => {
  const data = readClientLeads();
  data.leads = data.leads.filter(l => !(l.id === req.params.lid && l.client_id === req.params.cid));
  writeClientLeads(data);
  res.json({ ok: true });
});

/* ============================================================
   2bis) CAMPAGNES — gestion + performance par campagne (admin)
   ============================================================ */
app.get('/api/clients/:id/campaigns', requireAdmin, (req, res) => {
  const camps = readCampaigns().campaigns.filter(c => c.client_id === req.params.id);
  res.json(camps);
});
app.get('/api/clients/:id/campaigns/stats', requireAdmin, (req, res) => {
  const camps = readCampaigns().campaigns.filter(c => c.client_id === req.params.id);
  const leads = readClientLeads().leads.filter(l => l.client_id === req.params.id);
  res.json(computeCampaignStats(camps, leads));
});
app.post('/api/clients/:id/campaigns', requireAdmin, (req, res) => {
  const clientsData = readClients();
  if (!clientsData.clients.some(c => c.id === req.params.id)) return res.status(404).json({ error: 'client introuvable' });
  const b = req.body || {};
  if (!b.nom) return res.status(400).json({ error: 'nom requis' });
  const data = readCampaigns();
  const camp = {
    id: crypto.randomUUID(), client_id: req.params.id, nom: b.nom,
    plateforme: b.plateforme || 'meta', budget: Number(b.budget) || 0,
    statut: b.statut || 'active', meta_campaign_id: b.meta_campaign_id || '',
    created_at: new Date().toISOString()
  };
  data.campaigns.unshift(camp);
  writeCampaigns(data);
  res.json({ ok: true, campaign: camp });
});
app.patch('/api/clients/:cid/campaigns/:camid', requireAdmin, (req, res) => {
  const data = readCampaigns();
  const camp = data.campaigns.find(c => c.id === req.params.camid && c.client_id === req.params.cid);
  if (!camp) return res.status(404).json({ error: 'introuvable' });
  const b = req.body || {};
  ['nom', 'plateforme', 'budget', 'statut', 'meta_campaign_id'].forEach(k => { if (k in b) camp[k] = (k === 'budget') ? Number(b[k]) || 0 : b[k]; });
  writeCampaigns(data);
  res.json({ ok: true, campaign: camp });
});
app.delete('/api/clients/:cid/campaigns/:camid', requireAdmin, (req, res) => {
  const data = readCampaigns();
  data.campaigns = data.campaigns.filter(c => !(c.id === req.params.camid && c.client_id === req.params.cid));
  writeCampaigns(data);
  // les leads déjà attribués gardent leur campaign_id (historique), ils repasseront simplement en "non attribué" à l'affichage
  res.json({ ok: true });
});
// attribution manuelle d'un lead à une campagne (utile pour les leads Google/site sans attribution auto)
app.patch('/api/clients/:cid/leads/:lid/campaign', requireAdmin, (req, res) => {
  const data = readClientLeads();
  const lead = data.leads.find(l => l.id === req.params.lid && l.client_id === req.params.cid);
  if (!lead) return res.status(404).json({ error: 'introuvable' });
  lead.campaign_id = req.body && req.body.campaign_id ? req.body.campaign_id : null;
  writeClientLeads(data);
  res.json({ ok: true, lead });
});

/* ============================================================
   3) LEADS D'UN CLIENT — réception publique (clé API propre au client)
   ============================================================ */
app.post('/api/client-leads', async (req, res) => {
  const key = req.headers['x-api-key'] || (req.body && req.body.api_key);
  const client = readClients().clients.find(c => c.api_key === key && c.active !== false);
  if (!client) return res.status(401).json({ error: 'clé API invalide' });
  const b = req.body || {};
  const data = readClientLeads();
  const lead = {
    id: crypto.randomUUID(), client_id: client.id, nom: b.nom || b.name || '', email: b.email || '',
    telephone: b.telephone || b.phone || b.tel || '', secteur: b.secteur || b.sector || client.secteur || '',
    zone: b.zone || b.ville || b.city || '', notes: b.notes || '', statut: 'nouveau',
    deal_value: null, lost_reason: '', meeting_at: null, custom: {}, campaign_id: null, meta_campaign_id: '',
    source: b.source || 'site', created_at: new Date().toISOString(), history: []
  };
  if (!lead.nom && !lead.email && !lead.telephone) return res.status(400).json({ error: 'lead vide' });
  data.leads.unshift(lead);
  writeClientLeads(data);
  if (client.email_enabled !== false) sendEmail(client.email, `Nouveau lead — ${lead.nom || lead.email}`, `Secteur : ${lead.secteur}\nZone : ${lead.zone}\nTéléphone : ${lead.telephone}\n\nConnectez-vous à votre espace pour le traiter.`);
  if (client.sms_enabled === true) sendSMS(client.telephone, `Nouveau lead: ${lead.nom || lead.email} - ${lead.telephone}`);
  res.json({ ok: true, id: lead.id });
});

app.post('/api/client/login', (req, res) => {
  const { email, password } = req.body || {};
  const client = readClients().clients.find(c => c.email.toLowerCase() === (email || '').toLowerCase() && c.active !== false);
  if (!client || client.password_hash !== hash('pwd:' + password)) return res.status(401).json({ error: 'identifiants incorrects' });
  res.cookie('sevn_client_auth', clientToken(client.id), { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 2592000000 });
  res.json({ ok: true });
});
app.post('/api/client/logout', (req, res) => { res.clearCookie('sevn_client_auth'); res.json({ ok: true }); });

app.get('/api/client/me', requireClient, (req, res) => res.json({ nom: req.client.nom, email: req.client.email, secteur: req.client.secteur, custom_fields: req.client.custom_fields || [] }));
app.get('/api/client/leads', requireClient, (req, res) => res.json(readClientLeads().leads.filter(l => l.client_id === req.client.id)));
app.get('/api/client/stats', requireClient, (req, res) => res.json(computeStats(readClientLeads().leads.filter(l => l.client_id === req.client.id))));
app.get('/api/client/campaigns/stats', requireClient, (req, res) => {
  const camps = readCampaigns().campaigns.filter(c => c.client_id === req.client.id);
  const leads = readClientLeads().leads.filter(l => l.client_id === req.client.id);
  res.json(computeCampaignStats(camps, leads));
});
app.patch('/api/client/leads/:id', requireClient, (req, res) => {
  const data = readClientLeads();
  const lead = data.leads.find(l => l.id === req.params.id && l.client_id === req.client.id);
  if (!lead) return res.status(404).json({ error: 'introuvable' });
  const wasGagne = lead.statut === 'gagne';
  applyPatch(lead, req.body, ['notes', 'statut', 'custom', 'deal_value', 'lost_reason']);
  if (!wasGagne && lead.statut === 'gagne') lead.won_at = new Date().toISOString();
  writeClientLeads(data);
  res.json({ ok: true, lead });
});

/* ============================================================
   4) WEBHOOK CALENDLY — heure de RDV fiable (horodatage universel)
   URL à mettre dans Calendly : https://[ton-crm]/api/webhooks/calendly?client=CLIENT_ID
   (client=... optionnel : sans lui, le RDV est rattaché à tes PROSPECTS à toi)
   ============================================================ */
app.post('/api/webhooks/calendly', (req, res) => {
  if (CALENDLY_WEBHOOK_SECRET) {
    const sig = req.headers['calendly-webhook-signature'];
    if (!sig) return res.status(401).json({ error: 'signature manquante' });
    // Vérification simplifiée : à renforcer avec la doc Calendly si besoin de sécurité stricte
  }
  const event = req.body && req.body.event;
  const payload = (req.body && req.body.payload) || {};
  if (event !== 'invitee.created') return res.json({ ok: true, ignored: true });

  const invitee = payload.email ? payload : (payload.invitee || {});
  const scheduledEvent = payload.scheduled_event || {};
  const meetingAt = scheduledEvent.start_time || null; // ISO8601 avec offset — fourni par Calendly, jamais recalculé ici
  const nom = invitee.name || '';
  const email = invitee.email || '';

  const clientId = req.query.client;
  if (clientId) {
    const client = readClients().clients.find(c => c.id === clientId);
    if (!client) return res.status(404).json({ error: 'client introuvable' });
    const data = readClientLeads();
    let lead = data.leads.find(l => l.client_id === clientId && l.email && email && l.email.toLowerCase() === email.toLowerCase());
    if (!lead) {
      lead = { id: crypto.randomUUID(), client_id: clientId, nom, email, telephone: '', secteur: client.secteur || '', zone: '', notes: '', deal_value: null, lost_reason: '', custom: {}, campaign_id: null, meta_campaign_id: '', source: 'calendly', created_at: new Date().toISOString(), history: [] };
      data.leads.unshift(lead);
    }
    lead.meeting_at = meetingAt;
    lead.statut = 'rdv_pris';
    writeClientLeads(data);
  } else {
    const data = readProspects();
    let lead = data.leads.find(l => l.email && email && l.email.toLowerCase() === email.toLowerCase());
    if (!lead) {
      lead = { id: crypto.randomUUID(), nom, email, telephone: '', secteur: '', zone: '', notes: '', deal_value: null, lost_reason: '', custom: {}, source: 'calendly', created_at: new Date().toISOString(), history: [] };
      data.leads.unshift(lead);
    }
    lead.meeting_at = meetingAt;
    lead.statut = 'rdv_pris';
    writeProspects(data);
  }
  res.json({ ok: true });
});

/* ============================================================
   5) WEBHOOK META LEAD ADS — ingestion auto + attribution campagne
   URL à mettre dans Meta for Developers (Webhooks > Page > leadgen) :
   https://[ton-crm]/api/webhooks/meta
   Vérification Meta (GET) : renvoie hub.challenge si le token correspond à META_VERIFY_TOKEN
   ============================================================ */
app.get('/api/webhooks/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) return res.status(200).send(challenge);
  res.sendStatus(403);
});

function extractMetaField(fieldData, keys) {
  if (!Array.isArray(fieldData)) return '';
  for (const key of keys) {
    const f = fieldData.find(x => (x.name || '').toLowerCase().replace(/[^a-z]/g, '') === key);
    if (f && Array.isArray(f.values) && f.values.length) return f.values[0];
  }
  return '';
}

app.post('/api/webhooks/meta', async (req, res) => {
  // Meta attend un 200 rapide — on répond tout de suite, le traitement continue derrière
  res.sendStatus(200);
  try {
    const entries = (req.body && req.body.entry) || [];
    for (const entry of entries) {
      const pageId = entry.id;
      const client = readClients().clients.find(c => c.meta_page_id === pageId && c.active !== false);
      if (!client || !client.meta_page_token) continue; // page pas reliée à un client actif
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'leadgen') continue;
        const value = change.value || {};
        const leadgenId = value.leadgen_id;
        if (!leadgenId) continue;
        try {
          const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${leadgenId}?access_token=${encodeURIComponent(client.meta_page_token)}`;
          const r = await fetch(url);
          if (!r.ok) { console.error('Graph API erreur', r.status, await r.text()); continue; }
          const lead = await r.json();
          const fd = lead.field_data || [];
          const nom = extractMetaField(fd, ['fullname', 'name', 'nom']);
          const email = extractMetaField(fd, ['email']);
          const telephone = extractMetaField(fd, ['phonenumber', 'phone', 'telephone']);
          const zone = extractMetaField(fd, ['city', 'ville']);

          const metaCampaignId = value.campaign_id || lead.campaign_id || '';
          const campaignsData = readCampaigns();
          const matched = campaignsData.campaigns.find(c => c.client_id === client.id && c.meta_campaign_id && c.meta_campaign_id === metaCampaignId);

          const data = readClientLeads();
          const newLead = {
            id: crypto.randomUUID(), client_id: client.id, nom, email, telephone,
            secteur: client.secteur || '', zone, notes: '', statut: 'nouveau',
            deal_value: null, lost_reason: '', meeting_at: null, custom: {},
            campaign_id: matched ? matched.id : null, meta_campaign_id: metaCampaignId,
            source: 'meta', created_at: new Date().toISOString(), history: []
          };
          data.leads.unshift(newLead);
          writeClientLeads(data);
          if (client.email_enabled !== false) sendEmail(client.email, `Nouveau lead Meta — ${nom || email}`, `Secteur : ${newLead.secteur}\nZone : ${zone}\nTéléphone : ${telephone}\n\nConnectez-vous à votre espace pour le traiter.`);
          if (client.sms_enabled === true) sendSMS(client.telephone, `Nouveau lead Meta: ${nom || email} - ${telephone}`);
        } catch (e) { console.error('Erreur traitement lead Meta', e.message); }
      }
    }
  } catch (e) { console.error('Erreur webhook Meta', e.message); }
});

/* ============================================================
   PAGES
   ============================================================ */
app.get('/favicon.svg', (req, res) => res.sendFile(path.join(__dirname, 'favicon.svg')));
app.get('/logo-clair.svg', (req, res) => res.sendFile(path.join(__dirname, 'logo-clair.svg')));

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/dashboard', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/clients', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'clients.html')));
app.get('/clients/:id', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'client-view.html')));

app.get('/client/login', (req, res) => res.sendFile(path.join(__dirname, 'client-login.html')));
app.get('/client/dashboard', requireClient, (req, res) => res.sendFile(path.join(__dirname, 'client-dashboard.html')));

app.listen(PORT, () => console.log('Sevn CRM v3 en ligne sur le port ' + PORT));
