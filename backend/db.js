// db.js
// Database abstraction layer supporting both SQLite and MySQL.

const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbType = (process.env.DB_TYPE || 'sqlite').toLowerCase();
let dbInstance = null;

// Initialize connection
if (dbType === 'mysql') {
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

// Promisified query function
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    if (dbType === 'mysql') {
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
    if (dbType === 'mysql') {
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
      if (dbType === 'mysql') {
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
      if (dbType === 'mysql') {
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

    console.log('Database tables verified/created successfully.');
    await seedAdmin();
  } catch (error) {
    console.error('Error during database schema initialization:', error);
  }
}

// Seed admin user
async function seedAdmin() {
  try {
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const result = await query('SELECT * FROM admins WHERE username = ?', [adminUsername]);
    
    if (result.rows.length === 0) {
      console.log('Seeding default admin account...');
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const adminName = process.env.ADMIN_NAME || 'Library Admin';
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@library.com';
      
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
