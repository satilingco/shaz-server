const express = require('express');
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const conversations = {};
const callData = {};

const SYSTEM = `You are Shaz, a warm friendly receptionist for S A Tiling, a premium Adelaide tiling and bathroom renovation business.

Business details:
- Phone: 0466 654 322
- Email: info@satilingco.com.au
- Services: floor tiling, wall tiling, bathroom renovations, screeding, waterproofing, luxury residential and commercial tiling
- Areas: all of Adelaide and surrounds
- Hours: 7am to 6pm Monday to Saturday

Your personality: Warm, calm, natural, conversational. Friendly but professional. Like a real receptionist who enjoys her job.

Your job:
- Greet callers warmly
- Find out what they need
- For quote requests: get their name, best phone number, suburb, and brief description of the job
- For existing clients: get their name, number, and what it is regarding
- For builder enquiries: get their name, company, number, and project details
- Answer questions about services, areas covered, and bookings
- Always confirm you will pass their details on and someone will be in touch

Important rules:
- Keep each response to 1 to 2 short sentences only
- This is a phone call so be concise and natural
- Never use any symbols, asterisks, or special characters
- Do not say Musti - just say the team or someone will be in touch
- Speak naturally like a real person would on the phone
- When you have collected all the caller details, end with: CALL SUMMARY: name equals their name, phone equals their number, suburb equals their suburb, reason equals brief reason`;

async function getShazResponse(callSid, userMessage) {
  if (!conversations[callSid]) conversations[callSid] = [];
  conversations[callSid].push({ role: 'user', content: userMessage });
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'x-api-key': ANTHROPIC_API_KEY, 
      'anthropic-version': '2023-06-01' 
    },
    body: JSON.stringify({ 
      model: 'claude-sonnet-4-20250514', 
      max_tokens: 200, 
      system: SYSTEM, 
      messages: conversations[callSid] 
    })
  });
  
  const data = await response.json();
  const reply = data.content[0].text;
  conversations[callSid].push({ role: 'assistant', content: reply });
  
  if (reply.includes('CALL SUMMARY:')) {
    callData[callSid] = callData[callSid] || {};
    callData[callSid].summary = reply;
    console.log('CALL SUMMARY FOR INFO@SATILINGCO.COM.AU:', reply);
  }
  
  const cleanReply = reply.replace(/CALL SUMMARY:.*/s, '').replace(/[*_#&<>]/g, '').trim();
  return cleanReply;
}

app.post('/voice', async (req, res) => {
  const callSid = req.body.CallSid;
  const fromNumber = req.body.From || 'Unknown';
  
  callData[callSid] = { fromNumber, startTime: new Date() };
  conversations[callSid] = [];
  
  const greeting = "Hi there! Thanks for calling S A Tiling. You have reached Shaz. -How can I help you today?";
  conversations[callSid].push({ role: 'assistant', content: greeting });
  
  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Olivia-Neural" language="en-AU" rate="95%">${greeting}</Say>
  <Gather input="speech" action="/respond" method="POST" speechTimeout="3" language="en-AU" enhanced="true" speechModel="phone_call">
  </Gather>
  <Redirect method="POST">/voice</Redirect>
</Response>`);
});

app.post('/respond', async (req, res) => {
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  const confidence = parseFloat(req.body.Confidence || '0');

  console.log(`Caller said: "${speech}" (confidence: ${confidence})`);

  if (!speech || speech.trim() === '' || confidence < 0.2) {
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Olivia-Neural" language="en-AU" rate="95%">Sorry, I did not quite catch that. Could you say that again please?</Say>
  <Gather input="speech" action="/respond" method="POST" speechTimeout="3" language="en-AU" enhanced="true" speechModel="phone_call">
  </Gather>
</Response>`);
    return;
  }

  let reply;
  try { 
    reply = await getShazResponse(callSid, speech);
  } catch(e) { 
    reply = "No worries, just give me a moment."; 
  }

  res.type('text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Olivia-Neural" language="en-AU" rate="95%">${reply}</Say>
  <Gather input="speech" action="/respond" method="POST" speechTimeout="3" language="en-AU" enhanced="true" speechModel="phone_call">
  </Gather>
  <Say voice="Polly.Olivia-Neural" language="en-AU" rate="95%">Thanks so much for calling S A Tiling. We will be in touch very soon. Have a great day!</Say>
</Response>`);
});

app.get('/', (req, res) => res.send('Shaz is online'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.env.PORT, () => console.log('Shaz running on port ' + PORT));
