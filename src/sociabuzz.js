const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const config = require('../config');

const UA = 'Mozilla/5.0 (Linux; Android 13; SM-A057F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36';

const htmlHeaders = {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'id-ID,id;q=0.9',
    'user-agent': UA,
    'x-country': 'ID',
    'x-locale': 'id_ID'
};

const ajaxHeaders = {
    accept: 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'id-ID,id;q=0.9',
    origin: config.base_url,
    'user-agent': UA,
    'x-requested-with': 'XMLHttpRequest',
    'x-country': 'ID',
    'x-locale': 'id_ID',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'
};

let browser = null;

const getBrowser = async () => {
    if (!browser) browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    return browser;
};

const extractCsrf = (html) => {
    const $ = cheerio.load(html);
    return $('input[name="sb_token_csrf"]').attr('value');
};

const mergeCookies = (oldCookie = '', setCookies = []) => {
    const map = {};
    oldCookie.split(';').forEach(x => {
        const [k, ...v] = x.trim().split('=');
        if (k) map[k] = v.join('=');
    });
    (setCookies || []).forEach(cookie => {
        const clean = cookie.split(';')[0];
        const [k, ...v] = clean.split('=');
        if (k) map[k] = v.join('=');
    });
    return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; ');
};

const createDonation = async (amount, name, email, message) => {
    const donateUrl = `${config.base_url}/${config.username}/donate`;
    const res = await axios.get(donateUrl, { headers: htmlHeaders });
    const csrf = extractCsrf(res.data);
    const cookie = mergeCookies('', res.headers['set-cookie']);
    const body = new URLSearchParams({
        sb_token_csrf: csrf, currency: 'IDR', amount: String(amount),
        qty: '1', support_duration: '30', note: message,
        fullname: name, email, is_agree: '1', years18: '1',
        is_vote: '0', is_voice: '0', is_mediashare: '0',
        is_gif: '0', is_sound: '0', is_voicy: '0',
        vote_id: '', ms_maxtime: '', start_from: '0',
        ms_starthour: '0', ms_startminute: '0', ms_startsecond: '0',
        spin_check: '0', prev_url: donateUrl, hide_email: '0',
        is_tiktok: '0', tiktok_duration: '0', is_instagram: '0',
        instagram_duration: '0', wishlist_id: '', quickpay: '0'
    });
    const res2 = await axios.post(`${config.base_url}/${config.username}/donate/get-form-queue`, body.toString(), { headers: { ...ajaxHeaders, referer: donateUrl, cookie } });
    const payment_url = res2.data.content.redirect;
    const order_id = payment_url.split('/payment/x/')[1].split(/[?#]/)[0];
    return { payment_url, order_id };
};

const setupPage = async (page) => {
    await page.setViewport({ width: 430, height: 932, isMobile: true, hasTouch: true });
    await page.setUserAgent(UA);
    await page.emulateTimezone('Asia/Jakarta');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'language', { get: () => 'id-ID' });
        Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id'] });
    });
};

const createQris = async (paymentUrl) => {
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();
    await setupPage(page);
    let result = null;
    
    page.on('response', async response => {
        if (!response.url().includes('/payment/send/create')) return;
        const text = await response.text();
        const json = JSON.parse(text);
        if (json.data && json.data.qr_string) result = json;
    });
    
    await page.goto(paymentUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await Promise.race([
        page.waitForSelector('#qris', { timeout: 15000 }),
        page.waitForSelector('#payment-method', { timeout: 15000 })
    ]).catch(() => {});
    
    await page.evaluate(() => {
        const select = document.querySelector('select.country');
        if (select) {
            select.value = 'Indonesia';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
        const el = document.querySelector('#qris');
        if (el) { el.scrollIntoView({ block: 'center' }); el.click(); }
    });
    
    const start = Date.now();
    while (!result && Date.now() - start < 15000) {
        await new Promise(r => setTimeout(r, 300));
    }
    
    await page.close();
    return result;
};

const closeBrowser = async () => {
    if (browser) {
        await browser.close();
        browser = null;
    }
};

module.exports = {
    createDonation,
    createQris,
    closeBrowser
};