import struct
import datetime

class TeltonikaParser:
    """
    Classe responsable de transformer les octets bruts (Binaire) 
    en informations lisibles (Dictionnaire Python).
    """

    @staticmethod
    def decode(payload: bytes):
        """
        Entrée : Un tableau d'octets (le paquet reçu).
        Sortie : Une liste de dictionnaires (les positions décodées).
        """
        positions = []
        cursor = 0 # Notre doigt qui pointe sur l'octet à lire

        # 1. Nettoyage du Préambule (4 zéros optionnels au début)
        # Certains boîtiers envoient 00000000, d'autres non. On s'adapte.
        if len(payload) > 4 and payload[0:4] == b'\x00\x00\x00\x00':
            cursor += 4

        # 2. Lecture de la Taille des Données (4 octets)
        # On lit mais on ne stocke pas, car on a déjà tout le paquet.
        cursor += 4 

        # 3. Lecture du Codec ID (1 octet)
        codec_id = payload[cursor]
        cursor += 1

        # 4. Lecture du Nombre de Records (Positions) (1 octet)
        number_of_records = payload[cursor]
        cursor += 1

        # --- BOUCLE : On traite chaque position une par une ---
        for i in range(number_of_records):
            current_pos = {}

            # A. Timestamp (8 octets) - Millisecondes depuis 1970
            timestamp_ms = struct.unpack('>Q', payload[cursor:cursor+8])[0]
            cursor += 8
            current_pos['timestamp'] = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0)

            # B. Priorité (1 octet)
            priority = payload[cursor]
            cursor += 1

            # C. GPS (Longitude, Latitude) - 4 octets chacun
            # NOTE : Teltonika multiplie par 10 000 000. On doit diviser.
            lon_raw = struct.unpack('>i', payload[cursor:cursor+4])[0]
            cursor += 4
            lat_raw = struct.unpack('>i', payload[cursor:cursor+4])[0]
            cursor += 4

            current_pos['longitude'] = lon_raw / 10000000.0
            current_pos['latitude'] = lat_raw / 10000000.0

            # D. Autres données GPS (Altitude, Angle, Satellites, Vitesse)
            current_pos['altitude'] = struct.unpack('>h', payload[cursor:cursor+2])[0]
            cursor += 2
            current_pos['angle'] = struct.unpack('>H', payload[cursor:cursor+2])[0]
            cursor += 2
            current_pos['satellites'] = payload[cursor]
            cursor += 1
            current_pos['speed'] = struct.unpack('>H', payload[cursor:cursor+2])[0]
            cursor += 2

            # E. Lecture des IO (Capteurs) - PARTIE COMPLEXE
            # On doit lire ces données pour avancer le curseur, même si on ne les utilise pas toutes.
            event_io_id = payload[cursor]
            cursor += 1
            total_io_count = payload[cursor]
            cursor += 1

            # Fonction interne pour sauter les IOs selon leur taille (1, 2, 4, 8 octets)
            def read_io(byte_size):
                nonlocal cursor # On modifie le curseur de la fonction parente
                count = payload[cursor]
                cursor += 1
                for _ in range(count):
                    io_id = payload[cursor]
                    cursor += 1
                    # On lit la valeur (juste pour avancer le curseur)
                    io_value_bytes = payload[cursor:cursor+byte_size]
                    cursor += byte_size
                    
                    # EXEMPLE : Si l'ID est 239 (Ignition/Contact), on le sauvegarde
                    if io_id == 239:
                        current_pos['ignition'] = bool(io_value_bytes[0])

            # On applique la lecture pour chaque taille
            read_io(1) # IOs de 1 octet
            read_io(2) # IOs de 2 octets
            read_io(4) # IOs de 4 octets
            read_io(8) # IOs de 8 octets

            # F. Ajout de la position terminée à la liste
            positions.append(current_pos)

        return positions
