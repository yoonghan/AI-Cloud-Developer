import { createClient } from 'redis';

async function main() {
    // 1. Initialize the client (defaults to redis://localhost:6379)
    const client = createClient({
        url: 'redis://localhost:6379',
    });

    // Handle connection errors
    client.on('error', (err) => console.error('Redis Client Error:', err));

    try {
        // 2. Connect to the database
        await client.connect();
        console.log('Connected successfully to Redis!');

        // 3. SET a key with a value
        // (Optional) Pass { EX: 60 } as the 3rd arg to set a 60-second Time-To-Live (TTL)
        await client.set('user:0001:name', 'Hayo');
        console.log('Saved key: user:0001:name');

        // 4. GET the value back
        const value = await client.get('user:0001:name');
        console.log('Retrieved value from Redis:', value);

    } catch (err) {
        console.error('Error executing Redis commands:', err);
    } finally {
        // 5. Always disconnect gracefully when finished
        await client.destroy();
        console.log('Disconnected from Redis.');
    }
}

async function mainMultiKeySample() {
    const client = createClient({
        url: 'redis://localhost:6379',
    });

    client.on('error', (err) => console.error('Redis Client Error:', err));

    try {
        await client.connect();
        console.log('Connected to Redis!');

        // 1. Save multiple keys in a single network call using mSet
        // Accepts an array of [key, value] pairs
        await client.mSet([
            ['user:0001:name', 'Hayo'],
            ['user:0002:name', 'Alice'],
            ['user:0003:name', 'Bob'],
        ]);
        console.log('Successfully set 3 keys at once.');

        // 2. Define the keys we want to fetch (including one key that does not exist)
        const keysToFetch = [
            'user:0001:name',
            'user:0002:name',
            'user:0003:name',
            'user:9999:name', // Doesn't exist
        ];

        // 3. Execute MGET in a single network call
        // Returns an array of values in the exact order requested
        const values = await client.mGet(keysToFetch);

        console.log('\n--- Raw MGET Array Output ---');
        console.log(values);
        // Output: [ 'Hayo', 'Alice', 'Bob', null ]

        // 4. Helper pattern: Zip keys and values together into a clean JS Object
        const keyMap = Object.fromEntries(
            keysToFetch.map((key, index) => [key, values[index]])
        );

        console.log('\n--- Mapped Key-Value Object ---');
        console.log(keyMap);
        /* Output:
          {
            'user:0001:name': 'Hayo',
            'user:0002:name': 'Alice',
            'user:0003:name': 'Bob',
            'user:9999:name': null
          }
        */

    } catch (err) {
        console.error('Error executing Redis commands:', err);
    } finally {
        await client.destroy();
        console.log('Disconnected from Redis.');
    }
}

async function mainHashSample() {
    const client = createClient({
        url: 'redis://localhost:6379',
    });

    client.on('error', (err) => console.error('Redis Client Error:', err));

    try {
        await client.connect();
        console.log('Connected to Redis!');

        // 1. Create a Hash using hSet (passing a JavaScript object)
        await client.hSet('user:0001', {
            name: 'Hayo',
            role: 'Admin',
            status: 'Active'
        });
        console.log('Successfully saved Hash for user:0001.');

        // 2. HGET: Fetch exactly one specific field from the Hash
        const name = await client.hGet('user:0001', 'name');
        console.log('\n--- HGET Result ---');
        console.log(`Name field: ${name}`);
        // Output: Hayo

        // 3. HGETALL: Fetch the entire Hash as a neat JavaScript Object
        const userObject = await client.hGetAll('user:0001');
        console.log('\n--- HGETALL Result ---');
        console.log(userObject);
        /* Output:
          {
            name: 'Hayo',
            role: 'Admin',
            status: 'Active'
          }
        */

        const userNameRole = await client.hmGet('user:0001', ['name', 'role']);
        console.log('\n--- HMGET Result ---');
        console.log(userNameRole);
        // Output: [ 'Hayo', 'Admin' ]

    } catch (err) {
        console.error('Error executing Redis commands:', err);
    } finally {
        await client.destroy();
        console.log('\nDisconnected from Redis.');
    }
}

