import pg from 'pg';
import pgvector from 'pgvector/pg';
import 'dotenv/config';

const { Pool } = pg;

// Connect as superuser to perform administrative setup
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'postgres',
});

async function query(key: string, smallData: boolean = false) {
    const client = await pool.connect();

    try {
        await pgvector.registerTypes(client);

        console.error("NOTE: The data is so small this makes no use of HSNW or IVFFlat.");

        console.log('1. Querying product by name...');
        const result = await client.query(
            'SELECT * FROM products WHERE id = $1',
            [key]
        );
        console.log('2. Query result:', result.rows);

        const embedding = result.rows[0].embedding;

        console.log('3. Calculate similarity between embedding of', result.rows[0].name);

        const similarResult = await client.query(
            'SELECT * FROM products ORDER BY embedding <#> $1::halfvec LIMIT 3',
            [JSON.stringify(embedding)]
        );

        const names = similarResult.rows.map((product) => product.name);
        console.log(names);

        console.log('\n\n\n4. Explain Index');

        if (smallData) {
            console.log("NOTE: Force to use index on a small dataset, otherwise seqscan would be used.")
            await client.query('SET enable_seqscan = off;');
        }
        console.log('4.1 Without Analyze');
        console.log((await client.query(
            'EXPLAIN SELECT * FROM products ORDER BY embedding <#> $1::halfvec LIMIT 3',
            [JSON.stringify(embedding)]
        )).rows);

        console.log('4.2 With Analyze');
        console.log((await client.query(
            'EXPLAIN ANALYZE SELECT * FROM products ORDER BY embedding <#> $1::halfvec LIMIT 3',
            [JSON.stringify(embedding)]
        )).rows);

        console.log('4.3 With Analyze of wrong vector, see the index still uses halfvec. Penalty is during conversion only.');
        console.log((await client.query(
            'EXPLAIN ANALYZE SELECT * FROM products ORDER BY embedding <#> $1::vector LIMIT 3',
            [JSON.stringify(embedding)]
        )).rows);

        console.log('4.4 With Analyze of wrong policy type');
        console.log((await client.query(
            'EXPLAIN ANALYZE SELECT * FROM products ORDER BY embedding <=> $1::halfvec LIMIT 3',
            [JSON.stringify(embedding)]
        )).rows);

    } catch (error) {
        console.error('Error querying:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

//query("001", true); //For small dataset
query("prod_98990", false); //For big dataset