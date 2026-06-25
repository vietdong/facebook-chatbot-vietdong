const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Handle GET validation challenge from Facebook
    if (req.method === 'GET') {
        const mode = req.query['hub.mode'];
        const token = req.query['hub.verify_token'];
        const challenge = req.query['hub.challenge'];
        
        const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'hermes_bot_verify_token';
        
        if (mode && token) {
            if (mode === 'subscribe' && token === VERIFY_TOKEN) {
                console.log('WEBHOOK_VERIFIED');
                return res.status(200).send(challenge);
            } else {
                return res.status(403).send('Forbidden');
            }
        }
    }

    // Handle incoming POST messaging webhook
    if (req.method === 'POST') {
        const body = req.body;
        
        if (body.object === 'page') {
            for (const entry of body.entry) {
                const webhook_event = entry.messaging ? entry.messaging[0] : null;
                if (!webhook_event) continue;
                
                const sender_psid = webhook_event.sender.id;
                
                if (webhook_event.message && webhook_event.message.text) {
                    const text = webhook_event.message.text.trim();
                    console.log(`Received message: "${text}" from PSID: ${sender_psid}`);
                    
                    let replyText = "";
                    const textLower = text.toLowerCase();

                    // Smart interactive menu responses
                    if (textLower.includes("alo") || textLower.includes("chào") || textLower.includes("hello") || textLower.includes("hi")) {
                        replyText = "Xin chào! Cửa hàng Zenn Salon xin chào bạn. Chúng tôi có thể giúp gì cho bạn?\n\n1. Tư vấn kiểu tóc phù hợp\n2. Đặt lịch hẹn cắt/uốn/nhuộm\n3. Xem bảng giá dịch vụ\n\nBạn chỉ cần soạn số (1, 2, 3) để chọn nhé!";
                    } else if (text === "1") {
                        replyText = "Để nhận tư vấn kiểu tóc phù hợp, bạn hãy truy cập ngay ứng dụng tư vấn trực quan của chúng tôi tại đây nhé: https://hair-consult-booking.vercel.app/ (Chọn tab Tư Vấn)";
                    } else if (text === "2") {
                        replyText = "Để đặt lịch hẹn nhanh nhất, giữ chỗ với Stylist bạn yêu thích, hãy truy cập link này nhé: https://hair-consult-booking.vercel.app/ (Chọn tab Đặt Lịch)";
                    } else if (text === "3") {
                        replyText = "Bảng giá dịch vụ Zenn Salon:\n- Cắt tóc tạo kiểu (Combo 7 bước): 100k\n- Uốn xoăn Comma Hair: 300k\n- Uốn Texture Hàn Quốc: 350k\n- Nhuộm màu thời trang: 400k";
                    } else {
                        // Default fallback
                        replyText = "Cảm ơn bạn đã nhắn tin. Yêu cầu của bạn đã được ghi nhận, nhân viên Zenn Salon sẽ liên hệ và chat trực tiếp với bạn ngay trong giây lát!";
                    }
                    
                    await callSendAPI(sender_psid, replyText);
                }
            }
            return res.status(200).send('EVENT_RECEIVED');
        } else {
            return res.status(404).send('Not Found');
        }
    }

    return res.status(405).send('Method Not Allowed');
};

async function callSendAPI(sender_psid, responseText) {
    const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN;
    if (!pageAccessToken) {
        console.error('Missing FB_PAGE_ACCESS_TOKEN env variable.');
        return;
    }

    const request_body = {
        recipient: { id: sender_psid },
        message: { text: responseText }
    };

    try {
        const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request_body)
        });
        if (res.ok) {
            console.log('Message sent to PSID:', sender_psid);
        } else {
            const errData = await res.json();
            console.error('Meta Graph Send API Error:', errData);
        }
    } catch (err) {
        console.error('Meta Graph Request failed:', err);
    }
}