async function mainExpireSample() {
    const client = createClient({
        url: 'redis://localhost:6379',
    });

    client.on('error', (err) => console.error('Redis Client Error:', err));

    try {
        await client.connect();
        console.log('Connected to Redis!');

        // 1. Save a key with a TTL
        await client.set('user:0001:name', 'Hayo', { EX: 10 });
        await client.set('user:0002:name', 'Alice');
        await client.expire('user:0002:name', 15);
        await client.set('user:0003:name', 'Bob', { EX: 15 });

        // 2. Check TTL
        console.log(`Saved key: user:0001:name with ${await client.ttl('user:0001:name')} second TTL.`);
        console.log(`Saved key: user:0002:name with ${await client.ttl('user:0002:name')} second TTL.`);
        console.log(`Saved key: user:0003:name with ${await client.ttl('user:0003:name')} second TTL.`);

        const getData = async () => {
            const value1 = await client.get('user:0001:name');
            console.log(`Value user:0001:name after TTL: ${value1}`);

            const value2 = await client.get('user:0002:name');
            console.log(`Value user:0002:name after TTL: ${value2}`);

            await client.persist('user:0003:name');
            console.log(`key: user:0003:name is persistent`);
            const value3 = await client.get('user:0003:name');
            console.log(`Value user:0003:name after TTL: ${value3}`);
        }
        // 3. Wait for the TTL to expire
        await new Promise(resolve => setTimeout(async () => {
            await getData();
            resolve('Completed 1');
        }, 11000));

        // 4. Try to get the key again
        await new Promise(resolve => setTimeout(async () => {
            await getData();
            resolve('Completed 2');
        }, 5000));

    } catch (err) {
        console.error('Error executing Redis commands:', err);
    } finally {
        await client.destroy();
        console.log('Disconnected from Redis.');
    }
}

async function testEviction() {
    const client = createClient({ url: 'redis://localhost:6379' });
    await client.connect();

    try {
        console.log('--- Configured Eviction Test ---');

        // 1. Temporarily restrict Redis maxmemory to 2 Megabytes
        await client.configSet('maxmemory', '3mb');

        // 2. Set policy to LRU (Least Recently Used across all keys)
        await client.configSet('maxmemory-policy', 'allkeys-lru');

        // 3. Write a key early on
        await client.set('early_key', 'Important Data that won\'t be read again');
        console.log('Set "early_key".');

        // 4. Fill memory with large payload strings to trigger maxmemory limit
        const largePayload = 'X'.repeat(100 * 1024); // 100 KB string
        console.log('Writing 40 large keys to force memory limit...');

        for (let i = 0; i < 40; i++) {
            await client.set(`filler_key:${i}`, largePayload);
        }

        // 5. Try to read the initial key again
        const earlyValue = await client.get('early_key');

        if (earlyValue === null) {
            console.log('SUCCESS: "early_key" was automatically evicted by LRU!');
        } else {
            console.log('Result: "early_key" still exists (memory threshold not breached yet).');
        }

        //Bad ways, should use SCAN
        const allUserKeys = await client.keys('filler_key:*');
        console.log('Remains filler_key:', allUserKeys);



    } catch (err) {
        console.error('Error:', err);
    } finally {
        // Reset maxmemory config back to 0 (unlimited)
        await client.configSet('maxmemory', '0');
        await client.configSet('maxmemory-policy', 'noeviction');
        await client.destroy();
    }
}

async function testListOperations() {
    const client = createClient({ url: 'redis://localhost:6379' });
    await client.connect();

    const listKey = 'demo:task_queue';

    try {
        // Cleanup previous test data
        await client.del(listKey);

        console.log('--- 1. Pushing Items into List ---');
        // LPUSH adds items to the front (Left side)
        // List order will become: ['job3', 'job2', 'job1']
        await client.lPush(listKey, 'job1');
        await client.lPush(listKey, 'job2');
        await client.lPush(listKey, 'job3');

        // RPUSH adds item to the end (Right side)
        // List order becomes: ['job3', 'job2', 'job1', 'job4']
        await client.rPush(listKey, 'job4');

        // 2. Read all items in the list without removing them
        const allItems = await client.lRange(listKey, 0, -1);
        console.log('Current List Contents (Head to Tail):', allItems);
        // Output: [ 'job3', 'job2', 'job1', 'job4' ]

        console.log('\n--- 2. Popping Items from List ---');

        // LPOP removes from the Head (Left) -> Returns 'job3'
        const leftItem = await client.lPop(listKey);
        console.log('LPOP (Left / Head):', leftItem);

        // RPOP removes from the Tail (Right) -> Returns 'job4'
        const rightItem = await client.rPop(listKey);
        console.log('RPOP (Right / Tail):', rightItem);

        // 3. Inspect remaining items
        const remainingItems = await client.lRange(listKey, 0, -1);
        console.log('Remaining List Contents:', remainingItems);
        // Output: [ 'job2', 'job1' ]

        // 4. Get List Length
        const length = await client.lLen(listKey);
        console.log('List length:', length);

    } catch (err) {
        console.error('Error during list operations:', err);
    } finally {
        await client.del(listKey);
        await client.destroy();
    }
}


// main();
// mainMultiKeySample();
// mainHashSample();
// mainExpireSample();

// testEviction();
testListOperations();