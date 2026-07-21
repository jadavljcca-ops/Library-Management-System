// admin.js
// Admin Dashboard Frontend Client Logic

// Configuration
const API_URL = '';

// State
let token = localStorage.getItem('admin_token') || null;
let currentUser = null;
let socket = null;

// Table Pagination State
let allRecords = [];
let currentPage = 1;
const rowsPerPage = 10;

// Chart Instances
let hourlyChartInstance = null;
let departmentChartInstance = null;

// DOM Elements
const adminAuthContainer = document.getElementById('adminAuthContainer');
const adminDashboardContainer = document.getElementById('adminDashboardContainer');
const adminLoginForm = document.getElementById('adminLoginForm');

// Navigation Links
const menuDashBtn = document.getElementById('menuDashBtn');
const menuReportsBtn = document.getElementById('menuReportsBtn');
const menuStudentsBtn = document.getElementById('menuStudentsBtn');
const pageTitle = document.getElementById('pageTitle');
const sectionDashboard = document.getElementById('sectionDashboard');
const sectionReports = document.getElementById('sectionReports');
const sectionStudents = document.getElementById('sectionStudents');

const adminSettingsBtn = document.getElementById('adminSettingsBtn');
const adminLogoutBtn = document.getElementById('adminLogoutBtn');

// Import / File Upload Elements
const importDragArea = document.getElementById('importDragArea');
const studentsImportFile = document.getElementById('studentsImportFile');
const importFileStatus = document.getElementById('importFileStatus');
const importFileName = document.getElementById('importFileName');
const importFileSize = document.getElementById('importFileSize');
const btnCancelImport = document.getElementById('btnCancelImport');
const btnDownloadTemplate = document.getElementById('btnDownloadTemplate');
const btnLoadDemoData = document.getElementById('btnLoadDemoData');
const btnSubmitImport = document.getElementById('btnSubmitImport');

// Students DB Table Elements
const studentsDbSearchInput = document.getElementById('studentsDbSearchInput');
const studentsDbTableBody = document.getElementById('studentsDbTableBody');
const studentsDbPageInfo = document.getElementById('studentsDbPageInfo');
const btnStudentsDbPrevPage = document.getElementById('btnStudentsDbPrevPage');
const btnStudentsDbNextPage = document.getElementById('btnStudentsDbNextPage');

let allStudentsDb = [];
let filteredStudentsDb = [];
let currentStudentsPage = 1;
const studentsRowsPerPage = 10;
let importFilePending = null;
let previewStudentsList = [];

// Preview Card DOM Elements
const importPreviewCard = document.getElementById('importPreviewCard');
const previewTableBody = document.getElementById('previewTableBody');
const btnPreviewAddRow = document.getElementById('btnPreviewAddRow');
const btnPreviewCancel = document.getElementById('btnPreviewCancel');
const btnPreviewConfirm = document.getElementById('btnPreviewConfirm');
const previewCountText = document.getElementById('previewCountText');

// Modals
const adminSettingsModal = document.getElementById('adminSettingsModal');
const closeAdminSettings = document.getElementById('closeAdminSettings');
const cancelAdminSettings = document.getElementById('cancelAdminSettings');
const adminChangePasswordForm = document.getElementById('adminChangePasswordForm');

// Registered Students Modal & Cards
const registeredStudentsModal = document.getElementById('registeredStudentsModal');
const closeStudentsModal = document.getElementById('closeStudentsModal');
const closeStudentsModalBtn = document.getElementById('closeStudentsModalBtn');
const registeredStudentsTableBody = document.getElementById('registeredStudentsTableBody');
const studentsSearchInput = document.getElementById('studentsSearchInput');
const modalTotalStudentsCount = document.getElementById('modalTotalStudentsCount');

const cardTotalStudents = document.getElementById('cardTotalStudents');
const cardInsideLibrary = document.getElementById('cardInsideLibrary');
const cardEntriesToday = document.getElementById('cardEntriesToday');
const cardExitsToday = document.getElementById('cardExitsToday');

let registeredStudentsList = [];

// Themes
const adminThemeToggle = document.getElementById('adminThemeToggle');

// Stat Elements
const statTotalStudents = document.getElementById('statTotalStudents');
const statInsideLibrary = document.getElementById('statInsideLibrary');
const statEntriesToday = document.getElementById('statEntriesToday');
const statExitsToday = document.getElementById('statExitsToday');
const realTimeAlertsList = document.getElementById('realTimeAlertsList');

// Filters Form
const filtersForm = document.getElementById('filtersForm');
const btnResetFilters = document.getElementById('btnResetFilters');

// Table Body
const attendanceTableBody = document.getElementById('attendanceTableBody');
const tablePageInfo = document.getElementById('tablePageInfo');
const btnPrevPage = document.getElementById('btnPrevPage');
const btnNextPage = document.getElementById('btnNextPage');

// Quick Reports Filters (Daily/Weekly/Monthly)
const btnDailyReport = document.getElementById('btnDailyReport');
const btnWeeklyReport = document.getElementById('btnWeeklyReport');
const btnMonthlyReport = document.getElementById('btnMonthlyReport');

// Export Triggers
const exportExcelBtn = document.getElementById('exportExcelBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');

// Loaders
const adminLoader = document.getElementById('adminLoader');

// ==========================================
// THEME MANAGEMENT
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcons(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  updateThemeIcons(newTheme);
  showToast(`Switched to ${newTheme} mode.`, 'info');
}

function updateThemeIcons(theme) {
  const icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
  adminThemeToggle.innerHTML = `<i class="fa-solid ${icon}"></i>`;
}

