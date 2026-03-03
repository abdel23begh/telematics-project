import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export default function MapComponent({ selectedVehicle, mode = "DIRECT" }) {
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const polylineRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!selectedVehicle) return;

    // Nettoyage ancienne map
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const lat = selectedVehicle.lat ?? 48.8566;
    const lng = selectedVehicle.lng ?? 2.3522;

    const map = L.map("map-container").setView([lat, lng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);

    mapRef.current = map;
    markerRef.current = marker;

    if (mode === "DIRECT") {
      intervalRef.current = setInterval(() => {
        const current = markerRef.current.getLatLng();
        const newLat = current.lat + 0.0004;
        const newLng = current.lng + 0.0004;

        markerRef.current.setLatLng([newLat, newLng]);
        mapRef.current.panTo([newLat, newLng]);
      }, 3000);
    }

    if (mode === "HISTORIQUE") {
      const coords = [
        [48.8566, 2.3522],
        [48.8572, 2.3530],
        [48.8582, 2.3542],
      ];

      const polyline = L.polyline(coords).addTo(map);
      polylineRef.current = polyline;
      map.fitBounds(polyline.getBounds());
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [selectedVehicle, mode]);

  return (
    <div
      id="map-container"
      style={{ width: "100%", height: "100%", minHeight: 420 }}
    />
  );
}