// Fleet display support
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

function isValidCoord(lat, lng) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function createTruckIcon(color = "#10b981", isSelected = false) {
  const size = isSelected ? 18 : 14;
  const border = isSelected ? 3 : 2;

  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;
        height:${size}px;
        border-radius:50%;
        background:${color};
        border:${border}px solid white;
        box-shadow:0 0 0 2px rgba(0,0,0,0.25);
      "></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapComponent({
  selectedVehicle,
  mode = "live",
  fleetVehicles = [],
}) {
  const mapRef = useRef(null);
  const selectedMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const fleetLayerRef = useRef(null);

  // Initialisation carte une seule fois
  useEffect(() => {
    if (mapRef.current) return;

    const map = L.map("map-container").setView([48.8566, 2.3522], 12);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    fleetLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (polylineRef.current) {
        polylineRef.current.remove();
        polylineRef.current = null;
      }

      if (selectedMarkerRef.current) {
        selectedMarkerRef.current.remove();
        selectedMarkerRef.current = null;
      }

      if (fleetLayerRef.current) {
        fleetLayerRef.current.clearLayers();
        fleetLayerRef.current.remove();
        fleetLayerRef.current = null;
      }

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Affichage de toute la flotte (mode live)
  useEffect(() => {
    const map = mapRef.current;
    const fleetLayer = fleetLayerRef.current;
    if (!map || !fleetLayer) return;

    fleetLayer.clearLayers();

    if (mode !== "live") return;
    if (!Array.isArray(fleetVehicles) || fleetVehicles.length === 0) return;

    const bounds = [];

    fleetVehicles.forEach((vehicle) => {
      const lat = vehicle.latitude;
      const lng = vehicle.longitude;

      if (!isValidCoord(lat, lng)) return;

      const moving =
        vehicle.allumage === true ||
        vehicle.allumage === "t" ||
        vehicle.allumage === 1 ||
        vehicle.allumage === "on" ||
        Number(vehicle.vitesse || 0) > 0;

      const isSelected = selectedVehicle?.id === vehicle.id;

      const marker = L.marker([lat, lng], {
        icon: createTruckIcon(moving ? "#22c55e" : "#ef4444", isSelected),
      });

      marker.bindPopup(`
        <div style="min-width:160px">
          <strong>${vehicle.nom || "Véhicule"}</strong><br/>
          IMEI: ${vehicle.imei || "-"}<br/>
          Vitesse: ${vehicle.vitesse || 0} km/h<br/>
          État: ${moving ? "En mouvement" : "À l'arrêt / éteint"}
        </div>
      `);

      marker.addTo(fleetLayer);
      bounds.push([lat, lng]);
    });

    // Si aucun véhicule sélectionné, on cadre toute la flotte
    if (!selectedVehicle && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [fleetVehicles, mode, selectedVehicle]);

  // Mode live : focus sur le véhicule sélectionné
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (polylineRef.current && mode === "live") {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (mode !== "live") return;
    if (!selectedVehicle) return;

    const lat = selectedVehicle.lat;
    const lng = selectedVehicle.lng;

    if (!isValidCoord(lat, lng)) return;

    const moving =
      selectedVehicle.allumage === true ||
      selectedVehicle.allumage === "t" ||
      selectedVehicle.allumage === 1 ||
      selectedVehicle.allumage === "on" ||
      Number(selectedVehicle.vitesse || 0) > 0;

    selectedMarkerRef.current = L.marker([lat, lng], {
      icon: createTruckIcon(moving ? "#22c55e" : "#ef4444", true),
    }).addTo(map);

    map.setView([lat, lng], map.getZoom(), { animate: true });
  }, [selectedVehicle, mode]);

  // Mode historique : trajet du véhicule sélectionné
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    if (mode !== "history") return;
    if (!selectedVehicle) return;

    const points = Array.isArray(selectedVehicle.points)
      ? selectedVehicle.points.filter((p) =>
          isValidCoord(p.latitude, p.longitude)
        )
      : [];

    if (points.length === 0) {
      const lat = selectedVehicle.lat;
      const lng = selectedVehicle.lng;

      if (isValidCoord(lat, lng)) {
        selectedMarkerRef.current = L.marker([lat, lng], {
          icon: createTruckIcon("#ef4444", true),
        }).addTo(map);

        map.setView([lat, lng], 13);
      }
      return;
    }

    const latLngs = points.map((p) => [p.latitude, p.longitude]);

    polylineRef.current = L.polyline(latLngs, {
      color: "#3b82f6",
      weight: 4,
    }).addTo(map);

    const lastPoint = points[points.length - 1];

    selectedMarkerRef.current = L.marker(
      [lastPoint.latitude, lastPoint.longitude],
      {
        icon: createTruckIcon("#3b82f6", true),
      }
    ).addTo(map);

    map.fitBounds(polylineRef.current.getBounds(), {
      padding: [20, 20],
    });
  }, [selectedVehicle, mode]);

  return (
    <div
      id="map-container"
      style={{ width: "100%", height: "100%", minHeight: 420 }}
    />
  );
}

