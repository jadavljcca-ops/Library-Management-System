// landing.js
// Interactive behavior for the Smart Library Entry System Landing Page

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupStickyNavbar();
  setupStatsCounter();
  setupFaqAccordion();
  setupContactForm();
});

// ==========================================
// THEME MANAGEMENT (Synchronized with App)
// ==========================================
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  // Read saved theme or system preference
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  const icon = theme === 'dark' ? 'fa-sun' : 'fa-moon';
  themeToggle.innerHTML = `<i class="fa-solid ${icon}"></i>`;
}

// ==========================================
// STICKY NAVBAR ON SCROLL
// ==========================================
function setupStickyNavbar() {
  const header = document.querySelector('header.navbar');
  if (!header) return;

  const handleScroll = () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  };

  window.addEventListener('scroll', handleScroll);
  handleScroll(); // Initial check
}

// ==========================================
// STATS ANIME COUNTER (INTERSECTION OBSERVER)
// ==========================================
function setupStatsCounter() {
  const statsSection = document.querySelector('.stats');
  const statNumbers = document.querySelectorAll('.stat-number');
  
  if (!statsSection || statNumbers.length === 0) return;

  let animated = false;

  const animateCounters = () => {
    statNumbers.forEach(stat => {
      const target = parseInt(stat.getAttribute('data-target'), 10);
      const prefix = stat.getAttribute('data-prefix') || '';
      const suffix = stat.getAttribute('data-suffix') || '';
      const duration = 1500; // 1.5 seconds animation
      const startTime = performance.now();

      const updateCount = (currentTime) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        
        // Easing out quadratic function
        const easeProgress = progress * (2 - progress);
        const currentCount = Math.floor(easeProgress * target);

        stat.textContent = `${prefix}${currentCount.toLocaleString()}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        } else {
          stat.textContent = `${prefix}${target.toLocaleString()}${suffix}`;
        }
      };

      requestAnimationFrame(updateCount);
    });
  };

  // Trigger counters when scrolled into view
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        animateCounters();
        animated = true; // Run only once
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  observer.observe(statsSection);
}

// ==========================================
// FAQ ACCORDION TOGGLE
// ==========================================
function setupFaqAccordion() {
  const faqQuestions = document.querySelectorAll('.faq-question');

  faqQuestions.forEach(question => {
    question.addEventListener('click', () => {
      const item = question.parentElement;
      const isActive = item.classList.contains('active');

      // Close all other FAQ items
      document.querySelectorAll('.faq-item').forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });

      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
      } else {
        item.classList.add('active');
      }
    });
  });
}

// ==========================================
// CONTACT FORM SUBMISSION HANDLER
// ==========================================
function setupContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Grab input values
    const name = document.getElementById('contactName').value;
    const email = document.getElementById('contactEmail').value;
    const message = document.getElementById('contactMessage').value;

    // Simulate sending progress
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';

    setTimeout(() => {
      // Restore button
      submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Sent Successfully!';
      submitBtn.classList.remove('btn-primary');
      submitBtn.classList.add('btn-success');
      submitBtn.style.background = 'var(--success)';

      // Append temporary toast success banner directly to landing body
      showLandingToast(`Thank you, ${name}! Your inquiry has been submitted.`, 'success');

      // Reset form fields after 2s
      setTimeout(() => {
        form.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
        submitBtn.style.background = '';
      }, 2500);

    }, 1500);
  });
}

// Custom Toast helper for the landing page
function showLandingToast(message, type = 'success') {
  let toastContainer = document.getElementById('landingToastContainer');
  
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'landingToastContainer';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '2rem';
    toastContainer.style.right = '2rem';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '0.75rem';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.background = type === 'success' ? '#10b981' : '#6366f1';
  toast.style.color = '#ffffff';
  toast.style.padding = '1rem 1.5rem';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '0.75rem';
  toast.style.fontWeight = '600';
  toast.style.fontSize = '0.9rem';
  toast.style.transform = 'translateY(20px)';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

  let icon = 'fa-circle-check';
  if (type === 'error') icon = 'fa-circle-exclamation';
  if (type === 'info') icon = 'fa-circle-info';

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  });

  // Auto remove
  setTimeout(() => {
    toast.style.transform = 'translateY(-20px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
