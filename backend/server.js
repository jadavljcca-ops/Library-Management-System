// server.js
// Express Server for Smart Library QR Entry Management System

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const db = require('./db');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const server = http.createServer(app);

// Configure Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'smart_library_secret_key_2026';
const LIBRARY_QR_CODE = process.env.LIBRARY_QR_CODE || 'SMART_LIBRARY_QR_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend'))); // Serve static frontend files

// Real-time Socket.io connections
let adminSockets = new Set();
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('register-admin', () => {
    adminSockets.add(socket.id);
    console.log(`Admin registered: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    adminSockets.delete(socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

// Time Helper Functions (Using local time)
function getLocalDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

function getLocalTimeString() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

// Calculate Duration between Entry and Exit
function calculateDuration(entryDateStr, entryTimeStr, exitDateStr, exitTimeStr) {
  try {
    const entryStr = `${entryDateStr}T${entryTimeStr}`;
    const exitStr = `${exitDateStr}T${exitTimeStr}`;
    const entry = new Date(entryStr);
    const exit = new Date(exitStr);
    
    let diffMs = exit - entry;
    if (isNaN(diffMs) || diffMs < 0) return '0s';

    const diffSecs = Math.floor(diffMs / 1000);
    const hours = Math.floor(diffSecs / 3600);
    const minutes = Math.floor((diffSecs % 3600) / 60);
    const seconds = diffSecs % 60;

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

    return parts.join(' ');
  } catch (error) {
    console.error('Error calculating duration:', error);
    return '0s';
  }
}

// JWT Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access Denied: No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Access Denied: Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
}

// Admin Check Middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access Denied: Admins only.' });
  }
}

// ==========================================
// AUTHENTICATION APIS
// ==========================================

// Student Registration
app.post('/api/auth/register', async (req, res) => {
  const {
    name,
    enrollment_no,
    email,
    mobile,
    department,
    course,
    semester,
    gender,
    password,
    confirmPassword
  } = req.body;

  // Validations
  if (!name || !enrollment_no || !email || !mobile || !department || !course || !semester || !gender || !password) {
    return res.status(400).json({ success: false, message: 'All registration fields are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  try {
    // Check if enrollment number or email already exists
    const checkUser = await db.query(
      'SELECT id FROM students WHERE enrollment_no = ? OR email = ?',
      [enrollment_no, email]
    );

    if (checkUser.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'Enrollment Number or Email is already registered.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert student
    await db.query(
      `INSERT INTO students (name, enrollment_no, email, mobile, department, course, semester, gender, password, plain_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, enrollment_no, email, mobile, department, course, semester, gender, hashedPassword, password]
    );

    res.status(201).json({ success: true, message: 'Registration successful! You can now log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// Universal Login (Student / Admin)
app.post('/api/auth/login', async (req, res) => {
  const { usernameOrEnrollment, password, role } = req.body;

  if (!usernameOrEnrollment || !password || !role) {
    return res.status(400).json({ success: false, message: 'Please provide credentials and role.' });
  }

  try {
    if (role === 'admin') {
      // Admin Login
      const result = await db.query('SELECT * FROM admins WHERE username = ? OR email = ?', [usernameOrEnrollment, usernameOrEnrollment]);
      if (result.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Admin credentials not found.' });
      }

      const admin = result.rows[0];
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect admin password.' });
      }

      // Generate JWT Token
      const token = jwt.sign(
        { id: admin.id, name: admin.name, username: admin.username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        success: true,
        message: 'Admin login successful!',
        token,
        user: { name: admin.name, username: admin.username, role: 'admin' }
      });
    } else {
      // Student Login
      const result = await db.query('SELECT * FROM students WHERE enrollment_no = ? OR email = ?', [usernameOrEnrollment, usernameOrEnrollment]);
      if (result.rows.length === 0) {
        return res.status(400).json({ success: false, message: 'Enrollment number or email is not registered.' });
      }

      const student = result.rows[0];
      const isMatch = await bcrypt.compare(password, student.password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Incorrect password.' });
      }


      // Generate JWT Token
      const token = jwt.sign(
        {
          id: student.id,
          name: student.name,
          enrollment_no: student.enrollment_no,
          email: student.email,
          role: 'student'
        },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: {
          id: student.id,
          name: student.name,
          enrollment_no: student.enrollment_no,
          email: student.email,
          role: 'student'
        }
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Get Student Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Requires Student permissions.' });
  }

  try {
    const result = await db.query(
      'SELECT name, enrollment_no, email, mobile, department, course, semester, gender FROM students WHERE id = ?',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Profile details not found.' });
    }

    res.json({ success: true, profile: result.rows[0] });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Server error fetching profile details.' });
  }
});

// Change Password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
  }

  try {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const tableName = isAdmin ? 'admins' : 'students';

    // Fetch current password
    const result = await db.query(`SELECT password FROM ${tableName} WHERE id = ?`, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User record not found.' });
    }

    const currentHashed = result.rows[0].password;
    const isMatch = await bcrypt.compare(oldPassword, currentHashed);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    // Hash new password and update
    const newHashed = await bcrypt.hash(newPassword, 10);
    await db.query(`UPDATE ${tableName} SET password = ? WHERE id = ?`, [newHashed, userId]);

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error updating password.' });
  }
});

// Forgot Password Mock (returns instructions)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { enrollmentOrEmail } = req.body;

  if (!enrollmentOrEmail) {
    return res.status(400).json({ success: false, message: 'Please provide enrollment number or email.' });
  }

  try {
    // Check if exists
    const checkUser = await db.query(
      'SELECT name, email FROM students WHERE enrollment_no = ? OR email = ?',
      [enrollmentOrEmail, enrollmentOrEmail]
    );

    if (checkUser.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No student found with that identifier.' });
    }

    // In a production app, we would send an email. For this project, we return a mock success message.
    res.json({
      success: true,
      message: `A password reset link has been dispatched to ${checkUser.rows[0].email}. Please check your inbox.`
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error processing request.' });
  }
});

// ==========================================
// ATTENDANCE APIS (QR SCAN)
// ==========================================

// QR Scan Handler
app.post('/api/attendance/scan', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Scanning is restricted to students.' });
  }

  const { qrCode } = req.body;

  if (!qrCode) {
    return res.status(400).json({ success: false, message: 'QR Code contents are required.' });
  }

  // Validate QR Code value
  if (qrCode !== LIBRARY_QR_CODE) {
    return res.status(400).json({ success: false, message: 'Invalid QR Code. Please scan the official Library QR Code.' });
  }

  const studentId = req.user.id;

  try {
    // Fetch student data
    const studentQuery = await db.query(
      'SELECT name, enrollment_no, department, course, semester FROM students WHERE id = ?',
      [studentId]
    );

    if (studentQuery.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student record not found.' });
    }

    const student = studentQuery.rows[0];

    // Check for an active session (status = 'Inside' AND exit_time IS NULL)
    const activeSessionQuery = await db.query(
      "SELECT * FROM attendance WHERE student_id = ? AND status = 'Inside' AND exit_time IS NULL ORDER BY id DESC LIMIT 1",
      [studentId]
    );

    const todayDate = getLocalDateString();
    const todayTime = getLocalTimeString();

    if (activeSessionQuery.rows.length === 0) {
      // CASE 1: No active session -> Record Entry
      const insertResult = await db.query(
        `INSERT INTO attendance (student_id, entry_date, entry_time, exit_date, exit_time, duration, status)
         VALUES (?, ?, ?, NULL, NULL, NULL, 'Inside')`,
        [studentId, todayDate, todayTime]
      );

      const entryRecord = {
        id: insertResult.insertId,
        student_id: studentId,
        name: student.name,
        enrollment_no: student.enrollment_no,
        department: student.department,
        course: student.course,
        semester: student.semester,
        entry_date: todayDate,
        entry_time: todayTime,
        status: 'Inside'
      };

      // Broadcast entry to admin clients in real time
      io.emit('student-entry', entryRecord);

      return res.json({
        success: true,
        action: 'entry',
        message: 'Entry Recorded Successfully',
        data: entryRecord
      });
    } else {
      // CASE 2: Active session exists -> Record Exit
      const session = activeSessionQuery.rows[0];
      const durationStr = calculateDuration(session.entry_date, session.entry_time, todayDate, todayTime);

      await db.query(
        `UPDATE attendance 
         SET exit_date = ?, exit_time = ?, duration = ?, status = 'Exited' 
         WHERE id = ?`,
        [todayDate, todayTime, durationStr, session.id]
      );

      const exitRecord = {
        id: session.id,
        student_id: studentId,
        name: student.name,
        enrollment_no: student.enrollment_no,
        department: student.department,
        course: student.course,
        semester: student.semester,
        entry_date: session.entry_date,
        entry_time: session.entry_time,
        exit_date: todayDate,
        exit_time: todayTime,
        duration: durationStr,
        status: 'Exited'
      };

      // Broadcast exit to admin clients in real time
      io.emit('student-exit', exitRecord);

      return res.json({
        success: true,
        action: 'exit',
        message: 'Exit Recorded Successfully',
        data: exitRecord
      });
    }
  } catch (error) {
    console.error('Scan attendance error:', error);
    res.status(500).json({ success: false, message: 'Server error processing scan.' });
  }
});

