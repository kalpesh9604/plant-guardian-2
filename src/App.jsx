import Auth from "./components/Auth";
import { apiRequest } from "./services/api";
import { formatDate, formatDateTime } from "./services/formatDate";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { LocalNotifications } from "@capacitor/local-notifications";
import {
  LayoutDashboard, Sprout, Activity, Droplets, Bell, Settings,
  Plus, Leaf, Menu, X, CheckCircle, AlertTriangle, Brain, Trash2, Camera as CameraIcon,
  LogOut, Pencil
} from "lucide-react";
import Reminders from "./components/Reminders";
import AIAssistant from "./components/AIAssistant";
import "./App.css";

const WateringChart = lazy(() => import("./components/WateringChart"));

const emptyPlantForm = {
  name: "",
  species: "",
  location: "Indoor",
  sunlight_preference: "",
  watering_interval_days: 7,
  notes: ""
};

function App() {
  const [user, setUser] = useState(() => {
    if (!localStorage.getItem("plantGuardianToken")) return null;
    try {
      return JSON.parse(localStorage.getItem("plantGuardianUser")) || null;
    } catch {
      localStorage.removeItem("plantGuardianToken");
      localStorage.removeItem("plantGuardianUser");
      return null;
    }
  });
  const [plants, setPlants] = useState([]);
  const [careRecords, setCareRecords] = useState([]);
  const [careLoading, setCareLoading] = useState(false);
  const [careAction, setCareAction] = useState("watering");
  const [careObservation, setCareObservation] = useState("");
  const [careNotes, setCareNotes] = useState("");
  const [careSaving, setCareSaving] = useState(false);
  const [aiSymptoms, setAiSymptoms] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [dashboardStats, setDashboardStats] = useState({
    totalPlants: 0,
    totalWaterings: 0,
    pendingReminders: 0,
    completedReminders: 0,
    wateringHistory: [],
    plantHealth: []
  });
  const [active, setActive] = useState("Dashboard");
  const [dateFormat, setDateFormat] = useState(() =>
    localStorage.getItem("plantGuardianDateFormat") === "utc" ? "utc" : "local"
  );
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [plantForm, setPlantForm] = useState(emptyPlantForm);
  const [editingPlantId, setEditingPlantId] = useState(null);
  const [plantSaving, setPlantSaving] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [leafImage, setLeafImage] = useState("");
  const [leafFile, setLeafFile] = useState(null);
  const [imageAnalysis, setImageAnalysis] = useState(null);
  const [imageAnalysisLoading, setImageAnalysisLoading] = useState(false);
  const [imageAnalysisError, setImageAnalysisError] = useState("");
  const [appError, setAppError] = useState("");
  const isNative = Capacitor.isNativePlatform();
  const backState = useRef({ active, showForm, mobileMenu });

  function handlePlantPhoto(file) {
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setImageAnalysisError("Choose a JPG, PNG, or WEBP image.");
      setLeafFile(null);
      setLeafImage("");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setImageAnalysisError("Image must be no larger than 5 MB.");
      setLeafFile(null);
      setLeafImage("");
      return;
    }

    setLeafFile(file);
    setLeafImage(URL.createObjectURL(file));
    setImageAnalysis(null);
    setImageAnalysisError("");
  }

  async function handleCameraPhoto(photo) {
    if (!photo?.webPath) {
      throw new Error("The selected photo could not be opened.");
    }

    const response = await fetch(photo.webPath);
    if (!response.ok) {
      throw new Error("The selected photo could not be read.");
    }
    const blob = await response.blob();
    const format = photo.format === "png" ? "png" : "jpg";
    const type = blob.type || (format === "png" ? "image/png" : "image/jpeg");
    handlePlantPhoto(new File([blob], `plant-photo.${format}`, { type }));
  }

  const refreshDashboardStats = useCallback(async () => {
    const result = await apiRequest("/dashboard/stats");
    setDashboardStats(result.stats);
  }, []);

  const loadCareRecords = useCallback(async (plantId, signal) => {
    if (!plantId) {
      setCareRecords([]);
      return;
    }

    try {
      const result = await apiRequest(`/care/${plantId}`, { signal });
      setCareRecords(result.records || []);
    } catch (error) {
      if (error.name !== "AbortError") {
        setAppError(error.message);
        setCareRecords([]);
      }
    } finally {
      if (!signal?.aborted) setCareLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("plantGuardianToken");
    localStorage.removeItem("plantGuardianUser");
    setUser(null);
    setPlants([]);
    setCareRecords([]);
    setCareLoading(false);
    setSelected(null);
    setActive("Dashboard");
    setAiSymptoms([]);
    setAiResult(null);
    setAiError("");
    setLeafFile(null);
    setLeafImage("");
    setImageAnalysis(null);
    setImageAnalysisLoading(false);
    setImageAnalysisError("");
    setShowForm(false);
    setDashboardStats({
      totalPlants: 0,
      totalWaterings: 0,
      pendingReminders: 0,
      completedReminders: 0,
      wateringHistory: [],
      plantHealth: []
    });
    setAppError("");
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => logout();
    window.addEventListener("plantguardian:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("plantguardian:unauthorized", handleUnauthorized);
  }, [logout]);

  useEffect(() => {
    backState.current = { active, showForm, mobileMenu };
  }, [active, showForm, mobileMenu]);

  useEffect(() => {
    if (!isNative) return undefined;

    const listener = CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      const state = backState.current;
      if (state.showForm) {
        setShowForm(false);
      } else if (state.mobileMenu) {
        setMobileMenu(false);
      } else if (state.active !== "Dashboard") {
        setActive("Dashboard");
      } else if (canGoBack) {
        window.history.back();
      } else {
        void CapacitorApp.exitApp();
      }
    });

    return () => {
      void listener.then(handle => handle.remove());
    };
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    const listener = CapacitorApp.addListener("appRestoredResult", event => {
      if (event.pluginId !== "Camera" || event.methodName !== "getPhoto") return;
      if (!event.success) {
        const message = event.error?.message || "";
        if (!/cancel/i.test(message)) {
          setImageAnalysisError(message || "Could not restore the selected photo.");
        }
        return;
      }

      void handleCameraPhoto(event.data).catch(error => {
        setImageAnalysisError(error.message || "Could not restore the selected photo.");
      });
    });

    return () => {
      void listener.then(handle => handle.remove());
    };
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return undefined;

    const listener = LocalNotifications.addListener(
      "localNotificationActionPerformed",
      () => {
        setActive("Reminders");
        setMobileMenu(false);
      }
    );

    return () => {
      void listener.then(handle => handle.remove());
    };
  }, [isNative]);

  useEffect(() => {
    if (!leafImage) return undefined;
    return () => URL.revokeObjectURL(leafImage);
  }, [leafImage]);

