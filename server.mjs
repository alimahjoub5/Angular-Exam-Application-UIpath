import http from 'node:http';

const PORT = Number(process.env.PORT || 3000);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6';
const CACHE_TTL_MS = 30 * 60 * 1000;
const examCache = new Map();

const officialBlueprint = [
  {
    domain: 'Business Knowledge',
    objectives: [
      'Describe business process automation and its value',
      'Identify and describe key concepts related to business processes',
      'Describe how agentic automation can streamline business processes'
    ]
  },
  {
    domain: 'Platform Knowledge',
    objectives: [
      'High-level use of UiPath products including Studio Types, Robot Types, Orchestrator, and Integration Service',
      'Difference between Attended and Unattended processes',
      'Difference between Serverless, VM, and local'
    ]
  },
  {
    domain: 'Studio Interface',
    objectives: [
      'Studio Web overview',
      'Studio Backstage options',
      'Create a new process using the correct compatibility mode',
      'Cross-platform concepts',
      'Studio capabilities',
      'Unified Build, Agentic, Apps, and Inter-Process Communication'
    ]
  },
  {
    domain: 'Variables and Arguments',
    objectives: [
      'Data types and their use',
      'Create, manage, and use variables',
      'Create, manage, and use In, Out, and In/Out arguments',
      'Automatically generate variables',
      'Global constants and global variables',
      'Differences among variables, arguments, global constants, and global variables'
    ]
  },
  {
    domain: 'Control Flow',
    objectives: [
      'Sequence and Flowchart layouts',
      'If, Flow Decision, Else If, and the VB.NET If operator',
      'For Each, While, Do While, and Switch'
    ]
  },
  {
    domain: 'API-based automation',
    objectives: [
      'Official exam section; detailed sub-objectives are not specified in the provided Exam Topics pages'
    ]
  },
  {
    domain: 'Debugging',
    objectives: [
      'Debug modes, debug actions, and debug ribbon options',
      'Simple and conditional breakpoints',
      'Simple and conditional tracepoints',
      'Debugging panels'
    ]
  },
  {
    domain: 'Exception Handling',
    objectives: [
      'Try Catch, Throw, Rethrow, and Retry Scope'
    ]
  },
  {
    domain: 'Logging',
    objectives: [
      'Describe and interpret robot execution logs',
      'Apply logging best practices during development'
    ]
  },
  {
    domain: 'UI Automation',
    objectives: [
      'Modern and Classic design experiences',
      'Modern Recorder',
      'Modern input activities and input methods',
      'Modern output activities and output methods',
      'UI synchronization in Modern Design Experience',
      'Primary target methods: Computer Vision in Unified Target, Fuzzy, Strict, and Image',
      'Static and dynamic descriptors'
    ]
  },
  {
    domain: 'Object Repository',
    objectives: [
      'Create, publish, and consume a UI Library with static and dynamic descriptors'
    ]
  },
  {
    domain: 'Excel Automation',
    objectives: [
      'Modern Excel Integration activities including Excel Process Scope, For Each Excel Row, Use Excel File, Remove Duplicates, Copy/Paste Range, Insert Column, VLookup, Write Cell, Create Pivot Table, and Insert Chart',
      'Workbook activities including Read Range Workbook, Write Range Workbook, Get Cell Workbook, Write Cell Workbook, and Append Range Workbook'
    ]
  },
  {
    domain: 'Email Automation',
    objectives: [
      'IMAP and POP3 email retrieval and SMTP sending',
      'Microsoft and Gmail Integration email activities',
      'Microsoft 365 and GSuite packages'
    ]
  },
  {
    domain: 'PDF Automation',
    objectives: [
      'Extract data from native and scanned PDFs',
      'Extract a single piece of data from single and multiple native PDFs'
    ]
  },
  {
    domain: 'Working with files and folders',
    objectives: [
      'Create, manage, and iterate through local files and folders'
    ]
  },
  {
    domain: 'Data Manipulation',
    objectives: [
      'VB.NET string methods including Trim, ToLower, ToUpper, Contains, Format, IndexOf, LastIndexOf, String.Join, Replace, Split, and Substring',
      'RegEx Builder',
      'Arrays',
      'Lists',
      'Dictionaries',
      'Build, filter, join, merge, and iterate through DataTables',
      'Data type conversions',
      'Text handling and Date handling activities'
    ]
  },
  {
    domain: 'Version Control Integration',
    objectives: [
      'Studio Git integration: add project, clone, commit, push, show changes, solve conflicts, and manage branches'
    ]
  },
  {
    domain: 'Libraries, templates, and snippets',
    objectives: [
      'Create, publish, and consume a process library',
      'Create, share, and access a template'
    ]
  },
  {
    domain: 'Workflow Analyzer',
    objectives: [
      'Workflow Analysis and Validation at file and project level',
      'Configure Workflow Analyzer settings'
    ]
  },
  {
    domain: 'RPA Testing',
    objectives: [
      'Basic and data-driven RPA test cases',
      'Mock Testing',
      'Test Explorer Panel'
    ]
  },
  {
    domain: 'Orchestrator',
    objectives: [
      'Orchestrator entities: Robot, Folder, Package, Process, Job, Heartbeat',
      'Tenant entities: User, Machine, License, Webhook, Alerts',
      'Folder entities: Assets, Storage Buckets, Queues, Triggers, Credential Stores',
      'Use Tenant and Folder entities',
      'Provision Robots',
      'Personal Workspaces',
      'Roles and Permissions',
      'Orchestrator Logging',
      'Unattended Robot Setup'
    ]
  },
  {
    domain: 'Integration Service',
    objectives: [
      'Explain Integration Service',
      'Use Integration Service Connectors and Triggers in an automation project'
    ]
  },
  {
    domain: 'Implementation Methodology Fundamentals',
    objectives: [
      'Describe project implementation stages',
      'Interpret Process Design Documents (PDDs) and Solution Design Documents (SDDs)'
    ]
  }
];