if (adminThemeToggle) adminThemeToggle.addEventListener('click', toggleTheme);

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('adminToastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let icon = 'fa-circle-info';
  if (type === 'success') icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${icon} toast-icon"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    toast.style.animation = 'toastIn 0.3s reverse forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function showLoader(show = true) {
  if (show) {
    adminLoader.classList.add('active');
  } else {
    adminLoader.classList.remove('active');
  }
}

// Live Clock for Admin Dashboard
function startClock() {
  const clockEl = document.getElementById('adminLiveClock');
  if (!clockEl) return;

  setInterval(() => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');

    clockEl.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }, 1000);
}

// ==========================================
// API CALLS & CHARTS INITIALIZATION
// ==========================================
async function fetchDashboardStats() {
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/api/admin/dashboard-stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      // Update key stats counts
      statTotalStudents.textContent = data.stats.totalStudents;
      statInsideLibrary.textContent = data.stats.insideCount;
      statEntriesToday.textContent = data.stats.entriesToday;
      statExitsToday.textContent = data.stats.exitsToday;

      // Update Charts
      updateHourlyChart(data.stats.hourlyTrend);
      updateDepartmentChart(data.stats.departmentDistribution);
    } else {
      showToast(data.message || 'Failed to fetch dashboard statistics.', 'error');
      if (res.status === 401 || res.status === 403) logout();
    }
  } catch (error) {
    console.error('Fetch dashboard stats error:', error);
    showToast('Failed to connect to stats API.', 'error');
  }
}

// Draw/Update Hourly traffic line chart
function updateHourlyChart(trendData) {
  const ctx = document.getElementById('hourlyTrendChart').getContext('2d');
  
  // Fill all 24 hours with 0 entries by default
  const hourlyCounts = Array(24).fill(0);
  trendData.forEach(item => {
    if (item.hr >= 0 && item.hr < 24) {
      hourlyCounts[item.hr] = item.count;
    }
  });

  const labels = Array.from({ length: 24 }, (_, i) => {
    const hr = i % 12 || 12;
    const ampm = i >= 12 ? 'PM' : 'AM';
    return `${hr} ${ampm}`;
  });

  const chartColors = getChartColorPalette();

  if (hourlyChartInstance) {
    hourlyChartInstance.data.datasets[0].data = hourlyCounts;
    hourlyChartInstance.options.scales.x.grid.color = chartColors.gridColor;
    hourlyChartInstance.options.scales.y.grid.color = chartColors.gridColor;
    hourlyChartInstance.options.scales.x.ticks.color = chartColors.textColor;
    hourlyChartInstance.options.scales.y.ticks.color = chartColors.textColor;
    hourlyChartInstance.update();
  } else {
    hourlyChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total Scanned Entries',
          data: hourlyCounts,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          borderWidth: 3,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#6366f1',
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1, color: chartColors.textColor },
            grid: { color: chartColors.gridColor }
          },
          x: {
            ticks: { color: chartColors.textColor },
            grid: { color: chartColors.gridColor }
          }
        }
      }
    });
  }
}

// Draw/Update Department pie distribution
function updateDepartmentChart(deptData) {
  const ctx = document.getElementById('departmentChart').getContext('2d');
  
  const labels = deptData.map(item => item.department || 'Unknown');
  const counts = deptData.map(item => item.count);

  const colors = [
    '#6366f1', '#10b981', '#06b6d4', '#f59e0b', 
    '#ec4899', '#8b5cf6', '#3b82f6', '#14b8a6'
  ];

  const chartColors = getChartColorPalette();

  if (departmentChartInstance) {
    departmentChartInstance.data.labels = labels;
    departmentChartInstance.data.datasets[0].data = counts;
    departmentChartInstance.options.plugins.legend.labels.color = chartColors.textColor;
    departmentChartInstance.update();
  } else {
    departmentChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: counts,
          backgroundColor: colors.slice(0, Math.max(1, labels.length)),
          borderWidth: 2,
          borderColor: 'var(--card-bg)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 12,
              font: { family: 'Outfit', size: 12 },
              color: chartColors.textColor
            }
          }
        }
      }
    });
  }
}

// Dynamic chart fonts adjusting with light/dark theme switch
function getChartColorPalette() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    textColor: isDark ? '#94a3b8' : '#64748b',
    gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'
  };
}