useEffect(() => {
  if (!user) return;
  let active = true;

  async function loadPlants() {
    try {
      const result = await apiRequest("/plants");
      if (!active) return;
      setPlants(result.plants || []);
      if (result.plants?.length) setCareLoading(true);
      setSelected(current =>
        result.plants?.some(plant => plant.id === current)
          ? current
          : result.plants?.[0]?.id || null
      );
    } catch (error) {
      if (active) setAppError(error.message);
    }
  }

  async function loadStats() {
    try {
      const result = await apiRequest("/dashboard/stats");
      if (active) setDashboardStats(result.stats);
    } catch (error) {
      if (active) setAppError(error.message);
    }
  }

  loadPlants();
  loadStats();
  return () => { active = false; };
}, [user]);
useEffect(() => {
  if (!user || !selected) return;

  const controller = new AbortController();
  loadCareRecords(selected, controller.signal);
  return () => controller.abort();
}, [user, selected, loadCareRecords]);

if (!user) {
  return <Auth onAuthenticated={setUser} />;
}
    const currentPlant = plants.find(p => p.id === selected) || plants[0] || null;
async function addCareRecord(e) {
  e.preventDefault();

  if (!selected) {
    setAppError("Please select a plant first.");
    return;
  }

  setCareSaving(true);

  try {
    await apiRequest(`/care/${selected}`, {
      method: "POST",
      body: JSON.stringify({
        action_type: careAction,
        observation: careObservation,
        notes: careNotes
      })
    });

    setCareObservation("");
    setCareNotes("");

    await loadCareRecords(selected);

    const result = await apiRequest("/dashboard/stats");
    setDashboardStats(result.stats);

    setAppError("");
  } catch (error) {
    setAppError(error.message);
  } finally {
    setCareSaving(false);
  }
}
function selectPlant(plantId) {
  setSelected(plantId);
  setCareLoading(true);
  setCareRecords([]);
  setAiResult(null);
  setAiSymptoms([]);
  setImageAnalysis(null);
  setImageAnalysisError("");
  setLeafFile(null);
  setLeafImage("");
}
async function runAIAnalysis() {
  if (!selected) {
    setAiError("Please select a plant first.");
    return;
  }

  setAiLoading(true);
  setAiError("");
  setAiResult(null);

  try {
    const result = await apiRequest(`/ai/${selected}/analyze`, {
      method: "POST",
      body: JSON.stringify({
        symptoms: aiSymptoms
      })
    });

    setAiResult(result);
  } catch (error) {
    setAiError(error.message);
  } finally {
    setAiLoading(false);
  }
}

