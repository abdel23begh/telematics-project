import socket
import threading
import struct

# --- IMPORTATIONS ---
from parser import TeltonikaParser   # Notre traducteur
from database import DatabaseManager # Notre archiviste

# --- CONFIGURATION ---
IP_ECOUTE = "0.0.0.0"
PORT = 5027

# Initialisation de la Base de Données (Une seule fois au démarrage)
db = DatabaseManager()
db.connect()

def gerer_camion(conn, addr):
    """Fonction exécutée en parallèle pour chaque camion."""
    print(f"[+] Nouveau client connecté : {addr}")
    imei = "Inconnu"

    try:
        with conn:
            # === ÉTAPE 1 : HANDSHAKE (Identification) ===
            
            # 1. Lire la taille de l'IMEI (2 octets)
            length_bytes = conn.recv(2)
            if not length_bytes: return
            imei_length = int.from_bytes(length_bytes, "big")
            
            # 2. Lire l'IMEI
            imei_data = conn.recv(imei_length)
            imei = imei_data.decode('ascii')
            
            # 3. Vérifier l'autorisation
            if not db.check_imei_allowed(imei):
                print(f"⛔ Connexion refusée pour IMEI: {imei}")
                return

            # 4. Accepter la connexion (Envoyer 0x01)
            conn.send(b'\x01')
            print(f"📡 Handshake OK pour IMEI : {imei}")

            # === ÉTAPE 2 : BOUCLE DE RÉCEPTION DES DONNÉES ===
            while True:
                # 1. Lire le Header du paquet (Type de données, taille...)
                # On lit 8 octets (4 zéros + 4 taille) pour savoir quoi attendre
                header = conn.recv(8)
                if not header: break # Connexion fermée par le camion

                # Astuce simple : On lit le reste du buffer (max 2048 octets pour l'instant)
                # Dans un vrai système industriel, on lirait la taille exacte indiquée dans le header.
                raw_data = conn.recv(2048)
                
                # On recolle le header et les données pour le parser
                full_packet = header + raw_data

                # === ÉTAPE 3 : DÉCODAGE ===
                try:
                    positions = TeltonikaParser.decode(full_packet)
                    print(f"✅ Reçu {len(positions)} positions de {imei}")
                except Exception as e:
                    print(f"❌ Erreur de parsing : {e}")
                    continue

                # === ÉTAPE 4 : SAUVEGARDE ===
                count_saved = 0
                for pos in positions:
                    pos['imei'] = imei # On ajoute l'IMEI qui manquait dans le paquet
                    db.save_position(pos)
                    count_saved += 1

                # === ÉTAPE 5 : CONFIRMATION (ACK) ===
                # On dit au camion : "J'ai bien reçu X positions"
                response = struct.pack('>I', count_saved)
                conn.send(response)

    except Exception as e:
        print(f"⚠️ Erreur avec {imei} : {e}")
    finally:
        print(f"[-] Déconnexion : {imei}")

# --- DÉMARRAGE DU SERVEUR ---
if __name__ == "__main__":
    print(f"--- 🚀 SERVEUR TELTONIKA DÉMARRÉ SUR LE PORT {PORT} ---")
    
    # Création de la socket principale
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((IP_ECOUTE, PORT))
        s.listen()
        
        while True:
            # Attente bloquante d'un nouveau camion
            conn, addr = s.accept()
            
            # Création d'un thread pour gérer ce camion sans bloquer les autres
            thread = threading.Thread(target=gerer_camion, args=(conn, addr))
            thread.start()
