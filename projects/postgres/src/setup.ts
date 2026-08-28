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

async function setupDatabase() {
    const client = await pool.connect();

    try {
        console.log('--- Starting PostgreSQL AI-200 Environment Setup ---');

        // 1. Register pgvector types with the pg client
        await pgvector.registerTypes(client);

        // 2. Enable Vector Extension
        console.log('1. Enabling vector extension...');
        await client.query('CREATE EXTENSION IF NOT EXISTS vector;');

        // 3. Create Table for AI Study Notes / Embeddings
        console.log('2. Drop and create table "products"..., Using "halfvec" instead of vector');

        await client.query(`DROP TABLE IF EXISTS products;`)
        await client.query(`
            CREATE TABLE products (
                id VARCHAR(20) PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(100) NOT NULL,
                metadata JSONB DEFAULT '{}'::jsonb,
                embedding halfvec(8),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );      
        `);

        // 4. Create Index (IVFFlat for high-speed graph similarity search)
        console.log('3. Skip creating IVFFlat index on embedding column...');
        // await client.query(`
        //     CREATE INDEX IF NOT EXISTS idx_products_ivfflat
        //     ON products
        //     USING ivfflat (embedding vector_ip_ops);
        // `);

        // 5. Data Access RBAC: Create an App-Specific Least-Privilege Role
        console.log('4. Setting up least-privilege application role...');

        // Check if role already exists before creating
        const roleCheck = await client.query(
            "SELECT 1 FROM pg_roles WHERE rolname='app_user'"
        );

        if (roleCheck.rowCount === 0) {
            // Note: we set password here for the purpose of this course.
            // In a real app, you should use environment variables or secrets management.
            await client.query(
                "CREATE ROLE app_user WITH LOGIN PASSWORD 'app_password_123';"
            );
            console.log('   -> Role "app_user" created.');
        } else {
            console.log('   -> Role "app_user" already exists.');
        }

        // Grant schema and table permissions to app_user
        await client.query(
            'GRANT ALL ON TABLE study_plan_docs TO app_user;'
        );
        await client.query(
            'GRANT USAGE, SELECT ON SEQUENCE study_plan_docs_id_seq TO app_user;'
        );
        console.log('   -> Granted SELECT/INSERT/UPDATE/DELETE permissions to "app_user".');

        console.log('\n--- Setup Complete! Database is ready for AI vector workloads. ---');

    } catch (err) {
        console.error('Error during setup:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

setupDatabase();