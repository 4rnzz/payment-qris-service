const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const db = require('./src/db');
const sociabuzz = require('./src/sociabuzz');
const { trxId, randomEmail, cleanAmount, normalizeDate } = require('./src/utils');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.post('/create', async (req, res) => {
    const nominal = cleanAmount(req.body.amount || req.body.nominal);

    if (!nominal || nominal < config.min_nominal) {
        const response = { error: `nominal minimal Rp ${config.min_nominal}` };
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).send(JSON.stringify(response, null, 2));
    }

    const id = trxId();
    const created_at = new Date().toISOString();

    const donation = await sociabuzz.createDonation(
        nominal,
        req.body.name || 'Donatur',
        req.body.email || randomEmail(),
        req.body.message || ''
    );

    const qris = await sociabuzz.createQris(donation.payment_url);

    if (!qris || !qris.data) {
        const response = { error: 'Failed to get QRIS data' };
        res.setHeader('Content-Type', 'application/json');
        return res.status(500).send(JSON.stringify(response, null, 2));
    }

    const totalAmount = cleanAmount(qris.data.amount);
    const fee = totalAmount - nominal;
    const expired_at = normalizeDate(qris.data.expiration_date);

    const transaction = db.createTransaction({
        id,
        order_id: donation.order_id,
        payment_url: donation.payment_url,
        qris_string: qris.data.qr_string,
        amount: nominal,
        total_amount: totalAmount,
        fee,
        created_at,
        expired_at
    });

    console.log(`Success Create – ${id} | Rp${nominal} –> Rp${totalAmount}`);

    const response = {
        transaction_id: transaction.id,
        order_id: transaction.order_id,
        payment_url: transaction.payment_url,
        amount: transaction.amount,
        fee: transaction.fee,
        total_amount: transaction.total_amount,
        qris_string: transaction.qris_string,
        status: transaction.status,
        created_at: transaction.created_at,
        expired_at: transaction.expired_at
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(response, null, 2));
});

app.post('/webhook', (req, res) => {
    if (req.headers['sb-webhook-token'] !== config.webhook_token) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).send(JSON.stringify({ error: 'Invalid webhook token' }, null, 2));
    }

    const amount = cleanAmount(req.body.amount_settled || req.body.amount);
    const trx = db.findPendingByAmount(amount);

    if (!trx) {
        console.log(`No pending transaction found with amount: ${amount}`);
        const response = { received: true, matched: false, amount };
        res.setHeader('Content-Type', 'application/json');
        return res.send(JSON.stringify(response, null, 2));
    }

    const result = db.updateTransactionPaid(trx.id, req.body);

    if (result.changes > 0) {
        console.log(`Payment Success | Amount: ${amount} | TrxID: ${trx.id} | Status: Paid`);
    }

    const response = {
        received: true,
        matched: true,
        transaction_id: trx.id,
        amount
    };

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(response, null, 2));
});

app.get('/status/:trxid', (req, res) => {
    const trx = db.getTransactionWithoutPaymentUrl(req.params.trxid);

    if (!trx) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).send(JSON.stringify({ error: 'Transaction not found' }, null, 2));
    }

    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(trx, null, 2));
});

const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`Server running on port ${config.port}`);
});

process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await sociabuzz.closeBrowser();
    server.close(() => process.exit(0));
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down...');
    await sociabuzz.closeBrowser();
    server.close(() => process.exit(0));
});