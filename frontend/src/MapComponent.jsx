import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix pour les icônes Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Icônes colorées selon statut
const makeIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const iconVert   = makeIcon('green');  // En mouvement
const iconRouge  = makeIcon('red');    // À l'arrêt
const iconOr     = makeIcon('gold');   // Sélectionné + en mouvement
const iconViolet = makeIcon('violet'); // Sélectionné + à l'arrêt

/**
 * Composant interne qui gère :
 * 1. fitBounds au démarrage pour voir tous les véhicules
 * 2. setView centré sur le véhicule sélectionné au clic
 */
const MapController = ({ markers, selectedId, selectedLat, selectedLng }) => {
  const map = useMap();
  const hasFitted = useRef(false);

  // fitBounds une seule fois au chargement initial
  useEffect(() => {
    if (!hasFitted.current && markers.length > 0) {
      const bounds = L.latLngBounds(markers.map(([, pos]) => [pos.lat, pos.lng]));
      map.fitBounds(bounds, { padding: [40, 40], animate: true });
      hasFitted.current = true;
    }
  }, [markers, map]);

  // Recentrage animé sur le véhicule sélectionné
  useEffect(() => {
    if (selectedId && selectedLat && selectedLng && !isNaN(selectedLat) && !isNaN(selectedLng)) {
      map.setView([selectedLat, selectedLng], 15, { animate: true });
    }
  }, [selectedId, selectedLat, selectedLng, map]);

  return null;
};

/**
 * Props :
 *  - allPositions : { [vehiculeId]: { lat, lng, nom, vitesse, allumage } }
 *  - selectedId   : id du véhicule sélectionné (ou null)
 *  - selectedPos  : { latitude, longitude, points, ... }
 *  - mode         : 'live' | 'history'
 */
const MapComponent = ({ allPositions, selectedId, selectedPos, mode }) => {

  const defaultCenter = [48.8566, 2.3522];

  const centerLat = selectedPos?.latitude || allPositions[selectedId]?.lat;
  const centerLng = selectedPos?.longitude || allPositions[selectedId]?.lng;

  // Tracé historique
  const path = selectedPos?.points
    ? selectedPos.points.map(p => [p.latitude, p.longitude])
    : [];

  // Marqueurs valides uniquement
  const markers = Object.entries(allPositions).filter(([, pos]) =>
    pos && !isNaN(pos.lat) && !isNaN(pos.lng)
  );

  return (
    <MapContainer center={defaultCenter} zoom={6} style={{ height: "100%", width: "100%" }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

      <MapController
        markers={markers}
        selectedId={selectedId}
        selectedLat={centerLat}
        selectedLng={centerLng}
      />

      {/* Marqueurs de tous les véhicules */}
      {markers.map(([id, pos]) => {
        const isSelected = parseInt(id) === selectedId;
        const enMouvement = pos.vitesse > 0;

        // Couleur : or = sélectionné+mouvement, violet = sélectionné+arrêt, vert = mouvement, rouge = arrêt
        let icon;
        if (isSelected && enMouvement) icon = iconOr;
        else if (isSelected && !enMouvement) icon = iconViolet;
        else if (enMouvement) icon = iconVert;
        else icon = iconRouge;

        return (
          <Marker key={id} position={[pos.lat, pos.lng]} icon={icon}>
            <Popup>
              <strong>{pos.nom}</strong><br />
              Vitesse : {pos.vitesse} km/h<br />
              Moteur : {pos.allumage ? '🟢 ON' : '🔴 OFF'}<br />
              <small>Lat: {pos.lat?.toFixed(5)} | Lng: {pos.lng?.toFixed(5)}</small>
            </Popup>
          </Marker>
        );
      })}

      {/* Tracé historique */}
      {mode === 'history' && path.length > 1 && (
        <Polyline
          positions={path}
          pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.8 }}
        />
      )}
    </MapContainer>
  );
};

export default MapComponent;
