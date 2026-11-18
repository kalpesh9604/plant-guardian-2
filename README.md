# Plant Guardian 2.0

Plant Guardian is a software-only plant-care management application. It stores plant profiles, manual care records, reminders, rule-based health assessments, and AI assistant conversations in SQLite. Optional Gemini integrations support text chat and uploaded plant-photo assessment.

## Project goals

- Keep plant profiles and care history in one place.
- Help users plan watering and other care tasks.
- Provide understandable, rule-based symptom and care guidance.
- Offer optional visual assessment while communicating uncertainty.
- Keep all plant data associated with the authenticated account.

No physical sensors, pumps, relays, or IoT hardware are required or controlled.

## Technology

- Frontend: React, Vite, JavaScript, CSS, Lucide React, Recharts
- Backend: Node.js, Express, JWT, bcryptjs, Multer
- Database: SQLite via better-sqlite3
- Optional image assessment: Google Gemini API via `@google/genai`

## Architecture

```text
React browser app
   | same-origin /api requests (Vite development proxy)
   v
Express REST API (default port 5000)
   | JWT-authenticated, user-scoped SQL
   v
SQLite database (server/database/plantguardian.db)

Image assessment: browser -> Multer memory upload -> server-side Gemini API
```

The Gemini key is read only by the backend. The database is initialized automatically when the server starts; existing database files and records are retained.

## Windows PowerShell setup

Use two PowerShell terminals from the project directory.

### 1. Install frontend dependencies

```powershell
cd C:\Projects\plant-guardian
npm.cmd install
```

### 2. Configure and install the backend

```powershell
cd C:\Projects\plant-guardian\server
npm.cmd install
Copy-Item .env.example .env
```

Edit `server\.env` and set a private random `JWT_SECRET` of at least 32 characters. To enable photo assessment and chat, set a valid Google AI Studio `GEMINI_API_KEY`. The default model for both is `gemini-3.1-flash-lite`, which supports image input according to the [official model reference](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite). Override them with `GEMINI_IMAGE_MODEL` or `GEMINI_CHAT_MODEL` if needed. Never commit or share `.env`.

### 3. Start the backend

In the first terminal:

```powershell
cd C:\Projects\plant-guardian\server
npm.cmd run dev
```

The server listens on port 5000 by default. Override with `PORT` if needed. `CORS_ORIGIN` is a comma-separated list of allowed origins for deployments that access the API directly.

### 4. Start the frontend

In a second terminal:

```powershell
cd C:\Projects\plant-guardian
npm.cmd run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to `http://127.0.0.1:5000`, avoiding frontend/backend port mismatches in development. If the backend is hosted elsewhere, set `VITE_API_BASE_URL` before building.

## Android app (Capacitor)

The Android application wraps the existing React/Vite frontend; it does not replace the Express API or bundle Gemini credentials. The app ID is `com.plantguardian.app`.

### Configure the production API

The Android app must reach a running backend over HTTPS. Copy `.env.production.example` to `.env.production` and set `VITE_API_BASE_URL` to the public API base URL, including `/api`:

```powershell
Copy-Item .env.production.example .env.production
```

For example, `https://api.example.com/api`. Do not use `localhost` or a private LAN address in a build intended for users outside that network. If the backend has an explicit `CORS_ORIGIN` setting, include `https://localhost` to allow the Capacitor Android WebView origin. Keep Gemini and JWT secrets only in the backend environment.

### Generate and open the Android project

Install Android Studio and its Android SDK, plus JDK 17. Set `JAVA_HOME` to the JDK root directory (not its `bin` subdirectory). From the project directory:

```powershell
npm.cmd install
npx.cmd cap add android
npx.cmd @capacitor/assets generate --android --iconBackgroundColor "#173b2d" --splashBackgroundColor "#173b2d"
npm.cmd run cap:sync
npx.cmd cap open android
```

`cap add android` is only needed once. Rebuild the React bundle and synchronize it into Android after frontend or native plugin changes with `npm.cmd run cap:sync`. Capacitor's Camera plugin provides the camera/gallery picker; Android local notifications are scheduled for pending reminders after notification permission is granted. These are local notifications, not remote push notifications.

The app requests camera access only when the camera is selected. Gallery selection uses Android's system picker and does not request broad storage access. Android notification permission is requested when a reminder is created.

### Build a debug APK

With the Android SDK and compatible JDK installed and configured:

```powershell
npm.cmd run android:apk
```

The debug APK is written to `android\app\build\outputs\apk\debug\app-debug.apk`. Open the project in Android Studio to run it on an emulator or connected device. The APK and Android build outputs are ignored by Git.

## Application modules

### Authentication

Registration and login use bcrypt password hashes and one-day JWTs. The browser stores the token and signed-in profile in local storage. Logout clears the local session; invalid/expired tokens also clear it.

### Plants

