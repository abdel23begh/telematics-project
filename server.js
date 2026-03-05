const express = require('express');
const cors = require('cors'); 
const { Pool } = require('pg'); // <-- On utilise 'pg' pour PostgreSQL 
const app = express(); 
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- 1. CONFIGURATION DB (POSTGRESQL) ---
const pool = new Pool({
    user: 'postgres',      // Info de l'image
    host: 'localhost',     // Info de l'image
    database: 'telematics', // Info de l'image
    password: '1234',      // Info de l'image
    port: 5432,            // Info de l'image
});

// Test de connexion au démarrage
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Erreur de connexion DB', err.stack);
    }
    console.log(' Connecté à la base de données PostgreSQL !');
    release();
});
// --- 2. LES ROUTES API (Adaptées pour PostgreSQL) ---

// Route 1 : Dernière position (Avec Jointure)
app.get('/api/devices/:id/latest', (req, res) => {
    const id = req.params.id;

    const sql = `
        SELECT v.id, v.nom, p.latitude AS lat, p.longitude AS lng, p.vitesse AS speed, p.timestamp
        FROM Vehicules v
        JOIN Positions p ON v.derniere_position_id = p.id
        WHERE v.id = $1`;

    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Erreur Base de Données" });
        }
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Aucune donnée trouvée" });
        }
        res.json(result.rows[0]);
    });
});

// Route 2 : Historique
app.get('/api/devices/:id/history', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT latitude AS lat, longitude AS lng, vitesse AS speed, timestamp
        FROM Positions
        WHERE vehicule_id = $1
        ORDER BY timestamp DESC LIMIT 100`;

    pool.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows);
    });
});

// Route 3 : Événements (Alarmes)
app.get('/api/devices/:id/events', (req, res) => {
    const id = req.params.id;
    const sql = `
        SELECT type_alarme, valeur, statut, timestamp
        FROM Alarmes
        WHERE vehicule_id = $1
        ORDER BY timestamp DESC LIMIT 10`;

    pool.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(result.rows);
    });
});

// --- 3. DÉMARRAGE DU SERVEUR ---
app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
});