async function choosePlantPhoto() {
  setImageAnalysisError("");
  try {
    const photo = await Camera.getPhoto({
      source: CameraSource.Prompt,
      resultType: CameraResultType.Uri,
      quality: 90,
      correctOrientation: true
    });
    await handleCameraPhoto(photo);
  } catch (error) {
    if (!/cancel/i.test(error?.message || "")) {
      setImageAnalysisError(error.message || "Could not open the camera or gallery.");
    }
  }
}

async function runImageAnalysis() {
  if (!selected) {
    setImageAnalysisError("Please select a plant first.");
    return;
  }

  if (!leafFile) {
    setImageAnalysisError("Please upload a plant photo first.");
    return;
  }

  setImageAnalysisLoading(true);
  setImageAnalysisError("");
  setImageAnalysis(null);

  try {
    const formData = new FormData();
    formData.append("image", leafFile);

    const data = await apiRequest(`/ai/${selected}/image-analysis`, {
      method: "POST",
      body: formData
    });
    setImageAnalysis(data.analysis);
  } catch (error) {
    setImageAnalysisError(error.message);
  } finally {
    setImageAnalysisLoading(false);
  }
}

function openPlantForm(plant = null) {
  setEditingPlantId(plant?.id || null);
  setPlantForm(plant ? {
    name: plant.name || "",
    species: plant.species || "",
    location: plant.location || "Indoor",
    sunlight_preference: plant.sunlight_preference || "",
    watering_interval_days: plant.watering_interval_days || 7,
    notes: plant.notes || ""
  } : { ...emptyPlantForm });
  setShowForm(true);
}

async function addPlant(e) {
  e.preventDefault();
  if (!plantForm.name.trim()) return;

  setPlantSaving(true);
  try {
    const result = await apiRequest(
      editingPlantId ? `/plants/${editingPlantId}` : "/plants",
      {
        method: editingPlantId ? "PUT" : "POST",
        body: JSON.stringify({
          ...plantForm,
          name: plantForm.name.trim(),
          species: plantForm.species.trim() || null,
          location: plantForm.location.trim() || null,
          sunlight_preference: plantForm.sunlight_preference.trim() || null,
          notes: plantForm.notes.trim() || null,
          watering_interval_days: Number(plantForm.watering_interval_days)
        })
      }
    );

    setPlants(previous => editingPlantId
      ? previous.map(plant => plant.id === editingPlantId ? result.plant : plant)
      : [...previous, result.plant]
    );
    selectPlant(result.plant.id);
    setPlantForm({ ...emptyPlantForm });
    setEditingPlantId(null);
    setShowForm(false);
    setActive("My Plants");
    await refreshDashboardStats();
    setAppError("");
  } catch (error) {
    setAppError(error.message);
  } finally {
    setPlantSaving(false);
  }
}

