const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

// Load the existing TypeScript modules without adding a test runtime dependency.
const root = path.resolve(__dirname, '..')
const resolveFilename = Module._resolveFilename
Module._resolveFilename = function (request, ...args) {
  return resolveFilename.call(this, request.startsWith('@/') ? path.join(root, request.slice(2)) : request, ...args)
}
require.extensions['.ts'] = function (module, filename) {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename)
}

const { parseModuleAiResponseText } = require('../lib/module-ai/response.ts')
const { applyModuleAiChanges } = require('../lib/module-ai/module-changes.ts')
const { buildModuleAiMessages, MODULE_AI_MAX_TOKENS } = require('../lib/module-ai/prompt.ts')
const moduleRoute = require('../app/api/ai/module-chat/route.ts')
const globalRoute = require('../app/api/ai/global-chat/route.ts')
const { readResponsesStream } = require('../lib/ai/responses-stream.ts')
const { callOpenAi, callAnthropic, callGemini } = require('../lib/ai/providers.ts')
const { readAiConversation } = require('../lib/ai/conversation-client.ts')
const { createConversationStream } = require('../lib/ai/conversation-stream.ts')
const { useModuleAiConversation } = require('../components/module-ai-conversation.ts')
const { useGlobalAiConversation } = require('../components/use-global-ai-conversation.ts')

const doc = (text, attrs, marks) => ({
  type: 'doc', content: [{ type: 'paragraph', ...(attrs ? { attrs } : {}),
    content: [{ type: 'text', text, ...(marks ? { marks } : {}) }] }],
})
const project = {
  id: 'projects', title: '项目经历', order: 0,
  rows: [{ id: 'project-row', type: 'rich', columns: 2, order: 0, elements: [
    { id: 'project-name', columnIndex: 0, content: doc('简历编辑器', { textAlign: 'left' }, [{ type: 'bold' }]) },
    { id: 'project-date', columnIndex: 1, content: doc('2025.01—2025.06', { textAlign: 'right' }) },
  ] }],
}
const skills = { id: 'skills', title: '技能', order: 1, rows: [
  { id: 'skill-row', type: 'tags', columns: 1, order: 0, elements: [], tags: ['React', 'TypeScript'] },
] }
const resume = {
  title: '测试简历', centerTitle: true,
  personalInfoSection: { personalInfo: [{ id: 'person', label: '学历', value: { content: '本科' }, order: 0 }], layout: { mode: 'inline' } },
  jobIntentionSection: { enabled: true, items: [{ id: 'position', type: 'position', label: '岗位', value: '前端开发工程师', order: 0 }] },
  modules: [project, skills], createdAt: '2026-01-01', updatedAt: '2026-01-01',
}
const parse = (changes) => parseModuleAiResponseText(JSON.stringify({ reply: '已生成修改', changes })).changes
const richList = {
  type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '开发模块编辑与实时预览', marks: [
      { type: 'textStyle', attrs: { fontFamily: 'Microsoft YaHei', fontSize: '12pt', color: '#000000' } },
    ] }] },
  ] }] }],
}

test('module conversation reads the entire resume and supported layouts', () => {
  const messages = buildModuleAiMessages({ module: project, resumeData: resume, messages: [{ role: 'user', content: '优化项目经历' }] })
  const context = JSON.parse(messages[1].content.split('\n')[1])
  assert.equal(context.targetModuleId, project.id)
  assert.deepEqual(context.resume.personalInfo, resume.personalInfoSection)
  assert.equal(context.resume.jobIntention.items[0].value, '前端开发工程师')
  assert.equal(context.resume.modules[1].moduleId, skills.id)
  assert.deepEqual(context.layoutCapabilities.columns, [1, 2, 3, 4])
  assert.ok(context.layoutCapabilities.nodes.includes('bulletList'))
})

