begin;

-- Uma linha em apolices_auto representa a apolice final. Importacoes antigas
-- chegaram a criar essa linha sem encerrar o card correspondente, deixando a
-- interface exibir "Em andamento" apesar de a apolice ja estar emitida.
update public.emissoes_auto as emissao
set
  coluna = 'apolice_emitida',
  resultado = 'aprovada',
  updated_at = now()
where emissao.resultado is null
  and exists (
    select 1
    from public.apolices_auto as apolice
    where apolice.emissao_id = emissao.id
  );

commit;
