// db.js
// Database abstraction layer supporting SQLite, MySQL, and PostgreSQL (Neon Cloud).

const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const rawType = process.env.DB_TYPE ? process.env.DB_TYPE.toLowerCase() : '';
const dbType = rawType || (process.env.DATABASE_URL ? 'postgres' : 'sqlite');
let dbInstance = null;

// Initialize connection
if (dbType === 'postgres' || dbType === 'neon') {
  const { Pool, types } = require('pg');
  // Parse int8 (BIGINT count) as standard integer
  types.setTypeParser(20, (val) => parseInt(val, 10));

  const connectionString = process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASS || ''}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'library_system'}`;

  const isCloudOrSsl = connectionString.includes('neon.tech') || 
                       connectionString.includes('sslmode=require') || 
                       process.env.DB_SSL === 'true';

  dbInstance = new Pool({
    connectionString,
    ssl: isCloudOrSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
  });

  dbInstance.on('error', (err) => {
    console.error('Unexpected PostgreSQL Pool Error:', err);
  });

  console.log('Database: Connected to PostgreSQL (Neon Cloud)');
} else if (dbType === 'mysql') {
  const mysql = require('mysql2');
  dbInstance = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'library_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  console.log('Database: Using MySQL Connection Pool');
} else {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.resolve(__dirname, 'library.db');
  dbInstance = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err.message);
    } else {
      console.log('Database: Connected to SQLite database at', dbPath);
    }
  });
}

// Convert ? parameter placeholders to $1, $2, ... for PostgreSQL
function toPostgresSql(sql) {
  let paramIndex = 1;
  let inQuotes = false;
  let result = '';
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      inQuotes = !inQuotes;
      result += ch;
    } else if (ch === '?' && !inQuotes) {
      result += `$${paramIndex++}`;
    } else {
      result += ch;
    }
  }
  return result;
}

// Promisified query function
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'postgres' || dbType === 'neon') {
      let pgSql = toPostgresSql(sql);
      const trimmedUpper = pgSql.trim().toUpperCase();

      // Automatically append RETURNING id for INSERT queries if not already present
      if (trimmedUpper.startsWith('INSERT INTO') && !trimmedUpper.includes('RETURNING')) {
        if (/\bINSERT\s+INTO\s+(students|attendance|admins)\b/i.test(pgSql)) {
          pgSql += ' RETURNING id';
        }
      }

      // Ensure undefined params are converted to null
      const safeParams = params.map(p => (p === undefined ? null : p));

      dbInstance.query(pgSql, safeParams, (err, res) => {
        if (err) return reject(err);
        const insertId = (res.rows && res.rows.length > 0 && res.rows[0].id !== undefined)
          ? res.rows[0].id 
          : null;

        resolve({
          rows: res.rows || [],
          insertId,
          affectedRows: res.rowCount || 0
        });
      });
    } else if (dbType === 'mysql') {
      dbInstance.query(sql, params, (err, results) => {
        if (err) return reject(err);
        
        // Adapt MySQL results to common format
        const response = {
          rows: Array.isArray(results) ? results : [],
          insertId: results ? results.insertId : null,
          affectedRows: results ? results.affectedRows : 0
        };
        resolve(response);
      });
    } else {
      // In SQLite, run for write queries, all for read queries
      const trimmedSql = sql.trim().toUpperCase();
      if (trimmedSql.startsWith('SELECT') || trimmedSql.startsWith('PRAGMA')) {
        dbInstance.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [], insertId: null, affectedRows: 0 });
        });
      } else {
        dbInstance.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({
            rows: [],
            insertId: this.lastID,
            affectedRows: this.changes
          });
        });
      }
    }
  });
}

// Database schema initialization
async function initDatabase() {
  try {
    if (dbType === 'postgres' || dbType === 'neon') {
      // PostgreSQL / Neon tables
      await query(`
        CREATE TABLE IF NOT EXISTS students (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          enrollment_no VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile VARCHAR(255) NOT NULL,
          department VARCHAR(255) NOT NULL,
          course VARCHAR(255) NOT NULL,
          semester VARCHAR(255) NOT NULL,
          gender VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          plain_password VARCHAR(255) DEFAULT 'student123'
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS attendance (
          id SERIAL PRIMARY KEY,
          student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
          entry_date VARCHAR(255) NOT NULL,
          entry_time VARCHAR(255) NOT NULL,
          exit_date VARCHAR(255),
          exit_time VARCHAR(255),
          duration VARCHAR(255),
          status VARCHAR(255) DEFAULT 'Inside',
          entry_latitude DOUBLE PRECISION,
          entry_longitude DOUBLE PRECISION,
          entry_location_name TEXT,
          distance_meters DOUBLE PRECISION
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admins (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS settings (
          key_name VARCHAR(255) PRIMARY KEY,
          value_text TEXT
        )
      `);
    } else if (dbType === 'mysql') {
      // Create MySQL tables
      await query(`
        CREATE TABLE IF NOT EXISTS students (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          enrollment_no VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) NOT NULL,
          mobile VARCHAR(255) NOT NULL,
          department VARCHAR(255) NOT NULL,
          course VARCHAR(255) NOT NULL,
          semester VARCHAR(255) NOT NULL,
          gender VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL,
          plain_password VARCHAR(255) DEFAULT 'student123'
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS attendance (
          id INT AUTO_INCREMENT PRIMARY KEY,
          student_id INT NOT NULL,
          entry_date VARCHAR(255) NOT NULL,
          entry_time VARCHAR(255) NOT NULL,
          exit_date VARCHAR(255),
          exit_time VARCHAR(255),
          duration VARCHAR(255),
          status VARCHAR(255) DEFAULT 'Inside',
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admins (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL
        )
      `);
      await query(`
        CREATE TABLE IF NOT EXISTS settings (
          key_name VARCHAR(255) PRIMARY KEY,
          value_text TEXT
        )
      `);
    } else {
      // Create SQLite tables (foreign keys enabled)
      await query('PRAGMA foreign_keys = ON');

      await query(`
        CREATE TABLE IF NOT EXISTS students (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          enrollment_no TEXT UNIQUE NOT NULL,
          email TEXT NOT NULL,
          mobile TEXT NOT NULL,
          department TEXT NOT NULL,
          course TEXT NOT NULL,
          semester TEXT NOT NULL,
          gender TEXT NOT NULL,
          password TEXT NOT NULL,
          plain_password TEXT DEFAULT 'student123'
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS attendance (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          student_id INTEGER NOT NULL,
          entry_date TEXT NOT NULL,
          entry_time TEXT NOT NULL,
          exit_date TEXT,
          exit_time TEXT,
          duration TEXT,
          status TEXT DEFAULT 'Inside',
          FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS admins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL
        )
      `);

      await query(`
        CREATE TABLE IF NOT EXISTS settings (
          key_name TEXT PRIMARY KEY,
          value_text TEXT
        )
      `);
    }

    // Migration to add plain_password to existing databases
    try {
      if (dbType === 'postgres' || dbType === 'neon') {
        await query("ALTER TABLE students ADD COLUMN IF NOT EXISTS plain_password VARCHAR(255) DEFAULT 'student123'");
      } else if (dbType === 'mysql') {
        await query("ALTER TABLE students ADD COLUMN plain_password VARCHAR(255) DEFAULT 'student123'");
      } else {
        await query("ALTER TABLE students ADD COLUMN plain_password TEXT DEFAULT 'student123'");
      }
      console.log('Database Migration: Added plain_password column successfully.');
    } catch (e) {
      // Column already exists, ignore
    }

    // Migration to add location columns to attendance table
    try {
      if (dbType === 'postgres' || dbType === 'neon') {
        await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS entry_latitude DOUBLE PRECISION");
        await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS entry_longitude DOUBLE PRECISION");
        await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS entry_location_name TEXT");
        await query("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS distance_meters DOUBLE PRECISION");
      } else if (dbType === 'mysql') {
        await query("ALTER TABLE attendance ADD COLUMN entry_latitude DOUBLE");
        await query("ALTER TABLE attendance ADD COLUMN entry_longitude DOUBLE");
        await query("ALTER TABLE attendance ADD COLUMN entry_location_name VARCHAR(500)");
        await query("ALTER TABLE attendance ADD COLUMN distance_meters DOUBLE");
      } else {
        await query("ALTER TABLE attendance ADD COLUMN entry_latitude REAL");
        await query("ALTER TABLE attendance ADD COLUMN entry_longitude REAL");
        await query("ALTER TABLE attendance ADD COLUMN entry_location_name TEXT");
        await query("ALTER TABLE attendance ADD COLUMN distance_meters REAL");
      }
      console.log('Database Migration: Added location columns to attendance table.');
    } catch (e) {
      // Columns already exist, ignore
    }

    // Seed default library location settings if not present
    try {
      const latResult = await query("SELECT * FROM settings WHERE key_name = 'library_latitude'");
      if (latResult.rows.length === 0) {
        await query("INSERT INTO settings (key_name, value_text) VALUES ('library_latitude', '23.0225')");
        await query("INSERT INTO settings (key_name, value_text) VALUES ('library_longitude', '72.5714')");
        console.log('Database Seeding: Default library location coordinates seeded.');
      }
    } catch (e) {
      console.error('Error seeding default settings:', e);
    }

    // Sync student passwords to mobile numbers as requested
    try {
      await query('UPDATE students SET email = LOWER(TRIM(email)), mobile = TRIM(mobile) WHERE email IS NOT NULL');

      const studentRows = await query('SELECT id, mobile, plain_password FROM students WHERE mobile IS NOT NULL AND mobile != \'\'');
      for (const st of studentRows.rows) {
        const cleanMobile = String(st.mobile).trim();
        if (cleanMobile) {
          const hashedMobile = await bcrypt.hash(cleanMobile, 10);
          await query('UPDATE students SET password = ?, plain_password = ? WHERE id = ?', [hashedMobile, cleanMobile, st.id]);
        }
      }
      console.log('Database Sync: Verified all student passwords are set to their mobile numbers.');
    } catch (e) {
      console.error('Error syncing student passwords to mobile numbers:', e);
    }

    console.log('Database tables verified/created successfully.');
    await seedAdmin();
  } catch (error) {
    console.error('Error during database schema initialization:', error);
  }
}

// Seed admin user
async function seedAdmin() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin@lj.edu';
    const result = await query('SELECT * FROM admins WHERE username = ?', [adminUsername]);
    
    if (result.rows.length === 0) {
      console.log('Seeding default admin account...');
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminName = process.env.ADMIN_NAME || 'Library Admin';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@lj.edu';
      
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      await query(
        'INSERT INTO admins (username, password, name, email) VALUES (?, ?, ?, ?)',
        [adminUsername, hashedPassword, adminName, adminEmail]
      );
      console.log(`Admin account seeded. Username: ${adminUsername}, Password: ${adminPassword}`);
    } else {
      console.log('Admin account already exists.');
    }
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
}

module.exports = {
  query,
  initDatabase,
  dbType
};