test('formatted rows, lists and tags remain editable and do not mutate the source', () => {
  const before = structuredClone(project)
  const changes = parse([
    { type: 'replaceRow', rowId: 'project-row', row: { type: 'rich', columns: [
      doc('简历编辑器', undefined, [{ type: 'bold' }]), doc('2025.01—2025.06', { textAlign: 'right' }),
    ] } },
    { type: 'insertRow', row: { type: 'rich', columns: [richList] } },
    { type: 'insertRow', row: { type: 'tags', tags: ['React', 'TypeScript'] } },
  ])
  const result = applyModuleAiChanges(project, changes)
  assert.deepEqual(project, before)
  assert.equal(result.rows[0].id, 'project-row')
  assert.equal(result.rows[0].columns, 2)
  assert.equal(result.rows[0].elements[1].content.content[0].attrs.textAlign, 'right')
  assert.deepEqual(result.rows[1].elements[0].content, richList)
  assert.deepEqual(result.rows[2].tags, ['React', 'TypeScript'])
  assert.deepEqual(result.rows.map((row) => row.order), [0, 1, 2])
})

test('small text edits preserve styles and untouched columns', () => {
  const result = applyModuleAiChanges(project, parse([
    { type: 'replaceText', rowId: 'project-row', elementId: 'project-name', before: '简历编辑器', after: '在线简历编辑器' },
  ]))
  const paragraph = result.rows[0].elements[0].content.content[0]
  assert.equal(paragraph.content[0].text, '在线简历编辑器')
  assert.deepEqual(paragraph.content[0].marks, [{ type: 'bold' }])
  assert.deepEqual(paragraph.attrs, { textAlign: 'left' })
  assert.deepEqual(result.rows[0].elements[1], project.rows[0].elements[1])
})

test('a column can change formatting without replacing its siblings or IDs', () => {
  const content = doc('简历编辑器', { textAlign: 'center' }, [{ type: 'italic' }])
  const result = applyModuleAiChanges(project, parse([
    { type: 'replaceElement', rowId: 'project-row', elementId: 'project-name', content },
  ]))
  assert.equal(result.rows[0].elements[0].id, 'project-name')
  assert.deepEqual(result.rows[0].elements[0].content, content)
  assert.deepEqual(result.rows[0].elements[1], project.rows[0].elements[1])
})

test('unsupported layouts and unsafe formatting are rejected before applying', () => {
  assert.throws(() => parse([{ type: 'insertRow', row: { type: 'rich', columns: ['1', '2', '3', '4', '5'] } }]), /1-4/)
  for (const content of [
    { type: 'doc', content: [{ type: 'heading', content: [{ type: 'text', text: '标题' }] }] },
    doc('链接', undefined, [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
    doc('字号', undefined, [{ type: 'textStyle', attrs: { fontSize: '100pt' } }]),
  ]) {
    assert.throws(() => parse([{ type: 'replaceElement', rowId: 'project-row', elementId: 'project-name', content }]), /不支持/)
  }
  const before = structuredClone(project)
  assert.throws(() => applyModuleAiChanges(project, parse([
    { type: 'insertRow', row: { type: 'rich', columns: ['新内容'] } },
    { type: 'deleteRow', rowId: 'missing-row' },
  ])), /未找到目标行/)
  assert.deepEqual(project, before)
})

function request(body) {
  return new Request('http://localhost/api/ai/test', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, aiConfig: { mode: 'custom', provider: 'openai', apiKey: 'test-key' } }) })
}

