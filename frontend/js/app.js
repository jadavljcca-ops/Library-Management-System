// app.js
// Student Portal Frontend Client Logic

// Configuration
const API_URL = (window.location.protocol === 'file:' || (window.location.port !== '' && window.location.port !== '5000')) ? `http://${window.location.hostname || 'localhost'}:5000` : ''; // Automatically route to backend

// State
let token = localStorage.getItem('student_token') || null;
let currentUser = null;
let html5QrScanner = null;
let currentStudentLocation = null;
let tempCoords = null;

// DOM Elements
const authContainer = document.getElementById('authContainer');
const dashboardContainer = document.getElementById('dashboardContainer');

// Auth panels
const loginFormCard = document.getElementById('loginFormCard');
const registerFormCard = document.getElementById('registerFormCard');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');

// Navigation triggers
const showRegisterBtn = document.getElementById('showRegisterBtn');
const showLoginBtn = document.getElementById('showLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const editProfileBtn = document.getElementById('editProfileBtn');

// Modals
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const settingsModal = document.getElementById('settingsModal');
const closeForgotModal = document.getElementById('closeForgotModal');
const cancelForgotBtn = document.getElementById('cancelForgotBtn');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const changePasswordForm = document.getElementById('changePasswordForm');

// Themes
const themeToggleAuth = document.getElementById('themeToggleAuth');
const themeToggleDash = document.getElementById('themeToggleDash');

// Profile placeholders
const avatarLetter = document.getElementById('avatarLetter');
const headerUserName = document.getElementById('headerUserName');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileEmail = document.getElementById('profileEmail');
const profileEnrollment = document.getElementById('profileEnrollment');
const profileMobile = document.getElementById('profileMobile');
const profileDepartment = document.getElementById('profileDepartment');
const profileCourseSem = document.getElementById('profileCourseSem');
const activeSessionIndicator = document.getElementById('activeSessionIndicator');

// Location Verification DOM Elements
const locationVerificationCard = document.getElementById('locationVerificationCard');
const qrScannerCard = document.getElementById('qrScannerCard');
const btnVerifyLocation = document.getElementById('btnVerifyLocation');
const btnSubmitLocation = document.getElementById('btnSubmitLocation');
const studentMapContainer = document.getElementById('studentMapContainer');
const studentMapIframe = document.getElementById('studentMapIframe');

// Scanner Controls
const startScanBtn = document.getElementById('startScanBtn');
const stopScanBtn = document.getElementById('stopScanBtn');

// Loaders
const globalLoader = document.getElementById('globalLoader');

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
  const iconHtml = `<i class="fa-solid ${icon}"></i>`;
  if (themeToggleAuth) themeToggleAuth.innerHTML = iconHtml;
  if (themeToggleDash) themeToggleDash.innerHTML = iconHtml;
}

[themeToggleAuth, themeToggleDash].forEach(btn => {
  if (btn) btn.addEventListener('click', toggleTheme);
});

// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
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

// Loader Toggles
function showLoader(show = true) {
  if (show) {
    globalLoader.classList.add('active');
  } else {
    globalLoader.classList.remove('active');
  }
}

// ==========================================
// REAL-TIME CLOCK
// ==========================================
function startClock() {
  const clockEl = document.getElementById('liveClock');
  if (!clockEl) return;

  setInterval(() => {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 should be 12
    const hoursStr = String(hours).padStart(2, '0');

    clockEl.textContent = `${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }, 1000);
}

// ==========================================
// SESSION ACCESS & API CALLS
// ==========================================
async function fetchProfile() {
  if (!token) return logout();

  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/profile`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      currentUser = data.profile;
      renderProfile(data.profile);
      await checkActiveSession();
    } else {
      showToast(data.message || 'Session expired.', 'error');
      logout();
    }
  } catch (error) {
    console.error('Profile fetch failed:', error);
    showToast('Failed to load profile details.', 'error');
  } finally {
    showLoader(false);
  }
}

// Update profile indicators on student dashboard
function renderProfile(user) {
  const letter = user.name.charAt(0).toUpperCase();
  avatarLetter.textContent = letter;
  profileAvatar.textContent = letter;
  headerUserName.textContent = user.name;
  profileName.textContent = user.name;
  profileEmail.textContent = user.email;

  profileEnrollment.textContent = user.enrollment_no;
  profileMobile.textContent = user.mobile;
  profileDepartment.textContent = user.department;
  profileCourseSem.textContent = `${user.course} - ${user.semester} Sem`;
}

