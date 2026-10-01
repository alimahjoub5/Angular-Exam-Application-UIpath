import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';

const topics = [
  'UiPath Studio and project structure',
  'Variables, arguments and data manipulation',
  'Control flow and workflow design',
  'UI Automation, selectors, descriptors and synchronization',
  'Object Repository',
  'Excel, DataTables and file automation',
  'Debugging and exception handling',
  'Orchestrator assets, queues, jobs, triggers, folders and robots',
  'REFramework and transaction processing',
  'Libraries, templates and package dependencies',
  'Git and version control',
  'Workflow Analyzer and testing',
  'Integration Service',
  'Document Understanding basics'
];

function send(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
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

function buildPrompt(count, mode) {
  return `Create exactly ${count} original practice questions for the UiPath Certified Professional Automation Developer Associate exam.

The questions must be in ENGLISH and should feel like a difficult Pearson VUE-style certification exam rather than a simple memorization quiz.

Requirements:
- Focus on realistic workplace scenarios, troubleshooting, design choices, and best-practice decisions.
- Avoid trivia and obvious definition-only questions.
- Use four answer options per question.
- Exactly one answer must be correct.
- Make distractors plausible.
- Mix Medium and Hard questions heavily; Easy questions should be rare.
- Cover these topics broadly: ${topics.join(', ')}.
- Do not claim the questions are official, leaked, recalled, or copied from the real certification exam.
- Do not reproduce known exam dumps.
- Each explanation must state why the correct answer is right and briefly identify the key trap in the distractors.
- Mode: ${mode === 'real' ? 'full 60-question mock exam' : '10-question intensive practice'}.
`;
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
      const count = payload.count === 60 ? 60 : 10;
      const mode = payload.mode === 'real' ? 'real' : 'small';

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
              content: buildPrompt(count, mode)
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
        throw new Error(data?.error?.message || `OpenAI request failed with status ${response.status}`);
      }

      const parsed = JSON.parse(extractOutputText(data));

      if (!Array.isArray(parsed.questions) || parsed.questions.length !== count) {
        throw new Error(`Expected ${count} questions but received ${parsed.questions?.length ?? 0}.`);
      }

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
