# PostgreSQL
1. Has predefined url <server-name>.postgres.database.azure.com
2. Port 5432 for direct connection, need to configure on firewall
3. Port 6432 for PGBounce
4. Don't look for postgres, look for PostgreSQL in msdocs.

## Extensions
Focus on AI
1. *pgvector*: Enables vector data types and similarity search operations. You can store embeddings alongside relational data and perform approximate nearest neighbor searches. The "Implement vector search with Azure PostgreSQL" module covers pgvector in detail.
2. *pg_trgm*: Provides trigram-based text similarity functions. Useful for fuzzy text matching, autocomplete features, and finding similar strings without exact matches.
3. *hstore*: Adds a key-value data type for storing sets of key-value pairs within a single PostgreSQL value. Useful for semi-structured data that doesn't require the full flexibility of JSONB.
4. Extensions need to be planned before creation. Determine whether your application needs vector similarity search (pgvector), full-text search, or geospatial capabilities (PostGIS).

## Compute Tier
1. *Burstable*: Compute tier suitable for workloads with low to moderate CPU usage and intermittent traffic, offering cost-effective scaling for development and testing environments. The CPU is capped at a low baseline (e.g., 10%). When idle, it saves up "CPU credits." When you run a heavy query, it bursts to 100% until the credits run out, and then it heavily throttles you.
2. *General Purpose*: Ideal for business applications requiring balanced CPU and memory resources, providing stable performance for steady workloads. It provides a balanced ratio of vCPUs to Memory (e.g., 4 vCPUs and 16 GB RAM).
4. *Memory Optimized*: Your application benefits from large in-memory caches or performs complex analytical queries. Anything relates to AI is Memory Optimized as calculation of distance needs to be loaded into memory.
5. Tiers can be optimized later.
6. Postgres is created with `az postgres flexible-server create`, single create is already deprecated. Just take it is the only way to create postgres.

# Authentication
1. Uses username/password even for managed identity. Code:
```python
from azure.identity import DefaultAzureCredential

credential = DefaultAzureCredential()
token = credential.get_token("https://ossrdbms-aad.database.windows.net/.default")
# Use token.token as the password in your connection string
```
2. With PostgreSQL, the token you retrieve expires (usually in 1 hour). 
    2.1 The Good: If a connection is already open, PostgreSQL does not drop the active connection when the token expires.
    2.2 The Bad: If your application uses a Connection Pool (like PgBouncer or SQLAlchemy's connection pool), and the pool tries to open a new physical connection to the database 2 hours later using that original connection string, it will fail with an authentication error.
    2.3 To prevent this, must ensure your code fetches a fresh token via credential.get_token()
3. 3 roles - Owner, Contributor and Reader.
4. Data access layer permission is controlled in DB. 
```sql
CREATE ROLE reader_user WITH LOGIN PASSWORD 'secure_password';
-- Grant read-only access to a specific table
GRANT SELECT ON documents TO reader_user;
-- Grant full read/write access to a table
GRANT SELECT, INSERT, UPDATE, DELETE ON documents TO app_writer_role;
-- Enable RLS on the table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- Create a policy where users can only see their own rows
CREATE POLICY user_isolation_policy ON documents 
    FOR SELECT 
    USING (user_id = current_setting('app.current_user_id'));
```   

## SSL modes
1. disable: No encryption. Azure rejects connections using this mode.
2. allow: Encrypts if the server requires it, but doesn't validate certificates.
3. prefer: Encrypts if the server supports it, but doesn't validate certificates.
4. require: Enforces encryption but doesn't validate certificates.
5. verify-ca: Enforces encryption and validates the server certificate against trusted certificate authorities.
6. verify-full: Enforces encryption, validates the CA, and confirms the certificate hostname matches the server.
7. verify-full is recommended for production. Anyway just good to know. Just remember ca/full is a trust-store meaning you verify the server certificate.
8. Connect with `postgresql://user@myserver.postgres.database.azure.com:6432/mydb?sslmode=require` or `postgresql://myuser:mypassword@myserver.postgres.database.azure.com/mydb?sslmode=verify-full&sslrootcert=/etc/ssl/certs/ca-certificates.crt`
9. You still don't need a client certificate. You just need to download Microsoft's public Root CA certificate (a .crt or .pem file provided in the Azure documentation) and bundle it with your application.

## Customer managed keys
1. CMK is for data at rest.
2. Not all compute sizes support CMK. Check the docs?!

## PGBouncer - the connection pool
1. To use connection pool, use pgbouncer.
```bash
az postgres flexible-server parameter set \
    --resource-group myResourceGroup \
    --server-name myserver \
    --name pgbouncer.enabled \
    --value true
```

## Data types for AI applications
1. JSONB: Stores JSON data in a binary format that supports indexing and efficient querying. Use JSONB when data structure varies between records, you need to store nested objects or arrays, or schema flexibility is more important than strict typing. You can query JSONB fields using PostgreSQL's JSON operators.
2. TEXT and VARCHAR: Both store variable-length character strings. TEXT has no length limit, while VARCHAR(n) enforces a maximum. In PostgreSQL, there's no performance difference between TEXT and unconstrained VARCHAR. Use VARCHAR(n) when you want the database to enforce a maximum length.
3. TIMESTAMP WITH TIME ZONE: Always use TIMESTAMPTZ for temporal data in applications that might operate across time zones. PostgreSQL stores timestamps in UTC and converts them based on the session's time zone setting when displaying.
4. BYTEA: Stores binary data as a byte array. Use it for small binary objects that need to be stored alongside relational data. For large binary files, consider Azure Blob Storage with a reference in the database.
5. SERIAL and BIGSERIAL: Pseudo-types that create auto-incrementing integer columns. PostgreSQL automatically creates a sequence and sets the default. Use BIGSERIAL for tables that might exceed two billion rows.

## New queries
1. ILIKE - ignore case like
2. NULLS FIRST / NULLS LAST - used ORDER BY
3. COALESCE - defaults null values (title, 'Untitled')) 
4. Recursive - read https://learn.microsoft.com/en-us/training/modules/build-query-azure-database-postgresql/5-query-data?pivots=text
5. CONFLICT - `ON CONFLICT (user_id, preference_key) DO UPDATE SET preference_value = EXCLUDED.preference_value, updated_at = CURRENT_TIMESTAMP;`
6. JSONB - is json 
    - -> to extract a JSON element as JSON
    - ->> o extract it as text (for comparisons and display).
    - #> returns JSON 
    - #>> returns text
    - Example 'metadata->>'status' extracts the status field as text, while checkpoint_data#>>'{results,0,score}' navigates a nested path to get a specific value.
    - ? checks existance
    - @> test containment
    - `WHERE checkpoint_data @> '{"status": "completed"}'`, or `WHERE metadata ? 'priority'`
    - jsonb_array_elements is for array to extract
