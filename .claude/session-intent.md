# Session Intent Contract

**Created:** 2026-04-13

## Job Statement
Build "Rubick Web" — a browser-based chat interface that lets internal users ask natural language questions about Rumah123/iProperty Elasticsearch data and get accurate answers. Replaces the current Claude Desktop + ES MCP setup with a web app anyone on the team can use.

## Success Criteria
- [ ] Users can type natural language questions in a chat UI
- [ ] Backend translates questions to ES queries using pre-loaded context (.md schemas)
- [ ] Results are displayed in a readable chat format
- [ ] Users can select which LLM model to use
- [ ] Simple shared-password authentication for internal access
- [ ] Working MVP — functional, not necessarily polished

## Boundaries
- Internal tool only — no public access, no complex auth
- MVP scope — chat + model selection + ES querying
- No need to upload .md context files — pre-loaded on backend
- Direct LLM API calls — no orchestration frameworks

## Context
- Knowledge: Just starting (need architecture decisions)
- Existing: Empty git repo, 37 context .md files in `/Users/erwin/Downloads/context-md/`
- ES MCP: Already working in Claude Desktop at `http://43.173.29.240:9200`
- Stack: Next.js + direct API calls + shared password auth