// Get Student Attendance Status (Inside or Outside)
app.get('/api/attendance/status', authenticateToken, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Requires Student permissions.' });
  }

  try {
    const activeSessionQuery = await db.query(
      "SELECT id FROM attendance WHERE student_id = ? AND status = 'Inside' AND exit_time IS NULL ORDER BY id DESC LIMIT 1",
      [req.user.id]
    );

    res.json({
      success: true,
      isInside: activeSessionQuery.rows.length > 0
    });
  } catch (error) {
    console.error('Get attendance status error:', error);
    res.status(500).json({ success: false, message: 'Server error checking active status.' });
  }
});

// ==========================================
// ADMIN DASHBOARD & REPORT APIS
// ==========================================

// Dashboard Aggregated Statistics
app.get('/api/admin/dashboard-stats', authenticateToken, requireAdmin, async (req, res) => {
  const todayDate = getLocalDateString();

  try {
    // 1. Total Registered Students
    const totalStudentsResult = await db.query('SELECT COUNT(*) AS total FROM students');
    const totalStudents = totalStudentsResult.rows[0].total;

    // 2. Students Currently Inside
    const insideResult = await db.query("SELECT COUNT(*) AS total FROM attendance WHERE status = 'Inside'");
    const insideCount = insideResult.rows[0].total;

    // 3. Total Entries Today
    const entriesTodayResult = await db.query('SELECT COUNT(*) AS total FROM attendance WHERE entry_date = ?', [todayDate]);
    const entriesToday = entriesTodayResult.rows[0].total;

    // 4. Total Exits Today
    const exitsTodayResult = await db.query("SELECT COUNT(*) AS total FROM attendance WHERE exit_date = ? AND status = 'Exited'", [todayDate]);
    const exitsToday = exitsTodayResult.rows[0].total;

    // 5. Chart data: Distribution by Department (Inside or Active Today)
    const deptDistributionResult = await db.query(`
      SELECT s.department, COUNT(*) AS count 
      FROM attendance a
      JOIN students s ON a.student_id = s.id
      WHERE a.entry_date = ?
      GROUP BY s.department
    `, [todayDate]);

    // 6. Chart data: Hourly entries trend today (00 to 23 hours)
    // SQLite uses strftime('%H', entry_time) or substr(entry_time, 1, 2)
    // MySQL uses HOUR(entry_time) or DATE_FORMAT(entry_time, '%H')
    let hourlyQuery = '';
    if (db.dbType === 'mysql') {
      hourlyQuery = `
        SELECT HOUR(entry_time) AS hr, COUNT(*) AS count 
        FROM attendance 
        WHERE entry_date = ?
        GROUP BY HOUR(entry_time)
        ORDER BY hr
      `;
    } else {
      hourlyQuery = `
        SELECT CAST(SUBSTR(entry_time, 1, 2) AS INTEGER) AS hr, COUNT(*) AS count 
        FROM attendance 
        WHERE entry_date = ?
        GROUP BY hr
        ORDER BY hr
      `;
    }
    const hourlyTrendResult = await db.query(hourlyQuery, [todayDate]);

    res.json({
      success: true,
      stats: {
        totalStudents,
        insideCount,
        entriesToday,
        exitsToday,
        departmentDistribution: deptDistributionResult.rows,
        hourlyTrend: hourlyTrendResult.rows
      }
    });
  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Server error compiling dashboard data.' });
  }
});

