import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const MetricsCharts = ({ lastPos, allPositions, selectedId }) => {
  const [data, setData] = useState([]);

  // Calcul de la distance entre deux points GPS
  const distanceBetween = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if (!selectedId || !allPositions[selectedId]) return;

    const interval = setInterval(() => {
      const pos = allPositions[selectedId];
      const timestamp = new Date().toLocaleTimeString();

      // distance par rapport au point initial
      let distance = 0;
      if (data.length > 0) {
        const prev = data[data.length - 1];
        distance = prev.distance + distanceBetween(prev.lat, prev.lng, pos.lat, pos.lng);
      }

      const newEntry = {
        time: timestamp,
        vitesse: pos.vitesse,
        distance,
      };

      setData(prev => [...prev.slice(-19), newEntry]); // on garde les 20 derniers points
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedId, allPositions]);

  if (!selectedId) return <p style={{fontSize:'12px', color:'#64748b'}}>Sélectionnez un véhicule pour voir les graphiques</p>;

  return (
    <LineChart width={350} height={200} data={data}>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="time" />
      <YAxis />
      <Tooltip />
      <Legend />
      <Line type="monotone" dataKey="vitesse" stroke="#8884d8" />
      <Line type="monotone" dataKey="distance" stroke="#82ca9d" />
    </LineChart>
  );
};

export default MetricsCharts;
