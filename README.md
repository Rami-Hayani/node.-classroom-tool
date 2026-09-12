# node

**Your personal knowledge graph in every lecture.**

A browser-native live classroom that turns lectures into personalized knowledge graphs. Students see their understanding update in real time as polls are answered; professors get a heatmap of class mastery, connected-student presence, and interventions tied to the lecture.

## Features

- **PDF → knowledge graph** — Upload course material; OpenAI extracts concepts and prerequisites (e.g. 35+ nodes from a 200-page textbook). Each student has their own graph; mastery is a confidence score (0–1) driven by polls, tutoring, and attendance.
- **Live classroom intelligence** — Teachers start a live class in the browser; optional transcript input and the demo simulator run through concept detection (OpenAI) and Socket.IO.
- **Contextual polling** — AI generates poll questions from what was just said and targets concepts the class is struggling with. Responses update mastery and graph colors (red → yellow → green) instantly.
- **Aaron (AI tutor)** — Post-lecture Socratic tutor (OpenAI) personalized to each student’s weak nodes; Perplexity Sonar surfaces learning resources (articles, videos) for specific gaps.
- **Study groups** — Match students by complementary strengths/weaknesses and chat about who can teach what.
- **Professor dashboard** — Live heatmap by concept, per-student graphs, and in-lecture reinforcement suggestions (what to re-explain, which examples to add).

## Tech stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js, React, Tailwind CSS, react-force-graph-2d, Socket.IO |
| Backend | Flask (Python), Supabase (PostgreSQL) |
| AI | OpenAI (extraction, questions, tutoring, detection, grading) |
| Live | Socket.IO, optional transcript input, Perplexity Sonar (resources) |
| Deploy | Render (frontend + API + Redis) |

## Prerequisites

- Python 3.10+
- Node.js 18+
- [Supabase](https://supabase.com) project
- API keys: OpenAI, Perplexity

## Installation

```bash
git clone https://github.com/jasonyi33/prereq.git
cd prereq
cp .env.example .env
```

Edit `.env` with `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `PERPLEXITY_API_KEY`, and `FLASK_API_URL` (your Flask API base URL). The service-role key is server-only and is required for trusted profile/course writes. Set `DEMO_MODE=true` only when you explicitly want the transcript simulator and demo auto-responder.

Create the database tables in Supabase (SQL Editor).

## Running locally

**Terminal 1 — Flask API**

```bash
cd api
pip install -r requirements.txt
python app.py
```

Then seed demo data (CS229-style course, ~35 concepts, 4 students):

```bash
python scripts/seed_demo.py
```

**Terminal 2 — Next.js frontend**

```bash
cd frontend
npm install
npm run dev
```

In the professor dashboard, choose a course and click **Start Class**. Students enroll with the course join code, automatically join the active lecture, and receive questions over Socket.IO. Choose a concept in Poll Controls, generate a question, send it to students, and end the class with **End Class**.

## Project structure

```
prereq/
├── api/                 # Flask backend
│   ├── app.py
│   ├── requirements.txt
│   └── ...
├── frontend/            # Next.js + Socket.IO
│   ├── server/          # Express + Socket.IO
│   ├── src/app/         # Pages and API routes
│   ├── src/components/
│   └── ...
├── scripts/             # seed_demo.py, etc.
├── CLAUDE.md            # Dev guide and full schema
├── render.yaml          # Render config
└── .env.example
```

## License

Made at TreeHacks 2026! All rights reserved.
