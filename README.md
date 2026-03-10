# 🚚 Serveur d'Ingestion Télématique (Teltonika) - Équipe 1

![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16.0+-blue.svg)
![Protocol](https://img.shields.io/badge/Protocol-TCP%20%2F%20Codec%208-success.svg)

Ce projet constitue le **Middleware d'ingestion** de notre système de gestion de flotte GPS. 
Il écoute en temps réel les trames TCP envoyées par des boîtiers GPS matériels (modèles Teltonika), décode leurs trames binaires (Codec 8 / Codec 13), et sauvegarde l'historique de positionnement dans une base de données relationnelle PostgreSQL pour être exploité par l'API Frontend (Équipe 2).

## ✨ Fonctionnalités & Architecture "Production-Ready"

Nous avons conçu ce serveur pour qu'il soit robuste, sécurisé et capable d'encaisser une forte charge réseau :

* **🌐 Gestion stricte du protocole TCP :** Implémentation d'une lecture exacte des paquets (`lire_exactement`) basée sur les en-têtes Teltonika pour éviter les crashs liés à la **fragmentation TCP** (paquets coupés à cause d'un réseau instable).
* **⚡ Multithreading :** Chaque connexion entrante d'un véhicule est gérée par un Thread dédié, permettant d'ingérer les données de dizaines de camions simultanément sans bloquer le serveur principal.
* **🗄️ Connection Pooling :** Utilisation de `ThreadedConnectionPool` pour la base de données. Au lieu d'ouvrir une lourde connexion par requête, les threads empruntent un "tuyau" dans un réservoir de connexions pré-établies, évitant la saturation de PostgreSQL.
* **🔒 Sécurité (Fail-Safe) :** Aucune donnée sensible (mot de passe) n'est codée en dur. Le code exige la présence de variables d'environnement et empêche les injections SQL via des requêtes préparées (`%s`).

## 📂 Structure du projet

* `server.py` : Le point d'entrée TCP. Gère le réseau, les sockets, le Handshake et le Multithreading.
* `parser.py` : Le moteur de décodage. Convertit les trames binaires (Big-Endian) en données lisibles (Lat, Lon, Vitesse, IO).
* `database.py` : Le gestionnaire de données (ORM natif). Gère le Pool de connexions et les insertions SQL sécurisées.

## 🚀 Installation et Démarrage

### 1. Prérequis
* Python 3.x
* Un serveur PostgreSQL actif
* La librairie `psycopg2` :
  ```bash
  pip install psycopg2-binary
