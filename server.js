const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'duckbid2024';

// Auction end time (August 29, 2024 at 2:00 PM EST)
const AUCTION_END_TIME = new Date('2024-08-29T14:00:00-04:00');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Admin route redirect
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Database file paths
const DATA_DIR = './data';
const ITEMS_FILE = path.join(DATA_DIR, 'items.json');
const BIDS_FILE = path.join(DATA_DIR, 'bids.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Initialize database files
function initDatabase() {
    // Rotary Club Football Ticket Auction Items
    const defaultItems = [
        {
            id: 1,
            title: "SC State Bulldogs",
            description: "Four Tickets in Section 7 with Parking Pass in Garnet Way",
            date: "Sept 6 @ 7:00PM",
            startingBid: 25,
            active: true
        },
        {
            id: 2,
            title: "Vanderbilt Commodores",
            description: "Four Tickets in Section 7 with Parking Pass in Garnet Way",
            date: "Sept 13",
            startingBid: 50,
            active: true
        },
        {
            id: 3,
            title: "Kentucky Wildcats",
            description: "Four Tickets in Section 7 with Parking Pass in Garnet Way",
            date: "Sept 27",
            startingBid: 75,
            active: true
        },
        {
            id: 4,
            title: "Oklahoma Sooners",
            description: "Four Tickets in Section 7 with Parking Pass in Garnet Way",
            date: "Oct 18",
            startingBid: 100,
            active: true
        },
        {
            id: 5,
            title: "Alabama Crimson Tide",
            description: "Four Tickets in Section 7 with Parking Pass in Garnet Way",
            date: "Oct 25",
            startingBid: 150,
            active: true
        },
        {
            id: 6,
            title: "Coastal Carolina Chanticleers",
            description: "Four Tickets in Section 7 with Parking Pass in Garnet Way",
            date: "Nov 22",
            startingBid: 40,
            active: true
        }
    ];

    if (!fs.existsSync(ITEMS_FILE)) {
        fs.writeFileSync(ITEMS_FILE, JSON.stringify(defaultItems, null, 2));
    }

    if (!fs.existsSync(BIDS_FILE)) {
        fs.writeFileSync(BIDS_FILE, JSON.stringify({}, null, 2));
    }
}

// Database helper functions
function readItems() {
    try {
        const data = fs.readFileSync(ITEMS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading items:', err);
        return [];
    }
}

function writeItems(items) {
    try {
        fs.writeFileSync(ITEMS_FILE, JSON.stringify(items, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing items:', err);
        return false;
    }
}

function readBids() {
    try {
        const data = fs.readFileSync(BIDS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading bids:', err);
        return {};
    }
}

function writeBids(bids) {
    try {
        fs.writeFileSync(BIDS_FILE, JSON.stringify(bids, null, 2));
        return true;
    } catch (err) {
        console.error('Error writing bids:', err);
        return false;
    }
}

function getHighestBid(itemId, bids) {
    const itemBids = bids[itemId] || [];
    if (itemBids.length === 0) {
        return null;
    }
    return itemBids.reduce((highest, current) => 
        current.amount > highest.amount ? current : highest
    );
}

function isAuctionClosed() {
    return new Date() > AUCTION_END_TIME;
}

// Initialize database
initDatabase();

// Public API Routes

// Get all active auction items with current bids
app.get('/api/items', (req, res) => {
    try {
        const items = readItems().filter(item => item.active);
        const bids = readBids();
        const auctionClosed = isAuctionClosed();
        
        const itemsWithBids = items.map(item => {
            const highestBid = getHighestBid(item.id, bids);
            return {
                ...item,
                currentBid: highestBid ? highestBid.amount : item.startingBid,
                highBidder: highestBid ? { name: highestBid.name } : null,
                auctionClosed
            };
        });
        
        res.json({
            items: itemsWithBids,
            auctionClosed,
            auctionEndTime: AUCTION_END_TIME.toISOString()
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// Place a bid
app.post('/api/bid', (req, res) => {
    try {
        // Check if auction is closed
        if (isAuctionClosed()) {
            return res.status(403).json({ error: 'Auction has ended. Bidding is now closed.' });
        }

        const { itemId, name, email, phone, amount } = req.body;
        
        if (!itemId || !name || !email || !phone || !amount) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const items = readItems();
        const item = items.find(i => i.id === parseInt(itemId));
        
        if (!item || !item.active) {
            return res.status(404).json({ error: 'Item not found or inactive' });
        }

        const bids = readBids();
        const highestBid = getHighestBid(itemId, bids);
        const minBid = highestBid ? highestBid.amount : item.startingBid;

        if (amount <= minBid) {
            return res.status(400).json({ 
                error: `Bid must be higher than current bid of $${minBid}` 
            });
        }

        // Add the bid
        if (!bids[itemId]) {
            bids[itemId] = [];
        }

        const newBid = {
            name,
            email,
            phone,
            amount: parseFloat(amount),
            timestamp: new Date().toISOString()
        };

        bids[itemId].push(newBid);
        
        if (!writeBids(bids)) {
            return res.status(500).json({ error: 'Failed to save bid' });
        }

        res.json({ 
            success: true, 
            message: `Bid placed successfully! You are now the high bidder at $${amount}`,
            currentBid: amount
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to place bid' });
    }
});

// Admin Authentication
app.post('/api/admin/auth', (req, res) => {
    const { password } = req.body;
    
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: 'admin-authenticated' });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

// Admin middleware
function requireAdmin(req, res, next) {
    const auth = req.headers.authorization;
    if (auth !== 'Bearer admin-authenticated') {
        return res.status(401).json({ error: 'Admin authentication required' });
    }
    next();
}

// Admin API Routes

// Get all items (including inactive)
app.get('/api/admin/items', requireAdmin, (req, res) => {
    try {
        const items = readItems();
        const bids = readBids();
        
        const itemsWithBids = items.map(item => {
            const itemBids = bids[item.id] || [];
            const highestBid = getHighestBid(item.id, bids);
            return {
                ...item,
                currentBid: highestBid ? highestBid.amount : item.startingBid,
                highBidder: highestBid,
                totalBids: itemBids.length
            };
        });
        
        res.json(itemsWithBids);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// Get all bids
app.get('/api/admin/bids', requireAdmin, (req, res) => {
    try {
        const bids = readBids();
        const items = readItems();
        
        const allBids = [];
        
        for (const [itemId, itemBids] of Object.entries(bids)) {
            const item = items.find(i => i.id === parseInt(itemId));
            const highestBid = getHighestBid(parseInt(itemId), bids);
            
            itemBids.forEach(bid => {
                allBids.push({
                    ...bid,
                    itemId: parseInt(itemId),
                    itemTitle: item ? item.title : 'Unknown Item',
                    isWinning: highestBid && bid.amount === highestBid.amount && bid.timestamp === highestBid.timestamp
                });
            });
        }
        
        // Sort by timestamp (newest first)
        allBids.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json(allBids);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Add new item
app.post('/api/admin/items', requireAdmin, (req, res) => {
    try {
        const { title, description, date, startingBid } = req.body;
        
        if (!title || !description || !date || !startingBid) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const items = readItems();
        const newId = Math.max(...items.map(i => i.id), 0) + 1;
        
        const newItem = {
            id: newId,
            title,
            description,
            date,
            startingBid: parseFloat(startingBid),
            active: true
        };

        items.push(newItem);
        
        if (!writeItems(items)) {
            return res.status(500).json({ error: 'Failed to save item' });
        }

        res.json({ success: true, item: newItem });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add item' });
    }
});

// Update item
app.put('/api/admin/items/:id', requireAdmin, (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        const { title, description, date, startingBid, active } = req.body;
        
        const items = readItems();
        const itemIndex = items.findIndex(i => i.id === itemId);
        
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found' });
        }

        items[itemIndex] = {
            ...items[itemIndex],
            title: title || items[itemIndex].title,
            description: description || items[itemIndex].description,
            date: date || items[itemIndex].date,
            startingBid: startingBid !== undefined ? parseFloat(startingBid) : items[itemIndex].startingBid,
            active: active !== undefined ? active : items[itemIndex].active
        };
        
        if (!writeItems(items)) {
            return res.status(500).json({ error: 'Failed to update item' });
        }

        res.json({ success: true, item: items[itemIndex] });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Delete item
app.delete('/api/admin/items/:id', requireAdmin, (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        
        const items = readItems();
        const filteredItems = items.filter(i => i.id !== itemId);
        
        if (filteredItems.length === items.length) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        if (!writeItems(filteredItems)) {
            return res.status(500).json({ error: 'Failed to delete item' });
        }

        // Also remove bids for this item
        const bids = readBids();
        delete bids[itemId];
        writeBids(bids);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);
});