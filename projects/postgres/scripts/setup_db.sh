docker exec -it postgres-vector psql -U postgres

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE study_plan_docs (
    id SERIAL PRIMARY KEY,
    topic TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding vector(1536)
);

-- Build an HNSW index for high-speed similarity search
CREATE INDEX idx_study_plan_hnsw 
ON study_plan_docs 
USING hnsw (embedding vector_cosine_ops);

SELECT 
    topic, 
    content, 
    1 - (embedding <=> '[0.1, 0.2, 0.3]') AS cosine_similarity
FROM study_plan_docs
ORDER BY embedding <=> '[0.1, 0.2, 0.3]'
LIMIT 3;