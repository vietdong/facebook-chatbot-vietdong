const fetch = require('node-fetch');

// ─────────────────────────────────────────────────────────────────
// WEBHOOK FACEBOOK MESSENGER → 9ROUTER DIRECT API (SIÊU TIẾT KIỆM TOKEN)
// Không đi qua Hermes API Server để tránh load 18,000 prompt tokens.
// Đi trực tiếp qua Cloudflare Tunnel kết nối tới 9router (cổng 20128).
// ─────────────────────────────────────────────────────────────────

const AI_BASE_URL = (process.env.AI_BASE_URL || "https://grateful-tvs-philip-graduate.trycloudflare.com/v1").replace(/\/$/, '');
const NINE_ROUTER_URL = `${AI_BASE_URL}/chat/completions`;
const NINE_ROUTER_API_KEY = "sk_9router"; // API Key nội bộ của 9router của bạn

module.exports = async (req, res) => {
    // Xử lý GET verification từ Facebook
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hermes_bot_verify_token';
        
        if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
            console.log('WEBHOOK_VERIFIED');
            return res.status(200).send(challenge);
        }
        return res.status(403).send('Forbidden');
    }

    // Xử lý POST tin nhắn từ Facebook
    if (req.method === 'POST') {
        const body = req.body;

        if (body.object === 'page' && body.entry) {
            for (const entry of body.entry) {
                const events = entry.messaging || [];
                for (const event of events) {
                    const sender_psid = event.sender?.id;
                    const message = event.message?.text?.trim();

                    if (sender_psid && message) {
                        console.log(`[FB] From ${sender_psid}: "${message}"`);
                        
                        // Xử lý và gửi phản hồi không chặn luồng (fire & forget)
                        replyAsync(sender_psid, message).catch(e => console.error('Reply error:', e));
                    }
                }
            }
            return res.status(200).send('EVENT_RECEIVED');
        }
        return res.status(404).send('Not Found');
    }

    return res.status(405).send('Method Not Allowed');
};

async function replyAsync(sender_psid, userMessage) {
    const reply = await call9Router(userMessage);
    await sendToFacebook(sender_psid, reply);
}

async function call9Router(userMessage) {
    const payload = {
        model: "ag/gemini-3.5-flash-low",
        messages: [
            {
                role: "system",
                content: "Bạn là trợ lý AI thông minh đại diện cho tiệm tóc Zenn Salon. Trả lời cực kỳ ngắn gọn, thân thiện, tự nhiên bằng tiếng Việt (dưới 100 từ). Tư vấn nhanh về cắt/uốn/nhuộm tóc."
            },
            {
                role: "user",
                content: userMessage
            }
        ],
        max_tokens: 150,
        temperature: 0.7,
        stream: false
    };

    try {
        const response = await fetch(NINE_ROUTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NINE_ROUTER_API_KEY}`
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(15000)
        });

        if (response.ok) {
            const data = await response.json();
            const reply = data?.choices?.[0]?.message?.content?.trim();
            if (reply) return reply;
        } else {
            const errText = await response.text();
            console.error('9router error:', response.status, errText.slice(0, 200));
        }
    } catch (e) {
        console.error('9router fetch error:', e.message);
    }

    return "Cửa hàng Zenn Salon xin chào bạn! Yêu cầu của bạn đã được ghi nhận. Stylist sẽ liên hệ hỗ trợ bạn trực tiếp ngay nhé!";
}

async function sendToFacebook(sender_psid, text) {
    const token = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!token) return;

    try {
        const response = await fetch(
            `https://graph.facebook.com/v19.0/me/messages?access_token=${token}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: sender_psid },
                    message: { text }
                })
            }
        );
        if (!response.ok) {
            const err = await response.text();
            console.error('Facebook send error:', err.slice(0, 200));
        }
    } catch (e) {
        console.error('Facebook send failed:', e.message);
    }
}
