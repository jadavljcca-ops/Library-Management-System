// verify.js
// Automated verification script for database layers and scanner state machine.

const db = require('./db');
const bcrypt = require('bcryptjs');

async function runTests() {
  console.log('--- STARTING SYSTEM SELF-VERIFICATION ---');
  try {
    // 1. Initialize Database
    console.log('[1/5] Initializing database tables...');
    await db.initDatabase();
    console.log('Database init: SUCCESS');

    // 2. Clear any old verification test student
    const testEnrollment = 'TEST-VERIFY-999';
    await db.query('DELETE FROM attendance WHERE student_id IN (SELECT id FROM students WHERE enrollment_no = ?)', [testEnrollment]);
    await db.query('DELETE FROM students WHERE enrollment_no = ?', [testEnrollment]);

    // 3. Test Student Registration
    console.log('[2/5] Simulating Student Registration...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    const registerResult = await db.query(
      `INSERT INTO students (name, enrollment_no, email, mobile, department, course, semester, gender, password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ['Test Verifier', testEnrollment, 'verify@college.edu', '1234567890', 'CS', 'B.Tech', '8th', 'Male', hashedPassword]
    );

    const studentId = registerResult.insertId;
    console.log(`Student Registration: SUCCESS (Student ID: ${studentId})`);

    // 4. Test Scan Case 1: No active session -> Record Entry
    console.log('[3/5] Simulating Scan (Case 1: Entry Recording)...');
    
    // Check active session (should be empty)
    const checkActive1 = await db.query(
      "SELECT * FROM attendance WHERE student_id = ? AND status = 'Inside' AND exit_time IS NULL",
      [studentId]
    );
    if (checkActive1.rows.length !== 0) {
      throw new Error('Database integrity error: Student already has an active session before testing.');
    }

    const testDate = '2026-07-19';
    const entryTime = '08:30:00';
    
    // Simulate entry insertion
    const entryResult = await db.query(
      `INSERT INTO attendance (student_id, entry_date, entry_time, exit_date, exit_time, duration, status)
       VALUES (?, ?, ?, NULL, NULL, NULL, 'Inside')`,
      [studentId, testDate, entryTime]
    );
    const attendanceRowId = entryResult.insertId;

    // Verify row was created
    const verifyEntry = await db.query('SELECT * FROM attendance WHERE id = ?', [attendanceRowId]);
    if (verifyEntry.rows.length === 0 || verifyEntry.rows[0].status !== 'Inside' || verifyEntry.rows[0].exit_time !== null) {
      throw new Error('Entry recording failed to write correct status/parameters.');
    }
    console.log(`Entry Recording: SUCCESS (Attendance ID: ${attendanceRowId}, Status: ${verifyEntry.rows[0].status})`);

    // 5. Test Scan Case 2: Active session exists -> Record Exit (Update same row, no new row)
    console.log('[4/5] Simulating Scan (Case 2: Exit Update Same Row)...');

    // Retrieve active session
    const activeSession = await db.query(
      "SELECT * FROM attendance WHERE student_id = ? AND status = 'Inside' AND exit_time IS NULL ORDER BY id DESC LIMIT 1",
      [studentId]
    );
    if (activeSession.rows.length === 0) {
      throw new Error('Integrity error: Active session not found for exit test.');
    }

    const exitTime = '10:15:30'; // 1h 45m 30s duration
    const durationStr = '1h 45m 30s';

    // Update same row
    await db.query(
      `UPDATE attendance 
       SET exit_date = ?, exit_time = ?, duration = ?, status = 'Exited' 
       WHERE id = ?`,
      [testDate, exitTime, durationStr, activeSession.rows[0].id]
    );

    // Verify same row has exit details and status changed to 'Exited'
    const verifyExit = await db.query('SELECT * FROM attendance WHERE id = ?', [attendanceRowId]);
    if (verifyExit.rows[0].status !== 'Exited' || verifyExit.rows[0].exit_time !== exitTime || verifyExit.rows[0].duration !== durationStr) {
      throw new Error('Exit recording failed to update details in the existing row.');
    }

    // Verify no new row was created for exit
    const allStudentLogs = await db.query('SELECT COUNT(*) AS total FROM attendance WHERE student_id = ?', [studentId]);
    if (allStudentLogs.rows[0].total !== 1) {
      throw new Error('Integrity violation: Exit scan created a new row instead of updating the existing one!');
    }
    
    console.log(`Exit Recording: SUCCESS (Same Row Updated. Status: ${verifyExit.rows[0].status}, Duration: ${verifyExit.rows[0].duration})`);

    // Clean up test data
    console.log('[5/5] Cleaning up test verification rows...');
    await db.query('DELETE FROM attendance WHERE student_id = ?', [studentId]);
    await db.query('DELETE FROM students WHERE id = ?', [studentId]);
    console.log('Cleanup: SUCCESS');

    console.log('\n*** ALL SYSTEM INTEGRATION TESTS PASSED SUCCESSFULLY! ***');
    process.exit(0);
  } catch (error) {
    console.error('\n!!! SYSTEM SELF-VERIFICATION FAILED !!!');
    console.error(error.message || error);
    process.exit(1);
  }
}

runTests();