// Fetch report logs with filters
async function fetchAttendanceRecords(filters = {}) {
  if (!token) return;

  const urlParams = new URLSearchParams(filters);
  try {
    const res = await fetch(`${API_URL}/api/admin/attendance-records?${urlParams.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      allRecords = data.records;
      currentPage = 1;
      renderTable();
    } else {
      showToast(data.message || 'Failed to download reports.', 'error');
    }
  } catch (error) {
    console.error('Fetch attendance records error:', error);
    showToast('Failed to connect to report database database.', 'error');
  }
}

// Render paginated records
function renderTable() {
  attendanceTableBody.innerHTML = '';
  
  if (allRecords.length === 0) {
    attendanceTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
          No matching attendance sessions found.
        </td>
      </tr>
    `;
    tablePageInfo.textContent = 'Showing 0 to 0 of 0 entries';
    btnPrevPage.disabled = true;
    btnNextPage.disabled = true;
    return;
  }

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, allRecords.length);
  const paginatedData = allRecords.slice(startIndex, endIndex);

  paginatedData.forEach(row => {
    const tr = document.createElement('tr');
    
    // Status Badge
    const isInside = row.status === 'Inside';
    const statusClass = isInside ? 'badge-success' : 'badge-info';
    const statusText = isInside ? 'Inside' : 'Exited';
    
    tr.innerHTML = `
      <td><strong>${row.entry_date}</strong></td>
      <td>${row.name}</td>
      <td><code>${row.enrollment_no}</code></td>
      <td>${row.department}</td>
      <td>${row.course} <span style="color: var(--text-muted); font-size: 0.8rem;">(${row.semester})</span></td>
      <td>${row.entry_time}</td>
      <td>${row.exit_date || '-'}</td>
      <td>${row.exit_time || '-'}</td>
      <td>${row.duration || '-'}</td>
      <td>
        <span class="badge ${statusClass}">
          <span class="badge-dot"></span> ${statusText}
        </span>
      </td>
    `;
    attendanceTableBody.appendChild(tr);
  });

  tablePageInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${allRecords.length} entries`;

  // Control buttons disabled status
  btnPrevPage.disabled = currentPage === 1;
  btnNextPage.disabled = endIndex >= allRecords.length;
}

// Pagination Event Listeners
btnPrevPage.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
});

btnNextPage.addEventListener('click', () => {
  if ((currentPage * rowsPerPage) < allRecords.length) {
    currentPage++;
    renderTable();
  }
});

// ==========================================
// REAL-TIME WEBSOCKET INTEGRATION
// ==========================================
function initSocket() {
  if (typeof io === 'undefined') return;

  socket = io(API_URL);

  socket.on('connect', () => {
    console.log('Socket client active. Subscribing admin token channel.');
    socket.emit('register-admin');
  });

  // Handle entry logs broadcasted from backend
  socket.on('student-entry', (record) => {
    // 1. Add alert to Live Activity panel
    addLiveAlert(record, 'entry');

    // 2. Play subtle sound indicator
    playBeep(880, 0.15);

    // 3. Show Toast notification
    showToast(`Student Entry: ${record.name} (${record.enrollment_no}) entered.`, 'success');

    // 4. Update stats charts
    fetchDashboardStats();

    // 5. Append row to records if active
    if (sectionReports.style.display === 'block') {
      fetchAttendanceRecords(getFilterValues());
    }
  });

  // Handle exit logs broadcasted from backend
  socket.on('student-exit', (record) => {
    // 1. Add alert to Live Activity panel
    addLiveAlert(record, 'exit');

    // 2. Play sound indicator
    playBeep(440, 0.15);

    // 3. Show Toast notification
    showToast(`Student Exit: ${record.name} (${record.enrollment_no}) exited.`, 'info');

    // 4. Update stats charts
    fetchDashboardStats();

    // 5. Append row to records if active
    if (sectionReports.style.display === 'block') {
      fetchAttendanceRecords(getFilterValues());
    }
  });
}

function addLiveAlert(record, type) {
  // Clear "no records" text first
  if (realTimeAlertsList.children.length === 1 && realTimeAlertsList.children[0].textContent.includes('No live scans')) {
    realTimeAlertsList.innerHTML = '';
  }

  const li = document.createElement('li');
  li.className = `alert-item ${type}`;

  const time = type === 'entry' ? record.entry_time : record.exit_time;
  const icon = type === 'entry' ? 'fa-right-to-bracket' : 'fa-right-from-bracket';
  const actionText = type === 'entry' ? 'Entered' : 'Exited';
  const durationText = type === 'exit' ? ` (Duration: ${record.duration})` : '';

  li.innerHTML = `
    <i class="fa-solid ${icon} alert-icon"></i>
    <div class="alert-content">
      <strong>${record.name}</strong> <code>${record.enrollment_no}</code> ${actionText} the library${durationText}.
      <div class="alert-time">${record.entry_date} @ ${time}</div>
    </div>
  `;

  // Prepend
  realTimeAlertsList.insertBefore(li, realTimeAlertsList.firstChild);

  // Crop list size to keep only last 10 entries
  if (realTimeAlertsList.children.length > 10) {
    realTimeAlertsList.lastChild.remove();
  }
}

// Audio indicators
function playBeep(frequency = 440, duration = 0.1) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

// ==========================================
// FILTERS & SEARCH MODULES
// ==========================================
function getFilterValues() {
  return {
    search: document.getElementById('filterSearch').value.trim(),
    department: document.getElementById('filterDepartment').value.trim(),
    course: document.getElementById('filterCourse').value.trim(),
    semester: document.getElementById('filterSemester').value,
    date: document.getElementById('filterDate').value,
    status: document.getElementById('filterStatus').value
  };
}

filtersForm.addEventListener('submit', (e) => {
  e.preventDefault();
  fetchAttendanceRecords(getFilterValues());
});

btnResetFilters.addEventListener('click', () => {
  filtersForm.reset();
  fetchAttendanceRecords();
});

// Quick Reports Time-frames
function getFormattedOffsetDate(daysOffset) {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

btnDailyReport.addEventListener('click', () => {
  filtersForm.reset();
  const today = getFormattedOffsetDate(0);
  document.getElementById('filterDate').value = today;
  fetchAttendanceRecords({ date: today });
});

btnWeeklyReport.addEventListener('click', () => {
  filtersForm.reset();
  // Filter for records in the last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  
  // We can perform this filtering locally on allRecords or fetch all and filter
  // For safety, fetch all and filter locally
  fetchAttendanceRecords().then(() => {
    allRecords = allRecords.filter(rec => {
      const recDate = new Date(rec.entry_date);
      return recDate >= sevenDaysAgo && recDate <= today;
    });
    currentPage = 1;
    renderTable();
    showToast('Filtered records for the past 7 days.', 'info');
  });
});

btnMonthlyReport.addEventListener('click', () => {
  filtersForm.reset();
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  fetchAttendanceRecords().then(() => {
    allRecords = allRecords.filter(rec => {
      const recDate = new Date(rec.entry_date);
      return recDate >= thirtyDaysAgo && recDate <= today;
    });
    currentPage = 1;
    renderTable();
    showToast('Filtered records for the past 30 days.', 'info');
  });
});

// ==========================================
// EXPORTS IMPLEMENTATION (EXCEL, CSV, PDF)
// ==========================================

// 1. Export as CSV
exportCsvBtn.addEventListener('click', () => {
  if (allRecords.length === 0) {
    showToast('No logs available to export.', 'warning');
    return;
  }

  const headers = ['Entry Date', 'Student Name', 'Enrollment No', 'Department', 'Course', 'Semester', 'Entry Time', 'Exit Date', 'Exit Time', 'Duration', 'Status'];
  const rows = allRecords.map(rec => [
    rec.entry_date,
    rec.name,
    rec.enrollment_no,
    rec.department,
    rec.course,
    rec.semester,
    rec.entry_time,
    rec.exit_date || '-',
    rec.exit_time || '-',
    rec.duration || '-',
    rec.status
  ]);

  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent += headers.join(",") + "\n";
  rows.forEach(row => {
    // Escape values in double quotes if they contain commas
    const escapedRow = row.map(val => `"${String(val).replace(/"/g, '""')}"`);
    csvContent += escapedRow.join(",") + "\n";
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Library_Attendance_Report_${getFormattedOffsetDate(0)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('CSV downloaded successfully.', 'success');
});

