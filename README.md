# Enterprise Service Desk Agent

AI-powered IT service desk with self-service resolution and ticket escalation.

## Features

- **User Portal**: Self-service KB search, auto-resolution suggestions, ticket creation
- **Admin Console**: Ticket management, dashboard metrics, escalation queue
- **Smart Routing**: KB articles delivered before escalation to reduce ticket volume
- **Streaming Responses**: Real-time tool calls and response streaming

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up --build
```

Open http://localhost:3000

### Option 2: Local Development

**Terminal 1 - Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   User Portal   │     │  Admin Console  │
│  (React + Vite) │     │  (React + Vite) │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              ┌──────▼──────┐
              │   FastAPI   │
              │   Backend   │
              └──────┬──────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐ ┌────▼────┐ ┌────▼────┐
    │ Tickets │ │   KB    │ │  Stats  │
    │  Store  │ │ Articles│ │  Cache  │
    └─────────┘ └─────────┘ └─────────┘
```

## User Flow

1. User describes issue in natural language
2. Agent searches KB for matching resolution
3. If found: Display solution with steps + "Didn't solve?" escalation option
4. If escalated: Show ticket form, create ticket, suggest KB while waiting
5. Ticket appears in Admin queue with context

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Main chat endpoint (role: user/admin) |
| `/tickets` | GET | List all tickets |
| `/tickets` | POST | Create new ticket |
| `/tickets/{id}` | GET | Get specific ticket |
| `/escalate` | POST | Escalate ticket to admin |
| `/stats` | GET | Get ticket statistics |
| `/health` | GET | Health check |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8001 | Backend port |
| `ALLOWED_ORIGINS` | localhost | CORS origins |
| `VITE_API_URL` | http://localhost:8001 | Backend URL for frontend |

## Production Deployment

```bash
# Build and run with custom API URL
docker-compose build --build-arg VITE_API_URL=https://api.yourcompany.com
docker-compose up -d
```

## Integration Points

Replace synthetic data with real integrations:

- **Tickets**: ServiceNow REST API
- **KB Search**: Pinecone/Weaviate vector DB
- **Knowledge Graph**: Neo4j for relationship queries
- **LLM**: Claude/GPT-4 for intelligent routing

## Security Fixes Applied

- ✅ XSS prevention (SafeText component)
- ✅ CORS restricted to allowed origins
- ✅ Input validation with Pydantic
- ✅ Non-root Docker user
- ✅ Security headers in nginx

---

Built with Mycelitree patterns.
