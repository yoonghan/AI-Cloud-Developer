import { createClient } from 'redis';

async function demonstrateKeyCommands() {
    const client = createClient({
        url: 'redis://localhost:6379',
    });

    client.on('error', (err: unknown) => console.error('Redis Error:', err));

    try {
        await client.connect();
        console.log('Connected to Redis!\n');

        // Setup: Populate a few test keys
        await client.mSet([
            ['user:0001:name', 'Hayo'],
            ['user:0002:name', 'Alice'],
            ['user:0003:name', 'Bob'],
            ['session:101', 'active'],
        ]);

        // -----------------------------------------------------------------
        // 1. EXISTS - Check if a known key exists (O(1) operation)
        // -----------------------------------------------------------------
        // Returns the number of existing keys found (e.g., 1 or 0)
        const existsResult = await client.exists('user:0001:name');
        console.log('1. EXISTS result:', existsResult === 1 ? 'Key exists' : 'Key does not exist');


        // -----------------------------------------------------------------
        // 2. KEYS - Blocking full scan (DEV/DEBUG ONLY!)
        // -----------------------------------------------------------------
        // Fetches all matching keys in a single blocking array response
        const allUserKeys = await client.keys('user:*');
        console.log('2. KEYS result (Blocking):', allUserKeys);


        // -----------------------------------------------------------------
        // 3. SCAN - Production-Safe Iteration
        // -----------------------------------------------------------------

        // Pattern A: Using scanIterator (Idiomatic Node.js Async Generator)
        // The client handles cursors automatically under the hood!
        console.log('\n3A. SCAN using scanIterator (Recommended for Node.js):');
        for await (const key of client.scanIterator({
            MATCH: 'user:*',
            COUNT: 10, // Hint to Redis for batch size per scan step
        })) {
            console.log('  Found key safely:', key);
        }

        // Pattern B: Manual SCAN Loop (How Redis CLI/raw commands handle it)
        // console.log('\n3B. Manual SCAN loop with cursors:');
        // let cursor = '0';
        // do {
        //     // Pass flat arguments instead of an options object
        //     const reply = await client.scan(cursor, 'MATCH', 'user:*', 'COUNT', '10');

        //     // Older clients return an array: [newCursorString, arrayOfKeys]
        //     cursor = reply[0];
        //     const keys = reply[1];

        //     console.log(`Batch (Cursor at ${cursor}):`, keys);

        // } while (cursor !== '0');

    } catch (err) {
        console.error('Execution Error:', err);
    } finally {
        await client.destroy();
        console.log('\nDisconnected from Redis.');
    }
}

demonstrateKeyCommands();