// 2. Export as Excel (SheetJS)
exportExcelBtn.addEventListener('click', () => {
  if (allRecords.length === 0) {
    showToast('No logs available to export.', 'warning');
    return;
  }

  const headers = ['Entry Date', 'Student Name', 'Enrollment No', 'Department', 'Course', 'Semester', 'Entry Time', 'Exit Date', 'Exit Time', 'Duration', 'Status'];
  const rows = allRecords.map(rec => [
    rec.entry_date,
    rec.name,
    rec.enrollment_no,
    rec.department,
    rec.course,
    rec.semester,
    rec.entry_time,
    rec.exit_date || '-',
    rec.exit_time || '-',
    rec.duration || '-',
    rec.status
  ]);

  // Combine into worksheet data
  const wsData = [headers, ...rows];
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, "AttendanceLogs");
  
  XLSX.writeFile(wb, `Library_Attendance_Report_${getFormattedOffsetDate(0)}.xlsx`);
  showToast('Excel document generated successfully.', 'success');
});

// 3. Export as PDF (jsPDF + AutoTable)
exportPdfBtn.addEventListener('click', () => {
  if (allRecords.length === 0) {
    showToast('No logs available to export.', 'warning');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // landscape format

    // Document Titles & Decoration
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(79, 70, 229); // Indigo theme color
    doc.text("SMART LIBRARY SYSTEM - ATTENDANCE REPORT", 14, 18);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()} | Total Logs: ${allRecords.length}`, 14, 25);
    
    // AutoTable mapping
    const headers = [['Entry Date', 'Student Name', 'Enrollment No', 'Department', 'Course & Sem', 'Entry Time', 'Exit Date', 'Exit Time', 'Duration', 'Status']];
    const data = allRecords.map(rec => [
      rec.entry_date,
      rec.name,
      rec.enrollment_no,
      rec.department,
      `${rec.course} (${rec.semester})`,
      rec.entry_time,
      rec.exit_date || '-',
      rec.exit_time || '-',
      rec.duration || '-',
      rec.status
    ]);

    doc.autoTable({
      head: headers,
      body: data,
      startY: 30,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], fontStyle: 'bold' },
      styles: { font: 'helvetica', fontSize: 9 },
      columnStyles: {
        2: { fontStyle: 'bold' }, // Enrollment No bold
        9: { halign: 'center' }   // status centered
      }
    });

    doc.save(`Library_Attendance_Report_${getFormattedOffsetDate(0)}.pdf`);
    showToast('PDF compiled and downloaded successfully.', 'success');
  } catch (error) {
    console.error('PDF compile error:', error);
    showToast('Failed to compile PDF. Library not found.', 'error');
  }
});

// ==========================================
// REGISTERED STUDENTS MODAL LOGIC
// ==========================================
async function fetchRegisteredStudents() {
  if (!token) return;
  
  registeredStudentsTableBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
        Loading registered student records...
      </td>
    </tr>
  `;

  try {
    const res = await fetch(`${API_URL}/api/admin/students`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (res.ok && data.success) {
      registeredStudentsList = data.students;
      renderRegisteredStudents(data.students);
    } else {
      showToast(data.message || 'Failed to fetch students.', 'error');
    }
  } catch (error) {
    console.error('Fetch registered students error:', error);
    showToast('Failed to connect to student records database.', 'error');
  }
}

function renderRegisteredStudents(students) {
  registeredStudentsTableBody.innerHTML = '';
  modalTotalStudentsCount.textContent = students.length;

  if (students.length === 0) {
    registeredStudentsTableBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem 0;">
          No registered student records found.
        </td>
      </tr>
    `;
    return;
  }

  students.forEach(student => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${student.name}</strong></td>
      <td><code>${student.enrollment_no}</code></td>
      <td>${student.email}</td>
      <td>${student.mobile}</td>
      <td>${student.department} <span style="color: var(--text-muted); font-size: 0.8rem;">(${student.course})</span></td>
      <td>${student.semester}</td>
      <td>${student.gender}</td>
    `;
    registeredStudentsTableBody.appendChild(tr);
  });
}

// Local Search inside Registered Students Modal
if (studentsSearchInput) {
  studentsSearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderRegisteredStudents(registeredStudentsList);
      return;
    }
    const filtered = registeredStudentsList.filter(student => 
      student.name.toLowerCase().includes(query) ||
      student.enrollment_no.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query) ||
      student.department.toLowerCase().includes(query) ||
      student.course.toLowerCase().includes(query) ||
      student.semester.toLowerCase().includes(query) ||
      student.gender.toLowerCase().includes(query)
    );
    renderRegisteredStudents(filtered);
  });
}

