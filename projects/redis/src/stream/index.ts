import { createClient } from "redis"
import readLine from 'node:readline'

const STREAM_NAME = 'ai_task_stream';
const GROUP_NAME = 'task_workers';
const CONSUMER_NAME = 'worker_node_1';

async function runStreamDemo() {
    const client = createClient({ url: 'redis://localhost:6379' });
    client.on('error', (err) => console.error('Redis Error:', err));
    await client.connect();

    try {
        const messageId = await client.xAdd(
            STREAM_NAME,
            '*',
            {
                userId: 'dev_user_001',
                action: 'generate_quiz',
                topic: 'Redis Streams'
            }
        )

        // -----------------------------------------------------------------
        // 2. SETUP: Create a Consumer Group (XGROUP CREATE)
        // -----------------------------------------------------------------
        /**
         * If you try to create a consumer group on a stream key that doesn't exist yet, Redis will throw a fatal error: ERR The XGROUP subcommand use requires the key to exist
         * assing { MKSTREAM: true } tells Redis: "If this Stream key does not exist yet, automatically create an empty stream key first, then create the consumer group on it."
            */
        try {
            // Attempt to create the stream and group
            await client.xGroupCreate(STREAM_NAME, GROUP_NAME, '0', { MKSTREAM: true });
            console.log(`Created consumer group '${GROUP_NAME}'.`);
        } catch (err: unknown) {
            // If the group already exists, safely ignore the error and continue
            if ((err as Error).message.includes('BUSYGROUP')) {
                console.log(`Consumer group '${GROUP_NAME}' already exists. Skipping setup.`);
            } else {
                // Re-throw any genuine connection or syntax errors
                throw err;
            }
        }

        // -----------------------------------------------------------------
        // 3. CONSUMER: Fetch unassigned task (XREADGROUP)
        // -----------------------------------------------------------------
        const response = await client.xReadGroup(
            GROUP_NAME,
            CONSUMER_NAME,
            [
                { key: STREAM_NAME, id: '>' } //Any unassigned task.
                //If id: 1693000000000-0', then this id
                //If 0, or 0-0, give me messages that were already assigned to ME (this specific consumer) in the past, but I have not yet acknowledged (XACK).
            ]
        )

        if (response) {
            for (const streamData of response) {
                for (const message of streamData.messages) {
                    console.log(`\n[Processing Task]`);
                    console.log(`  Stream ID: ${message.id}`);
                    console.log(`  Payload:`, message.message);

                    // -------------------------------------------------------------
                    // 4. ACKNOWLEDGE: Mark task as completed (XACK)
                    // -------------------------------------------------------------
                    // Removes message from the Pending Entries List (PEL)
                    await client.xAck(STREAM_NAME, GROUP_NAME, message.id);
                    console.log(`[Consumer] Task ${message.id} acknowledged (XACK).`);
                }
            }
        } else {
            console.log('[Consumer] No new messages available.');
        }
    } catch (e: unknown) {
        console.log("error occurred", (e as Error).message);
    }
}