7. RETURNING returns value
8. CHECK  - CREATE TABLE tasks ( VARCHAR(2) CHECK (status IN ('pending')))
9. All the magic of hybrid_search - https://learn.microsoft.com/en-us/training/modules/implement-vector-search-azure-database-postgresql/5-run-vector-similarity-search-semantic-retrieval?pivots=text

```sql 
SELECT
    id,
    title,
    (1 - (embedding <=> $1)) * 0.7 +
        ts_rank(to_tsvector('english', content), plainto_tsquery('english', $2)) * 0.3 AS hybrid_score
FROM documents
WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $2)
   OR embedding <=> $1 < 0.5
ORDER BY hybrid_score DESC
LIMIT 10;
```

```sql
    SELECT DISTINCT c.*
FROM conversations c,
     jsonb_array_elements_text(c.metadata->'tags') AS tag
WHERE tag = 'support';
```

```sql
...
WHERE metadata ->> 'author' = 'John' // equivalent to CosmosDB WHERE c.metadata.author = 'John'

SELECT id, (embedding <=> @query) AS distance 
FROM items 
ORDER BY embedding <=> @query 
LIMIT 5;  

/* CosmosDB 
SELECT TOP 5 c.id, VectorDistance(c.embedding, @query) AS score 
FROM c 
ORDER BY VectorDistance(c.embedding, @query)
*

```

```sql
SELECT id, title, embedding <=> $1 AS distance
FROM documents
WHERE embedding <=> $1 < 0.4 -- You cannot use alias in WHERE, because select has not been exec.
ORDER BY embedding <=> $1 -- You can use distance, but caveat is it will scan all and not use IVF or HNSW because it uses select.
LIMIT 10;


-- Dry method, use with
WITH VectorDistances AS (
    SELECT id, title, embedding <=> $1 AS distance
    FROM documents
)
SELECT id, title, distance
FROM VectorDistances
WHERE distance < 0.4
ORDER BY distance
LIMIT 10;
```

