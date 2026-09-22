const { Pool, types } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

// Parse int8 as integer in pg
types.setTypeParser(20, (val) => parseInt(val, 10));

const NEON_URL = process.env.DATABASE_URL;
if (!NEON_URL) {
  console.error('Error: DATABASE_URL not set in backend/.env');
  process.exit(1);
}

const pool = new Pool({
  connectionString: NEON_URL,
  ssl: { rejectUnauthorized: false }
});

const sqlitePath = path.resolve(__dirname, 'backend', 'library.db');
const sqliteDb = new sqlite3.Database(sqlitePath);

function sqliteAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    sqliteDb.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

async function migrate() {
  console.log('--- STARTING SQLITE TO NEON POSTGRESQL MIGRATION ---');

  const client = await pool.connect();
  try {
    // 1. Create tables in Neon
    console.log('Creating tables in Neon PostgreSQL...');
    await client.query(`
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
      );
    `);

    await client.query(`
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
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key_name VARCHAR(255) PRIMARY KEY,
        value_text TEXT
      );
    `);

    console.log('Tables created or verified in Neon PostgreSQL.');

    // 2. Fetch existing data from SQLite
    const students = await sqliteAll('SELECT * FROM students');
    const attendance = await sqliteAll('SELECT * FROM attendance');
    const admins = await sqliteAll('SELECT * FROM admins');
    const settings = await sqliteAll('SELECT * FROM settings');

    console.log(`Found in SQLite: ${students.length} students, ${attendance.length} attendance records, ${admins.length} admins, ${settings.length} settings.`);

    // 3. Migrate Students
    for (const s of students) {
      await client.query(`
        INSERT INTO students (id, name, enrollment_no, email, mobile, department, course, semester, gender, password, plain_password)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (enrollment_no) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          mobile = EXCLUDED.mobile,
          department = EXCLUDED.department,
          course = EXCLUDED.course,
          semester = EXCLUDED.semester,
          gender = EXCLUDED.gender,
          password = EXCLUDED.password,
          plain_password = EXCLUDED.plain_password
      `, [
        s.id, s.name, s.enrollment_no, s.email, s.mobile,
        s.department, s.course, s.semester, s.gender,
        s.password, s.plain_password || 'student123'
      ]);
    }
    console.log(`Migrated ${students.length} students.`);

    // 4. Migrate Attendance
    for (const a of attendance) {
      await client.query(`
        INSERT INTO attendance (id, student_id, entry_date, entry_time, exit_date, exit_time, duration, status, entry_latitude, entry_longitude, entry_location_name, distance_meters)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO UPDATE SET
          student_id = EXCLUDED.student_id,
          entry_date = EXCLUDED.entry_date,
          entry_time = EXCLUDED.entry_time,
          exit_date = EXCLUDED.exit_date,
          exit_time = EXCLUDED.exit_time,
          duration = EXCLUDED.duration,
          status = EXCLUDED.status,
          entry_latitude = EXCLUDED.entry_latitude,
          entry_longitude = EXCLUDED.entry_longitude,
          entry_location_name = EXCLUDED.entry_location_name,
          distance_meters = EXCLUDED.distance_meters
      `, [
        a.id, a.student_id, a.entry_date, a.entry_time,
        a.exit_date, a.exit_time, a.duration, a.status,
        a.entry_latitude, a.entry_longitude, a.entry_location_name, a.distance_meters
      ]);
    }
    console.log(`Migrated ${attendance.length} attendance records.`);

    // 5. Migrate Admins
    for (const adm of admins) {
      await client.query(`
        INSERT INTO admins (id, username, password, name, email)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (username) DO UPDATE SET
          password = EXCLUDED.password,
          name = EXCLUDED.name,
          email = EXCLUDED.email
      `, [adm.id, adm.username, adm.password, adm.name, adm.email]);
    }
    console.log(`Migrated ${admins.length} admins.`);

    // 6. Migrate Settings
    for (const set of settings) {
      await client.query(`
        INSERT INTO settings (key_name, value_text)
        VALUES ($1, $2)
        ON CONFLICT (key_name) DO UPDATE SET
          value_text = EXCLUDED.value_text
      `, [set.key_name, set.value_text]);
    }
    console.log(`Migrated ${settings.length} settings.`);

    // 7. Reset sequences to avoid ID collision
    await client.query(`SELECT setval(pg_get_serial_sequence('students', 'id'), COALESCE((SELECT MAX(id) FROM students), 1));`);
    await client.query(`SELECT setval(pg_get_serial_sequence('attendance', 'id'), COALESCE((SELECT MAX(id) FROM attendance), 1));`);
    await client.query(`SELECT setval(pg_get_serial_sequence('admins', 'id'), COALESCE((SELECT MAX(id) FROM admins), 1));`);
    console.log('Sequence counters reset to current maximum IDs.');

    // 8. Verify row counts
    const sCount = await client.query('SELECT COUNT(*) as count FROM students');
    const aCount = await client.query('SELECT COUNT(*) as count FROM attendance');
    const admCount = await client.query('SELECT COUNT(*) as count FROM admins');
    const setCount = await client.query('SELECT COUNT(*) as count FROM settings');

    console.log('\n--- VERIFICATION IN NEON POSTGRESQL ---');
    console.log(`Students in Neon: ${sCount.rows[0].count}`);
    console.log(`Attendance in Neon: ${aCount.rows[0].count}`);
    console.log(`Admins in Neon: ${admCount.rows[0].count}`);
    console.log(`Settings in Neon: ${setCount.rows[0].count}`);
    console.log('--- MIGRATION COMPLETED SUCCESSFULLY! ---');

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    client.release();
    await pool.end();
    sqliteDb.close();
  }
}

migrate();
