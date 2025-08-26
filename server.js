const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'duckbid2024';

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_0nYjAQcFg8ve@ep-calm-sound-aduhe8zo-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
    ssl: { rejectUnauthorized: false }
});

// Auction end time (August 29, 2025 at 2:00 PM EST)
const AUCTION_END_TIME = new Date('2025-08-29T14:00:00-04:00');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Admin route redirect
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Initialize database tables
async function initDatabase() {
    try {
        // Create items table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS items (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                date VARCHAR(100) NOT NULL,
                starting_bid DECIMAL(10,2) NOT NULL,
                active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create bids table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bids (
                id SERIAL PRIMARY KEY,
                item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50) NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Check if items exist, if not add default items
        const itemCount = await pool.query('SELECT COUNT(*) FROM items');
        if (parseInt(itemCount.rows[0].count) === 0) {
            const defaultItems = [
                ['SC State Bulldogs', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Sept 6 @ 7:00PM', 25],
                ['Vanderbilt Commodores', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Sept 13', 25],
                ['Kentucky Wildcats', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Sept 27', 25],
                ['Oklahoma Sooners', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Oct 18', 25],
                ['Alabama Crimson Tide', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Oct 25', 25],
                ['Coastal Carolina Chanticleers', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Nov 22', 25]
            ];

            for (const [title, description, date, startingBid] of defaultItems) {
                await pool.query(
                    'INSERT INTO items (title, description, date, starting_bid) VALUES ($1, $2, $3, $4)',
                    [title, description, date, startingBid]
                );
            }
        } else {
            // Update existing items to have correct starting bids if they're wrong
            await pool.query('UPDATE items SET starting_bid = 25 WHERE starting_bid != 25');
            
            // Ensure SC State Bulldogs exists
            const scStateExists = await pool.query('SELECT COUNT(*) FROM items WHERE title = $1', ['SC State Bulldogs']);
            if (parseInt(scStateExists.rows[0].count) === 0) {
                await pool.query(
                    'INSERT INTO items (title, description, date, starting_bid) VALUES ($1, $2, $3, $4)',
                    ['SC State Bulldogs', 'Four Tickets in Section 7 with Parking Pass in Garnet Way', 'Sept 6 @ 7:00PM', 25]
                );
            }
            
            // Update dates to ensure proper ordering
            await pool.query('UPDATE items SET date = $1 WHERE title = $2', ['Sept 6 @ 7:00PM', 'SC State Bulldogs']);
            await pool.query('UPDATE items SET date = $1 WHERE title = $2', ['Sept 13', 'Vanderbilt Commodores']);
            await pool.query('UPDATE items SET date = $1 WHERE title = $2', ['Sept 27', 'Kentucky Wildcats']);
            await pool.query('UPDATE items SET date = $1 WHERE title = $2', ['Oct 18', 'Oklahoma Sooners']);
            await pool.query('UPDATE items SET date = $1 WHERE title = $2', ['Oct 25', 'Alabama Crimson Tide']);
            await pool.query('UPDATE items SET date = $1 WHERE title = $2', ['Nov 22', 'Coastal Carolina Chanticleers']);
        }

        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Database initialization error:', err);
    }
}

// Database helper functions
async function readItems() {
    try {
        // Custom ordering to show items by game date
        const result = await pool.query(`
            SELECT * FROM items 
            ORDER BY 
                CASE title
                    WHEN 'SC State Bulldogs' THEN 1
                    WHEN 'Vanderbilt Commodores' THEN 2
                    WHEN 'Kentucky Wildcats' THEN 3
                    WHEN 'Oklahoma Sooners' THEN 4
                    WHEN 'Alabama Crimson Tide' THEN 5
                    WHEN 'Coastal Carolina Chanticleers' THEN 6
                    ELSE 99
                END
        `);
        return result.rows.map(row => ({
            id: row.id,
            title: row.title,
            description: row.description,
            date: row.date,
            startingBid: parseFloat(row.starting_bid),
            active: row.active
        }));
    } catch (err) {
        console.error('Error reading items:', err);
        return [];
    }
}

async function writeItems(items) {
    try {
        // This function is kept for compatibility but not used in new implementation
        return true;
    } catch (err) {
        console.error('Error writing items:', err);
        return false;
    }
}

async function readBids() {
    try {
        const result = await pool.query('SELECT * FROM bids ORDER BY created_at');
        const bids = {};
        result.rows.forEach(row => {
            if (!bids[row.item_id]) {
                bids[row.item_id] = [];
            }
            bids[row.item_id].push({
                name: row.name,
                email: row.email,
                phone: row.phone,
                amount: parseFloat(row.amount),
                timestamp: row.created_at.toISOString()
            });
        });
        return bids;
    } catch (err) {
        console.error('Error reading bids:', err);
        return {};
    }
}

async function writeBids(bids) {
    try {
        // This function is kept for compatibility but not used in new implementation
        return true;
    } catch (err) {
        console.error('Error writing bids:', err);
        return false;
    }
}

async function getHighestBid(itemId, bids) {
    try {
        const result = await pool.query(
            'SELECT * FROM bids WHERE item_id = $1 ORDER BY amount DESC, created_at ASC LIMIT 1',
            [itemId]
        );
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const row = result.rows[0];
        return {
            name: row.name,
            email: row.email,
            phone: row.phone,
            amount: parseFloat(row.amount),
            timestamp: row.created_at.toISOString()
        };
    } catch (err) {
        console.error('Error getting highest bid:', err);
        return null;
    }
}

function isAuctionClosed() {
    return new Date() > AUCTION_END_TIME;
}

// Initialize database
initDatabase().catch(console.error);

// Public API Routes

// Get all active auction items with current bids
app.get('/api/items', async (req, res) => {
    try {
        const items = (await readItems()).filter(item => item.active);
        const auctionClosed = isAuctionClosed();
        
        const itemsWithBids = await Promise.all(items.map(async item => {
            const highestBid = await getHighestBid(item.id);
            return {
                ...item,
                currentBid: highestBid ? highestBid.amount : item.startingBid,
                highBidder: highestBid ? { name: highestBid.name } : null,
                auctionClosed
            };
        }));
        
        res.json({
            items: itemsWithBids,
            auctionClosed,
            auctionEndTime: AUCTION_END_TIME.toISOString()
        });
    } catch (err) {
        console.error('Error fetching items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// Place a bid
app.post('/api/bid', async (req, res) => {
    try {
        // Check if auction is closed
        if (isAuctionClosed()) {
            return res.status(403).json({ error: 'Auction has ended. Bidding is now closed.' });
        }

        const { itemId, name, email, phone, amount } = req.body;
        
        if (!itemId || !name || !email || !phone || !amount) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const items = await readItems();
        const item = items.find(i => i.id === parseInt(itemId));
        
        if (!item || !item.active) {
            return res.status(404).json({ error: 'Item not found or inactive' });
        }

        const highestBid = await getHighestBid(itemId);
        const minBid = highestBid ? highestBid.amount : item.startingBid;

        if (amount <= minBid) {
            return res.status(400).json({ 
                error: `Bid must be higher than current bid of $${minBid}` 
            });
        }

        // Add the bid to database
        await pool.query(
            'INSERT INTO bids (item_id, name, email, phone, amount) VALUES ($1, $2, $3, $4, $5)',
            [itemId, name, email, phone, parseFloat(amount)]
        );

        res.json({ 
            success: true, 
            message: `Bid placed successfully! You are now the high bidder at $${amount}`,
            currentBid: amount
        });
    } catch (err) {
        console.error('Error placing bid:', err);
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
app.get('/api/admin/items', requireAdmin, async (req, res) => {
    try {
        const items = await readItems();
        
        const itemsWithBids = await Promise.all(items.map(async item => {
            const highestBid = await getHighestBid(item.id);
            const bidCount = await pool.query('SELECT COUNT(*) FROM bids WHERE item_id = $1', [item.id]);
            return {
                ...item,
                currentBid: highestBid ? highestBid.amount : item.startingBid,
                highBidder: highestBid,
                totalBids: parseInt(bidCount.rows[0].count)
            };
        }));
        
        res.json(itemsWithBids);
    } catch (err) {
        console.error('Error fetching admin items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// Get all bids
app.get('/api/admin/bids', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, i.title as item_title,
                   CASE WHEN b.amount = (
                       SELECT MAX(amount) FROM bids b2 
                       WHERE b2.item_id = b.item_id
                   ) THEN true ELSE false END as is_winning
            FROM bids b
            LEFT JOIN items i ON b.item_id = i.id
            ORDER BY b.created_at DESC
        `);
        
        const allBids = result.rows.map(row => ({
            id: row.id,
            name: row.name,
            email: row.email,
            phone: row.phone,
            amount: parseFloat(row.amount),
            timestamp: row.created_at.toISOString(),
            itemId: row.item_id,
            itemTitle: row.item_title || 'Unknown Item',
            isWinning: row.is_winning
        }));
        
        res.json(allBids);
    } catch (err) {
        console.error('Error fetching admin bids:', err);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
});

// Add new item
app.post('/api/admin/items', requireAdmin, async (req, res) => {
    try {
        const { title, description, date, startingBid } = req.body;
        
        if (!title || !description || !date || !startingBid) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const result = await pool.query(
            'INSERT INTO items (title, description, date, starting_bid) VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, date, parseFloat(startingBid)]
        );
        
        const newItem = {
            id: result.rows[0].id,
            title: result.rows[0].title,
            description: result.rows[0].description,
            date: result.rows[0].date,
            startingBid: parseFloat(result.rows[0].starting_bid),
            active: result.rows[0].active
        };

        res.json({ success: true, item: newItem });
    } catch (err) {
        console.error('Error adding item:', err);
        res.status(500).json({ error: 'Failed to add item' });
    }
});

// Update item
app.put('/api/admin/items/:id', requireAdmin, async (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        const { title, description, date, startingBid, active } = req.body;
        
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        if (title !== undefined) {
            updateFields.push(`title = $${paramCount++}`);
            values.push(title);
        }
        if (description !== undefined) {
            updateFields.push(`description = $${paramCount++}`);
            values.push(description);
        }
        if (date !== undefined) {
            updateFields.push(`date = $${paramCount++}`);
            values.push(date);
        }
        if (startingBid !== undefined) {
            updateFields.push(`starting_bid = $${paramCount++}`);
            values.push(parseFloat(startingBid));
        }
        if (active !== undefined) {
            updateFields.push(`active = $${paramCount++}`);
            values.push(active);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        values.push(itemId);
        
        const result = await pool.query(
            `UPDATE items SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const updatedItem = {
            id: result.rows[0].id,
            title: result.rows[0].title,
            description: result.rows[0].description,
            date: result.rows[0].date,
            startingBid: parseFloat(result.rows[0].starting_bid),
            active: result.rows[0].active
        };

        res.json({ success: true, item: updatedItem });
    } catch (err) {
        console.error('Error updating item:', err);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Delete item
app.delete('/api/admin/items/:id', requireAdmin, async (req, res) => {
    try {
        const itemId = parseInt(req.params.id);
        
        const result = await pool.query('DELETE FROM items WHERE id = $1 RETURNING id', [itemId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Bids will be automatically deleted due to CASCADE constraint
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting item:', err);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Get individual bid details
app.get('/api/admin/bids/:id', requireAdmin, async (req, res) => {
    try {
        const bidId = parseInt(req.params.id);
        
        const result = await pool.query(`
            SELECT b.*, i.title as item_title
            FROM bids b
            LEFT JOIN items i ON b.item_id = i.id
            WHERE b.id = $1
        `, [bidId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        const row = result.rows[0];
        const bid = {
            id: row.id,
            itemId: row.item_id,
            itemTitle: row.item_title,
            name: row.name,
            email: row.email,
            phone: row.phone,
            amount: parseFloat(row.amount),
            timestamp: row.created_at.toISOString()
        };
        
        res.json(bid);
    } catch (err) {
        console.error('Error fetching bid details:', err);
        res.status(500).json({ error: 'Failed to fetch bid details' });
    }
});

// Update/edit an existing bid
app.put('/api/admin/bids/:id', requireAdmin, async (req, res) => {
    try {
        const bidId = parseInt(req.params.id);
        const { name, email, phone, amount } = req.body;
        
        const updateFields = [];
        const values = [];
        let paramCount = 1;
        
        if (name !== undefined) {
            updateFields.push(`name = $${paramCount++}`);
            values.push(name);
        }
        if (email !== undefined) {
            updateFields.push(`email = $${paramCount++}`);
            values.push(email);
        }
        if (phone !== undefined) {
            updateFields.push(`phone = $${paramCount++}`);
            values.push(phone);
        }
        if (amount !== undefined) {
            updateFields.push(`amount = $${paramCount++}`);
            values.push(parseFloat(amount));
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }
        
        values.push(bidId);
        
        const result = await pool.query(
            `UPDATE bids SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            values
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bid not found' });
        }
        
        const updatedBid = {
            id: result.rows[0].id,
            itemId: result.rows[0].item_id,
            name: result.rows[0].name,
            email: result.rows[0].email,
            phone: result.rows[0].phone,
            amount: parseFloat(result.rows[0].amount),
            timestamp: result.rows[0].created_at.toISOString()
        };
        
        res.json({ success: true, bid: updatedBid });
    } catch (err) {
        console.error('Error updating bid:', err);
        res.status(500).json({ error: 'Failed to update bid' });
    }
});

// Delete a bid
app.delete('/api/admin/bids/:id', requireAdmin, async (req, res) => {
    try {
        const bidId = parseInt(req.params.id);
        
        const result = await pool.query('DELETE FROM bids WHERE id = $1 RETURNING id', [bidId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Bid not found' });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting bid:', err);
        res.status(500).json({ error: 'Failed to delete bid' });
    }
});

// Add a new bid manually (admin only)
app.post('/api/admin/bids', requireAdmin, async (req, res) => {
    try {
        const { itemId, name, email, phone, amount } = req.body;
        
        if (!itemId || !name || !email || !phone || !amount) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Verify item exists
        const itemCheck = await pool.query('SELECT id FROM items WHERE id = $1', [itemId]);
        if (itemCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const result = await pool.query(
            'INSERT INTO bids (item_id, name, email, phone, amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [itemId, name, email, phone, parseFloat(amount)]
        );
        
        const newBid = {
            id: result.rows[0].id,
            itemId: result.rows[0].item_id,
            name: result.rows[0].name,
            email: result.rows[0].email,
            phone: result.rows[0].phone,
            amount: parseFloat(result.rows[0].amount),
            timestamp: result.rows[0].created_at.toISOString()
        };

        res.json({ success: true, bid: newBid });
    } catch (err) {
        console.error('Error adding bid:', err);
        res.status(500).json({ error: 'Failed to add bid' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Admin password: ${ADMIN_PASSWORD}`);
});