// Close Modal wiring
if (closeStudentsModal) closeStudentsModal.addEventListener('click', () => registeredStudentsModal.classList.remove('active'));
if (closeStudentsModalBtn) closeStudentsModalBtn.addEventListener('click', () => registeredStudentsModal.classList.remove('active'));

// ==========================================
// INTERACTIVE DASHBOARD CARDS (BUTTONS)
// ==========================================
if (cardTotalStudents) {
  cardTotalStudents.addEventListener('click', () => {
    registeredStudentsModal.classList.add('active');
    fetchRegisteredStudents();
  });
}

if (cardInsideLibrary) {
  cardInsideLibrary.addEventListener('click', () => {
    filtersForm.reset();
    document.getElementById('filterStatus').value = 'Inside';
    navigateTo('reports');
    fetchAttendanceRecords({ status: 'Inside' });
    showToast('Filtered reports for students inside the library.', 'info');
  });
}

if (cardEntriesToday) {
  cardEntriesToday.addEventListener('click', () => {
    filtersForm.reset();
    const today = getFormattedOffsetDate(0);
    document.getElementById('filterDate').value = today;
    navigateTo('reports');
    fetchAttendanceRecords({ date: today });
    showToast('Filtered reports for today\'s entries.', 'info');
  });
}

if (cardExitsToday) {
  cardExitsToday.addEventListener('click', () => {
    filtersForm.reset();
    const today = getFormattedOffsetDate(0);
    document.getElementById('filterDate').value = today;
    document.getElementById('filterStatus').value = 'Exited';
    navigateTo('reports');
    fetchAttendanceRecords({ date: today, status: 'Exited' });
    showToast('Filtered reports for today\'s checkouts.', 'info');
  });
}

// ==========================================
// ADMIN DASHBOARD SWITCH NAVIGATION
// ==========================================
function navigateTo(target) {
  // Reset all active classes
  menuDashBtn.classList.remove('active');
  menuReportsBtn.classList.remove('active');
  if (menuStudentsBtn) menuStudentsBtn.classList.remove('active');

  // Hide all sections
  sectionDashboard.style.display = 'none';
  sectionReports.style.display = 'none';
  if (sectionStudents) sectionStudents.style.display = 'none';

  if (target === 'reports') {
    menuReportsBtn.classList.add('active');
    pageTitle.textContent = 'Attendance Reports';
    sectionReports.style.display = 'block';
    fetchAttendanceRecords();
  } else if (target === 'students') {
    if (menuStudentsBtn) menuStudentsBtn.classList.add('active');
    pageTitle.textContent = 'Students Database';
    if (sectionStudents) sectionStudents.style.display = 'block';
    fetchStudentsDatabaseList();
  } else {
    menuDashBtn.classList.add('active');
    pageTitle.textContent = 'Dashboard';
    sectionDashboard.style.display = 'block';
    fetchDashboardStats();
  }
}

menuDashBtn.addEventListener('click', (e) => {
  e.preventDefault();
  navigateTo('dashboard');
});

menuReportsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  navigateTo('reports');
});

if (menuStudentsBtn) {
  menuStudentsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('students');
  });
}

// ==========================================
// SECURITY LOGIN & SESSION RULES
// ==========================================
function showAuthScreen() {
  adminAuthContainer.style.display = 'flex';
  adminDashboardContainer.style.display = 'none';
}

function showDashboardScreen() {
  adminAuthContainer.style.display = 'none';
  adminDashboardContainer.style.display = 'flex';
  startClock();
  fetchDashboardStats();
  initSocket();

  // Refresh stats every 30s automatically
  setInterval(fetchDashboardStats, 30000);
}

// Login
adminLoginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameOrEnrollment = document.getElementById('adminUsername').value;
  const password = document.getElementById('adminPassword').value;

  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEnrollment, password, role: 'admin' })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      token = data.token;
      localStorage.setItem('admin_token', token);
      adminLoginForm.reset();
      showToast('Admin access authenticated!', 'success');
      showDashboardScreen();
    } else {
      showToast(data.message || 'Authentication rejected.', 'error');
    }
  } catch (error) {
    console.error('Admin Login error:', error);
    showToast('Control database server is offline.', 'error');
  } finally {
    showLoader(false);
  }
});

// Logout
function logout() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  token = null;
  localStorage.removeItem('admin_token');
  showAuthScreen();
  showToast('Admin session terminated.', 'info');
}

adminLogoutBtn.addEventListener('click', logout);

// Modals Triggers
adminSettingsBtn.addEventListener('click', () => adminSettingsModal.classList.add('active'));
closeAdminSettings.addEventListener('click', () => adminSettingsModal.classList.remove('active'));
cancelAdminSettings.addEventListener('click', () => adminSettingsModal.classList.remove('active'));

adminChangePasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldPassword = document.getElementById('adminOldPassword').value;
  const newPassword = document.getElementById('adminNewPassword').value;
  const confirmPassword = document.getElementById('adminConfirmPassword').value;

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match.', 'error');
    return;
  }

  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ oldPassword, newPassword })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast(data.message, 'success');
      adminChangePasswordForm.reset();
      adminSettingsModal.classList.remove('active');
    } else {
      showToast(data.message || 'Failed to change password.', 'error');
    }
  } catch (error) {
    console.error('Admin password change error:', error);
    showToast('Connection timed out updating database.', 'error');
  } finally {
    showLoader(false);
  }
});

