import React, { useState, useEffect } from 'react';
import MapComponent from "./MapComponent";

const App = () => {
  const [vehicules, setVehicules] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [lastPos, setLastPos] = useState(null);
  const [alarmes, setAlarmes] = useState([]);
  const [viewMode, setViewMode] = useState('live');
  const [error, setError] = useState(null);
  const [fleetPositions, setFleetPositions] = useState([]);//changer par Abdel 

  // ADRESSE DE LA VM
  const API_URL = "http://15.237.251.60:3000";

  // --- CHARGEMENT DE LA FLOTTE ---
  useEffect(() => {
    const chargerFlotte = async () => {
      try {
        const res = await fetch(`${API_URL}/api/devices`);
        if (!res.ok) throw new Error("Erreur de connexion à l'API");
        const data = await res.json();
        setVehicules(data);
      } catch (err) {
        console.error(" Erreur Flotte:", err.message);
        setError("Impossible de joindre le serveur de la VM");
      }
    };
    chargerFlotte();
  }, []);
  //changer par Abdel de
  const chargerTouteLaFlotte = async () => {
  try {
    if (!vehicules.length) return;

    const results = await Promise.all(
      vehicules.map(async (v) => {
        try {
          const res = await fetch(`${API_URL}/api/devices/${v.id}/latest`);
          if (!res.ok) return null;
          const data = await res.json();

          return {
            id: v.id,
            nom: v.nom,
            imei: v.imei,
            latitude: parseFloat(data.latitude || data.lat),
            longitude: parseFloat(data.longitude || data.lng),
            vitesse: parseFloat(data.vitesse || data.speed || 0),
            allumage:
              data.allumage === "t" ||
              data.allumage === true ||
              data.allumage === 1 ||
              data.allumage === "on" ||
              parseFloat(data.vitesse || data.speed || 0) > 0,
          };
        } catch {
          return null;
        }
      })
    ); 

    setFleetPositions(results.filter(Boolean));
  } catch (err) {
    console.error("Erreur flotte live:", err.message);
  }
};
useEffect(() => {
  if (!vehicules.length) return;

  chargerTouteLaFlotte();

  const intervalleFlotte = setInterval(() => {
    chargerTouteLaFlotte();
  }, 5000);

  return () => clearInterval(intervalleFlotte);
}, [vehicules]);// jusqu'a la

  // --- CHARGEMENT DES ALARMES ---
  const chargerAlarmes = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/devices/${id}/events`);
      if (res.ok) {
        const data = await res.json();
        setAlarmes(data);
      }
    } catch (err) { console.error(err); }
  };

  // --- CHARGEMENT DES DONNÉES GPS ---
  const chargerDonnees = async (id, mode) => {
    const endpoint = mode === 'live' ? 'latest' : 'history';
    try {
      const res = await fetch(`${API_URL}/api/devices/${id}/${endpoint}`);
      if (!res.ok) throw new Error("Erreur données");
      const data = await res.json();

      if (mode === 'live') {
        setLastPos({
          latitude: parseFloat(data.latitude || data.lat),
          longitude: parseFloat(data.longitude || data.lng),
          vitesse: data.vitesse || data.speed || 0,
          allumage: (data.allumage === 't' || data.allumage === true || data.allumage === 1 || data.allumage === "on") || (parseFloat(data.vitesse || data.speed) > 0),
          points: null
        });
      } else {
        const pointsFormates = data.map(p => ({
          latitude: parseFloat(p.lat || p.latitude),
          longitude: parseFloat(p.lng || p.longitude)
        }));
        setLastPos({ ...lastPos, points: pointsFormates });
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    let intervalle;
    if (selectedId && viewMode === 'live') {
      chargerDonnees(selectedId, 'live');
      chargerAlarmes(selectedId);
      intervalle = setInterval(() => {
        chargerDonnees(selectedId, 'live');
        chargerAlarmes(selectedId);
      }, 5000);
    }
    return () => clearInterval(intervalle);
  }, [selectedId, viewMode]);

  const selectedVehicle = vehicules.find(v => v.id === selectedId);

  return (
    <div style={styles.dashboard}>
      <header style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '24px' }}>🚀</span>
          <h1 style={styles.title}>TEAM 2 - TÉLÉMÉTRIE & FLOTTE</h1>
        </div>
        <div style={styles.serverStatus}><span style={styles.pulseDot}></span> VM ACTIVE : 15.237.251.60</div>
      </header>

      <div style={styles.mainContent}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarHeader}>
            <h2 style={styles.sidebarTitle}>🚛 Flotte ({vehicules.length})</h2>
          </div>
          <div style={styles.vehicleList}>
            {vehicules.map(v => (
              <div key={v.id} onClick={() => { setSelectedId(v.id); setViewMode('live'); }}
                style={{ ...styles.card, borderColor: selectedId === v.id ? '#3b82f6' : '#334155', backgroundColor: selectedId === v.id ? '#1e293b' : '#0f172a' }}>
                <div style={styles.cardHeader}>
                  <span style={styles.vName}>{v.nom}</span>
                  <span style={{ color: (selectedId === v.id && lastPos?.vitesse > 0) ? '#10b981' : '#64748b', fontSize: '12px', fontWeight: 'bold' }}>
                    {(selectedId === v.id && lastPos?.vitesse > 0) ? '▶ EN MOUVEMENT' : '■ ARRÊT'}
                  </span>
                </div>
                <p style={styles.vImei}>IMEI: {v.imei}</p>
              </div>
            ))}
          </div>

          <div style={styles.statsContainer}>
            <div style={styles.statsHeader}>
              <span style={{fontSize: '18px'}}>📊</span>
              <h3 style={styles.statsTitle}>Statistiques Globales</h3>
            </div>
            <div style={styles.statsPlaceholder}>
               <p style={{fontSize: '11px', color: '#64748b', margin: 0}}>Zone réservée Rôle 4 (Graphiques Recharts)</p>
            </div>
          </div>
        </aside>

        <main style={styles.content}>
          {selectedVehicle ? (
            <div style={styles.container}>
              <div style={styles.metricsGrid}>
                <div style={styles.metricCard}><p style={styles.metricLabel}>UNITÉ</p><p style={styles.metricValue}>{selectedVehicle.nom}</p></div>
                <div style={styles.metricCard}><p style={styles.metricLabel}>MOTEUR</p><p style={{...styles.metricValue, color: lastPos?.allumage ? '#10b981' : '#ef4444'}}>{lastPos?.allumage ? 'ON' : 'OFF'}</p></div>
                <div style={styles.metricCard}><p style={styles.metricLabel}>VITESSE</p><p style={styles.metricValue}>{lastPos?.vitesse || 0} km/h</p></div>
                <div style={styles.metricCard}><p style={styles.metricLabel}>GPS</p><p style={styles.metricSub}>Lat: {lastPos?.latitude?.toFixed(5)}</p><p style={styles.metricSub}>Lng: {lastPos?.longitude?.toFixed(5)}</p></div>
              </div>

              <div style={styles.workspace}>
                <div style={styles.gpsDisplay}>
                   {lastPos ? (
                     <>
                       <MapComponent selectedVehicle={{ lat: lastPos.latitude, lng: lastPos.longitude, points: lastPos.points }} mode={viewMode} />
                       <button onClick={() => { const m = viewMode === 'live' ? 'history' : 'live'; setViewMode(m); chargerDonnees(selectedId, m); }} style={styles.histBtn}>
                         {viewMode === 'live' ? "📊 Historique" : "📡 Direct"}
                       </button>
                     </>
                   ) : <div style={styles.loading}>Signal GPS...</div>}
                </div>

                <div style={styles.alarmsPanel}>
                  <h3 style={styles.alarmsTitle}>🚨 Alertes</h3>
                  <div style={styles.alarmsList}>
                    {alarmes.map((al, i) => (
                      <div key={i} style={styles.alarmeItem}>
                        <div style={{display:'flex', justifyContent:'space-between'}}>
                          <span style={{fontWeight:'bold', color: al.statut === 'ACTIVE' ? '#ef4444' : '#f59e0b', fontSize:'12px'}}>
                            ⚠️ {al.type_alarme === 1 ? 'Vitesse' : 'Alerte'}
                          </span>
                          <span style={{fontSize:'10px', color:'#94a3b8'}}>{new Date(al.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p style={{margin:0, fontSize:'11px', color:'#cbd5e1'}}>{al.statut}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={styles.empty}>
              {error ? <p style={{color: '#ef4444'}}>{error}</p> : "🌍 Sélectionnez un véhicule"}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const styles = {
  dashboard: { fontFamily: "'Inter', sans-serif", backgroundColor: '#0f172a', color: '#f8fafc', height: '100vh', display: 'flex', flexDirection: 'column' },
  header: { backgroundColor: '#1e293b', padding: '15px 25px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '18px' },
  serverStatus: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#10b981', backgroundColor: '#064e3b', padding: '6px 12px', borderRadius: '20px' },
  pulseDot: { width: '8px', height: '8px', backgroundColor: '#34d399', borderRadius: '50%' },
  mainContent: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: { width: '320px', backgroundColor: '#1e293b', borderRight: '1px solid #334155', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '20px' },
  sidebarTitle: { margin: 0, fontSize: '14px', color: '#94a3b8' },
  vehicleList: { flex: 1, overflowY: 'auto', padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { padding: '15px', borderRadius: '12px', border: '2px solid transparent', cursor: 'pointer' },
  cardHeader: { display: 'flex', justifyContent: 'space-between' },
  vName: { fontWeight: '600', fontSize: '14px' },
  vImei: { margin: 0, fontSize: '11px', color: '#64748b' },
  statsContainer: { padding: '20px', borderTop: '1px solid #334155', backgroundColor: '#0f172a' },
  statsHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' },
  statsTitle: { margin: 0, fontSize: '15px', color: '#f8fafc' },
  statsPlaceholder: { height: '120px', border: '1px dashed #334155', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },
  content: { flex: 1, padding: '25px', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  container: { display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 'min-content' },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' },
  metricCard: { backgroundColor: '#1e293b', padding: '20px', borderRadius: '16px', border: '1px solid #334155' },
  metricLabel: { margin: '0 0 5px 0', fontSize: '11px', color: '#94a3b8' },
  metricValue: { margin: 0, fontSize: '18px', fontWeight: '700' },
  metricSub: { margin: 0, fontSize: '12px', color: '#64748b' },
  workspace: { display: 'flex', gap: '20px', flex: 1, minHeight: 0 },
  gpsDisplay: { flex: 3, height: '500px', backgroundColor: '#1e293b', borderRadius: '16px', position: 'relative', overflow: 'hidden', border: '1px solid #334155' },
  histBtn: { position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, padding: '12px 28px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold' },
  alarmsPanel: { flex: 1, backgroundColor: '#1e293b', borderRadius: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column' },
  alarmsTitle: { padding: '15px', borderBottom: '1px solid #334155', fontSize: '14px' },
  alarmsList: { flex: 1, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' },
  alarmeItem: { backgroundColor: '#0f172a', padding: '12px', borderRadius: '10px', borderLeft: '4px solid #f59e0b' },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column' },
  loading: { display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }
};


export default App;
