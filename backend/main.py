"""Enterprise Service Desk Agent - Backend (Claude-powered)"""
import asyncio
import json
import os
import uuid
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List

import anthropic

# Load .env from mycelitree root
env_path = Path(__file__).resolve().parents[2] / ".env"
if not env_path.exists():
    env_path = Path(__file__).resolve().parents[3] / ".env"
load_dotenv(env_path)

# Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
MODEL = "claude-sonnet-4-5-20250929"

if not ANTHROPIC_API_KEY:
    raise RuntimeError(f"ANTHROPIC_API_KEY not found. Checked: {env_path}")

client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

app = FastAPI(title="Enterprise Service Desk Agent", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"]
)

# =============================================================================
# Data Models
# =============================================================================

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    role: str = Field(default="user", pattern="^(user|admin)$")

class TicketCreateRequest(BaseModel):
    subject: str = Field(..., min_length=5, max_length=200)
    description: str = Field(..., min_length=10, max_length=2000)
    priority: str = Field(default="P3", pattern="^(P1|P2|P3)$")
    requester_email: str = Field(..., pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")

class EscalationRequest(BaseModel):
    ticket_id: str
    reason: str = Field(..., min_length=10, max_length=500)

# =============================================================================
# In-Memory Data Store
# =============================================================================

TICKETS = [
    {"id": "INC0012847", "subject": "SAP integration failing for warehouse module", "priority": "P1", "status": "In Progress", "assigned": "Chen, Michael", "created": "2024-01-15", "category": "Infrastructure", "updated": "2 hours ago", "requester": "john.smith@company.com", "resolution": None},
    {"id": "INC0012901", "subject": "EDI 850 purchase orders not processing", "priority": "P2", "status": "Open", "assigned": "Rodriguez, Ana", "created": "2024-01-16", "category": "Data Integration", "updated": "45 min ago", "requester": "jane.doe@company.com", "resolution": None},
    {"id": "INC0012955", "subject": "SSO authentication timeout for Salesforce", "priority": "P1", "status": "Open", "assigned": "Patel, Raj", "created": "2024-01-17", "category": "Access", "updated": "12 min ago", "requester": "bob.wilson@company.com", "resolution": None},
    {"id": "INC0013002", "subject": "Power BI dashboard refresh failure", "priority": "P3", "status": "Resolved", "assigned": "Thompson, Sarah", "created": "2024-01-14", "category": "Analytics", "updated": "1 day ago", "requester": "alice.jones@company.com", "resolution": "Refreshed dataset credentials and updated gateway connection."},
    {"id": "INC0013089", "subject": "Azure ML endpoint latency exceeded SLA", "priority": "P2", "status": "In Progress", "assigned": "Kim, David", "created": "2024-01-17", "category": "ML/AI", "updated": "3 hours ago", "requester": "charlie.brown@company.com", "resolution": None},
    {"id": "INC0013145", "subject": "Oracle DB connection pool exhausted", "priority": "P1", "status": "Open", "assigned": "Garcia, Maria", "created": "2024-01-17", "category": "Database", "updated": "5 min ago", "requester": "diana.prince@company.com", "resolution": None},
]

KB_ARTICLES = [
    {"id": "KB0001234", "title": "SAP Integration Troubleshooting Guide", "excerpt": "Common issues with RFC connections and BAPI calls. Check transaction SM59 for connection status and verify user authorizations in SU01.", "tags": ["sap", "integration", "rfc", "warehouse"], "steps": ["1. Open SAP GUI and run transaction SM59", "2. Check RFC connection status", "3. Verify user has required authorizations in SU01", "4. Test connection and review logs"]},
    {"id": "KB0001567", "title": "EDI Transaction Processing Overview", "excerpt": "EDI 850/855/856 processing flow through Sterling B2B. Includes partner profile setup and map configuration requirements.", "tags": ["edi", "850", "purchase", "orders"], "steps": ["1. Check partner profile in Sterling B2B", "2. Verify map configurations are active", "3. Review transaction logs for errors", "4. Reprocess failed transactions"]},
    {"id": "KB0001890", "title": "SSO Authentication and Password Reset", "excerpt": "Azure AD B2C integration with SAML 2.0 and OAuth 2.0. Includes self-service password reset flow and MFA enrollment procedures.", "tags": ["sso", "password", "reset", "authentication", "login", "mfa"], "steps": ["1. Navigate to https://passwordreset.company.com", "2. Enter your email address", "3. Complete MFA verification", "4. Set new password meeting complexity requirements"]},
    {"id": "KB0002103", "title": "Oracle Database Connection Guide", "excerpt": "Recommended settings for HikariCP and Oracle UCP. Includes monitoring queries, connection pool tuning, and alert thresholds.", "tags": ["oracle", "database", "connection", "pool", "db"], "steps": ["1. Check current pool size: SELECT * FROM V$SESSION", "2. Identify blocking sessions", "3. Increase pool size if needed in application.properties", "4. Restart application server"]},
    {"id": "KB0002456", "title": "VPN and Remote Access Setup", "excerpt": "Configure Cisco AnyConnect for remote access. Includes troubleshooting steps for connection failures and split tunneling.", "tags": ["vpn", "remote", "access", "cisco", "network"], "steps": ["1. Download Cisco AnyConnect from IT portal", "2. Install and restart computer", "3. Connect to vpn.company.com", "4. Enter credentials and complete MFA"]},
    {"id": "KB0002789", "title": "Email Not Syncing on Mobile", "excerpt": "Troubleshoot Outlook mobile app sync issues. Covers account re-authentication and cache clearing.", "tags": ["email", "outlook", "mobile", "sync", "phone"], "steps": ["1. Remove account from Outlook app", "2. Clear app cache and data", "3. Re-add account with company email", "4. Allow 5-10 minutes for initial sync"]},
]

ESCALATIONS = []

# =============================================================================
# Tool definitions for Claude
# =============================================================================

TOOLS = [
    {
        "name": "search_tickets",
        "description": "Search the IT service desk ticket system. Returns matching incidents/tickets with priority, status, assignee, and other details. Use this when the user asks about tickets, incidents, issues, problems, or wants to see open/escalated items.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query describing what tickets to find"
                },
                "status_filter": {
                    "type": "string",
                    "description": "Optional status filter: Open, In Progress, Resolved, Escalated",
                    "enum": ["Open", "In Progress", "Resolved", "Escalated"]
                },
                "priority_filter": {
                    "type": "string",
                    "description": "Optional priority filter",
                    "enum": ["P1", "P2", "P3"]
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "search_knowledge_base",
        "description": "Search the knowledge base for troubleshooting guides, how-to articles, and resolution steps. Use this when the user needs help with an IT issue, asks how to do something, or needs documentation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search query describing the topic or issue"
                }
            },
            "required": ["query"]
        }
    },
    {
        "name": "get_ticket_statistics",
        "description": "Get aggregate ticket statistics: open count, P1/P2 counts, average resolution time, and week-over-week trend. Use this when the user asks for stats, dashboards, metrics, or a summary overview.",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }
]