// Launch App
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  // Read active QR configuration from .env equivalent variables inside HTML
  const configQR = document.getElementById('activeQRConfig');
  if (configQR && typeof process !== 'undefined' && process.env) {
    configQR.textContent = process.env.LIBRARY_QR_CODE || 'SMART_LIBRARY_QR_2026';
  }

  const qrValue = configQR ? configQR.textContent.trim() : 'SMART_LIBRARY_QR_2026';
  const qrCanvas = document.getElementById('adminQRCanvas');
  if (qrCanvas && typeof QRious !== 'undefined') {
    new QRious({
      element: qrCanvas,
      value: qrValue,
      size: 160
    });
  }

  // QR Actions (Download / Print)
  const downloadQRBtn = document.getElementById('downloadQRBtn');
  if (downloadQRBtn) {
    downloadQRBtn.addEventListener('click', () => {
      if (qrCanvas) {
        const url = qrCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `Library_QR_Code_${qrValue}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('QR Code image downloaded successfully.', 'success');
      }
    });
  }

  const printQRBtn = document.getElementById('printQRBtn');
  if (printQRBtn) {
    printQRBtn.addEventListener('click', () => {
      if (qrCanvas) {
        const url = qrCanvas.toDataURL('image/png');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
          <html>
            <head>
              <title>Print Library QR Code</title>
              <style>
                body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; margin: 0; }
                img { width: 300px; height: 300px; border: 1px solid #ccc; padding: 10px; border-radius: 8px; }
                h1 { margin-bottom: 5px; }
                p { color: #666; margin-top: 5px; font-size: 14px; }
              </style>
            </head>
            <body>
              <h1>Smart Library System</h1>
              <p>Scan this QR code to Record Entry/Exit</p>
              <img src="${url}" />
              <p style="font-weight: bold; margin-top: 15px;">QR Code String: ${qrValue}</p>
              <script>
                window.onload = function() { window.print(); window.close(); }
              </script>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    });
  }

  // File upload input change
  if (studentsImportFile) {
    studentsImportFile.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleStudentFileUpload(e.target.files[0]);
      }
    });
  }

  // Drag and drop event handling
  if (importDragArea) {
    importDragArea.addEventListener('click', () => {
      if (studentsImportFile) studentsImportFile.click();
    });

    importDragArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      importDragArea.style.borderColor = 'var(--primary)';
      importDragArea.style.background = 'var(--sidebar-active)';
    });

    importDragArea.addEventListener('dragleave', () => {
      if (importFilePending) {
        importDragArea.style.borderColor = 'var(--success)';
        importDragArea.style.background = 'rgba(16, 185, 129, 0.03)';
      } else {
        importDragArea.style.borderColor = 'var(--input-border)';
        importDragArea.style.background = 'rgba(0,0,0,0.02)';
      }
    });

    importDragArea.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleStudentFileUpload(e.dataTransfer.files[0]);
      }
    });
  }

  // Cancel pending import
  if (btnCancelImport) {
    btnCancelImport.addEventListener('click', (e) => {
      e.stopPropagation();
      clearImportUI();
    });
  }

  // Preview Row addition, cancel, confirm listeners
  if (btnPreviewAddRow) {
    btnPreviewAddRow.addEventListener('click', () => {
      previewStudentsList.push({
        name: '',
        enrollment_no: '',
        email: '',
        mobile: '',
        department: '',
        course: '',
        semester: '',
        gender: '',
        password: ''
      });
      renderPreviewTable();
    });
  }

  if (btnPreviewCancel) {
    btnPreviewCancel.addEventListener('click', () => {
      if (confirm("Are you sure you want to discard the uploaded file preview? All changes will be lost.")) {
        clearImportUI();
      }
    });
  }

  if (btnPreviewConfirm) {
    btnPreviewConfirm.addEventListener('click', confirmPreviewAndImport);
  }

  // Load Demo Data button listener
  if (btnLoadDemoData) {
    btnLoadDemoData.addEventListener('click', () => {
      previewStudentsList = [
        { name: 'John Doe', enrollment_no: 'DEMO001', email: 'john.doe@demo.com', mobile: '9876543210', department: 'Computer Science', course: 'B.Tech', semester: '3rd', gender: 'Male', password: 'john123' },
        { name: 'Alice Smith', enrollment_no: 'DEMO002', email: 'alice.smith@demo.com', mobile: '9876543211', department: 'Information Technology', course: 'B.Tech', semester: '5th', gender: 'Female', password: 'alice123' }
      ];
      if (importPreviewCard) importPreviewCard.style.display = 'block';
      renderPreviewTable();
      showToast('Demo student records loaded into preview table. Feel free to edit, add, or delete rows!', 'success');
    });
  }

  // Download CSV template
  if (btnDownloadTemplate) {
    btnDownloadTemplate.addEventListener('click', downloadCSVTemplate);
  }

  // Students Database list search filtering
  if (studentsDbSearchInput) {
    studentsDbSearchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        filteredStudentsDb = [...allStudentsDb];
      } else {
        filteredStudentsDb = allStudentsDb.filter(student => 
          student.name.toLowerCase().includes(query) ||
          student.enrollment_no.toLowerCase().includes(query) ||
          student.email.toLowerCase().includes(query) ||
          student.department.toLowerCase().includes(query) ||
          student.course.toLowerCase().includes(query) ||
          student.semester.toLowerCase().includes(query) ||
          student.gender.toLowerCase().includes(query)
        );
      }
      currentStudentsPage = 1;
      renderStudentsDbTable();
    });
  }

  // Students DB Pagination Listeners
  if (btnStudentsDbPrevPage) {
    btnStudentsDbPrevPage.addEventListener('click', () => {
      if (currentStudentsPage > 1) {
        currentStudentsPage--;
        renderStudentsDbTable();
      }
    });
  }

  if (btnStudentsDbNextPage) {
    btnStudentsDbNextPage.addEventListener('click', () => {
      const startIndex = (currentStudentsPage - 1) * studentsRowsPerPage;
      const endIndex = startIndex + studentsRowsPerPage;
      if (endIndex < filteredStudentsDb.length) {
        currentStudentsPage++;
        renderStudentsDbTable();
      }
    });
  }

  if (token) {
    showDashboardScreen();
  } else {
    showAuthScreen();
  }
});

// ==========================================
// STUDENTS DATABASE & BULK IMPORT LOGIC
// ==========================================

// Fetch Students Database list
async function fetchStudentsDatabaseList() {
  if (!token) return;
  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/admin/students`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      allStudentsDb = data.students;
      filteredStudentsDb = [...allStudentsDb];
      currentStudentsPage = 1;
      renderStudentsDbTable();
    } else {
      showToast(data.message || 'Failed to fetch student database records.', 'error');
    }
  } catch (error) {
    console.error('Fetch student database records error:', error);
    showToast('Failed to connect to the database server.', 'error');
  } finally {
    showLoader(false);
  }
}

// Render paginated student database rows
function renderStudentsDbTable() {
  if (!studentsDbTableBody) return;
  studentsDbTableBody.innerHTML = '';
  
  if (filteredStudentsDb.length === 0) {
    studentsDbTableBody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; color: var(--text-muted); padding: 3rem 0;">
          No student database records found.
        </td>
      </tr>
    `;
    if (studentsDbPageInfo) studentsDbPageInfo.textContent = 'Showing 0 to 0 of 0 entries';
    if (btnStudentsDbPrevPage) btnStudentsDbPrevPage.disabled = true;
    if (btnStudentsDbNextPage) btnStudentsDbNextPage.disabled = true;
    return;
  }

  const startIndex = (currentStudentsPage - 1) * studentsRowsPerPage;
  const endIndex = Math.min(startIndex + studentsRowsPerPage, filteredStudentsDb.length);
  const paginatedStudents = filteredStudentsDb.slice(startIndex, endIndex);

  paginatedStudents.forEach(student => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${student.name}</strong></td>
      <td><code>${student.enrollment_no}</code></td>
      <td>${student.email}</td>
      <td>${student.mobile}</td>
      <td>${student.department}</td>
      <td>${student.course} <span style="color: var(--text-muted); font-size: 0.8rem;">(${student.semester})</span></td>
      <td>${student.gender}</td>
      <td><code>${student.plain_password || 'student123'}</code></td>
      <td style="text-align: center;">
        <button class="btn btn-secondary btn-delete-student" data-id="${student.id}" style="padding: 0.25rem 0.5rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.2); font-size: 0.8rem; background: transparent; height: auto;" title="Delete Student">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    studentsDbTableBody.appendChild(tr);
  });

  if (studentsDbPageInfo) {
    studentsDbPageInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${filteredStudentsDb.length} entries`;
  }

  if (btnStudentsDbPrevPage) btnStudentsDbPrevPage.disabled = currentStudentsPage === 1;
  if (btnStudentsDbNextPage) btnStudentsDbNextPage.disabled = endIndex >= filteredStudentsDb.length;

  // Add click handlers for delete buttons
  document.querySelectorAll('.btn-delete-student').forEach(button => {
    button.addEventListener('click', async (e) => {
      const studentId = button.getAttribute('data-id');
      const studentName = button.closest('tr').querySelector('td').textContent;
      if (confirm(`Are you sure you want to delete student "${studentName}"? This will delete all their attendance records.`)) {
        await deleteStudent(studentId);
      }
    });
  });
}

// Delete student record
async function deleteStudent(studentId) {
  if (!token) return;
  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/admin/students/${studentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message || 'Student deleted successfully.', 'success');
      // Refresh list
      await fetchStudentsDatabaseList();
      // Refresh total counts
      await fetchDashboardStats();
    } else {
      showToast(data.message || 'Failed to delete student.', 'error');
    }
  } catch (error) {
    console.error('Delete student error:', error);
    showToast('Failed to connect to the database server.', 'error');
  } finally {
    showLoader(false);
  }
}

