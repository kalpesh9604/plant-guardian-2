
   import { useState, useEffect } from "react";
  import {
    LayoutDashboard, Sprout, Activity, Droplets, Thermometer,
    Sun, Wind, Bell, Settings, Plus, Leaf, Menu, X,
    CheckCircle, AlertTriangle, Brain, Power, Trash2
  } from "lucide-react";
  import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
  } from "recharts";
  import "./App.css";

  const initialPlants = [
    { id: 1, name: "Monstera Deliciosa", type: "Indoor", moisture: 38, temperature: 27, humidity: 65, light: 720, status: "Needs Water" },
    { id: 2, name: "Peace Lily", type: "Indoor", moisture: 72, temperature: 25, humidity: 78, light: 540, status: "Healthy" },
    { id: 3, name: "Tomato Plant", type: "Outdoor", moisture: 24, temperature: 31, humidity: 48, light: 950, status: "Critical" }
  ];

  const chartData = [
    { time: "8 AM", moisture: 65 },
    { time: "10 AM", moisture: 58 },
    { time: "12 PM", moisture: 52 },
    { time: "2 PM", moisture: 44 },
    { time: "4 PM", moisture: 38 },
    { time: "6 PM", moisture: 42 },
    { time: "8 PM", moisture: 48 }
  ];

