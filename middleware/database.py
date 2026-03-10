import psycopg2
from psycopg2 import sql

class DatabaseManager:
    """
    Gestionnaire de base de données aligné sur l'architecture de la Team 2 (PDF).
    Gère les tables 'Vehicules' et 'Positions'.
    """

    def __init__(self):
        # --- ⚠️ TES IDENTIFIANTS POSTGRESQL ICI ⚠️ ---
        self.host = "localhost"
        self.database = "telematics"
        self.user = "postgres"
        self.password = "1234"
        self.port = "5432"
        self.connection = None

    def connect(self):
        try:
            self.connection = psycopg2.connect(
                host=self.host,
                database=self.database,
                user=self.user,
                password=self.password,
                port=self.port
            )
            self.connection.autocommit = True
            self.create_tables() # On crée la structure demandée par la Team 2
            print(f"🗄️  Connecté à la DB Team 2 : {self.database}")
        except Exception as e:
            print(f"❌ ERREUR DB : {e}")

    def create_tables(self):
        """Crée les tables selon le PDF Architecture."""
        with self.connection.cursor() as cursor:
            # 1. Table VEHICULES (Source PDF Page 1)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS vehicules (
                id SERIAL PRIMARY KEY,
                imei VARCHAR(50) UNIQUE NOT NULL,
                nom VARCHAR(100),
                is_online BOOLEAN DEFAULT FALSE,
                derniere_position_id BIGINT
            );
            """)
            
            # 2. Table POSITIONS (Source PDF Page 1)
            # Note : On change 'speed' en 'vitesse' et 'ignition' en 'allumage' pour coller au PDF
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
            
            # 3. Table ALARMES (Optionnel pour l'instant, mais prêt pour le futur)
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS alarmes (
                id SERIAL PRIMARY KEY,
                vehicule_id INTEGER REFERENCES vehicules(id),
                type_alarme_id INTEGER,
                statut VARCHAR(50),
                timestamp_debut TIMESTAMP
            );
            """)

    def check_imei_allowed(self, imei):
        return True

    def get_or_create_vehicle(self, imei):
        """
        Cherche l'ID du véhicule grâce à son IMEI.
        S'il n'existe pas, on le crée (pour qu'il apparaisse sur le Dashboard).
        """
        with self.connection.cursor() as cursor:
            # On cherche si le camion existe déjà
            cursor.execute("SELECT id FROM vehicules WHERE imei = %s", (imei,))
            result = cursor.fetchone()
            
            if result:
                return result[0] # On retourne l'ID existant (ex: 1)
            else:
                # Il n'existe pas, on le crée !
                print(f"🆕 Nouveau véhicule détecté : {imei}. Création en base...")
                nom_par_defaut = f"Camion {imei[-4:]}" # Ex: "Camion 2330"
                cursor.execute("""
                    INSERT INTO vehicules (imei, nom, is_online)
                    VALUES (%s, %s, TRUE)
                    RETURNING id
                """, (imei, nom_par_defaut))
                new_id = cursor.fetchone()[0]
                return new_id

    def save_position(self, data):
        """
        Sauvegarde selon la logique relationnelle :
        1. Trouver l'ID du véhicule (Table Vehicules).
        2. Insérer la position (Table Positions).
        3. Mettre à jour le statut 'En ligne' du véhicule.
        """
        try:
            vehicule_id = self.get_or_create_vehicle(data['imei'])
            
            ignition_val = data.get('ignition', False)
            
            with self.connection.cursor() as cursor:
                # A. Insérer dans la table POSITIONS (Colonnes du PDF)
                query_pos = """
                INSERT INTO positions (vehicule_id, timestamp, latitude, longitude, vitesse, angle, allumage)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """
                values_pos = (
                    vehicule_id,
                    data['timestamp'],
                    data['latitude'],
                    data['longitude'],
                    data['speed'],   # Map vers 'vitesse'
                    data['angle'],
                    ignition_val     # Map vers 'allumage'
                )
                cursor.execute(query_pos, values_pos)
                pos_id = cursor.fetchone()[0]

                # B. Mettre à jour le véhicule (Dernière position + Online)
                # C'est ce qui permet d'afficher la pastille VERTE sur le dashboard
                query_update = """
                UPDATE vehicules 
                SET is_online = TRUE, derniere_position_id = %s
                WHERE id = %s
                """
                cursor.execute(query_update, (pos_id, vehicule_id))
                
            print(f"💾 [Relationnel] Position sauvée pour Camion ID {vehicule_id}")
            
        except Exception as e:
            print(f"⚠️ Erreur sauvegarde SQL : {e}")

    def close(self):
        if self.connection:
            self.connection.close()
