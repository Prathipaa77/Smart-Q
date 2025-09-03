document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        SOCKET_TIMEOUT: 10000,
        RECONNECT_ATTEMPTS: 5,
        RECONNECT_DELAY: 3000,
        STATUS_CHECK_INTERVAL: 10000,
        NOTIFICATION_DISPLAY_TIME: 7000,
        MIN_UPDATE_INTERVAL: 2000
    };
    
    // State management
    let state = {
        soundEnabled: localStorage.getItem('soundEnabled') !== 'false', // Default to true
        connected: false,
        lastPositionUpdate: Date.now(),
        notificationHistory: [],
        currentRequest: null,
        updateTimer: null,
        reconnectTimer: null,
        reconnectAttempts: 0
    };
    
    // DOM Elements
    const elements = {
        otp: document.getElementById('otp-value'),
        companyCode: document.getElementById('company-code'),
        customerStatus: document.getElementById('customer-status'),
        position: document.getElementById('position'),
        waitTime: document.getElementById('wait-time'),
        lastUpdateTime: document.getElementById('last-update-time'),
        notificationList: document.getElementById('notification-list'),
        soundToggle: document.querySelector('.sound-toggle'),
        toggleIcon: document.querySelector('.toggle-icon')
    };
    
    // Init - first get elements and configs before starting any logic
    if (!elements.otp || !elements.companyCode || !elements.customerStatus) {
        console.error('Critical elements missing from page');
        return;
    }
    
    const otp = elements.otp.value;
    const companyCode = elements.companyCode.value;
    const customerStatus = elements.customerStatus.value;
    
    // Apply theme before any visual elements are created
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateToggleIcon(savedTheme);
    
    // Then initialize visual components
    initParticles();
    
    // Set up socket connection
    let socket;
    initSocketConnection();
    
    // Initial status check with a short delay to let page render
    setTimeout(checkStatus, 500);
    
    // Start periodic status check timer
    state.updateTimer = setInterval(checkStatus, CONFIG.STATUS_CHECK_INTERVAL);
    
    // Play sounds or show effects based on status
    if (customerStatus === 'served') {
        setTimeout(showConfetti, 1000);
    }
    
    if (customerStatus === 'serving') {
        setTimeout(() => {
            if (state.soundEnabled) {
                playSound();
            }
        }, 1000);
    }
    
    // Expose necessary functions to global scope
    window.toggleSound = toggleSound;
    window.checkStatus = checkStatus;
    window.joinNewQueue = joinNewQueue;
    window.toggleTheme = toggleTheme;
    
    // Function implementations
    function initSocketConnection() {
        // Only create socket connection if needed
        if (socket) return;
        
        socket = io({
            transports: ['websocket'],
            upgrade: false,
            reconnectionAttempts: CONFIG.RECONNECT_ATTEMPTS,
            timeout: CONFIG.SOCKET_TIMEOUT,
            reconnection: true,
            reconnectionDelay: CONFIG.RECONNECT_DELAY
        });
        
        // Socket event listeners
        socket.on('connect', function() {
            state.connected = true;
            state.reconnectAttempts = 0;
            clearTimeout(state.reconnectTimer);
            
            console.log('Socket connected');
            addNotification('Connected to real-time updates');
            
            // Join rooms
            socket.emit('join_customer_room', { otp: otp });
            socket.emit('join_company_room', { company_code: companyCode });
        });
        
        socket.on('disconnect', function() {
            state.connected = false;
            console.log('Socket disconnected');
            addNotification('Disconnected from updates. Will try reconnecting...');
            
            // Start custom reconnection strategy
            if (!state.reconnectTimer) {
                attemptReconnect();
            }
        });
        
        socket.on('customer_turn', function(data) {
            if (data.otp === otp) {
                addNotification('It\'s your turn! Proceed to Cashier #' + data.cashier_number);
                if (state.soundEnabled) {
                    playSound();
                }
                // Reload the page to update status
                window.location.reload();
            }
        });
        
        socket.on('customer_removed', function(data) {
            if (data.otp === otp) {
                addNotification('You\'ve been removed from the queue');
                // Reload the page to update status
                window.location.reload();
            }
        });
        
        socket.on('customer_delayed', function(data) {
            if (data.otp === otp) {
                addNotification('Your service has been delayed. You have been moved back in the queue.');
                setTimeout(checkStatus, 500);
            }
        });
        
        socket.on('connect_error', function(error) {
            console.log('Connection error, falling back to polling:', error);
            addNotification('Connection issue. Using periodic updates instead');
            
            if (state.reconnectAttempts < CONFIG.RECONNECT_ATTEMPTS) {
                attemptReconnect();
            }
        });

        socket.on('queue_updated', function(data) {
            console.log('Queue updated event received:', data);
            addNotification('Queue positions have been updated. Refreshing your status...');
            
            // Debounce updates
            const now = Date.now();
            if (now - state.lastPositionUpdate > CONFIG.MIN_UPDATE_INTERVAL) {
                state.lastPositionUpdate = now;
                checkStatus();
            } else {
                console.log('Throttling position update check');
            }
        });
    }
    
    function attemptReconnect() {
        state.reconnectAttempts++;
        clearTimeout(state.reconnectTimer);
        
        // Exponential backoff for reconnection
        const delay = Math.min(30000, CONFIG.RECONNECT_DELAY * Math.pow(1.5, state.reconnectAttempts - 1));
        
        console.log(`Attempt ${state.reconnectAttempts} to reconnect in ${delay}ms`);
        
        state.reconnectTimer = setTimeout(() => {
            if (!state.connected && socket) {
                console.log('Attempting to reconnect socket...');
                socket.connect();
            }
        }, delay);
    }
    
    function checkStatus() {
        addNotification('Checking for updates...');
        
        // Cancel any in-flight request to prevent race conditions
        if (state.currentRequest) {
            state.currentRequest.abort();
        }
        
        const controller = new AbortController();
        state.currentRequest = controller;
        
        fetch(`/api/check_status/${otp}`, {
            signal: controller.signal,
            headers: { 'Cache-Control': 'no-cache' }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response not ok: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            state.currentRequest = null;
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            console.log('Status data received:', data);
            
            // Update UI with new data
            updateStatusUI(data);
            
            // Store the latest queue data in localStorage to maintain state
            updateStoredQueueData(data);
        })
        .catch(error => {
            state.currentRequest = null;
            
            // Don't report aborted requests as errors
            if (error.name === 'AbortError') {
                console.log('Status check aborted for a new request');
                return;
            }
            
            console.error('Error checking status:', error);
            addNotification('Error checking for updates. Will retry...');
            
            // Try reconnecting socket if we had an error
            if (!state.connected && socket) {
                attemptReconnect();
            }
        });
    }
    
    function updateStatusUI(data) {
        // Update position with animation if changed
        if (elements.position && elements.position.textContent != data.position) {
            elements.position.classList.add('position-updated');
            setTimeout(() => elements.position.classList.remove('position-updated'), 2000);
            elements.position.textContent = data.position;
            addNotification(`Position updated: ${data.position}`);
        }
        
        // Update wait time
        if (elements.waitTime) {
            const waitMinutes = Math.round(data.estimated_wait_seconds / 60);
            elements.waitTime.textContent = `${waitMinutes} min`;
        }
        
        // Update last update timestamp
        if (elements.lastUpdateTime) {
            const now = new Date();
            elements.lastUpdateTime.textContent = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
        }
        
        // Show inactive cashier warning if applicable
        if (data.cashier_is_active === false) {
            addNotification('Your cashier is currently inactive. Service may be delayed.');
        }
        
        // Reload page if status has changed
        if (data.status !== customerStatus) {
            addNotification(`Status changed to: ${data.status}. Refreshing page...`);
            setTimeout(() => window.location.reload(), 1500);
        }
    }
    
    function updateStoredQueueData(data) {
        try {
            // Get existing data or create new structure
            let storedData;
            const queueData = localStorage.getItem(`queue_data_${data.company_code}`);
            
            if (queueData) {
                storedData = JSON.parse(queueData);
            } else {
                // Create new queue data object if none exists
                storedData = {
                    otp: data.otp,
                    cashier_number: data.cashier_number
                };
            }
            
            // Update fields
            storedData.position = data.position;
            storedData.status = data.status;
            storedData.estimated_wait_seconds = data.estimated_wait_seconds;
            storedData.last_update = new Date().toISOString();
            
            // Save back to storage
            localStorage.setItem(`queue_data_${data.company_code}`, JSON.stringify(storedData));
        } catch (e) {
            console.error('Error updating stored queue data:', e);
        }
    }
    
    function addNotification(message) {
        if (!elements.notificationList) return;
        
        const notificationItem = document.createElement('div');
        notificationItem.className = 'notification-item fade-in';
        notificationItem.textContent = message;
        elements.notificationList.prepend(notificationItem);
        
        // Keep track of notifications
        state.notificationHistory = [message, ...state.notificationHistory.slice(0, 4)];
        
        // Remove old notifications to keep the list clean
        setTimeout(() => {
            notificationItem.style.opacity = '0';
            setTimeout(() => {
                if (notificationItem && notificationItem.parentNode) {
                    notificationItem.remove();
                }
            }, 300);
        }, CONFIG.NOTIFICATION_DISPLAY_TIME);
    }
    
    function playSound() {
        // Try to play the notification sound with fallbacks
        try {
            const audio = new Audio('/static/audio/notification.mp3');
            
            // Use both promise and event-based approaches for compatibility
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.log('Audio playback failed:', error);
                    // Try fallback sound or alert
                    fallbackNotification();
                });
            }
            
            // Add error event listener for older browsers
            audio.addEventListener('error', () => {
                console.log('Audio playback error event');
                fallbackNotification();
            });
        } catch (e) {
            console.error('Error creating audio:', e);
            fallbackNotification();
        }
    }
    
    function fallbackNotification() {
        // Visual fallback for when audio fails
        const statusCard = document.getElementById('status-container');
        if (statusCard) {
            statusCard.classList.add('position-updated');
            setTimeout(() => statusCard.classList.remove('position-updated'), 2000);
        }
    }
    
    function showConfetti() {
        if (typeof confetti !== 'function') {
            console.warn('Confetti library not loaded');
            return;
        }
        
        confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4b5e80', '#fed7aa', '#e2e8f0'],
            disableForReducedMotion: true
        });
    }
    
    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        localStorage.setItem('soundEnabled', state.soundEnabled);
        
        if (elements.soundToggle) {
            if (state.soundEnabled) {
                elements.soundToggle.textContent = 'Sound On';
                elements.soundToggle.classList.remove('off');
            } else {
                elements.soundToggle.textContent = 'Sound Off';
                elements.soundToggle.classList.add('off');
            }
        }
    }
    
    function joinNewQueue() {
        // Clear all queue data for a fresh start
        const keys = Object.keys(localStorage);
        for (let i = 0; i < keys.length; i++) {
            if (keys[i].startsWith('queue_data_')) {
                localStorage.removeItem(keys[i]);
            }
        }
        
        // Redirect to join queue page
        window.location.href = `/join/${companyCode}`;
    }
});

function toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateToggleIcon(newTheme);
    
    // Update particle colors when theme changes
    updateParticleColors(newTheme);
}

function updateToggleIcon(theme) {
    const toggleIcon = document.querySelector('.toggle-icon');
    if (toggleIcon) {
        toggleIcon.textContent = theme === 'light' ? '🌙' : '☀';
    }
}

function updateParticleColors(theme) {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const particles = window._particles;
    
    if (particles && particles.length) {
        const color = theme === 'dark' ? 'rgba(254, 215, 170, 0.2)' : 'rgba(224, 242, 254, 0.2)';
        particles.forEach(p => p.color = color);
    }
}

function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const theme = document.body.getAttribute('data-theme') || 'dark';
    const color = theme === 'dark' ? 'rgba(254, 215, 170, 0.2)' : 'rgba(224, 242, 254, 0.2)';
    
    const particles = [];
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            radius: Math.random() * 2 + 1,
            vx: Math.random() * 0.5 - 0.25,
            vy: Math.random() * 0.5 - 0.25,
            color: color
        });
    }
    
    // Store particles in window for theme toggle access
    window._particles = particles;
    
    function animateParticles() {
        if (!canvas.parentNode) {
            // Canvas was removed from DOM, stop animation
            return;
        }
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            
            if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
            
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        
        requestAnimationFrame(animateParticles);
    }
    
    // Handle window resize
    const resizeHandler = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    
    window.addEventListener('resize', resizeHandler);
    
    // Start animation
    animateParticles();
} 