# Cosmos DB

## Index types
1. **Composite**: 
    - The maximum number of composite indexes in Azure Cosmos DB is 2,000.
    - Cannot use wildcard of ? or *
2. **Range Index**
    - like hash with >= capabilities
3. **Spatial Index**
    - using functions like ST_DISTANCE, ST_WITHIN, and ST_INTERSECTS
    - Cannot use wildcard of ? or *
4. **Vector Index**
    - see later, vector enabled container database must be created first and cannot be modified after creation to add vector search --capabilities EnableNoSQLVectorSearch.
    - Cannot use wildcard of ? or *
    - vector_embedding_policy max 2048
    - The vector embedding policy (path, dimensions, data type, and distance function) is set at container creation time and cannot be changed afterward. 
5. **Hash**
    - only for exact search

## Indexing Mode
1. Consistent / None
2. Include partition key in the index. Azure Cosmos DB doesn't index the partition key automatically when you use the exclude-by-default strategy. (strange)

## Consistency 
1. Strong (synchronous) -> Bounded Staleness (need agreement to K versions or T seconds) -> Session (need header) -> Consistent Prefix(Guaranteed) -> Eventual (fastest).
2. Strong and Bounded Staleness take 2 RUs for read. It's used for geo-replication.
3. Remember client can lower consistency. I.e. server is strong, client can choose session.
4. Probabilistically Bounded Staleness (PBS) metrics show how often reads with eventual consistency actually return the latest data. This metric helps validate whether weaker consistency levels meet your application requirements.

## Vector data types

```javascript
vector_embedding_policy = {
    "vectorEmbeddings": [
        {
            "path": "/embedding",
            "dataType": "float32",
            "distanceFunction": "cosine",
            "dimensions": 1536
        }
    ]
}
```

1. Distance function
    - **Cosine** similarity measures the angle between two vectors, making it ideal for comparing text embeddings where magnitude shouldn't affect similarity. Azure OpenAI embeddings are normalized, meaning cosine similarity works well for them. The VectorDistance function returns cosine similarity scores ranging from -1 (least similar) to +1 (most similar), with most practical results falling between 0 and 1. _Higher scores indicate greater similarity between the query and document vectors._
    - **Dot** product measures both angle and magnitude. For normalized vectors like those from Azure OpenAI, dot product results are mathematically identical to cosine similarity but can be slightly faster to compute. _Use dot product when your embeddings are guaranteed to be normalized and you want maximum query performance._
    - **Euclidean** distance measures the straight-line distance between two points in the vector space. Scores range from 0 (identical) to positive infinity (most different). _This function suits specialized use cases where both direction and magnitude matter, but it's less common for text embeddings._
2. Datatypes
    - The **float32** type provides full precision but consumes the most storage. Using **float16** reduces storage by 50 percent with minimal impact on search quality—for most AI applications, this precision reduction is imperceptible in search results.
    - **Float32**: provides the best balance of accuracy and simplicity.
3. Multi vector for different fields. E.g. "path": "/titleEmbedding" another for "path": "/contentEmbedding".

## Index policy

```javascript
indexing_policy = {
    "indexingMode": "consistent",
    "automatic": True,
    "includedPaths": [
        {"path": "/*"}
    ],
    "excludedPaths": [
        {"path": "/\"_etag\"/?"},
        {"path": "/embedding/*"}
    ],
    "vectorIndexes": [
        {"path": "/embedding", "type": "diskANN"}
    ]
}
```

1. Policy types:
    - **flat**: Stores vectors in the main index and performs exact brute-force search. Provides 100 percent recall but limits vectors to 505 dimensions. Best for small datasets or when exact results are required.
    - **quantizedFlat**: Compresses vectors before indexing for improved efficiency. Still performs brute-force search but with reduced latency and RU cost. Supports up to 4,096 dimensions and is recommended for datasets up to approximately 50,000 vectors per physical partition.
    - **diskANN**: Uses Microsoft Research's DiskANN algorithm for fast approximate search. Supports up to 4,096 dimensions and provides the best performance for large datasets with millions of vectors while maintaining high accuracy.
