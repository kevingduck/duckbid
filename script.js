// API base URL - will use current domain in production
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

// Global auction items storage
let auctionItems = [];
let auctionData = {};
let countdownInterval;

// API helper function
async function apiCall(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}/api${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// Load items from API
async function loadItems() {
    try {
        auctionData = await apiCall('/items');
        auctionItems = auctionData.items || [];
        return auctionItems;
    } catch (error) {
        alert('Failed to load auction items: ' + error.message);
        return [];
    }
}

// Render auction items
function renderAuctionItems() {
    const grid = document.getElementById('auctionGrid');
    grid.innerHTML = '';

    if (auctionItems.length === 0) {
        grid.innerHTML = '<p>Loading auction items...</p>';
        return;
    }

    const auctionClosed = auctionData.auctionClosed;

    auctionItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'auction-item';
        
        const buttonContent = auctionClosed 
            ? '<button class="bid-button" disabled style="opacity: 0.6; cursor: not-allowed;">Auction Closed</button>'
            : `<button class="bid-button" onclick="openBidModal(${item.id})">Place Bid</button>`;
        
        itemDiv.innerHTML = `
            <h3>${item.title}</h3>
            <p><strong>Description:</strong> ${item.description}</p>
            <p><strong>Event Date:</strong> ${item.date}</p>
            <div class="current-bid">Current Bid: $${item.currentBid}</div>
            ${buttonContent}
        `;
        grid.appendChild(itemDiv);
    });
}

// Open bid modal
function openBidModal(itemId) {
    // Check if auction is closed
    if (auctionData.auctionClosed) {
        alert('Auction has ended. Bidding is now closed.');
        return;
    }

    const modal = document.getElementById('bidModal');
    const modalTitle = document.getElementById('modalTitle');
    const item = auctionItems.find(i => i.id === itemId);
    
    if (!item) return;
    
    modalTitle.textContent = `Bid on: ${item.title}`;
    document.getElementById('bidAmount').min = item.currentBid + 1;
    document.getElementById('bidAmount').placeholder = `Minimum bid: $${item.currentBid + 1}`;
    
    modal.style.display = 'block';
    modal.dataset.itemId = itemId;
}

// Close bid modal
function closeBidModal() {
    const modal = document.getElementById('bidModal');
    modal.style.display = 'none';
    document.getElementById('bidForm').reset();
}

// Handle bid submission
async function handleBidSubmission(event) {
    event.preventDefault();
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Placing Bid...';
    
    try {
        const itemId = parseInt(document.getElementById('bidModal').dataset.itemId);
        const name = document.getElementById('bidderName').value;
        const email = document.getElementById('bidderEmail').value;
        const phone = document.getElementById('bidderPhone').value;
        const amount = parseFloat(document.getElementById('bidAmount').value);
        
        const result = await apiCall('/bid', {
            method: 'POST',
            body: JSON.stringify({
                itemId,
                name,
                email,
                phone,
                amount
            })
        });
        
        alert(result.message);
        closeBidModal();
        
        // Reload items to show updated bids
        await loadItems();
        renderAuctionItems();
        
    } catch (error) {
        alert('Failed to place bid: ' + error.message);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Place Bid';
    }
}

// Countdown timer
function updateCountdown() {
    if (!auctionData.auctionEndTime) return;
    
    const endTime = new Date(auctionData.auctionEndTime);
    const now = new Date();
    const timeLeft = endTime - now;
    
    const countdownElement = document.getElementById('countdown');
    if (!countdownElement) return;
    
    if (timeLeft <= 0) {
        countdownElement.innerHTML = '<strong style="color: #e74c3c;">Auction Ended</strong>';
        clearInterval(countdownInterval);
        // Reload to show closed state
        loadItems().then(() => renderAuctionItems());
        return;
    }
    
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
    
    countdownElement.innerHTML = `
        <strong>Time Remaining: ${days}d ${hours}h ${minutes}m ${seconds}s</strong>
    `;
}

function startCountdown() {
    if (auctionData.auctionClosed) {
        const countdownElement = document.getElementById('countdown');
        if (countdownElement) {
            countdownElement.innerHTML = '<strong style="color: #e74c3c;">Auction Ended</strong>';
        }
        return;
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', async function() {
    // Load items from API and render
    await loadItems();
    renderAuctionItems();
    startCountdown();
    
    // Modal event listeners
    document.querySelector('.close').addEventListener('click', closeBidModal);
    document.getElementById('bidForm').addEventListener('submit', handleBidSubmission);
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('bidModal');
        if (event.target === modal) {
            closeBidModal();
        }
    });
});