// Map key headers from raw rows (case-insensitive and trimmed)
function mapImportedData(rawRows) {
  return rawRows.map(row => {
    const student = {};
    Object.keys(row).forEach(key => {
      const val = String(row[key] !== undefined && row[key] !== null ? row[key] : '').trim();
      const normalizedKey = key.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
      
      if (normalizedKey.includes('name')) {
        student.name = val;
      } else if (normalizedKey.includes('enrollment') || normalizedKey.includes('roll')) {
        student.enrollment_no = val;
      } else if (normalizedKey.includes('email') || normalizedKey.includes('mail')) {
        student.email = val;
      } else if (normalizedKey.includes('mobile') || normalizedKey.includes('phone') || normalizedKey.includes('contact')) {
        student.mobile = val;
      } else if (normalizedKey.includes('department') || normalizedKey.includes('dept')) {
        student.department = val;
      } else if (normalizedKey.includes('course')) {
        student.course = val;
      } else if (normalizedKey.includes('semester') || normalizedKey.includes('sem')) {
        student.semester = val;
      } else if (normalizedKey.includes('gender') || normalizedKey.includes('sex')) {
        student.gender = val;
      } else if (normalizedKey.includes('password') || normalizedKey.includes('pass')) {
        student.password = val;
      }
    });
    return student;
  });
}