test('long module input reaches the model with full context and formatted output is accepted', async (t) => {
  const longInput = '请依据整份简历优化当前项目。项目使用 React、TypeScript 和 Next.js，负责模块编辑、数据保存和实时预览，保留原有时间和真实技术栈，并自动安排标题、日期和详细描述。'.repeat(60)
  t.mock.method(globalThis, 'fetch', async (_, options) => {
    const payload = JSON.parse(options.body)
    assert.equal(payload.input.at(-1).content, longInput)
    assert.ok(payload.input[1].content.includes('前端开发工程师'))
    assert.equal(payload.max_output_tokens, MODULE_AI_MAX_TOKENS)
    assert.equal(payload.stream, true)
    assert.deepEqual(payload.text, { format: { type: 'json_object' } })
    return Response.json({ output_text: JSON.stringify({ reply: '已优化项目描述', changes: [
      { type: 'insertRow', row: { type: 'rich', columns: [richList] } },
    ] }) })
  })
  const response = await moduleRoute.POST(request({ module: project, resumeData: resume, messages: [{ role: 'user', content: longInput }] }))
  assert.equal(response.status, 200)
  const data = await readAiConversation(response, () => {})
  assert.equal(applyModuleAiChanges(project, data.changes).rows.length, 2)
})

test('module endpoint cannot apply changes to a different module from the context', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify({ reply: '修改技能', changes: [
    { type: 'replaceTags', rowId: 'skill-row', tags: ['Vue'] },
  ] }) }))
  const response = await moduleRoute.POST(request({ module: project, resumeData: resume, messages: [{ role: 'user', content: '优化项目' }] }))
  await assert.rejects(readAiConversation(response, () => {}), /未找到目标行/)
  assert.deepEqual(skills.rows[0].tags, ['React', 'TypeScript'])
})

test('global endpoint accepts existing body modules and rejects metadata or duplicate targets', async (t) => {
  let drafts = [{ moduleId: 'skills', moduleName: '技能', changes: [{ type: 'replaceTags', rowId: 'skill-row', tags: ['React', 'TypeScript', 'Next.js'] }] }]
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify({ reply: '已生成修改', drafts }) }))
  const body = { resumeData: resume, messages: [{ role: 'user', content: '完善技能' }] }
  const successful = await globalRoute.POST(request(body))
  assert.equal((await readAiConversation(successful, () => {})).drafts[0].moduleId, 'skills')
  drafts = [{ ...drafts[0], moduleId: 'personalInfo' }]
  const metadataResponse = await globalRoute.POST(request(body))
  await assert.rejects(readAiConversation(metadataResponse, () => {}), /不是现有正文模块/)
  drafts = [{ moduleId: 'skills', moduleName: '技能', changes: [{ type: 'replaceTags', rowId: 'skill-row', tags: ['React'] }] }]
  drafts.push(drafts[0])
  const duplicateResponse = await globalRoute.POST(request(body))
  await assert.rejects(readAiConversation(duplicateResponse, () => {}), /重复模块草稿/)
})

function streamResponse(events, fragmentSize = 13) {
  const bytes = new TextEncoder().encode(events)
  const body = new ReadableStream({ start(controller) {
    for (let index = 0; index < bytes.length; index += fragmentSize) controller.enqueue(bytes.slice(index, index + fragmentSize))
    controller.close()
  } })
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
}

test('stream reader handles split UTF-8, CRLF, multiple events and a final packet without a blank line', async () => {
  const result = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '完整中文结果' }] }] }
  const events = ': heartbeat\r\n\r\ndata: ' + JSON.stringify({ type: 'response.reasoning_text.delta', delta: '思考' }) + '\r\n\r\n' +
    'event: response.completed\r\ndata: ' + JSON.stringify({ type: 'response.completed', response: result })
  assert.deepEqual(await readResponsesStream(streamResponse(events, 1)), result)
})

test('stream reader rejects incomplete, failed and interrupted streams instead of applying partial content', async () => {
  await assert.rejects(readResponsesStream(streamResponse('data: ' + JSON.stringify({
    type: 'response.incomplete', response: { incomplete_details: { reason: 'max_output_tokens' } },
  }) + '\n\n')), /max_output_tokens/)
  await assert.rejects(readResponsesStream(streamResponse('data: ' + JSON.stringify({
    type: 'response.failed', response: { error: { message: 'upstream error' } },
  }) + '\n\n')), /upstream error/)
  await assert.rejects(readResponsesStream(streamResponse('data: ' + JSON.stringify({
    type: 'response.output_text.delta', delta: '{"reply":',
  }) + '\n\n')), /提前结束/)
})

