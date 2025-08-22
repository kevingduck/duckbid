// API base URL - will use current domain in production
const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';

// Global auction items storage
let auctionItems = [];

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
        auctionItems = await apiCall('/items');
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

    auctionItems.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'auction-item';
        itemDiv.innerHTML = `
            <h3>${item.title}</h3>
            <p><strong>Description:</strong> ${item.description}</p>
            <p><strong>Event Date:</strong> ${item.date}</p>
            <div class="current-bid">Current Bid: $${item.currentBid}</div>
            ${item.highBidder ? `<div class="high-bidder">High Bidder: ${item.highBidder.name}</div>` : ''}
            <button class="bid-button" onclick="openBidModal(${item.id})">Place Bid</button>
        `;
        grid.appendChild(itemDiv);
    });
}

// Open bid modal
function openBidModal(itemId) {
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

// Initialize the app
document.addEventListener('DOMContentLoaded', async function() {
    // Load items from API and render
    await loadItems();
    renderAuctionItems();
    
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