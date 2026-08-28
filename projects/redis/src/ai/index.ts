import { createClient } from "redis";
import sampleData from "./sample_data.json" with { type: "json" };

function float32Buffer(arr: number[]): Buffer {
    return Buffer.from(new Float32Array(arr).buffer);
}

async function initializeRedis() {

    const createIndex = async () => {
        try {
            await client.ft.create(
                'idx:products',
                {
                    key: { type: 'TAG' },
                    product_id: { type: 'TAG' },
                    name: { type: 'TEXT' },
                    category: { type: 'TAG' },
                    embedding: {
                        type: 'VECTOR',
                        ALGORITHM: 'HNSW',
                        TYPE: 'FLOAT32',
                        DIM: 8, // Dimensions for sample embeddings
                        DISTANCE_METRIC: 'COSINE',
                    },
                },
                {
                    ON: 'HASH',
                    PREFIX: 'doc:', //Watch and automatically index all Redis Hash keys that start with the prefix doc:
                }
            );
            console.log('Created HNSW Index: idx:products');
        } catch (err: any) {
            if (err.message?.includes('Index already exists')) {
                console.log('HNSW Index already exists, continuing...');
            } else {
                throw err;
            }
        }
    }

    const insertDocuments = async () => {

        try {
            const pipeline = client.multi();
            let count = 0;

            for (const doc of sampleData) {
                const map = { //See hash above.
                    key: doc.key,
                    product_id: doc.product_id,
                    name: doc.name,
                    category: doc.category,
                    embedding: float32Buffer(doc.embedding),
                }
                pipeline.hSet(`doc:${doc.key}`, map); //See index map that reference doc: prefix above

                // A hack to just get vector embedding in redis
                client.hSet(doc.key, { ...map, embedding: `[${doc.embedding.toString()}]` })
                count++;
            }


            await pipeline.execAsPipeline();
            console.log(`Loaded ${count} documents`);
        } catch (err: any) {
            if (err.message?.includes('Index does not exist')) {
                console.log('HNSW Index does not exist, creating...');
            } else {
                throw err;
            }
        }
    }

    //Starts here
    const client = createClient({ url: 'redis://localhost:6379' });
    client.on('error', (err) => console.error('Redis Client Error', err));
    await client.connect();
    try {
        await createIndex()
        await insertDocuments()
    } finally {
        await client.quit();
    }
}

const listKey = 'demo:ai_task_queue';
const pubSubKey = 'ai_results';

async function server() {
    const client = createClient({ url: 'redis://localhost:6379' });
    client.on('error', (err) => console.error('Redis Client Error', err));
    await client.connect();

    console.log("Server listening for vector search tasks...");

    while (true) {
        const task = await client.brPop(listKey, 0); // 0 - indefinitely blocks till item is pushed to list
        const userQuery = task?.element;
        if (!userQuery) continue;

        console.log(`User Query received: ${userQuery}`);

        let vectorArray: number[];
        const userQueryEmbedding = await client.hGet(userQuery, "embedding");
        // Hack to get some embedding from existing keys
        if (userQueryEmbedding !== null) {
            vectorArray = JSON.parse(userQueryEmbedding.replace(/'/g, '"'));
        } else {
            throw new Error("Not able to find key");
        }

        const searchResults = await client.ft.search(
            "idx:products",
            "*=>[KNN 3 @embedding $query_vec AS score]",
            {
                PARAMS: { query_vec: float32Buffer(vectorArray) },
                SORTBY: "score",
                DIALECT: 2,
                RETURN: ["key", "name", "score", "category"]
            }
        );

        let payload = {};
        if (searchResults.total > 0) {
            const topMatch = searchResults.documents[0].value;
            payload = {
                query: userQuery,
                matchedCategory: topMatch.category,
                name: topMatch.name,
                vectorScore: topMatch.score,
                returnedValues: searchResults.documents.length,
                bestMatches: {
                    second: searchResults.documents[1].value.name,
                    third: searchResults.documents[2].value.name
                }
            };
        } else {
            payload = { query: userQuery, message: 'No relevant vector match found.' };
        }

        console.log(`Publishing result to ${pubSubKey}:`, payload);
        await client.publish(pubSubKey, JSON.stringify(payload));
    }
}

async function client() {
    const subClient = createClient({ url: 'redis://localhost:6379' });
    const pubClient = createClient({ url: 'redis://localhost:6379' });

    await subClient.connect();
    await pubClient.connect();

    console.log('Client connected.');

    // 1. Subscribe to Redis Pub/Sub channel
    await subClient.subscribe(pubSubKey, (message) => {
        console.log('[Pub/Sub Subscriber] Received Result from Server:');
        console.log(JSON.parse(message));
    });

    // 2. Send query message to Redis List and change here
    const sampleQuery = sampleData[5].key;
    console.log(`[List Producer] Pushing query to "incoming_queries": "${sampleQuery}"`);

    await pubClient.lPush(listKey, sampleQuery);
}

async function exec() {
    await initializeRedis(); //Assume we load all documents into redis, or cosmos db, or etc.
    server();
    client();
}

exec();