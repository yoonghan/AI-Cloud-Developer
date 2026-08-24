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


main();
mainMultiKeySample();
mainHashSample();
mainExpireSample()