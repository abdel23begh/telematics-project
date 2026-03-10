import socket
import threading
import struct

# Importation des modules locaux
from parser import TeltonikaParser
from database import DatabaseManager

# --- CONFIGURATION DU SERVEUR ---
# 0.0.0.0 permet d'écouter sur toutes les interfaces réseaux (Internet & Local)
IP_ECOUTE = "0.0.0.0"
PORT = 5027

# Initialisation unique du gestionnaire de base de données au démarrage
db = DatabaseManager()
db.connect()

def lire_exactement(conn, num_bytes):
    """
    Lit exactement le nombre d'octets demandé sur le socket TCP.
    
    Pourquoi cette fonction ? 
    Le protocole TCP est un flux (stream). Une simple commande recv() peut 
    renvoyer des paquets fragmentés (moitié de message) si le réseau est lent.
    Cette fonction garantit l'intégrité du paquet (ex: utile pour le Codec 8).
    """
    data = bytearray()
    while len(data) < num_bytes:
        packet = conn.recv(num_bytes - len(data))
        if not packet:
            # Si packet est vide, le client a fermé la connexion de son côté
            return None 
        data.extend(packet)
    return bytes(data)

def gerer_camion(conn, addr):
    """
    Fonction exécutée dans un Thread dédié pour chaque boîtier GPS connecté.
    Gère le cycle de vie complet : Handshake -> Réception -> Parsing -> Sauvegarde -> ACK.
    """
    print(f"[+] Nouvelle connexion entrante : {addr}")
    imei = "Inconnu"

    try:
        with conn:
            # ==========================================
            # ÉTAPE 1 : HANDSHAKE (Identification Teltonika)
            # ==========================================
            # Le boîtier envoie 2 octets indiquant la taille de l'IMEI
            length_bytes = lire_exactement(conn, 2)
            if not length_bytes: return
            imei_length = int.from_bytes(length_bytes, "big")
            
            # Lecture de l'IMEI exact en fonction de la taille reçue
            imei_data = lire_exactement(conn, imei_length)
            imei = imei_data.decode('ascii')
            
            # Vérification (Liste blanche/noire)
            if not db.check_imei_allowed(imei):
                print(f"⛔ Accès refusé pour l'IMEI : {imei}")
                return
            
            # Acquittement : On envoie 0x01 pour autoriser le boîtier à envoyer ses datas
            conn.send(b'\x01')
            print(f"📡 Handshake réussi pour l'IMEI : {imei}")

            # ==========================================
            # ÉTAPE 2 : BOUCLE DE RÉCEPTION DES DONNÉES
            # ==========================================
            while True:
                # 1. Lecture de l'en-tête (8 octets : 4 zéros + 4 pour la taille)
                header = lire_exactement(conn, 8)
                if not header: break 

                # 2. Extraction de la taille du payload (données utiles)
                data_length = int.from_bytes(header[4:8], "big")

                # 3. Lecture exacte du payload pour éviter les décalages binaires
                raw_data = lire_exactement(conn, data_length)
                if not raw_data: break
                
                # Reconstitution du paquet complet pour le parser
                full_packet = header + raw_data

                # ==========================================
                # ÉTAPE 3 : PARSING ET SAUVEGARDE
                # ==========================================
                try:
                    positions = TeltonikaParser.decode(full_packet)
                except Exception as e:
                    print(f"❌ Erreur de parsing (Paquet ignoré) : {e}")
                    continue # On ignore ce paquet mais on garde la connexion active

                count_saved = 0
                for pos in positions:
                    pos['imei'] = imei # Injection de l'IMEI dans le dictionnaire
                    db.save_position(pos)
                    count_saved += 1

                # ==========================================
                # ÉTAPE 4 : ACCUSÉ DE RÉCEPTION (ACK)
                # ==========================================
                # On informe le boîtier du nombre de positions sauvegardées
                # pour qu'il puisse purger sa mémoire flash interne.
                response = struct.pack('>I', count_saved)
                conn.send(response)

    except Exception as e:
        print(f"⚠️ Erreur inattendue avec {imei} : {e}")
    finally:
        print(f"[-] Déconnexion du boîtier : {imei}")


# --- POINT D'ENTRÉE DU SCRIPT ---
if __name__ == "__main__":
    print(f"--- 🚀 SERVEUR D'INGESTION DÉMARRÉ (PORT {PORT}) ---")
    
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        # SO_REUSEADDR permet de redémarrer le serveur instantanément sans erreur "Port in use"
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) 
        s.bind((IP_ECOUTE, PORT))
        s.listen()
        
        # Boucle d'acceptation principale (Multithreading)
        while True:
            # Attente bloquante d'une nouvelle connexion TCP
            conn, addr = s.accept()
            
            # Délégation de la connexion à un Thread pour ne pas bloquer les autres camions
            thread = threading.Thread(target=gerer_camion, args=(conn, addr))
            thread.start()