test('module endpoint streams reply text before returning the validated draft', async (t) => {
  const output = { reply: '已生成项目要点', changes: [{ type: 'insertRow', row: { type: 'rich', columns: [richList] } }] }
  t.mock.method(globalThis, 'fetch', async () => streamResponse('data: ' + JSON.stringify({
    type: 'response.output_text.delta', delta: '{"reply":"已生成',
  }) + '\n\ndata: ' + JSON.stringify({
    type: 'response.output_text.delta', delta: '项目要点","changes":[]}',
  }) + '\n\ndata: ' + JSON.stringify({
    type: 'response.completed', response: { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] },
  }) + '\n\n'))
  const response = await moduleRoute.POST(request({ module: project, resumeData: resume, messages: [{ role: 'user', content: '生成项目要点' }] }))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/event-stream/)
  const replies = []
  assert.deepEqual(await readAiConversation(response, (reply) => replies.push(reply)), output)
  assert.deepEqual(replies, ['已生成', '已生成项目要点'])
})

test('HTTP 401 remains an authentication error even if the provider labels it as an event stream', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":{"message":"Invalid token"}}', {
    status: 401, headers: { 'content-type': 'text/event-stream' },
  }))
  await assert.rejects(callOpenAi({
    config: { provider: 'openai', model: 'test', baseUrl: 'https://example.invalid/v1', apiKey: 'test-key' },
    options: { messages: [{ role: 'user', content: '测试' }], stream: true },
  }), (error) => error.status === 401 && error.message.includes('Invalid token'))
})

test('client decodes incomplete escaped reply strings without exposing draft JSON', async () => {
  const result = { reply: '你好\n"项目"', changes: [] }
  const events = [
    { type: 'delta', delta: '{"reply":"你\\u59' },
    { type: 'delta', delta: '7d\\n\\"项' },
    { type: 'delta', delta: '目\\"","changes":[]}' },
    { type: 'result', result },
  ].map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join('')
  const replies = []
  assert.deepEqual(await readAiConversation(streamResponse(events, 1), (reply) => replies.push(reply)), result)
  assert.deepEqual(replies, ['你', '你好\n"项', '你好\n"项目"'])
})

test('client receives provider errors through the stream and never returns an applicable draft', async () => {
  const response = createConversationStream(new AbortController().signal, async () => {
    throw new Error('上游返回 Invalid token')
  })
  await assert.rejects(readAiConversation(response, () => {}), /Invalid token/)
})

test('closing the response stream aborts the upstream request', async () => {
  let upstreamSignal
  const response = createConversationStream(new AbortController().signal, async ({ signal }) => {
    upstreamSignal = signal
    await new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }))
    return { reply: '已取消', changes: [] }
  })
  const reader = response.body.getReader()
  await reader.read()
  await reader.cancel()
  assert.equal(upstreamSignal.aborted, true)
})

test('Anthropic and Gemini stream text while keeping thinking content out of the reply', async (t) => {
  let provider = 'anthropic'
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body)
    if (provider === 'anthropic') {
      assert.equal(body.stream, true)
      return streamResponse([
        { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: '内部思考' } },
        { type: 'content_block_delta', delta: { type: 'text_delta', text: '你好' } },
        { type: 'message_delta', delta: { stop_reason: 'end_turn' } },
        { type: 'message_stop' },
      ].map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''))
    }
    assert.match(url, /streamGenerateContent\?alt=sse/)
    assert.equal(body.generationConfig.responseMimeType, 'application/json')
    return streamResponse('data: ' + JSON.stringify({ candidates: [{ content: { parts: [
      { thought: true, text: '内部思考' }, { text: '你好' },
    ] }, finishReason: 'STOP' }] }) + '\n\n')
  })
  const replies = []
  const options = { messages: [{ role: 'user', content: '你好' }], stream: true, jsonResponse: true, onTextDelta: (text) => replies.push(text) }
  const config = { provider: 'anthropic', model: 'test', baseUrl: 'https://example.invalid/v1', apiKey: 'test-key' }
  assert.equal((await callAnthropic({ config, options })).text, '你好')
  provider = 'gemini'
  assert.equal((await callGemini({ config: { ...config, provider }, options })).text, '你好')
  assert.deepEqual(replies, ['你好', '你好'])
})

