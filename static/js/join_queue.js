document.addEventListener('DOMContentLoaded', function() {
    // Configuration
    const CONFIG = {
        NOTIFICATION_TIMEOUT: 5000,
        API_TIMEOUT: 15000
    };
    
    // DOM Elements
    const elements = {
        joinQueueBtn: document.getElementById('join-queue-btn'),
        joiningContainer: document.getElementById('joining-container'),
        resultContainer: document.getElementById('result-container'),
        otpDisplay: document.getElementById('otp-display'),
        cashierDisplay: document.getElementById('cashier-display'),
        positionDisplay: document.getElementById('position-display'),
        waitTimeDisplay: document.getElementById('wait-time-display'),
        statusLink: document.getElementById('status-link'),
        companyCode: document.getElementById('company-code')
    };
    
    // Validate required elements exist
    if (!elements.companyCode) {
        console.error('Company code element not found');
        return;
    }
    
    const companyCode = elements.companyCode.value;
    
    // App State
    let state = {
        isJoining: false,
        currentRequest: null,
        socketInstance: null
    };
    
    // Initialize - Check for existing queue data
    initializeFromStorage();
    
    // Event Listeners
    if (elements.joinQueueBtn) {
        elements.joinQueueBtn.addEventListener('click', handleJoinQueue);
    }
    
    // Function implementations
    function initializeFromStorage() {
        try {
            const queueData = localStorage.getItem(`queue_data_${companyCode}`);
            
            if (!queueData) {
                return;
            }
            
            // Parse the stored data
            const data = JSON.parse(queueData);
            
            // Check if data is valid and has required fields
            if (!data || !data.otp || !data.cashier_number || !data.status) {
                console.error('Invalid queue data in localStorage');
                localStorage.removeItem(`queue_data_${companyCode}`);
                return;
            }
            
            // If the status is 'served' or 'removed', clear the stored data to allow rejoining
            if (data.status === 'served' || data.status === 'removed') {
                console.log('Clearing previous queue data as customer was already served/removed');
                localStorage.removeItem(`queue_data_${companyCode}`);
                return;
            }
            
            // If status is not active (e.g., expired), also clear
            const lastUpdateTime = data.last_update ? new Date(data.last_update) : null;
            const now = new Date();
            // If data is older than 24 hours, consider it expired
            if (lastUpdateTime && now - lastUpdateTime > 24 * 60 * 60 * 1000) {
                console.log('Clearing expired queue data');
                localStorage.removeItem(`queue_data_${companyCode}`);
                return;
            }
            
            // Show the result instead of the join button for active customers
            if (elements.joiningContainer && elements.resultContainer) {
                elements.joiningContainer.classList.add('d-none');
                elements.resultContainer.classList.remove('d-none');
                
                // Update details with stored data
                if (elements.otpDisplay) elements.otpDisplay.textContent = data.otp;
                if (elements.cashierDisplay) elements.cashierDisplay.textContent = `#${data.cashier_number}`;
                if (elements.positionDisplay) elements.positionDisplay.textContent = data.position;
                
                // Calculate wait time in minutes
                if (elements.waitTimeDisplay) {
                    const waitMinutes = Math.round(data.estimated_wait_seconds / 60);
                    elements.waitTimeDisplay.textContent = `~${waitMinutes} minutes`;
                }
                
                // Set status link
                if (elements.statusLink) {
                    elements.statusLink.href = `/queue_status/${data.otp}`;
                }
                
                // Verify stored data with server
                verifyQueueStatus(data.otp);
            }
        } catch (e) {
            console.error('Error parsing stored queue data:', e);
            // Clear invalid data
            localStorage.removeItem(`queue_data_${companyCode}`);
        }
    }
    
    function verifyQueueStatus(otp) {
        // Verify with the server that this queue position is still valid
        fetch(`/api/check_status/${otp}`, {
            headers: { 'Cache-Control': 'no-cache' }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to verify queue status');
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                // Queue entry no longer exists
                resetQueueData();
                return;
            }
            
            // Update localStorage with fresh data
            const storedData = JSON.parse(localStorage.getItem(`queue_data_${companyCode}`));
            if (storedData) {
                storedData.position = data.position;
                storedData.status = data.status;
                storedData.estimated_wait_seconds = data.estimated_wait_seconds;
                storedData.last_update = new Date().toISOString();
                localStorage.setItem(`queue_data_${companyCode}`, JSON.stringify(storedData));
                
                // Update UI with fresh data
                if (elements.positionDisplay) {
                    elements.positionDisplay.textContent = data.position;
                }
                if (elements.waitTimeDisplay) {
                    const waitMinutes = Math.round(data.estimated_wait_seconds / 60);
                    elements.waitTimeDisplay.textContent = `~${waitMinutes} minutes`;
                }
                
                // If status changed to served/removed, reset view
                if (data.status === 'served' || data.status === 'removed') {
                    resetQueueData();
                }
            }
        })
        .catch(error => {
            console.error('Error verifying queue status:', error);
            // Don't clear stored data on network errors to avoid disruption
        });
    }
    
    function resetQueueData() {
        localStorage.removeItem(`queue_data_${companyCode}`);
        if (elements.joiningContainer && elements.resultContainer) {
            elements.resultContainer.classList.add('d-none');
            elements.joiningContainer.classList.remove('d-none');
        }
    }
    
    function handleJoinQueue() {
        if (state.isJoining) return; // Prevent multiple clicks
        
        state.isJoining = true;
        
        if (elements.joinQueueBtn) {
            elements.joinQueueBtn.disabled = true;
            elements.joinQueueBtn.textContent = 'Please wait...';
        }
        
        // Cancel any existing request
        if (state.currentRequest) {
            state.currentRequest.abort();
        }
        
        // Create a new AbortController
        const controller = new AbortController();
        state.currentRequest = controller;
        
        // Set up timeout to abort long-running requests
        const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
        
        // Join queue API call
        fetch(`/api/join_queue/${companyCode}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal
        })
        .then(response => {
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            state.currentRequest = null;
            state.isJoining = false;
            
            if (data.success) {
                handleSuccessfulJoin(data);
            } else {
                handleFailedJoin(data.error || 'Could not join queue. Please try again.');
            }
        })
        .catch(error => {
            clearTimeout(timeoutId);
            state.currentRequest = null;
            state.isJoining = false;
            
            if (error.name === 'AbortError') {
                handleFailedJoin('Request timed out. Please try again.');
            } else {
                console.error('Error joining queue:', error);
                handleFailedJoin('Error joining queue. Please try again.');
            }
        });
    }
    
    function handleSuccessfulJoin(data) {
        // Store the queue data in localStorage
        const queueData = {
            otp: data.otp,
            cashier_number: data.cashier_number,
            position: data.position,
            status: data.status || 'waiting',
            estimated_wait_seconds: data.estimated_wait_seconds,
            last_update: new Date().toISOString()
        };
        localStorage.setItem(`queue_data_${companyCode}`, JSON.stringify(queueData));
        
        // Redirect directly to the queue status page
        window.location.href = `/queue_status/${data.otp}`;
    }
    
    function handleFailedJoin(errorMessage) {
        alert('Error: ' + errorMessage);
        if (elements.joinQueueBtn) {
            elements.joinQueueBtn.disabled = false;
            elements.joinQueueBtn.textContent = 'Join Queue';
        }
    }
    
    function initializeSocket(otp) {
        if (state.socketInstance) {
            // Clean up existing socket
            state.socketInstance.disconnect();
        }
        
        const socket = io({
            transports: ['websocket'],
            upgrade: false,
            reconnectionAttempts: 3
        });
        
        state.socketInstance = socket;
        
        socket.on('connect', function() {
            console.log('Socket connected for real-time updates');
            socket.emit('join_customer_room', { otp: otp });
        });
        
        // Listen for turn notifications
        socket.on('customer_turn', function(turnData) {
            if (turnData.otp === otp) {
                // It's this customer's turn
                showNotification("It's your turn!", 
                    `Please proceed to Cashier #${turnData.cashier_number}`, 
                    elements.statusLink ? elements.statusLink.href : null);
            }
        });
        
        socket.on('connect_error', function(error) {
            console.log('Socket connection error:', error);
            // Socket errors are non-critical, the user can still check status manually
        });
        
        socket.on('disconnect', function() {
            console.log('Socket disconnected');
        });
    }
    
    // Function to show browser notification
    function showNotification(title, message, url) {
        // First try browser notifications
        if ("Notification" in window) {
            if (Notification.permission === "granted") {
                sendBrowserNotification(title, message, url);
            } else if (Notification.permission !== "denied") {
                Notification.requestPermission().then(function (permission) {
                    if (permission === "granted") {
                        sendBrowserNotification(title, message, url);
                    } else {
                        // Fallback to alert
                        showAlert(title, message);
                    }
                });
            } else {
                // Notification permission denied
                showAlert(title, message);
            }
        } else {
            // Browser doesn't support notifications
            showAlert(title, message);
        }
    }
    
    function sendBrowserNotification(title, message, url) {
        try {
            const notification = new Notification(title, {
                body: message,
                icon: '/static/img/notification-icon.png'
            });
            
            if (url) {
                notification.onclick = function() {
                    window.open(url, '_blank');
                };
            }
            
            // Also show an alert for mobile devices
            showAlert(title, message);
        } catch (e) {
            console.error('Error sending notification:', e);
            showAlert(title, message);
        }
    }
    
    function showAlert(title, message) {
        alert(`${title}: ${message}`);
    }
}); 