# =============================================================================
# Search Functions
# =============================================================================

TITLE_MATCH_WEIGHT = 2
TAG_MATCH_WEIGHT = 3
EXCERPT_MATCH_WEIGHT = 1
BASE_RELEVANCE = 0.6
RELEVANCE_INCREMENT = 0.15
MAX_RELEVANCE = 0.95


def search_tickets_fn(query: str, status_filter: str = None, priority_filter: str = None) -> list:
    """Search tickets with relevance scoring"""
    query_lower = query.lower()
    query_words = query_lower.split()
    results = []

    for t in TICKETS:
        if status_filter and t["status"].lower() != status_filter.lower():
            continue
        if priority_filter and t["priority"] != priority_filter:
            continue

        score = sum(1 for word in query_words if word in t["subject"].lower() or word in t["category"].lower())

        if score > 0 or any(kw in query_lower for kw in ["ticket", "incident", "issue", "problem", "open", "p1", "priority", "my", "all", "show", "list"]):
            relevance = min(MAX_RELEVANCE, BASE_RELEVANCE + score * RELEVANCE_INCREMENT)
            results.append({**t, "relevance": relevance})

    return sorted(results, key=lambda x: (x["priority"], -x.get("relevance", 0)))[:5]


def search_kb_fn(query: str) -> list:
    """Search knowledge base with weighted scoring"""
    query_lower = query.lower()
    query_words = [w for w in query_lower.split() if len(w) > 2]
    results = []

    for kb in KB_ARTICLES:
        score = 0
        for word in query_words:
            if word in kb["title"].lower():
                score += TITLE_MATCH_WEIGHT
            if word in kb.get("tags", []):
                score += TAG_MATCH_WEIGHT
            if word in kb["excerpt"].lower():
                score += EXCERPT_MATCH_WEIGHT
        if score > 0:
            results.append({**kb, "score": score})

    return sorted(results, key=lambda x: x["score"], reverse=True)[:3]