const RECOVERY_WORKER = "worker_node_recovery"
// Remember: this is consumer transfer.
async function runAutoClaimDemo() {
    const client = createClient({ url: 'redis://localhost:6379' });
    client.on('error', (err) => console.error('Redis Error:', err));
    await client.connect();

    try {
        try {
            await client.xGroupCreate(STREAM_NAME, GROUP_NAME, '0', { MKSTREAM: true });
        } catch (err: unknown) {
            if (!(err as Error).message.includes('BUSYGROUP')) throw err;
        }

        // -------------------------------------------------------------
        // Step 1: PUBLISH (xAdd)
        // -------------------------------------------------------------
        const msgId = await client.xAdd(STREAM_NAME, '*', {
            taskId: 'task_101',
            payload: 'Process video frames'
        });
        console.log(`1. Published message to stream: ${msgId}`);


        // -------------------------------------------------------------
        // Step 2: CONSUME (xReadGroup) - THIS MOVES IT INTO THE PEL!
        // -------------------------------------------------------------
        const readResult = await client.xReadGroup(
            GROUP_NAME,
            'worker_1', // Worker 1 receives the assignment
            [{ key: STREAM_NAME, id: '>' }],
            { COUNT: 1 }
        );
        if (readResult !== null) {
            console.log('2. Worker 1 fetched task from stream:', readResult[0].messages[0].id);
        } else {
            console.log('2. Worker 1 no task fetched from stream.');
        }

        // -------------------------------------------------------------
        // Step 3: SIMULATE TIME PASSED & RECLAIM (xAutoClaim)
        // -------------------------------------------------------------
        console.log('3. Waiting 2 seconds to exceed minIdleTimeMs...');
        await new Promise((resolve) => setTimeout(resolve, 2000));


        console.log(`[Recovery Worker] Checking for abandoned/stuck tasks...`);

        // Parameters for xAutoClaim:
        // 1. STREAM_NAME
        // 2. GROUP_NAME
        // 3. RECOVERY_WORKER (The new worker claiming the abandoned task)
        // 4. MIN_IDLE_TIME (In milliseconds - e.g., 60000 = 60 seconds)
        //    Tasks unacknowledged longer than this will be reclaimed.
        // 5. START_ID ('0-0' means scan from the beginning of the stream's pending list)
        // 6. OPTIONS ({ COUNT: 10 } limits how many abandoned tasks to claim at once)

        const minIdleTimeMs = 6000; // 6 seconds
        const startScanId = '0-0';

        const claimResult = await client.xAutoClaim(
            STREAM_NAME,
            GROUP_NAME,
            RECOVERY_WORKER, // Transfer to this group, this group now have to ACK
            minIdleTimeMs,
            startScanId,
            { COUNT: 5 } // How many batch can be done at a time, avoid 10000
        );

        if (claimResult.messages.length > 0) {
            console.log(`\nReclaimed ${claimResult.messages.length} abandoned task(s)!`);

            for (const message of claimResult.messages) {
                console.log(`\n[Processing Reclaimed Task]`);
                console.log(`  Stream ID: ${message?.id}`);
                console.log(`  Payload:`, message?.message);

                // Process the task...

                // Acknowledge completion on behalf of the consumer group
                if (message !== null) {
                    await client.xAck(STREAM_NAME, GROUP_NAME, message.id);
                    console.log(`  Task ${message.id} successfully processed and acknowledged.`);
                }
            }
        } else {
            console.log('No abandoned or stuck tasks found in the pending list.');
        }

    } catch (err) {
        console.error('Error during XAUTOCLAIM:', err);
    } finally {
        await client.destroy();
    }
}

async function runPublisher() {
    const client = createClient({ url: 'redis://localhost:6379' });
    client.on('error', (err) => console.error('Redis Client Error:', err));

    await client.connect();
    console.log('Publisher connected to Redis!\n');

    try {

        let taskCounter = 1;

        const rl = readLine.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question('Press Enter to stop...', async () => {
            // -----------------------------------------------------------------
            // 3. Continuous Producer Loop (Simulating live application traffic)
            // -----------------------------------------------------------------
            const interval = setInterval(async () => {
                try {
                    const id = await client.xAdd(STREAM_NAME, '*', {
                        taskId: `task_${taskCounter}`,
                        payload: `Simulated job data batch #${taskCounter}`,
                        timestamp: Date.now().toString()
                    });

                    console.log(`[Loop Producer] Sent Task #${taskCounter} -> Generated Stream ID: ${id}`);
                    taskCounter++;
                } catch (err) {
                    console.error('Failed to publish message:', err);
                }
            }, 3000); // Publishes a new task every 3 seconds

            rl.close();
            interval.close()
            await client.destroy();
            process.exit(0);
        });



    } catch (err) {
        console.error('Publisher Error:', err);
    } finally {
        client.destroy()
    }
}


//Server
// runStreamDemo();
runAutoClaimDemo();

//Client
runPublisher();