// Search & Filter Attendance Records
app.get('/api/admin/attendance-records', authenticateToken, requireAdmin, async (req, res) => {
  const { search, department, date, course, semester, status } = req.query;

  let queryStr = `
    SELECT 
      a.id, 
      a.entry_date, 
      a.entry_time, 
      a.exit_date, 
      a.exit_time, 
      a.duration, 
      a.status,
      s.name, 
      s.enrollment_no, 
      s.department, 
      s.course, 
      s.semester
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    // MySQL supports LIKE. SQLite supports LIKE (case-insensitive by default)
    queryStr += ' AND (s.name LIKE ? OR s.enrollment_no LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (department) {
    queryStr += ' AND s.department = ?';
    params.push(department);
  }

  if (date) {
    queryStr += ' AND a.entry_date = ?';
    params.push(date);
  }

  if (course) {
    queryStr += ' AND s.course = ?';
    params.push(course);
  }

  if (semester) {
    queryStr += ' AND s.semester = ?';
    params.push(semester);
  }

  if (status) {
    queryStr += ' AND a.status = ?';
    params.push(status);
  }

  // Sort by entry date and entry time descending
  queryStr += ' ORDER BY a.entry_date DESC, a.entry_time DESC';

  try {
    const result = await db.query(queryStr, params);
    res.json({ success: true, records: result.rows });
  } catch (error) {
    console.error('Fetch attendance records error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving reports.' });
  }
});

// Fetch All Registered Students (Admin Only)
app.get('/api/admin/students', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, enrollment_no, email, mobile, department, course, semester, gender, plain_password FROM students ORDER BY name ASC'
    );
    res.json({ success: true, students: result.rows });
  } catch (error) {
    console.error('Fetch registered students error:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving registered students.' });
  }
});

// Bulk Import Students (Admin Only)
app.post('/api/admin/students/import', authenticateToken, requireAdmin, async (req, res) => {
  const { students } = req.body;

  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ success: false, message: 'Invalid students list provided.' });
  }

  try {
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const student of students) {
      const { name, enrollment_no, email, mobile, department, course, semester, gender, password } = student;
      
      // Basic validation
      if (!name || !enrollment_no || !email || !mobile || !department || !course || !semester || !gender || !password) {
        skippedCount++;
        errors.push(`Row for ${name || 'unknown'} is missing required fields (including password).`);
        continue;
      }

      const plainPassword = String(password).trim();
      if (!plainPassword) {
        skippedCount++;
        errors.push(`Row for ${name || 'unknown'} has an empty password.`);
        continue;
      }

      try {
        // Check duplicate enrollment number or email
        const checkUser = await db.query(
          'SELECT id FROM students WHERE enrollment_no = ? OR email = ?',
          [enrollment_no, email]
        );

        if (checkUser.rows.length > 0) {
          skippedCount++;
          errors.push(`Student with Enrollment '${enrollment_no}' or Email '${email}' is already registered.`);
          continue;
        }

        // Hash custom password
        const hashedPassword = await bcrypt.hash(plainPassword, 10);

        // Insert student record
        await db.query(
          `INSERT INTO students (name, enrollment_no, email, mobile, department, course, semester, gender, password, plain_password)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [name, enrollment_no, email, mobile, department, course, semester, gender, hashedPassword, plainPassword]
        );
        importedCount++;
      } catch (err) {
        console.error('Database error during student import:', err);
        skippedCount++;
        errors.push(`Database error for enrollment '${enrollment_no}': ${err.message}`);
      }
    }

    res.json({
      success: true,
      message: `Import complete. Imported: ${importedCount}, Skipped: ${skippedCount}`,
      importedCount,
      skippedCount,
      errors
    });
  } catch (error) {
    console.error('Bulk import process error:', error);
    res.status(500).json({ success: false, message: 'Server error during bulk import process.' });
  }
});

// Delete Student Record (Admin Only)
app.delete('/api/admin/students/:id', authenticateToken, requireAdmin, async (req, res) => {
  const studentId = req.params.id;

  try {
    const result = await db.query('DELETE FROM students WHERE id = ?', [studentId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, message: 'Student record deleted successfully!' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ success: false, message: 'Server error deleting student record.' });
  }
});


// Start Server and database verification
db.initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`Server is running in ${db.dbType} mode on port ${PORT}`);
  });
}).catch(err => {
  console.error('Fatal: Failed to initialize database database.', err);
});
