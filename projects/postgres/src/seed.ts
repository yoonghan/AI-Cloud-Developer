import sampleData from "./sample_data.json" with { type: "json" }
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

async function seed() {
    const client = await pool.connect();

    try {

        console.log('1. Preparing table for 100,000 records...');
        await client.query('TRUNCATE TABLE products;');
        await pgvector.registerTypes(client);

        console.log('2. Seeding mock vector records...');

        for (const doc of sampleData) {
            await client.query(
                `INSERT INTO products (id, name, category, metadata, embedding)
             VALUES ($1, $2, $3, $4, $5)`,
                [doc.product_id, doc.name, doc.category, JSON.stringify(doc.metadata), pgvector.toSql(doc.embedding)]
            );
        }
        console.log('3. Successfully seeded mock data!');

        console.log('4. Creating IVFFlat index on embedding column...');
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_products_ivfflat
            ON products
            USING ivfflat (embedding halfvec_ip_ops);
        `);
    } catch (error) {
        console.error('Error seeding data:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

async function seedLarge() {
    const client = await pool.connect();
    try {
        await pgvector.registerTypes(client);
        console.log('1. Preparing table for 100,000 records...');
        await client.query('TRUNCATE TABLE products;');
        console.log('2. Generating & inserting 100,000 synthetic vector records in batches...');
        const TOTAL_RECORDS = 100000;
        const BATCH_SIZE = 5000;
        for (let batchStart = 0; batchStart < TOTAL_RECORDS; batchStart += BATCH_SIZE) {
            const values: any[] = [];
            const valueTuples: string[] = [];
            for (let i = 0; i < BATCH_SIZE; i++) {
                const globalIndex = batchStart + i + 1;
                // Cycle through sample_data templates
                const template = sampleData[globalIndex % sampleData.length]!!;
                const id = `prod_${globalIndex}`;
                const name = `${template.name} #${globalIndex}`;
                const category = template.category;
                const metadata = JSON.stringify({
                    ...template.metadata,
                    batch_id: Math.floor(globalIndex / BATCH_SIZE)
                });
                // Add slight noise (+/- 0.05) to original embedding for vector variation
                const jitteredEmbedding = template.embedding.map(val =>
                    Number((val + (Math.random() * 0.1 - 0.05)).toFixed(4))
                );
                const paramOffset = i * 5;
                valueTuples.push(`($${paramOffset + 1}, $${paramOffset + 2}, $${paramOffset + 3}, $${paramOffset + 4}, $${paramOffset + 5})`);
                values.push(id, name, category, metadata, pgvector.toSql(jitteredEmbedding));
            }
            const queryText = `
                INSERT INTO products (id, name, category, metadata, embedding)
                VALUES ${valueTuples.join(', ')}
            `;
            await client.query(queryText, values);
            console.log(`   -> Inserted ${batchStart + BATCH_SIZE} / ${TOTAL_RECORDS} rows...`);
        }
        console.log('3. Re-building IVFFlat / HNSW Index on 100,000 records...');

        // Drop existing index if any
        await client.query(`DROP INDEX IF EXISTS idx_products_ivfflat;`);
        await client.query(`DROP INDEX IF EXISTS idx_products_hnsw;`);
        // Option A: IVFFlat (100 lists recommended for 100k rows)
        await client.query(`
            CREATE INDEX idx_products_ivfflat
            ON products
            USING ivfflat (embedding halfvec_ip_ops) WITH (lists = 100);
        `);
        // Option B: HNSW (commented out by default)
        // await client.query(`
        //     CREATE INDEX idx_products_hnsw
        //     ON products
        //     USING hnsw (embedding halfvec_ip_ops) WITH (m = 16, ef_construction = 64);
        // `);
        console.log('🎉 Done! 100,000 records seeded with index ready.');
    } catch (error) {
        console.error('Error seeding large dataset:', error);
    } finally {
        client.release();
        await pool.end();
    }
}


// seed()
seedLarge()