def get_ticket_stats_fn() -> dict:
    """Calculate ticket statistics"""
    return {
        "total_open": len([t for t in TICKETS if t["status"] != "Resolved"]),
        "p1_count": len([t for t in TICKETS if t["priority"] == "P1" and t["status"] != "Resolved"]),
        "p2_count": len([t for t in TICKETS if t["priority"] == "P2" and t["status"] != "Resolved"]),
        "avg_resolution_time": "4.2 hours",
        "trend": "↓ 12%"
    }


def execute_tool(name: str, input_data: dict):
    """Execute a tool by name and return the result"""
    if name == "search_tickets":
        return search_tickets_fn(
            input_data["query"],
            input_data.get("status_filter"),
            input_data.get("priority_filter")
        )
    elif name == "search_knowledge_base":
        return search_kb_fn(input_data["query"])
    elif name == "get_ticket_statistics":
        return get_ticket_stats_fn()
    return {"error": f"Unknown tool: {name}"}

# =============================================================================
# Claude-Powered Response Generator
# =============================================================================

SYSTEM_PROMPT_ADMIN = """You are an AI-powered IT service desk assistant for enterprise administrators. You have access to tools to search tickets, knowledge base articles, and view statistics.

Guidelines:
- Be concise and professional
- Use **bold** for ticket IDs, counts, and key metrics
- When showing ticket results, provide a brief summary — the raw data will be displayed separately in context cards
- When showing stats, summarize the key numbers — the dashboard will render separately
- For KB articles, highlight the most relevant article and key steps
- If multiple tools are relevant, use all of them to give a comprehensive answer
- Always reference ticket IDs (e.g. **INC0012847**) when discussing specific incidents"""

SYSTEM_PROMPT_USER = """You are a friendly IT help desk assistant for end users. You help employees resolve IT issues through self-service when possible, or help them create support tickets when needed.

Guidelines:
- Be warm, clear, and helpful
- Use **bold** for important items like article titles and ticket IDs
- When a KB article matches, encourage the user to try the resolution steps first
- If no solution is found, offer to create a support ticket
- Keep responses concise — 2-3 sentences max
- The resolution steps and KB articles will be displayed in separate cards, so just reference them"""


async def generate_claude_response(message: str, role: str):
    """Generate a Claude-powered streaming response with tool use"""
    system_prompt = SYSTEM_PROMPT_ADMIN if role == "admin" else SYSTEM_PROMPT_USER

    messages = [{"role": "user", "content": message}]

    # First call: let Claude decide which tools to use
    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system_prompt,
        tools=TOOLS,
        messages=messages,
    )

    tools_used = []
    tool_results = []
    context_cards = []
    final_text = ""

    # Process the response — handle tool use loop
    while response.stop_reason == "tool_use":
        # Collect all tool uses from this response
        assistant_content = response.content
        tool_use_results = []

        for block in assistant_content:
            if block.type == "tool_use":
                tool_name = block.name
                tool_input = block.input
                tool_id = block.id

                # Map tool names for the frontend
                tools_used.append(tool_name)

                # Execute the tool
                result = execute_tool(tool_name, tool_input)

                # Build context card for frontend
                if tool_name == "search_tickets":
                    context_cards.append(("tickets", result))
                elif tool_name == "search_knowledge_base":
                    if result:
                        context_cards.append(("kb_articles", result))
                elif tool_name == "get_ticket_statistics":
                    context_cards.append(("stats", result))

                tool_use_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": json.dumps(result),
                })

        # Send tool results back to Claude for the final response
        messages.append({"role": "assistant", "content": assistant_content})
        messages.append({"role": "user", "content": tool_use_results})

        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=system_prompt,
            tools=TOOLS,
            messages=messages,
        )

    # Extract final text
    for block in response.content:
        if hasattr(block, "text"):
            final_text += block.text

    # --- Stream everything to the frontend in the existing SSE protocol ---

    # 1. Stream tool indicators
    if tools_used:
        yield f"data: {json.dumps({'type': 'tools', 'tools': tools_used})}\n\n"
        await asyncio.sleep(0.1)

    # 2. Stream context cards
    for ctx_type, ctx_data in context_cards:
        yield f"data: {json.dumps({'type': 'context', 'context_type': ctx_type, 'data': ctx_data})}\n\n"
        await asyncio.sleep(0.1)

    # 3. Stream response text token-by-token
    words = final_text.split()
    for word in words:
        yield f"data: {json.dumps({'type': 'token', 'content': word + ' '})}\n\n"
        await asyncio.sleep(0.02)

    # 4. For user role: offer escalation if no KB results found
    if role == "user" and not any(ct == "kb_articles" for ct, _ in context_cards):
        yield f"data: {json.dumps({'type': 'action', 'action': 'show_escalate_option'})}\n\n"
    elif role == "user" and any(ct == "kb_articles" for ct, _ in context_cards):
        yield f"data: {json.dumps({'type': 'action', 'action': 'show_escalate_option'})}\n\n"

    yield f"data: {json.dumps({'type': 'done'})}\n\n"