// Handle Student File Upload (Automatically parses the file and loads the preview panel)
function handleStudentFileUpload(file) {
  if (!file) return;
  const fileName = file.name;
  const fileSizeKB = (file.size / 1024).toFixed(1);

  // Validate extension
  const extension = fileName.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx', 'xls', 'json'].includes(extension)) {
    showToast('Unsupported file type. Please upload CSV, Excel, or JSON.', 'error');
    return;
  }

  importFilePending = file;

  // Show status UI
  if (importFileName) importFileName.textContent = fileName;
  if (importFileSize) importFileSize.textContent = `(${fileSizeKB} KB)`;
  if (importFileStatus) importFileStatus.style.display = 'flex';
  if (importDragArea) {
    importDragArea.style.borderColor = 'var(--success)';
    importDragArea.style.background = 'rgba(16, 185, 129, 0.03)';
  }

  showLoader(true);
  
  const processParsedData = (parsedList) => {
    previewStudentsList = parsedList;
    showLoader(false);
    if (importPreviewCard) importPreviewCard.style.display = 'block';
    renderPreviewTable();
    showToast('File uploaded successfully! You can now preview and edit the records below.', 'success');
  };

  const reader = new FileReader();

  if (extension === 'json') {
    reader.onload = function(e) {
      try {
        const rawData = JSON.parse(e.target.result);
        const list = Array.isArray(rawData) ? rawData : [rawData];
        const parsed = mapImportedData(list);
        processParsedData(parsed);
      } catch (err) {
        showToast('JSON parsing failed. Invalid syntax.', 'error');
        showLoader(false);
      }
    };
    reader.readAsText(file);
  } else {
    // Excel/CSV using SheetJS
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawList = XLSX.utils.sheet_to_json(worksheet);
        const parsed = mapImportedData(rawList);
        processParsedData(parsed);
      } catch (err) {
        console.error('SheetJS parse error:', err);
        showToast('File reading or parsing error.', 'error');
        showLoader(false);
      }
    };
    reader.readAsArrayBuffer(file);
  }
}

// Render paginated student database rows for editable preview table
function renderPreviewTable() {
  if (!previewTableBody) return;
  previewTableBody.innerHTML = '';
  
  if (previewCountText) {
    previewCountText.textContent = previewStudentsList.length;
  }

  if (previewStudentsList.length === 0) {
    previewTableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; color: var(--text-muted); padding: 3rem 0; font-weight: 600;">
          No preview records. Click "Add Row" or upload a file.
        </td>
      </tr>
    `;
    return;
  }

  previewStudentsList.forEach((student, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="name" value="${student.name || ''}" placeholder="Full Name"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="enrollment_no" value="${student.enrollment_no || ''}" placeholder="Enrollment No"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="email" value="${student.email || ''}" placeholder="Email"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="mobile" value="${student.mobile || ''}" placeholder="Mobile"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="department" value="${student.department || ''}" placeholder="Department"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="course" value="${student.course || ''}" placeholder="Course"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="semester" value="${student.semester || ''}" placeholder="Semester"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="gender" value="${student.gender || ''}" placeholder="Gender"></td>
      <td><input type="text" class="preview-table-input" data-index="${index}" data-field="password" value="${student.password || student.plain_password || ''}" placeholder="Password"></td>
      <td style="text-align: center;">
        <button type="button" class="btn btn-secondary btn-delete-preview-row" data-index="${index}" style="padding: 0.25rem 0.5rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.2); font-size: 0.8rem; background: transparent; height: auto;" title="Remove row">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    previewTableBody.appendChild(tr);
  });

  // Bind change listeners to input elements to update the local state array
  document.querySelectorAll('.preview-table-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = parseInt(input.getAttribute('data-index'));
      const field = input.getAttribute('data-field');
      previewStudentsList[idx][field] = input.value;
    });
  });

  // Bind delete buttons
  document.querySelectorAll('.btn-delete-preview-row').forEach(button => {
    button.addEventListener('click', () => {
      const idx = parseInt(button.getAttribute('data-index'));
      previewStudentsList.splice(idx, 1);
      renderPreviewTable();
    });
  });
}

// Clear File Import UI
function clearImportUI() {
  importFilePending = null;
  previewStudentsList = [];
  if (studentsImportFile) studentsImportFile.value = '';
  if (importFileStatus) importFileStatus.style.display = 'none';
  if (importPreviewCard) importPreviewCard.style.display = 'none';
  if (importDragArea) {
    importDragArea.style.borderColor = 'var(--input-border)';
    importDragArea.style.background = 'rgba(0,0,0,0.02)';
  }
}

// Send finalized preview state to server
async function confirmPreviewAndImport() {
  if (previewStudentsList.length === 0) {
    showToast('No students to import. Add rows first.', 'error');
    return;
  }
  
  // Basic validation of fields
  const invalidRows = previewStudentsList.filter(s => !s.name || !s.enrollment_no || !s.email || !s.password || !String(s.password).trim());
  if (invalidRows.length > 0) {
    showToast(`Error: ${invalidRows.length} student row(s) are missing required fields (Name, Enrollment No, Email, or Password). Please fill all fields before confirming the import.`, 'error');
    return;
  }

  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/admin/students/import`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ students: previewStudentsList })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showToast(data.message, 'success');
      if (data.errors && data.errors.length > 0) {
        console.warn('Import warnings/skipped rows:', data.errors);
        showToast(`Imported ${data.importedCount} students. Check console for details.`, 'warning');
      }
      clearImportUI();
      await fetchStudentsDatabaseList();
      await fetchDashboardStats();
    } else {
      showToast(data.message || 'Bulk student import failed.', 'error');
    }
  } catch (err) {
    console.error('Submit import request error:', err);
    showToast('Connection error during import submission.', 'error');
  } finally {
    showLoader(false);
  }
}

// Download Sample CSV Template
function downloadCSVTemplate() {
  const headers = ['name', 'enrollment_no', 'email', 'mobile', 'department', 'course', 'semester', 'gender', 'password'];
  const sampleRow = ['John Doe', 'EN10024', 'john.doe@college.edu', '9876543210', 'Computer Science', 'B.Tech', '3rd', 'Male', 'student123'];
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + [headers.join(','), sampleRow.join(',')].join('\n');
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "library_students_template.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Sample student template downloaded.', 'success');
}