2. NOTE: The quantizedFlat and diskANN index types require at least 1,000 vectors before the index becomes effective. With fewer vectors, queries fall back to full scans, which might result in higher RU charges.
3. Index name must be in lower case.
4. Useful for embedding [link](https://learn.microsoft.com/en-us/azure/search/cognitive-search-skill-azure-openai-embedding)

## Full text index
1. Just for fuzzy search text.
```
    "fullTextIndexes": [
        {"path": "/content"}
    ]
```

## The code

1. The VectorDistance function is the core mechanism for vector search in Azure Cosmos DB. It calculates the similarity between a document's embedding and a query vector based on the distance function configured in the container's vector policy. For cosine similarity, the function returns values where higher numbers indicate greater similarity. A document with a score of 0.9 is more similar to the query than one with a score of 0.5.
2. The function accepts the following parameters:
    - vector_expr_1: The document's embedding path (such as c.embedding)
    - vector_expr_2: The query vector (an array of numbers)
    - bool_expr: Optional boolean that forces brute-force search when set to true (default: false)
    - obj_expr: Optional JSON object with other options like distanceFunction and dataType
3. When you need 100 percent accurate results, you can force brute-force search by passing true.
4. If the vectors are not normalized, the dot product will not be mathematically equivalent to cosine similarity.

```python
# Create container with vector support
container = database.create_container(
    id="knowledge-base",
    partition_key=PartitionKey(path="/category"),
    indexing_policy=indexing_policy,
    vector_embedding_policy=vector_embedding_policy
)
```

```python
from openai import AzureOpenAI

# User's search query
query_text = "How do I fix WiFi connection problems?"

# Generate query embedding using the same model as documents
openai_client = AzureOpenAI(
    api_key=api_key,
    api_version="2024-02-01",
    azure_endpoint=endpoint
)

response = openai_client.embeddings.create(
    input=query_text,
    model="text-embedding-ada-002"
)
query_embedding = response.data[0].embedding

# Execute vector search
query = """
    SELECT TOP 10
        c.id,
        c.title,
        c.category,
        VectorDistance(c.embedding, @queryVector) AS SimilarityScore
    FROM c
    // WHERE VectorDistance(c.embedding, @queryVector) > 0.7
    ORDER BY VectorDistance(c.embedding, @queryVector)
"""

results = container.query_items(
    query=query,
    parameters=[{"name": "@queryVector", "value": query_embedding}],
    enable_cross_partition_query=True
)

for item in results:
    print(f"{item['title']} - Score: {item['SimilarityScore']:.4f}")
```

## Hybrid search
1. [link](https://learn.microsoft.com/en-us/training/modules/implement-vector-search-azure-cosmos-db/4-combine-vector-metadata-filtering?pivots=text
)
2. Hybrid search combines the strengths of both keyword and vector search to provide the best possible search results. It uses a technique called **reranking** to combine the scores from both types of search.
3. Use RRF, Hybrid search combines vector similarity with full-text search scoring using the Reciprocal Rank Fusion (RRF) function.
    - RRF merges rankings from multiple scoring functions into a unified result set. Documents that rank highly in both vector and keyword searches appear at the top, while documents that excel in only one dimension still appear in results.
4. You can adjust how much influence each scoring component has on final rankings by providing weights to the RRF function. Weights are specified as an array of numbers in the order the scoring functions appear.
    - With weights of [2, 1], a document's vector similarity score contributes twice as much to its final rank as its keyword match score. Adjust weights based on your application's needs:
    - Higher vector weight: Prioritizes semantic understanding. Use when users describe problems in natural language.
    - Higher full-text weight: Prioritizes exact keyword matches. Use when users search for specific terms, codes, or names.
    - Equal weights: Balances both approaches. A good starting point for general-purpose search.
```javascript
SELECT TOP 10 *
FROM c
ORDER BY RANK RRF(
    VectorDistance(c.embedding, @queryVector),
    FullTextScore(c.content, @searchTerm1, @searchTerm2),
    [2, 1] // 2 is more relevant in vector distance than fulltextscroe
)
```

## Notes
1. Change feed - pull vs push. Push has a lease container, pull is to check the change feed yourself, and partition key has to be included.
2. Conflict Resolution, remember cannot toggle between LWW and Custom
    - Last Writer Wins (must be timestamp)
        - default _ts field
        - Custom epoch field
    - Custom
        - Custom with Stored Procedure
        - Custom with No Stored Procedure / Manual (aka.Conflict Feed), need a code to read from FeedIterator
3. Need to cover Azure AI Search and need to revisit https://learn.microsoft.com/en-us/training/modules/build-generative-ai-applications-with-azure-cosmos-db-nosql/8-exercise-build-generative-ai-applications
3. Embedding refresh
    - "Embedding vectors are immutable: because they are generated by a trained AI model, they cannot be updated. If your original data changes, you must regenerate the vector embedding and save it as a new document or overwrite the old document. To update existing embeddings, use the following pattern: Upload the new document. If you useupsert, the document will overwrite the old one."
    - Else refresh with change feed.
4. OpenAI uses distanceFunction of "cosine" and float 32. An embedding model always outputs a vector array of a very specific length.
    - 1536 is the famous, hardcoded dimension size for text-embedding-ada-002 (and the newer text-embedding-3-small). If you see ada-002 on an exam, immediately look for the number 1536.
    - Choice C lists 3072 dimensions. This is the exact dimension size for OpenAI's newer, larger model: text-embedding-3-large. The exam writers put this here to trick people who confuse the different OpenAI models.
5. Continous backup allows restore point in time, periodic backup requires support team.