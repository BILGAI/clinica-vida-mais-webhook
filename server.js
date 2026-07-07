// server.js
// Webhook do Dialogflow ES para rodar no Render, usando a API da OpenAI (GPT-4o mini)

const express = require('express');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Log de toda requisição recebida, para depuração
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const PORT = process.env.PORT || 3000;

const SYSTEM_PROMPT = `Você é o assistente virtual da Clínica Vida Mais.
Responda de forma curta, educada e natural, em português.
Você NÃO tem acesso a agenda real - se o paciente quiser marcar, cancelar ou reagendar uma consulta,
oriente-o a dizer claramente "quero marcar consulta", "quero cancelar" ou "quero reagendar",
para que o fluxo estruturado do bot possa continuar. Não invente disponibilidade de horários nem confirme agendamentos.`;

// Rota de teste, só para confirmar que o servidor está de pé
app.get('/', (req, res) => {
  res.send('Webhook Clínica Vida Mais está no ar.');
});

// Rota que o Dialogflow ES vai chamar
app.post('/webhook', async (req, res) => {
  try {
    console.log('Webhook chamado. Body recebido:', JSON.stringify(req.body));

    const queryText = req.body.queryResult?.queryText || '';
    const intentName = req.body.queryResult?.intent?.displayName || '';

    console.log('queryText:', queryText, '| intentName:', intentName);

    // Só usa IA generativa no Fallback (quando o Dialogflow não entendeu bem)
    if (intentName !== 'Default Fallback Intent') {
      console.log('Não é Fallback, respondendo OK sem chamar a IA.');
      return res.json({ fulfillmentText: 'OK' });
    }

    if (!OPENAI_API_KEY) {
      console.error('ERRO: variável OPENAI_API_KEY não está definida!');
      return res.json({ fulfillmentText: 'Erro de configuração: chave da IA não encontrada.' });
    }

    console.log('Chamando a API da OpenAI...');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 300,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: queryText }
        ]
      })
    });

    console.log('Status da resposta da OpenAI:', openaiResponse.status);

    const data = await openaiResponse.json();
    console.log('Resposta bruta da OpenAI:', JSON.stringify(data));

    const respostaIA =
      data.choices?.[0]?.message?.content ||
      'Desculpe, não consegui entender. Pode reformular?';

    console.log('Resposta final enviada ao Dialogflow:', respostaIA);

    return res.json({ fulfillmentText: respostaIA });

  } catch (err) {
    console.error('ERRO no webhook:', err);
    return res.json({
      fulfillmentText: 'Desculpe, tive um problema técnico. Pode repetir, por favor?'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Webhook rodando na porta ${PORT}`);
});