// Check status inside/outside library
async function checkActiveSession() {
  try {
    // In our implementation, we'll fetch from server using reports api or a quick endpoint.
    // However, to keep it clean and self-contained without creating an extra student-session endpoint,
    // we can request the last scan report. Or simple admin reports filters with our enrollment number.
    // For convenience, we will query attendance logs filtered by current user and check the latest.
    // To make this secure and student-specific, let's use the report API or create a quick lightweight request.
    // Wait, the admin attendance records endpoint requires admin token. Let's create an attendance status check.
    // Wait, instead of adding another endpoint to server, we can verify session status directly in scan response 
    // or by letting students check their own status. Let's write a quick endpoint in server.js or read it.
    // Wait, in server.js, we don't have a specific `GET /api/attendance/status` endpoint. Let's check!
    // Oh, wait, we can fetch active session inside scanner status card by checking scan logs or we can easily 
    // fetch their status by checking a new route or query.
    // Let's modify the profile endpoint slightly or check active session from localStorage / scan actions.
    // To handle this cleanly without modifying the backend server code, let's write a quick endpoint inside server.js!
    // Wait! Let's check server.js. In server.js, I created the endpoint `GET /api/profile` and `POST /api/attendance/scan`.
    // Wait, let's add `GET /api/attendance/status` to check student's active status. Let's see if we need it.
    // Yes! Let's check if the student is currently inside or exited.
    // Wait! In server.js, when we query `SELECT * FROM attendance WHERE student_id = ? AND status = 'Inside' AND exit_time IS NULL`,
    // it searches for the active row. We can easily expose a simple API `/api/attendance/status` for students to see if they are inside.
    // Let's add this to server.js if needed.
    // Let's write the fetch query here. Let's assume we can fetch active status by requesting `/api/attendance/status`.
    // Wait, did I implement `/api/attendance/status` in server.js? No, I did not.
    // Let me edit server.js to add `/api/attendance/status` so students can view their current status!
    // It's a very simple and useful API. Let's do that right after.
    const res = await fetch(`${API_URL}/api/attendance/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    
    if (res.ok && data.success) {
      if (data.isInside) {
        activeSessionIndicator.className = 'badge badge-success';
        activeSessionIndicator.innerHTML = '<span class="badge-dot" style="animation: pulse 1s infinite;"></span> Status: Inside Library';
      } else {
        activeSessionIndicator.className = 'badge badge-info';
        activeSessionIndicator.innerHTML = '<span class="badge-dot"></span> Status: Outside Library';
      }
    }
  } catch (error) {
    console.error('Error checking active session:', error);
    activeSessionIndicator.className = 'badge badge-danger';
    activeSessionIndicator.innerHTML = 'Status: Disconnected';
  }
}

// ==========================================
// ATTENDANCE SCAN LOGIC
// ==========================================
async function submitQRScan(qrContent) {
  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/attendance/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        qrCode: qrContent,
        latitude: currentStudentLocation.latitude,
        longitude: currentStudentLocation.longitude
      })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      const isEntry = data.action === 'entry';
      
      // Show fancy success popup
      showCustomLoginPopup(true, isEntry ? 'Entry Successful 🎉' : 'Exit Successful 🎉');
      
      // Play a nice success audio beep or micro animation
      playBeep(isEntry ? 880 : 440, 0.15); // Higher pitch for entry, lower for exit

      // Refresh status and dashboard
      await checkActiveSession();
    } else {
      showToast(data.message || 'Scan failed.', 'error');
      playBeep(220, 0.4); // Low buzzer sound for error
    }
  } catch (error) {
    console.error('Scan submission error:', error);
    showToast('Network error processing scanner session.', 'error');
  } finally {
    showLoader(false);
  }
}

// Custom Audio Beep Generator using Web Audio API (No files needed!)
function playBeep(frequency = 440, duration = 0.1) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + duration);
  } catch (e) {
    console.warn('Audio Beep context blocked or unsupported:', e.message);
  }
}

// ==========================================
// PINCH TO ZOOM & SCANNER LOGIC
// ==========================================
let currentZoom = 1;
let minZoom = 1;
let maxZoom = 3;
let zoomStep = 0.1;
let videoTrack = null;
let useSoftwareZoom = false;
let initialPinchDistance = null;
let initialZoomAtPinchStart = 1;
let zoomControlsEl = null;
let zoomDisplayEl = null;

function getDistance(touch1, touch2) {
  return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
}

function updateZoom(newZoom) {
  newZoom = Math.min(Math.max(newZoom, minZoom), maxZoom);
  if (newZoom === currentZoom) return;
  
  currentZoom = newZoom;
  zoomDisplayEl.textContent = currentZoom.toFixed(1) + 'x';
  
  if (useSoftwareZoom) {
    const videoEl = document.querySelector('#reader video');
    if (videoEl) {
      videoEl.style.transform = `scale(${currentZoom})`;
      videoEl.style.transformOrigin = 'center center';
      videoEl.style.transition = 'transform 0.1s ease-out';
    }
  } else if (videoTrack) {
    videoTrack.applyConstraints({
      advanced: [{ zoom: currentZoom }]
    }).catch(err => console.warn('Native zoom failed:', err));
  }
}

function initZoomControls() {
  zoomControlsEl = document.getElementById('zoomControls');
  zoomDisplayEl = document.getElementById('zoomLevelDisplay');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const scannerViewfinder = document.querySelector('.scanner-viewfinder');
  
  if (!zoomControlsEl || !scannerViewfinder) return;
  
  zoomControlsEl.style.display = 'flex';
  
  // Polling for video track (html5-qrcode creates it asynchronously)
  let retries = 10;
  const pollVideo = setInterval(() => {
    const videoEl = document.querySelector('#reader video');
    if (videoEl && videoEl.srcObject && videoEl.srcObject.getVideoTracks().length > 0) {
      clearInterval(pollVideo);
      videoTrack = videoEl.srcObject.getVideoTracks()[0];
      const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
      
      if (capabilities.zoom) {
        minZoom = capabilities.zoom.min || 1;
        maxZoom = capabilities.zoom.max || 3;
        zoomStep = capabilities.zoom.step || 0.1;
        currentZoom = minZoom;
        useSoftwareZoom = false;
      } else {
        useSoftwareZoom = true;
        minZoom = 1; maxZoom = 4; currentZoom = 1;
      }
      zoomDisplayEl.textContent = currentZoom.toFixed(1) + 'x';
    } else {
      retries--;
      if (retries <= 0) {
        clearInterval(pollVideo);
        useSoftwareZoom = true;
        minZoom = 1; maxZoom = 4; currentZoom = 1;
      }
    }
  }, 300);

  // Button Listeners
  if (zoomInBtn) zoomInBtn.onclick = () => updateZoom(currentZoom + (useSoftwareZoom ? 0.2 : zoomStep * 2));
  if (zoomOutBtn) zoomOutBtn.onclick = () => updateZoom(currentZoom - (useSoftwareZoom ? 0.2 : zoomStep * 2));
  
  // Touch Listeners for Pinch to Zoom
  scannerViewfinder.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      initialPinchDistance = getDistance(e.touches[0], e.touches[1]);
      initialZoomAtPinchStart = currentZoom;
    }
  }, { passive: false });

  scannerViewfinder.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && initialPinchDistance) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches[0], e.touches[1]);
      const distanceRatio = currentDistance / initialPinchDistance;
      
      const newZoom = initialZoomAtPinchStart * distanceRatio;
      updateZoom(newZoom);
    }
  }, { passive: false });
  
  scannerViewfinder.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) {
      initialPinchDistance = null;
    }
  });
}

function resetZoomControls() {
  if (zoomControlsEl) zoomControlsEl.style.display = 'none';
  currentZoom = 1;
  videoTrack = null;
  const videoEl = document.querySelector('#reader video');
  if (videoEl) videoEl.style.transform = 'scale(1)';
}

// Camera Scanner Implementation
function startCameraScanner() {
  if (typeof Html5Qrcode === 'undefined') {
    showToast('Scanner library not loaded yet. Please wait.', 'warning');
    return;
  }

  // Disable button and enable stop
  startScanBtn.disabled = true;
  stopScanBtn.disabled = false;

  html5QrScanner = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 220, height: 220 } };

  html5QrScanner.start(
    { facingMode: "environment" },
    config,
    (qrCodeMessage) => {
      // On QR code success
      stopCameraScanner();
      submitQRScan(qrCodeMessage);
    },
    (errorMessage) => {
      // Verbose error logging omitted to avoid clogging console
    }
  ).then(() => {
    // Camera is successfully started, initialize zoom
    setTimeout(initZoomControls, 500); // Give the video element a moment to render
  }).catch(err => {
    console.error('Camera start failed:', err);
    showToast('Failed to access device camera. Check permission.', 'error');
    stopCameraScanner();
  });
}

function stopCameraScanner() {
  startScanBtn.disabled = false;
  stopScanBtn.disabled = true;

  if (html5QrScanner) {
    html5QrScanner.stop().then(() => {
      console.log('Camera stopped.');
      html5QrScanner = null;
      resetZoomControls();
    }).catch(err => {
      console.error('Failed to stop camera:', err);
    });
  }
}

// Wire Scanner Buttons
startScanBtn.addEventListener('click', startCameraScanner);
stopScanBtn.addEventListener('click', stopCameraScanner);

// ==========================================
// EVENT LISTENERS & NAVIGATION
// ==========================================

// Screen Toggles
function showAuthScreen(screen) {
  if (authContainer) authContainer.style.display = 'flex';
  if (dashboardContainer) dashboardContainer.style.display = 'none';
  if (screen === 'register') {
    if (loginFormCard) loginFormCard.style.display = 'none';
    if (registerFormCard) registerFormCard.style.display = 'block';
  } else {
    if (loginFormCard) loginFormCard.style.display = 'block';
    if (registerFormCard) registerFormCard.style.display = 'none';
  }
}

function showDashboardScreen() {
  authContainer.style.display = 'none';
  dashboardContainer.style.display = 'flex';
  startClock();
  fetchProfile();

  // Reset/Initialize Location vs Scanner views
  if (currentStudentLocation) {
    locationVerificationCard.style.display = 'none';
    qrScannerCard.style.display = 'block';
  } else {
    locationVerificationCard.style.display = 'block';
    qrScannerCard.style.display = 'none';
    btnSubmitLocation.disabled = true;
    studentMapContainer.style.display = 'none';
    studentMapIframe.src = '';
    tempCoords = null;
  }
}

// Event Listeners for Location Verification
if (btnVerifyLocation) {
  btnVerifyLocation.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.', 'error');
      return;
    }
    
    showLoader(true);
    btnVerifyLocation.disabled = true;
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        showLoader(false);
        btnVerifyLocation.disabled = false;
        tempCoords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        };
        
        // Show read-only Google Map inside iframe
        studentMapIframe.src = `https://maps.google.com/maps?q=${tempCoords.latitude},${tempCoords.longitude}&z=15&output=embed`;
        studentMapContainer.style.display = 'block';
        
        // Enable Submit Location button
        btnSubmitLocation.disabled = false;
        showToast('Current live location verified! Please submit to unlock scanner.', 'success');
      },
      (error) => {
        showLoader(false);
        btnVerifyLocation.disabled = false;
        btnSubmitLocation.disabled = true;
        studentMapContainer.style.display = 'none';
        studentMapIframe.src = '';
        tempCoords = null;
        
        let errorMsg = 'Failed to retrieve location.';
        if (error.code === error.PERMISSION_DENIED) {
          errorMsg = 'Location access denied. Please enable device location permission.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          errorMsg = 'Location information is unavailable.';
        } else if (error.code === error.TIMEOUT) {
          errorMsg = 'Location request timed out.';
        }
        showToast(errorMsg, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

if (btnSubmitLocation) {
  btnSubmitLocation.addEventListener('click', () => {
    if (!tempCoords) {
      showToast('Please verify your live location first.', 'warning');
      return;
    }
    currentStudentLocation = tempCoords;
    showToast('Live location submitted successfully! Scanner unlocked.', 'success');
    
    // Hide location card, show QR scanner card
    locationVerificationCard.style.display = 'none';
    qrScannerCard.style.display = 'block';
  });
}

if (showRegisterBtn) {
  showRegisterBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthScreen('register');
  });
}

if (showLoginBtn) {
  showLoginBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showAuthScreen('login');
  });
}

