# Azure Redis
1. Port 6380 for TLS (encrypted, default), 6379 for non-TLS (disabled by default in Azure).

## Cache Use Cases
1. **Data Cache**: In-memory database query caching.
2. **Content Cache**: Static content, user session data, and media metadata.
3. **Session Store**: User web sessions across microservices.
4. **Semantic Cache**: Store prompt vector embeddings and LLM answers to bypass repeat OpenAI calls.

## Architecture & Sharding (CROSSSLOT)
1. **Hash Slots**: Redis Clusters horizontally partition data across 16,384 Hash Slots (`0` to `16383`).
2. **Slot Routing**: Key strings are hashed (`CRC16(key) % 16384`) to determine which node/shard stores the key.
3. **CROSSSLOT Error**:
   - Happens when a single command operates on multiple keys (e.g., `MGET key1 key2`, `MSET`, transactions) that live on **different** hash slots across shards.
   - **Does it happen in Azure Cache for Redis?**
     - **Basic / Standard Tiers (Single Shard)**: NO `CROSSSLOT` error because all keys reside on a single primary node.
     - **Premium Tier (OSS Cluster Mode Enabled)**: YES, `CROSSSLOT` errors can happen if keys belong to different slots across shards.
     - **Enterprise Tier (Enterprise Clustering)**: NO for supported multi-key commands (`MGET`, `MSET`, `DEL`, `EXISTS`, `UNLINK`, `TOUCH`) because Azure's Enterprise proxy automatically routes and handles multi-slot queries transparently.
4. **Solution to CROSSSLOT (Hash Tags `{...}`)**:
   - Enclose the shared entity ID in curly braces `{}` within the key name: `{user:1001}:name` and `{user:1001}:orders`.
   - Redis hashes ONLY the content inside `{}` (`user:1001`), guaranteeing both keys land on the exact same hash slot!

## Authentication & Security
1. **Microsoft Entra ID (Managed Identity)**: Passwordless authentication. Obtaind via DefaultAzureCredential to https://redis.azure.com/.default.

```powershell
# Get Access Token for DefaultAzureCredential
$tenantId = "<your-tenant-id>"
$resource = "https://redis.azure.com/.default"
$token = (az account get-access-token --tenant $tenantId --resource $resource).accessToken

# Get Managed Identity Principal ID (for username)
$identity = az identity show --name "<your-managed-identity-name>" --resource-group "<your-resource-group>" --query "principalId" -o tsv

# Redis Connection String Format
# "<redis-host>:6379,password=<access-token>,ssl=True,identity=<principal-id>"
$redisConnectionString = "<redis-hostname>.redis.cache.windows.net:6379,password=$token,ssl=True,identity=$identity"
```

2. **Username**: Set to the Principal ID / Object ID of the Managed Identity.
3. **Password**: Access token fetched via `DefaultAzureCredential`.
4. **Built-in Azure RBAC Data Roles**:
    - **Redis Data Owner**: Full administrative & data access.
    - **Redis Data Contributor**: Read, write, and delete keys (no admin config changes).
    - **Redis Data Reader**: Read-only access (ideal for caching read-only LLM results). Read-only commands (GET, MGET, HGET, etc.).
## High Availability & Disaster Recovery
1. **Active-Passive (Primary/Replica)**: Standard in **Standard & Premium** tiers. 1 primary handles reads/writes, 1 passive replica syncs asynchronously for automatic failover.
2. **Zone Redundancy**: Available in **Premium & Enterprise** tiers. Distributes nodes across multiple Availability Zones in the same region.
3. **Geo-Replication**:
    - **Passive Geo-Replication (Premium Tier)**: Asynchronously links two caches (Primary in Region A, Secondary in Region B) for read-only disaster recovery.
    - **Active-Active Geo-Replication (Enterprise Tier)**: Multi-region active-active writes powered by CRDTs (Conflict-free Replicated Data Types).
4. **SLA & Geo-Replication Summary**:
    - **Basic**: 0% SLA (Single node, no HA, no geo-replication).
    - **Standard**: 99.9% SLA (Primary/Replica, automatic failover).
    - **Premium**: 99.95% SLA (Adds Clustering, Zone Redundancy, Passive Geo-Replication, Persistence).
    - **Enterprise**: Up to 99.99% SLA (Adds Active-Active Geo-Replication, RediSearch, RedisJSON, RedisBloom).

## Azure Redis Tiers Explained
Azure offers two main families of Redis offerings:

