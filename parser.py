import struct
import datetime

class TeltonikaParser:
    """
    Parser Universel (Supporte Codec 8 et Codec 13).
    """

    @staticmethod
    def decode(payload: bytes):
        positions = []
        cursor = 0

        # --- 1. LECTURE DE L'EN-TÊTE (HEADER) ---
        
        # Sauter les 4 zéros (Préambule)
        if len(payload) > 4 and payload[0:4] == b'\x00\x00\x00\x00':
            cursor += 4

        # Sauter la taille des données (4 octets)
        cursor += 4

        # Lire le CODEC ID (C'est ici qu'on décide de la route à prendre)
        codec_id = payload[cursor]
        cursor += 1

        # Lire le nombre d'enregistrements
        number_of_records = payload[cursor]
        cursor += 1

        print(f"🕵️  Parser détecte : CODEC {codec_id} ({number_of_records} enregistrements)")

        # --- 2. AIGUILLAGE SELON LE CODEC ---
        
        if codec_id == 8:
            # C'est du GPS standard (Ton ancien code)
            return TeltonikaParser.decode_codec_8(payload, cursor, number_of_records)
            
        elif codec_id == 13:
            # C'est du transfert de données brutes (Tachygraphe / Commandes)
            return TeltonikaParser.decode_codec_13(payload, cursor, number_of_records)
            
        else:
            print(f"❌ Codec {codec_id} non supporté par ce parser.")
            return []

    # ==========================================
    # LOGIQUE POUR LE CODEC 8 (GPS STANDARD)
    # ==========================================
    @staticmethod
    def decode_codec_8(payload, cursor, number_of_records):
        positions = []
        
        for i in range(number_of_records):
            current_pos = {'type': 'gps'} # On marque le type

            # 1. Timestamp (8 octets)
            timestamp_ms = struct.unpack('>Q', payload[cursor:cursor+8])[0]
            cursor += 8
            current_pos['timestamp'] = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0)

            # 2. Priorité (1 octet)
            cursor += 1

            # 3. GPS (4 octets chacun)
            lon_raw = struct.unpack('>i', payload[cursor:cursor+4])[0]
            cursor += 4
            lat_raw = struct.unpack('>i', payload[cursor:cursor+4])[0]
            cursor += 4
            current_pos['longitude'] = lon_raw / 10000000.0
            current_pos['latitude'] = lat_raw / 10000000.0

            # 4. Physique (Altitude, Angle, Satellites, Vitesse)
            current_pos['altitude'] = struct.unpack('>h', payload[cursor:cursor+2])[0]
            cursor += 2
            current_pos['angle'] = struct.unpack('>H', payload[cursor:cursor+2])[0]
            cursor += 2
            current_pos['satellites'] = payload[cursor]
            cursor += 1
            current_pos['speed'] = struct.unpack('>H', payload[cursor:cursor+2])[0]
            cursor += 2

            # 5. IO (Capteurs)
            event_io_id = payload[cursor]
            cursor += 1
            total_io_count = payload[cursor]
            cursor += 1

            def read_io(byte_size):
                nonlocal cursor
                count = payload[cursor]
                cursor += 1
                for _ in range(count):
                    io_id = payload[cursor]
                    cursor += 1
                    io_val = payload[cursor:cursor+byte_size]
                    cursor += byte_size
                    # Logique simple pour l'ignition (ID 239)
                    if io_id == 239:
                        current_pos['ignition'] = bool(io_val[0])

            read_io(1)
            read_io(2)
            read_io(4)
            read_io(8)

            positions.append(current_pos)
        
        return positions

    # ==========================================
    # LOGIQUE POUR LE CODEC 13 (DATA / TACHYGRAPHE)
    # ==========================================
    @staticmethod
    def decode_codec_13(payload, cursor, number_of_records):
        """
        Le Codec 13 est plus simple en structure mais contient des données "brutes".
        Structure : Timestamp (8) + Taille du message (4) + Message (X octets)
        """
        records = []

        for i in range(number_of_records):
            record = {'type': 'data_raw'} # Ce n'est pas du GPS

            # 1. Timestamp (8 octets) - Toujours présent
            timestamp_ms = struct.unpack('>Q', payload[cursor:cursor+8])[0]
            cursor += 8
            record['timestamp'] = datetime.datetime.fromtimestamp(timestamp_ms / 1000.0)

            # 2. Taille de la donnée brute (4 octets - Int)
            # C'est la longueur du message qui suit
            data_size = struct.unpack('>I', payload[cursor:cursor+4])[0]
            cursor += 4

            # 3. La donnée brute (Raw Payload)
            # On lit 'data_size' octets
            raw_data = payload[cursor:cursor+data_size]
            cursor += data_size

            # On essaie de le décoder en texte si possible, sinon on garde l'hexadécimal
            try:
                # Souvent Codec 13 transporte du texte (commandes)
                record['message_text'] = raw_data.decode('ascii')
            except:
                # Sinon c'est du binaire pur (Tachygraphe)
                record['message_hex'] = raw_data.hex()
            
            # Note : Pas de Lat/Lon ici, donc on met None ou 0
            record['latitude'] = None
            record['longitude'] = None
            record['speed'] = 0

            records.append(record)

        return records