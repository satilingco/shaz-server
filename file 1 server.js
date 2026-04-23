const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const conversations = {};

const SYSTEM = `You are Shaz, the friendly AI receptionist for SA Tiling Co, a premium Adelaide tiling and bathroom renovation business owned by Musti. Phone: 0466 654 322. Email: info@satilingco.com.au. Licence: 310132. Services: floor tiling, wall tiling, bathroom renovations, screeding, waterproofing, luxury residential and commercial tiling. Areas: all of Adelaide and surrounds. Hours: 7am-6pm Mon-Sat. Be warm, calm, friendly Aussie. Use "No worries", "Ripper", "G\'day", "Beauty". Keep responses under 2 sentences - this is a phone call.`;

async function getShazResponse(callSid, userMessage) {
  if (!conversations[callSid]) conversations[callSid] = [];
  conversations[callSid].push({ role: 'user', content: userMessage });
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 150, system: SYSTEM, messages: conversations[callSid] })
  });
  const data = await response.json();
  const reply = data.content[0].text;
  conversations[callSid].push({ role: 'assistant', content: reply });
  return reply;
}

app.post('/voice', async (req, res) => {
  const callSid = req.body.CallSid;
  const greeting = "G\'day! Thanks for calling SA Tiling Co, you\'ve reached Shaz! Musti\'s out on site but I\'m here to help. What can I do for you today?";
  conversations[callSid] = [{ role: 'assistant', content: greeting }];
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Olivia-Neural" language="en-AU">${greeting}</Say><Gather input="speech" action="/respond" method="POST" speechTimeout="auto" language="en-AU"></Gather></Response>`);
});

app.post('/respond', async (req, res) => {
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  let reply;
  try { reply = await getShazResponse(callSid, speech); }
  catch(e) { reply = "Sorry, can you repeat that for me?"; }
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Olivia-Neural" language="en-AU">${reply}</Say><Gather input="speech" action="/respond" method="POST" speechTimeout="auto" language="en-AU"></Gather></Response>`);
});

app.get('/', (req, res) => res.send('Shaz is online'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Shaz running on port ' + PORT));