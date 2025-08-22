// Sample auction items data
const auctionItems = [
    {
        id: 1,
        title: "Football vs State Championship",
        description: "2 premium seats, Section A, Row 5",
        date: "Saturday, Oct 15, 2024",
        startingBid: 50
    },
    {
        id: 2,
        title: "Basketball Season Opener",
        description: "4 courtside tickets with parking pass",
        date: "Friday, Nov 12, 2024",
        startingBid: 75
    },
    {
        id: 3,
        title: "Baseball Regional Finals",
        description: "6 tickets behind home plate",
        date: "Sunday, May 20, 2024",
        startingBid: 40
    },
    {
        id: 4,
        title: "Soccer Conference Championship",
        description: "2 VIP tickets with pre-game access",
        date: "Wednesday, Nov 8, 2024",
        startingBid: 60
    },
    {
        id: 5,
        title: "Wrestling State Tournament",
        description: "4 front row seats, all-day pass",
        date: "Saturday, Feb 18, 2024",
        startingBid: 35
    },
    {
        id: 6,
        title: "Track & Field Championships",
        description: "8 general admission tickets",
        date: "Friday, Apr 28, 2024",
        startingBid: 25
    }
];

// Get bids from localStorage
function getBids() {
    const bids = localStorage.getItem('auctionBids');
    return bids ? JSON.parse(bids) : {};
}

// Save bids to localStorage
function saveBids(bids) {
    localStorage.setItem('auctionBids', JSON.stringify(bids));
}

// Get highest bid for an item
function getHighestBid(itemId) {
    const bids = getBids();
    const itemBids = bids[itemId] || [];
    if (itemBids.length === 0) {
        return { amount: auctionItems.find(item => item.id === itemId).startingBid, bidder: null };
    }
    return itemBids.reduce((highest, current) => 
        current.amount > highest.amount ? current : highest
    );
}

// Render auction items
function renderAuctionItems() {
    const grid = document.getElementById('auctionGrid');
    grid.innerHTML = '';

    auctionItems.forEach(item => {
        const highestBid = getHighestBid(item.id);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'auction-item';
        itemDiv.innerHTML = `
            <h3>${item.title}</h3>
            <p><strong>Description:</strong> ${item.description}</p>
            <p><strong>Event Date:</strong> ${item.date}</p>
            <div class="current-bid">Current Bid: $${highestBid.amount}</div>
            ${highestBid.bidder ? `<div class="high-bidder">High Bidder: ${highestBid.bidder.name}</div>` : ''}
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
    const highestBid = getHighestBid(itemId);
    
    modalTitle.textContent = `Bid on: ${item.title}`;
    document.getElementById('bidAmount').min = highestBid.amount + 1;
    document.getElementById('bidAmount').placeholder = `Minimum bid: $${highestBid.amount + 1}`;
    
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
function handleBidSubmission(event) {
    event.preventDefault();
    
    const itemId = parseInt(document.getElementById('bidModal').dataset.itemId);
    const name = document.getElementById('bidderName').value;
    const email = document.getElementById('bidderEmail').value;
    const phone = document.getElementById('bidderPhone').value;
    const amount = parseFloat(document.getElementById('bidAmount').value);
    
    const highestBid = getHighestBid(itemId);
    
    if (amount <= highestBid.amount) {
        alert(`Your bid must be higher than the current bid of $${highestBid.amount}`);
        return;
    }
    
    // Save the bid
    const bids = getBids();
    if (!bids[itemId]) {
        bids[itemId] = [];
    }
    
    bids[itemId].push({
        name: name,
        email: email,
        phone: phone,
        amount: amount,
        timestamp: new Date().toISOString()
    });
    
    saveBids(bids);
    closeBidModal();
    renderAuctionItems();
    
    alert(`Bid placed successfully! You are now the high bidder at $${amount}`);
}

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
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