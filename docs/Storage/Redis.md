# Azure Redis
1. Port 10000 for TLS, 6739 for HTTP.

## Cache
1. Data cache
2. Content cache
3. Session store

## Architecture
1. A standard Redis Cluster horizontally partitions your data across multiple physical servers (nodes).
2. It achieves this by dividing the database into exactly 16,384 Hash Slots.
3. When you save a key, Redis runs a mathematical hash on the string (e.g., "user:0001:name") to determine which of those 16,384 slots it belongs to, routing it to the corresponding server.
4. CROSSSLOT - If you execute `MGET user:1 user:2`, the mathematical hash for user:1 might assign it to Hash Slot 500 (living on Server A), while user:2 hashes to Slot 14,000 (living on Server B). Redis strictly requires all keys in a single command to reside on the same server to guarantee atomicity. Encountering a CROSSSLOT error means your keys are scattered across the cluster, forcing the client to either re-route commands or use pipeline/batch commands to ensure atomicity.
    - *Enterprise clustering* - allows these commands across slots: DEL, MSET, MGET, EXISTS, UNLINK, and TOUCH. 
    - *Active-Active* databases, only MGET, EXISTS, and TOUCH work across slots. For more information, see Database clustering.

## Authentication
1. Similar to Postgres.
2. Username: You pass the exact Object ID (Principal ID) of your Managed Identity.
3. Password: You use DefaultAzureCredential to fetch a raw Entra ID token string and pass it as the password.
4. Azure intercepts this login, verifies the token with Entra ID, and grants access.
5. Control access
    - Data Owner: Full administrative access to all keys and commands.
    - Data Contributor: Can read, write, and delete keys, but cannot modify administrative settings.
    - Data Reader: Strictly read-only access (perfect for a frontend container just querying a cached LLM response).

## High Availability
1. Active-Passive: Azure Redis Cache uses active-passive clustering. In this model, one node acts as the active node, handling all read and write operations, while the other node remains idle as a passive replica. If the active node fails, the passive node automatically takes over as the new active node.
2. Geo-replication: Geo-replication allows you to replicate your Redis cache to a different Azure region, providing disaster recovery capabilities. It uses an active-secondary replication model, where the primary cache is the active node and the secondary cache is the passive node. Data is asynchronously replicated from the primary to the secondary cache.
3. Zone Redundancy: Zone-redundant caches distribute data across multiple Availability Zones within the same region, ensuring high availability even if one zone experiences an outage.

## Tier
1. Three tiers store **in-memory** data:
    - Memory Optimized Ideal for memory-intensive use cases that require a high memory-to-vCPU ratio (8:1) but don't need the highest throughput performance. It provides a lower price point for scenarios where less processing power or throughput is necessary, making it an excellent choice for development and testing environments.
    - Balanced (Memory + Compute) Offers a balanced memory-to-vCPU (4:1) ratio, making it ideal for standard workloads. This tier provides a healthy balance of memory and compute resources.
    - Compute Optimized Designed for performance-intensive workloads requiring maximum throughput, with a low memory-to-vCPU (2:1) ratio. It's ideal for applications that demand the highest performance.
2. One tier stores data both in-memory and **on-disk**:
    - Flash Optimized (preview) Enables Redis clusters to automatically move less frequently accessed data from memory (RAM) to NVMe storage. This reduces performance, but allows for cost-effective scaling of caches with large datasets.
    - Has no *Active-Active* support

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



## Notes
1. Use SCAN, Not KEYS (see demonstration).
2. Specialized Scan Commands
    - HSCAN: Iterates through fields and values inside a specific Hash.SSCAN: Iterates through elements inside a specific Set.
    - ZSCAN: Iterates through elements and scores inside a Sorted Set.
3. Key Management & Safety Commands
    - TYPE key: Checks a key's data type before you accidentally run a heavy command on it.
    - MEMORY USAGE key: Reports how much RAM a specific key consumes to find memory hogs.
    - TTL key: Checks how many seconds a key has left before it automatically expires.- FLUSHDB ASYNC: Clears the current database without blocking the server (unlike standard FLUSHDB).

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
