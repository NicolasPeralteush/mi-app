const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');
const fs = require('fs');
const qrcode = require('qrcode-terminal');

// Cargar variables de entorno
dotenv.config();

// CONFIGURACIÓN DE IA
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash" 
});

// Leer el prompt del sistema
const SYSTEM_PROMPT = fs.readFileSync('prompt.txt', 'utf8');

// Almacenar el contexto de las conversaciones
const chatContext = new Map();

async function connectToWhatsApp() {
    console.log("🍝 Iniciando Il Milano Bot...");
    console.log("🔑 API Key:", process.env.GEMINI_API_KEY ? "Configurada" : "No encontrada");
    
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        browser: ['Il Milano Bot', 'Chrome', '1.0.0'],
        printQRInTerminal: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('\n--- ESCANEÁ EL SIGUIENTE CÓDIGO QR ---');
            qrcode.generate(qr, { small: true });
            console.log('--- ESCANEÁ DESDE TU WHATSAPP ---\n');
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('❌ Conexión cerrada. Reconectando:', shouldReconnect);
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ ¡Bot de Il Milano conectado y listo para recibir pedidos!');
            console.log('🤌 ¡Amore per i milanesi!');
        }
    });

    // Manejo de mensajes entrantes
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const clientName = msg.pushName || "Cliente";
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (!text) return;

        console.log(`📨 Mensaje de ${clientName}: ${text}`);

        try {
            // Inicializar chat si no existe
            if (!chatContext.has(remoteJid)) {
                chatContext.set(remoteJid, model.startChat({
                    history: [
                        {
                            role: "user",
                            parts: [{ text: SYSTEM_PROMPT }],
                        },
                        {
                            role: "model",
                            parts: [{ text: "¡Bene! Entendido, soy el chef de Il Milano. ¿Cómo estás? ¿Qué te gustaría pedir?" }],
                        },
                    ],
                }));
            }

            const chat = chatContext.get(remoteJid);
            const result = await chat.sendMessage(text);
            const response = await result.response.text();

            // Registrar en el archivo de texto
            const logEntry = `[${new Date().toLocaleString()}] 👤 ${clientName}: ${text}\n🤖 Bot: ${response}\n---\n`;
            fs.appendFileSync('registro_chats.txt', logEntry);
            
            console.log(`🤖 Respuesta: ${response}`);

            // Enviar respuesta a WhatsApp
            await sock.sendMessage(remoteJid, { text: response });

        } catch (error) {
            console.error("❌ Error en Gemini:", error.message);
            
            // Mensaje de respaldo
            const fallbackResponse = "Perdón, se me quemaron los papeles en la cocina. ¿Me repetís tu pedido? 🤌";
            
            try {
                await sock.sendMessage(remoteJid, { text: fallbackResponse });
                console.log("🤖 Enviada respuesta de respaldo");
            } catch (sendError) {
                console.error("❌ Error al enviar respaldo:", sendError.message);
            }
        }
    });
}

// Iniciar el bot
connectToWhatsApp().catch(console.error);
