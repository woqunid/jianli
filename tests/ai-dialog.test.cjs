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
    return Response.json({ output_text: JSON.stringify({ reply: '已优化项目描述', changes: [
      { type: 'insertRow', row: { type: 'rich', columns: [richList] } },
    ] }) })
  })
  const response = await moduleRoute.POST(request({ module: project, resumeData: resume, messages: [{ role: 'user', content: longInput }] }))
  assert.equal(response.status, 200)
  const data = await response.json()
  assert.equal(applyModuleAiChanges(project, data.changes).rows.length, 2)
})

test('module endpoint cannot apply changes to a different module from the context', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify({ reply: '修改技能', changes: [
    { type: 'replaceTags', rowId: 'skill-row', tags: ['Vue'] },
  ] }) }))
  const response = await moduleRoute.POST(request({ module: project, resumeData: resume, messages: [{ role: 'user', content: '优化项目' }] }))
  assert.equal(response.status, 500)
  assert.match((await response.json()).error, /未找到目标行/)
  assert.deepEqual(skills.rows[0].tags, ['React', 'TypeScript'])
})

test('global endpoint accepts existing body modules and rejects metadata or duplicate targets', async (t) => {
  let drafts = [{ moduleId: 'skills', moduleName: '技能', changes: [{ type: 'replaceTags', rowId: 'skill-row', tags: ['React', 'TypeScript', 'Next.js'] }] }]
  t.mock.method(globalThis, 'fetch', async () => Response.json({ output_text: JSON.stringify({ reply: '已生成修改', drafts }) }))
  const body = { resumeData: resume, messages: [{ role: 'user', content: '完善技能' }] }
  assert.equal((await globalRoute.POST(request(body))).status, 200)
  drafts = [{ ...drafts[0], moduleId: 'personalInfo' }]
  const metadataResponse = await globalRoute.POST(request(body))
  assert.equal(metadataResponse.status, 500)
  assert.match((await metadataResponse.json()).error, /不是现有正文模块/)
  drafts = [{ moduleId: 'skills', moduleName: '技能', changes: [{ type: 'replaceTags', rowId: 'skill-row', tags: ['React'] }] }]
  drafts.push(drafts[0])
  const duplicateResponse = await globalRoute.POST(request(body))
  assert.equal(duplicateResponse.status, 500)
  assert.match((await duplicateResponse.json()).error, /重复模块草稿/)
})
