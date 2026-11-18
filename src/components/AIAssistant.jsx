import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Bot, MessageCircle, Plus, Send, Trash2, User } from "lucide-react";
import { apiRequest } from "../services/api";
import "./AIAssistant.css";

const suggestedQuestions = [
  "Why are my plant's leaves turning yellow?",
  "How can I tell if the soil is too dry?",
  "What should I check before changing my watering routine?"
];

function AIAssistant({ plants }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedPlantId, setSelectedPlantId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  const loadSessions = useCallback(async () => {
    try {
      const result = await apiRequest("/ai/chat/sessions");
      const nextSessions = result.sessions || [];
      setSessions(nextSessions);
      setSelectedSessionId(current =>
        current && nextSessions.some(session => session.id === current)
          ? current
          : nextSessions[0]?.id || null
      );
      if (nextSessions[0]) {
        setSelectedPlantId(nextSessions[0].plant_id
          ? String(nextSessions[0].plant_id)
          : "");
      }
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSessionId) return undefined;
    let active = true;
    apiRequest(`/ai/chat/sessions/${selectedSessionId}/messages`)
      .then(result => {
        if (active) {
          startTransition(() => setMessages(result.messages || []));
        }
      })
      .catch(requestError => {
        if (active) {
          startTransition(() => setError(requestError.message));
        }
      });
    return () => { active = false; };
  }, [selectedSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingMessage]);

  async function createChat() {
    setCreating(true);
    setError("");
    try {
      const result = await apiRequest("/ai/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          plant_id: selectedPlantId ? Number(selectedPlantId) : null
        })
      });
      setSessions(current => [result.session, ...current]);
      setSelectedSessionId(result.session.id);
      setMessages([]);
      if (selectedSessionId) setDraft("");
      return result.session;
    } catch (requestError) {
      setError(requestError.message);
      return null;
    } finally {
      setCreating(false);
    }
  }

  function selectChat(session) {
    setSelectedSessionId(session.id);
    setSelectedPlantId(session.plant_id ? String(session.plant_id) : "");
    setMessages([]);
    setError("");
  }

  async function deleteChat(sessionId) {
    setError("");
    try {
      await apiRequest(`/ai/chat/sessions/${sessionId}`, { method: "DELETE" });
      const remaining = sessions.filter(session => session.id !== sessionId);
      setSessions(remaining);
      if (selectedSessionId === sessionId) {
        const next = remaining[0] || null;
        setSelectedSessionId(next?.id || null);
        setSelectedPlantId(next?.plant_id ? String(next.plant_id) : "");
        setMessages([]);
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !selectedSessionId || sending) return;

    setSending(true);
    setPendingMessage(text);
    setError("");
    try {
      const result = await apiRequest(
        `/ai/chat/sessions/${selectedSessionId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ message: text })
        }
      );
      setMessages(result.messages || []);
      setSessions(current => [
        result.session,
        ...current.filter(session => session.id !== result.session.id)
      ]);
      setDraft("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPendingMessage("");
      setSending(false);
    }
  }

  const selectedSession = sessions.find(
    session => session.id === selectedSessionId
  );

  return (
    <section className="assistant-layout">
      <aside className="assistant-history panel">
        <div className="assistant-history-heading">
          <div>
            <h2>Conversations</h2>
            <p>Your saved assistant chats</p>
          </div>
          <button
            type="button"
            className="primary-btn assistant-new-chat"
            onClick={createChat}
            disabled={creating || sending}
          >
            <Plus size={16} /> {creating ? "Starting..." : "New chat"}
          </button>
        </div>

        <label className="assistant-plant-select">
          Plant context for new chats
          <select
            value={selectedPlantId}
            onChange={event => setSelectedPlantId(event.target.value)}
          >
            <option value="">General plant-care questions</option>
            {plants.map(plant => (
              <option value={plant.id} key={plant.id}>
                {plant.name}{plant.species ? ` · ${plant.species}` : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="assistant-session-list">
          {loadingSessions ? (
            <p className="activity-empty">Loading conversations...</p>
          ) : sessions.length === 0 ? (
            <p className="activity-empty">Your saved conversations will appear here.</p>
          ) : sessions.map(session => (
            <div
              className={`assistant-session ${selectedSessionId === session.id ? "selected" : ""}`}
              key={session.id}
            >
              <button
                type="button"
                className="assistant-session-select"
                onClick={() => selectChat(session)}
                disabled={sending}
              >
                <strong>{session.title}</strong>
                <small>{session.plant_name || "General plant care"}</small>
              </button>
              <button
                type="button"
                className="assistant-delete"
                title="Delete conversation"
                aria-label={`Delete ${session.title}`}
                onClick={() => deleteChat(session.id)}
                disabled={sending}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="assistant-chat panel">
        <header className="assistant-chat-heading">
          <div className="assistant-bot-icon"><Bot size={20} /></div>
          <div>
            <h2>Plant Guardian Assistant</h2>
            <p>
              {selectedSession?.plant_name
                ? `Personalized for ${selectedSession.plant_name}`
                : "Practical guidance, with uncertainty explained"}
            </p>
          </div>
        </header>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <div className="assistant-messages" aria-live="polite">
          {!selectedSessionId ? (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon"><MessageCircle size={25} /></div>
              <h3>How can I help your garden?</h3>
              <p>Start a new chat to ask a plant-care question. Select one of your plants to add its profile and recent care history as context.</p>
              <div className="assistant-suggestions">
                {suggestedQuestions.map(question => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => setDraft(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="primary-btn"
                onClick={createChat}
                disabled={creating || sending}
              >
                <Plus size={16} /> Start a new chat
              </button>
            </div>
          ) : messages.length === 0 ? (
            <div className="assistant-welcome">
              <div className="assistant-welcome-icon"><MessageCircle size={25} /></div>
              <h3>Ask a question about plant care</h3>
              <div className="assistant-suggestions">
                {suggestedQuestions.map(question => (
                  <button
                    type="button"
                    key={question}
                    onClick={() => setDraft(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="assistant-message-list">
              {messages.map(message => (
                <article
                  className={`assistant-message ${message.role}`}
                  key={message.id}
                >
                  <span className="assistant-message-icon">
                    {message.role === "assistant" ? <Bot size={16} /> : <User size={16} />}
                  </span>
                  <p>{message.content}</p>
                </article>
              ))}
            </div>
          )}

          {pendingMessage && (
            <article className="assistant-message user">
              <span className="assistant-message-icon"><User size={16} /></span>
              <p>{pendingMessage}</p>
            </article>
          )}
          {sending && <p className="assistant-typing">The assistant is thinking…</p>}
          <div ref={messagesEndRef} />
        </div>

        <form className="assistant-composer" onSubmit={sendMessage}>
          <textarea
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={selectedSessionId ? "Ask a plant-care question..." : "Start a new chat first"}
            maxLength={2000}
            rows={2}
            disabled={!selectedSessionId || sending}
            aria-label="Message the plant-care assistant"
          />
          <div className="assistant-composer-footer">
            <small>{draft.length}/2000 · AI guidance may be uncertain</small>
            <button
              type="submit"
              className="primary-btn"
              disabled={!selectedSessionId || !draft.trim() || sending}
            >
              <Send size={16} /> {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

export default AIAssistant;
