import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const workflowUrl = new URL('./workflow_conves_recebimento_auto.json', import.meta.url)

test('recebimento AUTO grava cliente e cotacao em uma unica RPC', async () => {
  const workflow = JSON.parse(await readFile(workflowUrl, 'utf8'))
  const names = workflow.nodes.map(node => node.name)
  assert.deepEqual(names, [
    'Webhook Seguro Auto',
    'Normalizar Seguro Auto',
    'Registrar Cotacao Auto Atomica',
    'Responder OK',
  ])

  const rpc = workflow.nodes.find(node => node.name === 'Registrar Cotacao Auto Atomica')
  assert.match(rpc.parameters.url, /registrar_cotacao_auto_novo/)
  assert.match(rpc.parameters.jsonBody, /p_referencia/)
  assert.equal(rpc.retryOnFail, true)
})

test('workflow nao possui mais a gravacao parcial cliente -> cotacao', async () => {
  const workflow = JSON.parse(await readFile(workflowUrl, 'utf8'))
  const serialized = JSON.stringify(workflow)
  assert.doesNotMatch(serialized, /Supabase Upsert Cliente Auto/)
  assert.doesNotMatch(serialized, /Supabase Insert Cotacao Auto/)
})
