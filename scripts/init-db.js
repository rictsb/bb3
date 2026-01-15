// Database initialization script
// Run with: npm run init-db
// Run with seed data: npm run init-db -- --seed

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'database', 'mining.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'database', 'schema.sql');
const SEED_PATH = path.join(__dirname, '..', 'database', 'seed.sql');

const shouldSeed = process.argv.includes('--seed');

// Delete existing database if seeding (fresh start)
if (shouldSeed && fs.existsSync(DB_PATH)) {
    console.log('Removing existing database for fresh seed...');
    fs.unlinkSync(DB_PATH);
}

console.log('Initializing database...');

// Create database (or open existing)
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Execute schema file as a whole (SQLite can handle multiple statements)
try {
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schema);
    console.log('Schema applied successfully!');
} catch (err) {
    console.error('Schema error:', err.message);
    process.exit(1);
}

// Optionally load seed data
if (shouldSeed && fs.existsSync(SEED_PATH)) {
    console.log('Loading seed data...');
    try {
        const seed = fs.readFileSync(SEED_PATH, 'utf8');
        db.exec(seed);
        console.log('Seed data loaded!');
    } catch (err) {
        console.error('Seed error:', err.message);
    }
}

// Show table counts
console.log('\nTable counts:');
const tables = ['companies', 'sites', 'subsites', 'hardware', 'news', 'review_queue', 'valuation_settings', 'custom_multipliers'];
for (const table of tables) {
    try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
        console.log(`  ${table}: ${count.count} rows`);
    } catch (err) {
        console.log(`  ${table}: error - ${err.message}`);
    }
}

console.log('\nDatabase initialized at:', DB_PATH);
console.log('Run "npm start" to start the server.');

db.close();
