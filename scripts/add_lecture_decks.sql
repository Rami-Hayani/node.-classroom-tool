-- Additive migration for structured PowerPoint lecture decks.
CREATE TABLE IF NOT EXISTS lecture_decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    storage_path TEXT,
    file_type TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lecture_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id UUID NOT NULL REFERENCES lecture_decks(id) ON DELETE CASCADE,
    slide_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    concept_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lecture_decks_course_id ON lecture_decks(course_id);
CREATE INDEX IF NOT EXISTS idx_lecture_slides_deck_id ON lecture_slides(deck_id);

ALTER TABLE lecture_decks ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE lecture_decks ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Native browser PDF viewing. Run this only in Supabase SQL Editor.
INSERT INTO storage.buckets (id, name, public)
VALUES ('lecture-decks', 'lecture-decks', false)
ON CONFLICT (id) DO NOTHING;