// Forms Submission
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const usernameOrEnrollment = document.getElementById('loginIdentifier').value;
  const password = document.getElementById('loginPassword').value;

  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernameOrEnrollment, password, role: 'student' })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      token = data.token;
      localStorage.setItem('student_token', token);
      loginForm.reset();
      showCustomLoginPopup(true, 'Successfully!', () => {
        showDashboardScreen();
      });
    } else {
      showCustomLoginPopup(false, data.message || 'Login failed.');
    }
  } catch (error) {
    console.error('Login error:', error);
    showToast('Server unavailable. Please try later.', 'error');
  } finally {
    showLoader(false);
  }
});

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const enrollment_no = document.getElementById('regEnrollment').value;
    const email = document.getElementById('regEmail').value;
    const mobile = document.getElementById('regMobile').value;
    const gender = document.getElementById('regGender').value;
    const department = document.getElementById('regDepartment').value;
    const course = document.getElementById('regCourse').value;
    const semester = document.getElementById('regSemester').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    showLoader(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          enrollment_no,
          email,
          mobile,
          gender,
          department,
          course,
          semester,
          password,
          confirmPassword
        })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message, 'success');
        registerForm.reset();
        showAuthScreen('login');
      } else {
        showToast(data.message || 'Registration failed.', 'error');
      }
    } catch (error) {
      console.error('Registration error:', error);
      showToast('Registration failed due to connection error.', 'error');
    } finally {
      showLoader(false);
    }
  });
}