function conversationHarness(t, hook, props) {
  const react = require('react')
  const slots = []
  let cursor = 0
  t.mock.method(react, 'useRef', (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = { current: initial }
    return slots[index]
  })
  t.mock.method(react, 'useState', (initial) => {
    const index = cursor++
    if (!(index in slots)) slots[index] = initial
    return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
  })
  t.mock.method(require('../hooks/use-toast.ts'), 'useToast', () => ({ toast() {} }))
  t.mock.method(require('../lib/ai/client-config-storage.ts'), 'withStoredAiRequestConfig', (body) => body)
  const render = () => { cursor = 0; return hook(props) }
  const send = async (input) => {
    render().actions.updateInput(input)
    render().actions.submit()
    assert.equal(render().state.isLoading, true)
    for (let attempt = 0; attempt < 20 && render().state.isLoading; attempt++) await new Promise(setImmediate)
    const { state } = render()
    assert.equal(state.isLoading, false, 'completion must unlock the next send')
    assert.equal(state.error, null)
    return state.messages.at(-1)
  }
  return { render, send }
}

for (const scope of ['module', 'global']) {
  test(`${scope} conversation can send again with the complete previous draft and current resume`, async (t) => {
    const changes = [{ type: 'insertRow', row: { type: 'rich', columns: [richList] } }]
    const output = scope === 'module'
      ? { reply: '已生成项目要点', changes }
      : { reply: '已生成项目要点', drafts: [{ moduleId: project.id, moduleName: project.title, changes }] }
    const route = scope === 'module' ? moduleRoute : globalRoute
    const payloads = []
    t.mock.method(globalThis, 'fetch', async (url, options) => {
      if (url.startsWith('/api/ai/')) return route.POST(request(JSON.parse(options.body)))
      payloads.push(JSON.parse(options.body))
      return streamResponse([
        { type: 'response.output_text.delta', delta: JSON.stringify(output) },
        { type: 'response.completed', response: { output_text: JSON.stringify(output) } },
      ].map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''))
    })
    const props = { module: project, resumeData: resume, onApplyRows() {} }
    const hook = scope === 'module' ? useModuleAiConversation : useGlobalAiConversation
    const session = conversationHarness(t, hook, props)
    session.render().actions.updateOpen(true)
    await session.send('生成项目要点')
    await session.send('把刚才的草稿再精简一些')
    assert.equal(payloads.length, 2)
    assert.equal(session.render().state.messages.length, 4)
    const secondHistory = payloads[1].input.slice(2)
    assert.deepEqual(secondHistory.map((message) => message.role), ['user', 'assistant', 'user'])
    assert.deepEqual(JSON.parse(secondHistory[1].content), output, 'the next turn must retain the generated content and layout')
    assert.equal(secondHistory[2].content, '把刚才的草稿再精简一些')
    assert.deepEqual(props.resumeData, resume, 'unconfirmed drafts must not change the resume')

    const updatedProject = applyModuleAiChanges(project, changes)
    props.module = updatedProject
    props.resumeData = { ...resume, modules: [updatedProject, skills] }
    await session.send('根据当前已应用内容继续优化')
    const context = JSON.parse(payloads[2].input[1].content.split('\n')[1])
    assert.equal(context.resume.modules[0].rows.length, updatedProject.rows.length)
    assert.equal(payloads[2].input.at(-1).content, '根据当前已应用内容继续优化')
    session.render().actions.updateOpen(false)
    assert.equal(session.render().state.messages.length, 0)
  })
}