### 1. Classic Tiers (Traditional Azure Cache for Redis)
* **Basic**: Single node, no SLA, no persistence, dev/test only.
* **Standard**: 2-node Primary/Replica with failover SLA.
* **Premium**: Enterprise features (Clustering up to 10 shards, Zone Redundancy, Passive Geo-replication, RDB/AOF Persistence, VNet isolation).

### 2. Azure Managed Redis / Enterprise Tiers (Next-Gen Architecture)
Categorized by Hardware & Resource Allocation (Memory vs CPU ratio)
* Everything is under Enterprise Tier. OSS Cluster Mode is toggled on, CROSSSLOT rules is applied.
* **Memory Optimized (M-Series)**: High memory-to-vCPU ratio (8:1). Best for large memory caches with lower throughput needs.
* **Balanced (B-Series)**: Balanced memory-to-vCPU ratio (4:1). Best for standard production workloads.
* **Compute Optimized (C-Series)**: Low memory-to-vCPU ratio (2:1). High throughput & low latency for heavy computation/search workloads.
* **Flash Optimized (E-Series)**: Extends RAM memory into NVMe SSD storage. Cost-effective for massive datasets (RAM + NVMe). *Does not support Active-Active Geo-replication.*

## Commands
1. [Commands](https://learn.microsoft.com/en-us/training/modules/implement-data-operations-azure-managed-redis/4-implement-data-operations?pivots=text)
2. hGet!= mGet, both can fetch multiple keys
    - mGet: you need to provide list of keys. mGet(['user:0001:name', 'user:0002:name'])
    - hGetAll: you need to provide hash key, and return all fields and values. hGetAll('user:0001')
    - hmGet: you need to provide hash key, and one field. hmGet('user:0001', ['name', 'role'])    
    - hGet: you need to provide hash key, and list of fields. hGet('user:0001', 'name')
3. Expire
    - expire: set expire time. r.expire('user:1002:preferences', 300) - expires in 300 seconds
    - expireAt: set expire time at specific time. r.expireAt('user:1002:preferences', 1758227800)
    - ttl: To check when it expires. r.ttl('user:1002:preferences')
    - persist: To make the key persistent. r.persist('user:1002:preferences')
4. Least Recently Used (LRU) / Least Recently Modified (LFM)
    - to enable set `maxmemory 2gb`
    - Net to set monitor of:
        - maxmemory-samples: Default is 5.
    - Set `maxmemory-policy` to either
        - allkeys-lru: Evicts the least recently used keys out of all keys when memory is full. Best for pure cache instances.
        - volatile-lru: Evict LRU keys with TTL set.
        - allkeys-lrm: Evict least recently modified keys
        - volatile-lrm: Evict LRM keys with TTL set
5. Least Frequently Used (LFU) 
    - LRU eviction removes keys that have not been accessed recently.
    - to enable set `maxmemory 2gb`
    - Need to set 
        - lfu-decay-time: Time to decay. Set to 0 means don't decay.
        - lfu-log-factor: How many hits to increment counter (reduce CPU)
        ```
        factor=0:  Counter saturates very quickly
        factor=1:  About 49 after 1,000 hits and saturated by 100,000 hits
        factor=10: About 18 after 1,000 hits and 142 after 100,000 hits (default)
        factor=100: About 11 after 1,000 hits and 49 after 100,000 hits
        ```
    - Set `maxmemory-policy` to either
        - allkeys-lfu: Evicts the least recently used keys out of all keys when memory is full. Best for pure cache instances.
        - volatile-lfu: Evict LFU keys with TTL set.
6. All LFU, LFM and LFU needs to be resetted with new expiry if doesn't want to be evicted. All these policy are based on memory.
7. If there are plans that you want to cache Big memory data, and some are small. Then a new cluster to control both(one for big memory cache, one for smaller) are better approach, as all these LFU, LFM starts to evict small memory keys frequently.
    
Start
  |
  v
Can you tolerate key eviction?
  |
  +-- No --> Use "noeviction"
  |
  +-- Yes
        |
        v
      Need to protect keys without TTL?
        |
        +-- Yes --> Use "volatile-*"
        |
        +-- No --> Use "allkeys-*"
              |
              v
            Do some keys have hot/cold patterns?
              |
              +-- Yes --> Use "*-lfu"
              |
              +-- No --> Is recency important?
                    |
                    +-- Yes --> Use "*-lru"
                    |
                    +-- No --> Use "*-random" or "*-ttl"

## Publish/Subscribe
1. At-most-once delivery. No durability and not guaranteed if subscriber is down.
2. No message persistence. Messages exist only in memory!!
3. Fire-and-forget. Publisher can't track.
4. High throughput. No back-pressure handling, hence dies if too overloaded.
5. Subscribers can use wildcard, ai:conversations:*
6. Does not support distribution. Meaning all subscriber gets the same messages for the same topic; if want Subscriber A, B of same topic to get in sequence A=1,3 and B=2,4 use stream with XGROUP.

## Stream
1. Tasks survive crashes: When your AI service restarts, unprocessed tasks are still in the Stream. Consumer need to send XACK, else persist.
2. Automatic retry handling. Use XPENDING to find stale task and XCLAIM to reclaim.
3. Built-in work distribution: When you scale to multiple workers, Stream consumer groups automatically distribute tasks across instances without duplicate processing.
4. Processing history: You can query what happened in your pipeline, replay processing for debugging. But takes Memory, requires consumer to delete or XTRIM. There is no TTL function.
5. Simple async patterns: Your API handlers can add tasks to Streams and return immediately while background workers process tasks at their own pace.
6. Use XREADGROUP for consumer groups, not XREAD.
7. If need to process at LEAST once, use stream for at-Least-Once delivery (via Streams + XACK + XCLAIM). If need to process at most once, use pub/sub.
8. When reading from a consumer group, the > symbol tells Redis to give you new messages not yet delivered to any consumer.
9. Note: XADD is to send message.
10. XAUTOCLAIM, is transferring from 1 consumer group to a recovery/consumer group, i.e. worker A crash, so move to worker B (Recovery group). Needs this condition:
    1. It has to be consumed but not ACK by XGROUP.
    2. Autoclaim will then wait based on minIdleTimeMs of the message.
    3. If yes, then the message is claimed.
    4. Claim is only to the same group, cannot claim Group B if consumed by Group A.
    5. So now it transfers into a new group. This new group needs to ACK else again it goes in a loop.

XADD (Created) -> XREADGROUP (Worker 1 reads, enters PEL) -> Worker 1 crashes without XACK -> XAUTOCLAIM (Transferred to Worker 2 in PEL) -> Worker 2 finishes task and calls XACK (Removed from PEL permanently). -> PEL ACK

## Synchronous (List)
| Feature | Redis Lists (LPUSH / RPOP) | Redis Streams (XADD / XREADGROUP) | 
| --- | --- | --- |
| Persistence | Deleted instantly upon RPOP | Remains in the stream log until deleted. |
| Crash Recovery | If a worker crashes mid-task, the job is lost forever | Uses pending lists (PEL) and XACK for robust recovery |
| Consumer Groups | No native support | Native support for distributed scaling |
| Best For | Simple, transient job queues or tracking recent items. No ACK or delete. | Mission-critical event sourcing and reliable queues |


1. The "Polling" Problem (RPOP/LPOP/LRANGE/LPUSH/RPUSH/LLEN)
  - If you use the standard RPOP/LPOP command for a job queue, your background worker has to constantly ask Redis, "Are there any new jobs?"
  - If you check every 1 second and the queue is empty, you are making thousands of useless network calls a day.
  - This constant "polling" wastes CPU cycles, consumes network bandwidth, and adds unnecessary load to the database engine.

2. The Solution: BRPOP (Blocking Right Pop)
  - BRPOP solves this inefficiency by putting your connection to sleep.
  - How it works: When your worker executes BRPOP, if the list is empty, Redis intentionally holds the connection open and puts the worker in a waiting state.
  - Instant Wake-Up: The exact millisecond a producer drops a new job into the list using LPUSH, Redis instantly wakes the sleeping worker and hands it the data.
  - Timeouts: It accepts a timeout parameter (e.g., blocking for 5 seconds before waking up to report null, or 0 to block infinitely until a job arrives).

## Pipeline vs Transaction
Pipeline improves performance. But using pipe will not guarantee atomicity. i.e., server crash between two commands in the pipeline will leave partial commands processed. Use Transaction to guarantee atomicity. But use pipeline to improve the performance.

```javascript
const vectorDataList = [
  { id: 'doc:101', topic: 'Cosmos DB', text: 'DiskANN vector search' },
  { id: 'doc:102', topic: 'PostgreSQL', text: 'pgvector extension' },
  { id: 'doc:103', topic: 'Redis', text: 'HNSW in-memory vector index' },
];

// 1. Start a Multi/Pipeline chain
const chain = client.multi(); //In PYTHON this is pipeline()

// 2. Queue multiple operations in memory without awaiting each network call
for (const item of vectorDataList) {
  chain.hSet(item.id, {
    topic: item.topic,
    text: item.text,
  });
}

// 3. Send all queued commands in a single network flush
const results = await chain.execAsPipeline();
// also possible using javascript Promise.all([hset, hset, hset...])
// If use atomiticity
// const results = await chain.exec();
console.log('Pipelined batch complete. Responses:', results);
```
2. Transaction
```javascript
const currentStatus = await client.get('user:session:101');

if (currentStatus === 'active') {
  // Execute transaction atomically
  const results = await client
    .multi()
    .set('user:session:101', 'busy')
    .hSet('user:session:101:meta', { lastActive: Date.now() })
    .exec();
  
  // If another client modified 'user:session:101' while watching, 
  // exec() returns null and the transaction aborts safely.
  if (results === null) {
    console.log('Transaction aborted: Key was modified by another client!');
  }
} else {
  await client.unwatch();
}
```
3. There is no rollback concept.

## Hash vs Json
1. Hash is flat and faster
```
embedding = np.array([0.1, 0.2, 0.3, ...], dtype=np.float32)

redis_client.hset(
    "product:12345",
    mapping={
        "name": "Wireless Mouse",
        "price": "29.99",
        "category": "electronics",
        "embedding": embedding.tobytes()  # Store vector as bytes
    }
)

schema = (
    TextField("name"),
    NumericField("price"),
    TextField("category"),
    VectorField("embedding", "HNSW", {
        "TYPE": "FLOAT32",
        "DIM": 1536,
        "DISTANCE_METRIC": "COSINE"
    })
)

redis_client.ft("idx:products").create_index(
    fields=schema,
    definition=IndexDefinition(
        prefix=["product:"],
        index_type=IndexType.HASH
    )
)
```
2. JSON is more flexible
```
redis_client.json().set(
    "product:12345",
    "$",
    {
        "name": "Wireless Mouse",
        "price": 29.99,
        "category": "electronics",
        "specs": {
            "color": "black",
            "dpi": 1600
        },
        "embedding": embedding.tobytes()
    }
)
```
3. Choose Hash when:
    - Each item has simple, flat fields
    - You prioritize memory efficiency
    - You need maximum query speed
    - Your data model won't need nested objects
    - Vector storage is binary bytes
4. Choose JSON when:
    - Your data has nested structures
    - You need to store multiple vectors per item
    - Your application already uses JSON
    - Flexibility is more important than raw performance
    - Vector storage is numeric array

## AI Query
1. Use KNN
```python
query = (
    Query("*=>[KNN 5 @embedding $query_vec AS score]")
    .return_fields("title", "content", "score")
    .sort_by("score")
    .dialect(2)
)

// return top 3 results.
hybrid_query = Query(
    "@category:{documentation}=>[KNN 3 @embedding $query_vec AS score]"
).return_fields("title", "category", "score").sort_by("score").dialect(2) 

//Give me all products that are at least 80% similar, no matter how many matches exist."
const searchResults = await client.ft.search(
    "idx:products",
    "@embedding:[VECTOR_RANGE 0.25 $query_vec]=>{$YIELD_DISTANCE_AS: score}",
    {
        PARAMS: {
            query_vec: float32Buffer(vectorArray),
        },
        SORTBY: "score", // Optional: sort matching items by closest distance
        DIALECT: 2,
        RETURN: ["key", "name", "score", "category"]
    }
);
```
2. Distance metrics
    - COSINE: Use for text embeddings (OpenAI, Cohere, Sentence Transformers)
    - L2: Use for image embeddings and spatial data
    - IP: Use only for pre-normalized embeddings
3. `EF_RUNTIME`, controls how many graph nodes Redis examines during search—higher values mean more thorough exploration and better accuracy, but slower queries.
```python
query = Query("*=>[KNN 10 @embedding $query_vec EF_RUNTIME 200 AS score]")
```
4. Hybrid search, just replace the *
```javascript
const searchResults = await client.ft.search(
    "idx:products",
    // Replace '*' with '(@category:{Sports})'
    `(@category:{${categoryFilter}})=>[KNN 3 @embedding $query_vec AS score]`,
    {
        PARAMS: {
            query_vec: float32Buffer(vectorArray),
        },
        SORTBY: "score", // Optional: sort matching items by closest distance
        DIALECT: 2,
        RETURN: ["key", "name", "score", "category"]
    }
);

//More Condition
// `(@category:{Sports} @name:Shoes)=>[KNN 3 @embedding $query_vec AS score]`

// Vector add in front
// category:{Sports} @embedding:[VECTOR_RANGE 0.25 $query_vec]=>{$YIELD_DISTANCE_AS: score}
```


Query Type | Redis Syntax | What it returns
---|---|---
Pure KNN | *=>[KNN 3 @embedding $vec AS score] | Top 3 closest items across all documents
Hybrid KNN | (@category:{Sports})=>[KNN 3 @embedding $vec AS score] | Top 3 closest items only within Sports
Pure Range | @embedding:[VECTOR_RANGE 0.2 $vec]=>{$YIELD_DISTANCE_AS: score} | All items within distance $\le 0.2$
Hybrid Range | @category:{Sports} @embedding:[VECTOR_RANGE 0.2 $vec]=>{$YIELD_DISTANCE_AS: score} | All Sports items within distance $\le 0.2$

6. Dialect

Dialect | Introduced
---|---
Dialect 1 | RediSearch 1.x (Default in legacy)
Dialect 2 | RediSearch 2.4 (Have KNN and VECTOR_RANGE)
Dialect 3 | RediSearch 2.6 (Support TAG)
Dialect 4 | RediSearch 2.8+ (Fuzzy search and more)



## Features
1. Use SCAN, Not KEYS (see demonstration).
2. Specialized Scan Commands
    - HSCAN: Iterates through fields and values inside a specific Hash.SSCAN: Iterates through elements inside a specific Set.
    - ZSCAN: Iterates through elements and scores inside a Sorted Set.
3. Key Management & Safety Commands
    - TYPE key: Checks a key's data type before you accidentally run a heavy command on it.
    - MEMORY USAGE key: Reports how much RAM a specific key consumes to find memory hogs.
    - TTL key: Checks how many seconds a key has left before it automatically expires.- FLUSHDB ASYNC: Clears the current database without blocking the server (unlike standard FLUSHDB).
4. Rate limiting, Redis comes with rate-limiting using INCR.
    - Required to increase the key with `client.incr("KEY")`
    - Get the count with `const current = await redisClient.get(key)`
    - to decrease just use a expiry.
    ```javascript
        const redisClient = createClient({
            url: "redis://localhost:6379",
        });

        redisClient.on("error", (err) => console.log("Redis Client Error", err));

        await redisClient.connect();

        // Rate limit: 5 requests per second per IP
        async function rateLimit(ip) {
            const key = `ratelimit:${ip}`;
            const current = await redisClient.get(key);
            if (current && parseInt(current) >= 5) {
                return false; // Block request
            }
            await redisClient.incr(key);
            await redisClient.expire(key, 1); // Reset after 1 second
            return true; // Allow request
        }
    ```

## AI Difference, between RAG and In-Memory Caching
### RAG (Cosmos DB)
1. RAG does not cache answers. It retrieves facts to give the LLM context to write a new answer.
2. The Flow: The user asks a question -> You search Cosmos DB for relevant paragraphs from your PDF -> You send the user's question PLUS the PDF paragraphs to Azure OpenAI -> OpenAI generates a brand-new answer.
3. The Cost: You pay Azure OpenAI for the massive prompt (which includes your PDF text) and the generated response every single time a user asks a question.

### Semantic Caching (Redis)
1. Semantic Caching skips the LLM entirely if the question has been asked recently.
2. The Flow: User A asks "How do I setup Cosmos DB?" -> It goes through the RAG flow above, and you save the LLM's final answer in Redis.
3. The Magic: Ten minutes later, User B asks, "What are the steps to configure Cosmos DB?". Redis recognizes the semantic meaning is identical to User A's question. Redis instantly returns the cached answer to User B.
4. The Cost: You do not call Azure OpenAI at all. You bypass the LLM completely, saving 100% of the token costs and cutting a 2-second LLM wait time down to 10 milliseconds.

### Concept
1. user ask a question, i check in Redis if similar question exists.
2. I store into CosmosDB using RAG architecture.
3. I retrieve from CosmosDB and call OpenAI to get synthesized context.
4. I store into Redis. 
User Asks Question  │
                     └───────────┬───────────┘
                                 │
                 Convert Question to Vector (Embed)
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Check Redis Cache Index│
                    └────────────┬────────────┘
                                 │
                 Is Similarity Score > Threshold?
                 ┌───────────────┴───────────────┐
                 │                               │
             [ YES ]                          [ NO ]
            CACHE HIT                       CACHE MISS
                 │                               │
    Return Cached Answer Directly         1. Search Cosmos DB Knowledge Base
    (Cost: $0 | Latency: ~5ms)           2. Send Chunks + Prompt to OpenAI
                                         3. Get Synthesized LLM Answer
                                         4. SAVE (Question Vector + Answer) to Redis
                                         5. Return Synthesized Answer