## Vector
1. Must enable extension. See [link](https://learn.microsoft.com/en-us/training/modules/implement-vector-search-azure-database-postgresql/2-store-query-embeddings-pgvector?pivots=text)
2. Must indicate field as `vector(1536)`, `CREATE TABLE vector table(embedding vector(1536))`
3. Manipulation of vector fields has to include ::vector.
```sql
INSERT INTO documents (title, content, category, embedding)
VALUES
    ('Document 1', 'Content...', 'legal', '[0.123, 0.33,]'::vector),
```
4. Policy types:
    - <=> = Cosine Distance (Use this for OpenAI text-embedding-3-small/large).
    - <-> = Euclidean Distance (L2) (Use this if you are doing spatial math or older models).
    - <#> = Inner Product.
```sql
SELECT id, title, embedding <-> '[0.0123, -0.0456, ...]'::vector AS distance
FROM documents
ORDER BY distance
LIMIT 10;
```
5. Vector types:
    - vector = 32bit
    - halfvec = 16bit
    - sparsevec = smart, it stores only vector with non 0. * HNSW indexes on sparsevec columns support up to 1,000 non-zero elements. I
6. Vector index have to match with data type, eg
```sql
    -- halfvec type, halfvec index
    CREATE TABLE products (
        id INT PRIMARY KEY,
        name TEXT,
        embedding halfvec(8)
    );

    CREATE INDEX idx_products_halfvec_hnsw ON products USING hnsw (embedding halfvec_cosine_ops);

    -- Select also needs halfvec
    SELECT * FROM products ORDER BY embedding <-> $1::halfvec LIMIT 3

    -- sparsevec type, sparsevec index
    CREATE TABLE products (
        id INT PRIMARY KEY,
        name TEXT,
        embedding sparsevec(1536)
    );
    
    -- IP mean inner product,cosine = cosine distance,L2 = euclidean distance
    CREATE INDEX idx_products_sparsevec_hnsw ON products USING hnsw (embedding sparsevec_ip_ops);


    -- vector type, vector index
    CREATE TABLE products (
        id INT PRIMARY KEY,
        name TEXT,
        embedding vector(1536)
    );

    CREATE INDEX idx_products_vector_hnsw ON products USING hnsw (embedding vector_cosine_ops);

```

## Performance
1. use executeMany for multi line execution
2. COPY is the fastest:
```sql
with cur.copy("COPY messages (conversation_id, role, content) FROM STDIN") as copy:
    for record in records:
        copy.write_row(record)
```
3. Check indexing performance with:
    - pg_stat_user_indexes, if zero scan means user doesn't query it.
    - pg_stat_progress_create_index is used to monitor if index is being created, rebuilt.
    - Use explain index `EXPLAIN ANALYZE`, to check query performance.
    - Create index with `CREATE INDEX CONCURRENTLY`
    - Read here https://learn.microsoft.com/en-us/training/modules/implement-vector-search-azure-database-postgresql/4-manage-index-lifecycle-embedding-updates?pivots=text
4. How explain shows. See there is "idx_products_ivfflat" is being used.
```json
[
  {
    'QUERY PLAN': 'Limit  (cost=1.00..78.46 rows=3 width=540) (actual time=0.038..0.039 rows=1 loops=1)'
  },
  {
    'QUERY PLAN': '  ->  Index Scan using idx_products_ivfflat on products  (cost=1.00..259.20 rows=10 width=540) (actual time=0.037..0.038 rows=1 loops=1)'
  },
  {
    'QUERY PLAN': "        Order By: (embedding <#> '[0.099975586,0.19995117,0.15002441,0.7998047,0.30004883,0.60009766,0.39990234,0.5]'::halfvec)"
  },
  { 'QUERY PLAN': 'Planning Time: 0.017 ms' },
  { 'QUERY PLAN': 'Execution Time: 0.046 ms' }
]
```
5. Cleaning diskspace
```sql
-- Standard vacuum (runs concurrently)
VACUUM documents;

-- Full vacuum (reclaims more space but locks the table)
VACUUM FULL documents;
```
6. What Happens if you create 2 indexes, IVFFlat and HNSW in same table?
    - If you seeded this table with 100,000 vectors and ran a similarity search, PostgreSQL still would not crash. Instead, the Query Planner takes over.
    - Before executing your query, PostgreSQL evaluates the mathematical "cost" of using the HNSW index versus the IVFFlat index.
    - It picks the winner (usually HNSW for pure speed) and completely ignores the loser for that specific query.
    - The Penalty: You still pay the heavy RAM and storage costs to keep both indexes updated every time you insert a new row, even if only one is being used.

### Indexing Vector
1. In vector
    - if not index it's an exact match of KNN (nearest neighbor)
    - if indexed there are options of:
        - IVFFlat - uses cluster concept, cannot be created on empty table
        - Hierarchical Navigable Small World (HNSW) - build when run
2. Plugin index to enable diskAnn (uses memory)
    - only supports *Premium SSD*
    - only for General Purpose / Memory Optimized
    - You need to write
    ```sql
    az postgres flexible-server parameter set \
    --resource-group $rg \
    --server-name $server_name \
    --name azure.extensions \
    --value vector,pg_diskann

    -- First, must enable before DiskANN
    CREATE EXTENSION IF NOT EXISTS vector;

    -- Second, enable Microsoft's DiskANN extension
    CREATE EXTENSION IF NOT EXISTS pg_diskann;

    CREATE INDEX my_documents_diskann_idx 
    ON documents 
    USING diskann (embedding vector_cosine_ops);
    ```
2. If you see "Seq Scan" instead of "Index Scan," check that:
    - The operator class matches the distance operator
    - The index exists and is valid
    - The table has enough rows (PostgreSQL might choose a sequential scan for small tables)
    - The LIMIT clause is present (indexes are most effective with ORDER BY and LIMIT)
3. Vector should be changed frequently if there are insert/update. 

```sql
CREATE INDEX documents_embedding_idx ON documents
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

CREATE INDEX documents_embedding_idx ON documents
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

| Factor | IVFFlat | HNSW |
| ---  |  ---  | --- |
| Query performance | Good | Better |
| Build time | Faster | Slower |
| Memory usage | Lower | Higher |
| Empty table support | No | Yes |
| Insert performance | Fast | Moderate |
| Recall at same latency | Lower | Higher |

Choose HNSW when:

Query performance is your primary concern
You need high recall (99%+) with low latency
Your dataset doesn't change frequently
Memory constraints aren't severe
Choose IVFFlat when:

Memory usage is a concern
You need faster index builds for frequently changing data
You're willing to trade some query performance for lower resource usage
You can tolerate slightly lower recall
    
## Complete this
1. Important, Read about performance [link](https://learn.microsoft.com/en-us/training/modules/optimize-vector-search-azure-database-postgresql/)
2. Integration with azure_ai

```bash
CREATE EXTENSION IF NOT EXISTS azure_ai;

-- 2. Configure azure_ai to talk to your Azure OpenAI endpoint
-- (You get these from the Azure Portal -> OpenAI Resource)
SELECT azure_ai.set_setting('azure_openai.endpoint', 'https://<your-resource-name>.openai.azure.com');
SELECT azure_ai.set_setting('azure_openai.subscription_key', '<your-api-key>');

##
const insertQuery = `
        INSERT INTO study_notes (topic, content, embedding)
        VALUES (
            $1, 
            $2, 
            azure_openai.create_embeddings('text-embedding-ada-002', $2)::vector
        )
    `;
##
```

## Basic DB stuffs
1. DELETE CASCADE
2. Foreign keys
3. Indexing
4. LIMIT with conditional offset

## Geolocation and Disaster Recovery (DR)
1. It's a primary, standby database architecture. One needs to be dormant. There is also a primary, secondary(read-only) and Azure let's 5 readonly, catch is that the url has to be handled with code (no unified url).
2. High Availability (Same Region)
    - If you enable High Availability, Azure provisions a second standby PostgreSQL server in a different Availability Zone within the same region (e.g., Zone 1 and Zone 2). It uses Synchronous Replication. If the primary VM crashes, Azure automatically repoints your connection string to the standby server with zero data loss.
3. Disaster Recovery (Cross-Region Backups)
    - By default, backups are kept locally. For DR, you configure Geo-redundant backups. Azure continuously ships your database backups to a paired region (e.g., East US to West US). If East US is destroyed by a hurricane, you can restore a new Flexible Server in West US using those backups. (This has a higher Recovery Time Objective).
4. Geolocation (Cross-Region Read Replicas)
    - If you have users in Europe, but your database is in the US, you can spin up a Read Replica in Europe. Azure uses native PostgreSQL Asynchronous Replication to stream data changes to Europe.
    - The Catch: The Europe server is Read-Only. All inserts/updates must still travel across the ocean to the primary US server. If the US goes down, you can manually "Promote" the European Read Replica to become the new primary writable database.

    