const topics = officialBlueprint.map(section => section.domain);

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
  const selectedBlueprint = topic
    ? officialBlueprint.filter(section => section.domain.toLowerCase() === topic.toLowerCase())
    : officialBlueprint;

  const blueprintText = selectedBlueprint
    .map(section => `- ${section.domain}: ${section.objectives.join('; ')}`)
    .join('\n');

  const fullExamRules = mode === 'real' && !topic
    ? `
FULL MOCK RULES:
- Cover the complete official blueprint A-to-Z across the whole 60-question exam; do not bias toward prior weak areas.
- Each 10-question batch must diversify domains so repeated batches together cover the full blueprint.
- Favor applied reasoning: realistic workplace scenarios, troubleshooting, best-next-action, configuration consequences, and interpretation.
- Use close, technically plausible distractors; avoid giveaway wording.
- Target overall difficulty near certification level: about 10% Easy, 55% Medium, 35% Hard across the full mock.
`
    : `
TOPIC DRILL RULES:
- Stay within the selected official domain and its listed objectives.
- Favor applied scenario reasoning over definition recall.
`;

  return `Create exactly ${count} ORIGINAL ENGLISH practice questions for the UiPath Certified Professional Automation Developer Associate exam.

OFFICIAL SOURCE BASIS:
UiPath Automation Developer Associate Exam Description, V1.6 January 2026.
Product coverage: UiPath 2024.10 and later.

OFFICIAL BLUEPRINT:
${blueprintText}
${fullExamRules}
QUESTION RULES:
- 4 answer options.
- Exactly 1 best answer.
- Questions must be original practice content, not official, leaked, recalled, copied, or reconstructed exam questions.
- Do not introduce topics outside the blueprint above.
- Keep question <= 70 words.
- Keep each option <= 18 words.
- Explanation <= 40 words and state why the correct choice is best.
- Set topic to the exact official domain name.
- Do not invent detailed API-based automation objectives beyond what the supplied blueprint supports.

Mode: ${mode === 'real' ? 'full A-to-Z certification mock' : 'official-domain intensive practice'}.`;
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
