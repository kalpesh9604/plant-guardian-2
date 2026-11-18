import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Bell, Check, Trash2 } from "lucide-react";
import { apiRequest } from "../services/api";
import { formatDateTime } from "../services/formatDate";

function getNotification(reminder) {
  return {
    id: Number(reminder.id),
    title: "Plant care reminder",
    body: `${reminder.plant_name} · ${reminder.reminder_type}`,
    schedule: {
      at: new Date(reminder.due_at)
    },
    isExactNotification: false,
    extra: { reminderId: Number(reminder.id) }
  };
}

async function scheduleReminderNotification(reminder, plantName) {
  const dueDate = new Date(reminder.due_at);
  if (!Number.isFinite(dueDate.getTime()) || dueDate <= new Date()) return true;

  const permission = await LocalNotifications.checkPermissions();
  const display = permission.display === "granted"
    ? permission.display
    : (await LocalNotifications.requestPermissions()).display;

  if (display !== "granted") return false;

  await LocalNotifications.schedule({
    notifications: [
      getNotification({
        ...reminder,
        plant_name: reminder.plant_name || plantName || "Your plant"
      })
    ]
  });
  return true;
}

function getLocalDateTimeValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function Reminders({ plants, onChange, dateFormat }) {
  const [reminders, setReminders] = useState([]);
  const [reminderType, setReminderType] = useState("watering");
  const [plantId, setPlantId] = useState(plants[0]?.id || "");
  const [dueAt, setDueAt] = useState(() =>
    getLocalDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isNative = Capacitor.isNativePlatform();
  const selectedPlantId = plants.some(plant => plant.id === Number(plantId))
    ? plantId
    : plants[0]?.id || "";

  const loadReminders = useCallback(async () => {
    try {
      const result = await apiRequest("/reminders");
      const currentReminders = result.reminders || [];
      setReminders(currentReminders);
      if (isNative) {
        const permission = await LocalNotifications.checkPermissions();
        const pending = currentReminders.filter(reminder =>
          reminder.status === "pending" && new Date(reminder.due_at) > new Date()
        );
        if (permission.display === "granted" && pending.length) {
          await LocalNotifications.schedule({
            notifications: pending.map(getNotification)
          });
        }
      }
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [isNative]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  async function createReminder(event) {
    event.preventDefault();
    if (!selectedPlantId || !dueAt) return;

    setSaving(true);
    try {
      const result = await apiRequest("/reminders", {
        method: "POST",
        body: JSON.stringify({
          plant_id: Number(selectedPlantId),
          reminder_type: reminderType,
          due_at: new Date(dueAt).toISOString()
        })
      });
      await loadReminders();
      await onChange?.();
      if (isNative) {
        try {
          const scheduled = await scheduleReminderNotification(
            result.reminder,
            plants.find(plant => plant.id === Number(selectedPlantId))?.name
          );
          if (!scheduled) {
            setError("Reminder saved, but notifications are disabled. Enable them in Android settings.");
          }
        } catch (notificationError) {
          setError(`Reminder saved, but its notification could not be scheduled: ${notificationError.message}`);
        }
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateReminder(id, action) {
    setLoading(true);
    try {
      if (action === "complete") {
        await apiRequest(`/reminders/${id}/complete`, { method: "PATCH" });
      } else {
        await apiRequest(`/reminders/${id}`, { method: "DELETE" });
      }
      let notificationError = "";
      if (isNative) {
        try {
          await LocalNotifications.cancel({ notifications: [{ id: Number(id) }] });
        } catch (cancelError) {
          notificationError = cancelError.message;
        }
      }
      await loadReminders();
      await onChange?.();
      if (notificationError) {
        setError(`Reminder updated, but its notification could not be canceled: ${notificationError}`);
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <section className="panel reminders-panel">
      <div className="panel-heading">
        <div>
          <h3><Bell size={19} /> Plant care reminders</h3>
          <p>Schedule and track care tasks for your plants.</p>
        </div>
      </div>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <form className="reminder-form" onSubmit={createReminder}>
        <label>
          Plant
          <select
            value={selectedPlantId}
            onChange={event => setPlantId(event.target.value)}
            disabled={!plants.length}
            required
          >
            {plants.map(plant => (
              <option value={plant.id} key={plant.id}>{plant.name}</option>
            ))}
          </select>
        </label>
        <label>
          Care task
          <select value={reminderType} onChange={event => setReminderType(event.target.value)}>
            <option value="watering">Watering</option>
            <option value="fertilizing">Fertilizing</option>
            <option value="pruning">Pruning</option>
            <option value="general">General</option>
          </select>
        </label>
        <label>
          Due date and time
          <input
            type="datetime-local"
            value={dueAt}
            onChange={event => setDueAt(event.target.value)}
            required
          />
        </label>
        <button className="primary-btn" type="submit" disabled={!plants.length || saving}>
          {saving ? "Saving..." : "Add reminder"}
        </button>
      </form>

      <div className="reminder-list" aria-live="polite">
        {loading ? (
          <p className="activity-empty">Loading reminders...</p>
        ) : reminders.length === 0 ? (
          <p className="activity-empty">No reminders yet. Add a task above.</p>
        ) : reminders.map(reminder => {
          const overdue = Boolean(reminder.is_overdue);
          return (
            <article className="reminder-item" key={reminder.id}>
              <div className="activity-icon"><Bell size={17} /></div>
              <div className="reminder-details">
                <strong>{reminder.plant_name} · {reminder.reminder_type}</strong>
                <small>{formatDateTime(reminder.due_at, dateFormat)}</small>
              </div>
              <span className={`status ${reminder.status === "completed" ? "good" : overdue ? "warning" : ""}`}>
                {reminder.status === "completed" ? "Completed" : overdue ? "Overdue" : "Pending"}
              </span>
              {reminder.status === "pending" && (
                <button type="button" className="icon-button" title="Mark completed" onClick={() => updateReminder(reminder.id, "complete")}>
                  <Check size={17} />
                </button>
              )}
              <button type="button" className="icon-button" title="Delete reminder" onClick={() => updateReminder(reminder.id, "delete")}>
                <Trash2 size={17} />
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default Reminders;