// Logout
function logout() {
  stopCameraScanner();
  token = null;
  currentUser = null;
  currentStudentLocation = null;
  tempCoords = null;
  localStorage.removeItem('student_token');
  showAuthScreen('login');
  showToast('Logged out successfully.', 'info');
}

logoutBtn.addEventListener('click', logout);

// Modals Triggers
forgotPasswordBtn.addEventListener('click', (e) => {
  e.preventDefault();
  forgotPasswordModal.classList.add('active');
});

closeForgotModal.addEventListener('click', () => forgotPasswordModal.classList.remove('active'));
cancelForgotBtn.addEventListener('click', () => forgotPasswordModal.classList.remove('active'));

editProfileBtn.addEventListener('click', () => {
  settingsModal.classList.add('active');
});

closeSettingsModal.addEventListener('click', () => settingsModal.classList.remove('active'));
cancelSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

// Forms inside Modals
forgotPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const enrollmentOrEmail = document.getElementById('forgotIdentifier').value;

  showLoader(true);
  try {
    const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrollmentOrEmail })
    });
    const data = await res.json();

    if (res.ok && data.success) {
      showToast(data.message, 'success');
      forgotPasswordForm.reset();
      forgotPasswordModal.classList.remove('active');
    } else {
      showToast(data.message || 'Account not found.', 'error');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    showToast('Failed to submit recover request.', 'error');
  } finally {
    showLoader(false);
  }
});

changePasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const oldPassword = document.getElementById('settingsOldPassword').value;
  const newPassword = document.getElementById('settingsNewPassword').value;
  const confirmPassword = document.getElementById('settingsConfirmPassword').value;

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
      changePasswordForm.reset();
      settingsModal.classList.remove('active');
    } else {
      showToast(data.message || 'Update failed.', 'error');
    }
  } catch (error) {
    console.error('Password change error:', error);
    showToast('Failed to update password.', 'error');
  } finally {
    showLoader(false);
  }
});

// App Launch
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (token) {
    showDashboardScreen();
  } else {
    showAuthScreen('login');
  }
});

// --- Custom Login Popup ---
function showCustomLoginPopup(isSuccess, message, callback) {
  // Create overlay with blur
  const overlay = document.createElement('div');
  overlay.className = 'custom-login-overlay';
  
  // Create popup content
  const popup = document.createElement('div');
  popup.className = 'custom-login-popup ' + (isSuccess ? 'success' : 'error');
  
  const icon = document.createElement('div');
  icon.className = 'custom-login-icon';
  icon.innerText = isSuccess ? '🎉' : '❌';
  
  const text = document.createElement('div');
  text.className = 'custom-login-text';
  text.innerText = isSuccess ? (message || 'Successfully!') : (message || 'Login failed.');
  
  popup.appendChild(icon);
  popup.appendChild(text);
  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  // Show party poppers cross visual effect if success
  if (isSuccess) {
    const triggerConfetti = () => {
      var duration = 2000;
      var end = Date.now() + duration;

      (function frame() {
        // launch from left edge
        confetti({
          particleCount: 7,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.6 },
          colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
          zIndex: 999999
        });
        // launch from right edge
        confetti({
          particleCount: 7,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.6 },
          colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'],
          zIndex: 999999
        });
        
        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());
    };

    if (!window.confetti) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js';
      script.onload = triggerConfetti;
      document.head.appendChild(script);
    } else {
      triggerConfetti();
    }
  }

  // Remove after 3 seconds
  setTimeout(() => {
    overlay.remove();
    if (callback) callback();
  }, 3000);
}
