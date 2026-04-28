# Sociabuzz QRIS Payment API

REST API sederhana untuk membuat transaksi donasi Sociabuzz, mengambil QRIS string, menyimpan transaksi, menerima webhook pembayaran, dan mengecek status transaksi.

## Features

- Create payment QRIS dari Sociabuzz
- Auto generate transaction ID
- Ambil `qris_string`
- Simpan transaksi ke JSON database
- Webhook callback dari Sociabuzz
- Cek status transaksi

## Requirements

- Node.js 18+
- npm / yarn

## Installation

```bash
git clone https://github.com/4rnzz/payment-qris-service.git
cd repo-name
npm install
```

## Dependencies

```bash
npm install express axios cheerio cors helmet puppeteer
```

## Configuration

Edit config di file utama:

```js
const config = {
    port: 3000,
    username: 'username-sociabuzz',
    base_url: 'https://sociabuzz.com',
    webhook_token: 'your-webhook-token',
    min_nominal: 1000,
    db_path: './database/transactions.json'
};
```

## Run Server

```bash
node index.js
```

Server akan berjalan di:

```txt
http://localhost:3000
```

## API Endpoint

### Create Transaction

```http
POST /create
```

Request body:

```json
{
  "amount": 1000,
  "name": "XEoms",
  "email": "XEoms@gmail.com",
  "message": "Test pembayaran"
}
```

Response success:

```json
{
  "transaction_id": "TRX-17773858347900969",
  "order_id": "abc123xyz",
  "payment_url": "https://sociabuzz.com/payment/x/abc123xyz",
  "amount": 5000,
  "fee": 123,
  "total_amount": 5123,
  "qris_string": "00020101021226670016COM.NOBUBANK.WWW0118936005030000087914021452038453033605802ID5920SOCIALBUZZ PAYMENT6007JAKARTA61051234562070703A016304ABCD",
  "status": "pending",
  "created_at": "2026-04-28T10:00:00.000Z",
  "expired_at": "2026-04-28T10:15:00.000Z"
}
```

Response error:

```json
{
  "error": "nominal minimal Rp 1000"
}
```

### Check Transaction Status

```http
GET /status/:trxid
```

Example:

```bash
curl http://localhost:3000/status/TRX-17773858347900969
```

Response pending:

```json
{
  "id": "TRX-17773858347900969",
  "order_id": "abc123xyz",
  "amount": 5000,
  "fee": 123,
  "total_amount": 5123,
  "status": "pending",
  "created_at": "2026-04-28T10:00:00.000Z",
  "expired_at": "2026-04-28T10:15:00.000Z"
}
```

Response paid:

```json
{
  "id": "TRX-17773858347900969",
  "order_id": "abc123xyz",
  "amount": 5000,
  "fee": 123,
  "total_amount": 5123,
  "status": "paid",
  "created_at": "2026-04-28T10:00:00.000Z",
  "expired_at": "2026-04-28T10:15:00.000Z",
  "supporter": "Zacky",
  "message": "Test pembayaran",
  "paid_at": "2026-04-28T10:02:20.000Z"
}
```

Response not found:

```json
{
  "error": "Transaction not found"
}
```

## Example Curl

Create transaction:

```bash
curl -X POST http://localhost:3000/create \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "name": "Zacky",
    "email": "zacky@gmail.com",
    "message": "Test pembayaran"
  }'
```

Check status:

```bash
curl http://localhost:3000/status/TRX-17773858347900969
```

## Database Example

```json
[
  {
    "id": "TRX-17773858347900969",
    "order_id": "abc123xyz",
    "payment_url": "https://sociabuzz.com/payment/x/abc123xyz",
    "qris_string": "00020101021226670016COM.NOBUBANK.WWW...",
    "amount": 5000,
    "fee": 123,
    "total_amount": 5123,
    "status": "pending",
    "created_at": "2026-04-28T10:00:00.000Z",
    "expired_at": "2026-04-28T10:15:00.000Z"
  }
]
```

## License

XEoms
