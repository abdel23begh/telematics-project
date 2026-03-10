import os
import psycopg2
from psycopg2.pool import ThreadedConnectionPool

class DatabaseManager:
    """
    Gestionnaire de base de données PostgreSQL orienté production.
    Implémente un ThreadedConnectionPool pour supporter le multithreading du serveur TCP.
    """

    def __init__(self):
        # 🔒 SÉCURITÉ MAXIMALE : Lecture STRICTE depuis l'environnement.
        # Aucune valeur par défaut n'est écrite en dur pour le mot de passe.
        # Le fichier .env est obligatoire pour faire tourner ce code.
        self.host = os.getenv("DB_HOST", "localhost")
        self.database = os.getenv("DB_NAME", "telematics")
        self.user = os.getenv("DB_USER", "postgres")
        self.port = os.getenv("DB_PORT", "5432")
        
        # Récupération du mot de passe sans aucune valeur de secours
        self.password = os.getenv("DB_PASSWORD") 
        
        # Vérification de sécurité au démarrage
        if not self.password:
            raise ValueError("🚨 ERREUR CRITIQUE : Le mot de passe de la base de données (DB_PASSWORD) est manquant. Vérifiez votre fichier .env !")

        self.pool = None # Le réservoir de connexions

    def connect(self):
        """Initialise le pool de connexions et crée le schéma de la DB si nécessaire."""
        try:
            # 🚀 PERFORMANCE : Création d'un pool de connexions (min 1, max 20 connexions simultanées).
            # Évite d'ouvrir et fermer une connexion TCP lourde à chaque requête SQL.
            self.pool = ThreadedConnectionPool(
                1, 20,
                host=self.host, database=self.database,
                user=self.user, password=self.password, port=self.port
            )
            
            # Utilisation d'une connexion temporaire pour initialiser les tables
            conn = self.pool.getconn()
            conn.autocommit = True
            self.create_tables(conn)
            self.pool.putconn(conn) # On rend la connexion au pool
            
            print(f"🗄️  Connecté à PostgreSQL (Pool Multi-thread activé) : {self.database}")
        except Exception as e:
            print(f"❌ ERREUR FATALE DB : {e}")

    def create_tables(self, conn):
        """Crée les tables relationnelles requises par le Backend (Team 2)."""
        with conn.cursor() as cursor:
            # Table des véhicules (Entité parent)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS vehicules (
                id SERIAL PRIMARY KEY,
                imei VARCHAR(50) UNIQUE NOT NULL,
                nom VARCHAR(100),
                is_online BOOLEAN DEFAULT FALSE,
                derniere_position_id BIGINT
            );
            """)
            
            # Table des positions GPS (Entité enfant, liée par vehicule_id)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                id SERIAL PRIMARY KEY,
                vehicule_id INTEGER REFERENCES vehicules(id),
                latitude DOUBLE PRECISION,
                longitude DOUBLE PRECISION,
                vitesse REAL,
                angle INTEGER,
                allumage BOOLEAN,
                timestamp TIMESTAMP
            );
            """)

    def check_imei_allowed(self, imei):
        """Vérifie si le véhicule est autorisé à se connecter (Liste blanche)."""
        return True # Ouvert à tous pour le moment

    def get_or_create_vehicle(self, imei, conn):
        """
        Cherche l'ID d'un véhicule via son IMEI. 
        S'il n'existe pas, l'insère automatiquement pour garantir l'intégrité référentielle.
        """
        with conn.cursor() as cursor:
            # Requête préparée (%s) pour éviter les Injections SQL
            cursor.execute("SELECT id FROM vehicules WHERE imei = %s", (imei,))
            result = cursor.fetchone()
            
            if result:
                return result[0] # Retourne la clé primaire existante
            else:
                # Création dynamique d'un nouveau véhicule
                nom_par_defaut = f"Camion {imei[-4:]}"
                cursor.execute("""
                    INSERT INTO vehicules (imei, nom, is_online)
                    VALUES (%s, %s, TRUE) RETURNING id
                """, (imei, nom_par_defaut))
                return cursor.fetchone()[0]

    def save_position(self, data):
        """
        Insère une position GPS dans la base de données.
        Conçue pour être Thread-Safe grâce à l'emprunt d'une connexion dans le Pool.
        """
        # On emprunte un "tuyau" au réservoir
        conn = self.pool.getconn()
        try:
            conn.autocommit = True
            vehicule_id = self.get_or_create_vehicle(data['imei'], conn)
            
            # Sécurité si le capteur n'a pas envoyé d'information d'allumage
            ignition_val = data.get('ignition', False) 
            
            with conn.cursor() as cursor:
                # 1. Insérer la position historique
                cursor.execute("""
                INSERT INTO positions (vehicule_id, timestamp, latitude, longitude, vitesse, angle, allumage)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
                """, (vehicule_id, data['timestamp'], data['latitude'], data['longitude'], data['speed'], data['angle'], ignition_val))
                
                pos_id = cursor.fetchone()[0]

                # 2. Mettre à jour le statut en temps réel du véhicule (Pour le Dashboard Team 2)
                cursor.execute("""
                UPDATE vehicules SET is_online = TRUE, derniere_position_id = %s WHERE id = %s
                """, (pos_id, vehicule_id))
                
        except Exception as e:
            print(f"⚠️ Erreur de sauvegarde SQL : {e}")
        finally:
            # 🛑 TRÈS IMPORTANT : On doit TOUJOURS rendre la connexion au pool,
            # même si une erreur a fait planter le code au-dessus !
            self.pool.putconn(conn)