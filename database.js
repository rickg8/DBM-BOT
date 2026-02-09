const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

/**
 * Abstração de banco de dados que suporta SQLite (local) e PostgreSQL (Render)
 */

const USE_POSTGRES = !!process.env.DATABASE_URL;
const DATA_DIR = path.join(__dirname, 'data');

let db;

if (USE_POSTGRES) {
    // Usar PostgreSQL (Render)
    const { Pool } = require('pg');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    db = {
        prepare: (sql) => ({
            run: (...params) => {
                // Simular comportamento do sqlite3
                pool.query(sql, params).catch(err => {
                    console.error('Database error:', err);
                });
            },
            get: (...params) => {
                // Retornar primeiro resultado
                return new Promise((resolve) => {
                    pool.query(sql, params).then(result => {
                        resolve(result.rows[0]);
                    }).catch(err => {
                        console.error('Database error:', err);
                        resolve(null);
                    });
                });
            },
            all: (...params) => {
                return new Promise((resolve) => {
                    pool.query(sql, params).then(result => {
                        resolve(result.rows);
                    }).catch(err => {
                        console.error('Database error:', err);
                        resolve([]);
                    });
                });
            }
        }),
        exec: (sql) => {
            try {
                pool.query(sql).catch(err => {
                    console.error('Database error:', err);
                });
            } catch (err) {
                console.error('Database error:', err);
            }
        },
        transaction: (fn) => fn
    };
} else {
    // Usar SQLite (Local/Desenvolvimento)
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    const dbPath = path.join(DATA_DIR, 'dbm.sqlite');
    db = new Database(dbPath);
    console.log(`📦 SQLite database: ${dbPath}`);
}

console.log(`🔗 Database: ${USE_POSTGRES ? 'PostgreSQL (Render)' : 'SQLite (Local)'}`);

module.exports = db;
