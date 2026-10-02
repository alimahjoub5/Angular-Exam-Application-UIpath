import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';
const CACHE_TTL_MS = 30 * 60 * 1000;
const examCache = new Map();

const topics = [
  'Business and platform fundamentals',
  'Studio interface and project organization',
  'Variables and arguments',
  'Strings, lists, dictionaries and DataTables',
  'Control flow',
  'UI Automation synchronization',
  'UI descriptors and selectors',
  'Object Repository',
  'Debugging',
  'Error and exception handling',
  'Local files and folders',
  'Excel automation',
  'Email automation',
  'PDF automation',
  'Logging',
  'Orchestrator overview and resources',
  'Queues, assets, jobs, processes and folders',
  'Integration Service',
  'Version control integration',
  'Workflow Analyzer',
  'RPA testing',
  'Automation implementation methodology'
];

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function extractOutputText(response) {
  if (typeof response.output_text === 'string' && response.output_text) {
    return response.output_text;
  }

  for (const item of response.output || []) {
    for (const part of item.content || []) {
      if (part.type === 'output_text' && typeof part.text === 'string') {
        return part.text;
      }
    }
  }

  throw new Error('No text output returned by OpenAI.');
}

function buildPrompt(count, mode, topic) {
  const scope = topic
    ? `Focus ONLY on this topic: ${topic}.`
    : `Topics: ${topics.join('; ')}.`;

  const examStyle = mode === 'real' && !topic
    ? `This is an A-to-Z full-scope mock sample. Spread questions across different syllabus areas; do not bias toward any weak area. Use realistic workplace situations, troubleshooting, best-next-action, configuration consequences, and close distractors. Aim roughly 10% Easy, 55% Medium, 35% Hard.`
    : `Use realistic workplace situations, troubleshooting, best-next-action, and close distractors.`;

  return `Create exactly ${count} original ENGLISH UiPath Automation Developer Associate practice questions.
${scope}
${examStyle}
Use 4 plausible options and exactly 1 best answer. No dumps, recalled questions, or copied exam content.
Be compact: question <=55 words; option <=14 words; explanation <=28 words; topic <=5 words.
Mode: ${mode === 'real' ? 'full A-to-Z certification mock' : 'intensive practice'}.`;
}

const questionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'integer' },
          question: { type: 'string' },
          options: {
            type: 'array',
            minItems: 4,
            maxItems: 4,
            items: { type: 'string' }
          },
          correctAnswer: { type: 'integer', minimum: 0, maximum: 3 },
          explanation: { type: 'string' },
          difficulty: { type: 'string', enum: ['Easy', 'Medium', 'Hard'] },
          topic: { type: 'string' }
        },
        required: ['id', 'question', 'options', 'correctAnswer', 'explanation', 'difficulty', 'topic']
      }
    }
  },
  required: ['questions']
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    send(res, 204, {});
    return;
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    send(res, 200, {
      ok: true,
      configured: Boolean(OPENAI_API_KEY),
      model: OPENAI_MODEL
    });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/generate-exam') {
    send(res, 404, { error: 'Not found' });
    return;
  }

  if (!OPENAI_API_KEY) {
    send(res, 503, { error: 'OPENAI_API_KEY is not configured.' });
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 20_000) req.destroy();
  });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body || '{}');
      const requestedCount = Number(payload.count);
      const count = Number.isInteger(requestedCount) && requestedCount >= 1 && requestedCount <= 10
        ? requestedCount
        : 10;
      const mode = payload.mode === 'real' ? 'real' : 'small';
      const topic = typeof payload.topic === 'string' ? payload.topic.trim().slice(0, 80) : '';
      const requestKey = typeof payload.requestKey === 'string'
        ? payload.requestKey.trim().slice(0, 120)
        : '';
      const cacheKey = requestKey || `${count}:${mode}:${topic || 'mixed'}`;
      const cached = examCache.get(cacheKey);

      if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
        send(res, 200, cached.payload);
        return;
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          input: [
            {
              role: 'system',
              content: 'You are an expert UiPath certification practice-question author. Produce accurate, scenario-based training content only.'
            },
            {
              role: 'user',
              content: buildPrompt(count, mode, topic)
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'uipath_exam',
              strict: true,
              schema: questionSchema
            }
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const details = data?.error?.message || `OpenAI request failed with status ${response.status}`;
        const code = data?.error?.code ? ` [${data.error.code}]` : '';
        const type = data?.error?.type ? ` (${data.error.type})` : '';
        throw new Error(`${details}${code}${type}`);
      }

      const parsed = JSON.parse(extractOutputText(data));

      if (!Array.isArray(parsed.questions) || parsed.questions.length !== count) {
        throw new Error(`Expected ${count} questions but received ${parsed.questions?.length ?? 0}.`);
      }

      examCache.set(cacheKey, {
        createdAt: Date.now(),
        payload: parsed
      });

      send(res, 200, parsed);
    } catch (error) {
      console.error(error);
      send(res, 500, {
        error: error instanceof Error ? error.message : 'Unable to generate exam.'
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`UiPath exam AI API listening on http://localhost:${PORT}`);
});