function getPlantHealth(moisture) {
  if (moisture < 25) {
    return { score: 35, label: "Needs water", level: "low" };
  }

  if (moisture < 40) {
    return { score: 60, label: "A little dry", level: "medium" };
  }

  if (moisture <= 70) {
    return { score: 95, label: "Healthy moisture", level: "good" };
  }

  if (moisture <= 85) {
    return { score: 70, label: "Too moist", level: "medium" };
  }

  return { score: 45, label: "Overwatered risk", level: "low" };
}


  function App() {
    const [plants, setPlants] = useState(() => {
      try {
        return JSON.parse(localStorage.getItem("plantGuardianPlants")) || initialPlants;
      } catch {
        return initialPlants;
      }
    });
    const [active, setActive] = useState("Dashboard");
    const [selected, setSelected] = useState(1);
    const [pumpOn, setPumpOn] = useState(false);
    const [activityLog, setActivityLog] = useState(() => {
  try {
    return JSON.parse(localStorage.getItem("plantGuardianActivity")) || [];
  } catch {
    return [];
  }
});
    const [showForm, setShowForm] = useState(false);
    const [plantName, setPlantName] = useState("");
    const [plantType, setPlantType] = useState("Indoor");
    const [mobileMenu, setMobileMenu] = useState(false);
    const [leafImage, setLeafImage] = useState("");




  


useEffect(() => {
  const interval = setInterval(() => {
    setPlants(previousPlants =>
      previousPlants.map(plant => ({
        ...plant,
        moisture: Math.max(10, Math.min(95,
          Math.round(plant.moisture + (Math.random() * 4 - 2))
        )),
        temperature: Math.round(
          (plant.temperature + (Math.random() - 0.5)) * 10
        ) / 10,
        humidity: Math.max(20, Math.min(95,
          plant.humidity + Math.round(Math.random() * 4 - 2)
        )),
        light: Math.max(100,
          plant.light + Math.round(Math.random() * 60 - 30)
        )
      }))
    );

    setLastUpdated(new Date());
  }, 5000);

  return () => clearInterval(interval);
}, []);

useEffect(() => {
  localStorage.setItem(
    "plantGuardianActivity",
    JSON.stringify(activityLog)
  );
}, [activityLog]);

const [lastUpdated, setLastUpdated] = useState(new Date());


    const currentPlant = plants.find(p => p.id === selected) || plants[0];
    const healthy = plants.filter(p => p.moisture >= 40).length;

    function savePlants(next) {
      setPlants(next);
      localStorage.setItem("plantGuardianPlants", JSON.stringify(next));
    }

    function addPlant(e) {
      e.preventDefault();
      if (!plantName.trim()) return;
      const newPlant = {
        id: Date.now(),
        name: plantName,
        type: plantType,
        moisture: 55,
        temperature: 26,
        humidity: 60,
        light: 650,
        status: "Healthy"
      };
      savePlants([...plants, newPlant]);
      setSelected(newPlant.id);
      setPlantName("");
      setShowForm(false);
      setActive("My Plants");
    }
    function editPlant(id, updatedData) {
    const next = plants.map(p =>
      p.id === id ? { ...p, ...updatedData } : p
    );

    savePlants(next);
  }


    function removePlant(id) {
      const next = plants.filter(p => p.id !== id);
      savePlants(next);
      if (selected === id && next.length) setSelected(next[0].id);
    }

    if (!plants.length) {
      return <main className="empty-state">
        <Sprout size={48} />
        <h2>Your garden is waiting</h2>
        <button onClick={() => setShowForm(true)}>Add your first plant</button>
        {showForm && <form onSubmit={addPlant}>
          <input value={plantName} onChange={e => setPlantName(e.target.value)} placeholder="Plant name" required />
          <button>Add plant</button>
        </form>}
      </main>;
    }

    return (
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
          <div className="brand">
            <div className="brand-icon"><Sprout size={25} /></div>
            <div><strong>Plant Guardian</strong><small>SMART PLANT CARE</small></div>
            <button className="mobile-close" onClick={() => setMobileMenu(false)}><X /></button>
          </div>

          <p className="nav-label">WORKSPACE</p>
          {[
            ["Dashboard", LayoutDashboard],
            ["My Plants", Sprout],
            ["Monitoring", Activity],
            ["AI Insights", Brain],
            ["Irrigation", Droplets],
            ["Disease Detection", Leaf]


          
            
          ].map(([label, Icon]) => (
            <button key={label} className={`nav-link ${active === label ? "active" : ""}`}
              onClick={() => { setActive(label); setMobileMenu(false); }}>
              <Icon size={19} /> {label}
            </button>
          ))}

          <div className="sidebar-bottom">
            <button className="nav-link" onClick={() => setActive("Settings")}><Settings size={19} /> Settings</button>
            <div className="profile">
              <div className="avatar">PG</div>
              <div><strong>Garden Owner</strong><small>Plant enthusiast</small></div>
            </div>
          </div>
        </aside>

        <main className="main-area">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu /></button>
            <div><span className="breadcrumb">Workspace / </span><strong>{active}</strong></div>
            <div className="top-actions">
              <span className="live-indicator"><i /> Demo monitoring</span>
              <button className="icon-button" title="Notifications"><Bell size={19} /></button>
            </div>
          </header>

          <section className="content">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">SUNDAY, YOUR GARDEN CHECK-IN</p>
                <h1>{active === "Dashboard" ? "Your garden, at a glance." : active}</h1>
                <p className="subheading">Monitor plant health and make smarter care decisions.</p>
              </div>
              <button className="primary-button" onClick={() => setShowForm(true)}><Plus size={18} /> Add a plant</button>
            </div>
            {active === "Dashboard" && (
    <>
            
            

            <div className="notice">
              <Activity size={18} />
              <span><strong>Demo mode:</strong> Sensor readings are simulated for this project demonstration.</span>
            </div>

            <div className="stats-grid">
              <Stat icon={Sprout} label="Total plants" value={plants.length} note="In your garden" />
              <Stat icon={CheckCircle} label="Healthy plants" value={healthy} note="Moisture at 40% or above" />
              <Stat icon={Droplets} label="Average moisture" value={`${Math.round(plants.reduce((a,p) => a + p.moisture, 0) / plants.length)}%`} note="Across all plants" />
              <Stat icon={AlertTriangle} label="Need attention" value={plants.filter(p => p.moisture < 40).length} note="Check watering needs" />
            </div>

            <div className="dashboard-grid">
              <section className="panel chart-panel">
                <div className="panel-heading">
                  <div><h3>Soil moisture trend</h3><p>Recent readings · {currentPlant.name}</p></div>
                  <span className="tag">LAST 12 HOURS</span>
                </div>
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs><linearGradient id="moistureFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4c9b70" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#4c9b70" stopOpacity={0.01} />
                      </linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8eee9" />
                      <XAxis dataKey="time" axisLine={false} tickLine={false} />
                      <YAxis domain={[0,100]} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="moisture" stroke="#36845a" strokeWidth={3} fill="url(#moistureFill)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="panel insight-panel">
                <div className="panel-heading"><div><h3><Brain size={18} /> AI plant insight</h3><p>Explainable care recommendation</p></div></div>
                <div className="ai-status"><span className="ai-dot" /> ANALYSIS COMPLETE</div>
                <div className="insight-icon"><Droplets size={24} /></div>
                <h2>{currentPlant.moisture < 30 ? "Water needed soon" : currentPlant.moisture < 40 ? "Plant may need water" : "Moisture looks good"}</h2>
                <p>{currentPlant.name} has a soil moisture reading of {currentPlant.moisture}%. {currentPlant.moisture < 40 ? "Low soil moisture is the main factor behind this recommendation." : "Current moisture is within the demo healthy range."}</p>
                <div className="reason-list">
                  <div><span>Soil moisture</span><strong>{currentPlant.moisture}%</strong></div>
                  <div><span>Temperature</span><strong>{currentPlant.temperature}°C</strong></div>
                  <div><span>Humidity</span><strong>{currentPlant.humidity}%</strong></div>
                </div>
                <small className="disclaimer">Demo rule-based prediction, not a trained ML model.</small>
              </section>
            </div>

            <section className="panel plants-panel">
              <div className="panel-heading">
                <div><h3>Your plants</h3><p>Select a plant to inspect its sensor readings</p></div>
                <button className="text-button" onClick={() => setActive("My Plants")}>View all</button>
              </div>
              <div className="plant-list">
                {plants.map(plant => (
                  <button key={plant.id} className={`plant-row ${selected === plant.id ? "plant-selected" : ""}`} onClick={() => setSelected(plant.id)}>
                    <div className="plant-avatar"><Leaf size={21} /></div>
                    <div className="plant-name"><strong>{plant.name}</strong><small>{plant.type} plant</small></div>

{(() => {
  const health = getPlantHealth(plant.moisture);
  return (
    <div className={`plant-health health-${health.level}`}>
      <strong>{health.score}%</strong>
      <small>{health.label}</small>
    </div>
  );
})()}

                    
                    <div className="plant-moisture"><Droplets size={16} /> {plant.moisture}%</div>
                   <span className={`status health-${getPlantHealth(plant.moisture).level}`}>
  {getPlantHealth(plant.moisture).label}
</span>
                  </button>
                ))}
              </div>
            </section>

            <div className="bottom-grid">

              <section className="panel sensor-panel">
                <p>{currentPlant.name}</p>
<small>Last updated: {lastUpdated.toLocaleTimeString()}</small>
                <div className="sensor-grid">
                  <Sensor icon={Droplets} label="Soil moisture" value={`${currentPlant.moisture}%`} />
                  <Sensor icon={Thermometer} label="Temperature" value={`${currentPlant.temperature}°C`} />
                  <Sensor icon={Wind} label="Humidity" value={`${currentPlant.humidity}%`} />
                  <Sensor icon={Sun} label="Light intensity" value={`${currentPlant.light} lux`} />
                </div>
              </section>
              <section className="panel irrigation-panel">
                <div className="panel-heading"><div><h3>Smart irrigation</h3><p>Demo pump controller</p></div><Droplets color="#36845a" /></div>
                <div className={`pump-status ${pumpOn ? "pump-active" : ""}`}><Power size={23} /><div><strong>{pumpOn ? "Pump is ON" : "Pump is OFF"}</strong><small>{pumpOn ? "Demo irrigation active" : "No irrigation running"}</small></div></div>
                <button 
  className={`pump-button ${pumpOn ? "stop" : ""}`}
  onClick={() => {
    const nextState = !pumpOn;
    setPumpOn(nextState);

    setActivityLog(previous => [
      {
        id: Date.now(),
        plant: currentPlant.name,
        action: nextState ? "Irrigation started" : "Irrigation stopped",
        time: new Date().toLocaleString()
      },
      ...previous
    ]);
  }}
>
</button>
                <small className="disclaimer">This control does not operate physical hardware.</small>
              </section>
            </div>
            <section className="panel activity-panel">
  <div className="panel-heading">
    <div>
      <h3>Watering Activity</h3>
      <p>Recent demo irrigation events</p>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
  <span className="tag">{activityLog.length} EVENTS</span>
  <button
    className="clear-history-button"
    onClick={() => {
      if (window.confirm("Clear all watering history?")) {
        setActivityLog([]);
      }
    }}
  >
    Clear
  </button>
</div>
  </div>

  {activityLog.length === 0 ? (
    <p className="activity-empty">
      No irrigation activity yet. Start demo irrigation to record an event.
    </p>
  ) : (
    <div className="activity-list">
      {activityLog.slice(0, 8).map(item => (
        <div className="activity-item" key={item.id}>
          <div className="activity-icon">
            <Droplets size={18} />
          </div>

          <div className="activity-details">
            <strong>{item.action}</strong>
            <small>{item.plant} · {item.time}</small>
          </div>

          <span className={`activity-status ${
            item.action === "Irrigation started" ? "started" : "stopped"
          }`}>
            {item.action === "Irrigation started" ? "ON" : "OFF"}
          </span>
        </div>
      ))}
    </div>
  )}
</section>
              </>
  )}  

            
  {active === "My Plants" && (
    <section className="panel">
      <h3>Manage your plants</h3>

      {plants.map(p => (
        <div className="manage-row" key={p.id}>
          <span>{p.name}</span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => {
                const newName = window.prompt(
                  "Enter new plant name:",
                  p.name
                );

                if (newName && newName.trim()) {
                  editPlant(p.id, { name: newName.trim() });
                }
              }}
              title="Edit plant"
            >
              Edit
            </button>

            <button
              onClick={() => removePlant(p.id)}
              title="Remove plant"
            >
              <Trash2 size={17} />
            </button>
          </div>
        </div>
      ))}
    </section>
  )}


  {active === "Monitoring" && (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3>Plant Monitoring</h3>
          <p>Sensor readings for {currentPlant.name}</p>
        </div>
        <span className="live-indicator"><i /> DEMO</span>
      </div>

      <div className="sensor-grid">
        <Sensor
          icon={Droplets}
          label="Soil Moisture"
          value={`${currentPlant.moisture}%`}
        />
        <Sensor
          icon={Thermometer}
          label="Temperature"
          value={`${currentPlant.temperature}°C`}
        />
        <Sensor
          icon={Wind}
          label="Humidity"
          value={`${currentPlant.humidity}%`}
        />
        <Sensor
          icon={Sun}
          label="Light Intensity"
          value={`${currentPlant.light} lux`}
        />
      </div>

      <h3>Plant health status</h3>
      <p>
        {currentPlant.moisture < 30
          ? "Critical: Immediate watering is recommended."
          : currentPlant.moisture < 40
          ? "Warning: Soil moisture is low. Water your plant soon."
          : "Healthy: Soil moisture is within the demo healthy range."}
      </p>
    </section>
  )}

  {active === "Irrigation" && (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h3><Droplets size={20} /> Smart Irrigation Control</h3>
          <p>Water management for {currentPlant.name}</p>
        </div>
        <span className="tag">DEMO MODE</span>
      </div>

      <div className="reason-list">
        <div>
          <span>Current soil moisture</span>
          <strong>{currentPlant.moisture}%</strong>
        </div>
        <div>
          <span>Recommended action</span>
          <strong>
            {currentPlant.moisture < 30
              ? "Water immediately"
              : currentPlant.moisture < 40
              ? "Water soon"
              : "No watering needed"}
          </strong>
        </div>
        <div>
          <span>Pump status</span>
          <strong>{pumpOn ? "ON" : "OFF"}</strong>
        </div>
      </div>

      <button
        className="primary-btn"
        onClick={() => setPumpOn(!pumpOn)}
      >
        <Power size={18} />
        {pumpOn ? "Turn Pump OFF" : "Turn Pump ON"}
      </button>

      <p className="disclaimer">
        This is a software demonstration. The pump is simulated;
        no physical water pump or hardware is connected.
      </p>
    </section>
  )}


            {active === "Settings" && <section className="panel"><h3>Application settings</h3><p className="subheading">Plant Guardian prototype · Local browser storage · Demo sensor data</p></section>}
          </section>
          <footer>© 2026 Plant Guardian · AI-powered plant monitoring prototype</footer>
        </main>

        {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onSubmit={addPlant} onClick={e => e.stopPropagation()}>
            <h2>Add a new plant</h2><p>Start monitoring another plant in your garden.</p>
            <label>Plant name</label>
            <input value={plantName} onChange={e => setPlantName(e.target.value)} placeholder="e.g. Aloe Vera" required />
            <label>Plant location</label>
            <select value={plantType} onChange={e => setPlantType(e.target.value)}><option>Indoor</option><option>Outdoor</option></select>
            <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button><button className="primary-button">Add plant</button></div>
          </form>
        </div>}
      </div>
    );
  }

  function Stat({ icon: Icon, label, value, note }) {
    return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={19} /></div><strong>{value}</strong><small>{note}</small></div>;
  }
  function Sensor({ icon: Icon, label, value }) {
    return <div className="sensor-card"><Icon size={19}/><small>{label}</small><strong>{value}</strong></div>;
  }

  export default App;
