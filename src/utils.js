const config = require('../config');

const trxId = () => `TRX-${Date.now()}${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
const randomEmail = () => `donatur${Date.now()}@gmail.com`;
const cleanAmount = (value) => Number(String(value || '').replace(/[^\d]/g, ''));

const normalizeDate = (value) => {
    if (!value) return null;

    const normal = new Date(value);
    if (!isNaN(normal.getTime())) return normal.toISOString();

    const match = String(value).match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+-\s+(\d{2}):(\d{2})\s+UTC\+07:00$/);
    if (!match) return null;

    const months = {
        Jan: 0,
        Feb: 1,
        Mar: 2,
        Apr: 3,
        May: 4,
        Jun: 5,
        Jul: 6,
        Aug: 7,
        Sep: 8,
        Oct: 9,
        Nov: 10,
        Dec: 11
    };

    const day = Number(match[1]);
    const month = months[match[2]];
    const year = Number(match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);

    if (month === undefined) return null;

    return new Date(Date.UTC(year, month, day, hour - 7, minute, 0)).toISOString();
};

const formatResponse = (data, statusCode = 200) => {
    return {
        statusCode,
        data: JSON.stringify(data, null, 2)
    };
};

module.exports = {
    trxId,
    randomEmail,
    cleanAmount,
    normalizeDate,
    formatResponse
};