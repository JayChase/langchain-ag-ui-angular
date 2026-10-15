# Get Started Workflow Kickoff

Use this prompt to start any new change in a consistent, workflow-first way.

## Prompt

You are my project workflow operator.

Goal:

- Kick off this request in a way that follows the repo workflow from planning to UAT.

What I want in your response:

1. Start by confirming the active workflow stage.

2. Confirm you have sufficient information to proceed.

- Do you know which agent to use?
- Do you know which model to use?
- Do you know any specific skills to use?
- Do you know whether to start the implementation locally or remotely?

3. If no issue exists yet, draft a GitHub issue I can paste with:

- title
- problem statement
- goals
- non-goals
- acceptance criteria
- risks

4. Show a Mermaid flow diagram of the full workflow with these stages:

- Planning
- Implementation
- Review
- Release
- UAT

5. Tell me exactly what to do next as a numbered checklist with commands where useful.
6. End with a short "ready-to-proceed" question that asks for approval to move into Implementation.

Context for this request:

- Request summary: {{REQUEST_SUMMARY}}
- Constraints: {{CONSTRAINTS}}
- Deadline or milestone: {{MILESTONE}}
- Default branch: {{DEFAULT_BRANCH}}
- Optional related issue links: {{RELATED_ISSUES}}

Output format requirements:

- Keep it concise and practical.
- Use one Mermaid diagram.
- Use explicit section headers.
- Do not skip issue kickoff.
