# Azure Redis

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
    
    