async function removePlant(id) {
  if (!window.confirm("Delete this plant and its care history?")) return;

  try {
    await apiRequest(`/plants/${id}`, {
      method: "DELETE"
    });

    const next = plants.filter(p => p.id !== id);
    setPlants(next);
    if (selected === id) {
      if (next.length) selectPlant(next[0].id);
      else {
        setSelected(null);
        setCareRecords([]);
      }
    }
    await refreshDashboardStats();
  } catch (error) {
    setAppError(error.message);
  }
}
    return (
      <div className={`app-shell ${isNative ? "native-shell" : ""}`}>
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
            ["AI Assistant", Brain],
            ["Irrigation", Droplets],
            ["Disease Detection", Leaf],
            ["Reminders", Bell],
            ["Settings", Settings]
          ].map(([label, Icon]) => (
            <button key={label} className={`nav-link ${active === label ? "active" : ""}`}
              onClick={() => { setActive(label); setMobileMenu(false); }}>
              <Icon size={19} /> {label}
            </button>
          ))}

          <div className="sidebar-bottom">
            <div className="profile">
              <div className="avatar">{user.name?.slice(0, 2).toUpperCase() || "PG"}</div>
              <div><strong>{user.name}</strong><small>{user.email}</small></div>
            </div>
            <button className="nav-link" onClick={() => {
              logout();
            }}><LogOut size={18} /> Log out</button>
          </div>
        </aside>

        {mobileMenu && (
          <button
            type="button"
            className="mobile-overlay"
            aria-label="Close navigation"
            onClick={() => setMobileMenu(false)}
          />
        )}

        <main className="main-area">
          <header className="topbar">
            <button className="mobile-menu" onClick={() => setMobileMenu(true)}><Menu /></button>
            <div><span className="breadcrumb">Workspace / </span><strong>{active}</strong></div>
            <div className="top-actions">
              <span className="live-indicator"><i /> Manual care tracking</span>
              <button className="icon-button" title="Reminders" onClick={() => setActive("Reminders")}><Bell size={19} /></button>
            </div>
          </header>

          <section className="content">
            <div className="welcome-row">
              <div>
                <p className="eyebrow">YOUR GARDEN CHECK-IN</p>
                <h1>{active === "Dashboard" ? "Your garden, at a glance." : active}</h1>
                <p className="subheading">Monitor plant health and make smarter care decisions.</p>
              </div>
              <button className="primary-button" onClick={() => openPlantForm()}><Plus size={18} /> Add a plant</button>
            </div>
            {appError && <p className="auth-error" role="alert">{appError}</p>}
            {!plants.length && active !== "My Plants" && active !== "Reminders" && active !== "Settings" && (
              <div className="notice">
                <Sprout size={18} />
                <span>Your garden is empty. Add a plant to start tracking care and receive personalized guidance.</span>
              </div>
            )}
            {active === "Dashboard" && (
    <>
            
            
<div className="notice">
  <Activity size={18} />
  <span>
    <strong>Plant care mode:</strong> Your garden data is connected to the database.
    Add care records to receive personalized recommendations.
  </span>
</div>
            <div className="stats-grid">
             <Stat
  icon={Sprout}
  label="Total plants"
  value={dashboardStats.totalPlants}
  note="Registered plants"
/>

<Stat
  icon={Droplets}
  label="Total waterings"
  value={dashboardStats.totalWaterings}
  note="Recorded care activities"
/>

<Stat
  icon={Bell}
  label="Pending reminders"
  value={dashboardStats.pendingReminders}
  note="Upcoming plant care"
/>

<Stat
  icon={CheckCircle}
  label="Completed reminders"
  value={dashboardStats.completedReminders}
  note="Completed care tasks"
/>
            </div>

            <div className="dashboard-grid">
              <section className="panel chart-panel">
  <div className="panel-heading">
    <div>
      <h3>Plant care activity</h3>
      <p>Your recorded watering history</p>
    </div>
    <span className="tag">DATABASE</span>
  </div>

  {dashboardStats.wateringHistory?.length ? (
    <Suspense fallback={<p className="activity-empty">Loading chart...</p>}>
      <WateringChart data={dashboardStats.wateringHistory} />
    </Suspense>
  ) : (
    <p className="activity-empty">No watering records during the last 7 days.</p>
  )}
</section>
             {currentPlant && <section className="panel insight-panel">
  <div className="panel-heading">
    <div>
      <h3><Brain size={18} /> Plant health overview</h3>
      <p>Assessment from saved care information</p>
    </div>
  </div>

  <div className="insight-icon">
    <Sprout size={24} />
  </div>

  <h2>{currentPlant.name}</h2>
  <p>
    Current status: <strong>
      {dashboardStats.plantHealth?.find(plant => plant.id === currentPlant.id)?.healthStatus || "Not assessed"}
    </strong>
  </p>

  <p>
    Rule-based guidance uses the plant's last watering and saved growing conditions.
  </p>

  <div className="reason-list">
    <div>
      <span>Plant species</span>
      <strong>{currentPlant.species || "Not specified"}</strong>
    </div>
    <div>
      <span>Watering interval</span>
      <strong>{currentPlant.watering_interval_days || 7} days</strong>
    </div>
    <div>
      <span>Sunlight preference</span>
      <strong>{currentPlant.sunlight_preference || "Not specified"}</strong>
    </div>
  </div>

  <small className="disclaimer">
    This is a rule-based estimate, not a sensor reading or confirmed diagnosis.
  </small>
</section>}
            </div>

           <section className="panel plants-panel">
  <div className="panel-heading">
    <div>
      <h3>Your plants</h3>
      <p>Select a plant to view its details</p>
    </div>
    <button
      className="text-button"
      onClick={() => setActive("My Plants")}
    >
      View all
    </button>
  </div>

  <div className="plant-list">
    {plants.map(plant => (
      <button
        key={plant.id}
        className={`plant-row ${selected === plant.id ? "plant-selected" : ""}`}
        onClick={() => selectPlant(plant.id)}
      >
        <div className="plant-avatar">
          <Leaf size={21} />
        </div>

        <div className="plant-name">
          <strong>{plant.name}</strong>
          <small>{plant.species || "Species not specified"}</small>
        </div>

        <div className="plant-health">
          <strong>{dashboardStats.plantHealth?.find(item => item.id === plant.id)?.healthScore ?? "—"}/100</strong>
          <small>{dashboardStats.plantHealth?.find(item => item.id === plant.id)?.healthStatus || "Not assessed"}</small>
        </div>

        <span className="status good">
          Tracked
        </span>
      </button>
    ))}
  </div>
</section>

            {currentPlant && <div className="bottom-grid">
  <section className="panel sensor-panel">
    <div className="panel-heading">
      <div>
        <h3>Plant profile</h3>
        <p>Stored plant information</p>
      </div>
      <span className="tag">DATABASE</span>
    </div>

    <div className="reason-list">
      <div>
        <span>Plant name</span>
        <strong>{currentPlant.name}</strong>
      </div>
      <div>
        <span>Species</span>
        <strong>{currentPlant.species || "Not specified"}</strong>
      </div>
      <div>
        <span>Location</span>
        <strong>{currentPlant.location || "Not specified"}</strong>
      </div>
      <div>
        <span>Watering interval</span>
        <strong>{currentPlant.watering_interval_days || 7} days</strong>
      </div>
    </div>
  </section>
</div>}
              
            <section className="panel activity-panel">
  <div className="panel-heading">
    <div>
      <h3>Plant Care History</h3>
      <p>Records retrieved from your database</p>
    </div>
    <span className="tag">{careRecords.length} RECORDS</span>
  </div>

  {careLoading ? (
    <p className="activity-empty">Loading care history...</p>
  ) : careRecords.length === 0 ? (
    <p className="activity-empty">
      No care records yet. Start recording your plant-care activities.
    </p>
  ) : (
    <div className="activity-list">
      {careRecords.slice(0, 8).map(record => (
        <div className="activity-item" key={record.id}>
          <div className="activity-icon">
            <Sprout size={18} />
          </div>

          <div className="activity-details">
            <strong>
              {record.action_type.charAt(0).toUpperCase() +
                record.action_type.slice(1)}
            </strong>

            <small>
              {record.observation || record.notes || "Care activity recorded"}
            </small>

            <small>
              {formatDateTime(record.created_at, dateFormat)}
            </small>
          </div>

          <span className="activity-status started">
            SAVED
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
      {plants.length === 0 ? (
        <div className="empty-panel">
          <Sprout size={34} />
          <p>Your garden is empty. Add your first plant to begin tracking care.</p>
        </div>
      ) : (
        <>
<div className="care-form">
  <h3>Record Plant Care</h3>
  <p>Save a care activity for your selected plant.</p>

  <form onSubmit={addCareRecord}>
    <label>
      Select activity
      <select
        value={careAction}
        onChange={e => setCareAction(e.target.value)}
      >
        <option value="watering">Watering</option>
        <option value="fertilizing">Fertilizing</option>
        <option value="pruning">Pruning</option>
        <option value="repotting">Repotting</option>
        <option value="observation">General observation</option>
      </select>
    </label>

    <label>
      Observation
      <input
        value={careObservation}
        onChange={e => setCareObservation(e.target.value)}
        placeholder="Example: Soil was dry"
      />
    </label>

    <label>
      Notes
      <textarea
        value={careNotes}
        onChange={e => setCareNotes(e.target.value)}
        placeholder="Additional care details..."
      />
    </label>

    <button type="submit" disabled={careSaving || !selected}>
      {careSaving ? "Saving..." : "Save Care Record"}
    </button>
  </form>
</div>  
      {plants.map(p => (
        <div className="manage-row" key={p.id}>
        <div>
  <strong>{p.name}</strong>
  {selected === p.id && (
    <span className="tag" style={{ marginLeft: "10px" }}>
      SELECTED
    </span>
  )}
</div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
  onClick={() => {
    selectPlant(p.id);
    setAiResult(null);
    setAiSymptoms([]);
  }}
  disabled={selected === p.id}
>
  {selected === p.id ? "Selected" : "Select Plant"}
</button>
            <button 
              onClick={() => openPlantForm(p)}
              title="Edit plant"
            >
              <Pencil size={16} /> Edit
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
        </>
      )}
    </section>
  )}


  {active === "Monitoring" && currentPlant && (
  <section className="panel">
    <div className="panel-heading">
      <div>
        <h3>Plant Care Monitoring</h3>
        <p>Care information for {currentPlant.name}</p>
      </div>
      <span className="tag">SAVED RECORDS</span>
    </div>

    <div className="reason-list">
      <div>
        <span>Plant name</span>
        <strong>{currentPlant.name}</strong>
      </div>
      <div>
        <span>Species</span>
        <strong>{currentPlant.species || "Not specified"}</strong>
      </div>
      <div>
        <span>Watering interval</span>
        <strong>{currentPlant.watering_interval_days || 7} days</strong>
      </div>
      <div>
        <span>Total care records</span>
        <strong>{careRecords.length}</strong>
      </div>
    </div>

    <h3>Recent care observations</h3>

    {careRecords.length === 0 ? (
      <p>No observations recorded yet.</p>
    ) : (
      <div className="activity-list">
        {careRecords.slice(0, 5).map(record => (
          <div className="activity-item" key={record.id}>
            <div className="activity-icon">
              <Sprout size={18} />
            </div>
            <div className="activity-details">
              <strong>{record.action_type}</strong>
              <small>
                {record.observation || record.notes || "No additional details"}
              </small>
              <small>
                {formatDateTime(record.created_at, dateFormat)}
              </small>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
)}

  {active === "Irrigation" && currentPlant && (
  <section className="panel">
    <div className="panel-heading">
      <div>
        <h3><Droplets size={20} /> Watering Management</h3>
        <p>Watering schedule for {currentPlant.name}</p>
      </div>
      <span className="tag">CARE TRACKING</span>
    </div>

    <div className="reason-list">
      <div>
        <span>Selected plant</span>
        <strong>{currentPlant.name}</strong>
      </div>

      <div>
        <span>Watering interval</span>
        <strong>{currentPlant.watering_interval_days || 7} days</strong>
      </div>

      <div>
        <span>Last watering</span>
        <strong>
          {careRecords.find(record => record.action_type === "watering")
            ? formatDate(
                careRecords.find(record => record.action_type === "watering").created_at,
                dateFormat
              )
            : "No record yet"}
        </strong>
      </div>

      <div>
        <span>Total watering records</span>
        <strong>
          {careRecords.filter(record => record.action_type === "watering").length}
        </strong>
      </div>
    </div>

    <div className="notice">
      <Droplets size={20} />
      <span>
        Watering recommendations are based on your recorded care history
        and the plant's configured watering interval. Always check the soil
        before watering.
      </span>
    </div>

    <button
      className="primary-btn"
      onClick={() => setActive("My Plants")}
    >
      <Plus size={18} />
      Record watering activity
    </button>

    <p className="disclaimer">
      This application tracks manual watering records. It does not control
      a physical pump or measure soil moisture.
    </p>
  </section>
)}
{active === "AI Insights" && currentPlant && (
  <section className="panel">
    <div className="panel-heading">
      <div>
        <h3><Brain size={20} /> AI Plant Health Analysis</h3>
        <p>Assess the condition of {currentPlant.name}</p>
      </div>
      <span className="tag">CARE INTELLIGENCE</span>
    </div>

    <h3>Select observed symptoms</h3>
    <p>Select any symptoms you have noticed on your plant.</p>

    <div className="symptom-grid">
      {[
        "yellow leaves",
        "brown tips",
        "wilting",
        "spots",
        "drooping leaves",
        "curling leaves",
        "white powder",
        "mold on soil",
        "pests",
        "root rot"
      ].map(symptom => (
        <label key={symptom} className="symptom-option">
          <input
            type="checkbox"
            checked={aiSymptoms.includes(symptom)}
            onChange={e => {
              setAiSymptoms(previous =>
                e.target.checked
                  ? [...previous, symptom]
                  : previous.filter(item => item !== symptom)
              );
            }}
          />
          {symptom.charAt(0).toUpperCase() + symptom.slice(1)}
        </label>
      ))}
    </div>

    <button
      className="primary-btn"
      onClick={runAIAnalysis}
      disabled={aiLoading}
    >
      <Brain size={18} />
      {aiLoading ? "Analyzing plant..." : "Analyze Plant Health"}
    </button>

    {aiError && (
      <p className="auth-error">{aiError}</p>
    )}

    {aiResult && (
      <div className="ai-results">
        <h3>Analysis Results</h3>

        <div className="reason-list">
          <div>
            <span>Plant</span>
            <strong>{aiResult.plant.name}</strong>
          </div>

          <div>
            <span>Health score</span>
            <strong>{aiResult.analysis.healthScore}/100</strong>
          </div>

          <div>
            <span>Health status</span>
            <strong>{aiResult.analysis.healthStatus}</strong>
          </div>

          <div>
            <span>Analysis method</span>
            <strong>{aiResult.analysisType}</strong>
          </div>
        </div>

        <h3>Recommendations</h3>

        {aiResult.analysis.recommendations.map((item, index) => (
          <div className="notice" key={index}>
            <Sprout size={19} />
            <span>
              <strong>{item.category}</strong>
              <br />
              {item.message}
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
)}

{active === "Disease Detection" && currentPlant && (
  <section className="panel">
    <div className="panel-heading">
      <div>
        <h3><Leaf size={20} /> Plant Disease Detection</h3>
        <p>Identify possible plant health problems using observed symptoms.</p>
      </div>
      <span className="tag">SYMPTOM ANALYSIS</span>
    </div>

    <div className="notice">
      <AlertTriangle size={20} />
      <span>
        Select the symptoms visible on {currentPlant.name}.
        Results are rule-based guidance, not a confirmed medical or
        laboratory diagnosis of plant disease.
      </span>
    </div>

    <h3>What symptoms can you see?</h3>

    <div className="symptom-grid">
      {[
        "yellow leaves",
        "brown tips",
        "wilting",
        "spots",
        "drooping leaves",
        "curling leaves",
        "white powder",
        "mold on soil",
        "pests",
        "root rot"
      ].map(symptom => (
        <label key={symptom} className="symptom-option">
          <input
            type="checkbox"
            checked={aiSymptoms.includes(symptom)}
            onChange={e => {
              setAiSymptoms(previous =>
                e.target.checked
                  ? [...previous, symptom]
                  : previous.filter(item => item !== symptom)
              );
              setAiResult(null);
            }}
          />
          {symptom.charAt(0).toUpperCase() + symptom.slice(1)}
        </label>
      ))}
    </div>

<div className="panel" style={{ marginTop: "24px" }}>
  <h3>Analyze Plant Photo with AI</h3>
  <p>Take a photo or choose a clear image of the affected plant leaf.</p>

  {isNative && (
    <button
      type="button"
      className="primary-btn"
      onClick={choosePlantPhoto}
    >
      <CameraIcon size={17} /> Camera or gallery
    </button>
  )}

  <input
    type="file"
    accept="image/jpeg,image/png,image/webp"
    capture="environment"
    className={isNative ? "native-file-input" : ""}
    onChange={e => {
      const file = e.target.files?.[0];
      handlePlantPhoto(file);
      e.target.value = "";
    }}
  />

  {leafImage && (
    <div className="leaf-preview">
      <img
        src={leafImage}
        alt="Plant leaf preview"
        style={{ maxWidth: "250px", marginTop: "15px", borderRadius: "12px" }}
      />

      <button
        type="button"
        className="secondary-button"
        onClick={() => {
          setLeafFile(null);
          setLeafImage("");
        }}
      >
        Remove Photo
      </button>
    </div>
  )}
</div>

<button
  className="primary-btn"
  onClick={runImageAnalysis}
  disabled={!leafFile || imageAnalysisLoading}
  style={{ marginTop: "15px" }}
>
  <Brain size={18} />
  {imageAnalysisLoading
    ? "Analyzing Photo..."
    : "Analyze Photo with Gemini AI"}
</button>

{imageAnalysisError && (
  <p className="auth-error">{imageAnalysisError}</p>
)}

{imageAnalysis && (
  <div className="ai-results">
    <h3>AI Photo Analysis Results</h3>

    <div className="reason-list">
      <div>
        <span>Plant identification</span>
        <strong>{imageAnalysis.plantIdentification}</strong>
      </div>
      <div>
        <span>Condition</span>
        <strong>{imageAnalysis.condition}</strong>
      </div>
      <div>
        <span>Possible issue</span>
        <strong>{imageAnalysis.possibleIssue}</strong>
      </div>
      <div>
        <span>Severity</span>
        <strong>{imageAnalysis.severity}</strong>
      </div>
    </div>

    <h3>Visible evidence</h3>
    <p>{imageAnalysis.visualEvidence}</p>

    <h3>Recommendations</h3>
    {imageAnalysis.recommendations?.map((item, index) => (
      <div className="notice" key={index}>
        <Sprout size={19} />
        <span>{item}</span>
      </div>
    ))}

    <p className="subheading">
      <strong>Limitations:</strong> {imageAnalysis.limitations}
    </p>
    <p className="subheading">
      AI assessment is an estimate, not a confirmed plant disease diagnosis.
    </p>
  </div>
)}
  
    <button
      className="primary-btn"
      onClick={runAIAnalysis}
      disabled={aiLoading}
    >
      <Brain size={18} />
      {aiLoading ? "Checking symptoms..." : "Detect Plant Health Issues"}
    </button>

    {aiError && (
      <p className="auth-error">{aiError}</p>
    )}

    {aiResult && (
      <div className="ai-results">
        <h3>Detection Results</h3>

        <div className="reason-list">
          <div>
            <span>Plant</span>
            <strong>{aiResult.plant.name}</strong>
          </div>
          <div>
            <span>Health score</span>
            <strong>{aiResult.analysis.healthScore}/100</strong>
          </div>
          <div>
            <span>Health status</span>
            <strong>{aiResult.analysis.healthStatus}</strong>
          </div>
        </div>

        <h3>Care recommendations</h3>

        {aiResult.analysis.recommendations.map((item, index) => (
          <div className="notice" key={index}>
            <Sprout size={19} />
            <span>
              <strong>{item.category}</strong>
              <br />
              {item.message}
            </span>
          </div>
        ))}
      </div>
    )}
  </section>
)}

{active === "Reminders" && (
  <Reminders plants={plants} onChange={refreshDashboardStats} dateFormat={dateFormat} />
)}

{active === "AI Assistant" && <AIAssistant plants={plants} />}

{active === "Settings" && (
  <section className="panel settings-panel">
    <div className="panel-heading">
      <div>
        <h3>Account and application settings</h3>
        <p>Manage your signed-in account and session.</p>
      </div>
    </div>
    <div className="reason-list">
      <div><span>Name</span><strong>{user.name}</strong></div>
      <div><span>Email</span><strong>{user.email}</strong></div>
      <div><span>Data storage</span><strong>SQLite database</strong></div>
      <div><span>Monitoring</span><strong>Manual care records only</strong></div>
    </div>
    <label className="settings-preference">
      Date and time display
      <select
        value={dateFormat}
        onChange={event => {
          setDateFormat(event.target.value);
          localStorage.setItem("plantGuardianDateFormat", event.target.value);
        }}
      >
        <option value="local">Use this device&apos;s local time</option>
        <option value="utc">UTC</option>
      </select>
    </label>
    <p className="disclaimer">
      Your plant records are stored by the application server. Care tracking does not use physical sensors or automate watering.
    </p>
    <button className="secondary-button" onClick={() => {
      logout();
    }}>
      <LogOut size={17} /> Log out
    </button>
  </section>
)}
          </section>
          {isNative && (
            <nav className="mobile-bottom-nav" aria-label="Main navigation">
              {[
                ["Dashboard", LayoutDashboard],
                ["My Plants", Sprout],
                ["AI Assistant", Brain],
                ["Reminders", Bell]
              ].map(([label, Icon]) => (
                <button
                  type="button"
                  key={label}
                  className={active === label ? "active" : ""}
                  onClick={() => {
                    setActive(label);
                    setMobileMenu(false);
                  }}
                >
                  <Icon size={19} />
                  <span>{label === "My Plants" ? "Garden" : label === "AI Assistant" ? "Assistant" : label}</span>
                </button>
              ))}
              <button
                type="button"
                className={mobileMenu ? "active" : ""}
                onClick={() => setMobileMenu(true)}
              >
                <Menu size={19} />
                <span>More</span>
              </button>
            </nav>
          )}
          <footer>Plant Guardian · Software-based plant care tracking</footer>
        </main>

        {showForm && <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onSubmit={addPlant} onClick={e => e.stopPropagation()}>
            <h2>{editingPlantId ? "Edit plant" : "Add a new plant"}</h2>
            <p>Keep plant profile details up to date for more useful care guidance.</p>
            <label>Plant name
              <input value={plantForm.name} maxLength={120} onChange={e => setPlantForm({ ...plantForm, name: e.target.value })} placeholder="e.g. Aloe Vera" required />
            </label>
            <label>Species
              <input value={plantForm.species} maxLength={120} onChange={e => setPlantForm({ ...plantForm, species: e.target.value })} placeholder="Optional" />
            </label>
            <label>Location
              <select value={plantForm.location} onChange={e => setPlantForm({ ...plantForm, location: e.target.value })}>
                <option>Indoor</option><option>Outdoor</option><option>Balcony</option><option>Greenhouse</option>
              </select>
            </label>
            <label>Sunlight preference
              <input value={plantForm.sunlight_preference} maxLength={120} onChange={e => setPlantForm({ ...plantForm, sunlight_preference: e.target.value })} placeholder="e.g. Bright indirect light" />
            </label>
            <label>Watering interval (days)
              <input type="number" min="1" max="365" value={plantForm.watering_interval_days} onChange={e => setPlantForm({ ...plantForm, watering_interval_days: e.target.value })} required />
            </label>
            <label>Care notes
              <textarea value={plantForm.notes} maxLength={2000} onChange={e => setPlantForm({ ...plantForm, notes: e.target.value })} rows={3} />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-button" disabled={plantSaving}>
                {plantSaving ? "Saving..." : editingPlantId ? "Save changes" : "Add plant"}
              </button>
            </div>
          </form>
        </div>}
      </div>
    );
  }

  function Stat({ icon: Icon, label, value, note }) {
    return <div className="stat-card"><div className="stat-top"><span>{label}</span><Icon size={19} /></div><strong>{value}</strong><small>{note}</small></div>;
  }
  export default App;
