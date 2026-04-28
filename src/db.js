const fs = require('fs');
const path = require('path');
const config = require('../config');

const dbPath = config.db_path;
const dir = path.dirname(dbPath);

if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify([], null, 2));

function readDB() {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function isExpired(expired_at) {
    if (!expired_at) return false;

    const expiredDate = new Date(expired_at);
    if (isNaN(expiredDate.getTime())) return false;

    return expiredDate.getTime() <= Date.now();
}

function expirePendingTransactions(db) {
    let changed = false;

    for (const trx of db) {
        if (trx.status === 'pending' && isExpired(trx.expired_at)) {
            trx.status = 'expired';
            changed = true;
        }
    }

    if (changed) writeDB(db);
    return db;
}

function getTransaction(id) {
    const db = expirePendingTransactions(readDB());
    return db.find(t => t.id === id) || null;
}

function getTransactionWithoutPaymentUrl(id) {
    const trx = getTransaction(id);
    if (!trx) return null;

    const { payment_url, qris_string, ...rest } = trx;
    return rest;
}

function createTransaction(data) {
    const db = readDB();

    const trx = {
        id: data.id,
        order_id: data.order_id,
        payment_url: data.payment_url,
        qris_string: data.qris_string || null,
        status: 'pending',
        amount: data.amount,
        total_amount: data.total_amount,
        fee: data.fee,
        created_at: data.created_at,
        expired_at: data.expired_at,
        paid_at: null,
        supporter: null,
        message: null
    };

    db.push(trx);
    writeDB(db);

    return trx;
}

function updateTransactionPaid(id, body) {
    const db = expirePendingTransactions(readDB());
    const index = db.findIndex(t => t.id === id);

    if (index === -1) return { changes: 0 };

    if (db[index].status === 'pending') {
        db[index].status = 'paid';
        db[index].paid_at = new Date().toISOString();
        db[index].supporter = body.supporter || null;
        db[index].message = body.message || null;
        writeDB(db);
        return { changes: 1 };
    }

    return { changes: 0 };
}

function findPendingByAmount(totalAmount) {
    const db = expirePendingTransactions(readDB());

    const pending = db
        .filter(t => t.status === 'pending' && t.total_amount === totalAmount && !isExpired(t.expired_at))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return pending[0] || null;
}

function autoExpireAndCleanup() {
    const db = expirePendingTransactions(readDB());
    const cutoff = new Date();

    cutoff.setDate(cutoff.getDate() - config.cleanup_after_days);

    let removedCount = 0;

    const updated = db.filter(t => {
        if (t.status === 'expired' && new Date(t.created_at) < cutoff) {
            removedCount++;
            return false;
        }

        return true;
    });

    if (removedCount > 0) {
        writeDB(updated);
        console.log(`Auto cleanup: ${removedCount} removed`);
    }
}

setInterval(autoExpireAndCleanup, 10 * 1000);
autoExpireAndCleanup();

module.exports = {
    getTransaction,
    getTransactionWithoutPaymentUrl,
    createTransaction,
    updateTransactionPaid,
    findPendingByAmount,
    autoExpireAndCleanup
};