# =============================================================================
# Ticket Management
# =============================================================================

def create_ticket(request: TicketCreateRequest) -> dict:
    ticket_id = f"INC{str(uuid.uuid4().int)[:7]}"
    new_ticket = {
        "id": ticket_id,
        "subject": request.subject,
        "priority": request.priority,
        "status": "Open",
        "assigned": "Unassigned",
        "created": datetime.now().strftime("%Y-%m-%d"),
        "category": "General",
        "updated": "Just now",
        "requester": request.requester_email,
        "resolution": None,
        "description": request.description
    }
    TICKETS.insert(0, new_ticket)
    return new_ticket


def escalate_ticket(ticket_id: str, reason: str) -> dict:
    escalation = {
        "id": f"ESC{str(uuid.uuid4().int)[:7]}",
        "ticket_id": ticket_id,
        "reason": reason,
        "created": datetime.now().isoformat(),
        "status": "Pending Review"
    }
    ESCALATIONS.append(escalation)
    for t in TICKETS:
        if t["id"] == ticket_id:
            t["status"] = "Escalated"
            t["updated"] = "Just now"
            break
    return escalation


def find_resolution(query: str) -> dict:
    kb_results = search_kb_fn(query)
    if kb_results:
        best_match = kb_results[0]
        return {"found": True, "article": best_match, "confidence": min(0.95, best_match["score"] / 10)}
    return {"found": False, "article": None, "confidence": 0}

# =============================================================================
# API Endpoints
# =============================================================================

@app.post("/chat")
async def chat(request: ChatRequest):
    """Main chat endpoint - Claude-powered with tool use"""
    return StreamingResponse(
        generate_claude_response(request.message, request.role),
        media_type="text/event-stream"
    )


@app.post("/tickets")
async def create_ticket_endpoint(request: TicketCreateRequest):
    ticket = create_ticket(request)
    resolution = find_resolution(f"{request.subject} {request.description}")
    return {
        "ticket": ticket,
        "suggested_resolution": resolution["article"] if resolution["found"] else None,
        "message": f"Ticket {ticket['id']} created successfully."
    }


@app.post("/escalate")
async def escalate_endpoint(request: EscalationRequest):
    escalation = escalate_ticket(request.ticket_id, request.reason)
    return {
        "escalation": escalation,
        "message": f"Ticket {request.ticket_id} has been escalated. An admin will review shortly."
    }


@app.get("/tickets")
async def list_tickets(status: str = None):
    if status:
        return [t for t in TICKETS if t["status"].lower() == status.lower()]
    return TICKETS


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str):
    for t in TICKETS:
        if t["id"] == ticket_id:
            return t
    raise HTTPException(status_code=404, detail="Ticket not found")


@app.get("/escalations")
async def list_escalations():
    return ESCALATIONS


@app.get("/stats")
async def get_stats():
    return get_ticket_stats_fn()


@app.get("/health")
async def health():
    return {"status": "ok", "service": "enterprise-service-desk", "version": "2.0.0", "model": MODEL}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    print(f"Starting Enterprise Service Desk Agent v2.0 (Claude: {MODEL})")
    print(f"API key loaded from: {env_path}")
    uvicorn.run(app, host="0.0.0.0", port=port)
