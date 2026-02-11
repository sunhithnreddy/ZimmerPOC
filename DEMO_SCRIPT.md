# ServiceNow Agent Demo Script

---

## Opening (30 seconds)

"What I'm showing you today is a proof of concept for an AI-powered ServiceNow assistant. It combines **natural language understanding**, **real-time ticket search**, and **knowledge graph retrieval** into a single conversational interface."

---

## Demo Flow

### 1. Basic Interaction

**Type:** `Show my open incidents`

**Talk track:**
"Let's start with a simple query. I'm asking for open incidents in natural language."

**Point out:**
- The tool indicator shows which data sources were searched
- Results appear in a familiar ServiceNow table format
- Priority badges (P1/P2/P3) and state indicators
- Real-time timestamps showing when tickets were last updated

---

### 2. Priority Filtering

**Type:** `What P1 tickets need attention?`

**Talk track:**
"Now let's filter for critical issues. The agent understands priority levels and returns only P1 incidents sorted by urgency."

**Point out:**
- Intelligent filtering without writing queries
- The agent provides context in natural language below the table
- Assigned team members are visible for quick escalation

---

### 3. Statistics & Dashboard

**Type:** `What are the current ticket stats?`

**Talk track:**
"For a quick health check, I can ask for aggregate metrics. This pulls from the same data but presents it as a dashboard view."

**Point out:**
- Open incident count
- P1 critical count highlighted in red
- Average resolution time
- Week-over-week trend

---

### 4. Knowledge Base Search

**Type:** `Search knowledge base for Oracle connection issues`

**Talk track:**
"When troubleshooting, the agent can also search our knowledge base. This uses **vector embeddings** to find semantically relevant articles, not just keyword matching."

**Point out:**
- KB article IDs for reference
- Article titles and excerpts
- This would connect to your actual knowledge graph in production

---

### 5. Combined Query (Advanced)

**Type:** `Are there any database-related incidents and how do I troubleshoot them?`

**Talk track:**
"The real power is combining multiple tools in one query. Here the agent searches both tickets AND knowledge base to give a complete answer."

**Point out:**
- Multiple data sources queried automatically
- Contextual response that connects the incident to relevant documentation

---

## Closing (30 seconds)

"This is a **working prototype** built in React and Python. In production, we'd connect this to:
- Your live ServiceNow instance via API
- A vector database like Pinecone for semantic search
- Neo4j for knowledge graph relationships
- Claude or GPT-4 for more sophisticated reasoning

The foundation is here — streaming responses, tool orchestration, and a familiar enterprise UI. Questions?"

---

## Quick Recovery Phrases

If something doesn't work:
- "Let me try a different query..."
- "The prototype is using synthetic data, but the architecture scales to production"

If asked about timeline:
- "The core integration work depends on API access and data mapping"

If asked about security:
- "All queries would go through your existing ServiceNow auth layer"

---

## Queries to Have Ready (copy/paste)

```
Show my open incidents
```

```
What P1 tickets need attention?
```

```
What are the current ticket stats?
```

```
Search knowledge base for Oracle connection issues
```

```
Are there any SAP integration issues?
```

```
Find documentation about SSO authentication
```