Users can create, view, edit, and delete plant profiles containing name, species, location, sunlight preference, watering interval, and notes. Plant IDs are always scoped to the signed-in user in database operations.

### Care records and monitoring

Watering, fertilizing, pruning, repotting, and general observations are manually recorded. Watering updates the plant's last-watered timestamp in the same SQLite transaction. Monitoring displays saved care data only; it does not fabricate sensor measurements.

### Reminders

Create, list, complete, and delete plant reminders. Each reminder belongs to both a plant and its owner; mutations are restricted to the authenticated user. Overdue status is derived from its due date.

### Dashboard

Statistics, recent activities, watering history, and health summaries are queried from the database. The seven-day watering chart is based on actual saved watering records. Health scores are estimates from the local rule-based assessment, not measured plant states.

### Plant intelligence

The symptom assessment evaluates selected signs against explicit rules and returns a health score and recommendations. Its result is labeled as rule-based; it is not presented as a trained machine-learning model.

Photo assessment accepts JPG, PNG, and WEBP files up to 5 MB. Images are held in memory by Multer and sent to Gemini from the backend. The response includes possible identification, visible evidence, severity, recommendations, and limitations. It is an estimate, not a confirmed diagnosis. If Gemini is unavailable, rule-based symptom analysis remains available.

The AI Assistant stores chat sessions and messages per authenticated user. A chat can optionally include one of that user's plants and its recent care records as context. Conversation history is retained in SQLite until the user deletes it. Gemini remains a server-side dependency; if it is unconfigured or unavailable, the application reports an error instead of fabricating a response.

## Database schema

The server creates these tables if they do not already exist:

- `users`: account name, unique email, bcrypt password hash
- `plants`: owner, plant profile, care interval, last watering
- `care_logs`: owner, plant, activity, observation, notes, timestamp
- `reminders`: owner, plant, task, due date, completion status
- `ai_recommendations`: saved rule-based recommendations
- `ai_chat_sessions`: user-owned assistant conversations and optional plant context
- `ai_chat_messages`: user/assistant messages attached to a conversation

The SQLite database and journal files are excluded from source control; retain backups separately if the data is important.

## REST API

All routes except health and authentication require `Authorization: Bearer <JWT>`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | API and database health |
| `POST` | `/api/auth/register` | Create an account |
| `POST` | `/api/auth/login` | Authenticate and obtain a JWT |
| `GET`, `POST` | `/api/plants` | List or create plants |
| `GET`, `PUT`, `DELETE` | `/api/plants/:id` | Read, update, or delete an owned plant |
| `POST`, `GET` | `/api/care/:plantId` | Record or retrieve care history |
| `GET` | `/api/dashboard/stats` | User-specific counts, history, and assessments |
| `GET`, `POST` | `/api/reminders` | List or create reminders |
| `PATCH` | `/api/reminders/:id/complete` | Complete an owned reminder |
| `DELETE` | `/api/reminders/:id` | Delete an owned reminder |
| `POST` | `/api/ai/:plantId/analyze` | Rule-based symptom assessment |
| `GET` | `/api/ai/:plantId/recommendations` | Read saved recommendations |
| `POST` | `/api/ai/:plantId/image-analysis` | Multipart Gemini photo assessment (`image` field) |
| `GET`, `POST` | `/api/ai/chat/sessions` | List or create an assistant conversation |
| `GET`, `POST` | `/api/ai/chat/sessions/:id/messages` | Read history or send a Gemini chat message |
| `DELETE` | `/api/ai/chat/sessions/:id` | Delete a conversation and its messages |

## Validation and tests

From the project directory:

```powershell
npm.cmd run build
npm.cmd run lint
```

From `server`:

```powershell
node --test
```

The health endpoint can be checked at `http://localhost:5000/api/health`.

## Security notes

- Keep `server/.env` private; `server/.gitignore` excludes it.
- If an API key has been exposed, revoke it in Google AI Studio and replace it in `.env`.
- Use a unique random JWT secret. Replacing the secret invalidates existing sessions.
- Use HTTPS and a restrictive `CORS_ORIGIN` list when deploying.
- Set API quotas and billing limits with the Gemini provider.

## Limitations and future scope

- Gemini availability, quota, network access, and account eligibility are external dependencies. Provider errors are surfaced to the user; no AI result is fabricated.
- Care suggestions rely on saved information and user-selected symptoms. They do not replace expert horticultural diagnosis.
- Reminders are stored in the backend and displayed in-app. Capacitor Android builds can schedule OS local notifications; there is no remote push or email delivery.
- Plant health scores are heuristic, not laboratory or sensor measurements.
- A production deployment should add database backup procedures, account recovery, stronger operational monitoring, and integration tests against an isolated test database.

## Project conclusion

Plant Guardian provides a database-backed workflow for plant profiles, care tracking, reminders, and transparent plant-care guidance, with optional backend-only Gemini image assessment. Its operation does not depend on hardware.
